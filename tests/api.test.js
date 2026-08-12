const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanMeme } = require('../server');
const db = require('../db');

test('cleanMeme requires a name and accepts valid https media', () => {
  const meme = cleanMeme({ name: '测试梗', image_url: 'https://example.com/image.jpg' });
  assert.equal(meme.name, '测试梗');
  assert.equal(meme.image_url, 'https://example.com/image.jpg');
});

test('cleanMeme rejects non-https media', () => {
  assert.throws(() => cleanMeme({ name: '测试梗', image_url: 'javascript:alert(1)' }), /HTTPS/);
});

test('cleanMeme normalizes free tags and removes duplicates', () => {
  const meme = cleanMeme({ name: '测试梗', tags: '#情绪， 弹幕,情绪' });
  assert.equal(meme.tags, '情绪,弹幕');
});

test('cleanMeme limits free tags to five', () => {
  assert.throws(() => cleanMeme({ name: '测试梗', tags: '标签一,标签二,标签三,标签四,标签五,标签六' }), /最多添加 5 个标签/);
});

test('editorial detail data exposes related news and quality', () => {
  const row = db.prepare("SELECT * FROM memes WHERE name = '养龙虾'").get();
  if (!row) return;
  const news = db.prepare('SELECT * FROM meme_news WHERE meme_id = ? ORDER BY published_at DESC').all(row.id);
  assert.ok(news.length >= 2);
  assert.match(news[0].url, /^https:\/\//);
  assert.ok(row.origin.length >= 70);
});
