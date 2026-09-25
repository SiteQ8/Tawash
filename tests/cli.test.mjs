/*
  The command line, run the way people run it. Nothing here needs the network:
  the newly registered list and the watchlist come from fixtures.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VERSION, ALGORITHMS } from "../src/engine/index.js";

const BIN = fileURLToPath(new URL("../bin/tawash.mjs", import.meta.url));
const fixture = (f) => fileURLToPath(new URL("./fixtures/" + f, import.meta.url));
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });

test("help and version", () => {
  const help = run("--help");
  assert.equal(help.status, 0);
  for (const c of ["scan", "candidates", "nrd", "ct", "watch", "algorithms"]) assert.ok(help.stdout.includes(c));
  const ar = run("--help", "--lang", "ar");
  assert.ok(ar.stdout.includes("الأوامر"));
  assert.ok(!ar.stdout.includes("`"), "code marks are flattened for the terminal");
  assert.equal(run("--version").stdout.trim(), VERSION);
});

test("algorithms lists every technique", () => {
  const out = JSON.parse(run("algorithms", "--format", "json").stdout);
  assert.deepEqual(out.map((a) => a.id), ALGORITHMS);
});

test("candidates writes json and csv", () => {
  const list = JSON.parse(run("candidates", "exb.com", "--algorithms", "omission", "--format", "json").stdout);
  assert.deepEqual(list.map((c) => c.domain).sort(), ["eb.com", "ex.com", "xb.com"]);
  const csv = run("candidates", "example.gov.kw", "--algorithms", "dot-to-dash", "--format", "csv").stdout;
  assert.ok(csv.startsWith("domain,unicode,technique"));
  assert.ok(csv.includes("example-gov-kw.com"));
});

test("nrd matches a feed file against a keywords file, offline", () => {
  const r = run("nrd", "--keywords", fixture("keywords.txt"), "--feed", fixture("nrd-sample.zip"), "--format", "json");
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  const names = report.results.map((x) => x.domain).sort();
  for (const hit of ["exb-kw.com", "exbpay.top", "xn--xb-mlc.com", "alsouqq.com", "dunes-airways-offers.com", "exb-com.rest"]) {
    assert.ok(names.includes(hit), hit);
  }
  for (const miss of ["moissanite.com", "randomsite.com", "unexba.com", "green-tea-recipes.com"]) assert.ok(!names.includes(miss), miss);
  assert.ok(report.results.every((x) => x.reasons.some((y) => y.key === "nrd")));
});

test("nrd renders a table in Arabic too", () => {
  const r = run("nrd", "--keyword", "exb", "--feed", fixture("nrd-sample.txt"), "--lang", "ar");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes("exb-kw.com"));
  assert.ok(r.stderr.includes("قائمة المراقبة"));
});

test("fail-on turns a high score into exit code 3", () => {
  const r = run("nrd", "--keyword", "exb", "--feed", fixture("nrd-sample.txt"), "--fail-on", "1", "--format", "json");
  assert.equal(r.status, 3);
});

test("wrong usage exits with code 2 and says why", () => {
  assert.equal(run("frobnicate").status, 2);
  assert.equal(run("scan", "--bogus").status, 2);
  assert.equal(run("scan", "not a domain").status, 2);
  assert.equal(run("candidates", "example.com", "--algorithms", "nope").status, 2);
  const none = run("nrd", "--feed", fixture("nrd-sample.txt"));
  assert.equal(none.status, 2);
  assert.ok(none.stderr.includes("--asli"));
});
