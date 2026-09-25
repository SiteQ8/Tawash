/*
  Gates on the repository itself: the page runs the same engine as the command
  line, the documentation covers every command, option and technique in both
  languages, and no long dash appears anywhere.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { drift } from "../scripts/sync-web.mjs";
import { HELP, ALGORITHMS, STRINGS, VERSION } from "../src/engine/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const TEXT = new Set([".js", ".mjs", ".md", ".html", ".css", ".json", ".yml", ".yaml", ".txt", ".svg", ""]);

function files(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (TEXT.has(extname(name))) out.push(full);
  }
  return out;
}

test("docs/js/engine is a byte for byte copy of src/engine", () => {
  assert.deepEqual(drift().problems, []);
});

test("no long dashes anywhere in the repository", () => {
  for (const f of files()) {
    const text = readFileSync(f, "utf8");
    assert.ok(!/[\u2012\u2013\u2014\u2015]/.test(text), f);
  }
});

test("both READMEs document every command, option and technique", () => {
  const docs = { en: read("README.md"), ar: read("README.ar.md") };
  const rows = HELP.sections.filter((s) => s.id !== "examples").flatMap((s) => s.rows.map((r) => r[0].split(" ")[0]));
  for (const [lang, text] of Object.entries(docs)) {
    for (const item of rows) assert.ok(text.includes("`" + item) || text.includes(item + " "), `${lang} README misses ${item}`);
    for (const id of ALGORITHMS) assert.ok(text.includes("`" + id + "`"), `${lang} README misses technique ${id}`);
  }
});

test("the Arabic README keeps periods at the end of sentences", () => {
  let fenced = false;
  for (const line of read("README.ar.md").split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !/[\u0600-\u06ff]/.test(line) || line.trim().startsWith("<")) continue;
    const cells = line.startsWith("|") ? line.split("|") : [line];
    for (const cell of cells) {
      const text = cell.replace(/`[^`]*`/g, " ").replace(/\]\([^)]*\)/g, "]").replace(/https?:\/\/\S+/g, " ").trim();
      if (!text) continue;
      assert.ok(!/[,;?]/.test(text), "Latin punctuation: " + text);
      assert.ok(!text.replace(/\.$/, "").includes("."), "period inside a sentence: " + text);
    }
  }
});

test("every text key the page asks for exists", () => {
  const html = read("docs/index.html");
  const keys = [...html.matchAll(/data-t(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 30);
  for (const k of keys) assert.ok(STRINGS.ui[k], "missing ui string " + k);
});

test("the package and the engine agree on the version", () => {
  assert.equal(JSON.parse(read("package.json")).version, VERSION);
  assert.ok(read("CHANGELOG.md").includes(VERSION));
});
