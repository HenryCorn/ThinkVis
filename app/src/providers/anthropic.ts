import { KEY_PATTERN, ProviderError, classifyAbort, classifyHttp } from "./types.ts";
import type { Adapter, ChatResult } from "./types.ts";

type Opts = { apiKey: () => string | undefined; fetch?: typeof fetch; baseUrl?: string };

/** Anthropic Messages API. No tools are sent. The key is read per call and never stored or logged. */
export function anthropicAdapter(opts: Opts): Adapter {
  const f = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? "https://api.anthropic.com";
  return {
    kind: "anthropic",
    billing: "api",
    tools: false,
    async chat(req, { model, signal }): Promise<ChatResult> {
      const key = opts.apiKey();
      if (!key || !KEY_PATTERN.test(key)) throw new ProviderError("not_configured", "The Anthropic API key is not set for this connection.");
      if (signal.aborted) throw classifyAbort(signal);
      let res: Response;
      try {
        res = await f(`${base}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: req.maxTokens, system: req.system, messages: req.messages }),
          signal,
        });
      } catch {
        if (signal.aborted) throw classifyAbort(signal);
        throw new ProviderError("unavailable", "Could not reach Anthropic.", { retryable: true });
      }
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) throw classifyHttp("Anthropic", res.status, typeof json?.error?.type === "string" ? json.error.type : null);
      const blocks: unknown[] = Array.isArray(json?.content) ? json.content : [];
      const text = blocks
        .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text)
        .join("");
      if (!text.trim()) throw new ProviderError("invalid_output", "Anthropic returned no text.");
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      return {
        text,
        finishReason: typeof json.stop_reason === "string" ? json.stop_reason : null,
        usage: json.usage ? { inputTokens: num(json.usage.input_tokens), outputTokens: num(json.usage.output_tokens) } : null,
      };
    },
  };
}
