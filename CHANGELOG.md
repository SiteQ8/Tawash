# Changelog

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
