// API error codes and their HTTP status + default hint (docs/PLAN.md §5.6).
const CODES = {
  INVALID_URL: [400, 'Paste a full link, such as https://arxiv.org/abs/1706.03762.'],
  BLOCKED_URL: [400, 'Only public http(s) pages on the default port can be fetched.'],
  FETCH_FAILED: [502, 'The page could not be reached. Try again, or pick a built-in sample.'],
  UNSUPPORTED_CONTENT: [415, 'Use an arXiv paper or an HTML article (PDFs work only on arXiv).'],
  TOO_LITTLE_TEXT: [422, 'The page has too little readable text. Try the article page itself.'],
  AI_UNAVAILABLE: [503, 'No model is available here; built-in samples still work.'],
  PLAN_INVALID: [502, 'The model returned an unusable plan. Try again later.'],
  NO_FIGURE: [422, 'No interactive figure fits this idea yet.'],
  RATE_LIMITED: [429, 'Too many new links at once. Wait a minute and try again.'],
  NOT_FOUND: [404, 'See /api/health.'],
  INTERNAL: [500, 'Something went wrong on our side.'],
} as const;

export type ErrorCode = keyof typeof CODES;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;
  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint ?? CODES[code][1];
  }
  get status(): number {
    return CODES[this.code][0];
  }
}

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** `{ ok: false, error: { code, message, hint } }`; unknown errors become INTERNAL. */
export function errorResponse(error: unknown): Response {
  const e = error instanceof ApiError ? error : new ApiError('INTERNAL', 'Unexpected error');
  return json({ ok: false, error: { code: e.code, message: e.message, hint: e.hint } }, e.status);
}
