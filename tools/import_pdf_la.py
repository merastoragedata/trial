#!/usr/bin/env python3
"""Read LA third-harmonic leakage results from the PDF print of the diagnostic sheet.

The PDF (File > Download > PDF of the Google Sheet) holds the 220 kV LA section and the
latest 400 kV campaigns, which the .xlsx export did not carry. This reads every LA block
(bay, phase, season rows) from the PDF text layer and writes data/la_pdf.json; the main
extractor merges it, adding only readings the workbook does not already have.

    pdftotext -layout Diagnostic_Test_Data_Karjat.pdf data/sheet_pdf.txt
    python3 tools/import_pdf_la.py data/sheet_pdf.txt data/la_pdf.json
"""
import re, sys, json
MON = {m: i for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}
DATE = r'(\d{1,2})-([A-Za-z]{3,4})-(\d{4})'
SINGLE = {'400', '200'}            # spare-ICT LAs: single-phase units (no R/Y/B)

def iso(m): return f"{m[3]}-{MON[m[2][:3].title()]:02d}-{int(m[1]):02d}"
def val(tok):
    try: return float(tok)
    except ValueError: return None

def main(src, dst):
    pages = open(src).read().split('\f')
    out, names, block = [], {}, None
    def close():
        if block and block.get('bay') and block['rows']:
            for r in block['rows']:
                out.append({**r, 'unit': block['bay'], 'ph': block['ph'] or '-', 'kv': block['kv']})
    for pno, page in enumerate(pages, 1):
        if 'THIRD HARMONIC' not in page: continue
        side = 220 if '220 kV SIDE' in page else 400
        L = page.splitlines()
        for i, line in enumerate(L):
            for m in re.finditer(r'BAY - (\d{3}) -\s*$', line):
                pass
            row = re.search(DATE + r'.*?(Pre Monsoon|Post Monsoon)\s+(.*)$', line)
            if row:
                if len(re.findall(DATE, line)) >= 2:          # only a block's first row carries the next-due date
                    close(); block = {'rows': [], 'bay': None, 'ph': None, 'kv': side}
                if block is None: block = {'rows': [], 'bay': None, 'ph': None, 'kv': side}
                dm = re.search(DATE, line)
                toks = row[5].replace('NO VALUE', 'NOVALUE').split()
                nums = toks[:3]
                v = {k: val(nums[j]) if len(nums) > j else None for j, k in enumerate(('Ith', 'Icorr', 'Itotal'))}
                bad = [t for t in nums if val(t) is None]
                rest = ' '.join(t for t in toks[3:] if t != '|').strip()
                rem = ' '.join(bad).replace('NOVALUE', 'NO VALUE')
                if rest: rem = (rem + ' ' + rest).strip()
                block['rows'].append({'date': iso(dm), 'season': row[4], 'v': {k: x for k, x in v.items() if x is not None}, 'rem': rem, 'src': f'PDF p.{pno}'})
            mk = re.match(r'^\s{0,3}(\d{3})\b(.*)$', line)
            if mk and block is not None and block['bay'] is None:
                block['bay'] = mk[1]
                tail = re.search(r'\s([RYB])\s*$', line)
                if tail: block['ph'] = tail[1]
                else:                                           # phase letter printed on a neighbouring line
                    for j in (i + 1, i - 1, i + 2):
                        if 0 <= j < len(L) and re.fullmatch(r'\s+([RYB])\s*', L[j]): block['ph'] = L[j].strip(); break
                if mk[1] in SINGLE: block['ph'] = '-'
            nm = re.search(r'BAY - (\d{3}) -', line)
            if nm and nm[1] not in names:                       # bay title from the block text (first few lines)
                ctx = ' '.join(x[30:90] for x in L[max(0, i - 1): i + 3])
                t = re.search(r'(\d{3}/?\d* ?kV [A-Z0-9 \-/().]+?)(?:\s{2,}|$)', ctx)
                if t: names[nm[1]] = re.sub(r'\s+', ' ', t[1]).strip()
    close()
    json.dump({'rows': out, 'names': names}, open(dst, 'w'), indent=0)
    print(len(out), 'LA rows read from PDF;', sum(1 for r in out if r['v']), 'with readings;', len({(r['unit'], r['ph']) for r in out}), 'LAs')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
