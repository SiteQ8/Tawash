/*
  Host names: cleaning what people paste, splitting a name from its suffix, and
  refusing anything that could never exist in DNS.
*/
import { toASCII, toUnicode } from "./punycode.js";
import { SUFFIXES, FREE_HOSTS } from "./data.js";

/* Accepts a pasted URL, an email address or a bare name, and returns the host. */
export function clean(input) {
  let s = String(input == null ? "" : input).trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#\s]/)[0];
  s = s.replace(/^.*@/, "");
  s = s.replace(/:\d+$/, "");
  s = s.replace(/^\*\./, "").replace(/\.+$/, "");
  return s;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/* True when an ASCII host name follows the letters, digits and hyphen rule. */
export function isValidHost(host) {
  if (!host || host.length > 253) return false;
  const labels = host.split(".");
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!LABEL.test(label)) return false;
    if (label.slice(2, 4) === "--" && !label.startsWith("xn--")) return false;
  }
  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return false;
  if (tld.startsWith("xn--")) return tld.length > 4;
  return /^[a-z]{2,63}$/.test(tld);
}

const KNOWN = [...FREE_HOSTS, ...SUFFIXES].map((s) => s.split("."));

/*
  Splits a host into the part a person registers and the rest.
    online.example.com   sub "online", name "example", suffix "com"
    example.gov.kw       sub "", name "example", suffix "gov.kw"
    example-login.web.app  sub "", name "example-login", suffix "web.app"
  Returns null for anything that is not a host name.
*/
export function parse(input) {
  const cleaned = clean(input);
  if (!cleaned) return null;
  let ascii;
  try {
    ascii = toASCII(cleaned);
  } catch {
    return null;
  }
  if (!isValidHost(ascii)) return null;
  const labels = ascii.split(".");
  let size = 1;
  for (const parts of KNOWN) {
    if (parts.length <= size || parts.length >= labels.length) continue;
    if (labels.slice(-parts.length).join(".") === parts.join(".")) size = parts.length;
  }
  const suffix = labels.slice(-size).join(".");
  const name = labels[labels.length - size - 1];
  const sub = labels.slice(0, labels.length - size - 1).join(".");
  return {
    host: ascii,
    unicode: toUnicode(ascii),
    labels,
    sub,
    name,
    suffix,
    registrable: name + "." + suffix,
    free: FREE_HOSTS.includes(suffix)
  };
}

export function isUnder(host, domain) {
  const h = clean(host);
  const d = clean(domain);
  return h === d || h.endsWith("." + d);
}

/* The top level label, handy for scoring. */
export function tldOf(host) {
  const labels = clean(host).split(".");
  return labels[labels.length - 1] || "";
}
