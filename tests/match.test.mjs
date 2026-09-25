/*
  Matching newly registered and logged names against a watchlist.
  Every brand here is made up.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { watchlist, matchHost, matchAll } from "../src/engine/index.js";

const list = watchlist({
  domains: ["examplebank.com", "alsouq.com", "example.gov.kw", "dunesairways.com", "express.example"],
  keywords: ["exb", "zpay", "upx", "tea"]
});

const HITS = {
  "exb.xyz": "exact",
  "exb-kw.com": "token",
  "exbpay.top": "glued",
  "kwexb.online": "glued",
  "xn--xb-mlc.com": "homoglyph",
  "examplebank.com.secure-login.xyz": "official-label",
  "a1souq.com": "homoglyph",
  "alsuq-online.com": "transliteration",
  "alsouqq.com": "typo1",
  "myalsouqstore.net": "contains",
  "exb-gov-kw.com": "token",
  "dunesairway.com": "typo1",
  "dunes-airways-offers.com": "contains",
  "zpay-login.info": "token",
  "exb-com.rest": "token",
  "express-kw.com": "token"
};

const MISSES = [
  "unexba.com", "exbition.com", "randomsite.com", "green-tea-recipes.com", "nodx-opx.com",
  "expres-advisory.com", "coachcaseexpress.online", "zzpay.site", "examplebank.com", "login.examplebank.com"
];

test("scam patterns match, and the way they match is named", () => {
  for (const [host, how] of Object.entries(HITS)) {
    const m = matchHost(host, list, { confidence: 1 });
    assert.ok(m, host + " should match");
    assert.equal(m.how, how, host);
  }
});

test("harmless names and official names do not match", () => {
  for (const host of MISSES) assert.equal(matchHost(host, list, { confidence: 1 }), null, host);
});

test("a country variant of an official domain is the same name on another ending, not a carried label", () => {
  assert.equal(matchHost("examplebank.com.kw", list, { confidence: 1 }).how, "exact");
});

test("confidence widens the net step by step", () => {
  const hosts = ["zzpay.site", "alsoouq.net", "dnesairwys.com", "xalsouqx.org"];
  const counts = [0, 1, 2, 3, 4].map((c) => matchAll(hosts, list, { confidence: c }).length);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], JSON.stringify(counts));
  assert.equal(counts[0], 0);
  assert.ok(counts[4] >= 3, JSON.stringify(counts));
});

test("matchAll removes duplicates and puts the strongest first", () => {
  const out = matchAll(["alsouqq.com", "examplebank.com.secure-login.xyz", "alsouqq.com"], list);
  assert.equal(out.length, 2);
  assert.equal(out[0].how, "official-label");
});
