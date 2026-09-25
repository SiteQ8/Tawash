/*
  The daily list of newly registered domains that WhoisDS publishes for free:
  roughly seventy thousand names a day across the generic endings, as a zip
  holding domain-names.txt. The list for a day appears the morning after, so
  the default is yesterday, falling back one more day when it is not out yet.
*/
import { readFileSync } from "node:fs";
import { readZip } from "./zip.js";

export function nrdUrl(date) {
  const token = Buffer.from(date + ".zip").toString("base64");
  return `https://www.whoisds.com//whois-database/newly-registered-domains/${token}/nrd`;
}

export function dayBefore(date, days = 1) {
  const t = Date.parse(date + "T00:00:00Z") - days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function yesterday(now = Date.now()) {
  return new Date(now - 86400000).toISOString().slice(0, 10);
}

/* Names from a buffer that is either a zip or plain text, one name per line. */
export function namesFrom(buffer) {
  const buf = Buffer.from(buffer);
  let text;
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) {
    const files = readZip(buf).filter((f) => !f.name.endsWith("/"));
    const pick = files.find((f) => f.name.endsWith(".txt")) || files[0];
    text = pick ? pick.data.toString("utf8") : "";
  } else {
    text = buf.toString("utf8");
  }
  return text.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
}

export function readFeed(path) {
  return namesFrom(readFileSync(path));
}

/*
  fetchNrd({ date, fetch }) resolves to { date, names } or throws when neither
  that day nor the day before could be downloaded.
*/
export async function fetchNrd(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const first = options.date || yesterday();
  const tries = options.date ? [first] : [first, dayBefore(first)];
  let last = null;
  for (const date of tries) {
    try {
      const res = await fetchImpl(nrdUrl(date), { headers: { "user-agent": UA } });
      if (!res.ok) throw new Error("http " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      const names = namesFrom(buf);
      if (!names.length) throw new Error("empty list");
      return { date, names };
    } catch (error) {
      last = error;
    }
  }
  throw last || new Error("no list");
}

export const UA = "tawash (+https://github.com/SiteQ8/Tawash)";
