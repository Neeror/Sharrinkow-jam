import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
blender = Path('C:/Program Files/Blender Foundation/Blender 5.2/blender.exe')
script = (root / sys.argv[1]).resolve()
if not script.is_relative_to(root):
    raise ValueError('Script must be inside project')
result = subprocess.run([str(blender), '--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', str(script)], cwd=root)
sys.exit(result.returncode)
