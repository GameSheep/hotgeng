const path = require('node:path');
const db = require('../db');

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'editorial-memes-2026-08-12.json'));
const dataset = require(inputPath);
if (!Array.isArray(dataset.memes) || !Array.isArray(dataset.updates)) throw new Error('Editorial dataset must contain memes and updates');

const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
if (!admin) throw new Error('Run npm run init-admin first');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

const fields = ['aliases', 'summary', 'origin', 'original_meaning', 'new_meaning', 'usage_scenes', 'first_appearance', 'image_url', 'video_url', 'tags'];
const allMemes = db.prepare('SELECT id, name, aliases FROM memes').all();
const byName = new Map(allMemes.map((meme) => [normalizeName(meme.name), meme]));
for (const meme of allMemes) {
  for (const alias of String(meme.aliases || '').split(/[,，|/]/)) if (alias.trim() && !byName.has(normalizeName(alias))) byName.set(normalizeName(alias), meme);
}

const insertMeme = db.prepare(`INSERT INTO memes (name, aliases, summary, origin, original_meaning, new_meaning, usage_scenes, first_appearance, image_url, video_url, tags, contributor_id, status)
  VALUES (@name, @aliases, @summary, @origin, @original_meaning, @new_meaning, @usage_scenes, @first_appearance, @image_url, @video_url, @tags, @contributor_id, 'published')`);
const updateMeme = db.prepare(`UPDATE memes SET aliases = @aliases, summary = @summary, origin = @origin, original_meaning = @original_meaning,
  new_meaning = @new_meaning, usage_scenes = @usage_scenes, first_appearance = @first_appearance, image_url = @image_url,
  video_url = @video_url, tags = @tags, contributor_id = @contributor_id, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name, normalized_name, status, created_by, reviewed_at) VALUES (?, ?, 'approved', ?, CURRENT_TIMESTAMP)");
const findTag = db.prepare('SELECT id FROM tags WHERE normalized_name = ?');
const clearTags = db.prepare('DELETE FROM meme_tags WHERE meme_id = ?');
const attachTag = db.prepare('INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)');
const insertNews = db.prepare(`INSERT INTO meme_news (meme_id, title, url, source, published_at, kind, summary)
  VALUES (@meme_id, @title, @url, @source, @published_at, @kind, @summary)
  ON CONFLICT(meme_id, url) DO UPDATE SET title=excluded.title, source=excluded.source, published_at=excluded.published_at, kind=excluded.kind, summary=excluded.summary`);

function payloadOf(meme, existing = {}) {
  const payload = { name: String(meme.name || existing.name || '').trim(), contributor_id: admin.id };
  for (const field of fields) payload[field] = String(meme[field] ?? existing[field] ?? '').trim();
  return payload;
}

function syncTags(memeId, tags) {
  clearTags.run(memeId);
  for (const raw of String(tags || '').split(/[,，]/)) {
    const name = raw.trim().replace(/^#+/, '').replace(/\s+/g, '');
    const normalized = db.normalizeTag(name);
    if (!normalized) continue;
    insertTag.run(name, normalized, admin.id);
    const tag = findTag.get(normalized);
    if (tag) attachTag.run(memeId, tag.id);
  }
}

let inserted = 0;
let updated = 0;
let news = 0;
db.transaction(() => {
  for (const meme of dataset.memes) {
    const key = normalizeName(meme.name);
    const existing = byName.get(key);
    const payload = payloadOf(meme, existing || {});
    let memeId;
    if (existing) {
      memeId = existing.id;
      updateMeme.run({ ...payload, id: memeId });
      updated += 1;
    } else {
      memeId = Number(insertMeme.run(payload).lastInsertRowid);
      byName.set(key, { id: memeId, name: payload.name, aliases: payload.aliases });
      inserted += 1;
    }
    syncTags(memeId, payload.tags);
    for (const item of meme.related_news || []) {
      insertNews.run({
        meme_id: memeId,
        title: String(item.title || '').trim(),
        url: String(item.url || '').trim(),
        source: String(item.source || '').trim(),
        published_at: String(item.published_at || '').trim(),
        kind: ['news', 'analysis', 'source', 'collection'].includes(item.kind) ? item.kind : 'news',
        summary: String(item.summary || '').trim()
      });
      news += 1;
    }
  }
  for (const patch of dataset.updates) {
    const existing = byName.get(normalizeName(patch.name));
    if (!existing) throw new Error(`Cannot update missing meme: ${patch.name}`);
    const current = db.prepare('SELECT * FROM memes WHERE id = ?').get(existing.id);
    const payload = payloadOf(patch, current);
    updateMeme.run({ ...payload, id: existing.id });
    syncTags(existing.id, payload.tags);
    updated += 1;
  }
})();

console.log(JSON.stringify({ input: inputPath, inserted, updated, news, total: db.prepare('SELECT COUNT(*) AS n FROM memes').get().n }, null, 2));
