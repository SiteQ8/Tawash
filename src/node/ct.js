/*
  Certificate transparency. Every public TLS certificate is logged, so a scam
  site tends to announce itself the moment it gets one, often hours before the
  first message goes out.

  crt.sh is the only free source that searches those logs by pattern. It
  answers 502 and 503 under load, so every query is retried with a pause, and a
  source that stays down is reported as unreachable rather than as clean.
*/
import { clean } from "../engine/domain.js";
import { UA } from "./nrd.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const attempts = options.attempts || 3;
  const pause = options.pause ?? 8000;
  let why = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 45000);
    try {
      const res = await fetchImpl(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: controller.signal });
      if (res.ok) return { ok: true, body: await res.json() };
      why = "http " + res.status;
      if (![429, 500, 502, 503, 504].includes(res.status)) break;
    } catch (error) {
      why = String(error.name === "AbortError" ? "timeout" : error.message || error).slice(0, 60);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < attempts) await sleep(pause * attempt);
  }
  return { ok: false, why };
}

/*
  Queries for a watchlist. Tokens of three letters or fewer match half the internet,
  so they are searched with Kuwait attached, the way scam names carry them.
*/
export function ctQueries(list) {
  const out = new Set();
  for (const e of list.entries) {
    if (e.keyword.length >= 4) out.add("%" + e.keyword + "%");
    else {
      out.add("%" + e.keyword + "%kuwait%");
      out.add("%kuwait%" + e.keyword + "%");
      out.add("%" + e.keyword + "-kw%");
    }
  }
  return [...out].sort();
}

/* One crt.sh search. Resolves to { query, ok, names: [{ name, first }], why }. */
export async function crtsh(query, options = {}) {
  const days = options.days || 3;
  const url = `https://crt.sh/?q=${encodeURIComponent(query)}&output=json&exclude=expired`;
  const answer = await getJson(url, options);
  if (!answer.ok) return { query, ok: false, names: [], why: answer.why };
  const cutoff = (options.now || Date.now()) - days * 86400000;
  const names = new Map();
  for (const row of Array.isArray(answer.body) ? answer.body : []) {
    const seen = Date.parse(row.not_before || row.entry_timestamp || "");
    if (Number.isFinite(seen) && seen < cutoff) continue;
    for (const raw of String(row.name_value || "").split("\n")) {
      const name = clean(raw);
      if (!name || !name.includes(".") || /\s/.test(name)) continue;
      if (!names.has(name)) names.set(name, { name, first: String(row.not_before || "").slice(0, 10) });
    }
  }
  return { query, ok: true, names: [...names.values()], why: "" };
}

/*
  Runs several searches within a time budget. Resolves to
  { names, reached, failed, skipped }.
*/
export async function searchLogs(queries, options = {}) {
  const budget = (options.budget || 600) * 1000;
  const started = Date.now();
  const names = new Map();
  const reached = [];
  const failed = [];
  const skipped = [];
  for (const q of queries) {
    if (Date.now() - started > budget) {
      skipped.push(q);
      continue;
    }
    const r = await crtsh(q, options);
    if (!r.ok) {
      failed.push({ query: q, why: r.why });
      continue;
    }
    reached.push(q);
    for (const n of r.names) if (!names.has(n.name)) names.set(n.name, n);
  }
  return { names: [...names.values()], reached, failed, skipped };
}

/* The newest certificate issued for a domain, from Cert Spotter. Resolves to { issued } or null. */
export async function latestCertificate(domain, options = {}) {
  const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true`;
  const answer = await getJson(url, { ...options, attempts: 1 });
  if (!answer.ok || !Array.isArray(answer.body) || !answer.body.length) return null;
  const newest = answer.body.map((c) => c.not_before).filter(Boolean).sort().pop();
  return newest ? { issued: newest.slice(0, 10) } : null;
}
