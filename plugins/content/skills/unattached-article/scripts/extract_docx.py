#!/usr/bin/env python3
"""Extract readable paragraph text and table rows from a DOCX using stdlib."""
import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}


def text(node):
    return ''.join(x.text or '' for x in node.findall('.//w:t', NS)).strip()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('input', type=Path)
    p.add_argument('output', type=Path)
    args = p.parse_args()
    with zipfile.ZipFile(args.input) as z:
        root = ET.fromstring(z.read('word/document.xml'))
        media = [n for n in z.namelist() if n.startswith('word/media/')]

    lines = [f'# Extracted from {args.input.name}', '',
             f'- Embedded media: {len(media)}', '']
    body = root.find('.//w:body', NS)
    for child in body:
        tag = child.tag.rsplit('}', 1)[-1]
        if tag == 'p':
            value = text(child)
            if value:
                lines.extend([value, ''])
        elif tag == 'tbl':
            for row in child.findall('./w:tr', NS):
                cells = [text(c).replace('|', '\\|') for c in row.findall('./w:tc', NS)]
                lines.append('| ' + ' | '.join(cells) + ' |')
            lines.append('')
    args.output.write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
