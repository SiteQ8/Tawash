/*
  The Node side: zip reading, the feed reader, the registry loader, page
  helpers, and a whole scan with a resolver that never touches the network.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readZip } from "../src/node/zip.js";
import { namesFrom, nrdUrl, dayBefore, yesterday, readFeed } from "../src/node/nrd.js";
import { fromRegistry, readKeywords } from "../src/node/asli.js";
import { titleOf, normalise } from "../src/node/web.js";
import { ctQueries } from "../src/node/ct.js";
import { scan, watchlist, permute } from "../src/engine/index.js";

const fixture = (f) => new URL("./fixtures/" + f, import.meta.url);

test("zip archives open, deflated or stored", () => {
  const files = readZip(readFileSync(fixture("stored.zip")));
  assert.deepEqual(files.map((f) => [f.name, f.data.toString()]), [["a.txt", "hello\n"], ["dir/b.txt", "world\n"]]);
  const nrd = readZip(readFileSync(fixture("nrd-sample.zip")));
  assert.equal(nrd[0].name, "domain-names.txt");
  assert.throws(() => readZip(Buffer.from("not a zip at all, not even close")));
});

test("the feed reader takes a zip or plain text", () => {
  const fromZip = readFeed(fixture("nrd-sample.zip").pathname);
  const fromText = readFeed(fixture("nrd-sample.txt").pathname);
  assert.deepEqual(fromZip, fromText);
  assert.ok(fromZip.includes("exb-kw.com"));
  assert.deepEqual(namesFrom(Buffer.from("# note\nA.com\n\nb.com\r\n")), ["a.com", "b.com"]);
});

test("WhoisDS addresses and dates", () => {
  assert.equal(nrdUrl("2026-09-24"), "https://www.whoisds.com//whois-database/newly-registered-domains/MjAyNi0wOS0yNC56aXA=/nrd");
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
  assert.equal(yesterday(Date.parse("2026-01-01T05:00:00Z")), "2025-12-31");
});

test("the Asli registry becomes a watchlist with names to look for", () => {
  const w = fromRegistry(JSON.parse(readFileSync(fixture("registry.json"), "utf8")));
  assert.equal(w.bodies, 2);
  assert.ok(w.keywords.includes("exb"));
  assert.ok(w.domains.includes("examplecustoms.gov.kw"));
  assert.ok(w.claims["examplebank.com"].includes("بنك المثال"));
  const k = readKeywords(fixture("keywords.txt").pathname);
  assert.deepEqual(k.keywords, ["exb"]);
  assert.ok(k.domains.includes("alsouq.com"));
});

test("certificate log queries attach Kuwait to short names", () => {
  const q = ctQueries(watchlist({ keywords: ["exb", "alsouq"] }));
  assert.ok(q.includes("%alsouq%"));
  assert.ok(q.includes("%exb%kuwait%"));
  assert.ok(!q.includes("%exb%"));
});

test("page helpers read titles and match Arabic however it is typed", () => {
  assert.equal(titleOf("<html><title> Example &amp; you &#x2F; &#39;hi&#39; </title>"), "Example & you / 'hi'");
  assert.equal(titleOf("<p>no title</p>"), "");
  assert.ok(normalise("بنكُ المثالِ الأوّل").includes(normalise("بنك المثال")));
  assert.equal(normalise("إدارة"), normalise("ادارة"));
});

test("a whole scan with a resolver that knows a few names", async () => {
  const zone = {
    "example.com": { exists: true, a: ["192.0.2.1"], aaaa: [], ns: ["ns4.example.com"], mx: ["example-com.mail.protection.outlook.com"] },
    "example-kw.com": { exists: true, a: ["192.0.2.66"], aaaa: [], ns: ["ns1.other.example"], mx: [] },
    "myexample.com": { exists: true, a: ["192.0.2.2"], aaaa: [], ns: ["ns5.example.com"], mx: [] },
    "example.duckdns.org": { exists: true, a: [], aaaa: [], ns: [], mx: [] }
  };
  let flaky = 0;
  const resolver = {
    async lookup(name) {
      if (name === "exampleq8.com" && flaky++ === 0) return { exists: null, error: "ETIMEOUT", a: [], aaaa: [], ns: [], mx: [] };
      return zone[name] || { exists: false, a: [], aaaa: [], ns: [], mx: [] };
    }
  };
  const seen = [];
  const report = await scan("example.com", { resolver, concurrency: 16, onResult: (r) => seen.push(r.domain) });
  const by = Object.fromEntries(report.results.map((r) => [r.domain, r]));
  assert.equal(report.results.length, permute("example.com").length);
  assert.equal(by["example-kw.com"].status, "live");
  assert.equal(by["myexample.com"].status, "known");
  assert.equal(by["example.duckdns.org"].status, "registered");
  assert.equal(by["exampleq8.com"].status, "absent", "a timeout gets a second try");
  assert.equal(report.results[0].domain, "example-kw.com", "the live lookalike comes first");
  assert.ok(seen.length >= report.results.length);
});

test("a scan can be stopped", async () => {
  const controller = new AbortController();
  let calls = 0;
  const resolver = {
    async lookup() {
      calls++;
      if (calls === 20) controller.abort();
      return { exists: false, a: [], aaaa: [], ns: [], mx: [] };
    }
  };
  const report = await scan("dunesairways.com", { resolver, concurrency: 4, signal: controller.signal });
  assert.equal(report.stopped, true);
  assert.ok(report.results.some((r) => r.status === "unchecked"));
});
