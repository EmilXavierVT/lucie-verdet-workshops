import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const server = resolve(root, "dist/server/index.js");
const hosting = resolve(root, "dist/.openai/hosting.json");

if (!existsSync(server)) throw new Error("Missing dist/server/index.js");
if (!existsSync(hosting)) throw new Error("Missing dist/.openai/hosting.json");

const source = readFileSync(server, "utf8");
if (!source.includes("fetch(request, env")) {
  throw new Error("Worker artifact does not export a fetch handler");
}

JSON.parse(readFileSync(hosting, "utf8"));
console.log("Artifact ok");
