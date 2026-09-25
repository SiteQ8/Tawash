/*
  The Asli registry of Kuwait's official channels as a watchlist: every brand
  token, every official domain, and the names each body goes by, which the web
  check looks for on a lookalike's page.
*/
import { readFileSync } from "node:fs";
import { clean } from "../engine/domain.js";
import { UA } from "./nrd.js";

export const ASLI_REGISTRY = "https://asli.3li.info/data/registry.json";

export function fromRegistry(registry) {
  const bodies = Array.isArray(registry) ? registry : registry.bodies || [];
  const keywords = new Set();
  const domains = new Set();
  const owners = {};
  const claims = {};
  for (const b of bodies) {
    const names = [
      ...((b.claims && b.claims.en) || []), ...((b.claims && b.claims.ar) || []),
      b.name && b.name.en, b.name && b.name.ar
    ].filter(Boolean);
    for (const t of b.tokens || []) {
      keywords.add(t);
      owners[t] = b.id;
    }
    for (const d of b.domains || []) {
      const host = clean(d);
      domains.add(host);
      owners[host] = b.id;
      claims[host] = [...new Set(names)];
    }
  }
  return { bodies: bodies.length, keywords: [...keywords], domains: [...domains], owners, claims };
}

export async function loadAsli(options = {}) {
  if (options.file) return fromRegistry(JSON.parse(readFileSync(options.file, "utf8")));
  const fetchImpl = options.fetch || globalThis.fetch;
  const res = await fetchImpl(options.url || ASLI_REGISTRY, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error("the Asli registry answered http " + res.status);
  return fromRegistry(await res.json());
}

/* A keywords file: one brand token or domain per line, # starts a comment. */
export function readKeywords(path) {
  const keywords = [];
  const domains = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const v = line.replace(/#.*/, "").trim().toLowerCase();
    if (!v) continue;
    if (v.includes(".")) domains.push(clean(v));
    else keywords.push(v);
  }
  return { keywords, domains, owners: {}, claims: {} };
}
