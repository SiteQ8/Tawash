/*
  Punycode (RFC 3492) and the label wrapping around it.

  Browsers and Node both punycode host names, but each in its own way and only
  inside URL parsing. Lookalike work needs the raw conversion in both places, so
  it lives here once.
*/

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function adapt(delta, points, first) {
  let k = 0;
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / points);
  while (delta > ((BASE - T_MIN) * T_MAX) >> 1) {
    delta = Math.floor(delta / (BASE - T_MIN));
    k += BASE;
  }
  return Math.floor(k + ((BASE - T_MIN + 1) * delta) / (delta + SKEW));
}

function digitToChar(d) {
  return String.fromCharCode(d < 26 ? d + 97 : d + 22);
}

function charToDigit(code) {
  if (code >= 48 && code <= 57) return code - 22;
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97;
  return BASE;
}

function threshold(k, bias) {
  if (k <= bias) return T_MIN;
  if (k >= bias + T_MAX) return T_MAX;
  return k - bias;
}

export function encode(input) {
  const points = Array.from(input, (c) => c.codePointAt(0));
  const out = [];
  for (const p of points) if (p < 128) out.push(String.fromCharCode(p));
  const basic = out.length;
  let handled = basic;
  if (basic) out.push("-");
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (handled < points.length) {
    let m = Infinity;
    for (const p of points) if (p >= n && p < m) m = p;
    delta += (m - n) * (handled + 1);
    n = m;
    for (const p of points) {
      if (p < n) delta++;
      if (p === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = threshold(k, bias);
          if (q < t) break;
          out.push(digitToChar(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        out.push(digitToChar(q));
        bias = adapt(delta, handled + 1, handled === basic);
        delta = 0;
        handled++;
      }
    }
    delta++;
    n++;
  }
  return out.join("");
}

export function decode(input) {
  const out = [];
  const cut = input.lastIndexOf("-");
  const basic = cut < 0 ? 0 : cut;
  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j);
    if (code >= 128) throw new RangeError("not a punycode string");
    out.push(code);
  }
  let i = 0;
  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  for (let at = basic > 0 ? basic + 1 : 0; at < input.length; ) {
    const old = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (at >= input.length) throw new RangeError("not a punycode string");
      const digit = charToDigit(input.charCodeAt(at++));
      if (digit >= BASE) throw new RangeError("not a punycode string");
      i += digit * w;
      const t = threshold(k, bias);
      if (digit < t) break;
      w *= BASE - t;
    }
    const size = out.length + 1;
    bias = adapt(i - old, size, old === 0);
    n += Math.floor(i / size);
    i %= size;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

const NON_ASCII = /[^\u0000-\u007f]/;

/* One label or a whole host name, Unicode in, ASCII out. */
export function toASCII(host) {
  return String(host)
    .split(".")
    .map((label) => {
      const lower = label.normalize("NFC").toLowerCase();
      return NON_ASCII.test(lower) ? "xn--" + encode(lower) : lower;
    })
    .join(".");
}

/* ASCII in, Unicode out. A label that does not decode is left as it is. */
export function toUnicode(host) {
  return String(host)
    .split(".")
    .map((label) => {
      if (!label.toLowerCase().startsWith("xn--")) return label;
      try {
        return decode(label.slice(4).toLowerCase());
      } catch {
        return label;
      }
    })
    .join(".");
}

export function isIdn(host) {
  return String(host).split(".").some((label) => label.toLowerCase().startsWith("xn--"));
}
