const path = require('node:path');
const db = require('../db');

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'full-archive-2026-08-12.json'));
const dataset = require(inputPath);
if (!Array.isArray(dataset.memes) || dataset.memes.length < 500) throw new Error('Full archive dataset is incomplete');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

const rows = db.prepare('SELECT id, name FROM memes').all();
const byName = new Map(rows.map((row) => [normalizeName(row.name), row.id]));
const update = db.prepare(`UPDATE memes SET summary=@summary, origin=@origin, original_meaning=@original_meaning,
  new_meaning=@new_meaning, usage_scenes=@usage_scenes, first_appearance=@first_appearance, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
let updated = 0;
const missing = [];
db.transaction(() => {
  for (const meme of dataset.memes) {
    const id = byName.get(normalizeName(meme.name));
    if (!id) { missing.push(meme.name); continue; }
    update.run({ id, summary: meme.summary, origin: meme.origin, original_meaning: meme.original_meaning, new_meaning: meme.new_meaning, usage_scenes: meme.usage_scenes, first_appearance: meme.first_appearance });
    updated += 1;
  }
  const validation = byName.get(normalizeName('验证热梗'));
  if (validation) db.prepare("UPDATE memes SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(validation);
})();
console.log(JSON.stringify({ input: inputPath, updated, missing }, null, 2));
