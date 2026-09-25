/*
  The search list.

  A squatter bends a real name in a handful of known ways. For each of those
  techniques this file lists the host names it leads to, which are the names
  Tawash then looks for in DNS. The catalogue follows the techniques CIRCL's
  typosquatting finder documents, and adds three that matter in Kuwait: Latin
  spellings of Arabic names, lure words scammers glue to Kuwaiti brands, and the
  Gulf endings a name gets moved to.
*/
import { parse, isValidHost } from "./domain.js";
import { toASCII, toUnicode } from "./punycode.js";
import {
  LETTERS, VOWELS, keyNeighbours, ASCII_GLYPHS, ASCII_PAIRS, UNICODE_GLYPHS, CYRILLIC_TWINS,
  HOMOPHONES, MISSPELLINGS, NUMBER_WORDS, TRANSLITERATION, TRANSLITERATION_WORDS,
  COMMON_TLDS, GCC_SUFFIXES, ADD_TLDS, SUFFIXES, DYNAMIC_DNS, AFFIX_WORDS
} from "./data.js";

/*
  The order matters: when two techniques lead to the same name, the first one
  names it. The specific explanations come first (a misspelling of kuwait, a
  plural), and the generic typing errors that could explain almost anything
  come last.
*/
export const ALGORITHMS = [
  "homoglyph", "transliteration", "kuwait-affix", "misspelling", "homophones", "numeral-swap",
  "plural", "missing-dot", "dot-to-dash", "strip-dash", "add-dash", "subdomain", "wrong-sld",
  "wrong-tld", "add-tld", "dynamic-dns", "vowel-swap", "double-replacement", "transposition",
  "omission", "repetition", "replacement", "addition", "bitsquatting"
];

const chars = (s) => Array.from(s);

function splice(list, index, remove, text) {
  return list.slice(0, index).join("") + text + list.slice(index + remove).join("");
}

function replaceAt(s, index, length, text) {
  return s.slice(0, index) + text + s.slice(index + length);
}

function occurrences(s, word) {
  const out = [];
  if (!word) return out;
  let at = s.indexOf(word);
  while (at >= 0) {
    out.push(at);
    at = s.indexOf(word, at + 1);
  }
  return out;
}

/* Latin spellings an Arabic name drifts into. Used by the search list and the matcher. */
export function transliterate(word) {
  const out = new Set();
  for (const [from, tos] of TRANSLITERATION) {
    for (const at of occurrences(word, from)) {
      for (const to of tos) out.add(replaceAt(word, at, from.length, to));
    }
  }
  for (const [whole, list] of Object.entries(TRANSLITERATION_WORDS)) {
    for (const at of occurrences(word, whole)) {
      for (const alt of list) out.add(replaceAt(word, at, whole.length, alt));
    }
  }
  if (word.length >= 5 && word.startsWith("al")) {
    out.add("el" + word.slice(2));
    out.add(word.slice(2));
  } else if (word.length >= 5 && word.startsWith("el")) {
    out.add("al" + word.slice(2));
  }
  out.delete(word);
  return [...out].filter((w) => w.length > 1);
}

const G = {};

G.homoglyph = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    for (const g of ASCII_GLYPHS[ch] || []) out.push(splice(c, i, 1, g));
    for (const g of UNICODE_GLYPHS[ch] || []) out.push(splice(c, i, 1, g));
  });
  for (const [pair, single] of Object.entries(ASCII_PAIRS)) {
    for (const at of occurrences(u, pair)) out.push(replaceAt(u, at, pair.length, single));
  }
  const convertible = c.filter((ch) => CYRILLIC_TWINS[ch]).length;
  if (convertible && c.every((ch) => CYRILLIC_TWINS[ch] || /[0-9-]/.test(ch))) {
    out.push(c.map((ch) => CYRILLIC_TWINS[ch] || ch).join(""));
  }
  return out.map((n) => n + "." + suffix);
};

G.transliteration = ({ u, suffix }) => transliterate(u).map((n) => n + "." + suffix);

G["kuwait-affix"] = ({ u, suffix }) => {
  const endings = suffix === "com" ? [suffix] : [suffix, "com"];
  const out = [];
  for (const w of AFFIX_WORDS) {
    if (w.length > 2 && u.includes(w)) continue;
    const forms = w === "e" || w === "my" ? [w + u, w + "-" + u] : [u + w, u + "-" + w, w + u, w + "-" + u];
    for (const end of endings) for (const f of forms) out.push(f + "." + end);
  }
  return out;
};

G.omission = ({ u, suffix }) => {
  const c = chars(u);
  return c.map((_, i) => splice(c, i, 1, "")).filter(Boolean).map((n) => n + "." + suffix);
};

G.repetition = ({ u, suffix }) => {
  const c = chars(u);
  return c.flatMap((ch, i) => (ch === "-" ? [] : [splice(c, i, 1, ch + ch)])).map((n) => n + "." + suffix);
};

G.transposition = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  for (let i = 0; i < c.length - 1; i++) {
    if (c[i] === c[i + 1]) continue;
    out.push(splice(c, i, 2, c[i + 1] + c[i]));
  }
  return out.map((n) => n + "." + suffix);
};

G.replacement = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    for (const n of keyNeighbours(ch)) out.push(splice(c, i, 1, n));
  });
  return out.map((n) => n + "." + suffix);
};

G["double-replacement"] = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  for (let i = 0; i < c.length - 1; i++) {
    if (c[i] !== c[i + 1] || c[i] === "-") continue;
    for (const n of keyNeighbours(c[i])) out.push(splice(c, i, 2, n + n));
  }
  return out.map((n) => n + "." + suffix);
};

G["vowel-swap"] = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    if (i === 0 || !VOWELS.includes(ch)) return;
    for (const v of VOWELS) if (v !== ch) out.push(splice(c, i, 1, v));
  });
  /* Every copy of one vowel at once, as in google to gaagle. */
  for (const from of VOWELS) {
    if (c.slice(1).filter((ch) => ch === from).length < 2) continue;
    for (const to of VOWELS) {
      if (to !== from) out.push(c[0] + c.slice(1).map((ch) => (ch === from ? to : ch)).join(""));
    }
  }
  return out.map((n) => n + "." + suffix);
};

G.addition = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  for (let i = 0; i <= c.length; i++) {
    for (const ch of LETTERS) out.push(splice(c, i, 0, ch));
  }
  return out.map((n) => n + "." + suffix);
};

G["add-dash"] = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  for (let i = 1; i < c.length; i++) {
    if (c[i - 1] === "-" || c[i] === "-") continue;
    out.push(splice(c, i, 0, "-"));
  }
  return out.map((n) => n + "." + suffix);
};

G["strip-dash"] = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    if (ch === "-") out.push(splice(c, i, 1, ""));
  });
  if (c.filter((ch) => ch === "-").length > 1) out.push(u.split("-").join(""));
  return out.map((n) => n + "." + suffix);
};

G.plural = ({ u, suffix }) => {
  const out = [];
  if (u.endsWith("s")) out.push(u.slice(0, -1));
  else out.push(u + "s");
  if (/(s|x|z|ch|sh)$/.test(u)) out.push(u + "es");
  if (/[^aeiou]y$/.test(u)) out.push(u.slice(0, -1) + "ies");
  return out.filter(Boolean).map((n) => n + "." + suffix);
};

G.misspelling = ({ u, suffix }) => {
  const out = [];
  for (const [word, list] of Object.entries(MISSPELLINGS)) {
    for (const at of occurrences(u, word)) {
      for (const m of list) out.push(replaceAt(u, at, word.length, m));
    }
  }
  return out.map((n) => n + "." + suffix);
};

G.homophones = ({ u, suffix }) => {
  const out = [];
  const tokens = u.split("-");
  for (const set of HOMOPHONES) {
    for (const word of set) {
      for (const other of set) {
        if (other === word) continue;
        if (word.length >= 3) {
          for (const at of occurrences(u, word)) out.push(replaceAt(u, at, word.length, other));
        } else if (tokens.includes(word)) {
          out.push(tokens.map((t) => (t === word ? other : t)).join("-"));
        }
      }
    }
  }
  return out.map((n) => n + "." + suffix);
};

G["numeral-swap"] = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    for (const word of NUMBER_WORDS[ch] || []) out.push(splice(c, i, 1, word));
  });
  for (const [digit, words] of Object.entries(NUMBER_WORDS)) {
    for (const word of words) {
      for (const at of occurrences(u, word)) out.push(replaceAt(u, at, word.length, digit));
    }
  }
  for (const at of occurrences(u, "for")) out.push(replaceAt(u, at, 3, "4"));
  return out.map((n) => n + "." + suffix);
};

G.subdomain = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  for (let i = 1; i < c.length; i++) {
    if (c[i - 1] === "-" || c[i] === "-") continue;
    out.push(splice(c, i, 0, "."));
  }
  return out.map((n) => n + "." + suffix);
};

G["missing-dot"] = ({ u, sub, suffix }) => {
  const out = ["www" + u + "." + suffix];
  if (sub) {
    const parts = [...sub.split("."), u];
    for (let i = 0; i < parts.length - 1; i++) {
      const merged = [...parts.slice(0, i), parts[i] + parts[i + 1], ...parts.slice(i + 2)];
      out.push(merged.join(".") + "." + suffix);
    }
  }
  const s = suffix.split(".");
  if (s.length > 1) out.push(u + s[0] + "." + s.slice(1).join("."));
  return out;
};

G["dot-to-dash"] = ({ u, sub, suffix }) => {
  const out = [];
  if (sub) out.push(sub.split(".").join("-") + "-" + u + "." + suffix);
  const s = suffix.split(".");
  if (s.length > 1) out.push(u + "-" + s[0] + "." + s.slice(1).join("."));
  out.push(u + "-" + s.join("-") + ".com");
  if (s.join(".") === "com") out.push(u + "-com.net");
  return out;
};

G["wrong-sld"] = ({ u, suffix }) => {
  const s = suffix.split(".");
  if (s.length < 2) return [];
  const tld = s[s.length - 1];
  const others = SUFFIXES.filter((x) => x.endsWith("." + tld) && x !== suffix);
  return [...others, tld].map((x) => u + "." + x);
};

/* The common and Gulf endings come first, then, when given, every other ending IANA lists. */
G["wrong-tld"] = ({ u, suffix, tlds }) =>
  [...new Set([...COMMON_TLDS, ...GCC_SUFFIXES, ...(tlds || [])])].filter((t) => t !== suffix).map((t) => u + "." + t);

G["add-tld"] = ({ u, suffix }) => {
  const last = suffix.split(".").pop();
  return ADD_TLDS.filter((t) => t !== last).map((t) => u + "." + suffix + "." + t);
};

G["dynamic-dns"] = ({ u }) => DYNAMIC_DNS.map((d) => u + "." + d);

G.bitsquatting = ({ u, suffix }) => {
  const c = chars(u);
  const out = [];
  c.forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    if (code > 127) return;
    for (let bit = 0; bit < 8; bit++) {
      const flipped = String.fromCharCode(code ^ (1 << bit));
      if (/^[a-z0-9-]$/.test(flipped)) out.push(splice(c, i, 1, flipped));
    }
  });
  return out.map((n) => n + "." + suffix);
};

/*
  permute("example.com") returns [{ domain, unicode, algorithm, idn }], without the
  original and without anything DNS would refuse. domain is always ASCII.
  options.tlds, a list such as the one loadTlds reads from IANA, widens the
  search for other endings to every one of them.
*/
export function permute(input, options = {}) {
  const wanted = options.algorithms && options.algorithms.length ? options.algorithms : ALGORITHMS;
  const limit = options.limit || 5000;
  const p = typeof input === "string" ? parse(input) : input;
  if (!p) throw new TypeError("not a domain name: " + input);
  const ctx = { ...p, u: toUnicode(p.name), tlds: options.tlds || null };
  const seen = new Map();
  for (const id of ALGORITHMS) {
    if (!wanted.includes(id)) continue;
    for (const raw of G[id](ctx)) {
      let ascii;
      try {
        ascii = toASCII(raw);
      } catch {
        continue;
      }
      if (ascii === p.registrable || ascii === p.host || seen.has(ascii)) continue;
      if (!isValidHost(ascii)) continue;
      seen.set(ascii, { domain: ascii, unicode: toUnicode(ascii), algorithm: id, idn: ascii.includes("xn--") });
      if (seen.size >= limit) return [...seen.values()];
    }
  }
  return [...seen.values()];
}

export function unknownAlgorithms(list) {
  return list.filter((id) => !ALGORITHMS.includes(id));
}
