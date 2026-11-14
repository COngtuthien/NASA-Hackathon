import zipfile,re,sys,collections
from xml.etree import ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
z=zipfile.ZipFile(sys.argv[1])
ss=[''.join(t.text or '' for t in si.iter(NS+'t')) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS+'si')]
wb=ET.fromstring(z.read('xl/workbook.xml'))
rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
def c2n(c):
    n=0
    for ch in c: n=n*26+ord(ch)-64
    return n
for s in wb.find(NS+'sheets'):
    name=s.get('name'); tgt='xl/'+rels[s.get(R+'id')].lstrip('/').replace('xl/','')
    rows=[]; nrows=0; colstats=collections.defaultdict(lambda: collections.Counter()); formulas=0; ftext=collections.Counter()
    first=[]; last=collections.deque(maxlen=3); dim=None
    with z.open(tgt) as f:
        for ev,el in ET.iterparse(f,events=('end',)):
            if el.tag==NS+'dimension': dim=el.get('ref')
            if el.tag==NS+'row':
                rr={}
                for c in el.findall(NS+'c'):
                    col=c2n(re.match(r'[A-Z]+',c.get('r')).group()); t=c.get('t'); v=c.find(NS+'v'); fo=c.find(NS+'f')
                    if fo is not None:
                        formulas+=1
                        if fo.text: ftext[re.sub(r'\d+','#',fo.text)[:120]]+=1
                    val=None
                    if v is not None: val=ss[int(v.text)] if t=='s' else v.text
                    if val is not None:
                        rr[col]=val; colstats[col]['str' if t in ('s','str','inlineStr') else ('err' if t=='e' else 'num')]+=1
                nrows+=1
                if len(first)<6: first.append((el.get('r'),rr))
                last.append((el.get('r'),rr))
                el.clear()
    srel=tgt.replace('worksheets/','worksheets/_rels/')+'.rels'
    extra=[ (r.get('Type').split('/')[-1], r.get('Target')) for r in ET.fromstring(z.read(srel))] if srel in z.namelist() else []
    print(f'\n######## SHEET {name!r} file={tgt} dim={dim} rows={nrows} formulas={formulas} rels={extra}')
    print('  column type counts:',{k:dict(v) for k,v in sorted(colstats.items())})
    print('  top formula patterns:',ftext.most_common(6))
    for r,rr in first: print('  FIRST',r,' | '.join(f'{k}:{v}' for k,v in sorted(rr.items()))[:500])
    for r,rr in last: print('  LAST ',r,' | '.join(f'{k}:{v}' for k,v in sorted(rr.items()))[:500])
