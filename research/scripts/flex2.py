import sys, collections, re, statistics as st
sys.path.insert(0, sys.argv[1]); from flex_load import load, num
hdr,D=load()
H=hdr
P,O,N,C,He,D0,Dext,K,T,E=H[5],H[6],H[7],H[8],H[9],H[10],H[11],H[12],H[13],H[14]
print('Test end raw values:',collections.Counter(r[E] for r in D))
print('Dash chars:',collections.Counter(v for r in D for v in r.values() if v.strip() in ('\u2013','-','—')))
ids=collections.Counter(r[H[1]] for r in D); print('dup ids:',{k:v for k,v in ids.items() if v>1})
for k,v in ids.items():
    if v>1:
        for r in D:
            if r[H[1]]==k: print('   ',list(r.values()))
# id prefix patterns
pat=collections.Counter(re.sub(r'\d','9',r[H[1]]) for r in D); print('id patterns',pat)
# letter code
print('letter at pos3 for numeric ids:',collections.Counter(r[H[1]][3] for r in D if re.fullmatch(r'\d{3}[A-Z]\d{3}',r[H[1]])))
print('C-series codes (H/M):',collections.Counter(r[H[1]][3]+'/'+r['Fuel'] for r in D if re.fullmatch(r'[A-Z]\d\d[A-Z]\d{3}',r[H[1]])))
# mole fraction sums
bad=[(r[H[0]],r[H[1]],num(r[O])+num(r[N])+num(r[C])+num(r[He])) for r in D if abs(num(r[O])+num(r[N])+num(r[C])+num(r[He])-1)>0.011]
print('mole fraction sum !=1:',bad)
print('pressure zero/low:',[(r[H[0]],r[H[1]],r[P],r[E],r[D0],r[T]) for r in D if num(r[P])<300])
print('pressure distribution:',sorted(collections.Counter(round(num(r[P]),-1) for r in D).items()))
# gas compositions groups
comp=collections.Counter((r[O],r[N],r[C],r[He]) for r in D); print('distinct compositions',len(comp))
for k,v in sorted(comp.items(), key=lambda x:-x[1]): print('  O,N,CO?,He=',k,v)
# extinction diameter checks
print('Dext>=D0:',[(r[H[0]],r[H[1]],r[D0],r[Dext],r[E]) for r in D if num(r[D0]) and num(r[Dext]) is not None and num(r[Dext])>=num(r[D0])])
print('Dext==0:',[(r[H[0]],r[H[1]],r[D0],r[Dext],r[E],r['Fuel']) for r in D if num(r[Dext])==0])
print('Dext present but outcome not Extinction:',collections.Counter(r[E] for r in D if num(r[Dext]) is not None))
print('Dext missing by outcome:',collections.Counter(r[E] for r in D if num(r[Dext]) is None))
print('Burn time nonnumeric/empty:',[(r[H[0]],r[H[1]],r[T],r[E]) for r in D if num(r[T]) is None])
print('Burn rate empty:',[(r[H[0]],r[H[1]],r[K],r[E]) for r in D if num(r[K]) is None])
print('D0 empty:',[(r[H[0]],r[H[1]],r[D0]) for r in D if num(r[D0]) is None])
# consistency: d^2 law t_b ~ (D0^2 - Dext^2)/K
dev=[]
for r in D:
    d0,de,k,t=num(r[D0]),num(r[Dext]),num(r[K]),num(r[T])
    if None not in (d0,k,t) and k>0:
        de2=de if de is not None else 0
        pred=(d0**2-de2**2)/k; dev.append((t/pred, r[H[0]], r[H[1]], d0,de,k,t,round(pred,2),r[E]))
rat=[x[0] for x in dev]
print('t/((D0^2-De^2)/K): n',len(rat),'median',round(st.median(rat),3),'q', [round(x,2) for x in st.quantiles(rat,n=10)])
for x in sorted(dev)[:6]+sorted(dev)[-8:]: print('   ',[round(x[0],2)]+list(x[1:]))
# fuel stats
for f in ['Methanol','Heptane']:
    S=[r for r in D if r['Fuel']==f]
    for col in [D0,K,T,Dext]:
        v=[num(r[col]) for r in S if num(r[col]) is not None]
        print(f,col,'n',len(v),'mean',round(st.mean(v),3),'median',st.median(v),'min',min(v),'max',max(v))
    print(f,'outcomes',collections.Counter(r[E] for r in S))
    print(f,'O2',sorted(collections.Counter(r[O] for r in S).items()))
# outcome vs He, vs CO
print('outcome x (He>0)',collections.Counter((num(r[He])>0,r[E]) for r in D))
print('outcome x (CO col>0)',collections.Counter((num(r[C])>0,r[E]) for r in D))
# dates: year range, format
yrs=collections.Counter(r['Test Date'].split('/')[-1] for r in D); print('years',yrs)
# test # ordering vs date
