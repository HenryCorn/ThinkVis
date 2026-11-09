import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProviderError, classifyAbort } from "./types.ts";
import type { Adapter } from "./types.ts";

/**
 * Experimental bridge to the user's own installed Pi CLI (for example a
 * GitHub Copilot model they have signed in to inside Pi). It is isolated
 * as far as Pi's flags allow: no tools, no MCP, no extensions, skills,
 * prompt templates or context files, no session, a throwaway working
 * directory, and an environment that carries none of this app's secrets.
 * Pi's own docs say a subprocess is not a sandbox, so this stays off unless
 * the user turns it on, and it never reads Pi's credential store.
 *
 * Not verified against a live Pi account: tests use a fake executable.
 */
const SYSTEM = "You are a tutoring assistant. Read the attached prompt file and answer its final learner message. Use no tools.";
const ENV_ALLOW = [
  "PATH", "PATHEXT", "SystemRoot", "ComSpec", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP",
  "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "XDG_CONFIG_HOME", "XDG_DATA_HOME",
];
const MAX_OUT = 1024 * 1024;

export function piAdapter(opts: { command: string[] }): Adapter {
  return {
    kind: "pi",
    billing: "subscription-bridge",
    tools: false,
    async chat(req, { model, signal }) {
      if (signal.aborted) throw classifyAbort(signal);
      if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(model) || model.startsWith("-")) throw new ProviderError("bad_request", "Unsupported model name for the Pi bridge.");
      const dir = mkdtempSync(path.join(tmpdir(), "thinkvis-pi-"));
      try {
        const transcript = req.messages.map((m) => `## ${m.role === "user" ? "Learner" : "Assistant"}\n${m.content}`).join("\n\n");
        writeFileSync(path.join(dir, "prompt.md"), `# Instructions\n${req.system}\n\n# Conversation\n${transcript}\n`);
        const env: Record<string, string> = {};
        for (const k of ENV_ALLOW) if (process.env[k] !== undefined) env[k] = process.env[k] as string;
        const [cmd, ...pre] = opts.command;
        const args = [
          ...pre, "-p", "--no-tools", "--no-session", "--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates",
          "--no-themes", "--no-context-files", "--no-approve", "--model", model, "--system-prompt", SYSTEM,
          "@prompt.md", "Answer the final learner message.",
        ];
        return await new Promise((resolve, reject) => {
          const child = spawn(cmd, args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: false });
          let out = "";
          let overflow = false;
          const onAbort = () => { child.kill("SIGKILL"); };
          signal.addEventListener("abort", onAbort, { once: true });
          child.stdout.on("data", (d: Buffer) => {
            if (out.length + d.length > MAX_OUT) { overflow = true; child.kill("SIGKILL"); return; }
            out += d.toString("utf8");
          });
          child.stderr.resume();
          child.on("error", () => {
            signal.removeEventListener("abort", onAbort);
            reject(new ProviderError("not_configured", "The Pi command could not be started. Check the connection's command."));
          });
          child.on("close", (code) => {
            signal.removeEventListener("abort", onAbort);
            if (signal.aborted) return reject(classifyAbort(signal));
            if (overflow) return reject(new ProviderError("invalid_output", "Pi produced too much output."));
            if (code !== 0) return reject(new ProviderError("unavailable", `Pi exited with code ${code}. Check that you are signed in to that model inside Pi.`));
            if (!out.trim()) return reject(new ProviderError("invalid_output", "Pi returned no text."));
            resolve({ text: out.trim(), usage: null, finishReason: null });
          });
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
