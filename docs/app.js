/*
  The web finder. Everything runs in the visitor's browser: the search uses the
  same engine as the command line, DNS answers come from Google Public DNS or
  Cloudflare over HTTPS, and registration dates from RDAP.
  Nothing is sent to Tawash, because there is no Tawash server.
*/
import {
  ALGORITHMS, VERSION, t, reasonText, parse, diffMarks, toUnicode, scan, rank,
  dohResolver, rdapClient, serialise, hostList, POINTS
} from "./js/engine/index.js";

const $ = (s) => document.querySelector(s);
const MAX_ROWS = 600;

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
  frame: 0,
  last: 0
};

/* Our strings may hold code in backticks; everything else is escaped first. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function rich(text) {
  return escapeHtml(text).replace(/`([^`]*)`/g, '<code dir="ltr">$1</code>');
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
  setRunning(state.running);
  render(true);
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
}

function selectedTechniques() {
  return [...document.querySelectorAll("#technique-list input:checked")].map((i) => i.value);
}

function buildLegend() {
  const dl = $("#statuses");
  dl.textContent = "";
  for (const id of ["live", "registered", "known", "absent", "unknown"]) {
    const dt = document.createElement("dt");
    dt.innerHTML = `<span class="status ${id}">${escapeHtml(t("status." + id, state.lang))}</span>`;
    const dd = document.createElement("dd");
    dd.innerHTML = rich(t("statusAbout." + id, state.lang));
    dl.append(dt, dd);
  }
}

function setRunning(on) {
  state.running = on;
  const go = $("#go");
  go.textContent = on ? ui("stop") : ui("scan");
  go.classList.toggle("stop", on);
}

function showError(text) {
  const box = $("#error");
  box.innerHTML = text ? rich(text) : "";
  box.hidden = !text;
}

function note(text) {
  const box = $("#note");
  box.innerHTML = text ? rich(text) : "";
  box.hidden = !text;
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
  Object.assign(state, { results: new Map(), total: 0, target: p.host, original: null, report: null, open: new Set() });

  const url = new URL(location.href);
  url.searchParams.set("d", p.host);
  if (state.lang === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  history.replaceState(null, "", url);

  $("#run").hidden = false;
  $("#idle").hidden = true;
  setRunning(true);
  note(ui("learning", { domain: p.registrable }));
  render(true);

  try {
    const report = await scan(p.host, {
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
        note(o.exists === false ? ui("originalMissing", { domain: o.domain }) : "");
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
    else if (values.length > 10 && unknown === values.length) note(ui("dnsFailed"));
  } catch {
    note(ui("dnsFailed"));
  } finally {
    if (state.controller === controller) {
      setRunning(false);
      render(true);
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
    render(false);
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
  $("#n-checked").textContent = state.total ? `${number(values.length)} / ${number(state.total)}` : number(values.length);
  $("#n-exist").textContent = number(exist);
  $("#n-live").textContent = number(live);
  $("#n-yours").textContent = number(yours);
  const pct = state.total ? Math.round((values.length / state.total) * 100) : 0;
  $("#meter-fill").style.width = pct + "%";
  $(".meter").setAttribute("aria-valuenow", String(pct));

  const o = state.original;
  const originalBox = $("#original");
  if (o) {
    const parts = [`${escapeHtml(ui("original"))}: <code dir="ltr">${escapeHtml(o.domain)}</code>`];
    if (o.ns.length) parts.push(`${escapeHtml(ui("nameServers"))}: <code dir="ltr">${escapeHtml(o.ns.slice(0, 4).join(" "))}</code>`);
    if (o.mx.length) parts.push(`${escapeHtml(ui("mailServers"))}: <code dir="ltr">${escapeHtml(o.mx.slice(0, 2).join(" "))}</code>`);
    originalBox.innerHTML = parts.join("<br>");
  } else {
    originalBox.textContent = "";
  }

  for (const b of document.querySelectorAll("[data-filter]")) b.setAttribute("aria-selected", String(b.dataset.filter === state.filter));

  const shown = current().filter(FILTERS[state.filter]);
  const list = $("#results");
  list.textContent = "";
  const frag = document.createDocumentFragment();
  for (const r of shown.slice(0, MAX_ROWS)) frag.append(row(r));
  list.append(frag);

  const empty = $("#empty");
  if (shown.length) {
    empty.hidden = true;
  } else if (!state.running && state.filter === "found" && values.length) {
    empty.hidden = false;
    empty.innerHTML = rich(ui("clean"));
  } else if (!state.running) {
    empty.hidden = false;
    empty.innerHTML = rich(ui("emptyFilter"));
  } else {
    empty.hidden = true;
  }
}

/* The strongest piece of evidence, to show beside the technique without opening the details. */
function headline(r) {
  const skip = new Set(["registered", "resolves", "mail"]);
  const best = (r.reasons || []).filter((x) => !skip.has(x.key)).sort((a, b) => (POINTS[b.key] || 0) - (POINTS[a.key] || 0))[0];
  return best ? reasonText(best, state.lang) : "";
}

function loupe(r) {
  const p = document.createElement("p");
  p.className = "loupe";
  p.dir = "ltr";
  const from = toUnicode(state.original ? state.original.domain : state.target);
  const marks = diffMarks(from, r.unicode);
  for (const m of marks) {
    const span = document.createElement("span");
    span.textContent = m.ch;
    const cls = [m.changed ? "d" : "", m.gapBefore ? "gap" : "", m.gapAfter ? "gap-after" : ""].filter(Boolean).join(" ");
    if (cls) span.className = cls;
    p.append(span);
  }
  return p;
}

function row(r) {
  const li = document.createElement("li");
  li.className = "result";

  const score = document.createElement("span");
  score.className = "score " + (r.level || "none");
  score.textContent = EXISTS(r) ? number(r.score) : "";
  score.setAttribute("aria-label", ui("score") + " " + r.score);

  const body = document.createElement("div");
  body.append(loupe(r));
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
    const ul = document.createElement("ul");
    for (const reason of r.reasons || []) {
      const li2 = document.createElement("li");
      li2.innerHTML = rich(reasonText(reason, state.lang));
      ul.append(li2);
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
    details.append(summary, ul, dl, crt);
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

function wire() {
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.running) stop();
    else run($("#domain").value);
  });
  $("#lang").addEventListener("click", () => {
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
    applyLang();
  });
  $("#all-on").addEventListener("click", () => document.querySelectorAll("#technique-list input").forEach((i) => { i.checked = true; }));
  $("#all-off").addEventListener("click", () => document.querySelectorAll("#technique-list input").forEach((i) => { i.checked = false; }));
  for (const b of document.querySelectorAll("[data-filter]")) {
    b.addEventListener("click", () => {
      state.filter = b.dataset.filter;
      render(true);
    });
  }
  for (const b of document.querySelectorAll("[data-export]")) b.addEventListener("click", () => download(b.dataset.export));
  $("#copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      note(ui("copied"));
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
