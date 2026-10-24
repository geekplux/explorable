# Fonts

`public/fonts/*.woff2` are committed binaries, built once from OFL sources: Source Serif 4 and Geist / Geist Mono
(the `@fontsource-variable/source-serif-4`, `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`
npm packages, `files/*-latin-wght-*.woff2`), Noto Serif and STIX Two Math (github.com/google/fonts).
Licence and copyright lines: `public/fonts/OFL.txt`. Spec: `docs/redesign/DESIGN.md` §2.

Rebuild (throwaway venv, nothing added to package.json):

```sh
python3 -m venv /tmp/fontvenv && /tmp/fontvenv/bin/pip install fonttools brotli
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
FEAT="kern,liga,clig,calt,ccmp,locl,mark,mkmk,case,tnum,pnum,lnum,onum,sups,ordn,frac,numr,dnom"
python -m fontTools.varLib.instancer source-serif-4-latin-wght-normal.woff2 wght=400:600 -o ss.ttf
python -m fontTools.varLib.instancer source-serif-4-latin-wght-italic.woff2 wght=400 -o ssi.ttf
python -m fontTools.varLib.instancer geist-latin-wght-normal.woff2 wght=400:600 -o g.ttf
python -m fontTools.varLib.instancer geist-mono-latin-wght-normal.woff2 wght=400:500 -o gm.ttf
for f in ss ssi g gm; do python -m fontTools.subset $f.ttf --unicodes="$LATIN" --layout-features="$FEAT" --flavor=woff2 --output-file=$f.woff2; done
python -m fontTools.varLib.instancer NotoSerif.ttf wdth=100 wght=400:700 -o ns.ttf
python -m fontTools.subset ns.ttf --unicodes="U+0391-03A9,U+03B1-03C9,U+1FB1,U+1FB9,U+0304,U+2070-209F,U+1D40,U+1D62,U+2C7C" \
  --layout-features="kern,mark,mkmk,ccmp,locl" --flavor=woff2 --output-file=greek.woff2
python -m fontTools.subset STIXTwoMath-Regular.ttf --unicodes="U+00B1,U+00D7,U+00F7,U+2190-2199,U+2202,U+2207,U+2208,U+2211,U+2212,U+221A,U+221D,U+221E,U+2223,U+2227-222B,U+2248,U+2260-2265,U+22C5" \
  --layout-features="" --flavor=woff2 --output-file=math.woff2
```

Rename `g.woff2` to `geist-latin.woff2` and `gm.woff2` to `geist-mono-latin.woff2`.
Source Serif 4 carries the Reserved Font Name "Source", so its subsets (Modified Versions) are renamed internally
(name IDs 1, 2, 3, 4, 6, 16, 17) to `Explorable Serif` (`serif-latin.woff2`, `serif-italic-latin.woff2`, style `Regular` / `Italic`),
and so are the two symbol subsets, to `Explorable Greek` (`symbols-greek.woff2`) and `Explorable Math` (`symbols-math.woff2`):

```python
from fontTools.ttLib import TTFont
f = TTFont('greek.woff2'); family = 'Explorable Greek'; ps = 'ExplorableGreek-Regular'
for nid, value in {1: family, 2: 'Regular', 3: ps, 4: family + ' Regular', 6: ps, 16: family, 17: 'Regular'}.items():
    f['name'].removeNames(nameID=nid); f['name'].setName(value, nid, 3, 1, 0x409)
if 'CFF ' in f: f['CFF '].cff.fontNames = [ps]
f.flavor = 'woff2'; f.save('symbols-greek.woff2')
```
