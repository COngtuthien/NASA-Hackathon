import zipfile,re,sys,collections,statistics as st,datetime,json
from xml.etree import ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z=zipfile.ZipFile(sys.argv[1]); out=sys.argv[2]
ss=[''.join(t.text or '' for t in si.iter(NS+'t')) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS+'si')]
def rows(path):
    with z.open(path) as f:
        for ev,el in ET.iterparse(f,events=('end',)):
            if el.tag==NS+'row':
                rr={}
                for c in el.findall(NS+'c'):
                    col=re.match(r'[A-Z]+',c.get('r')).group(); v=c.find(NS+'v'); t=c.get('t')
                    if v is not None: rr[col]=ss[int(v.text)] if t=='s' else v.text
                yield rr; el.clear()
# received sets
recv=collections.defaultdict(set); corr=collections.defaultdict(set); zrec=collections.defaultdict(set)
for i,rr in enumerate(rows('xl/worksheets/sheet10.xml')):
    if i==0: continue
    for v in rr.values(): recv[v[:4]].add(v)
for i,rr in enumerate(rows('xl/worksheets/sheet11.xml')):
    if i==0: continue
    for v in rr.values(): corr[v[:4]].add(v)
for i,rr in enumerate(rows('xl/worksheets/sheet12.xml')):
    if i==0: continue
    for v in rr.values(): zrec[v[:4]].add(v)
res={}; series={}
for sheet,label in [('sheet5.xml','BIT'),('sheet6.xml','PreFlowVis'),('sheet7.xml','PostFlowVis'),('sheet8.xml','Sample1'),('sheet9.xml','Sample2')]:
    per=collections.defaultdict(list); zips=collections.defaultdict(list)
    for i,rr in enumerate(rows('xl/worksheets/'+sheet)):
        if i==0: continue
        fn=rr.get('E'); size=rr.get('H') if label!='BIT' else rr.get('F')
        if not fn: continue
        cam=fn[:4]; ts=int(fn.split('-')[1].split('.')[0])
        per[cam].append((ts,int(float(size)) if size else None,fn))
        zf=rr.get('K') if label!='BIT' else rr.get('I')
        if zf: zips[cam].append(zf)
    for cam,L in sorted(per.items()):
        L.sort(); t0,t1=L[0][0],L[-1][0]; d=[(b[0]-a[0]) for a,b in zip(L,L[1:])]
        sizes=[s for _,s,_ in L if s]
        rcv=sum(1 for _,_,f in L if f in recv[cam]); cr=sum(1 for _,_,f in L if f in corr[cam])
        zr=sum(1 for f in zips[cam] if f in zrec[cam])
        res[f'{label}/{cam}']=dict(frames=len(L),start_utc=datetime.datetime.fromtimestamp(t0/1000,datetime.UTC).isoformat(),end_utc=datetime.datetime.fromtimestamp(t1/1000,datetime.UTC).isoformat(),duration_s=round((t1-t0)/1000,1),median_dt_ms=st.median(d) if d else None,max_gap_ms=max(d) if d else None,
            jpeg_received=rcv,jpeg_corrupt=cr,received_pct=round(100*rcv/len(L),1),zips_listed=len(zips[cam]),zips_received=zr,size_median=st.median(sizes),size_min=min(sizes),size_max=max(sizes))
        if label in('Sample1','Sample2'):
            b=collections.defaultdict(list)
            for ts,s,f in L: b[(ts-t0)//10000].append(s)
            series[f'{label}/{cam}']=[(k*10,round(st.mean(v)),len(v)) for k,v in sorted(b.items())]
for k,v in res.items(): print(k,json.dumps(v))
json.dump(series,open(out,'w'))
for k,v in series.items():
    print('\nSIZE SERIES (10s bins: t, mean bytes, n)',k); print(v)
