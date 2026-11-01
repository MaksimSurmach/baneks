import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

// Pages ignores Cloudflare's _headers; carry the supported CSP into the HTML.
const headers = readFileSync("public/_headers", "utf8");
const policy = /Content-Security-Policy: (.+)/.exec(headers)?.[1];
assert(policy, "Missing Content-Security-Policy");
const metaPolicy = policy.replace(/frame-ancestors [^;]+; ?/, "");
assert(!metaPolicy.includes('"'), "CSP must be safe in an HTML attribute");
const html = readFileSync("dist/index.html", "utf8");
assert(html.includes("<head>"), "Missing HTML head");
const page = html.replace(
  "<head>",
  `<head><meta http-equiv="Content-Security-Policy" content="${metaPolicy}"><meta name="referrer" content="strict-origin-when-cross-origin">`,
);
writeFileSync("dist/index.html", page);
// shortcut: Pages has no SPA rewrites; deep links render with HTTP 404 until moved to a host with rewrites.
writeFileSync("dist/404.html", page);
