/*
  One scan, the same in the browser and on the command line: learn the
  original's servers, take the search list, ask DNS about each name on it, and
  score what exists.
*/
import { parse, clean } from "./domain.js";
import { permute } from "./permute.js";
import { assess, rank } from "./score.js";

export const VERSION = "1.0.1";

/* Runs worker over items with at most size running at once. */
export async function pool(items, size, worker, signal) {
  let next = 0;
  const out = new Array(items.length);
  async function lane() {
    while (next < items.length) {
      if (signal && signal.aborted) return;
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, lane));
  return out;
}

/* Turns free text (commas, spaces, new lines) into a clean list of host names. */
export function hostList(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).map(clean).filter(Boolean))];
}

/*
  scan("example.com", {
    resolver,            anything with lookup(name)
    algorithms,          technique ids, all by default
    known: { ns, mx },   servers the person says are theirs
    exclude,             host names to leave out
    concurrency,         parallel lookups
    rdap,                an rdapClient, to add registration dates
    rdapFilter(result),  optional, which results are worth a date lookup
    signal,              AbortSignal to stop early
    onOriginal(info),    called once the original's servers are known
    onResult(result),    called for every lookalike as its answer arrives,
                         and again when its registration date arrives
  })
  resolves to a report: { tool, version, kind, generated, target, original, results }
*/
export async function scan(input, options = {}) {
  const p = parse(input);
  if (!p) throw new TypeError("not a domain name: " + input);
  const resolver = options.resolver;
  const known = options.known || {};
  const excluded = new Set((options.exclude || []).map(clean));

  const dns = await resolver.lookup(p.registrable);
  const original = {
    domain: p.registrable,
    name: p.name,
    registrable: p.registrable,
    exists: dns.exists,
    a: dns.a || [],
    ns: dns.ns || [],
    mx: dns.mx || []
  };
  if (options.onOriginal) options.onOriginal(original);

  const candidates = permute(p, { algorithms: options.algorithms, limit: options.limit }).filter(
    (c) => !excluded.has(c.domain) && !excluded.has(c.unicode)
  );
  if (options.onCandidates) options.onCandidates(candidates);

  const context = { original, listed: known };
  const done = new Map();
  const emit = (r) => {
    done.set(r.domain, r);
    if (options.onResult) options.onResult(r);
  };
  const check = async (c) => {
    let answer = await resolver.lookup(c.domain);
    let age = null;
    const stopped = () => options.signal && options.signal.aborted;
    /* A lame delegation looks registered. Where a registry can confirm it, ask. */
    if (answer.lame && options.rdap && !stopped()) {
      age = await options.rdap.registered(c.domain);
      if (age && age.found === false) answer = { ...answer, exists: false, lame: false };
    }
    let r = { ...c, dns: answer };
    if (age && age.created) r.age = age;
    r = { ...r, ...assess(r, context) };
    emit(r);
    const wantsAge = options.rdap && !age && (r.status === "live" || r.status === "registered") &&
      (!options.rdapFilter || options.rdapFilter(r)) && !stopped();
    if (wantsAge) {
      age = await options.rdap.registered(c.domain);
      if (age && age.created) {
        r = { ...r, age };
        r = { ...r, ...assess(r, context) };
        emit(r);
      }
    }
  };
  await pool(candidates, options.concurrency || 8, check, options.signal);
  /* Timeouts under load are common, so anything unanswered gets one slower second try. */
  const retry = candidates.filter((c) => done.has(c.domain) && done.get(c.domain).status === "unknown");
  if (retry.length) await pool(retry, 4, check, options.signal);

  const results = [...done.values()];
  for (const c of candidates) {
    if (!done.has(c.domain)) results.push({ ...c, ...assess({ domain: c.domain }, context) });
  }

  return {
    tool: "tawash",
    version: VERSION,
    kind: "scan",
    generated: new Date().toISOString(),
    target: p.registrable,
    original,
    listed: known,
    stopped: Boolean(options.signal && options.signal.aborted),
    results: rank(results)
  };
}

/* Re-scores a result after something new is known about it, such as its web page. */
export function rescore(result, report) {
  const context = { original: report.original || {}, listed: report.listed || {} };
  return { ...result, ...assess(result, context) };
}
