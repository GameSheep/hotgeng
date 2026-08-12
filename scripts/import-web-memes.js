const path = require('node:path');
const db = require('../db');

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'web-memes-2026-08-12.json'));
const dataset = require(inputPath);
if (!Array.isArray(dataset.memes) || dataset.memes.length === 0) throw new Error('Dataset has no memes');

const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
if (!admin) throw new Error('Run npm run init-admin first');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

const existing = new Set();
for (const meme of db.prepare('SELECT name, aliases FROM memes').all()) {
  existing.add(normalizeName(meme.name));
  for (const alias of String(meme.aliases || '').split(/[,，|/]/)) if (alias.trim()) existing.add(normalizeName(alias));
}

const insertMeme = db.prepare(`
  INSERT INTO memes (
    name, aliases, summary, origin, original_meaning, new_meaning,
    usage_scenes, first_appearance, image_url, video_url, tags,
    contributor_id, status
  ) VALUES (
    @name, @aliases, @summary, @origin, @original_meaning, @new_meaning,
    @usage_scenes, @first_appearance, @image_url, @video_url, @tags,
    @contributor_id, 'published'
  )
`);
const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name, normalized_name, status, created_by, reviewed_at) VALUES (?, ?, 'approved', ?, CURRENT_TIMESTAMP)");
const findTag = db.prepare('SELECT id FROM tags WHERE normalized_name = ?');
const attachTag = db.prepare('INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)');

let inserted = 0;
let skipped = 0;
db.transaction(() => {
  for (const meme of dataset.memes) {
    const key = normalizeName(meme.name);
    if (!key || existing.has(key)) {
      skipped += 1;
      continue;
    }
    const payload = {
      name: String(meme.name || '').trim(),
      aliases: String(meme.aliases || '').trim(),
      summary: String(meme.summary || '').trim(),
      origin: String(meme.origin || '').trim(),
      original_meaning: String(meme.original_meaning || '').trim(),
      new_meaning: String(meme.new_meaning || '').trim(),
      usage_scenes: String(meme.usage_scenes || '').trim(),
      first_appearance: String(meme.first_appearance || '').trim(),
      image_url: String(meme.image_url || '').trim(),
      video_url: String(meme.video_url || '').trim(),
      tags: String(meme.tags || '').trim(),
      contributor_id: admin.id
    };
    const result = insertMeme.run(payload);
    existing.add(key);
    inserted += 1;
    for (const raw of payload.tags.split(/[,，]/)) {
      const name = raw.trim().replace(/^#+/, '').replace(/\s+/g, '');
      const normalized = db.normalizeTag(name);
      if (!normalized) continue;
      insertTag.run(name, normalized, admin.id);
      const tag = findTag.get(normalized);
      if (tag) attachTag.run(result.lastInsertRowid, tag.id);
    }
  }
})();

console.log(JSON.stringify({ input: inputPath, dataset: dataset.memes.length, inserted, skipped, total: db.prepare('SELECT COUNT(*) AS n FROM memes').get().n }, null, 2));
