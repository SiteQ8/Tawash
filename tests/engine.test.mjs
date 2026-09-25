/*
  The engine: punycode, parsing, the search list, similarity and the character diff.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { domainToASCII } from "node:url";
import {
  encode, decode, toASCII, toUnicode, parse, clean, isValidHost, permute, ALGORITHMS, transliterate, parseTlds,
  distance, jaroWinkler, skeleton, plain, diffMarks, titleSimilarity, KEYBOARDS, keyNeighbours
} from "../src/engine/index.js";

test("punycode round trips and agrees with Node's own IDNA", () => {
  for (const word of ["\u0435xample", "münchen", "bücher", "\u0578ame", "\u0441\u04bb\u043e\u0456\u0441\u0435", "مثال", "例え"]) {
    const ascii = toASCII(word + ".com");
    assert.equal(ascii, domainToASCII(word + ".com"), word);
    assert.equal(toUnicode(ascii), word + ".com");
    assert.equal(decode(encode(word)), word);
  }
  assert.equal(encode("bücher"), "bcher-kva");
  assert.equal(toUnicode("xn--xample-2of.com"), "\u0435xample.com");
  assert.equal(toUnicode("xn--not-valid-!!.com"), "xn--not-valid-!!.com");
});

test("clean and parse accept what people paste", () => {
  assert.equal(clean("https://Online.EXAMPLE.com/login?x=1"), "online.example.com");
  assert.equal(clean("user@example.com"), "example.com");
  assert.equal(clean("example.com:443"), "example.com");
  const p = parse("online.example.com");
  assert.deepEqual([p.sub, p.name, p.suffix, p.registrable], ["online", "example", "com", "example.com"]);
  const g = parse("example.gov.kw");
  assert.deepEqual([g.name, g.suffix], ["example", "gov.kw"]);
  const f = parse("example-login.web.app");
  assert.equal(f.registrable, "example-login.web.app");
  assert.equal(f.free, true);
  assert.equal(parse("not a domain"), null);
  assert.equal(parse("localhost"), null);
});

test("host validity follows the letters, digits and hyphen rule", () => {
  assert.ok(isValidHost("example-kw.com"));
  assert.ok(isValidHost("xn--xample-2of.com"));
  assert.ok(!isValidHost("-example.com"));
  assert.ok(!isValidHost("example-.com"));
  assert.ok(!isValidHost("ex--ample.com"));
  assert.ok(!isValidHost("example.c0m1"));
  assert.ok(!isValidHost("a".repeat(64) + ".com"));
});

test("keyboards know their neighbours", () => {
  assert.equal(KEYBOARDS.qwerty.q, "12aw");
  assert.equal(KEYBOARDS.qwerty.a, "qswz");
  assert.ok(keyNeighbours("z").includes("x"));
  assert.ok(keyNeighbours("a").includes("z"), "azerty puts z next to a");
});

test("every technique leads to valid, unique names", () => {
  for (const domain of ["example.com", "examplebank.com", "example.gov.kw", "dunesairways.com", "online.example.com", "kw.example.com"]) {
    const list = permute(domain);
    const names = list.map((c) => c.domain);
    assert.equal(new Set(names).size, names.length, "no duplicates for " + domain);
    for (const c of list) {
      assert.ok(isValidHost(c.domain), c.domain);
      assert.ok(ALGORITHMS.includes(c.algorithm));
      assert.notEqual(c.domain, parse(domain).registrable);
      assert.equal(c.idn, c.domain.includes("xn--"));
    }
  }
});

test("the CIRCL examples come out of the matching techniques", () => {
  const has = (domain, id, expected) => {
    const found = permute(domain, { algorithms: [id] }).map((c) => c.unicode);
    assert.ok(found.includes(expected), `${id} should turn ${domain} into ${expected}`);
  };
  /* The examples CIRCL's documentation gives, as a conformance check. */
  has("google.com", "homoglyph", "goog1e.com");
  has("google.com", "vowel-swap", "gaagle.com");
  has("google.com", "add-tld", "google.com.co");
  has("google.com", "subdomain", "goo.gle.com");
  has("google.com", "wrong-tld", "google.org");
  has("trademe.co.uk", "wrong-sld", "trademe.ac.uk");
  has("circl-one.lu", "numeral-swap", "circl-1.lu");
  /* The examples the README gives. */
  has("example.com", "omission", "exmple.com");
  has("example.com", "repetition", "exxample.com");
  has("example.com", "transposition", "exmaple.com");
  has("example.com", "replacement", "exanple.com");
  has("summer.example", "double-replacement", "sunner.example");
  has("kuwait-example.com", "misspelling", "kuwiat-example.com");
  has("buy-example.com", "homophones", "bye-example.com");
  has("example-one.com", "numeral-swap", "example-1.com");
  has("example.com", "plural", "examples.com");
  has("example.com", "bitsquatting", "exampde.com");
  has("example.com", "dynamic-dns", "example.duckdns.org");
  has("example.com", "missing-dot", "wwwexample.com");
  has("example.com", "addition", "example1.com");
  has("my-example.com", "strip-dash", "myexample.com");
  has("example.com", "add-dash", "exam-ple.com");
  has("example.com", "add-tld", "example.com.ae");
});

test("the Kuwait specific techniques cover the scam patterns seen here", () => {
  const all = (d) => permute(d).map((c) => c.unicode);
  assert.ok(all("example.com").includes("example-kw.com"));
  assert.ok(all("example.com").includes("exampleq8.com"));
  assert.ok(all("example.com").includes("knetexample.com"));
  assert.ok(all("example.gov.kw").includes("example-gov-kw.com"));
  assert.ok(all("example.gov.kw").includes("example.com.kw"));
  assert.ok(all("example.com").includes("example.com.kw"));
  assert.ok(all("souq.example").includes("souk.example"));
  assert.ok(all("souq.example").includes("suq.example"));
  assert.ok(all("example.com").includes("ex\u0430mple.com"), "Cyrillic a");
  assert.ok(all("example.com").includes("wwwexample.com"));
  assert.ok(transliterate("kuwait").includes("koweit"));
  assert.ok(transliterate("alsouq").includes("souq"));
  assert.ok(transliterate("alsouq").includes("elsouq"));
  assert.ok(all("choice.example").includes("\u0441\u04bb\u043e\u0456\u0441\u0435.example"), "whole script Cyrillic twin");
});

test("the IANA list is read cleanly and widens the search for other endings", () => {
  const list = parseTlds("# Version 2026092500, Last Updated Fri Sep 25 2026 UTC\nAAA\nARPA\nXN--MGBAAKC7DVF\n\nCOM\nnot valid!\n");
  assert.deepEqual(list, ["aaa", "xn--mgbaakc7dvf", "com"]);
  const usual = permute("example.com", { algorithms: ["wrong-tld"] }).map((c) => c.domain);
  const every = permute("example.com", { algorithms: ["wrong-tld"], tlds: list }).map((c) => c.domain);
  assert.ok(!usual.includes("example.aaa"));
  assert.ok(every.includes("example.aaa"));
  assert.ok(every.includes("example.xn--mgbaakc7dvf"));
  assert.ok(every.includes("example.com.kw"), "the Gulf endings stay");
  assert.ok(!every.includes("example.com"), "never the original");
});

test("technique filters and limits are honoured", () => {
  const only = permute("exb.com", { algorithms: ["omission"] });
  assert.deepEqual(only.map((c) => c.domain).sort(), ["eb.com", "ex.com", "xb.com"]);
  assert.equal(permute("dunesairways.com", { limit: 50 }).length, 50);
  assert.throws(() => permute("not a domain"));
});

test("distance counts a neighbour swap as one edit and stops early", () => {
  assert.equal(distance("exb", "exb"), 0);
  assert.equal(distance("exb", "xeb"), 1);
  assert.equal(distance("alsouq", "alsuq"), 1);
  assert.equal(distance("kitten", "sitting"), 3);
  assert.equal(distance("abc", "abcdefgh", 2), 3);
});

test("Jaro-Winkler and title similarity", () => {
  assert.equal(jaroWinkler("same", "same"), 1);
  assert.equal(jaroWinkler("abc", "xyz"), 0);
  assert.ok(jaroWinkler("martha", "marhta") > 0.96);
  assert.ok(titleSimilarity("Example Bank Online", "Example Bank Online | Login") >= 0.6);
  assert.equal(titleSimilarity("", "anything"), 0);
});

test("skeletons read lookalikes as the letters they imitate", () => {
  assert.equal(skeleton("a1souq"), "alsouq");
  assert.equal(skeleton("\u0435xb"), "exb");
  assert.equal(skeleton("sumrner"), "summer");
  assert.equal(plain("q8"), "q8", "plain keeps digits");
  assert.equal(skeleton("\u00e9xb"), "exb");
});

test("the diff lights up exactly what changed", () => {
  const show = (a, b) => diffMarks(a, b).map((m) => (m.gapBefore ? "^" : "") + (m.changed ? "[" + m.ch + "]" : m.ch) + (m.gapAfter ? "^" : "")).join("");
  assert.equal(show("example.com", "example-kw.com"), "example[-][k][w].com");
  assert.equal(show("example.com", "exmple.com"), "ex^mple.com");
  assert.equal(show("example.com", "ex\u0430mple.com"), "ex[\u0430]mple.com");
  assert.equal(show("alsouq.com", "alsouq-online.com"), "alsouq[-][o][n][l][i][n][e].com");
  assert.equal(show("example.com", "example.co"), "example.co^");
});
