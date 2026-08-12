const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'meme-archive.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS memes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT '',
    original_meaning TEXT NOT NULL DEFAULT '',
    new_meaning TEXT NOT NULL DEFAULT '',
    usage_scenes TEXT NOT NULL DEFAULT '',
    first_appearance TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    contributor_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meme_id INTEGER REFERENCES memes(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('create', 'update', 'delete')),
    payload_json TEXT NOT NULL,
    change_note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id INTEGER REFERENCES users(id),
    review_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'merged')),
    canonical_tag_id INTEGER REFERENCES tags(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS meme_tags (
    meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (meme_id, tag_id)
  );
  CREATE TABLE IF NOT EXISTS meme_views (
    meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
    view_day TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (meme_id, view_day, visitor_hash)
  );
  CREATE TABLE IF NOT EXISTS featured_memes (
    meme_id INTEGER PRIMARY KEY REFERENCES memes(id) ON DELETE CASCADE,
    weight INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS meme_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meme_id INTEGER NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'news' CHECK (kind IN ('news', 'analysis', 'source', 'collection')),
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meme_id, url)
  );
  CREATE INDEX IF NOT EXISTS idx_memes_status_updated ON memes(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_revisions_status_created ON revisions(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_tags_status_name ON tags(status, normalized_name);
  CREATE INDEX IF NOT EXISTS idx_meme_tags_tag_meme ON meme_tags(tag_id, meme_id);
  CREATE INDEX IF NOT EXISTS idx_meme_views_day_meme ON meme_views(view_day DESC, meme_id);
  CREATE INDEX IF NOT EXISTS idx_meme_news_meme_date ON meme_news(meme_id, published_at DESC, id DESC);
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('email')) db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''");

function normalizeTag(value) {
  return String(value || '').trim().replace(/^#+/, '').replace(/\s+/g, '').toLocaleLowerCase('zh-CN');
}

const findTag = db.prepare('SELECT id FROM tags WHERE normalized_name = ?');
const insertLegacyTag = db.prepare("INSERT OR IGNORE INTO tags (name, normalized_name, status) VALUES (?, ?, 'approved')");
const attachLegacyTag = db.prepare('INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)');
db.transaction(() => {
  for (const meme of db.prepare("SELECT id, tags FROM memes WHERE tags != ''").all()) {
    for (const rawTag of meme.tags.split(/[,，]/)) {
      const name = rawTag.trim().replace(/^#+/, '').replace(/\s+/g, '');
      const normalized = normalizeTag(name);
      if (!normalized) continue;
      insertLegacyTag.run(name, normalized);
      const tag = findTag.get(normalized);
      if (tag) attachLegacyTag.run(meme.id, tag.id);
    }
  }
})();

db.normalizeTag = normalizeTag;

module.exports = db;
