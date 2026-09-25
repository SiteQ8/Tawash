/*
  Turning what DNS (and optionally the web) said about a lookalike into a
  status, a score and the reasons behind the score.

  The score measures how much attention a lookalike deserves. It is not a
  verdict: a registered lookalike can belong to the brand itself, or to someone
  with an innocent reason to own it. That is why every point comes with a reason
  a person can check.
*/
import { parse, isUnder } from "./domain.js";
import { distance } from "./similarity.js";
import { toUnicode } from "./punycode.js";
import { ageInDays } from "./rdap.js";
import { LURE_WORDS, KUWAIT_WORDS, RISKY_TLDS, FREE_HOSTS, SHARED_NS, SHARED_MX, PARKING_NS } from "./data.js";

export const STATUSES = ["live", "registered", "known", "absent", "unknown", "unchecked"];

/*
  Plenty of short names were registered decades ago by people with no interest
  in Kuwait, and nearly all of them answer on the web and take mail. So those
  facts earn little, while intent (lure words, Kuwait in the name, lookalike
  characters) and recency (a registration this month, a fresh certificate) earn
  the most.
*/
export const POINTS = {
  registered: 10, resolves: 10, mail: 10, lure: 25, kuwait: 20, idn: 25,
  "risky-tld": 10, "free-host": 15, "one-edit": 5, new: 30, recent: 15,
  nrd: 30, ct: 15, "web-similar": 25, "names-brand": 30, cert: 15
};

const host = (h) => String(h || "").toLowerCase().replace(/\.$/, "");
/* Mail hosts that can really receive mail: not a null MX and not localhost. */
const realMx = (list) => (list || []).map((m) => host(m.exchange || m)).filter((m) => m && m !== "localhost" && m.includes("."));
/* Entries with a dot are domains and match as suffixes, the rest are provider names. */
const shared = (h, list) =>
  list.some((s) => (s.includes(".") ? host(h) === s || host(h).endsWith("." + s) : host(h).includes(s)));

/*
  Decides whether a lookalike is already the brand's own, using evidence that
  is hard to fake and easy to check:
    its name servers live inside the original domain (ns1.example.com)
    it has exactly the original's name servers, and they are not a shared host
    it has one of the original's mail hosts, and that host is not shared
    it uses a server the person listed as theirs
*/
export function knownBy(dns, original = {}, listed = {}) {
  const ns = (dns.ns || []).map(host);
  const mx = (dns.mx || []).map((m) => host(m.exchange || m));
  const reg = original.registrable;
  if (reg && ns.length && ns.some((n) => isUnder(n, reg))) return "known-owner";
  const origNs = (original.ns || []).map(host).sort();
  if (origNs.length && ns.length && origNs.join() === [...ns].sort().join() && !ns.every((n) => shared(n, SHARED_NS))) {
    return "known-ns";
  }
  const origMx = new Set((original.mx || []).map((m) => host(m.exchange || m)));
  if (mx.some((m) => origMx.has(m) && !shared(m, SHARED_MX))) return "known-mx";
  const mine = [...(listed.ns || []), ...(listed.mx || [])].map(host).filter(Boolean);
  if (mine.length && [...ns, ...mx].some((h) => mine.some((m) => h === m || h.endsWith("." + m)))) return "known-list";
  return null;
}

/* Parking services answer for millions of names, so their addresses say nothing about an owner. */
export function isParked(dns) {
  return (dns.ns || []).some((n) => PARKING_NS.some((p) => host(n) === p || host(n).endsWith("." + p)));
}

/* Reasons that come from the name alone. */
export function nameReasons(domain, original) {
  const reasons = [];
  const p = parse(domain);
  if (!p) return reasons;
  const words = [...(p.sub ? p.sub.split(".") : []), p.name].join("-").split(/[^a-z0-9]+/).filter(Boolean);
  /* A word the brand itself carries, such as bank in examplebank, is not a lure. */
  const origName = (original && original.name) || "";
  const lure = [...new Set(words.filter((w) => LURE_WORDS.includes(w) && !origName.includes(w)))];
  if (lure.length) reasons.push({ key: "lure", words: lure.join(", ") });
  const kuwaitHere = words.some((w) => KUWAIT_WORDS.includes(w)) || /kuwait|q8/.test(p.name);
  const kuwaitThere = /kuwait|q8/.test(origName) || origName.split(/[^a-z0-9]+/).some((w) => KUWAIT_WORDS.includes(w));
  if (kuwaitHere && !kuwaitThere) reasons.push({ key: "kuwait" });
  if (p.host.includes("xn--")) reasons.push({ key: "idn" });
  const tld = p.labels[p.labels.length - 1];
  if (RISKY_TLDS.includes(tld)) reasons.push({ key: "risky-tld", tld });
  const free = FREE_HOSTS.find((f) => isUnder(p.host, f));
  if (free) reasons.push({ key: "free-host", host: free });
  if (original && original.registrable) {
    const a = toUnicode(original.registrable);
    const b = toUnicode(p.host);
    if (distance(a, b, 1) === 1) reasons.push({ key: "one-edit" });
  }
  return reasons;
}

/*
  assess(candidate, context) returns { status, score, level, reasons }.

  candidate  { domain, dns?, age?, seen?, web?, cert? }
             dns   { exists, a, aaaa, ns, mx, error }
             age   { created }            from RDAP, YYYY-MM-DD
             seen  { source, date }       nrd or ct, for names found in feeds
             web   { similarity, names }
             cert  { issued }
  context    { original: { registrable, name, ns, mx }, listed: { ns, mx }, now }
*/
export function assess(candidate, context = {}) {
  const original = context.original || {};
  const reasons = [];
  const d = candidate.dns;
  let status = "unchecked";
  if (d && d.error) {
    status = "unknown";
    reasons.push({ key: "dns-error" });
  } else if (d && !d.exists) {
    status = "absent";
  } else if (d && d.exists) {
    const known = knownBy(d, original, context.listed);
    if (known) {
      return { status: "known", score: 0, level: "none", reasons: [{ key: known }] };
    }
    const ips = [...(d.a || []), ...(d.aaaa || [])];
    status = ips.length ? "live" : "registered";
    reasons.push({ key: "registered" });
    if (d.lame) {
      reasons.push({ key: "lame" });
    } else if (isParked(d)) {
      reasons.push({ key: "parked" });
    } else {
      if (ips.length) reasons.push({ key: "resolves", ips: ips.slice(0, 3).join(", ") });
      const mx = realMx(d.mx);
      if (mx.length) reasons.push({ key: "mail", mx: mx.slice(0, 2).join(", ") });
    }
  }
  if (candidate.seen && candidate.seen.source) {
    reasons.push({ key: candidate.seen.source, date: candidate.seen.date || "" });
  }
  if (candidate.age && candidate.age.created) {
    const days = ageInDays(candidate.age.created, context.now);
    const date = candidate.age.created;
    if (days != null && days <= 30) reasons.push({ key: "new", date });
    else if (days != null && days <= 365) reasons.push({ key: "recent", date });
    else reasons.push({ key: "since", date });
  }
  reasons.push(...nameReasons(candidate.domain, original));
  const w = candidate.web;
  if (w && typeof w.similarity === "number" && w.similarity >= 0.6) {
    reasons.push({ key: "web-similar", pct: Math.round(w.similarity * 100) });
  }
  if (w && w.names && w.names.length) reasons.push({ key: "names-brand", names: w.names.slice(0, 2).join(", ") });
  if (candidate.cert && candidate.cert.issued) reasons.push({ key: "cert", date: candidate.cert.issued });

  const exists = status === "live" || status === "registered";
  let score = 0;
  if (exists) {
    for (const r of reasons) score += POINTS[r.key] || 0;
    score = Math.min(100, score);
  }
  return { status, score, level: level(score, exists), reasons };
}

export function level(score, exists = true) {
  if (!exists) return "none";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/* Live first, then registered, then the rest, each by score. */
export function rank(results) {
  const order = { live: 0, registered: 1, unknown: 2, known: 3, unchecked: 4, absent: 5 };
  return results.slice().sort((a, b) =>
    order[a.status] - order[b.status] || b.score - a.score || a.domain.localeCompare(b.domain));
}
