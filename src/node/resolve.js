/*
  The system resolver, or DNS servers the person names, through Node's own
  DNS client. It answers in the same shape as the DNS over HTTPS resolver, so
  the scan does not care which one it is given. A SERVFAIL answer means the
  name is delegated to name servers that do not answer, so it counts as
  registered and is flagged as lame.
*/
import { Resolver } from "node:dns/promises";

const empty = (extra) => ({ exists: false, a: [], aaaa: [], ns: [], mx: [], ...extra });

export function systemResolver(options = {}) {
  const resolver = new Resolver({ timeout: options.timeout || 4000, tries: options.tries || 2 });
  if (options.servers && options.servers.length) resolver.setServers(options.servers);
  const soft = (promise) => promise.catch(() => []);
  return {
    kind: "system",
    async lookup(name) {
      let a;
      try {
        a = await resolver.resolve4(name);
      } catch (error) {
        if (error.code === "ENOTFOUND") return empty();
        /* SERVFAIL: the name is delegated, but its name servers refuse or do not answer. */
        if (error.code === "ESERVFAIL") return empty({ exists: true, lame: true });
        if (error.code !== "ENODATA") return empty({ exists: null, error: error.code || String(error) });
        a = [];
      }
      const [aaaa, ns, mx] = await Promise.all([
        soft(resolver.resolve6(name)),
        soft(resolver.resolveNs(name)),
        soft(resolver.resolveMx(name))
      ]);
      return {
        exists: true,
        a,
        aaaa,
        ns: ns.map((n) => n.toLowerCase()),
        mx: mx.sort((x, y) => x.priority - y.priority).map((m) => m.exchange.toLowerCase()).filter(Boolean)
      };
    }
  };
}
