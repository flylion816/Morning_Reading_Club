#!/usr/bin/env python3
"""Read-only input validation; does not validate voices or rendered delivery."""
import argparse, hashlib, json
from pathlib import Path

def check(data):
    errors, assets, states = [], [], {}
    def asset(value, label):
        if not value:
            errors.append(label + ': missing path'); return
        p = Path(value).expanduser()
        if not p.is_absolute() or not p.is_file():
            errors.append(label + ': not an existing absolute file'); return
        h = hashlib.sha256()
        with p.open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
        assets.append({'label': label, 'path': str(p), 'sha256': h.hexdigest()})
    script = data.get('script', {})
    asset(script.get('path'), 'script')
    if script.get('mode') not in ('verbatim', 'adaptation', 'material'):
        errors.append('script: choose verbatim/adaptation/material')
    chars = data.get('characters', [])
    by = {}
    for c in chars:
        cid = c.get('id')
        if not cid or cid in by: errors.append('character id missing or duplicated')
        else: by[cid] = c
        for i, p in enumerate(c.get('photos', [])): asset(p, f'{cid}:photo:{i}')
        voice = c.get('voice') or {}
        if voice.get('kind') == 'reference': asset(voice.get('reference_audio'), f'{cid}:voice')
        elif voice.get('kind') == 'stock' and not voice.get('voice_id'): errors.append(f'{cid}: stock voice_id missing')
        elif voice.get('kind') not in (None, 'stock', 'reuse'): errors.append(f'{cid}: unknown voice kind')
    def visit(cid):
        if states.get(cid) == 1: errors.append(f'{cid}: cyclic voice reuse'); return
        if states.get(cid) == 2: return
        states[cid] = 1
        v = by[cid].get('voice') or {}
        if v.get('kind') == 'reuse':
            target = v.get('character_id')
            if target not in by: errors.append(f'{cid}: missing reused character')
            else: visit(target)
        states[cid] = 2
    for cid in by: visit(cid)
    narrator = (data.get('narrator') or {}).get('character_id')
    if narrator and narrator not in by: errors.append('narrator: missing character')
    return {'input_ready': not errors, 'delivery_ready': False, 'errors': errors, 'assets': assets}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('brief')
    args = parser.parse_args()
    result = check(json.loads(Path(args.brief).read_text(encoding='utf-8')))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['input_ready'] else 1)
