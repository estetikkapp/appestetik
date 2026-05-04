import Anthropic from '@anthropic-ai/sdk';

/**
 * Cliente Claude API para análisis de piel y generación de protocolos.
 * Requiere ANTHROPIC_API_KEY env var. Si no está, retorna null y los
 * Server Actions devuelven un mensaje de "no configurado".
 */
export function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('placeholder')) return null;
  return new Anthropic({ apiKey });
}

export const CLAUDE_MODELS = {
  // Modelos según spec original. Si los nombres cambiaron, ajustar acá.
  // Análisis profundo (visión + razonamiento)
  analysis: 'claude-sonnet-4-5',
  // Chat rápido
  chat: 'claude-haiku-4-5',
} as const;
