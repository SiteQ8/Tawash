/*
  How close two names are, measured the ways a reader gets fooled.
*/
import { CONFUSABLES, LEET, ASCII_PAIRS } from "./data.js";

/*
  Edits needed to turn a into b, counting a swap of two neighbours as one edit
  (optimal string alignment). Stops early and returns max + 1 once the answer is
  known to exceed max.
*/
export function distance(a, b, max = Infinity) {
  const s = Array.from(a);
  const t = Array.from(b);
  if (Math.abs(s.length - t.length) > max) return max + 1;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev2 = null;
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[t.length];
}

/* Jaro-Winkler similarity, 0 for nothing in common and 1 for identical. */
export function jaroWinkler(a, b) {
  const s = Array.from(a);
  const t = Array.from(b);
  if (!s.length && !t.length) return 1;
  if (!s.length || !t.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(s.length, t.length) / 2) - 1);
  const sHit = new Array(s.length).fill(false);
  const tHit = new Array(t.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(t.length - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (tHit[j] || s[i] !== t[j]) continue;
      sHit[i] = tHit[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let half = 0;
  for (let i = 0; i < s.length; i++) {
    if (!sHit[i]) continue;
    while (!tHit[k]) k++;
    if (s[i] !== t[k]) half++;
    k++;
  }
  const jaro = (matches / s.length + matches / t.length + (matches - half / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < s.length && prefix < t.length && s[prefix] === t[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/* Undoes digit and sign swaps, and letter pairs that read as one letter. */
export function deleet(text) {
  let s = String(text).replace(/[0134579$@8]/g, (c) => LEET[c] || c);
  for (const [pair, single] of Object.entries(ASCII_PAIRS)) s = s.split(pair).join(single);
  return s;
}

/*
  What a name looks like to a hurried reader: accents dropped, foreign letters
  read as the Latin letters they imitate, digits read as letters.
*/
export function skeleton(text) {
  return deleet(plain(text));
}

/* Foreign and accented letters read as Latin, with digits left alone. */
export function plain(text) {
  return Array.from(String(text).toLowerCase())
    .map((ch) => CONFUSABLES[ch] || ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i");
}

/*
  Marks each character of b against a so a page can light up what changed.
  Returns [{ ch, changed, gapBefore, gapAfter }]. The gap flags mark a place
  where a character of a was dropped.
*/
export function diffMarks(a, b) {
  const s = Array.from(a);
  const t = Array.from(b);
  const marks = t.map((ch) => ({ ch, changed: false, gapBefore: false, gapAfter: false }));
  /*
    The longest run the two names share is kept, then the same is done on
    each side of it. A reader compares names in runs of letters, so a stray
    letter that happens to match inside a changed stretch is shown as part of
    the change: secure-example.com against example.org lifts "secure-" and
    "com" as wholes instead of a scatter of single letters.
  */
  const walk = (s0, s1, t0, t1) => {
    let best = 0;
    let bs = 0;
    let bt = 0;
    const run = new Array(t1 - t0 + 1).fill(0);
    for (let i = s0; i < s1; i++) {
      for (let j = t1 - 1; j >= t0; j--) {
        const k = j - t0;
        run[k + 1] = s[i] === t[j] ? run[k] + 1 : 0;
        if (run[k + 1] > best) {
          best = run[k + 1];
          bs = i - best + 1;
          bt = j - best + 1;
        }
      }
    }
    const shortest = Math.min(s1 - s0, t1 - t0);
    if (best >= 2 || (best === 1 && shortest === 1)) {
      walk(s0, bs, t0, bt);
      walk(bs + best, s1, bt + best, t1);
      return;
    }
    if (t1 > t0) {
      for (let j = t0; j < t1; j++) marks[j].changed = true;
    } else if (s1 > s0) {
      if (t0 < marks.length) marks[t0].gapBefore = true;
      else if (marks.length) marks[marks.length - 1].gapAfter = true;
    }
  };
  walk(0, s.length, 0, t.length);
  return marks;
}

/* Word overlap between two page titles, 0 to 1. */
export function titleSimilarity(a, b) {
  const words = (x) => new Set(String(x || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  const jaccard = common / (A.size + B.size - common);
  const jw = jaroWinkler(String(a).toLowerCase().trim(), String(b).toLowerCase().trim());
  return Math.round(Math.max(jaccard, jw * 0.9) * 100) / 100;
}
