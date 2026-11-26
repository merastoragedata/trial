#!/usr/bin/env python3
"""Extract the Karjat diagnostic Google-Sheet export (.xlsx) into normalized JSON.

Usage:  python3 tools/extract_workbook.py Diagnostic_Test_Data_Karjat.xlsx data/karjat.json

Every record has the same shape regardless of test:
  {t: test key, unit: equipment id, pos: sub-position, ph: phase, date: ISO,
   ses: FY session, v: {measured values}, rem: remark, src: "sheet!row"}
Values that the sheet holds as fractions (corrected tan delta) are converted to %.
Text placed in numeric cells (e.g. "Rain! Couldn't be tested", "NO VALUE") is kept
as a remark and listed in `issues` so data-quality problems stay visible.
"""
import sys, json, re, datetime
import openpyxl

ISSUES = []
POP = {}   # test -> set of (bay, phase) blocks present in the sheet (equipment population)

def num(x):
    if x is None or x == '': return None
    if isinstance(x, (int, float)): return float(x)
    s = str(x).strip()
    try: return float(s)
    except ValueError: return None

def iso(x):
    if isinstance(x, datetime.datetime): return x.date().isoformat()
    if isinstance(x, datetime.date): return x.isoformat()
    if isinstance(x, str):
        m = re.match(r'(\d{1,2})[./-](\d{1,2})[./-](\d{4})', x.strip())
        if m: return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    return None

def txt(x):
    return re.sub(r'\s+', ' ', str(x)).strip() if x not in (None, '') else ''

def note_text_in_numbers(sheet, row, vals):
    for k, x in vals.items():
        if isinstance(x, str) and x.strip() and num(x) is None:
            ISSUES.append({'src': f'{sheet}!{row}', 'field': k, 'text': txt(x)})
            return txt(x)
    return ''

def session_of(d):
    if not d: return ''
    y, m = int(d[:4]), int(d[5:7])
    s = y if m >= 4 else y - 1
    return f"{s}-{str(s+1)[2:]}"

UNIT_ALIASES = [
    (r'SPARE', 'SPARE_ICT'), (r'REACTOR', 'BUS_REACTOR'),
    (r'ICT\s*-?\s*1', 'ICT1'), (r'ICT\s*-?\s*2', 'ICT2'),
]
def unit_of(s):
    s = s.upper()
    for pat, u in UNIT_ALIASES:
        if re.search(pat, s): return u
    return s

def phase_of(s):
    m = re.search(r'\b([RYB])\s*-?\s*PH', s.upper())
    return m[1] if m else ''

# ---------------------------------------------------------------- flat DB sheets
def bushing(wb, out):
    ws = wb['DB BUSHING TAND']
    for i, r in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
        if not r[0] or not iso(r[4]): continue
        name = txt(r[0]).upper()
        unit = unit_of(name)
        pos = name.split('-', 1)[1].strip() if '-' in name and unit != 'BUS_REACTOR' else ''
        if unit == 'SPARE_ICT': pos = name.replace('SPARE ICT', '').strip('- ')
        rem = note_text_in_numbers('DB BUSHING TAND', i, {'C': r[6], 'tand': r[7]})
        out.append({'t': 'bushing', 'unit': unit, 'pos': pos, 'ph': txt(r[2]) or '-',
            'date': iso(r[4]), 'ses': txt(r[3]) or session_of(iso(r[4])),
            'v': {'C': num(r[6]), 'tand': num(r[7]), 'U': num(r[8]), 'I': num(r[9]), 'phi': num(r[10]),
                  'P': num(r[11]), 'F': num(r[12]), 'temp': num(r[13]),
                  'tand20': round(num(r[14]) * 100, 4) if num(r[14]) else None},
            'mk': txt(r[1]), 'rem': rem, 'src': f'DB BUSHING TAND!{i}'})

def winding(wb, out):
    ws = wb['DB WINDING TAND']
    for i, r in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
        if not r[0] or not iso(r[5]): continue
        name = txt(r[0])
        mode = re.sub(r'\s+', '', txt(r[3]).split('-')[0])  # UST / GST / GSTg
        acting = txt(r[3]).split('-', 1)[1].strip() if '-' in txt(r[3]) else txt(r[3])
        acting = re.sub(r'\s+', '', acting).replace('[', '').replace(']', '')
        rem = note_text_in_numbers('DB WINDING TAND', i, {'C': r[6], 'tand': r[7]})
        out.append({'t': 'winding', 'unit': unit_of(name), 'pos': txt(r[2]) or 'HV-E',
            'ph': phase_of(name) or '-', 'mode': mode, 'acting': acting,
            'date': iso(r[5]), 'ses': txt(r[4]) or session_of(iso(r[5])),
            'v': {'C': num(r[6]), 'tand': num(r[7]), 'U': num(r[8]), 'I': num(r[9]), 'phi': num(r[10]),
                  'P': num(r[11]), 'F': num(r[12]), 'temp': num(r[13]),
                  'tand20': round(num(r[14]) * 100, 4) if num(r[14]) else None},
            'rem': rem, 'src': f'DB WINDING TAND!{i}'})

# ---------------------------------------------------------------- bay block sheets
def blocks(wb, sheet, t, hdr_row, fields, date_col=7, ses_col=6, rem_col=None, season_col=None):
    """Bay-wise block sheets: bay id in col A on the first row of each phase block,
    phase in col F, then one row per test session. Remarks may sit on rows without a date."""
    ws = wb[sheet]
    bay = None; ph = None; last = None
    for i, r in enumerate(ws.iter_rows(min_row=hdr_row + 1, values_only=True), start=hdr_row + 1):
        if num(r[0]) is not None: bay = int(num(r[0]))
        if txt(r[5]) in ('R', 'Y', 'B'):
            ph = txt(r[5]); last = None
            if bay is not None: POP.setdefault(t, set()).add((str(bay), ph))
        d = iso(r[date_col])
        rem = txt(r[rem_col]) if rem_col is not None and rem_col < len(r) else ''
        if rem.lower() in ('hello', 'test'): rem = ''  # placeholder text left in the sheet
        if not d:
            if rem and last is not None:
                last['rem'] = (last['rem'] + '; ' if last['rem'] else '') + rem
            continue
        raw = {k: r[c] for k, c in fields.items()}
        vals = {k: num(x) for k, x in raw.items()}
        bad = note_text_in_numbers(sheet, i, raw)
        if all(v is None for v in vals.values()) and not bad and season_col is None:
            # a dated row with nothing measured: kept (not a completed test) because the sheet
            # counts its date for the next-due date, exactly as printed in the PDF
            rem = rem or 'No reading recorded in the sheet'
        rec = {'t': t, 'unit': str(bay), 'pos': '', 'ph': ph or '-', 'date': d,
               'ses': txt(r[ses_col]) or session_of(d), 'v': vals,
               'rem': '; '.join(x for x in (bad, rem) if x), 'src': f'{sheet}!{i}'}
        if season_col is not None: rec['season'] = txt(r[season_col])
        out_list.append(rec); last = rec

def bay_names(wb):
    names = {}
    for r in wb['Sheet2'].iter_rows(min_row=3, values_only=True):
        if num(r[4]) is not None and r[5]:
            m = re.sub(r'^BAY\s*-\s*\d+\s*-\s*', '', txt(r[5]))
            names[str(int(num(r[4])))] = m
    names.setdefault('201', '220 kV FUTURE BAY 1')
    return names

def la_220(wb, out):
    """220 kV LA readings live in sheet 'w' (the 220 kV LA results sheet is empty)."""
    ws = wb['w']; bay = None; ph = None
    for i, r in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
        if r[0]:
            m = re.search(r'BAY\s*-\s*(\d+)', txt(r[0]))
            if m: bay = m[1]
        if txt(r[1]) in ('R', 'Y', 'B'):
            ph = txt(r[1])
            if bay: POP.setdefault('la', set()).add((bay, ph))
        d = iso(r[2])
        if not d or not bay: continue
        raw = {'Ith': r[4], 'Icorr': r[5], 'Itotal': r[6]}
        vals = {k: num(x) for k, x in raw.items()}
        bad = note_text_in_numbers('w', i, raw)
        if all(v is None for v in vals.values()) and not bad and not r[7] and not r[3]: continue
        out.append({'t': 'la', 'unit': bay, 'pos': '', 'ph': ph or '-', 'date': d,
            'ses': session_of(d), 'season': txt(r[3]), 'v': vals,
            'rem': '; '.join(x for x in (bad, txt(r[7])) if x), 'src': f'w!{i}'})

def dga(wb, out):
    meta = {}
    for ws in wb.worksheets:
        name = ws.title.strip()
        if not name.startswith('DGA ') or name == 'DGA-ICT1': continue
        s = re.sub(r'\s+', ' ', name[4:]).upper()
        unit = unit_of(s)
        loc = 'OLTC' if 'OLTC' in s else 'Bottom' if 'BOTTOM' in s else 'Top'
        ph = phase_of(s) or '-'
        meta.setdefault(unit, {'rating': txt(ws['B3'].value), 'make': txt(ws['N3'].value),
                               'commissioned': iso(ws['N2'].value)})
        if ph != '-': meta[unit].setdefault('serials', {})[ph] = txt(ws['N4'].value)
        cols = ['H2', 'CH4', 'CO', 'CO2', 'C2H4', 'C2H6', 'C2H2', 'O2', 'N2', 'TDCG', 'TGC',
                'BDV', 'H2O', 'acidity', 'DDF', 'resistivity']
        for i, r in enumerate(ws.iter_rows(min_row=9, values_only=True), start=9):
            d = iso(r[2])
            if not d: continue
            raw = {k: r[4 + j] for j, k in enumerate(cols)}
            vals = {k: num(x) for k, x in raw.items()}
            if all(vals[k] is None for k in cols[:7]): continue
            out.append({'t': 'dga', 'unit': unit, 'pos': loc, 'ph': ph, 'date': d,
                'ses': txt(r[1]) or session_of(d), 'v': vals,
                'rem': txt(r[20]) if len(r) > 20 else '', 'src': f'{ws.title}!{i}'})
    return meta

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    wb = openpyxl.load_workbook(src, data_only=True)
    out = []
    out_list = out
    bushing(wb, out); winding(wb, out)
    ct = {'C': 13, 'tand': 14, 'U': 15, 'I': 16, 'phi': 17, 'P': 18, 'F': 19, 'temp': 20, 'corr': 21}
    for kv in ('400', '220'):
        blocks(wb, f'{kv} kV CT Tan D Results', 'ct', 3, ct)
        blocks(wb, f'{kv} kV CB-CRM Results', 'cb_crm', 2, {'R': 12, 'I': 13, 'mV': 14}, rem_col=15)
        blocks(wb, f'{kv} kV CB-Timing Results', 'cb_timing', 2,
               {'open1': 12, 'co1': 13, 'close': 14, 'open2': 15, 'co2': 16}, rem_col=17)
    blocks(wb, '400 kV LA LCM Results', 'la', 3,
           {'Ith': 13, 'Icorr': 14, 'Itotal': 15, 'IRt': 16, 'IRm': 17, 'IRb': 18, 'IRtot': 19},
           rem_col=20, season_col=12)
    la_220(wb, out)
    dmeta = dga(wb, out)
    # reject physically impossible rows (e.g. drag-fill artefacts on future bays)
    def implausible(r):
        v = r['v']
        if r['date'] < '2000-01-01': return 'date before 2000'
        if v.get('tand') is not None and v['tand'] < 0: return 'negative tan delta'
        if v.get('temp') is not None and not (0 <= v['temp'] <= 80): return f"temperature {v['temp']} C"
        return None
    kept = []
    for r in out:
        why = implausible(r)
        if why: ISSUES.append({'src': r['src'], 'field': 'row', 'text': f'Rejected ({why}) - looks like a spreadsheet drag-fill artefact', 'rejected': True})
        else: kept.append(r)
    out[:] = kept

    # --- LA results printed in the PDF of the sheet (220 kV side + latest 400 kV campaigns)
    # The .xlsx export lacks them; tools/import_pdf_la.py reads them into data/la_pdf.json.
    import os as _os
    pdf_la = _os.path.join(_os.path.dirname(dst) or '.', 'la_pdf.json')
    PDF_NAMES = {}
    if _os.path.exists(pdf_la):
        PL = json.load(open(pdf_la)); PDF_NAMES = PL.get('names', {})
        SINGLE = {'400', '200'}
        for r in out:                                   # spare-ICT LAs are single-phase units
            if r['t'] == 'la' and r['unit'] in SINGLE: r['ph'] = '-'
        have = {(r['unit'], r['ph'], r['date']) for r in out if r['t'] == 'la'}
        added = 0
        for r in PL['rows']:
            k = (r['unit'], r['ph'], r['date'])
            POP.setdefault('la', set()).add((r['unit'], r['ph']))
            if k in have: continue
            if not r['v'] and not r['rem']: continue
            out.append({'t': 'la', 'unit': r['unit'], 'pos': '', 'ph': r['ph'], 'date': r['date'], 'ses': session_of(r['date']),
                        'season': r['season'], 'v': r['v'], 'rem': r['rem'], 'src': r['src']}); have.add(k); added += 1
        POP['la'] = {(u, '-' if u in SINGLE else ph) for u, ph in POP['la'] if not (u in SINGLE and ph != '-') or True}
        POP['la'] = {(u, ph) for u, ph in POP['la'] if not (u in SINGLE and ph != '-')}
        ISSUES.append({'src': 'PDF of the sheet', 'field': 'LA', 'text': f'{added} LA readings (220 kV side incl. bay 200 spare ICT IV, and the Nov 2026 400 kV campaign) are only in the PDF print of the sheet; imported from the PDF', 'calc': True})

    # --- 5 kV tan δ readings (the sheet holds 10 kV only; 10 kV stays the default for every judgement)
    p5 = _os.path.join(_os.path.dirname(dst) or '.', 'extra_5kv.json')
    if _os.path.exists(p5):
        x5 = json.load(open(p5))['records']
        for r in x5: r.setdefault('pos', ''); out.append(r)
        ISSUES.append({'src': '5 kV readings', 'field': 'tv', 'text': f'{len(x5)} tan δ / capacitance readings at 5 kV added from data/extra_5kv.json (shown with the 5 kV switch; 10 kV is the default)', 'calc': True})

    # --- copied rows: identical readings in many different sampling points / elements on one date
    # Different tanks / phases cannot return identical multi-parameter readings, so such rows are
    # template or pasted data. They are kept (visible, greyed) but flagged and excluded from analysis.
    import collections as _c
    sig_keys = {'dga': ['H2', 'CH4', 'CO', 'CO2', 'C2H4', 'C2H6', 'C2H2', 'O2', 'N2'],
                'ct': ['C', 'tand', 'U', 'I', 'P', 'F', 'temp'], 'bushing': ['C', 'tand', 'U', 'I', 'P', 'F', 'temp'],
                'winding': ['C', 'tand', 'U', 'I', 'P', 'F', 'temp'], 'la': ['Ith', 'Icorr', 'Itotal']}
    groups = _c.defaultdict(list)
    for r in out:
        ks = sig_keys.get(r['t'])
        if not ks: continue
        sig = tuple(r['v'].get(k) for k in ks)
        if sum(v is not None for v in sig) >= 4:
            groups[(r['t'], r['date'], sig)].append(r)
    # A row printed in the PDF of the sheet is an official result: it is shown and analysed even when
    # its readings repeat elsewhere (then only a verification note is attached). Hidden rows that never
    # reach the PDF stay excluded.
    import os as _os, datetime as _dt
    _pp = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'data', 'sheet_pdf.txt')
    _pdf = open(_pp).read().splitlines() if _os.path.exists(_pp) else []
    def in_pdf(r):
        dd = _dt.date.fromisoformat(r['date']); ds = f"{dd.day}-{dd.strftime('%b')}-{dd.year}"
        c = r['v'].get('C')
        return any(ds in ln and (c is None or f'{c:.2f}' in ln or f'{c:.1f}' in ln) for ln in _pdf)
    for (t, d, sig), rs in groups.items():
        elems = {(r['unit'], r['ph'], r['pos'], r.get('acting')) for r in rs}
        if len(elems) >= 3:
            shown = [r for r in rs if in_pdf(r)]
            for r in rs:
                if r in shown:
                    r['note'] = f'Readings identical in {len(elems)} elements on {d}; printed in the sheet PDF, so kept as an official result - verify against the field sheet'
                else:
                    r['excluded'] = f'Identical readings in {len(elems)} different sampling points/elements on {d} - hidden template row, not in the sheet PDF; excluded from analysis'
            ISSUES.append({'src': f"{t.upper()} {d}", 'field': 'row', 'text': (f'{len(shown)} of {len(rs)} rows with identical readings are printed in the PDF - kept and analysed, flagged for verification' if shown else f'Identical readings in {len(elems)} elements on {d} - hidden template rows, not in the PDF; excluded'), 'copied': True, 'rows': [r['src'] for r in rs]})

    # --- calculation audit -------------------------------------------------
    # TDCG: recompute from the six combustible gases; never trust the sheet column
    for r in out:
        if r['t'] != 'dga': continue
        v = r['v']; g = ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'CO']
        if all(v.get(x) is not None for x in g):
            s = round(sum(v[x] for x in g), 1)
            if v.get('TDCG') is not None and abs(s - v['TDCG']) > 1:
                ISSUES.append({'src': r['src'], 'field': 'TDCG', 'text': f"Sheet TDCG {v['TDCG']:g} ppm but the six combustible gases sum to {s:g} ppm - portal uses the computed value", 'calc': True})
            v['TDCG_sheet'] = v.get('TDCG'); v['TDCG'] = s
    # FY session label must match the test date (FY runs 1 Apr - 31 Mar)
    for r in out:
        if r['ses'] and r['ses'] != session_of(r['date']):
            ISSUES.append({'src': r['src'], 'field': 'SESSION', 'text': f"Labelled {r['ses']} but tested {r['date']} (FY {session_of(r['date'])}) - portal uses the date", 'calc': True})
            r['ses'] = session_of(r['date'])
    # temperature-correction table must cover every whole degree used
    cft = sorted(int(num(a)) for a, b in wb['Correction Factor'].iter_rows(min_row=2, max_col=2, values_only=True) if num(a) is not None and num(b) is not None)
    gaps = [t for t in range(cft[0], cft[-1] + 1) if t not in cft]
    if gaps:
        ISSUES.append({'src': 'Correction Factor', 'field': 'K table', 'text': f"No correction factor for {', '.join(map(str, gaps))} °C - a test at these oil temperatures returns #N/A in the sheet", 'calc': True})
    fy = wb['CURRENT FY']
    for r in out:
        if r['t'] == 'ct' and r['v'].get('corr') is not None:
            r['v']['tand20'] = round(r['v'].pop('corr') * 100, 4)
        r['v'] = {k: v for k, v in r['v'].items() if v is not None}
    out.sort(key=lambda r: (r['t'], r['unit'], r['pos'], r['ph'], r['date']))
    cf = [(num(a), num(b)) for a, b in wb['Correction Factor'].iter_rows(min_row=2, max_col=2, values_only=True)
          if num(a) is not None and num(b) is not None]
    doc = {
        'substation': {'id': 'karjat', 'name': '400 kV Karjat Substation', 'org': 'MSETCL',
                       'fy': txt(fy['B7'].value), 'source': src.split('/')[-1],
                       'extracted': datetime.date.today().isoformat()},
        'bays': {'200': '220 kV SPARE ICT IV', **bay_names(wb)},
        'units': {'ICT1': {**dmeta.get('ICT1', {}), 'name': 'ICT 1', 'rating': '501 MVA 400/220 kV (3 × 1-ph)', 'bay': '403'},
                  'ICT2': {**dmeta.get('ICT2', {}), 'name': 'ICT 2', 'rating': '501 MVA 400/220 kV (3 × 1-ph)', 'bay': '406'},
                  'SPARE_ICT': {**dmeta.get('SPARE_ICT', {}), 'name': 'Spare ICT', 'rating': '167 MVA 400/220 kV 1-ph', 'bay': '400'},
                  'BUS_REACTOR': {**dmeta.get('BUS_REACTOR', {}), 'name': 'Bus Reactor', 'rating': '125 MVAr 400 kV', 'bay': '401'}},
        'tempCorrection': cf,
        'population': {t: sorted([list(x) for x in v]) for t, v in POP.items()},
        'records': out, 'issues': ISSUES,
    }
    with open(dst, 'w') as f: json.dump(doc, f, separators=(',', ':'), ensure_ascii=False)
    import collections
    print(collections.Counter(r['t'] for r in out), len(ISSUES), 'issues')
