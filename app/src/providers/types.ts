export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
};

export type Usage = { inputTokens: number | null; outputTokens: number | null };

export type ChatResult = {
  text: string;
  usage: Usage | null;
  finishReason: string | null;
};

export type ProviderErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "cancelled"
  | "unavailable"
  | "bad_request"
  | "invalid_output";

/**
 * Failure from a provider adapter. Messages are written by us, never copied
 * from upstream bodies, so a prompt or a credential cannot leak through them.
 */
export class ProviderError extends Error {
  code: ProviderErrorCode;
  retryable: boolean;
  status: number | null;
  constructor(code: ProviderErrorCode, message: string, opts: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.status = opts.status ?? null;
  }
}

/** Where the money or allowance comes from. Shown on every response. */
export type BillingKind = "api" | "subscription-bridge" | "none";

export type Adapter = {
  kind: string;
  billing: BillingKind;
  /** Providers receive no tools, ever. Declared so the UI and tests can assert it. */
  tools: false;
  chat(req: ChatRequest, opts: { model: string; signal: AbortSignal }): Promise<ChatResult>;
};

export function classifyAbort(signal: AbortSignal): ProviderError {
  const reason = signal.reason as { name?: string } | undefined;
  return reason?.name === "TimeoutError"
    ? new ProviderError("timeout", "The provider took too long to respond.", { retryable: true })
    : new ProviderError("cancelled", "The request was cancelled.");
}

export function classifyHttp(vendor: string, status: number, upstreamType: string | null): ProviderError {
  const tag = upstreamType && /^[a-zA-Z0-9_.-]{1,60}$/.test(upstreamType) ? ` (${upstreamType})` : "";
  const msg = `${vendor} returned HTTP ${status}${tag}.`;
  if (status === 401 || status === 403) return new ProviderError("auth", `${msg} Check that the API key is valid and has access to this model.`, { status });
  if (status === 429) return new ProviderError("rate_limit", `${msg} Rate limit or quota reached.`, { status, retryable: true });
  if (status === 408 || status === 409 || status >= 500) return new ProviderError("unavailable", msg, { status, retryable: true });
  return new ProviderError("bad_request", msg, { status });
}

export const KEY_PATTERN = /^[\x21-\x7e]{8,512}$/;
