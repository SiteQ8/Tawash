#!/usr/bin/env node
/*
  Renders docs/og.png, the picture shown when a link to Tawash is shared,
  from scripts/og.html. Needs Playwright with a Chromium build:
    PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM=/path/to/chrome node scripts/render-og.mjs
*/
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + fileURLToPath(new URL("./og.html", import.meta.url)), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL("../docs/og.png", import.meta.url)) });
await browser.close();
console.log("wrote docs/og.png");
