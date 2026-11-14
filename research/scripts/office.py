import zipfile, re, sys, os
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
def docx(p):
    z=zipfile.ZipFile(p); root=ET.fromstring(z.read('word/document.xml'))
    body=root.find(W+'body'); out=[]
    for el in body:
        if el.tag==W+'p':
            sty=el.find(f'{W}pPr/{W}pStyle'); s=sty.get(W+'val') if sty is not None else ''
            t=''.join(x.text or '' for x in el.iter(W+'t'))
            if t.strip(): out.append((f'[{s}] ' if s else '')+t)
        elif el.tag==W+'tbl':
            out.append('<TABLE>')
            for tr in el.iter(W+'tr'):
                out.append(' | '.join(''.join(x.text or '' for x in tc.iter(W+'t')) for tc in tr.findall(W+'tc')))
            out.append('</TABLE>')
    media=[n for n in z.namelist() if n.startswith('word/media/')]
    out.append(f'<MEDIA count={len(media)}: {media}>')
    return '\n'.join(out)
def pptx(p):
    z=zipfile.ZipFile(p); names=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)], key=lambda n:int(re.findall(r'\d+',n)[0]))
    out=[]
    for n in names:
        root=ET.fromstring(z.read(n)); out.append(f'===== {n}')
        for para in root.iter(A+'p'):
            t=''.join(x.text or '' for x in para.iter(A+'t'))
            if t.strip(): out.append(t)
        nn=n.replace('slides/slide','notesSlides/notesSlide')
        if nn in z.namelist():
            r=ET.fromstring(z.read(nn)); t=' '.join(x.text or '' for x in r.iter(A+'t')).strip()
            if t: out.append('[NOTES] '+t)
    media=[n for n in z.namelist() if n.startswith('ppt/media/')]
    out.append(f'<MEDIA count={len(media)}>')
    return '\n'.join(out)
for p in sys.argv[2:]:
    o=os.path.join(sys.argv[1], p.replace('/','__').replace(' ','_')+'.txt')
    try:
        t=docx(p) if p.endswith('.docx') else pptx(p)
        open(o,'w',encoding='utf-8').write(t); print(p,'OK words=',len(t.split()))
    except Exception as e: print(p,'ERROR',e)
