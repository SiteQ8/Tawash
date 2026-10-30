/*
  The web finder. Everything runs in the visitor's browser: the search uses the
  same engine as the command line, DNS answers come from Google Public DNS or
  Cloudflare over HTTPS, and registration dates from RDAP.
  Nothing is sent to Tawash, because there is no Tawash server.
*/
import {
  ALGORITHMS, VERSION, t, plural, reasonText, parse, diffMarks, toUnicode, toASCII, scan, rank,
  dohResolver, rdapClient, serialise, hostList, POINTS, loadTlds
} from "./js/engine/index.js";

const $ = (s) => document.querySelector(s);
const PAGE = 600;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let everyTld = null;

const state = {
  lang: "ar",
  results: new Map(),
  total: 0,
  target: "",
  original: null,
  report: null,
  filter: "found",
  controller: null,
  running: false,
  open: new Set(),
  rows: new Map(),
  arrived: new Set(),
  limit: PAGE,
  frame: 0,
  last: 0
};

/*
  The specimen: real readings from the search list of the domains reserved for
  examples (RFC 2606), so the page shows how a result reads before anything is
  searched. No real brand is ever a sample.
*/
const SPECIMENS = [
  { original: "example.com", candidate: "exаmple.com", algorithm: "homoglyph" },
  { original: "example.com", candidate: "example-kw.com", algorithm: "kuwait-affix" },
  { original: "example.gov.kw", candidate: "example-gov-kw.com", algorithm: "dot-to-dash" },
  { original: "example.com", candidate: "example.com.kw", algorithm: "wrong-tld" }
];
const specimen = { index: 0 };

/* Our strings may hold code in backticks; everything else is escaped first. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* A short name or a date never breaks at its hyphens, in either language. */
function rich(text) {
  return escapeHtml(text)
    .replace(/`([^`]*)`/g, (m, c) => `<code dir="ltr"${!/\s/.test(c) && c.length <= 32 ? ' class="nobreak"' : ""}>${c}</code>`)
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, '<span class="nobreak">$1</span>');
}
const ui = (key, vars) => t("ui." + key, state.lang, vars);
const number = (n) => new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(n);

function initialLang() {
  const param = new URLSearchParams(location.search).get("lang");
  if (param === "en" || param === "ar") return param;
  try {
    const saved = localStorage.getItem("tawash.lang");
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    /* private mode */
  }
  return "ar";
}

function applyLang() {
  const root = document.documentElement;
  root.lang = state.lang;
  root.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = ui("title");
  for (const el of document.querySelectorAll("[data-t]")) el.innerHTML = rich(ui(el.dataset.t));
  for (const el of document.querySelectorAll("[data-t-aria]")) el.setAttribute("aria-label", ui(el.dataset.tAria));
  const button = $("#lang");
  button.textContent = state.lang === "ar" ? "English" : "العربية";
  button.lang = state.lang === "ar" ? "en" : "ar";
  buildTechniques();
  buildLegend();
  buildPicks();
  showSpecimen(specimen.index, false);
  setRunning(state.running);
  state.rows.clear();
  render();
}

function buildTechniques() {
  const list = $("#technique-list");
  const checked = new Set([...list.querySelectorAll("input:checked")].map((i) => i.value));
  const first = !list.children.length;
  list.textContent = "";
  for (const id of ALGORITHMS) {
    const label = document.createElement("label");
    label.title = t("algorithm." + id + ".about", state.lang).replace(/`/g, "");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = id;
    box.checked = first || checked.has(id);
    const name = document.createElement("span");
    name.textContent = t("algorithm." + id + ".name", state.lang);
    label.append(box, name);
    list.append(label);
  }
  optionsState();
}

function selectedTechniques() {
  return [...document.querySelectorAll("#technique-list input:checked")].map((i) => i.value);
}

/* The closed options control says what the search covers. */
function optionsState() {
  const n = selectedTechniques().length;
  const parts = [ui("optionsState", { n: number(n), total: number(ALGORITHMS.length) })];
  parts.push($("#all-tlds").checked ? ui("tldsEvery") : ui("tldsUsual"));
  $("#options-state").innerHTML = rich(parts.join(state.lang === "ar" ? "، " : ", "));
}

function buildLegend() {
  const dl = $("#statuses");
  dl.textContent = "";
  for (const id of ["live", "registered", "known", "absent", "unknown"]) {
    const dt = document.createElement("dt");
    const mark = document.createElement("span");
    mark.className = "status " + id;
    mark.textContent = t("status." + id, state.lang);
    dt.append(mark);
    const dd = document.createElement("dd");
    dd.innerHTML = rich(t("statusAbout." + id, state.lang));
    dl.append(dt, dd);
  }
}

/* The specimen's picks, one per reading, named for its technique. It moves only when asked. */
function buildPicks() {
  const box = $("#specimen-picks");
  box.textContent = "";
  SPECIMENS.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t("algorithm." + s.algorithm + ".name", state.lang);
    b.setAttribute("aria-pressed", String(i === specimen.index));
    b.addEventListener("click", () => { if (i !== specimen.index) showSpecimen(i, true); });
    box.append(b);
  });
}

function fillLoupe(el, from, to) {
  el.textContent = "";
  for (const m of diffMarks(toUnicode(from), toUnicode(to))) {
    const span = document.createElement("span");
    span.textContent = m.ch;
    const cls = [m.changed ? "d" : "", m.gapBefore ? "gap" : "", m.gapAfter ? "gap-after" : ""].filter(Boolean).join(" ");
    if (cls) span.className = cls;
    if (m.changed && m.ch.codePointAt(0) > 127) span.title = letterNote(m.ch);
    el.append(span);
  }
}

/* What a lifted letter really is: its code point and its alphabet. */
function letterNote(ch) {
  const cp = "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
  const script = /\p{Script=Cyrillic}/u.test(ch) ? "cyrillic"
    : /\p{Script=Greek}/u.test(ch) ? "greek"
    : /\p{Script=Armenian}/u.test(ch) ? "armenian"
    : /\p{Script=Latin}/u.test(ch) ? "latin" : "other";
  return ui("letter", { cp, script: t("script." + script, state.lang) });
}

function showSpecimen(i, animate) {
  specimen.index = (i + SPECIMENS.length) % SPECIMENS.length;
  const s = SPECIMENS[specimen.index];
  const stage = $("#specimen-stage");
  const paint = () => {
    $("#specimen-original").textContent = s.original;
    const candidate = $("#specimen-candidate");
    fillLoupe(candidate, s.original, s.candidate);
    const ascii = toASCII(s.candidate);
    $("#specimen-ascii").textContent = ascii !== s.candidate ? ascii : "";
    $("#specimen-about").innerHTML = rich(t("algorithm." + s.algorithm + ".about", state.lang));
    document.querySelectorAll("#specimen-picks button").forEach((b, k) => b.setAttribute("aria-pressed", String(k === specimen.index)));
    return candidate;
  };
  if (!animate || reduceMotion() || !stage.animate) {
    paint();
    return;
  }
  /* Blur bridges the two readings, so the eye sees one change, not two words swapping. */
  const out = stage.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(2px)" }], { duration: 120, easing: "ease-out", fill: "forwards" });
  out.onfinish = () => {
    const candidate = paint();
    out.cancel();
    stage.animate([{ opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    candidate.querySelectorAll(".d").forEach((d, k) => {
      d.animate([{ opacity: 0, transform: "translateY(2px) scale(0.92)" }, { opacity: 1, transform: "none" }], {
        duration: 260, delay: 90 + k * 40, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards"
      });
    });
  };
}

let swapTimer = 0;
function setRunning(on) {
  state.running = on;
  const go = $("#go");
  const label = go.querySelector(".go-label");
  const next = on ? ui("stop") : ui("scan");
  go.classList.toggle("stop", on);
  clearTimeout(swapTimer);
  if (label.textContent === next || reduceMotion() || !label.textContent) {
    label.textContent = next;
    go.classList.remove("swapping");
    return;
  }
  go.classList.add("swapping");
  /* The label is read again when the swap lands, so a quick stop never leaves "Stop" on an idle button. */
  swapTimer = setTimeout(() => {
    label.textContent = state.running ? ui("stop") : ui("scan");
    go.classList.remove("swapping");
  }, 110);
}

function showError(text) {
  const box = $("#error");
  box.innerHTML = text ? rich(text) : "";
  box.hidden = !text;
}

function note(text, tone) {
  const box = $("#note");
  box.innerHTML = text ? rich(text) : "";
  box.hidden = !text;
  if (tone) box.dataset.tone = tone;
  else delete box.dataset.tone;
}

function start(value) {
  $("#domain").value = value;
  run(value);
}

async function run(input) {
  showError("");
  const p = parse(input);
  if (!p) {
    showError(ui("invalid"));
    return;
  }
  const techniques = selectedTechniques();
  if (!techniques.length) {
    showError(ui("noTechniques"));
    return;
  }
  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  Object.assign(state, {
    results: new Map(), total: 0, target: p.host, original: null, report: null,
    open: new Set(), rows: new Map(), arrived: new Set(), limit: PAGE
  });
  $("#results").textContent = "";
  $("#live").textContent = "";

  const url = new URL(location.href);
  url.searchParams.set("d", p.host);
  if (state.lang === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  history.replaceState(null, "", url);

  $("#run").hidden = false;
  $("#idle").hidden = true;
  setRunning(true);
  note(ui("learning", { domain: p.registrable }));
  render();

  /* Every ending IANA lists, read once per visit and only when asked for. */
  let tlds = null;
  if ($("#all-tlds").checked) {
    try {
      everyTld = everyTld || loadTlds().then((x) => x.tlds);
      tlds = await everyTld;
    } catch {
      everyTld = null;
      note(ui("tldsFailed"), "warn");
    }
  }

  try {
    const report = await scan(p.host, {
      tlds,
      resolver: dohResolver({ signal: controller.signal }),
      rdap: rdapClient(),
      algorithms: techniques,
      known: { ns: hostList($("#known-ns").value), mx: hostList($("#known-mx").value) },
      exclude: hostList($("#exclude").value),
      concurrency: 10,
      signal: controller.signal,
      onOriginal: (o) => {
        if (state.controller !== controller) return;
        state.original = o;
        if (o.exists === false) note(ui("originalMissing", { domain: o.domain }), "warn");
        else if (!$("#all-tlds").checked || tlds) note("");
      },
      onCandidates: (list) => {
        if (state.controller === controller) state.total = list.length;
      },
      onResult: (r) => {
        if (state.controller !== controller) return;
        state.results.set(r.domain, r);
        schedule();
      }
    });
    if (state.controller !== controller) return;
    state.report = report;
    const values = [...state.results.values()];
    const unknown = values.filter((r) => r.status === "unknown").length;
    if (controller.signal.aborted) note(ui("stopped"));
    else if (values.length > 10 && unknown === values.length) note(ui("dnsFailed"), "warn");
  } catch {
    note(ui("dnsFailed"), "warn");
  } finally {
    if (state.controller === controller) {
      setRunning(false);
      render();
      const exist = [...state.results.values()].filter(EXISTS).length;
      $("#live").textContent = plural("found", exist, state.lang, number);
    }
  }
}

function stop() {
  if (state.controller) state.controller.abort();
}

function schedule() {
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => {
    state.frame = 0;
    const now = performance.now();
    if (now - state.last < 180 && state.running) {
      schedule();
      return;
    }
    state.last = now;
    render();
  });
}

const EXISTS = (r) => r.status === "live" || r.status === "registered";
const FILTERS = {
  found: EXISTS,
  live: (r) => r.status === "live",
  known: (r) => r.status === "known",
  all: () => true
};

function current() {
  if (state.report && !state.running) return state.report.results;
  return rank([...state.results.values()]);
}

function render() {
  if (!state.target) return;
  const values = [...state.results.values()];
  const exist = values.filter(EXISTS).length;
  const live = values.filter((r) => r.status === "live").length;
  const yours = values.filter((r) => r.status === "known").length;
  $("#n-checked").textContent = state.running && state.total
    ? `${number(values.length)} / ${number(state.total)}`
    : number(values.length || state.total);
  $("#n-exist").textContent = number(exist);
  $("#n-live").textContent = number(live);
  $("#n-yours").textContent = number(yours);
  const pct = state.total ? values.length / state.total : 0;
  const meter = $(".meter");
  $("#meter-fill").style.setProperty("--p", String(state.running ? pct : 1));
  meter.setAttribute("aria-valuenow", String(Math.round((state.running ? pct : 1) * 100)));
  meter.toggleAttribute("data-done", !state.running);

  for (const b of document.querySelectorAll("[data-filter]")) b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter));

  renderOriginal();
  renderTechniques(values);
  renderRows();
}

function renderOriginal() {
  const box = $("#original");
  const o = state.original;
  box.textContent = "";
  const host = document.createElement("code");
  host.className = "host";
  host.dir = "ltr";
  host.textContent = o ? o.domain : state.target;
  box.append(host);
  if (!o) return;
  const dl = document.createElement("dl");
  const add = (label, list) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = list && list.length ? list.slice(0, 4).join(" ") : ui("nothing");
    dl.append(dt, dd);
  };
  add(ui("nameServers"), o.ns);
  add(ui("mailServers"), o.mx);
  box.append(dl);
}

/* Which techniques the lookalikes that exist were found with. */
function renderTechniques(values) {
  const counts = new Map();
  for (const r of values) if (EXISTS(r)) counts.set(r.algorithm, (counts.get(r.algorithm) || 0) + 1);
  const panel = $("#technique-panel");
  panel.hidden = !counts.size;
  if (!counts.size) return;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((sum, [, n]) => sum + n, 0);
  const rows = top.map(([id, n]) => [t("algorithm." + id + ".name", state.lang), n]);
  if (rest) rows.push([ui("otherTechniques"), rest]);
  const max = Math.max(...rows.map(([, n]) => n));
  const list = $("#by-technique");
  list.textContent = "";
  for (const [name, n] of rows) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const figure = document.createElement("span");
    figure.className = "n";
    figure.textContent = number(n);
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.style.setProperty("--w", String(n / max));
    li.append(label, figure, bar);
    list.append(li);
  }
}

/*
  Rows are keyed by domain and built once, so a result that comes back again
  keeps its element, its open details and its focus. Only rows that arrive
  during a run move in.
*/
function renderRows() {
  const list = $("#results");
  const active = list.contains(document.activeElement) ? document.activeElement : null;
  const held = active ? { domain: active.closest(".result")?.dataset.domain, link: active.matches("a") } : null;
  const shown = current().filter(FILTERS[state.filter]);
  const visible = shown.slice(0, state.limit);
  const wanted = visible.map((r) => rowFor(r));

  if (!wanted.length && state.running) {
    if (!list.querySelector(".skeleton")) list.replaceChildren(...[0, 1, 2].map(skeletonRow));
  } else {
    for (const el of list.querySelectorAll(".skeleton")) el.remove();
    wanted.forEach((el, i) => {
      const at = list.children[i] || null;
      if (at === el) return;
      /* moveBefore keeps focus and open state where the browser has it. */
      if (el.isConnected && list.moveBefore) list.moveBefore(el, at);
      else list.insertBefore(el, at);
    });
    while (list.children.length > wanted.length) list.lastElementChild.remove();
  }
  if (held && held.domain && document.activeElement !== active) {
    const kept = state.rows.get(held.domain);
    const target = kept && kept.el.isConnected ? kept.el.querySelector(held.link ? ".why a" : ".why summary") : null;
    if (target) target.focus({ preventScroll: true });
  }
  list.setAttribute("aria-busy", String(state.running));

  const empty = $("#empty");
  if (shown.length || state.running) {
    empty.hidden = true;
  } else {
    empty.hidden = false;
    empty.innerHTML = rich(state.filter === "found" && state.results.size ? ui("clean") : ui("emptyFilter"));
  }

  const more = $("#more");
  const line = $("#shown");
  const cut = shown.length > visible.length;
  more.hidden = !cut;
  line.hidden = !cut;
  if (cut) line.textContent = ui("shownOf", { shown: number(visible.length), total: number(shown.length) });
}

function rowFor(r) {
  const sig = [r.status, r.score, (r.reasons || []).length, r.age ? r.age.created : "", state.lang].join("|");
  const kept = state.rows.get(r.domain);
  if (kept && kept.sig === sig) return kept.el;
  const el = row(r);
  if (kept && kept.el.isConnected) kept.el.replaceWith(el);
  if (state.running && !state.arrived.has(r.domain) && !reduceMotion()) {
    el.classList.add("arrive");
    el.addEventListener("animationend", () => el.classList.remove("arrive"), { once: true });
  }
  state.arrived.add(r.domain);
  state.rows.set(r.domain, { sig, el });
  return el;
}

function skeletonRow() {
  const li = document.createElement("li");
  li.className = "result skeleton";
  li.setAttribute("aria-hidden", "true");
  li.innerHTML = '<span class="score"><span class="bone"></span></span><span class="body"><span class="bone"></span><span class="bone"></span></span><span class="status"><span class="bone"></span></span>';
  return li;
}

/* The strongest piece of evidence, to show beside the technique without opening the details. */
function headline(r) {
  const skip = new Set(["registered", "resolves", "mail"]);
  const best = (r.reasons || []).filter((x) => !skip.has(x.key)).sort((a, b) => (POINTS[b.key] || 0) - (POINTS[a.key] || 0))[0];
  return best ? reasonText(best, state.lang) : "";
}

function row(r) {
  const li = document.createElement("li");
  li.className = "result";
  li.dataset.domain = r.domain;

  const score = document.createElement("span");
  score.className = "score " + (EXISTS(r) ? r.level || "none" : "none");
  const said = document.createElement("span");
  said.className = "visually-hidden";
  said.textContent = ui("score") + " " + (EXISTS(r) ? "" : ui("nothing"));
  const n = document.createElement("span");
  n.className = "score-n";
  n.textContent = EXISTS(r) ? number(r.score) : "";
  score.append(said, n);

  const body = document.createElement("div");
  body.className = "body";
  const loupe = document.createElement("p");
  loupe.className = "loupe";
  loupe.dir = "ltr";
  fillLoupe(loupe, state.original ? state.original.domain : state.target, r.unicode);
  body.append(loupe);
  if (r.idn) {
    const ascii = document.createElement("span");
    ascii.className = "ascii";
    ascii.textContent = r.domain;
    body.append(ascii);
  }
  const meta = document.createElement("p");
  meta.className = "meta";
  const tech = t("algorithm." + r.algorithm + ".name", state.lang);
  const lead = EXISTS(r) ? headline(r) : "";
  meta.innerHTML = `<span class="tech">${escapeHtml(tech)}</span>${lead ? (state.lang === "ar" ? "، " : ", ") + rich(lead) : ""}`;
  body.append(meta);

  const status = document.createElement("span");
  status.className = "status " + r.status;
  status.textContent = t("status." + r.status, state.lang);

  li.append(score, body, status);

  if (r.status !== "absent" && r.status !== "unchecked") {
    const details = document.createElement("details");
    details.className = "why";
    if (state.open.has(r.domain)) details.open = true;
    details.addEventListener("toggle", () => {
      if (details.open) state.open.add(r.domain);
      else state.open.delete(r.domain);
    });
    const summary = document.createElement("summary");
    summary.textContent = ui("why");
    const inner = document.createElement("div");
    inner.className = "why-body";
    const ul = document.createElement("ul");
    for (const reason of r.reasons || []) {
      const item = document.createElement("li");
      item.innerHTML = rich(reasonText(reason, state.lang));
      ul.append(item);
    }
    const dl = document.createElement("dl");
    dl.className = "records";
    const d = r.dns || {};
    const add = (label, values) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = values && values.length ? values.join(" ") : ui("nothing");
      dl.append(dt, dd);
    };
    add(ui("addresses"), [...(d.a || []), ...(d.aaaa || [])]);
    add(ui("nameServers"), d.ns);
    add(ui("mailServers"), d.mx);
    const crt = document.createElement("a");
    crt.href = "https://crt.sh/?q=" + encodeURIComponent(r.domain);
    crt.target = "_blank";
    crt.rel = "noopener noreferrer";
    crt.innerHTML = rich(ui("certificates"));
    inner.append(ul, dl, crt);
    details.append(summary, inner);
    li.append(details);
  }
  return li;
}

function reportNow() {
  if (state.report && !state.running) return state.report;
  return {
    tool: "tawash",
    version: VERSION,
    kind: "scan",
    generated: new Date().toISOString(),
    target: state.target,
    original: state.original,
    results: current()
  };
}

function download(format) {
  if (!state.target) return;
  const text = serialise(reportNow(), format, { lang: state.lang, all: state.filter === "all" });
  const ext = { csv: "csv", json: "json", misp: "misp.json", stix: "stix.json" }[format];
  const type = format === "csv" ? "text/csv;charset=utf-8" : "application/json";
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tawash-${state.target}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function switchLang() {
  state.lang = state.lang === "ar" ? "en" : "ar";
  try {
    localStorage.setItem("tawash.lang", state.lang);
  } catch {
    /* private mode */
  }
  const url = new URL(location.href);
  if (state.lang === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  history.replaceState(null, "", url);
  /* A short crossfade hides the page turning from right to left. */
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(applyLang);
  else applyLang();
}

function wire() {
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.running) stop();
    else run($("#domain").value);
  });
  $("#lang").addEventListener("click", switchLang);
  $("#all-on").addEventListener("click", () => {
    document.querySelectorAll("#technique-list input").forEach((i) => { i.checked = true; });
    optionsState();
  });
  $("#all-off").addEventListener("click", () => {
    document.querySelectorAll("#technique-list input").forEach((i) => { i.checked = false; });
    optionsState();
  });
  $("#technique-list").addEventListener("change", optionsState);
  $("#all-tlds").addEventListener("change", optionsState);
  for (const b of document.querySelectorAll("[data-filter]")) {
    b.addEventListener("click", () => {
      if (state.filter === b.dataset.filter) return;
      state.filter = b.dataset.filter;
      state.limit = PAGE;
      render();
    });
  }
  $("#more").addEventListener("click", () => {
    state.limit += PAGE;
    render();
  });
  for (const b of document.querySelectorAll("[data-export]")) b.addEventListener("click", () => download(b.dataset.export));
  let copyTimer = 0;
  $("#copy").addEventListener("click", async () => {
    const copy = $("#copy");
    try {
      await navigator.clipboard.writeText(location.href);
      copy.textContent = ui("copiedButton");
      $("#live").textContent = ui("copied");
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copy.textContent = ui("copyLink"); }, 1600);
    } catch {
      /* clipboard refused, the address bar still has the link */
    }
  });
}

state.lang = initialLang();
wire();
applyLang();
const preset = new URLSearchParams(location.search).get("d");
if (preset) start(preset);
