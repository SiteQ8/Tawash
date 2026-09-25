/*
  Tables the search list, the matcher and the scorer read.

  Everything here is plain data. The web page and the command line load this
  same file, so they always agree on what a lookalike is.
*/

export const LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789";
export const VOWELS = "aeiou";

/*
  Keyboard rows with the physical stagger of each row, measured in key widths
  from the left edge. Two keys are neighbours when they touch: side by side in
  one row, or overlapping in the row above or below.
*/
const LAYOUTS = {
  qwerty: [["1234567890", 1], ["qwertyuiop", 1.5], ["asdfghjkl", 1.75], ["zxcvbnm", 2.25]],
  qwertz: [["1234567890", 1], ["qwertzuiop", 1.5], ["asdfghjkl", 1.75], ["yxcvbnm", 2.25]],
  azerty: [["1234567890", 1], ["azertyuiop", 1.5], ["qsdfghjklm", 1.75], ["wxcvbn", 2.25]]
};

function neighbours(rows) {
  const keys = [];
  rows.forEach(([row, start], r) => {
    [...row].forEach((ch, i) => keys.push({ ch, r, x: start + i + 0.5 }));
  });
  const map = {};
  for (const a of keys) {
    const near = new Set();
    for (const b of keys) {
      if (a === b) continue;
      if (b.r === a.r && Math.abs(b.x - a.x) === 1) near.add(b.ch);
      if (Math.abs(b.r - a.r) === 1 && Math.abs(b.x - a.x) < 1) near.add(b.ch);
    }
    map[a.ch] = [...near].sort().join("");
  }
  return map;
}

export const KEYBOARDS = Object.fromEntries(
  Object.entries(LAYOUTS).map(([id, rows]) => [id, neighbours(rows)])
);

/* Every key that sits next to ch on any of the three layouts. */
export function keyNeighbours(ch) {
  const out = new Set();
  for (const map of Object.values(KEYBOARDS)) {
    for (const n of map[ch] || "") out.add(n);
  }
  return [...out].sort();
}

/* Swaps that stay inside plain ASCII and still fool the eye. */
export const ASCII_GLYPHS = {
  o: ["0"], "0": ["o"],
  l: ["1", "i"], "1": ["l", "i"], i: ["1", "l"],
  g: ["q"], q: ["g"],
  u: ["v"], v: ["u"],
  m: ["rn", "nn"], w: ["vv"], d: ["cl"]
};

/* Two letters read as one. */
export const ASCII_PAIRS = { rn: "m", nn: "m", vv: "w", cl: "d" };

/*
  Letters from other scripts, and accented Latin letters, that pass for a plain
  Latin letter. Only lowercase code points that are valid in internationalised
  domain names are listed, so every result can really be registered somewhere.
*/
export const UNICODE_GLYPHS = {
  a: ["\u0430", "\u00e0", "\u00e1", "\u00e2", "\u00e4", "\u0251"],
  c: ["\u0441", "\u03f2", "\u00e7"],
  d: ["\u0501", "\u0257"],
  e: ["\u0435", "\u00e9", "\u00e8", "\u00ea", "\u00eb", "\u0117"],
  g: ["\u0261", "\u0121"],
  h: ["\u04bb", "\u0570"],
  i: ["\u0456", "\u00ed", "\u00ec", "\u00ef", "\u0131"],
  j: ["\u0458"],
  k: ["\u03ba", "\u043a"],
  l: ["\u04cf"],
  n: ["\u0578", "\u00f1", "\u0144"],
  o: ["\u043e", "\u03bf", "\u00f3", "\u00f2", "\u00f6", "\u00f5", "\u0585"],
  p: ["\u0440", "\u03c1"],
  q: ["\u051b"],
  r: ["\u0155"],
  s: ["\u0455", "\u015b", "\u0161"],
  t: ["\u0163"],
  u: ["\u057d", "\u00fc", "\u00fa", "\u00f9"],
  v: ["\u03bd", "\u0475"],
  w: ["\u0461", "\u051d"],
  x: ["\u0445"],
  y: ["\u0443", "\u00fd", "\u00ff"],
  z: ["\u017c", "\u017e", "\u01b6"]
};

/* Cyrillic twins, used to spell a whole name in one foreign script. */
export const CYRILLIC_TWINS = {
  a: "\u0430", c: "\u0441", d: "\u0501", e: "\u0435", h: "\u04bb", i: "\u0456",
  j: "\u0458", k: "\u043a", l: "\u04cf", o: "\u043e", p: "\u0440", q: "\u051b",
  s: "\u0455", w: "\u051d", x: "\u0445", y: "\u0443"
};

/* The reverse view: any lookalike character back to the Latin letter it imitates. */
export const CONFUSABLES = (() => {
  const map = {};
  for (const [latin, list] of Object.entries(UNICODE_GLYPHS)) {
    for (const ch of list) map[ch] = latin;
  }
  for (const [latin, ch] of Object.entries(CYRILLIC_TWINS)) map[ch] = latin;
  Object.assign(map, {
    "\u0432": "b", "\u043d": "h", "\u0442": "t", "\u043c": "m", "\u0433": "r",
    "\u03b1": "a", "\u03b5": "e", "\u03b9": "i", "\u03c4": "t", "\u03c5": "u", "\u03c7": "x"
  });
  return map;
})();

/* Digits and signs used in place of letters. */
export const LEET = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "$": "s", "@": "a" };

/* Words that sound the same. Only words of three letters or more are swapped inside a name. */
export const HOMOPHONES = [
  ["for", "four"], ["to", "two", "too"], ["one", "won"], ["eight", "ate"],
  ["right", "write", "rite"], ["buy", "by", "bye"], ["new", "knew"], ["no", "know"],
  ["sea", "see"], ["sun", "son"], ["mail", "male"], ["sale", "sail"], ["site", "sight", "cite"],
  ["pair", "pare", "pear"], ["peace", "piece"], ["plain", "plane"], ["rain", "reign", "rein"],
  ["road", "rode"], ["way", "weigh"], ["week", "weak"], ["wait", "weight"], ["meet", "meat"],
  ["flour", "flower"], ["hair", "hare"], ["hear", "here"], ["hole", "whole"], ["night", "knight"],
  ["not", "knot"], ["seen", "scene"], ["cell", "sell"], ["steal", "steel"], ["tail", "tale"],
  ["wear", "where"], ["main", "mane"], ["mall", "maul"], ["cent", "sent", "scent"],
  ["fare", "fair"], ["bare", "bear"], ["blue", "blew"], ["brake", "break"], ["dear", "deer"],
  ["die", "dye"], ["flu", "flew"], ["great", "grate"], ["hi", "high"], ["hour", "our"],
  ["idle", "idol"], ["key", "quay"], ["lone", "loan"], ["made", "maid"], ["mind", "mined"],
  ["pale", "pail"], ["pray", "prey"], ["principal", "principle"], ["rap", "wrap"],
  ["real", "reel"], ["role", "roll"], ["root", "route"], ["sole", "soul"], ["some", "sum"],
  ["stair", "stare"], ["suite", "sweet"], ["tea", "tee"], ["threw", "through"], ["toe", "tow"],
  ["vain", "vein"], ["waist", "waste"], ["ware", "wear"], ["wood", "would"], ["check", "cheque"],
  ["bank", "banc"], ["post", "poste"], ["pay", "paye"], ["cash", "cache"], ["gate", "gait"]
];

/* Common misspellings of words that turn up in Gulf brand domains. */
export const MISSPELLINGS = {
  kuwait: ["kuwiat", "kuwit", "kuweit", "kowait", "kuwayt", "kwait", "kuwaiit"],
  account: ["acount", "accout", "accunt"],
  online: ["onlin", "onine", "onlline"],
  secure: ["secur", "securre", "sercure"],
  service: ["servise", "sevice", "servce"],
  services: ["servises", "sevices", "servics"],
  payment: ["paymant", "payement", "paymnt"],
  banking: ["bankin", "bankng"],
  business: ["buisness", "bussiness", "busines"],
  government: ["goverment", "govenment"],
  ministry: ["minstry", "ministery"],
  airways: ["airway", "airwais", "airwayes"],
  finance: ["finanse", "finace"],
  national: ["nationl", "natinal"],
  commercial: ["comercial", "commerical"],
  international: ["internatonal", "internationl"],
  investment: ["investmnt", "invesment"],
  customs: ["costoms", "custms"],
  delivery: ["delievery", "delivry"],
  express: ["expres", "exspress"],
  mobile: ["mobil", "moble"],
  support: ["suport", "supprt"],
  login: ["logn", "loggin"],
  update: ["updte", "upadte"],
  verify: ["verfy", "verifiy"],
  gulf: ["gulff", "golf"],
  bank: ["bnak", "bamk"],
  house: ["hous", "huose"]
};

export const NUMBER_WORDS = {
  "0": ["zero"], "1": ["one"], "2": ["two"], "3": ["three"], "4": ["four"],
  "5": ["five"], "6": ["six"], "7": ["seven"], "8": ["eight"], "9": ["nine"]
};

/*
  Arabic names written in Latin letters drift in predictable ways, and scam
  domains lean on that drift. Each rule is applied once per variant.
*/
export const TRANSLITERATION = [
  ["ou", ["u", "oo", "o"]],
  ["oo", ["u", "ou"]],
  ["u", ["ou", "oo", "o"]],
  ["ee", ["i", "ie"]],
  ["ie", ["i", "ee"]],
  ["ei", ["ai", "ay"]],
  ["ai", ["ei", "ay", "ey"]],
  ["ay", ["ai", "ei"]],
  ["aa", ["a"]],
  ["q", ["g", "k"]],
  ["g", ["q"]],
  ["kh", ["k", "h"]],
  ["dh", ["th", "z", "d"]],
  ["th", ["dh", "t"]],
  ["sh", ["ch", "s"]],
  ["ch", ["sh"]],
  ["iya", ["iyah", "eya", "ia"]],
  ["ah", ["a"]]
];

/* Whole words with spellings no single rule reaches. */
export const TRANSLITERATION_WORDS = {
  kuwait: ["koweit", "kowait", "kuweit", "kuwayt", "quwait", "kwt"]
};

/* Common top level domains, the ones CIRCL and dnstwist also try first. */
export const COMMON_TLDS = [
  "com", "net", "org", "info", "biz", "co", "io", "me", "online", "site",
  "xyz", "top", "shop", "app", "live", "store", "cc", "vip", "club", "support"
];

/* Gulf endings a Kuwaiti name is most often moved to. */
export const GCC_SUFFIXES = [
  "kw", "com.kw", "net.kw", "org.kw", "sa", "com.sa", "ae", "co.ae",
  "qa", "com.qa", "bh", "com.bh", "om", "com.om"
];

/* Country codes appended after a whole domain, as in example.com.kw. */
export const ADD_TLDS = ["kw", "sa", "ae", "qa", "bh", "om", "co", "us", "uk", "in", "pk", "eg", "tr", "de", "cn"];

/* Suffixes with more than one label. Anything missing falls back to the last label. */
export const SUFFIXES = [
  "com.kw", "net.kw", "org.kw", "edu.kw", "gov.kw", "emb.kw", "ind.kw",
  "com.sa", "net.sa", "org.sa", "gov.sa", "edu.sa", "med.sa", "sch.sa",
  "co.ae", "net.ae", "org.ae", "gov.ae", "ac.ae", "sch.ae", "mil.ae",
  "com.qa", "net.qa", "org.qa", "gov.qa", "edu.qa",
  "com.bh", "net.bh", "org.bh", "gov.bh", "edu.bh",
  "com.om", "co.om", "net.om", "org.om", "gov.om", "edu.om", "med.om",
  "com.eg", "gov.eg", "com.jo", "gov.jo", "com.lb", "com.tr", "com.pk",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au",
  "co.nz", "co.jp", "co.in", "co.za", "com.br", "com.cn", "com.my", "com.sg"
];

/* Platforms that hand out free subdomains, which is where phishing kits tend to live. */
export const FREE_HOSTS = [
  "workers.dev", "pages.dev", "vercel.app", "netlify.app", "web.app", "firebaseapp.com",
  "glitch.me", "repl.co", "r2.dev", "ngrok.io", "ngrok-free.app", "github.io", "gitlab.io",
  "weebly.com", "wixsite.com", "blogspot.com", "000webhostapp.com", "onrender.com",
  "surge.sh", "webflow.io", "square.site", "azurewebsites.net", "herokuapp.com",
  "duckdns.org", "ddns.net", "no-ip.org", "hopto.org", "zapto.org", "sytes.net",
  "dynu.net", "freeddns.org", "dyndns.org", "myftp.org"
];

export const DYNAMIC_DNS = [
  "duckdns.org", "ddns.net", "no-ip.org", "hopto.org", "zapto.org",
  "sytes.net", "dynu.net", "freeddns.org", "dyndns.org", "myftp.org"
];

/* Cheap top level domains that carry more than their share of scam names. */
export const RISKY_TLDS = [
  "top", "xyz", "icu", "live", "online", "click", "shop", "buy", "site", "cyou",
  "sbs", "rest", "cfd", "bond", "quest", "monster", "beauty", "autos", "lol", "fit",
  "vip", "support", "info", "cc"
];

/* Lure words the search pairs with a name. Kept short on purpose. */
export const AFFIX_WORDS = [
  "kw", "q8", "kuwait", "online", "pay", "knet", "login", "secure", "update",
  "verify", "portal", "app", "services", "support", "gov", "my", "e"
];

export const KUWAIT_WORDS = ["kuwait", "kw", "q8", "kwt", "kuwaiti"];

/*
  Official names that are also everyday words somewhere, such as customs,
  manpower, or citra in Indonesian. On their own they match thousands of
  innocent names, so they only count when the name also points at Kuwait.
*/
export const GENERIC_WORDS = [
  "customs", "manpower", "citra", "sahel", "baladia", "mosa", "post", "express", "mobile",
  "central", "civil", "commercial", "national", "gulf", "airways", "finance", "bank", "online"
];

/* Tokens that turn a short brand into a scam name when they sit next to it, as in exb-com. */
export const DOT_WORDS = ["com", "net", "org", "gov", "edu", "co"];

/* Words that show what a scam page is for. They raise a score and never create one. */
export const LURE_WORDS = [
  "login", "signin", "verify", "verification", "validate", "update", "secure", "security",
  "account", "accounts", "payment", "payments", "pay", "knet", "fine", "fines", "violation",
  "violations", "wallet", "otp", "refund", "customs", "delivery", "parcel", "shipment",
  "invoice", "recovery", "unlock", "reactivate", "suspended", "confirm", "identity", "kyc",
  "fee", "fees", "renew", "renewal", "tracking", "track", "claim", "clearance", "shipping",
  "package", "tax", "vat", "court", "notice", "subsidy", "grant", "online", "portal",
  "service", "services", "support", "help", "alert", "alerts", "official", "gov", "bank", "banking"
];

/*
  Name servers and mail servers shared by huge numbers of unrelated domains.
  Sharing one of these proves nothing about who owns a lookalike.
*/
export const SHARED_NS = [
  "domaincontrol.com", "registrar-servers.com", "dns-parking.com", "parkingcrew.net",
  "sedoparking.com", "bodis.com", "dan.com", "afternic.com", "above.com", "cashparking.com",
  "namebrightdns.com", "hostinger.com", "dns.hostinger.com", "googledomains.com",
  "name-services.com", "dnsowl.com", "ns.cloudflare.com", "awsdns", "azure-dns",
  "nsone.net", "ultradns", "dynect.net", "wixdns.net", "squarespacedns.com", "hostgator.com",
  "bluehost.com", "siteground.net", "dreamhost.com", "gname.net", "share-dns", "dnspod.net",
  "hichina.com", "ovh.net", "ionos", "ui-dns", "digitalocean.com", "linode.com", "vultr.com"
];

/* Name servers of domain parking services. A parked name shows ads or a sale page, not a site of its own. */
export const PARKING_NS = [
  "sedoparking.com", "parkingcrew.net", "bodis.com", "above.com", "dan.com", "afternic.com",
  "dns-parking.com", "parklogic.com", "cashparking.com", "parkingspa.com", "ztomy.com",
  "namedrive.com", "undeveloped.com", "uniregistrymarket.link", "huge-domains.com", "hugedomains.com"
];

/*
  Mail hosts shared by every customer of a provider. A tenant specific host such
  as example-com.mail.protection.outlook.com is not listed, because sharing that
  one really does point at the same owner.
*/
export const SHARED_MX = [
  "google.com", "googlemail.com", "zoho.com", "zoho.eu", "secureserver.net", "yandex.net",
  "mailgun.org", "sendgrid.net", "amazonses.com", "registrar-servers.com", "privateemail.com",
  "mail.ovh.net", "titan.email", "hostinger.com", "improvmx.com", "forwardemail.net",
  "mimecast.com", "messagelabs.com", "protonmail.ch", "icloud.com", "yahoodns.net",
  "olc.protection.outlook.com"
];
