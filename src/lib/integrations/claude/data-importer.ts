/**
 * Importador de datos asistido por Claude.
 *
 * Recibe archivos heterogéneos (Excel, CSV, fotos de cuaderno, PDFs) y
 * devuelve una lista normalizada de clientas con campos validados.
 *
 * Flow:
 *   1. Caller pasa el archivo (buffer + mimeType)
 *   2. Si es spreadsheet → parsea a texto markdown table
 *   3. Si es imagen → manda directo a Claude Vision
 *   4. Si es PDF → convierte a base64 (Claude Vision lo banca)
 *   5. Claude extrae lista estructurada de clientas
 *   6. Normalizamos teléfonos AR, validamos emails, marcamos issues
 *
 * Devuelve siempre el shape `ImportResult` con: clients[], warnings[], stats.
 *
 * El caller (el endpoint /api/import/parse) maneja persistencia,
 * autenticación y rate limit.
 */

import { read, utils } from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractedClient {
  /** Nombre completo, ya limpio (sin espacios extra, capitalizado). */
  full_name: string;
  /** Teléfono normalizado a formato +549XXXXXXXXXX o null si no detectable. */
  phone_e164: string | null;
  /** Email lowercased o null. */
  email: string | null;
  /** DNI solo dígitos o null. */
  dni: string | null;
  /** Fecha de nacimiento ISO YYYY-MM-DD o null. */
  birthdate: string | null;
  /** Cualquier nota / observación libre. */
  notes: string | null;
  /** Issues detectados por la IA o validación (ej. "teléfono incompleto"). */
  issues: string[];
}

export interface ImportResult {
  /** Clientas extraídas, en el orden del archivo original. */
  clients: ExtractedClient[];
  /** Mensajes globales (ej. "detecté 2 hojas en el Excel, usé la primera"). */
  notes: string[];
  /** Resumen para mostrar al usuario. */
  stats: {
    total: number;
    with_phone: number;
    with_email: number;
    with_issues: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Parsers por tipo de archivo
// ────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
  'application/octet-stream', // a veces Excel viene así
]);

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const PDF_MIME = 'application/pdf';

/**
 * Convierte una hoja de cálculo a una representación textual que Claude
 * puede leer fácilmente. No le mandamos el binario — extraemos el texto
 * acá y se lo damos como contexto.
 */
function spreadsheetToText(buffer: Buffer): string {
  const wb = read(buffer, { type: 'buffer', cellDates: true });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    // sheet_to_csv mantiene el orden de filas y columnas
    const csv = utils.sheet_to_csv(sheet, { blankrows: false });
    parts.push(`### Hoja: ${sheetName}\n${csv.trim()}`);
  }
  return parts.join('\n\n');
}

// ────────────────────────────────────────────────────────────────────────────
// Claude prompt
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente que extrae listas de clientas (pacientes) de centros de estética desde datos heterogéneos (planillas Excel, fotos de cuadernos, PDFs).

Tu trabajo:
1. Identificar cada persona individual en los datos
2. Para cada una extraer: nombre completo, teléfono, email, DNI, fecha de nacimiento, notas/observaciones
3. Normalizar formatos:
   - Teléfonos argentinos: formato E.164 +549XXXXXXXXXX (10 dígitos después del 549). Si tiene código de área, mantenelo. Si no podés determinar, dejá null
   - Emails: lowercase, trim
   - Nombres: capitalizar (María Fernández, no MARIA FERNANDEZ ni maria fernandez)
   - DNI: solo dígitos (sin puntos)
   - Fechas: YYYY-MM-DD. Si el año está ambiguo (ej. "12/03/85"), asumí 1900s para edades >50, sino 2000s
4. Si detectás issues en un registro (teléfono incompleto, email inválido, datos contradictorios), agregalos al array \`issues\`
5. Devolvé SOLO JSON válido en este formato:

{
  "clients": [
    {
      "full_name": "María Fernández",
      "phone_e164": "+5491155551234",
      "email": "maria@example.com",
      "dni": "30123456",
      "birthdate": "1990-03-15",
      "notes": "Alérgica a la lidocaína",
      "issues": []
    }
  ],
  "notes": ["Detecté 47 filas en la hoja 'Clientas', ignoré la primera fila que era el encabezado"]
}

Reglas estrictas:
- No inventes datos. Si no hay email, poné null. No completes con datos falsos.
- Si una fila parece encabezado de tabla o está vacía, ignorala.
- Si encontrás varios teléfonos para una misma persona, usá el primero y mencionalo en notes.
- Si dos filas parecen ser la misma persona (duplicado), incluí solo una y mencionalo en notes.
- Castellano rioplatense en el campo "notes" (vos hablás como una clínica argentina).`;

// ────────────────────────────────────────────────────────────────────────────
// Parsers de IA
// ────────────────────────────────────────────────────────────────────────────

/**
 * Punto de entrada principal. El caller le pasa el archivo y devuelve
 * ImportResult o lanza error si no se puede procesar.
 */
export async function parseFileWithAI(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<ImportResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada — el importador necesita IA.');
  }

  const client = new Anthropic({ apiKey });

  let messages: Anthropic.MessageParam[];

  if (SPREADSHEET_MIMES.has(params.mimeType) || /\.(xlsx|xls|csv)$/i.test(params.filename)) {
    const text = spreadsheetToText(params.buffer);
    if (!text.trim()) {
      throw new Error('La planilla está vacía o no pudo leerse.');
    }
    messages = [
      {
        role: 'user',
        content: `Te paso una planilla con clientas de un centro de estética. Extraé la lista normalizada en el formato JSON que te indiqué.\n\n${text}`,
      },
    ];
  } else if (IMAGE_MIMES.has(params.mimeType)) {
    const base64 = params.buffer.toString('base64');
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: params.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Te paso una foto/captura con listas de clientas de un centro de estética (puede ser cuaderno, screenshot de WhatsApp, etc.). Extraé la lista normalizada en JSON.',
          },
        ],
      },
    ];
  } else if (params.mimeType === PDF_MIME || /\.pdf$/i.test(params.filename)) {
    const base64 = params.buffer.toString('base64');
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Te paso un PDF con clientas de un centro de estética. Extraé la lista normalizada en JSON.',
          },
        ],
      },
    ];
  } else {
    throw new Error(
      `Formato no soportado: ${params.mimeType} (${params.filename}). Aceptamos Excel, CSV, imágenes (JPG/PNG/WEBP) y PDF.`
    );
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude no devolvió texto.');
  }

  const parsed = extractJson(textBlock.text);
  return finalizeResult(parsed);
}

// ────────────────────────────────────────────────────────────────────────────
// Corrección via chat
// ────────────────────────────────────────────────────────────────────────────

export interface CorrectParams {
  /** Resultado anterior que el user quiere corregir. */
  previousResult: ImportResult;
  /** Historial de mensajes del chat de corrección (excluye la última del user). */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Nuevo mensaje del user con la corrección que pide. */
  userMessage: string;
}

export interface CorrectResult {
  /** Resultado actualizado tras aplicar la corrección. */
  result: ImportResult;
  /** Respuesta de Claude para mostrar en el chat. */
  assistantMessage: string;
}

const CORRECTION_SYSTEM_PROMPT = `Sos un asistente que ayuda a corregir una lista de clientas extraída de un archivo. El usuario te va a dar instrucciones para ajustar la lista (ej. "borrá las que están vacías", "la columna 'obs' es notas", "agregale el código de área 11 a los teléfonos sin código").

Para cada mensaje del usuario:
1. Aplicá la corrección a la lista actual
2. Devolvé SOLO JSON válido en este formato:

{
  "result": { ... mismo shape que antes con clients[] + notes[] ... },
  "assistant_message": "Texto corto en castellano rioplatense explicando qué cambiaste (ej. 'Listo, agregué el código de área 11 a 23 teléfonos. Quedan 47 clientas válidas')."
}

Si el usuario te pide algo que no podés hacer (ej. "dale prioridad a las que viven en Palermo" y no tenés datos de dirección), respondé en assistant_message explicando que no podés y dejá el result igual.

Si el usuario tiene una pregunta y no una corrección (ej. "¿cuántas clientas tienen email?"), respondé en assistant_message y dejá el result igual.`;

export async function correctWithAI(params: CorrectParams): Promise<CorrectResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada.');

  const client = new Anthropic({ apiKey });

  // Construimos el "estado actual" como contexto + historial
  const contextMessage = `Estado actual de la lista:\n\n${JSON.stringify(params.previousResult, null, 2)}`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: contextMessage },
    { role: 'assistant', content: 'Listo, tengo la lista actual en mente. ¿Qué corrección querés hacer?' },
    ...params.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: params.userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    system: CORRECTION_SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude no devolvió texto en la corrección.');
  }

  const parsed = extractJson(textBlock.text);
  const newResult = finalizeResult(parsed.result ?? parsed);
  const assistantMessage =
    parsed.assistant_message ?? 'Listo, hice los cambios. Revisá la tabla.';

  return { result: newResult, assistantMessage };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Claude a veces envuelve el JSON en bloques de código markdown.
 * Extraemos el primer objeto/array JSON válido del texto.
 */
function extractJson(text: string): {
  clients?: Array<Partial<ExtractedClient>>;
  notes?: string[];
  result?: ImportResult;
  assistant_message?: string;
} {
  // Saca el fence ```json ... ``` si está
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : text.trim();

  // Encuentra el primer { y el último } que matcheen
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < 0) {
    throw new Error(`Claude no devolvió JSON válido. Output: ${text.slice(0, 200)}`);
  }
  const jsonStr = candidate.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `Error parseando JSON de Claude: ${err instanceof Error ? err.message : err}. Output: ${jsonStr.slice(0, 200)}`
    );
  }
}

function finalizeResult(parsed: {
  clients?: Array<Partial<ExtractedClient>>;
  notes?: string[];
}): ImportResult {
  const rawClients = parsed.clients ?? [];
  const clients: ExtractedClient[] = rawClients.map((c) => ({
    full_name: (c.full_name ?? '').toString().trim(),
    phone_e164: c.phone_e164 ?? null,
    email: c.email ? c.email.toString().toLowerCase().trim() : null,
    dni: c.dni ? c.dni.toString().replace(/\D/g, '') : null,
    birthdate: c.birthdate ?? null,
    notes: c.notes ?? null,
    issues: Array.isArray(c.issues) ? c.issues : [],
  }));

  // Validación + augmentar issues
  for (const c of clients) {
    if (!c.full_name) c.issues.push('sin nombre');
    if (c.phone_e164 && !/^\+\d{8,15}$/.test(c.phone_e164)) {
      c.issues.push('teléfono formato inválido');
    }
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
      c.issues.push('email inválido');
    }
    if (c.dni && (c.dni.length < 7 || c.dni.length > 9)) {
      c.issues.push('DNI longitud inválida');
    }
  }

  const stats = {
    total: clients.length,
    with_phone: clients.filter((c) => c.phone_e164).length,
    with_email: clients.filter((c) => c.email).length,
    with_issues: clients.filter((c) => c.issues.length > 0).length,
  };

  return {
    clients,
    notes: parsed.notes ?? [],
    stats,
  };
}
