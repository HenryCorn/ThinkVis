import { KEY_PATTERN, ProviderError, classifyAbort, classifyHttp } from "./types.ts";
import type { Adapter, ChatResult } from "./types.ts";

type Opts = { apiKey: () => string | undefined; fetch?: typeof fetch; baseUrl?: string };

/** Google Gemini API (generateContent). No tools are sent. The key goes in a header, never in the URL. */
export function googleAdapter(opts: Opts): Adapter {
  const f = opts.fetch ?? fetch;
  const base = opts.baseUrl ?? "https://generativelanguage.googleapis.com";
  return {
    kind: "google",
    billing: "api",
    tools: false,
    async chat(req, { model, signal }): Promise<ChatResult> {
      const key = opts.apiKey();
      if (!key || !KEY_PATTERN.test(key)) throw new ProviderError("not_configured", "The Google API key is not set for this connection.");
      if (signal.aborted) throw classifyAbort(signal);
      const modelId = model.replace(/^models\//, "");
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(modelId)) throw new ProviderError("bad_request", "The model name contains unsupported characters.");
      let res: Response;
      try {
        res = await f(`${base}/v1beta/models/${modelId}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: req.maxTokens },
          }),
          signal,
        });
      } catch {
        if (signal.aborted) throw classifyAbort(signal);
        throw new ProviderError("unavailable", "Could not reach Google.", { retryable: true });
      }
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) throw classifyHttp("Google", res.status, typeof json?.error?.status === "string" ? json.error.status : null);
      const cand = Array.isArray(json?.candidates) ? json.candidates[0] : null;
      const parts: unknown[] = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
      const text = parts.filter((p: any) => p && typeof p.text === "string").map((p: any) => p.text).join("");
      if (!text.trim()) {
        const blocked = typeof json?.promptFeedback?.blockReason === "string" || cand?.finishReason === "SAFETY";
        throw new ProviderError("invalid_output", blocked ? "Google blocked this response." : "Google returned no text.");
      }
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      const u = json.usageMetadata;
      return {
        text,
        finishReason: typeof cand?.finishReason === "string" ? cand.finishReason : null,
        usage: u ? { inputTokens: num(u.promptTokenCount), outputTokens: num(u.candidatesTokenCount) } : null,
      };
    },
  };
}
