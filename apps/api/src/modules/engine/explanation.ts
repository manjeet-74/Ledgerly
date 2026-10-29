import type { GeneratedDecision } from '@ledgerly/shared';

/**
 * The engine's template summary (built from the exact numbers it computed)
 * is always correct and is the fallback. If ANTHROPIC_API_KEY is set, we
 * additionally ask a model to rephrase it more naturally -- explicitly
 * told to use only the numbers given, never invent its own. Any failure
 * (no key, network error, bad response) silently falls back to the
 * template; a broken LLM call must never break decision creation.
 */
export async function buildDecisionSummary(decision: GeneratedDecision): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return decision.summary;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            'Rewrite this marketing decision summary in two plain-English sentences for a',
            'non-technical business reader. Do not invent or alter any numbers -- use only',
            'the numbers already present in the text below.',
            '',
            decision.summary,
          ].join('\n'),
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (textBlock && 'text' in textBlock && textBlock.text.trim().length > 0) {
      return textBlock.text.trim();
    }
    return decision.summary;
  } catch {
    return decision.summary;
  }
}
