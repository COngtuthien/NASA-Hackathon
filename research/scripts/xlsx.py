import zipfile, re, sys, os
from xml.etree import ElementTree as ET
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
PR='{http://schemas.openxmlformats.org/package/2006/relationships}'
def col2n(c):
    n=0
    for ch in c: n=n*26+ord(ch)-64
    return n
def read(path, max_rows=None, only=None):
    z=zipfile.ZipFile(path); names=z.namelist()
    ss=[]
    if 'xl/sharedStrings.xml' in names:
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS+'si'):
            ss.append(''.join(t.text or '' for t in si.iter(NS+'t')))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out=[]
    for s in wb.find(NS+'sheets'):
        name=s.get('name'); tgt=rels[s.get(R+'id')]; tgt=tgt.lstrip('/'); tgt=tgt if tgt.startswith('xl/') else 'xl/'+tgt
        if only and name not in only: out.append((name,tgt,None,None,None)); continue
        root=ET.fromstring(z.read(tgt)); dim=root.find(NS+'dimension'); dim=dim.get('ref') if dim is not None else None
        rows=[]; formulas=0; types={}
        for row in root.iter(NS+'row'):
            rr={}
            for c in row.findall(NS+'c'):
                ref=c.get('r'); col=re.match(r'[A-Z]+',ref).group(); t=c.get('t'); v=c.find(NS+'v'); f=c.find(NS+'f')
                if f is not None: formulas+=1
                if t=='s' and v is not None: val=ss[int(v.text)]
                elif t=='inlineStr': val=''.join(x.text or '' for x in c.iter(NS+'t'))
                else: val=v.text if v is not None else None
                types[t or 'n']=types.get(t or 'n',0)+1
                if val is not None: rr[col2n(col)]=val
            rows.append((int(row.get('r')),rr))
            if max_rows and len(rows)>=max_rows: break
        # sheet rels: drawings/hyperlinks
        srel=os.path.dirname(tgt)+'/_rels/'+os.path.basename(tgt)+'.rels'
        extra=[]
        if srel in names:
            for r in ET.fromstring(z.read(srel)): extra.append((r.get('Type').split('/')[-1], r.get('Target'), r.get('TargetMode')))
        merged=root.find(NS+'mergeCells'); nmerged=len(merged) if merged is not None else 0
        out.append((name,tgt,dim,rows,dict(formulas=formulas,types=types,rels=extra,merged=nmerged)))
    return z,out
if __name__=='__main__':
    path=sys.argv[1]; mr=int(sys.argv[2]) if len(sys.argv)>2 else 60
    z,out=read(path,mr)
    print('ZIP members:',len(z.namelist()))
    from collections import Counter
    print('member dirs:',Counter(os.path.dirname(n) for n in z.namelist()))
    for name,tgt,dim,rows,meta in out:
        print(f'\n##### SHEET {name!r} ({tgt}) dim={dim} meta={meta}')
        for rn,rr in rows:
            if rr: print(rn,' | '.join(f'{k}:{v}' for k,v in sorted(rr.items()))[:600])
