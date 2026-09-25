/*
  Matching names seen elsewhere (newly registered domains, certificate logs)
  against the brands being watched.

  Short brand tokens of two or three letters sit inside thousands of harmless names,
  so they only match as a whole word, glued to a lure word, or through lookalike
  characters. Longer tokens also match by containment and by typing distance,
  and the confidence level decides how far that goes.
*/
import { parse, clean, isUnder } from "./domain.js";
import { toUnicode } from "./punycode.js";
import { distance, jaroWinkler, plain, deleet } from "./similarity.js";
import { transliterate } from "./permute.js";
import { AFFIX_WORDS, LURE_WORDS, KUWAIT_WORDS, GENERIC_WORDS, DOT_WORDS } from "./data.js";

const GLUE = [...new Set([...AFFIX_WORDS, ...LURE_WORDS, ...KUWAIT_WORDS])];
const CONTEXT = new Set([...GLUE, ...DOT_WORDS]);

/* True when a name points at Kuwait: kuwait or q8 anywhere, or kw at the edge of a word. */
function pointsAtKuwait(tokens) {
  return tokens.some((t) => /kuwait|q8/.test(t) || t === "kwt" || t.startsWith("kw") || t.endsWith("kw"));
}

/*
  What each confidence level allows, from 0 (fewest results, most certain) to 4
  (most results, most noise). The numbers are the shortest brand token each rule
  applies to.
*/
export const LEVELS = [
  { contains: Infinity, typo1: Infinity, typo2: Infinity, spelling: false, similar: false },
  { contains: 6, typo1: 6, typo2: Infinity, spelling: true, similar: false },
  { contains: 5, typo1: 5, typo2: 8, spelling: true, similar: false },
  { contains: 4, typo1: 4, typo2: 6, spelling: true, similar: false },
  { contains: 4, typo1: 4, typo2: 5, spelling: true, similar: true }
];

export const STRENGTH = {
  "official-label": 100, homoglyph: 95, exact: 90, glued: 80, token: 75,
  transliteration: 70, typo1: 65, contains: 55, typo2: 45, similar: 35
};

const words = (s) => s.split(/[^a-z0-9]+/).filter(Boolean);

/*
  watchlist({ keywords, domains, owners }) prepares what the matcher needs.
    keywords  brand tokens, such as ["exb", "examplebank"]
    domains   official domains, which are never reported and whose names
              become keywords too
    owners    optional map from a keyword or domain to a label for reports
*/
export function watchlist({ keywords = [], domains = [], owners = {} } = {}) {
  const official = [...new Set(domains.map(clean).filter(Boolean))];
  const entries = new Map();
  const add = (k, owner) => {
    const key = plain(clean(k)).replace(/[^a-z0-9-]/g, "");
    if (key.length < 2 || entries.has(key)) return;
    entries.set(key, {
      keyword: key,
      flat: deleet(key),
      owner: owner || owners[k] || key,
      generic: GENERIC_WORDS.includes(key),
      /* Short names drift into real words (ups becomes ops), so only longer ones get spellings. */
      spellings: new Set(key.length >= 4 ? transliterate(key).filter((w) => w.length >= 4) : [])
    });
  };
  keywords.forEach((k) => add(k));
  for (const d of official) {
    const p = parse(d);
    if (p) add(p.name, owners[d]);
  }
  return { entries: [...entries.values()], official };
}

function pick(a, b) {
  if (!a) return b;
  if (!b) return a;
  return STRENGTH[b.how] > STRENGTH[a.how] ? b : a;
}

/*
  matchHost("example-kw.xyz", list) returns null or
    { host, unicode, keyword, owner, how, word, distance, strength }
*/
export function matchHost(host, list, options = {}) {
  const level = LEVELS[Math.max(0, Math.min(4, options.confidence ?? 1))];
  const p = parse(host);
  if (!p) return null;
  for (const d of list.official) if (isUnder(p.host, d)) return null;

  let found = null;

  /* An official domain used as labels inside somebody else's name. */
  const dotted = "." + p.host + ".";
  for (const d of list.official) {
    const at = dotted.indexOf("." + d + ".");
    if (at < 0) continue;
    const after = dotted.slice(at + d.length + 2).replace(/\.$/, "");
    if (!after.includes(".")) continue;
    const entry = list.entries.find((e) => d.startsWith(e.keyword + "."));
    found = pick(found, { how: "official-label", keyword: entry ? entry.keyword : d, owner: entry ? entry.owner : d, word: d });
  }

  const labels = [...(p.sub ? p.sub.split(".") : []), p.name].filter(Boolean).map((raw) => {
    const readable = plain(toUnicode(raw));
    const flat = deleet(readable);
    return { raw, readable, flat, joined: flat.split("-").join(""), tokens: words(readable), flatTokens: words(flat) };
  });

  const everyToken = labels.flatMap((L) => L.tokens);
  const kuwaitHere = pointsAtKuwait(everyToken);

  for (const e of list.entries) {
    const k = e.keyword;
    if (e.generic && !kuwaitHere) continue;
    const short = k.length < 4;
    for (const L of labels) {
      const hit = (how, extra = {}) => {
        found = pick(found, { how, keyword: k, owner: e.owner, ...extra });
      };
      if (L.readable === k) {
        hit(L.raw === k ? "exact" : "homoglyph");
        continue;
      }
      if (L.flat === e.flat) {
        hit("homoglyph");
        continue;
      }
      /* A short brand as a word counts only next to a lure, Kuwait or an ending, as in exb-gov-kw. */
      if (L.tokens.length > 1 && L.tokens.includes(k) && (!short || L.tokens.some((x) => x !== k && CONTEXT.has(x)))) {
        hit("token");
      }
      for (const t of L.tokens) {
        for (const g of GLUE) {
          if (t === k + g || t === g + k) hit("glued", { word: g });
        }
      }
      if (level.spelling && (e.spellings.has(L.readable) || L.tokens.some((t) => e.spellings.has(t)))) {
        hit("transliteration");
      }
      if (k.length < 4) continue;
      if (k.length >= level.contains && L.joined.includes(e.flat)) hit("contains");
      if (k.length >= level.typo1 || k.length >= level.typo2) {
        let min = Infinity;
        for (const x of [L.flat, L.joined, ...L.flatTokens]) min = Math.min(min, distance(x, e.flat, 2));
        if (min === 1 && k.length >= level.typo1) hit("typo1", { distance: 1 });
        else if (min === 2 && k.length >= level.typo2) hit("typo2", { distance: 2 });
      }
      if (level.similar && k.length >= 5 && jaroWinkler(L.flat, e.flat) >= 0.9) hit("similar");
    }
  }

  if (!found) return null;
  return { host: p.host, unicode: p.unicode, strength: STRENGTH[found.how], ...found };
}

/* Runs a list of names and returns the matches, strongest first. */
export function matchAll(hosts, list, options = {}) {
  const out = [];
  const seen = new Set();
  for (const h of hosts) {
    const m = matchHost(h, list, options);
    if (!m || seen.has(m.host)) continue;
    seen.add(m.host);
    out.push(m);
  }
  return out.sort((a, b) => b.strength - a.strength || a.host.localeCompare(b.host));
}
