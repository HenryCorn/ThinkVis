// Stand-in for the Pi CLI. Prints what it was given so tests can check isolation.
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const model = args[args.indexOf("--model") + 1];
if (model === "fail") process.exit(3);
if (model === "slow") await new Promise((r) => setTimeout(r, 10000));
if (model === "empty") process.exit(0);
const prompt = existsSync("prompt.md") ? readFileSync("prompt.md", "utf8") : "";
console.log(JSON.stringify({ args, cwd: process.cwd(), leak: process.env.THINKVIS_TEST_SECRET ?? null, promptHasNote: prompt.includes("# Conversation") }));
