/*
  Statuses, known infrastructure and the points behind a score.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, knownBy, isParked, rank, nameReasons, toASCII, POINTS } from "../src/engine/index.js";

const original = {
  registrable: "example.com", name: "example",
  ns: ["ns3.example.com", "ns4.example.com"], mx: ["example-com.mail.protection.outlook.com"]
};
const dns = (extra) => ({ exists: true, a: [], aaaa: [], ns: [], mx: [], ...extra });
const keys = (r) => r.reasons.map((x) => x.key);

test("statuses follow the DNS answer", () => {
  assert.equal(assess({ domain: "examplex.com", dns: { exists: false } }, { original }).status, "absent");
  assert.equal(assess({ domain: "examplex.com", dns: { exists: null, error: "ETIMEOUT" } }, { original }).status, "unknown");
  assert.equal(assess({ domain: "examplex.com" }, { original }).status, "unchecked");
  assert.equal(assess({ domain: "examplex.com", dns: dns({ a: ["192.0.2.1"] }) }, { original }).status, "live");
  assert.equal(assess({ domain: "examplex.com", dns: dns() }, { original }).status, "registered");
});

test("only things that exist earn points", () => {
  const r = assess({ domain: "example-kw.xyz", dns: { exists: false } }, { original });
  assert.equal(r.score, 0);
  assert.ok(keys(r).includes("kuwait"), "name reasons are still shown");
});

test("the brand's own infrastructure marks a lookalike as yours", () => {
  assert.equal(knownBy(dns({ ns: ["ns4.example.com"] }), original), "known-owner");
  assert.equal(knownBy(dns({ ns: ["ns4.example.com.", "ns3.example.com"] }), original), "known-owner");
  const shared = { registrable: "x.example", ns: ["ns01.domaincontrol.com", "ns02.domaincontrol.com"], mx: [] };
  assert.equal(knownBy(dns({ ns: ["ns01.domaincontrol.com", "ns02.domaincontrol.com"] }), shared), null, "a registrar's shared name servers prove nothing");
  const own = { registrable: "x.example", ns: ["a.example-dns.net", "b.example-dns.net"], mx: [] };
  assert.equal(knownBy(dns({ ns: ["b.example-dns.net", "a.example-dns.net"] }), own), "known-ns");
  assert.equal(knownBy(dns({ mx: ["example-com.mail.protection.outlook.com"] }), original), "known-mx");
  const google = { registrable: "x.example", ns: [], mx: ["aspmx.l.google.com"] };
  assert.equal(knownBy(dns({ mx: ["aspmx.l.google.com"] }), google), null, "shared mail hosts prove nothing");
  assert.equal(knownBy(dns({ ns: ["ns1.mydns.example"] }), { registrable: "x.example" }, { ns: ["mydns.example"] }), "known-list");
  const r = assess({ domain: "myexample.com", dns: dns({ ns: ["ns5.example.com"], a: ["192.0.2.1"] }) }, { original });
  assert.equal(r.status, "known");
  assert.equal(r.score, 0);
});

test("intent and recency outweigh being registered", () => {
  const now = Date.parse("2026-09-25T00:00:00Z");
  const old = assess({ domain: "exampie.com", dns: dns({ a: ["192.0.2.1"], mx: ["mx.exampie.com"] }), age: { created: "1991-05-01" } }, { original, now });
  const fresh = assess({ domain: "example-kw.com", dns: dns({ a: ["192.0.2.2"] }), age: { created: "2026-09-20" } }, { original, now });
  assert.ok(keys(old).includes("since"));
  assert.ok(keys(fresh).includes("new"));
  assert.ok(fresh.score > old.score);
  assert.equal(fresh.level, "high");
  assert.equal(old.level, "low");
});

test("parked and lame names are labelled, and parking addresses earn nothing", () => {
  const parked = dns({ a: ["192.0.2.9"], ns: ["ns1.sedoparking.com"], mx: ["localhost"] });
  assert.ok(isParked(parked));
  const r = assess({ domain: "examplex.com", dns: parked }, { original });
  assert.ok(keys(r).includes("parked"));
  assert.ok(!keys(r).includes("resolves"));
  const lame = assess({ domain: "examplex.com", dns: dns({ lame: true }) }, { original });
  assert.equal(lame.status, "registered");
  assert.ok(keys(lame).includes("lame"));
  const nomail = assess({ domain: "examplex.com", dns: dns({ mx: ["localhost"] }) }, { original });
  assert.ok(!keys(nomail).includes("mail"), "localhost takes no mail");
});

test("name reasons: lure words, Kuwait, foreign letters, cheap endings, free hosting, one edit", () => {
  const k = (d) => nameReasons(d, original).map((x) => x.key);
  assert.ok(k("example-login.com").includes("lure"));
  assert.ok(k("example-kw.com").includes("kuwait"));
  assert.ok(k(toASCII("\u0435xample.com")).includes("idn"));
  assert.ok(k("example.xyz").includes("risky-tld"));
  assert.ok(k("example-pay.web.app").includes("free-host"));
  assert.ok(k("examplee.com").includes("one-edit"));
  const bank = nameReasons("examplebank-kw.com", { registrable: "examplebank.com", name: "examplebank" }).find((x) => x.key === "lure");
  assert.equal(bank, undefined, "a word the brand itself carries is not a lure");
});

test("feed sightings count as recency", () => {
  const r = assess({ domain: "example-kw.com", dns: dns(), seen: { source: "nrd", date: "2026-09-24" } }, { original });
  assert.ok(keys(r).includes("nrd"));
  assert.ok(r.score >= POINTS.nrd);
});

test("ranking puts live first, then registered, each by score", () => {
  const rows = [
    { domain: "b.example", status: "registered", score: 90 },
    { domain: "a.example", status: "live", score: 10 },
    { domain: "c.example", status: "absent", score: 0 },
    { domain: "d.example", status: "live", score: 50 }
  ];
  assert.deepEqual(rank(rows).map((r) => r.domain), ["d.example", "a.example", "b.example", "c.example"]);
});
