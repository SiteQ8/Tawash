/*
  Both languages, held to the same rules. Arabic follows the house rules: no
  Latin outside backticks or the listed proper nouns, Arabic punctuation, and a
  period only where a sentence ends, with clauses joined by connectives.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS, HELP, LATIN_NAMES, ALGORITHMS, t, plural, fill } from "../src/engine/index.js";

function leaves(node, path = [], out = []) {
  if (node && typeof node === "object" && typeof node.en === "string" && typeof node.ar === "string") {
    out.push({ path: path.join("."), en: node.en, ar: node.ar });
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) leaves(v, [...path, k], out);
  }
  return out;
}

const ALL = [
  ...leaves({ ...STRINGS, plural: undefined }),
  { path: "help.intro", ...HELP.intro },
  ...HELP.sections.flatMap((s) => [
    { path: "help." + s.id, ...s.title },
    ...s.rows.map(([syntax, text]) => ({ path: "help." + syntax, ...text }))
  ])
];

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const withoutCode = (s) => s.replace(/`[^`]*`/g, " ").replace(/\{\w+\}/g, " ");

test("every string exists in both languages and is not empty", () => {
  assert.ok(ALL.length > 150);
  for (const s of ALL) {
    assert.ok(s.en.trim(), s.path + " en");
    assert.ok(s.ar.trim(), s.path + " ar");
  }
});

test("every technique is named and explained", () => {
  for (const id of ALGORITHMS) {
    assert.ok(STRINGS.algorithm[id], id);
    assert.ok(STRINGS.algorithm[id].name.ar && STRINGS.algorithm[id].about.ar, id);
  }
  assert.deepEqual(Object.keys(STRINGS.algorithm).sort(), [...ALGORITHMS].sort());
});

test("placeholders survive translation", () => {
  for (const s of ALL) assert.deepEqual(placeholders(s.ar), placeholders(s.en), s.path);
  for (const [key, forms] of Object.entries(STRINGS.plural)) {
    const en = new Set(Object.values(forms.en).flatMap(placeholders));
    const ar = new Set(Object.values(forms.ar).flatMap(placeholders));
    for (const p of ar) assert.ok(en.has(p), key + " " + p);
  }
});

test("Arabic uses no Latin outside code and the listed names", () => {
  const allowed = new Set(LATIN_NAMES.flatMap((n) => n.split(/[^A-Za-z]+/)).filter(Boolean));
  for (const s of ALL) {
    const latin = withoutCode(s.ar).match(/[A-Za-z]+/g) || [];
    for (const word of latin) assert.ok(allowed.has(word), `${s.path}: "${word}" in «${s.ar}»`);
  }
});

test("Arabic punctuation: Arabic comma and question mark, and a period only at the end", () => {
  for (const s of ALL) {
    const text = withoutCode(s.ar);
    assert.ok(!/[,;?]/.test(text), `${s.path}: Latin punctuation in «${s.ar}»`);
    const inner = text.trim().replace(/\.$/, "");
    assert.ok(!inner.includes("."), `${s.path}: a period inside the sentence «${s.ar}»`);
    assert.ok(!/\s{2,}/.test(s.ar), `${s.path}: double space`);
  }
});

test("nothing in either language uses a long dash", () => {
  for (const s of ALL) {
    assert.ok(!/[\u2012\u2013\u2014\u2015]/.test(s.en), s.path + " en");
    assert.ok(!/[\u2012\u2013\u2014\u2015]/.test(s.ar), s.path + " ar");
  }
});

test("English carries no Arabic letters except the brand in the Arabic slot", () => {
  for (const s of ALL) assert.ok(!/[\u0600-\u06ff]/.test(s.en), s.path);
});

test("Arabic plurals cover every category and read correctly", () => {
  for (const [key, forms] of Object.entries(STRINGS.plural)) {
    assert.deepEqual(Object.keys(forms.ar).sort(), ["few", "many", "one", "other", "two", "zero"], key);
    assert.deepEqual(Object.keys(forms.en).sort(), ["one", "other"], key);
  }
  assert.equal(plural("found", 0, "ar"), "لا يوجد أي نطاق شبيه مسجّل");
  assert.equal(plural("found", 1, "ar"), "يوجد نطاق شبيه واحد مسجّل");
  assert.equal(plural("found", 2, "ar"), "يوجد نطاقان شبيهان مسجّلان");
  assert.equal(plural("found", 7, "ar"), "يوجد 7 نطاقات شبيهة مسجّلة");
  assert.equal(plural("found", 25, "ar"), "يوجد 25 نطاقاً شبيهاً مسجّلاً");
  assert.equal(plural("found", 300, "ar"), "يوجد 300 نطاق شبيه مسجّل");
  assert.equal(plural("found", 1, "en"), "1 lookalike exists");
  assert.equal(plural("found", 3, "en"), "3 lookalikes exist");
});

test("t and fill fall back sensibly", () => {
  assert.equal(t("no.such.key", "ar"), "no.such.key");
  assert.equal(fill("a {x} b {y}", { x: 1 }), "a 1 b ");
  assert.equal(t("reason.mail", "en", { mx: "mx.example" }), "can receive email (mx.example)");
});
