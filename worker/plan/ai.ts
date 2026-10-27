// The only model call in explorable: one env.AI.run in
// JSON Mode per uncached URL. No retries: a bad plan is PLAN_INVALID, cached.
import { ApiError } from '../errors';
import type { Extracted } from '../extract';
import { sourceOf } from './assemble';
import { type PromptSource, SYSTEM_PROMPT, userMessage } from './prompt';
import { type Plan, parsePlan, planJsonSchema } from './schema';

export const DEFAULT_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const MAX_TOKENS = 1800;
export const TEMPERATURE = 0.2;

/** The part of the Workers AI binding this module uses. */
export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export function planRequest(src: PromptSource, hints: readonly string[]) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(src, hints) },
    ],
    response_format: { type: 'json_schema', json_schema: planJsonSchema() },
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  };
}

const invalid = (message: string) => new ApiError('PLAN_INVALID', message);

/** Ask the model for a Plan. Throws PLAN_INVALID for unusable output, AI_UNAVAILABLE if the call fails. */
export async function requestPlan(ai: AiBinding, model: string, ex: Extracted, hints: readonly string[]): Promise<Plan> {
  let out: unknown;
  try {
    out = await ai.run(model, planRequest({ kind: ex.kind === 'arxiv' ? 'arxiv' : 'blog', title: ex.title, url: ex.url, authors: sourceOf(ex).authors ?? [], text: ex.text }, hints));
  } catch (error) {
    if (/JSON Mode couldn'?t be met/i.test(String((error as Error)?.message ?? error))) {
      throw invalid('The model could not produce a plan that matches the schema.');
    }
    throw new ApiError('AI_UNAVAILABLE', 'The model call failed.', 'The model is unavailable right now. Try again later, or pick a built-in sample.');
  }
  // JSON Mode returns `response` as an object; some models hand back a JSON string.
  let data = typeof out === 'string' ? out : (out as { response?: unknown } | null)?.response;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw invalid('The model reply was not valid JSON.');
    }
  }
  const plan = parsePlan(data);
  if (!plan) throw invalid('The model reply did not match the plan schema.');
  return plan;
}
