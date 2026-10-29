import type { GeneratedDecision } from '@ledgerly/shared';

/**
 * Rewrites the engine's template summary into plain English for a business
 * reader. Tries Google Gemini first (free tier); falls back to Anthropic if
 * only that key is set. If neither key is configured, or if the LLM call
 * fails for any reason, the original template summary is returned unchanged.
 * A broken LLM call must never break decision creation.
 */
export async function buildDecisionSummary(decision: GeneratedDecision): Promise<string> {
  const prompt = [
    'Rewrite this marketing decision summary in two plain-English sentences for a',
    'non-technical business reader. Do not invent or alter any numbers -- use only',
    'the numbers already present in the text below.',
    '',
    decision.summary,
  ].join('\n');

  // --- Google Gemini (primary, free tier) ---
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text.length > 0) return text;
    } catch {
      // fall through to Anthropic or template
    }
  }

  // --- Anthropic Claude (optional fallback) ---
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && 'text' in textBlock && textBlock.text.trim().length > 0) {
        return textBlock.text.trim();
      }
    } catch {
      // fall through to template
    }
  }

  return decision.summary;
}
