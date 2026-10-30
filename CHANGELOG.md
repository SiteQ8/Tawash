# Changelog

## 1.2.0 (2026-10-30)

- A new design for the page at https://tawash.3li.info/. The night palette is calmer, a single brass line marks the current choice, and Reem Kufi is kept for the wordmark alone.
- Each domain reads through a loupe that lifts only what differs from the original, as whole runs of characters, so `secure-example.com` shows `secure-` added rather than scattered letters. A letter from another alphabet names its script when you point at it.
- Before anything is searched, the page shows how a result reads, on the domains reserved for examples.
- The counts are the filters: each count is a button that shows its results.
- While a search runs, results keep their place and any open details, and only new rows arrive with motion. Long lists show 600 at a time, with a button for more.
- A panel counts the results by technique. On wide screens the downloads, the original domain and that panel stay beside the list.
- The options say how many techniques are on, dates never break across two lines, and all motion follows the system setting for reduced motion.
- The share picture and the icon use the flat pearl of the page.

## 1.1.0 (2026-09-25)

- The search for other endings can now cover every top level domain IANA lists, about 1,400, with `--all-tlds` on the command line or the matching option on the page. The list is read live from IANA each time.
- A disclaimer on the page and in both READMEs: Tawash is a tool for demonstration and testing, provided as is, without warranty and without liability.
- The repository runs nothing on its own. CI only runs when started by hand, and the GitHub Actions example for the daily watch is replaced by a cron example for a machine you control.

## 1.0.1 (2026-09-25)

- Tawash is described as what it is, a threat intelligence tool that searches for lookalike domains, on the page, in the help and in both READMEs.
- The command that lists the names a scan searches for is now `candidates`, and `watch --sweep` replaces the old option for sweeping the lookalikes of official domains.

## 1.0.0 (2026-09-25)

First release.

- Web finder at https://tawash.3li.info/, in Arabic and English, running entirely in the browser over DNS over HTTPS and RDAP.
- Command line with `scan`, `permute`, `nrd`, `ct`, `watch` and `algorithms`, installable with `npx github:SiteQ8/Tawash` and free of dependencies.
- Twenty four lookalike techniques: every technique CIRCL's typosquatting finder documents, plus Latin spellings of Arabic names, Kuwait lure words and Gulf endings.
- Matching of the daily newly registered domains list from WhoisDS and of certificate transparency logs through crt.sh, with a watchlist taken from the Asli registry.
- Scores that explain themselves, registration dates from RDAP, automatic recognition of lookalikes the brand already owns, and parked and lame names labelled as such.
- Exports to CSV, JSON, MISP, STIX 2.1 and Markdown.
