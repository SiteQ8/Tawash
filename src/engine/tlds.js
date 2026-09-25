/*
  Every top level domain in the root zone, read live from IANA.

  By default the search tries a fixed set of common and Gulf endings. With the
  full list it tries every ending that exists today, about 1,400 of them, which
  finds more and takes longer. IANA serves the list with open CORS, so the page
  and the command line read the same file.
*/

export const IANA_TLDS = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

/* The file is one ending per line in capitals, after a comment with its version. */
export function parseTlds(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const tld = line.trim().toLowerCase();
    if (!tld || tld.startsWith("#") || tld === "arpa") continue;
    if (!/^(xn--)?[a-z0-9-]{2,63}$/.test(tld)) continue;
    out.push(tld);
  }
  return [...new Set(out)];
}

/* Resolves to { version, tlds } or throws when IANA does not answer. */
export async function loadTlds(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    const res = await fetchImpl(IANA_TLDS, { signal: controller.signal });
    if (!res.ok) throw new Error("IANA answered http " + res.status);
    const text = await res.text();
    const tlds = parseTlds(text);
    if (tlds.length < 100) throw new Error("the IANA list looks incomplete");
    const version = (/Version\s+(\d+)/.exec(text) || [])[1] || "";
    return { version, tlds };
  } finally {
    clearTimeout(timer);
  }
}
