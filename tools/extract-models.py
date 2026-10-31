import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'source-models'
destination = source / 'extracted'
report = []
for archive in sorted(source.glob('*.zip')):
    before = hashlib.sha256(archive.read_bytes()).hexdigest()
    target = destination / archive.stem
    files = []
    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            output = (target / member.filename).resolve()
            if not output.is_relative_to(target.resolve()):
                raise ValueError(f'Unsafe archive path: {member.filename}')
            if member.is_dir():
                continue
            data = bundle.read(member)
            if output.exists():
                if output.read_bytes() != data:
                    raise ValueError(f'Existing modified file: {output}')
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(data)
            files.append({'path': member.filename, 'bytes': member.file_size})
    after = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert before == after
    report.append({'archive': archive.name, 'sha256': before, 'files': files})
output = root / 'artifacts' / 'archive-inventory.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(report, indent=2), encoding='utf-8')
for entry in report:
    models = [f['path'] for f in entry['files'] if Path(f['path']).suffix.lower() in ['.blend', '.gltf', '.glb']]
    print(entry['archive'], len(entry['files']), 'files', models)
for location in [Path('C:/Program Files/Blender Foundation'), Path('C:/Program Files/Blender')]:
    if location.exists():
        print('BLENDER', list(location.rglob('blender.exe')))
