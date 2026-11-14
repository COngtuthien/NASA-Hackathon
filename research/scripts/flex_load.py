import csv, re
def num(v):
    v=v.strip()
    return float(v) if re.fullmatch(r'-?\d+(\.\d+)?',v) else None
def load(path='FLEX/PSI-69_Experimental table_FLEX.csv'):
    txt=open(path,'rb').read().decode('cp1252')
    rows=list(csv.reader(txt.splitlines())); hdr=rows[0]
    return hdr,[dict(zip(hdr,r)) for r in rows[1:]]
