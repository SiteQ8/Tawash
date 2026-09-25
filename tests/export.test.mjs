/*
  Exports: identifiers, escaping, and the shapes other tools expect.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { uuid5, STIX_NAMESPACE, toCSV, toMISP, toSTIX, toMarkdown, serialise, FORMATS } from "../src/engine/index.js";

const report = {
  tool: "tawash", version: "1.0.0", kind: "scan", generated: "2026-09-25T08:00:00.000Z", target: "example.com",
  original: { domain: "example.com", ns: [], mx: [] },
  results: [
    {
      domain: "example-kw.com", unicode: "example-kw.com", algorithm: "kuwait-affix", status: "live", score: 80, level: "high",
      dns: { exists: true, a: ["192.0.2.10"], aaaa: ["2001:db8::1"], ns: ["ns1.example.net"], mx: [] },
      reasons: [{ key: "registered" }, { key: "resolves", ips: "192.0.2.10" }, { key: "kuwait" }],
      web: { title: "=HYPERLINK(\"http://x\")", similarity: 0.7 }
    },
    { domain: "exampleq.com", unicode: "exampleq.com", algorithm: "addition", status: "absent", score: 0, level: "none", reasons: [] },
    { domain: "myexample.com", unicode: "myexample.com", algorithm: "kuwait-affix", status: "known", score: 0, level: "none", reasons: [{ key: "known-owner" }] }
  ]
};

test("UUID version 5 matches the published test vector", () => {
  assert.equal(uuid5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "python.org"), "886313e1-3b8a-5372-9b90-0c9aee199e5d");
});

test("CSV keeps what exists and neutralises formulas from strangers' pages", () => {
  const csv = toCSV(report);
  assert.ok(csv.startsWith("\ufeffdomain,"));
  assert.ok(csv.includes("example-kw.com"));
  assert.ok(csv.includes("myexample.com"), "yours stays, it is useful to see");
  assert.ok(!csv.includes("exampleq.com"), "absent names are left out");
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"http://x\"\")\""), "formula is prefixed and quoted");
  assert.ok(toCSV(report, { all: true }).includes("exampleq.com"));
});

test("MISP events carry candidates, never detection signatures", () => {
  const e = toMISP(report).Event;
  assert.equal(e.published, false);
  assert.equal(e.distribution, "0");
  assert.ok(e.Tag.some((t) => t.name === "tlp:amber"));
  assert.ok(e.Tag.some((t) => t.name.startsWith("workflow:")));
  assert.ok(e.Attribute.length >= 3);
  for (const a of e.Attribute) {
    assert.equal(a.to_ids, false);
    assert.match(a.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
  assert.ok(!e.Attribute.some((a) => a.value === "myexample.com"), "yours is not exported as a candidate");
});

test("STIX bundles hold deterministic observables and no indicators", () => {
  const b = toSTIX(report);
  assert.equal(b.type, "bundle");
  assert.match(b.id, /^bundle--[0-9a-f-]{36}$/);
  assert.ok(!b.objects.some((o) => o.type === "indicator"));
  const d = b.objects.find((o) => o.type === "domain-name");
  assert.equal(d.spec_version, "2.1");
  assert.equal(d.id, "domain-name--" + uuid5(STIX_NAMESPACE, JSON.stringify({ value: "example-kw.com" })));
  assert.equal(d.resolves_to_refs.length, 2);
  for (const ref of d.resolves_to_refs) assert.ok(b.objects.some((o) => o.id === ref));
  assert.deepEqual(toSTIX(report), b, "the same report gives the same bundle");
});

test("Markdown reports work in both languages", () => {
  const en = toMarkdown(report, { lang: "en" });
  const ar = toMarkdown(report, { lang: "ar" });
  assert.ok(en.includes("| 80 |"));
  assert.ok(en.includes("not verdicts"));
  assert.ok(ar.includes("النطاق الشبيه"));
  assert.ok(ar.includes("`example-kw.com`"));
});

test("serialise knows every format but table", () => {
  for (const f of FORMATS.filter((x) => x !== "table")) assert.ok(serialise(report, f).length > 10, f);
  assert.throws(() => serialise(report, "xml"));
});
