/*
  Exports: CSV for spreadsheets, JSON for scripts, a MISP event and a STIX 2.1
  bundle for threat intelligence platforms, and Markdown for a report or an
  issue.

  Every export treats the names as candidates. MISP attributes carry to_ids
  false and a workflow tag that says nobody has reviewed them, and the STIX
  bundle holds observables only, never indicators.
*/
import { t, reasonText, howText, plainText } from "./strings.js";

/* SHA-1, only for name based UUIDs. It is not used for anything that needs to be secret. */
function sha1(bytes) {
  const length = bytes.length;
  const total = Math.ceil((length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[length] = 0x80;
  const view = new DataView(buf.buffer);
  const bits = length * 8;
  view.setUint32(total - 8, Math.floor(bits / 0x100000000));
  view.setUint32(total - 4, bits >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

export const STIX_NAMESPACE = "00abedb4-aa42-466c-9c01-fed23315a9b7";
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

/* Name based UUID, version 5 (RFC 4122). */
export function uuid5(namespace, name) {
  const ns = namespace.replace(/-/g, "").match(/../g).map((h) => parseInt(h, 16));
  const hash = sha1(new Uint8Array([...ns, ...new TextEncoder().encode(name)])).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

const TAWASH_NAMESPACE = uuid5(URL_NAMESPACE, "https://github.com/SiteQ8/Tawash");

const exists = (r) => r.status === "live" || r.status === "registered";

function source(r, lang) {
  if (r.algorithm) return t("algorithm." + r.algorithm + ".name", lang);
  if (r.how) return howText(r, lang);
  return "";
}

function why(r, lang) {
  return (r.reasons || []).map((x) => plainText(reasonText(x, lang))).join("; ");
}

/* A cell that starts like a formula is neutralised, because page titles come from strangers. */
function cell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const CSV_COLUMNS = [
  "domain", "unicode", "technique", "status", "score", "level",
  "a", "aaaa", "ns", "mx", "reasons", "web_title", "web_similarity"
];

export function toCSV(report, { lang = "en", all = false } = {}) {
  const rows = report.results.filter((r) => all || exists(r) || r.status === "known");
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    const d = r.dns || {};
    lines.push([
      r.domain, r.unicode, plainText(source(r, lang)), r.status, r.score, r.level,
      (d.a || []).join(" "), (d.aaaa || []).join(" "), (d.ns || []).join(" "), (d.mx || []).join(" "),
      why(r, lang), r.web && r.web.title, r.web && r.web.similarity
    ].map(cell).join(","));
  }
  return "\ufeff" + lines.join("\r\n") + "\r\n";
}

export function toJSON(report) {
  return JSON.stringify(report, null, 2) + "\n";
}

export function toMISP(report) {
  const date = report.generated.slice(0, 10);
  const info = report.target
    ? `Tawash lookalike candidates for ${report.target}`
    : `Tawash lookalike candidates, ${report.kind} on ${date}`;
  const attributes = [];
  for (const r of report.results.filter(exists)) {
    attributes.push({
      uuid: uuid5(TAWASH_NAMESPACE, "domain:" + r.domain),
      type: "domain",
      category: "Network activity",
      value: r.domain,
      to_ids: false,
      comment: `${r.status}, score ${r.score}: ${why(r, "en")}`.slice(0, 1000)
    });
    const d = r.dns || {};
    for (const ip of [...(d.a || []), ...(d.aaaa || [])]) {
      attributes.push({
        uuid: uuid5(TAWASH_NAMESPACE, "ip:" + r.domain + ":" + ip),
        type: "ip-dst",
        category: "Network activity",
        value: ip,
        to_ids: false,
        comment: "resolved from " + r.domain
      });
    }
  }
  return {
    Event: {
      uuid: uuid5(TAWASH_NAMESPACE, "event:" + info + ":" + report.generated),
      info,
      date,
      threat_level_id: "4",
      analysis: "0",
      distribution: "0",
      published: false,
      Tag: [{ name: "tlp:amber" }, { name: 'workflow:state="incomplete"' }],
      Attribute: attributes
    }
  };
}

function scoId(type, value) {
  return type + "--" + uuid5(STIX_NAMESPACE, JSON.stringify({ value }));
}

export function toSTIX(report) {
  const objects = [];
  const have = new Set();
  const add = (o) => {
    if (have.has(o.id)) return;
    have.add(o.id);
    objects.push(o);
  };
  for (const r of report.results.filter(exists)) {
    const d = r.dns || {};
    const refs = [];
    for (const ip of d.a || []) {
      const id = scoId("ipv4-addr", ip);
      add({ type: "ipv4-addr", spec_version: "2.1", id, value: ip });
      refs.push(id);
    }
    for (const ip of d.aaaa || []) {
      const id = scoId("ipv6-addr", ip);
      add({ type: "ipv6-addr", spec_version: "2.1", id, value: ip });
      refs.push(id);
    }
    const domain = {
      type: "domain-name",
      spec_version: "2.1",
      id: scoId("domain-name", r.domain),
      value: r.domain,
      x_tawash_status: r.status,
      x_tawash_score: r.score,
      x_tawash_technique: r.algorithm || r.how || "",
      x_tawash_reasons: (r.reasons || []).map((x) => x.key)
    };
    if (refs.length) domain.resolves_to_refs = refs;
    add(domain);
  }
  const id = "bundle--" + uuid5(STIX_NAMESPACE, "tawash:" + report.generated + ":" + objects.map((o) => o.id).join(","));
  return { type: "bundle", id, objects };
}

/* A Markdown report with the same columns in either language. */
export function toMarkdown(report, { lang = "en", minScore = 0 } = {}) {
  const rows = report.results.filter((r) => exists(r) && r.score >= minScore);
  const out = [];
  const title = report.target
    ? t("cli.reportFor", lang, { domain: report.target })
    : t("cli.reportWatch", lang, { date: report.generated.slice(0, 10) });
  out.push("# " + t("cli.reportTitle", lang) + ": " + title, "");
  out.push(t("cli.reportNote", lang), "");
  if (!rows.length) {
    out.push(t("cli.nothingFound", lang), "");
    return out.join("\n");
  }
  const head = ["colScore", "colStatus", "colDomain", "colHow", "colWhy"].map((k) => t("cli." + k, lang));
  out.push("| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|");
  const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
  for (const r of rows) {
    const shown = r.unicode && r.unicode !== r.domain ? `\`${r.unicode}\` (\`${r.domain}\`)` : `\`${r.domain}\``;
    out.push("| " + [r.score, t("status." + r.status, lang), shown, esc(plainText(source(r, lang))), esc(why(r, lang))].join(" | ") + " |");
  }
  out.push("");
  return out.join("\n");
}

export const FORMATS = ["table", "json", "csv", "misp", "stix", "md"];

/* Serialises a report to a format name, for the command line and the page alike. */
export function serialise(report, format, options = {}) {
  switch (format) {
    case "json": return toJSON(report);
    case "csv": return toCSV(report, options);
    case "misp": return JSON.stringify(toMISP(report), null, 2) + "\n";
    case "stix": return JSON.stringify(toSTIX(report), null, 2) + "\n";
    case "md": return toMarkdown(report, options);
    default: throw new Error("unknown format: " + format);
  }
}
