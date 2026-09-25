/*
  Registration dates through RDAP, the successor of WHOIS.

  Most short names were taken decades ago by somebody with no interest in
  Kuwait. A lookalike registered last week is a different matter, so the date a
  name was registered is one of the strongest signals Tawash has. IANA publishes
  which RDAP server answers for which ending, and both that list and the big
  registries' servers allow requests from a browser.
*/
import { parse } from "./domain.js";

const BOOTSTRAP = "https://data.iana.org/rdap/dns.json";

export function rdapClient(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
  const timeout = options.timeout || 8000;
  let servers = null;
  const cache = new Map();

  async function get(url, missing = null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/rdap+json, application/json" }, signal: controller.signal });
      if (res.status === 404) return missing;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function serverFor(tld) {
    if (!servers) {
      servers = get(BOOTSTRAP).then((body) => {
        const map = new Map();
        for (const [tlds, urls] of (body && body.services) || []) {
          const https = urls.find((u) => u.startsWith("https://")) || urls[0];
          for (const t of tlds) map.set(t.toLowerCase(), https.endsWith("/") ? https : https + "/");
        }
        return map;
      });
    }
    return (await servers).get(tld) || null;
  }

  async function lookup(p) {
    const tld = p.suffix.split(".").pop();
    const base = await serverFor(tld);
    if (!base) return null;
    const body = await get(base + "domain/" + p.registrable, { found: false });
    if (!body) return null;
    if (body.found === false) return body;
    const event = Array.isArray(body.events) ? body.events.find((e) => e.eventAction === "registration") : null;
    const date = event && event.eventDate ? new Date(event.eventDate) : null;
    if (!date || Number.isNaN(date.getTime())) return { found: true, created: null };
    return { found: true, created: date.toISOString().slice(0, 10) };
  }

  return {
    /*
      Resolves to { found: true, created } with created as YYYY-MM-DD (or null
      when the registry gives no date), { found: false } when the registry says
      nobody holds the name, or null when no registry answered.
    */
    registered(domain) {
      const p = parse(domain);
      if (!p || p.free) return Promise.resolve(null);
      if (!cache.has(p.registrable)) cache.set(p.registrable, lookup(p));
      return cache.get(p.registrable);
    }
  };
}

/* Whole days between a YYYY-MM-DD date and now. */
export function ageInDays(created, now = Date.now()) {
  const t = Date.parse(created + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
}
