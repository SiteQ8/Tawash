<p align="center"><img src="docs/og.png" alt="Tawash, lookalike domain finder for Kuwait" width="760"></p>

# Tawash (طوّاش)

Tawash is a threat intelligence tool that finds the lookalike domains made to pass for Kuwait's real ones. Give it a domain and it searches DNS for the lookalikes registered against it: typos, swapped letters, foreign characters and Latin spellings of Arabic names. It also watches the daily list of newly registered domains and the certificate transparency logs for names that borrow an official Kuwaiti brand.

[اقرأ بالعربية](README.ar.md)

Try it in the browser at **https://tawash.3li.info/**, or from a terminal:

```sh
npx github:SiteQ8/Tawash scan example.com
```

It needs Node.js 20 or newer and nothing else. There are no dependencies to install.

## Why the name

In Kuwait's pearling days the tawash was the pearl merchant who sailed out to the diving ships and examined every pearl before he paid for it. Tawash examines domains the same way, looking for the ones made to pass for the real thing.

## What it does

Tawash brings two well known approaches together and tunes them for Kuwait.

The first searches for the registered lookalikes of one domain, the way CIRCL's typosquatting finder does. Tawash covers every technique CIRCL documents and adds three that matter here: Latin spellings of Arabic names (souq, souk and suq), the lure words scammers in Kuwait glue to a brand (kw, q8, knet, pay, login), and the Gulf endings a name gets moved to (com.kw, gov.kw, sa, ae). It learns the original's name and mail servers on its own, so lookalikes the brand already owns are marked as yours instead of raising an alarm, and it reads each lookalike's registration date from RDAP, because a name registered last week matters more than one registered in 1996.

The second watches what is being registered, the way openSquat does. Every day WhoisDS publishes around seventy thousand newly registered domains, and every public TLS certificate lands in certificate transparency logs. Tawash matches both against a watchlist, which can be every official body in the [Asli registry](https://asli.3li.info/) with a single flag.

The same engine runs in the browser and on the command line. The web finder needs no server: your browser asks DNS itself.

## Commands

### `scan <domain>`

Searches DNS for the registered lookalikes of a domain, reads their registration dates, scores what it finds and prints the ones worth a look.

```sh
npx github:SiteQ8/Tawash scan example.com
npx github:SiteQ8/Tawash scan example.gov.kw --web --certs --format csv --out report.csv
npx github:SiteQ8/Tawash scan example.com.kw --lang ar
```

`--web` fetches every live lookalike, compares its page title with the original's and looks for the organisation's name on the page (names come from the Asli registry and from `--claim`). `--certs` asks Cert Spotter for certificates issued in the last thirty days. Both contact the lookalikes or third parties, so they only run when asked for.

### `candidates <domain>`

Lists the names a scan searches for without looking any of them up, which is useful for feeding a blocklist or another tool.

```sh
npx github:SiteQ8/Tawash candidates example.com --format json
```

### `nrd`

Downloads yesterday's list of newly registered domains from WhoisDS and matches it against a watchlist. Add `--dns` to check the matches.

```sh
npx github:SiteQ8/Tawash nrd --asli --dns
npx github:SiteQ8/Tawash nrd --keywords examples/keywords.txt --date 2026-09-24
npx github:SiteQ8/Tawash nrd --keyword examplebank --feed domain-names.zip
```

### `ct <keyword>`

Searches certificate transparency logs through crt.sh for names that carry a brand. Brands of three letters or fewer are searched with Kuwait attached, because on their own they match half the internet. crt.sh is often overloaded, so every query is retried, and when it stays down Tawash says so and exits with code 4 instead of reporting a clean result.

```sh
npx github:SiteQ8/Tawash ct examplebank --days 7 --dns
```

### `watch`

The daily run: `nrd`, then `ct` with `--ct`, then a DNS sweep for lookalikes of every official domain with `--sweep`, all checked in DNS and written to a folder as JSON and Markdown. Names that reach `--alert-at` and were not alerted before go to `alert.md`, so a scheduled job can open an issue only when something new turns up. The folder remembers what it has alerted as hashes, so the state file names nobody.

```sh
npx github:SiteQ8/Tawash watch --asli --ct --out reports
```

### `algorithms`

Lists the impersonation techniques Tawash searches for, with a line on each.

## Watchlist

`nrd`, `ct` and `watch` need to know what to look for.

| Option | What it adds |
|---|---|
| `--asli` | every official body in the Asli registry: brand tokens, official domains and the names each body goes by |
| `--keywords <file>` | one brand token or domain per line, `#` starts a comment |
| `--keyword <word>` | a single brand token, repeatable |

Official domains are never reported, and their names become keywords too. Names that are everyday words somewhere (customs, manpower, citra) only count when the domain also points at Kuwait.

## Options

| Option | Meaning |
|---|---|
| `--format <f>` | `table`, `json`, `csv`, `misp`, `stix` or `md` |
| `--out <path>` | write to a file, or to a folder for `watch` |
| `--lang <en\|ar>` | language of statuses and reasons |
| `--algorithms <list>` | comma separated techniques for `scan` and `candidates` |
| `--all` | show every lookalike, not only the ones that exist |
| `--doh <google\|cloudflare>` | resolve over DNS over HTTPS instead of the system resolver |
| `--resolver <ip,ip>` | use these DNS servers |
| `--concurrency <n>` | parallel lookups, 32 by default and 8 with `--doh` |
| `--known-ns <list>` | name servers that are yours |
| `--known-mx <list>` | mail servers that are yours |
| `--exclude <file>` | domains to leave out, one per line |
| `--web` | fetch live lookalikes and compare their pages with the original |
| `--certs` | look up recent certificates of live lookalikes |
| `--claim <text>` | a name the organisation goes by, looked for on lookalike pages, repeatable |
| `--no-age` | skip registration dates from RDAP |
| `--sweep` | `watch` also sweeps DNS for lookalikes of every official domain |
| `--date <yyyy-mm-dd>` | day of the newly registered list, yesterday by default |
| `--feed <file>` | read newly registered domains from a text or zip file |
| `--confidence <0-4>` | 0 is strictest and 4 finds most, 1 by default |
| `--dns` | check `nrd` and `ct` matches in DNS |
| `--ct` | include certificate logs in `watch` |
| `--days <n>` | how far back certificate logs go, 3 by default |
| `--alert-at <score>` | `watch` writes `alert.md` when a score reaches this, 50 by default |
| `--fail-on <score>` | exit with code 3 when a score reaches this |
| `--version` | print the version |
| `--help` | print the help, in Arabic with `--lang ar` |

Exit codes: 0 done, 1 error, 2 wrong usage, 3 a score reached `--fail-on`, 4 the data source could not be reached.

## Techniques

| Technique | What it does | Example |
|---|---|---|
| `homoglyph` | letters that look alike, including Cyrillic and Greek ones | `example.com` to `examp1e.com` or `exаmple.com` |
| `transliteration` | other Latin spellings of an Arabic name | `souq.example` to `souk.example` or `suq.example` |
| `kuwait-affix` | the name glued to lure words scammers in Kuwait use | `example.com` to `example-kw.com` or `knetexample.com` |
| `omission` | one letter left out | `example.com` to `exmple.com` |
| `repetition` | one letter typed twice | `example.com` to `exxample.com` |
| `transposition` | two neighbouring letters swapped | `example.com` to `exmaple.com` |
| `replacement` | a letter replaced by a neighbouring key on QWERTY, QWERTZ or AZERTY | `example.com` to `exanple.com` |
| `double-replacement` | a doubled letter replaced by a neighbouring key, both times | `summer.example` to `sunner.example` |
| `vowel-swap` | a vowel swapped for another, the first letter left alone | `example.com` to `exomple.com` |
| `addition` | one extra letter or digit | `example.com` to `example1.com` |
| `add-dash` | a hyphen added inside the name | `example.com` to `exam-ple.com` |
| `strip-dash` | a hyphen taken out | `my-example.com` to `myexample.com` |
| `plural` | the name made plural or singular | `example.com` to `examples.com` |
| `misspelling` | common misspellings of English words in the name, Kuwait included | `kuwait-example.com` to `kuwiat-example.com` |
| `homophones` | words that sound the same | `buy-example.com` to `bye-example.com` |
| `numeral-swap` | digits written as words and words as digits | `example-one.com` to `example-1.com` |
| `subdomain` | a dot inside the name, so part of the brand becomes a subdomain | `example.com` to `exam.ple.com` |
| `missing-dot` | a dot left out | `example.com` to `wwwexample.com` |
| `dot-to-dash` | a dot turned into a hyphen | `example.gov.kw` to `example-gov-kw.com` |
| `wrong-sld` | another second level ending | `example.gov.kw` to `example.com.kw` |
| `wrong-tld` | another top level ending, Gulf ones included | `example.com` to `example.com.kw` or `example.xyz` |
| `add-tld` | a country code added after the whole domain | `example.com` to `example.com.ae` |
| `dynamic-dns` | the name under free dynamic DNS services | `example.com` to `example.duckdns.org` |
| `bitsquatting` | one bit flipped, the error a faulty memory chip makes | `example.com` to `exampde.com` |

## Statuses and score

| Status | Meaning |
|---|---|
| Live | answers with a web address, so a site can run on it |
| Registered | exists in DNS with no web address yet, or its name servers do not answer |
| Yours | shares name or mail servers with the original, so it most likely has the same owner |
| Not found | nobody has registered it |
| Unknown | the lookup failed twice |

The score adds up evidence and every point comes with a reason you can check. It says where to look first, not whether a site is a scam. Most short names were registered decades ago by people with no interest in Kuwait, and nearly all of them answer on the web and take mail, so those facts earn little while intent and recency earn the most.

| Evidence | Points |
|---|---|
| exists in DNS | 10 |
| has a web address | 10 |
| can receive email | 10 |
| lure words in the name | 25 |
| points at Kuwait in the name | 20 |
| letters from other alphabets | 25 |
| a cheap ending common in scams | 10 |
| free hosting | 15 |
| one character away from the original | 5 |
| registered in the last 30 days | 30 |
| registered in the last year | 15 |
| newly registered, from the daily list | 30 |
| seen in certificate logs | 15 |
| page title resembles the original's | 25 |
| page names the organisation | 30 |
| recent TLS certificate | 15 |

70 and above is high, 40 and above is medium. A parked name keeps its other evidence but earns nothing for the parking service's addresses.

## What counts as yours

A lookalike is marked as yours only on evidence that is hard to fake: its name servers sit inside the original domain (ns1.example.com), it has exactly the original's name servers and they are not a registrar's shared ones, it uses one of the original's mail hosts and that host is tenant specific, or it uses a server you listed with `--known-ns` or `--known-mx`. Sharing GoDaddy's name servers or Google's mail hosts proves nothing, so it does not count.

## Output formats

| Format | For |
|---|---|
| `table` | people, in a terminal |
| `json` | scripts, the whole report |
| `csv` | spreadsheets, with a byte order mark for Excel and formulas neutralised, because page titles come from strangers |
| `misp` | a MISP event with `to_ids` false, `tlp:amber` and `workflow:state="incomplete"` |
| `stix` | a STIX 2.1 bundle of domain and address observables with deterministic identifiers, never indicators |
| `md` | a Markdown report for an issue or an email |

## A daily watch in a private repository

[examples/watch-workflow.yml](examples/watch-workflow.yml) runs `watch` every morning on GitHub Actions and opens an issue when `alert.md` appears. Put it in a **private** repository. A name that borrows a brand is not yet a scam, and publishing an unreviewed accusation is unfair to whoever owns it, so candidates belong in a place where a person reviews them first. Pin the version tag, as the example does, so the job runs code you have read.

## Privacy and responsible use

The web finder sends each lookalike name from your browser to Google Public DNS, or to Cloudflare when Google does not answer, and asks RDAP registries for registration dates. Nothing goes to Tawash, and lookalikes are shown as text, never as links. The command line uses your own resolver unless you pass `--doh`.

Tawash is for defending a brand and its customers. Checking whether names exist is public DNS work, but `--web` does contact the sites, some of which may belong to scammers, so run it from a network where that is acceptable. See [SECURITY.md](SECURITY.md) to report a problem.

## Where it comes from

Tawash stands on the ideas of [openSquat](https://github.com/atenreiro/opensquat) by Andre Tenreiro and the [typosquatting finder](https://typosquatting-finder.circl.lu/) by CIRCL. The technique catalogue follows CIRCL's documentation. No code was copied from either.

Data comes from [WhoisDS](https://www.whoisds.com/newly-registered-domains) (newly registered domains), [crt.sh](https://crt.sh/) and [Cert Spotter](https://sslmate.com/certspotter/) (certificates), IANA's [RDAP bootstrap](https://data.iana.org/rdap/dns.json) and the registries it lists (registration dates), [Google Public DNS](https://developers.google.com/speed/public-dns/docs/doh/json) and [Cloudflare](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/) (DNS over HTTPS), and the [Asli registry](https://asli.3li.info/) of Kuwait's official channels.

## Development

```sh
node --test                        # every test, no network needed
node scripts/sync-web.mjs          # copy src/engine into docs/js/engine after changing the engine
node scripts/sync-web.mjs --check  # what CI runs
```

`src/engine` runs unchanged in Node and in the browser, and `docs/js/engine` is a byte for byte copy that the tests hold in step. `src/node` holds what only Node can do: the system resolver, zip files, the daily list, certificate logs and page checks. Every string lives in `src/engine/strings.js` in English and Arabic, and the tests fail when one language lacks a string, when placeholders differ, or when the Arabic breaks its punctuation rules.

## Licence

MIT. See [LICENSE](LICENSE).
