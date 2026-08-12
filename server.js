const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const db = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionDays = 7;
const fields = ['name', 'aliases', 'summary', 'origin', 'original_meaning', 'new_meaning', 'usage_scenes', 'first_appearance', 'image_url', 'video_url', 'tags'];

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return expected && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=')));
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie).meme_session;
  if (!token) return null;
  const session = db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?`).get(token, Date.now());
  return session || null;
}

function requireUser(req, res, next) {
  req.user = currentUser(req);
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

function requireAdmin(req, res, next) {
  req.user = currentUser(req);
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '只有管理员可以执行此操作' });
  next();
}

function cleanMeme(input) {
  const result = {};
  for (const field of fields) result[field] = String(input[field] || '').trim();
  if (!result.name || result.name.length > 80) throw new Error('热梗名称不能为空且不超过 80 个字符');
  for (const key of ['image_url', 'video_url']) {
    if (result[key] && !/^https:\/\//i.test(result[key])) throw new Error('图片和视频链接必须使用 HTTPS');
  }
  for (const value of Object.values(result)) if (value.length > 5000) throw new Error('单个字段不能超过 5000 个字符');
  const tags = [...new Set(result.tags.split(/[,，]/).map((tag) => tag.trim().replace(/^#+/, '').replace(/\s+/g, '')).filter(Boolean))];
  if (tags.length > 5) throw new Error('每条档案最多添加 5 个标签');
  if (tags.some((tag) => tag.length < 2 || tag.length > 12)) throw new Error('标签需为 2-12 个字符');
  result.tags = tags.join(',');
  return result;
}

function tagsForMemes(ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT mt.meme_id, COALESCE(c.name, t.name) AS name
    FROM meme_tags mt JOIN tags t ON t.id = mt.tag_id
    LEFT JOIN tags c ON c.id = t.canonical_tag_id
    WHERE mt.meme_id IN (${placeholders}) AND COALESCE(c.status, t.status) = 'approved'
    GROUP BY mt.meme_id, COALESCE(c.id, t.id) ORDER BY COALESCE(c.name, t.name)`).all(...ids);
  const result = new Map(ids.map((id) => [id, []]));
  for (const row of rows) result.get(row.meme_id)?.push(row.name);
  return result;
}

function publicMemes(rows) {
  const tagMap = tagsForMemes(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, tags: (tagMap.get(row.id) || []).join(','), contributor: row.contributor_name || '编辑部' }));
}

function encodeCursor(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decodeCursor(value) {
  if (!value) return null;
  try { return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8')); } catch { return null; }
}

function tagFilterSql(rawTags, params) {
  const tags = [...new Set(String(rawTags || '').split(',').map(db.normalizeTag).filter(Boolean))].slice(0, 5);
  return tags.map((tag) => {
    params.push(tag);
    return `EXISTS (SELECT 1 FROM meme_tags filter_mt JOIN tags filter_t ON filter_t.id = filter_mt.tag_id
      LEFT JOIN tags filter_c ON filter_c.id = filter_t.canonical_tag_id
      WHERE filter_mt.meme_id = memes.id AND COALESCE(filter_c.normalized_name, filter_t.normalized_name) = ?
      AND COALESCE(filter_c.status, filter_t.status) = 'approved')`;
  });
}

function syncMemeTags(memeId, tagString, userId, approveNew = false) {
  const tags = String(tagString || '').split(',').map((name) => ({ name, normalized: db.normalizeTag(name) })).filter((tag) => tag.normalized);
  const find = db.prepare('SELECT * FROM tags WHERE normalized_name = ?');
  const create = db.prepare('INSERT INTO tags (name, normalized_name, status, created_by, reviewed_at) VALUES (?, ?, ?, ?, ?)');
  const attach = db.prepare('INSERT OR IGNORE INTO meme_tags (meme_id, tag_id) VALUES (?, ?)');
  db.prepare('DELETE FROM meme_tags WHERE meme_id = ?').run(memeId);
  for (const tag of tags) {
    let row = find.get(tag.normalized);
    if (!row) {
      const status = approveNew ? 'approved' : 'pending';
      const result = create.run(tag.name, tag.normalized, status, userId || null, approveNew ? new Date().toISOString() : null);
      row = { id: result.lastInsertRowid };
    }
    attach.run(memeId, row.id);
  }
}

app.get('/api/memes', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '36', 10) || 36, 1), 60);
  const offset = Math.max(Number.parseInt(req.query.offset || '0', 10) || 0, 0);
  const sort = req.query.sort === 'popular' ? 'popular' : 'newest';
  const cursor = decodeCursor(req.query.cursor);
  const params = [q, like, like, like, like];
  const filters = [`memes.status = 'published'`, `(? = '' OR memes.name LIKE ? OR memes.aliases LIKE ? OR memes.summary LIKE ? OR EXISTS (
    SELECT 1 FROM meme_tags search_mt JOIN tags search_t ON search_t.id = search_mt.tag_id
    LEFT JOIN tags search_c ON search_c.id = search_t.canonical_tag_id
    WHERE search_mt.meme_id = memes.id AND COALESCE(search_c.name, search_t.name) LIKE ?))`, ...tagFilterSql(req.query.tags, params)];
  const where = filters.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS count FROM memes WHERE ${where}`).get(...params).count;
  const popularity = `(SELECT COALESCE(SUM(MAX(1, 8 - CAST(julianday('now') - julianday(mv.view_day) AS INTEGER))), 0) FROM meme_views mv WHERE mv.meme_id = memes.id AND mv.view_day >= date('now', '-7 days'))`;
  const cursorParams = [...params];
  let cursorWhere = '';
  if (cursor && sort === 'newest' && cursor.updated_at && Number.isInteger(cursor.id)) {
    cursorWhere = ' AND (memes.updated_at < ? OR (memes.updated_at = ? AND memes.id < ?))';
    cursorParams.push(cursor.updated_at, cursor.updated_at, cursor.id);
  }
  const order = sort === 'popular' ? 'popularity_score DESC, memes.updated_at DESC, memes.id DESC' : 'memes.updated_at DESC, memes.id DESC';
  const pagination = cursor && sort === 'newest' ? '' : ' OFFSET ?';
  const rows = db.prepare(`SELECT memes.*, users.username AS contributor_name, ${popularity} AS popularity_score FROM memes
    LEFT JOIN users ON users.id = memes.contributor_id
    WHERE ${where}${cursorWhere} ORDER BY ${order} LIMIT ?${pagination}`).all(...cursorParams, limit, ...(pagination ? [offset] : []));
  const last = rows.at(-1);
  const nextCursor = sort === 'newest' && rows.length === limit ? encodeCursor({ updated_at: last.updated_at, id: last.id }) : null;
  res.json({ memes: publicMemes(rows), total, limit, offset, next_cursor: nextCursor, has_more: offset + rows.length < total });
});

app.get('/api/memes/:id', (req, res) => {
  const row = db.prepare(`SELECT memes.*, users.username AS contributor_name FROM memes
    LEFT JOIN users ON users.id = memes.contributor_id WHERE memes.id = ? AND memes.status = 'published'`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '热梗不存在' });
  res.json({ meme: publicMemes([row])[0] });
});

app.post('/api/memes/:id/view', (req, res) => {
  if (!db.prepare("SELECT id FROM memes WHERE id = ? AND status = 'published'").get(req.params.id)) return res.status(404).json({ error: '热梗不存在' });
  let visitorId = parseCookies(req.headers.cookie).meme_visitor;
  if (!/^[a-f0-9]{32}$/.test(visitorId || '')) {
    visitorId = crypto.randomBytes(16).toString('hex');
    res.append('Set-Cookie', `meme_visitor=${visitorId}; Max-Age=31536000; HttpOnly; SameSite=Lax; Path=/`);
  }
  const visitorHash = crypto.createHash('sha256').update(`${visitorId}|${process.env.VIEW_HASH_SALT || 'local-meme-archive'}`).digest('hex');
  db.prepare("INSERT OR IGNORE INTO meme_views (meme_id, view_day, visitor_hash) VALUES (?, date('now'), ?)").run(req.params.id, visitorHash);
  res.status(204).end();
});

app.get('/api/discover', (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10) || 20, 8), 28);
  const recentLimit = Math.ceil(limit * .4);
  const popularLimit = Math.ceil(limit * .4);
  const selected = new Map();
  const baseSelect = `SELECT memes.*, users.username AS contributor_name FROM memes LEFT JOIN users ON users.id = memes.contributor_id`;
  const recent = db.prepare(`${baseSelect} WHERE memes.status = 'published' ORDER BY memes.created_at DESC, memes.id DESC LIMIT ?`).all(recentLimit);
  for (const row of recent) selected.set(row.id, { ...row, signal: 'new', signal_score: 1 });
  const popular = db.prepare(`SELECT memes.*, users.username AS contributor_name,
    COUNT(mv.visitor_hash) AS recent_views,
    SUM(MAX(1, 8 - CAST(julianday('now') - julianday(mv.view_day) AS INTEGER))) AS hot_score
    FROM memes JOIN meme_views mv ON mv.meme_id = memes.id
    LEFT JOIN users ON users.id = memes.contributor_id
    WHERE memes.status = 'published' AND mv.view_day >= date('now', '-7 days')
    GROUP BY memes.id HAVING recent_views >= 2
    ORDER BY hot_score DESC, memes.updated_at DESC LIMIT ?`).all(popularLimit);
  for (const row of popular) selected.set(row.id, { ...row, signal: 'hot', signal_score: Number(row.hot_score) || 1 });
  const remaining = Math.max(0, limit - selected.size);
  if (remaining) {
    const excluded = [...selected.keys()];
    const exclusion = excluded.length ? `AND memes.id NOT IN (${excluded.map(() => '?').join(',')})` : '';
    const editorial = db.prepare(`${baseSelect} LEFT JOIN featured_memes f ON f.meme_id = memes.id
      WHERE memes.status = 'published' ${exclusion} ORDER BY COALESCE(f.weight, 0) DESC, RANDOM() LIMIT ?`).all(...excluded, remaining);
    for (const row of editorial) selected.set(row.id, { ...row, signal: 'editorial', signal_score: 1 });
  }
  res.json({ memes: publicMemes([...selected.values()].slice(0, limit)) });
});

app.get('/api/tags', (req, res) => {
  const q = db.normalizeTag(req.query.q);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '40', 10) || 40, 1), 100);
  const rows = db.prepare(`SELECT COALESCE(c.id, t.id) AS id, COALESCE(c.name, t.name) AS name, COALESCE(c.normalized_name, t.normalized_name) AS normalized_name, COUNT(DISTINCT mt.meme_id) AS meme_count,
    COUNT(DISTINCT CASE WHEN memes.created_at >= datetime('now', '-30 days') THEN memes.id END) AS recent_count,
    COUNT(DISTINCT CASE WHEN mv.view_day >= date('now', '-30 days') THEN mv.visitor_hash END) AS recent_views
    FROM tags t LEFT JOIN tags c ON c.id = t.canonical_tag_id
    JOIN meme_tags mt ON mt.tag_id = t.id JOIN memes ON memes.id = mt.meme_id AND memes.status = 'published'
    LEFT JOIN meme_views mv ON mv.meme_id = memes.id
    WHERE COALESCE(c.status, t.status) = 'approved' AND (? = '' OR COALESCE(c.normalized_name, t.normalized_name) LIKE ?)
    GROUP BY COALESCE(c.id, t.id) ORDER BY (recent_count * 4 + recent_views) DESC, meme_count DESC, name LIMIT ?`)
    .all(q, `%${q}%`, limit).map((row) => ({ ...row, activity_score: row.recent_count * 4 + row.recent_views }));
  res.json({ tags: rows });
});

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[\w\u4e00-\u9fff-]{2,24}$/.test(username) || password.length < 8 || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: '用户名需为 2-24 个字符，密码至少 8 位，并填写有效邮箱' });
  try {
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: '邮箱已存在' });
    const result = db.prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)').run(username, hashPassword(password), email);
    createSession(res, result.lastInsertRowid);
    res.status(201).json({ user: { id: result.lastInsertRowid, username, role: 'user' } });
  } catch { res.status(409).json({ error: '用户名已存在' }); }
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, Date.now() + 30 * 60 * 1000);
    console.log(`Password reset link: http://localhost:${port}/#/reset-password?token=${token}`);
  }
  res.json({ ok: true, message: '如果邮箱存在，找回链接已发送。开发环境请查看服务端日志。' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  const reset = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > ?').get(token, Date.now());
  if (!reset || password.length < 8) return res.status(400).json({ error: '找回链接已失效，或新密码少于 8 位' });
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), reset.user_id);
    db.prepare('UPDATE password_resets SET used_at = ? WHERE token = ?').run(Date.now(), token);
  })();
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) return res.status(401).json({ error: '用户名或密码错误' });
  createSession(res, user.id);
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).meme_session;
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.setHeader('Set-Cookie', 'meme_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/').json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.json({ user: null });
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/me/revisions', requireUser, (req, res) => {
  const rows = db.prepare(`SELECT revisions.*, memes.name AS meme_name FROM revisions
    LEFT JOIN memes ON memes.id = revisions.meme_id WHERE revisions.author_id = ? ORDER BY revisions.created_at DESC`).all(req.user.id);
  res.json({ revisions: rows });
});

app.post('/api/revisions', requireUser, (req, res) => {
  try {
    const meme = cleanMeme(req.body);
    const type = req.body.meme_id ? 'update' : 'create';
    if (type === 'update' && !db.prepare("SELECT id FROM memes WHERE id = ? AND status = 'published'").get(req.body.meme_id)) return res.status(404).json({ error: '热梗不存在' });
    const result = db.prepare(`INSERT INTO revisions (meme_id, author_id, type, payload_json, change_note) VALUES (?, ?, ?, ?, ?)`)
      .run(req.body.meme_id || null, req.user.id, type, JSON.stringify(meme), String(req.body.change_note || '').trim());
    res.status(201).json({ revision_id: result.lastInsertRowid });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('/api/admin/revisions', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT revisions.*, users.username AS author_name, memes.name AS meme_name
    FROM revisions JOIN users ON users.id = revisions.author_id LEFT JOIN memes ON memes.id = revisions.meme_id
    WHERE revisions.status = 'pending' ORDER BY revisions.created_at ASC`).all();
  res.json({ revisions: rows.map((row) => ({ ...row, payload: JSON.parse(row.payload_json) })) });
});

app.post('/api/admin/revisions/:id/approve', requireAdmin, (req, res) => {
  const revision = db.prepare("SELECT * FROM revisions WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!revision) return res.status(404).json({ error: '审核申请不存在或已处理' });
  const payload = JSON.parse(revision.payload_json);
  const approve = db.transaction(() => {
    if (revision.type === 'create') {
      const columns = fields.join(', ');
      const values = fields.map((field) => payload[field]);
      const placeholders = fields.map(() => '?').join(', ');
      const result = db.prepare(`INSERT INTO memes (${columns}, contributor_id) VALUES (${placeholders}, ?)`).run(...values, revision.author_id);
      db.prepare('UPDATE revisions SET meme_id = ? WHERE id = ?').run(result.lastInsertRowid, revision.id);
      syncMemeTags(result.lastInsertRowid, payload.tags, revision.author_id, false);
    } else if (revision.type === 'delete') {
      db.prepare("UPDATE memes SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(revision.meme_id);
    } else {
      const assignments = fields.map((field) => `${field} = @${field}`).join(', ');
      db.prepare(`UPDATE memes SET ${assignments}, contributor_id = @contributor_id, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
        .run({ ...payload, contributor_id: revision.author_id, id: revision.meme_id });
      syncMemeTags(revision.meme_id, payload.tags, revision.author_id, false);
    }
    db.prepare("UPDATE revisions SET status = 'approved', reviewer_id = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.user.id, String(req.body.review_note || '').trim(), revision.id);
  });
  approve();
  res.json({ ok: true });
});

app.post('/api/admin/revisions/:id/reject', requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE revisions SET status = 'rejected', reviewer_id = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
    .run(req.user.id, String(req.body.review_note || '').trim(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: '审核申请不存在或已处理' });
  res.json({ ok: true });
});

app.get('/api/admin/tags', requireAdmin, (req, res) => {
  const tags = db.prepare(`SELECT tags.*, users.username AS creator_name,
    (SELECT COUNT(*) FROM meme_tags WHERE meme_tags.tag_id = tags.id) AS meme_count
    FROM tags LEFT JOIN users ON users.id = tags.created_by
    WHERE tags.status = 'pending' ORDER BY tags.created_at ASC`).all();
  res.json({ tags });
});

app.post('/api/admin/tags/:id/approve', requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE tags SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: '标签不存在或已处理' });
  res.json({ ok: true });
});

app.post('/api/admin/tags/:id/merge', requireAdmin, (req, res) => {
  const targetName = db.normalizeTag(req.body.target);
  const source = db.prepare("SELECT * FROM tags WHERE id = ? AND status != 'merged'").get(req.params.id);
  const target = db.prepare("SELECT * FROM tags WHERE normalized_name = ? AND status = 'approved'").get(targetName);
  if (!source || !target || source.id === target.id) return res.status(400).json({ error: '请选择另一个已通过标签作为合并目标' });
  db.prepare("UPDATE tags SET status = 'merged', canonical_tag_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(target.id, source.id);
  res.json({ ok: true });
});

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + sessionDays * 86400000);
  res.setHeader('Set-Cookie', `meme_session=${token}; Max-Age=${sessionDays * 86400}; HttpOnly; SameSite=Lax; Path=/`);
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
if (require.main === module) app.listen(port, () => console.log(`Meme archive running at http://localhost:${port}`));

module.exports = { app, cleanMeme };
