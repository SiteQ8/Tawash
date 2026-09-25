#!/usr/bin/env node
/*
  Copies src/engine into docs/js/engine, so the page runs exactly the engine
  the command line runs. With --check it changes nothing and fails when the
  copy has drifted, which is what CI and the tests run.
*/
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/engine/", import.meta.url));
const DST = fileURLToPath(new URL("../docs/js/engine/", import.meta.url));

export function drift() {
  const want = readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
  const have = existsSync(DST) ? readdirSync(DST).filter((f) => f.endsWith(".js")).sort() : [];
  const problems = [];
  for (const f of want) {
    if (!have.includes(f)) problems.push("missing " + f);
    else if (!readFileSync(SRC + f).equals(readFileSync(DST + f))) problems.push("differs " + f);
  }
  for (const f of have) if (!want.includes(f)) problems.push("extra " + f);
  return { want, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { want, problems } = drift();
  if (process.argv.includes("--check")) {
    if (problems.length) {
      console.error("docs/js/engine is out of step with src/engine: " + problems.join(", ") + ". Run node scripts/sync-web.mjs");
      process.exit(1);
    }
    console.log("docs/js/engine matches src/engine");
  } else {
    mkdirSync(DST, { recursive: true });
    for (const f of readdirSync(DST)) if (!want.includes(f)) rmSync(DST + f);
    for (const f of want) writeFileSync(DST + f, readFileSync(SRC + f));
    console.log("copied " + want.length + " engine files to docs/js/engine");
  }
}
