/*
  Looking at the page a live lookalike serves: its title, how close that title
  is to the original's, and whether the page names the organisation it may be
  imitating. This only runs when asked for with --web, because it contacts
  sites that may belong to scammers.
*/
import { titleSimilarity } from "../engine/similarity.js";
import { UA } from "./nrd.js";

const LIMIT = 262144;

async function readSome(res) {
  if (!res.body || !res.body.getReader) return (await res.text()).slice(0, LIMIT);
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < LIMIT) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function titleOf(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || "");
  if (!m) return "";
  return m[1]
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n) => ENTITIES[n.toLowerCase()] ?? all)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/* Lowercase, and Arabic without diacritics or letter variants, so a name matches however it is typed. */
export function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ");
}

/*
  probe("example-kw.com", { claims, originalTitle }) resolves to
  { url, status, title, similarity, names } or null when nothing answered.
*/
export async function probe(domain, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  for (const scheme of ["https://", "http://"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 10000);
    try {
      const res = await fetchImpl(scheme + domain + "/", {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": options.userAgent || UA, accept: "text/html,*/*;q=0.5" }
      });
      const html = await readSome(res);
      const title = titleOf(html);
      const text = normalise(html);
      const names = (options.claims || []).filter((c) => c && text.includes(normalise(c)));
      return {
        url: res.url,
        status: res.status,
        title,
        similarity: options.originalTitle && title ? titleSimilarity(title, options.originalTitle) : null,
        names: [...new Set(names)]
      };
    } catch {
      /* try the next scheme */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
