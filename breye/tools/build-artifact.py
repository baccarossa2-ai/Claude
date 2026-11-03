#!/usr/bin/env python3
"""Build the claude.ai Artifact page from breye/index.html.

The Artifact host wraps the page in its own <!doctype>/<html>/<head>/<body>,
so the published page keeps only the head's title, metas and links followed
by the body content.
Usage: python3 breye/tools/build-artifact.py OUTPUT.html
"""
import re
import sys
from pathlib import Path

src = (Path(__file__).resolve().parent.parent / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*', '', head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
title = re.search(r'<title>.*?</title>', head, re.S).group(0)
rest = head.replace(title, '').strip()
out = title + '\n' + rest + '\n' + body.strip() + '\n'
Path(sys.argv[1]).write_text(out, encoding='utf-8')
print('wrote', sys.argv[1], len(out), 'bytes')
