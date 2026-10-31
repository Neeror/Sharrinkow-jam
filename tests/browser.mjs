import { spawnSync } from 'node:child_process';

const url = process.argv[2] || process.env.GAME_URL;
if (!url) throw new Error('Pass the actual Vite URL: npm run test:chrome -- http://127.0.0.1:PORT');
const result = spawnSync(process.execPath, ['tests/stage.mjs', '3', url, '--headless'], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
