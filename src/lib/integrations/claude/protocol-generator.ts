import { getClaudeClient, CLAUDE_MODELS } from './client';

export interface ProtocolInput {
  clientAge?: number;
  mainObjective: string;
  secondaryObjectives?: string[];
  budgetRange?: string;
  availability: 'weekly' | 'biweekly' | 'monthly';
  bodyZones?: string[];
  knownContraindications?: string;
  skinAnalysis?: {
    scores: Record<string, number>;
    skin_type: string;
    fitzpatrick: string;
  };
  servicesAvailable: Array<{
    id: string;
    name: string;
    category: string | null;
    duration_minutes: number;
    price_ars: number;
  }>;
}

export interface ProtocolResult {
  phases: Array<{
    name: 'preparación' | 'activa' | 'mantenimiento';
    description: string;
    sessions: Array<{
      service_id: string;
      service_name: string;
      session_count: number;
      frequency: string;
      rationale: string;
      expected_result: string;
    }>;
  }>;
  total_sessions: number;
  total_duration_months: number;
  total_price_ars: number;
  expected_results_timeline: string[];
  realistic_disclaimer: string;
}

const SYSTEM_PROMPT = `Sos una cosmiatra experta argentina. Tu tarea es diseñar protocolos de tratamiento estético personalizados, realistas y científicamente fundados.

Reglas estrictas:
- Solo usá servicios del catálogo provisto.
- Estructurá el protocolo en 3 fases: preparación, activa, mantenimiento.
- Sé realista: NO prometas resultados milagrosos.
- Justificá cada sesión con razón científica breve.
- Escribí en español rioplatense (usá "vos").
- Devolvé JSON estructurado válido.`;

export async function generateProtocol(input: ProtocolInput): Promise<ProtocolResult | null> {
  const client = getClaudeClient();
  if (!client) return null;

  const servicesList = input.servicesAvailable
    .map(
      (s) =>
        `- ${s.name} [id: ${s.id}] · ${s.duration_minutes}min · $${s.price_ars}${s.category ? ` · ${s.category}` : ''}`
    )
    .join('\n');

  const userPrompt = `Diseñá un protocolo personalizado.

CONTEXTO DE LA CLIENTA:
- Edad: ${input.clientAge ?? 'no declarada'}
- Objetivo principal: ${input.mainObjective}
- Objetivos secundarios: ${input.secondaryObjectives?.join(', ') || 'ninguno'}
- Presupuesto: ${input.budgetRange ?? 'no declarado'}
- Disponibilidad: ${input.availability === 'weekly' ? '1 vez por semana' : input.availability === 'biweekly' ? 'cada 15 días' : '1 vez al mes'}
- Zonas: ${input.bodyZones?.join(', ') || 'no especificadas'}
- Contraindicaciones: ${input.knownContraindications || 'ninguna declarada'}

${input.skinAnalysis ? `ANÁLISIS DE PIEL PREVIO:
- Tipo: ${input.skinAnalysis.skin_type}, Fitzpatrick ${input.skinAnalysis.fitzpatrick}
- Scores: ${JSON.stringify(input.skinAnalysis.scores)}` : 'Sin análisis de piel previo.'}

CATÁLOGO DE SERVICIOS DEL CENTRO (usar SOLO estos):
${servicesList}

Devolvé JSON con esta estructura exacta:
{
  "phases": [
    {
      "name": "preparación",
      "description": "<qué busca esta fase>",
      "sessions": [
        {
          "service_id": "<id del catálogo>",
          "service_name": "<nombre>",
          "session_count": <int>,
          "frequency": "<ej: 1 cada 15 días>",
          "rationale": "<justificación científica breve>",
          "expected_result": "<resultado realista esperado>"
        }
      ]
    }
  ],
  "total_sessions": <int>,
  "total_duration_months": <int>,
  "total_price_ars": <int sin descuentos>,
  "expected_results_timeline": ["<mes 1: ...>", "<mes 3: ...>", "<mes 6: ...>"],
  "realistic_disclaimer": "<2 oraciones honestas sobre limitaciones>"
}

NO escribas nada fuera del JSON.`;

  try {
    const msg = await client.messages.create({
      model: CLAUDE_MODELS.analysis,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = msg.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ProtocolResult;
  } catch (err) {
    console.error('[generateProtocol]', err);
    return null;
  }
}
