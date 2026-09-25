/*
  What the command line prints: a compact table for people, and the exports
  for everything else.
*/
import { t, reasonText, howText, plainText, plural } from "../engine/strings.js";

const useColour = () => process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColour() ? `\x1b[${code}m${s}\x1b[0m` : s);

const LEVEL = { high: "1;31", medium: "33", low: "2", none: "2" };
const STATUS = { live: "35", registered: "33", known: "32", unknown: "90", absent: "2", unchecked: "2" };

function pad(s, n) {
  const chars = Array.from(String(s));
  if (chars.length > n) return chars.slice(0, n - 1).join("") + "~";
  return String(s) + " ".repeat(n - chars.length);
}

export function technique(r, lang) {
  if (r.algorithm) return t("algorithm." + r.algorithm + ".name", lang);
  if (r.how) return plainText(howText(r, lang)) + (r.keyword ? " [" + r.keyword + "]" : "");
  return "";
}

export function table(results, lang = "en") {
  const width = process.stdout.columns || 140;
  const lines = [];
  for (const r of results) {
    const shown = r.unicode && r.unicode !== r.domain ? `${r.unicode} (${r.domain})` : r.domain;
    const why = (r.reasons || []).map((x) => plainText(reasonText(x, lang))).join("; ");
    const head = [
      paint(LEVEL[r.level] || "0", pad(r.score, 4)),
      paint(STATUS[r.status] || "0", pad(t("status." + r.status, lang), 12)),
      pad(shown, 34),
      pad(technique(r, lang), 26)
    ].join(" ");
    const room = Math.max(20, width - 80);
    lines.push(head + " " + pad(why, room).trimEnd());
  }
  return lines.join("\n");
}

export function summary(report, lang = "en") {
  const exists = report.results.filter((r) => r.status === "live" || r.status === "registered").length;
  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-KW" : "en");
  const parts = [];
  if (report.kind === "scan") parts.push(plural("generated", report.results.length, lang, (n) => fmt.format(n)));
  parts.push(plural("found", exists, lang, (n) => fmt.format(n)));
  return parts.join(lang === "ar" ? "، " : ", ");
}
