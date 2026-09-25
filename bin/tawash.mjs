#!/usr/bin/env node
/*
  tawash, the command line.

    npx github:SiteQ8/Tawash scan example.com
    npx github:SiteQ8/Tawash nrd --asli --dns
    npx github:SiteQ8/Tawash watch --asli --ct --out reports

  Exit codes: 0 done, 1 error, 2 wrong usage, 3 a score reached --fail-on,
  4 the data source could not be reached.
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  parse, clean, permute, ALGORITHMS, unknownAlgorithms, watchlist, matchAll, assess, rank,
  scan, rescore, pool, hostList, dohResolver, rdapClient, serialise, toMarkdown, FORMATS, loadTlds,
  t, plural, plainText, HELP, VERSION
} from "../src/engine/index.js";
import { systemResolver } from "../src/node/resolve.js";
import { fetchNrd, readFeed } from "../src/node/nrd.js";
import { ctQueries, searchLogs, latestCertificate } from "../src/node/ct.js";
import { probe } from "../src/node/web.js";
import { loadAsli, readKeywords } from "../src/node/asli.js";
import { table, summary } from "../src/node/output.js";

class UsageError extends Error {}
class SourceError extends Error {}

const OPTIONS = {
  asli: "bool", keywords: "string", keyword: "list", format: "string", out: "string", lang: "string",
  algorithms: "string", all: "bool", doh: "string", resolver: "string", concurrency: "string",
  "known-ns": "string", "known-mx": "string", exclude: "string", web: "bool", certs: "bool",
  claim: "list", "no-age": "bool", sweep: "bool", "all-tlds": "bool", date: "string", feed: "string",
  confidence: "string", dns: "bool", ct: "bool", days: "string", "alert-at": "string",
  "fail-on": "string", version: "bool", help: "bool"
};

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") opts.help = true;
    else if (a === "-v") opts.version = true;
    else if (!a.startsWith("--")) rest.push(a);
    else {
      const eq = a.indexOf("=");
      const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
      let value = eq < 0 ? undefined : a.slice(eq + 1);
      const type = OPTIONS[name];
      if (!type) throw new UsageError("unknown option --" + name);
      if (type === "bool") {
        opts[name] = true;
        continue;
      }
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined) throw new UsageError("--" + name + " needs a value");
      }
      if (type === "list") (opts[name] = opts[name] || []).push(value);
      else opts[name] = value;
    }
  }
  return { opts, rest };
}

const info = (text) => process.stderr.write(plainText(text) + "\n");
const splitList = (v) => String(v || "").split(",").map((s) => clean(s)).filter(Boolean);
const now = () => new Date().toISOString();
const exists = (r) => r.status === "live" || r.status === "registered";

function helpText(lang) {
  const lines = [plainText(HELP.intro[lang]), "", "  npx github:SiteQ8/Tawash <command> [options]", ""];
  for (const section of HELP.sections) {
    lines.push(plainText(section.title[lang]));
    const width = Math.max(...section.rows.map((r) => r[0].length)) + 3;
    for (const [syntax, text] of section.rows) lines.push("  " + syntax.padEnd(width) + plainText(text[lang]));
    lines.push("");
  }
  return lines.join("\n");
}

function makeResolver(opts) {
  if (opts.doh) {
    const order = opts.doh === "cloudflare" ? ["cloudflare", "google"] : ["google", "cloudflare"];
    return dohResolver({ order });
  }
  return systemResolver({ servers: splitList(opts.resolver) });
}

const concurrency = (opts) => Math.max(1, Number(opts.concurrency) || (opts.doh ? 8 : 32));
const confidence = (opts) => Math.max(0, Math.min(4, Number(opts.confidence ?? 1)));
const listed = (opts) => ({ ns: splitList(opts["known-ns"]), mx: splitList(opts["known-mx"]) });

function algorithmsFrom(opts, lang) {
  if (!opts.algorithms) return ALGORITHMS;
  const wanted = opts.algorithms.split(",").map((s) => s.trim()).filter(Boolean);
  const bad = unknownAlgorithms(wanted);
  if (bad.length) throw new UsageError(t("cli.badAlgorithm", lang, { list: bad.join(", ") }));
  return wanted;
}

/* Every ending IANA lists, when asked for. On failure the usual set is searched and the person is told. */
async function tldsFor(opts, lang) {
  if (!opts["all-tlds"]) return null;
  try {
    return (await loadTlds()).tlds;
  } catch {
    info(t("ui.tldsFailed", lang));
    return null;
  }
}

function progress(lang) {
  if (!process.stderr.isTTY) return () => {};
  let last = 0;
  return (done, total, found) => {
    const tick = Date.now();
    if (tick - last < 100 && done < total) return;
    last = tick;
    process.stderr.write(`\r${t("ui.checked", lang)} ${done}/${total}   ${t("ui.exist", lang)} ${found}   `);
    if (done >= total) process.stderr.write("\n");
  };
}

function output(text, opts, lang) {
  if (opts.out) {
    writeFileSync(opts.out, text);
    info(t("cli.wrote", lang, { file: opts.out }));
  } else {
    process.stdout.write(text);
  }
}

function emit(report, opts, lang, showAll = false) {
  const format = opts.format || "table";
  if (!FORMATS.includes(format)) throw new UsageError("unknown format " + format + ", use " + FORMATS.join(", "));
  let text;
  if (format === "table") {
    const shown = opts.all || showAll ? report.results : report.results.filter((r) => r.status !== "absent" && r.status !== "unchecked");
    text = (shown.length ? table(shown, lang) + "\n\n" : "") + summary(report, lang) + "\n";
  } else {
    text = serialise(report, format, { lang, all: Boolean(opts.all) });
  }
  output(text, opts, lang);
}

function failOn(report, opts) {
  const limit = Number(opts["fail-on"]);
  if (!Number.isFinite(limit)) return 0;
  return report.results.some((r) => exists(r) && r.score >= limit) ? 3 : 0;
}

/* Page titles and certificates for the live results, then fresh scores. */
async function enrich(report, opts, claims = []) {
  const live = report.results.filter((r) => r.status === "live");
  let originalTitle = "";
  if (opts.web && report.target) {
    const own = await probe(report.target, {});
    originalTitle = own ? own.title : "";
  }
  const cutoff = Date.now() - 30 * 86400000;
  await pool(live, 6, async (r) => {
    if (opts.web) {
      const page = await probe(r.domain, { claims, originalTitle });
      if (page) r.web = page;
    }
    if (opts.certs) {
      const cert = await latestCertificate(r.domain);
      if (cert && Date.parse(cert.issued) >= cutoff) r.cert = cert;
    }
  });
  report.results = rank(report.results.map((r) => (r.web || r.cert ? rescore(r, report) : r)));
}

async function loadWatch(opts, args, lang) {
  const keywords = [...(opts.keyword || [])];
  const domains = [];
  const owners = {};
  const claims = {};
  if (opts.asli) {
    const reg = await loadAsli();
    keywords.push(...reg.keywords);
    domains.push(...reg.domains);
    Object.assign(owners, reg.owners);
    Object.assign(claims, reg.claims);
  }
  if (opts.keywords) {
    const file = readKeywords(opts.keywords);
    keywords.push(...file.keywords);
    domains.push(...file.domains);
  }
  for (const a of args) {
    if (a.includes(".")) domains.push(clean(a));
    else keywords.push(a);
  }
  if (!keywords.length && !domains.length) throw new UsageError(t("cli.noWatchlist", lang));
  const list = watchlist({ keywords, domains, owners });
  info(t("cli.watchlist", lang, { count: list.entries.length, domains: list.official.length }));
  return { list, claims };
}

/* Turns matches into scored results, with or without asking DNS. */
async function checkMatches(matches, seenFor, list, opts, useDns) {
  const resolver = useDns ? makeResolver(opts) : null;
  const originals = new Map();
  const originalFor = (m) => {
    const official =
      list.official.find((d) => (parse(d) || {}).name === m.keyword) || (m.how === "official-label" ? m.word : null);
    if (!official) return Promise.resolve({ name: m.keyword });
    if (!originals.has(official)) {
      originals.set(official, (async () => {
        const p = parse(official);
        const d = resolver ? await resolver.lookup(p.registrable) : {};
        return { registrable: p.registrable, name: p.name, ns: d.ns || [], mx: d.mx || [] };
      })());
    }
    return originals.get(official);
  };
  return pool(matches, concurrency(opts), async (m) => {
    const original = await originalFor(m);
    const dns = resolver ? await resolver.lookup(m.host) : { exists: true, a: [], aaaa: [], ns: [], mx: [] };
    const base = {
      domain: m.host, unicode: m.unicode, how: m.how, keyword: m.keyword, owner: m.owner,
      word: m.word, seen: seenFor(m), dns, original: original.registrable || ""
    };
    return { ...base, ...assess(base, { original, listed: listed(opts) }) };
  });
}

async function nrdFeed(opts) {
  if (opts.feed) return { date: opts.date || new Date().toISOString().slice(0, 10), names: readFeed(opts.feed) };
  return fetchNrd({ date: opts.date });
}

const report = (kind, results, extra = {}) => ({
  tool: "tawash", version: VERSION, kind, generated: now(), ...extra, results: rank(results)
});

const COMMANDS = {
  async algorithms(args, opts, lang) {
    const rows = ALGORITHMS.map((id) => ({
      id, name: t("algorithm." + id + ".name", lang), about: plainText(t("algorithm." + id + ".about", lang))
    }));
    if (opts.format === "json") output(JSON.stringify(rows, null, 2) + "\n", opts, lang);
    else output(rows.map((r) => `${r.id.padEnd(20)}${r.name}\n${" ".repeat(20)}${r.about}`).join("\n") + "\n", opts, lang);
    return 0;
  },

  async candidates(args, opts, lang) {
    const p = parse(args[0] || "");
    if (!p) throw new UsageError(t("cli.badDomain", lang, { input: args[0] || "" }));
    const list = permute(p, { algorithms: algorithmsFrom(opts, lang), tlds: await tldsFor(opts, lang) });
    const format = opts.format || "table";
    let text;
    if (format === "json") text = JSON.stringify(list, null, 2) + "\n";
    else if (format === "csv") text = "domain,unicode,technique\r\n" + list.map((c) => [c.domain, c.unicode, c.algorithm].join(",")).join("\r\n") + "\r\n";
    else if (format === "table") {
      text = list.map((c) => c.algorithm.padEnd(20) + (c.idn ? `${c.unicode} (${c.domain})` : c.domain)).join("\n") +
        "\n\n" + plural("listed", list.length, lang) + "\n";
    } else throw new UsageError("candidates writes table, json or csv");
    output(text, opts, lang);
    return 0;
  },

  async scan(args, opts, lang) {
    const p = parse(args[0] || "");
    if (!p) throw new UsageError(t("cli.badDomain", lang, { input: args[0] || "" }));
    const tick = progress(lang);
    const counted = new Set();
    let total = 0;
    let found = 0;
    const result = await scan(p.host, {
      resolver: makeResolver(opts),
      algorithms: algorithmsFrom(opts, lang),
      tlds: await tldsFor(opts, lang),
      known: listed(opts),
      exclude: opts.exclude ? hostList(readFileSync(opts.exclude, "utf8")) : [],
      concurrency: concurrency(opts),
      rdap: opts["no-age"] ? null : rdapClient(),
      onCandidates: (list) => { total = list.length; },
      onResult: (r) => {
        if (!counted.has(r.domain)) {
          counted.add(r.domain);
          if (exists(r)) found++;
        }
        tick(counted.size, total, found);
      }
    });
    if (opts.web || opts.certs) {
      const claims = [...(opts.claim || [])];
      if (opts.web) {
        try {
          const reg = await loadAsli();
          claims.push(...(reg.claims[result.target] || []));
        } catch {
          /* the registry is a bonus, not a requirement */
        }
      }
      await enrich(result, opts, claims);
    }
    emit(result, opts, lang);
    return failOn(result, opts);
  },

  async nrd(args, opts, lang) {
    const { list } = await loadWatch(opts, args, lang);
    let feed;
    try {
      feed = await nrdFeed(opts);
    } catch {
      info(t("cli.nrdUnreachable", lang));
      throw new SourceError("");
    }
    info(t("cli.nrdCount", lang, { date: feed.date, count: feed.names.length }));
    const matches = matchAll(feed.names, list, { confidence: confidence(opts) });
    info(t("cli.matches", lang, { count: matches.length }));
    const results = await checkMatches(matches, () => ({ source: "nrd", date: feed.date }), list, opts, Boolean(opts.dns));
    const r = report("nrd", results, { date: feed.date });
    emit(r, opts, lang, true);
    return failOn(r, opts);
  },

  async ct(args, opts, lang) {
    const { list } = await loadWatch(opts, args, lang);
    const logs = await searchLogs(ctQueries(list), { days: Number(opts.days) || 3 });
    if (!logs.reached.length) {
      info(t("cli.ctUnreachable", lang));
      throw new SourceError("");
    }
    info(t("cli.ctCount", lang, { count: logs.names.length }));
    const first = new Map(logs.names.map((n) => [n.name, n.first]));
    const matches = matchAll(logs.names.map((n) => n.name), list, { confidence: confidence(opts) });
    info(t("cli.matches", lang, { count: matches.length }));
    const results = await checkMatches(matches, (m) => ({ source: "ct", date: first.get(m.host) || "" }), list, opts, Boolean(opts.dns));
    const r = report("ct", results, { failed: logs.failed.length, skipped: logs.skipped.length });
    emit(r, opts, lang, true);
    return failOn(r, opts);
  },

  async watch(args, opts, lang) {
    const { list } = await loadWatch(opts, args, lang);
    const dir = opts.out || "tawash-watch";
    mkdirSync(dir, { recursive: true });
    const best = new Map();
    const keep = (r) => {
      const prev = best.get(r.domain);
      if (!prev || r.score > prev.score) best.set(r.domain, r);
    };
    const notes = [];
    const sources = {};

    try {
      const feed = await nrdFeed(opts);
      info(t("cli.nrdCount", lang, { date: feed.date, count: feed.names.length }));
      const matches = matchAll(feed.names, list, { confidence: confidence(opts) });
      info(t("cli.matches", lang, { count: matches.length }));
      (await checkMatches(matches, () => ({ source: "nrd", date: feed.date }), list, opts, true)).forEach(keep);
      sources.nrd = { date: feed.date, names: feed.names.length, matches: matches.length };
    } catch {
      notes.push("nrdUnreachable");
      info(t("cli.nrdUnreachable", lang));
    }

    if (opts.ct) {
      const logs = await searchLogs(ctQueries(list), { days: Number(opts.days) || 3 });
      if (!logs.reached.length) {
        notes.push("ctUnreachable");
        info(t("cli.ctUnreachable", lang));
      } else {
        const first = new Map(logs.names.map((n) => [n.name, n.first]));
        const matches = matchAll(logs.names.map((n) => n.name), list, { confidence: confidence(opts) });
        info(t("cli.ctCount", lang, { count: logs.names.length }));
        (await checkMatches(matches, (m) => ({ source: "ct", date: first.get(m.host) || "" }), list, opts, true)).forEach(keep);
        sources.ct = { names: logs.names.length, matches: matches.length, failed: logs.failed.length, skipped: logs.skipped.length };
      }
    }

    if (opts.sweep) {
      const resolver = makeResolver(opts);
      const rdap = opts["no-age"] ? null : rdapClient();
      const tlds = await tldsFor(opts, lang);
      let count = 0;
      for (const official of list.official) {
        const r = await scan(official, {
          resolver, concurrency: concurrency(opts), known: listed(opts), rdap, tlds,
          rdapFilter: (x) => x.score >= 25
        });
        r.results.filter(exists).forEach((x) => keep({ ...x, original: r.target }));
        count += r.results.length;
      }
      sources.sweep = { domains: list.official.length, searched: count };
    }

    const date = now().slice(0, 10);
    const r = report("watch", [...best.values()], { date, sources, notes });
    const base = join(dir, "tawash-" + date);
    const noteLines = notes.map((n) => "> " + t("cli." + n, lang)).join("\n");
    writeFileSync(base + ".json", serialise(r, "json"));
    writeFileSync(base + ".md", toMarkdown(r, { lang }) + (noteLines ? "\n" + noteLines + "\n" : ""));
    info(t("cli.wrote", lang, { file: base + ".json" }));
    info(t("cli.wrote", lang, { file: base + ".md" }));

    /* Only names not alerted before, remembered as hashes so the state file names nobody. */
    const seenFile = join(dir, "seen.json");
    const seen = new Set(existsSync(seenFile) ? JSON.parse(readFileSync(seenFile, "utf8")).hashes || [] : []);
    const hash = (d) => createHash("sha256").update(d).digest("hex").slice(0, 16);
    const threshold = Number(opts["alert-at"] ?? 50);
    const fresh = r.results.filter((x) => exists(x) && x.score >= threshold && !seen.has(hash(x.domain)));
    const alert = join(dir, "alert.md");
    if (fresh.length) {
      writeFileSync(alert, toMarkdown({ ...r, results: fresh }, { lang }));
      info(t("cli.wrote", lang, { file: alert }));
      fresh.forEach((x) => seen.add(hash(x.domain)));
    } else if (existsSync(alert)) {
      rmSync(alert);
    }
    writeFileSync(seenFile, JSON.stringify({ schema: "tawash.seen.v1", updated: now(), hashes: [...seen].sort() }, null, 2) + "\n");
    info(summary(r, lang));
    return failOn(r, opts);
  }
};

async function main(argv) {
  const { opts, rest } = parseArgs(argv);
  const lang = opts.lang === "ar" ? "ar" : "en";
  if (opts.version) {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  const [command, ...args] = rest;
  if (opts.help || !command || command === "help") {
    process.stdout.write(helpText(lang) + "\n");
    return 0;
  }
  const run = COMMANDS[command];
  if (!run) throw new UsageError("unknown command " + command + ", see --help");
  return run(args, opts, lang);
}

function finish(code) {
  process.stdout.write("", () => process.exit(code));
}

main(process.argv.slice(2)).then(
  (code) => finish(code || 0),
  (error) => {
    if (error instanceof SourceError) return finish(4);
    process.stderr.write("tawash: " + (error.message || error) + "\n");
    finish(error instanceof UsageError ? 2 : 1);
  }
);
