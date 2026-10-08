"""Optional design tool: outline the licensed Inter wordmark with fontTools."""
import argparse
import hashlib
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('font', type=Path, help='Official InterVariable.ttf (see ../README.md)')
args = parser.parse_args()
expected = '4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf'
if hashlib.sha256(args.font.read_bytes()).hexdigest() != expected:
    parser.error('Font hash differs from the documented Inter source; review provenance first.')

font = instantiateVariableFont(TTFont(args.font), {'wght': 700, 'opsz': 32}, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 100 / font['head'].unitsPerEm
letters = 'Subtitle Bridge'
width = sum(font['hmtx'][cmap[ord(c)]][0] for c in letters)
start = (900 - width * scale) / 2
paths = []
advance = 0


def number(value):
    return f'{value:.2f}'.rstrip('0').rstrip('.') if value else '0'


for char in letters:
    name = cmap[ord(char)]
    pen = SVGPathPen(glyphs, ntos=number)
    glyphs[name].draw(pen)
    commands = pen.getCommands()
    if commands:
        paths.append(f'    <path transform="translate({advance} 0)" d="{commands}"/>')
    advance += font['hmtx'][name][0]

group = (
    f'<g id="wordmark" fill="#f5f5f5" transform="translate({start:.3f} 105) '
    f'scale({scale:.8f} {-scale:.8f})">\n' + '\n'.join(paths) + '\n  </g>'
)
out = Path(__file__).resolve().parent.parent / 'source'
out.mkdir(exist_ok=True)
(out / 'wordmark-outlined.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140" '
    'viewBox="0 0 900 140" role="img" aria-label="Subtitle Bridge">\n'
    '  <title>Subtitle Bridge wordmark — Inter Bold outlines</title>\n'
    f'  {group}\n</svg>\n', encoding='utf-8'
)
(out / 'wordmark-editable.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140" '
    'viewBox="0 0 900 140" role="img" aria-label="Subtitle Bridge">\n'
    '  <title>Subtitle Bridge editable wordmark — requires Inter</title>\n'
    '  <text x="450" y="105" text-anchor="middle" font-family="Inter, sans-serif" '
    'font-size="100" font-weight="700" style="font-optical-sizing: auto; '
    'font-kerning: none" fill="#f5f5f5">Subtitle Bridge</text>\n</svg>\n', encoding='utf-8'
)
print(f'Outlined Inter Bold wordmark: {len(paths)} glyph paths, {width * scale:.2f}px advance.')
