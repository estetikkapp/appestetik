import { getClaudeClient, CLAUDE_MODELS } from './client';

export interface SkinAnalysisInput {
  imageBase64: string; // PNG/JPG sin prefix data:
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  clientAge?: number;
  clientObjective?: string;
  servicesAvailable: Array<{ id: string; name: string; category: string | null }>;
}

export interface SkinAnalysisResult {
  scores: {
    hydration: number;
    spots: number;
    wrinkles: number;
    pores: number;
    redness: number;
    acne: number;
    elasticity: number;
  };
  fitzpatrick: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  skin_type: 'seca' | 'mixta' | 'grasa' | 'sensible' | 'normal';
  summary: string;
  findings: string[];
  recommendations: Array<{
    treatment: string;
    rationale: string;
    frequency: string;
    matched_service_id?: string;
  }>;
  home_care: string[];
}

const SYSTEM_PROMPT = `Sos una dermatóloga experta argentina con 20 años de experiencia.
Recibís fotos de pacientes y un objetivo declarado, y devolvés un análisis estructurado en español rioplatense (usá "vos", no "tú"; "clienta", no "cliente").

Reglas estrictas:
- NO inventes datos clínicos que no podés ver en la foto.
- NO prometas resultados milagrosos.
- Sé cálida pero profesional.
- Escala de scores: 1-10 donde 10 es mejor (10 hidratación = piel ideal, 10 spots = sin manchas).
- Solo recomendá tratamientos del catálogo provisto del centro.

Devolvé SIEMPRE un JSON válido con la estructura exacta indicada.`;

export async function analyzeSkin(input: SkinAnalysisInput): Promise<SkinAnalysisResult | null> {
  const client = getClaudeClient();
  if (!client) return null;

  const servicesList = input.servicesAvailable
    .map((s) => `- ${s.name}${s.category ? ` (${s.category})` : ''} [id: ${s.id}]`)
    .join('\n');

  const userPrompt = `Analizá esta foto facial.

Edad de la clienta: ${input.clientAge ?? 'no declarada'}
Objetivo principal: ${input.clientObjective ?? 'evaluación general'}

Servicios disponibles en el centro:
${servicesList}

Devolvé JSON con esta estructura exacta:
{
  "scores": {
    "hydration": <1-10>,
    "spots": <1-10>,
    "wrinkles": <1-10>,
    "pores": <1-10>,
    "redness": <1-10>,
    "acne": <1-10>,
    "elasticity": <1-10>
  },
  "fitzpatrick": "<I|II|III|IV|V|VI>",
  "skin_type": "<seca|mixta|grasa|sensible|normal>",
  "summary": "<2 oraciones diagnóstico general>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "recommendations": [
    {
      "treatment": "<nombre del servicio del catálogo>",
      "rationale": "<justificación científica breve>",
      "frequency": "<ej: cada 15 días, x 6 sesiones>",
      "matched_service_id": "<id del catálogo si aplica, sino null>"
    }
  ],
  "home_care": ["<sugerencia 1>", "<sugerencia 2>", "<sugerencia 3>"]
}

NO escribas nada fuera del JSON.`;

  try {
    const msg = await client.messages.create({
      model: CLAUDE_MODELS.analysis,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.mimeType, data: input.imageBase64 } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    });

    const textBlock = msg.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    // Extraer JSON del response (puede venir con markdown wrapping)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as SkinAnalysisResult;
  } catch (err) {
    console.error('[analyzeSkin]', err);
    return null;
  }
}
