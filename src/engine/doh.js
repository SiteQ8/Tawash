/*
  DNS over HTTPS, through the JSON interfaces Google and Cloudflare both offer
  with open CORS, so the page can ask from the browser and the command line can
  ask from anywhere a normal resolver is blocked.

  lookup(name) answers { exists, a, aaaa, ns, mx, error }:
    exists true    the name is in DNS, with or without a web address, and
                   lame true when its name servers do not answer
    exists false   NXDOMAIN, nobody has it
    exists null    the answer failed, error says why
*/

export const PROVIDERS = {
  google: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  cloudflare: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
};

const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, AAAA: 28 };

function records(body, type) {
  if (!body || !Array.isArray(body.Answer)) return [];
  return body.Answer.filter((r) => r.type === TYPES[type]).map((r) => String(r.data).replace(/\.$/, "").toLowerCase());
}

function mxHosts(body) {
  return records(body, "MX")
    .map((d) => d.split(/\s+/))
    .filter((p) => p.length === 2 && p[1] && p[1] !== ".")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map((p) => p[1].replace(/\.$/, ""));
}

const empty = (extra) => ({ exists: false, a: [], aaaa: [], ns: [], mx: [], ...extra });

export function dohResolver(options = {}) {
  const order = options.order || ["google", "cloudflare"];
  const fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
  const timeout = options.timeout || 8000;
  const signal = options.signal;

  async function ask(name, type) {
    let last = null;
    for (const provider of order) {
      if (signal && signal.aborted) throw new Error("stopped");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const stop = () => controller.abort();
      if (signal) signal.addEventListener("abort", stop, { once: true });
      try {
        const res = await fetchImpl(PROVIDERS[provider](name, type), {
          headers: { accept: "application/dns-json" },
          signal: controller.signal
        });
        if (!res.ok) throw new Error("http " + res.status);
        return await res.json();
      } catch (error) {
        last = error;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", stop);
      }
    }
    throw last || new Error("no answer");
  }

  return {
    kind: "doh",
    async lookup(name) {
      let answer;
      try {
        answer = await ask(name, "A");
      } catch (error) {
        return empty({ exists: null, error: String(error.message || error) });
      }
      if (answer.Status === 3) return empty();
      /* SERVFAIL: delegated to name servers that refuse or do not answer. */
      if (answer.Status === 2) return empty({ exists: true, lame: true });
      if (answer.Status !== 0) return empty({ exists: null, error: "rcode " + answer.Status });
      const [aaaa, ns, mx] = await Promise.all(["AAAA", "NS", "MX"].map((type) => ask(name, type).catch(() => null)));
      return {
        exists: true,
        a: records(answer, "A"),
        aaaa: records(aaaa, "AAAA"),
        ns: records(ns, "NS"),
        mx: mxHosts(mx),
        cname: records(answer, "CNAME")
      };
    }
  };
}
