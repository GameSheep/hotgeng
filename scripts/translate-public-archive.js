const fs = require('node:fs');
const path = require('node:path');

const input = require('../data/full-archive-2026-08-12.json');
const outputPath = path.join(__dirname, '..', 'data', 'international-memes-2026-08-12.json');
const fields = ['summary', 'origin', 'original_meaning', 'new_meaning', 'usage_scenes', 'first_appearance'];
const previous = fs.existsSync(outputPath) ? require(outputPath) : { memes: [] };
const done = new Map(previous.memes.map((meme) => [meme.name, meme]));
const pending = input.memes.filter((meme) => !done.has(meme.name));
let cursor = 0;
let active = 0;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function translate(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|en`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'meme-archive-international/1.0' } });
      const data = await response.json();
      if (response.ok && data.responseData?.translatedText) return String(data.responseData.translatedText).replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      throw new Error(data.responseDetails || `HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(800 * (attempt + 1));
    }
  }
}

function save() {
  const memes = input.memes.map((meme) => done.get(meme.name)).filter(Boolean);
  fs.writeFileSync(outputPath, `${JSON.stringify({ generated_at: new Date().toISOString(), total: memes.length, translation_notice: 'Machine-assisted draft. Chinese source text remains authoritative.', memes }, null, 2)}\n`);
  process.stdout.write(`\r${memes.length}/${input.memes.length}`);
}

async function worker() {
  active += 1;
  while (cursor < pending.length) {
    const meme = pending[cursor++];
    const values = await Promise.all(fields.map((field) => translate(meme[field])));
    done.set(meme.name, { name: meme.name, aliases_en: meme.aliases || '', fields: Object.fromEntries(fields.map((field, index) => [field, values[index]])) });
    if (done.size % 10 === 0) save();
    await sleep(50);
  }
  active -= 1;
}

Promise.all(Array.from({ length: 10 }, worker)).then(() => { save(); console.log(`\nWrote ${done.size} English records to ${outputPath}`); }).catch((error) => { save(); console.error(error.stack || error); process.exitCode = 1; });
