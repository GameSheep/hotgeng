const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const dataset = require('../data/web-memes-2026-08-12.json').memes;
const outputDir = path.join(__dirname, '..', 'work', 'geng-pages');
fs.mkdirSync(outputDir, { recursive: true });
const items = dataset.filter((meme) => meme.source_url.includes('gengbaike.heyfe.org/memes/')).map((meme) => ({ url: meme.source_url, file: path.join(outputDir, `${meme.source_url.split('/').filter(Boolean).at(-1)}.html`) }));
let index = 0;
let completed = 0;

function next() {
  const item = items[index++];
  if (!item) return;
  if (fs.existsSync(item.file) && fs.statSync(item.file).size > 10000) { completed += 1; process.stdout.write(`\r${completed}/${items.length}`); return next(); }
  const child = spawn('curl.exe', ['-L', '--retry', '2', '--retry-delay', '1', '--max-time', '35', '-sS', '-A', 'Mozilla/5.0', item.url, '-o', item.file], { stdio: 'ignore' });
  child.on('exit', () => { completed += 1; process.stdout.write(`\r${completed}/${items.length}`); next(); });
}
for (let i = 0; i < 8; i += 1) next();
const timer = setInterval(() => { if (completed >= items.length) { clearInterval(timer); console.log(`\nFetched ${completed} source pages`); } }, 250);
