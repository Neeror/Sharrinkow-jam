import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
report = json.loads((root / 'artifacts/model-analysis.json').read_text(encoding='utf-8'))
for entry in report:
    if 'error' in entry:
        continue
    print(entry['file'], entry['triangles'], entry['dimensions'])
    print('Skeletons:', [(s['name'], s['bones']) for s in entry['skeletons']])
    print('Images:', len(entry['images']), 'Missing:', [i['name'] for i in entry['images'] if not i['packed'] and not i['exists']])
    if entry['file'].endswith('blender file.blend'):
        print('Objects:', entry['objects'])
        print('Deform bones:', [n for s in entry['skeletons'] for n in s['names'] if n.startswith('DEF-upper') or n.startswith('DEF-fore')])
