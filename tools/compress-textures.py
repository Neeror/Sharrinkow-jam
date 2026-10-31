import io
import json
import struct
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
report = []
for path in sorted((root / 'public/models').glob('*.glb')):
    data = path.read_bytes()
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary_start = 20 + json_size + 8
    binary = data[binary_start:]
    views = document['bufferViews']
    images = {image['bufferView']: image for image in document.get('images', [])}
    rebuilt = bytearray()
    limit = 2048 if path.stem in ['bed', 'sofa', 'human'] else 1024
    sizes = []
    for index, view in enumerate(views):
        if view.get('buffer', 0) != 0:
            continue
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        if index in images and images[index].get('mimeType') != 'image/webp':
            image = Image.open(io.BytesIO(payload)).convert('RGBA')
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            stream = io.BytesIO()
            image.save(stream, format='WEBP', quality=88, method=6)
            payload = stream.getvalue()
            images[index]['mimeType'] = 'image/webp'
            sizes.append(list(image.size))
        while len(rebuilt) % 4:
            rebuilt.append(0)
        view['byteOffset'] = len(rebuilt)
        view['byteLength'] = len(payload)
        rebuilt.extend(payload)
        compression = view.get('extensions', {}).get('EXT_meshopt_compression')
        if compression:
            raise ValueError('Unexpected compressed view on buffer zero')
    for view in views:
        compression = view.get('extensions', {}).get('EXT_meshopt_compression')
        if not compression:
            continue
        while len(rebuilt) % 4:
            rebuilt.append(0)
        start = compression.get('byteOffset', 0)
        payload = binary[start:start + compression['byteLength']]
        compression['byteOffset'] = len(rebuilt)
        rebuilt.extend(payload)
    for texture in document.get('textures', []):
        if 'source' in texture:
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
    for key in ['extensionsUsed', 'extensionsRequired']:
        document.setdefault(key, [])
        if 'EXT_texture_webp' not in document[key]:
            document[key].append('EXT_texture_webp')
    document['buffers'][0]['byteLength'] = len(rebuilt)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    rebuilt.extend(b'\0' * ((-len(rebuilt)) % 4))
    result = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(rebuilt))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    result += struct.pack('<II', len(rebuilt), 0x004E4942) + rebuilt
    path.write_bytes(result)
    report.append({'name': path.name, 'bytes': len(result), 'textures': sizes})
    print(path.name, len(data), '->', len(result), sizes)
(root / 'artifacts/compressed-models.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('Total:', sum(entry['bytes'] for entry in report))
