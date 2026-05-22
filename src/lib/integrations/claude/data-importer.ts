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
  /**
   * Fototipo Fitzpatrick normalizado a I-VI (numeral romano). Crítico para
   * tratamientos con láser (define energía y riesgo). Si la planilla menciona
   * "tipo 3" / "fototipo III" / "III" / "5" etc., normalizar acá.
   */
  fitzpatrick: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null;
  /**
   * Contraindicaciones clínicas detectadas (embarazo, alergias específicas,
   * "NO láser", etc.). Texto libre, una por línea. La UI las muestra
   * destacadas para evitar incidentes.
   */
  contraindications: string | null;
  /** Cualquier nota / observación libre (NO contraindicaciones — esas van arriba). */
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

const SYSTEM_PROMPT = `Sos un asistente que extrae listas de clientas (pacientes) de centros de estética argentinos desde datos heterogéneos (planillas Excel, fotos de cuadernos, PDFs). El archivo puede tener UNA hoja con todo o VARIAS hojas (clientas + turnos + pagos + sesiones + notas) — tenés que cruzar info entre hojas.

Workflow obligatorio (hacé los pasos EN ORDEN antes de devolver el JSON):

PASO 1 — Análisis general del archivo
- Listá las hojas que ves. Para cada una, decidí si es de clientas, turnos, pagos, sesiones o notas.
- Detectá el código de área telefónico DOMINANTE del archivo: si ves "381" o "(381)" o "0381" en >50% de los teléfonos visibles, este centro es de Tucumán (San Miguel). Si dominan "11"/"15-XXXX", es CABA/AMBA. Si dominan "351", Córdoba. Etc.
- En \`notes\` poné como primera línea: "Hojas: <lista>. Código de área dominante detectado: <NNN o 'no detectable'>".

PASO 2 — Extracción por persona
Para cada persona individual, extraer estos campos:

  full_name, phone_e164, email, dni, birthdate, fitzpatrick,
  contraindications, notes, issues

Reglas de normalización:

TELÉFONOS — esto es lo más delicado:
- Formato final: E.164 +549<código_área><número>. Ej: Tucumán = +549381XXXXXXX
- Si el número escrito es "15-XXXX-YYYY" sin código de área Y detectaste código dominante en PASO 1 → usá ese código (ej. +549381XXXXXXXX)
- Si NO detectaste código dominante o el dataset es <5 teléfonos → marcá phone_e164=null + issues=["código de área incierto"]
- **NUNCA asumas +5491155... (CABA) por defecto.** Si no podés inferirlo del dataset, dejá null. Es preferible tener menos teléfonos pero correctos que muchos teléfonos que no van a llegar.
- Si "15-" aparece, eso es prefijo histórico de móvil ARGENTINO — se descarta, se reemplaza por "9" del +549. Ej: "15-6677-8899" con código 381 = +5493816677-8899

DNI / CUIT:
- DNI: solo dígitos, 7-9 cifras. Si extraés DNI desde un CUIT (formato XX-XXXXXXXX-X), las 8 cifras del medio son el DNI.
- Validar prefijo de CUIT: 20/23 = persona física masculina, 27/24 = femenina, 30/33 = persona jurídica.
- Si el prefijo NO matchea con el género probable del nombre (María/Sofía con CUIT 20-...), agregá issues=["CUIT con prefijo inconsistente con género del nombre"]
- Validar dígito verificador del CUIT con el algoritmo módulo 11 [5,4,3,2,7,6,5,4,3,2]. Si no cierra, issues=["CUIT con dígito verificador inválido"].

FOTOTIPO FITZPATRICK:
- Si la planilla menciona "tipo I/II/III/IV/V/VI", "fototipo 1-6", "Fitzpatrick II", "piel tipo 3", normalizá al numeral romano I-VI.
- Es CRÍTICO para tratamientos láser (define energía y riesgo de quemadura). NO descartar.
- Si no hay mención → fitzpatrick: null

CONTRAINDICACIONES (campo separado de notes):
- Cualquier flag clínico que afecte servicios: "embarazada", "amamantando", "NO láser", "lactando", "diabetes", "marcapasos", "alérgica a [X]", "anticoagulantes", "isotretinoína", "epilepsia".
- Una contraindicación por línea, prefijo en MAYÚSCULA con el bloqueo: "EMBARAZADA — NO LÁSER", "ALERGIA A LIDOCAÍNA".
- Si hay contraindicaciones, agregá también issues=["tiene contraindicaciones — revisar antes de agendar"]

OTROS:
- Nombres: capitalizar correctamente (María Fernández, no MARIA FERNANDEZ ni maria fernandez)
- Emails: lowercase + trim
- Fechas: YYYY-MM-DD. Si año ambiguo (ej. "12/03/85"), asumí 1900s para edades probables >40, sino 2000s.

PASO 3 — Cross-sheet entity resolution
Si hay hojas de TURNOS, PAGOS, SESIONES:
- Buscá clientas que aparecen en esas hojas pero NO en la hoja de clientas (cliente nuevo s/datos, etc.). Reportá en \`notes\`: "Detecté N personas en turnos/pagos sin registro de clienta: <lista>".
- Buscá DUPLICADOS DE PAGOS: mismo monto + misma fecha + misma persona. Reportá: "Pago duplicado detectado: <nombre>, $<monto>, <fecha>".
- Buscá DUPLICADOS DE TURNOS: mismo horario + mismo profesional + misma persona.
- Buscá CONTRADICCIONES: si una clienta tiene contraindicación "NO láser" pero figura turno de láser, reportá: "Posible incidente: <nombre> con contraindicación láser tiene turno de láser el <fecha>".
- Buscá SESIONES ACUMULADAS por persona (ej. "María José: 2 sesiones piernas") — eso es historial clínico, ponelo en notes de esa clienta.

PASO 4 — Auto-verificación antes de devolver
- Contá las clientas que vas a devolver.
- En \`notes\` poné como última línea: "Total a importar: N clientas (de M filas totales detectadas, se descartaron X duplicados, Y sin nombre)".
- Verificá que N == clients.length antes de cerrar el JSON.

Formato de respuesta — SOLO JSON válido:

{
  "clients": [
    {
      "full_name": "María Fernández",
      "phone_e164": "+5493814561234",
      "email": "maria@example.com",
      "dni": "30123456",
      "birthdate": "1990-03-15",
      "fitzpatrick": "III",
      "contraindications": "EMBARAZADA — NO LÁSER",
      "notes": "Cliente desde 2022. Historial: 2 sesiones piernas.",
      "issues": []
    }
  ],
  "notes": [
    "Hojas: Clientas, Turnos, Pagos. Código de área dominante detectado: 381 (Tucumán).",
    "Detecté 1 persona en turnos sin registro de clienta: 'cliente nuevo s/datos' (fila 12).",
    "Pago duplicado detectado: Ana Belén, $6000, 8/1.",
    "Total a importar: 9 clientas (de 10 filas en hoja clientas, se descartó 1 duplicado)."
  ]
}

Reglas estrictas finales:
- NO INVENTES datos. Si dudás, marcá issue + dejá el campo null.
- Si una fila parece encabezado de tabla o está vacía, ignorala.
- Castellano rioplatense en el campo "notes".
- Devolvé SIEMPRE los 9 campos por cliente (full_name, phone_e164, email, dni, birthdate, fitzpatrick, contraindications, notes, issues), aunque sean null. No los omitas.`;

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
    max_tokens: 16000,
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
    max_tokens: 16000,
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
  const clients: ExtractedClient[] = rawClients.map((c) => {
    const fitzRaw = typeof c.fitzpatrick === 'string' ? c.fitzpatrick.toUpperCase().trim() : null;
    const fitzValid = (['I', 'II', 'III', 'IV', 'V', 'VI'] as const).find((v) => v === fitzRaw);
    return {
      full_name: (c.full_name ?? '').toString().trim(),
      phone_e164: c.phone_e164 ?? null,
      email: c.email ? c.email.toString().toLowerCase().trim() : null,
      dni: c.dni ? c.dni.toString().replace(/\D/g, '') : null,
      birthdate: c.birthdate ?? null,
      fitzpatrick: fitzValid ?? null,
      contraindications: c.contraindications?.toString().trim() || null,
      notes: c.notes?.toString().trim() || null,
      issues: Array.isArray(c.issues) ? c.issues : [],
    };
  });

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

/**
 * Validador de CUIT argentino — algoritmo módulo 11.
 *
 * El CUIT tiene formato XX-XXXXXXXX-X (11 dígitos). Los primeros 2 son el
 * prefijo, los 8 del medio el DNI/identificador, el último el dígito
 * verificador calculado con [5,4,3,2,7,6,5,4,3,2] mod 11.
 *
 * Exportado para que la UI y otros sitios también puedan validar.
 */
export function isValidCuit(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * weights[i]!;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return Number(digits[10]) === expected;
}
