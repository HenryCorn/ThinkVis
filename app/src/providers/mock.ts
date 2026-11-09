import { ProviderError, classifyAbort } from "./types.ts";
import type { Adapter, ChatRequest } from "./types.ts";

/**
 * Deterministic offline provider for contract tests and development. The
 * model name selects a behavior so tests can exercise every failure path.
 */
export function mockAdapter(opts: { reply?: (req: ChatRequest, model: string) => string | undefined } = {}): Adapter {
  const seen = new Map<string, number>();
  return {
    kind: "mock",
    billing: "none",
    tools: false,
    async chat(req, { model, signal }) {
      if (signal.aborted) throw classifyAbort(signal);
      const calls = (seen.get(model) ?? 0) + 1;
      seen.set(model, calls);
      switch (model) {
        case "mock-auth":
          throw new ProviderError("auth", "Mock authentication failure.");
        case "mock-bad-request":
          throw new ProviderError("bad_request", "Mock bad request.");
        case "mock-rate-limit-once":
          if (calls === 1) throw new ProviderError("rate_limit", "Mock rate limit.", { retryable: true });
          break;
        case "mock-always-unavailable":
          throw new ProviderError("unavailable", "Mock outage.", { retryable: true });
        case "mock-empty":
          throw new ProviderError("invalid_output", "Mock returned no text.");
        case "mock-slow":
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, 10_000);
            signal.addEventListener("abort", () => { clearTimeout(t); reject(classifyAbort(signal)); }, { once: true });
          });
          break;
        case "mock-huge":
          return { text: "x".repeat(60_000), usage: null, finishReason: "stop" };
      }
      const scripted = opts.reply?.(req, model);
      if (scripted !== undefined) return { text: scripted, usage: { inputTokens: 1, outputTokens: 1 }, finishReason: "stop" };
      const last = req.messages[req.messages.length - 1]?.content ?? "";
      return {
        text: `MOCK(${model}) saw ${req.messages.length} message(s). Last: ${last.slice(0, 200)}`,
        usage: { inputTokens: req.system.length + last.length, outputTokens: 12 },
        finishReason: "stop",
      };
    },
  };
}
