import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const template = readFileSync(resolve(root, "worker/api.js"), "utf8");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const adminHtml = readFileSync(resolve(root, "admin.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const client = readFileSync(resolve(root, "script.js"), "utf8");
const adminClient = readFileSync(resolve(root, "admin.js"), "utf8");

const output = template
  .replace("__HTML__", JSON.stringify(html))
  .replace("__ADMIN_HTML__", JSON.stringify(adminHtml))
  .replace("__CSS__", JSON.stringify(css))
  .replace("__CLIENT_JS__", JSON.stringify(client))
  .replace("__ADMIN_JS__", JSON.stringify(adminClient));

writeFileSync(resolve(root, "dist/server/index.js"), output);
