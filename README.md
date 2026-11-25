# EHV Diagnostic Portal — 400 kV Karjat S/s

A static web portal (no server, no build step) for EHV substation diagnostic test data. It:

- evaluates every reading against **MSETCL circular No. 06961 dated 18 Oct 2024**, and lets you open the **scanned circular row** behind each rule;
- compares the circular with **IEC / IEEE / CIGRE practice**;
- turns readings into **findings** (Critical / Alert / Watch / Info), each citing its basis;
- builds the **test schedule** (overdue / due within 120 days) from the last test date + the circular frequency.

## Run locally

```bash
cd trial
python3 -m http.server 8000      # then open http://localhost:8000
```

Opening `index.html` directly as a file will not work: browsers block `fetch()` of the JSON files.
On GitHub Pages it is served at `/<repo>/`.

## Refresh data from the Google Sheet

1. Google Sheets → File → Download → Microsoft Excel (.xlsx)
2. `pip install openpyxl`
3. `python3 tools/extract_workbook.py Diagnostic_Test_Data_Karjat.xlsx data/karjat.json`

The extractor reads the flat `DB BUSHING TAND` / `DB WINDING TAND` sheets, the bay-block sheets
(CT, CB CRM, CB timing, LA) and all 23 DGA sheets. Text typed into numeric cells, and physically
impossible rows (for example drag-fill artefacts with negative tan δ on future bays 412/415), are
logged under **Data & sources** and kept out of the analysis.

## Files

| Path | What |
|---|---|
| `data/karjat.json` | Normalised test records (generated) |
| `data/norms.json` | Circular, transcribed row-by-row from the scan, with pixel coordinates of each row; includes the list of corrections to the earlier `msetcl_test_frequency_2024.json` |
| `data/standards.json` | Industry references. Items tagged `verify` must be checked against the licensed standard before they become alarm limits |
| `assets/circular/` | Scanned circular pages, rotated upright |
| `js/data.js` | Data layer. The single place to swap JSON for a database |
| `js/rules.js` | Engineering rules |
| `js/health.js` | Transformer Health Index (weighted factors, worst factor governs) |
| `js/sld.js` | Single-line diagrams: 400 kV one-and-a-half breaker, 220 kV double main + transfer |
| `js/icons.js` | SVG icon set (IEC 60617-style equipment symbols) |
| `js/app.js`, `js/ui.js` | Views, charts with limit zones, Duval Triangle, command palette (Ctrl K), circular viewer |
| `vendor/` | Chart.js 4.4.1 (MIT), bundled so the portal also works on an intranet without internet |

## Roadmap

Database (Supabase/Postgres) → data-entry forms with attachments → remaining circular tests
(IR/PI, SFRA, DFR, PT, CVT, DCRM, relays, battery …) → multi-substation roll-up → rule thresholds
editable by S.E. PAC.
