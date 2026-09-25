#!/usr/bin/env node
/*
  Checks every external link in the READMEs, the security policy and the page,
  so a release never ships a dead one. Needs the network, so it is not part of
  node --test.
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILES = ["README.md", "README.ar.md", "SECURITY.md", "CHANGELOG.md", "docs/index.html"];
const SKIP = [/fonts\.(googleapis|gstatic)\.com$/];

const links = new Set();
for (const f of FILES) {
  const text = readFileSync(ROOT + f, "utf8");
  for (const m of text.matchAll(/https?:\/\/[^\s)"'<>`*]+/g)) links.add(m[0].replace(/[.,]$/, ""));
}

let bad = 0;
for (const url of [...links].sort()) {
  if (SKIP.some((r) => r.test(url))) continue;
  let status = 0;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "tawash-link-check" } });
    status = res.status;
  } catch (error) {
    status = String(error.cause?.code || error.message);
  }
  const ok = typeof status === "number" && status < 400;
  if (!ok) bad++;
  console.log((ok ? "ok   " : "FAIL ") + status + "  " + url);
}
process.exit(bad ? 1 : 0);
