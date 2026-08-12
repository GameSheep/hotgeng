const test = require('node:test');
const assert = require('node:assert/strict');
const dataset = require('../data/web-memes-2026-08-12.json');
const editorial = require('../data/editorial-memes-2026-08-12.json');
const fullArchive = require('../data/full-archive-2026-08-12.json');

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

test('web meme dataset contains 500 unique entries', () => {
  assert.equal(dataset.memes.length, 500);
  assert.equal(new Set(dataset.memes.map((meme) => normalizeName(meme.name))).size, 500);
});

test('web meme dataset has complete archive and provenance fields', () => {
  const required = [
    'name', 'summary', 'origin', 'original_meaning', 'new_meaning',
    'usage_scenes', 'first_appearance', 'tags', 'source_url',
    'source_title', 'collected_at'
  ];
  for (const [index, meme] of dataset.memes.entries()) {
    for (const field of required) {
      assert.ok(String(meme[field] || '').trim(), `entry ${index + 1} (${meme.name}) is missing ${field}`);
    }
    assert.match(meme.source_url, /^https:\/\//, `${meme.name} has a non-HTTPS source`);
  }
});

test('web meme dataset does not contain scraper markup or disallowed slurs', () => {
  for (const meme of dataset.memes) {
    assert.doesNotMatch(meme.name, /[\[\]{}<>]/, `${meme.name} contains scraper markup`);
    assert.doesNotMatch(`${meme.name} ${meme.summary}`, /NMSL|CGG|妈死|支那|黑鬼|神蛆/i, `${meme.name} contains a disallowed slur`);
  }
});

test('editorial additions meet the detailed archive quality gate', () => {
  assert.ok(editorial.memes.length >= 15);
  assert.equal(new Set(editorial.memes.map((meme) => normalizeName(meme.name))).size, editorial.memes.length);
  for (const meme of editorial.memes) {
    assert.ok(meme.summary.length >= 45, `${meme.name} summary is too short`);
    assert.ok(meme.origin.length >= 70, `${meme.name} origin is too short`);
    assert.ok(meme.original_meaning.length >= 40, `${meme.name} original meaning is too short`);
    assert.ok(meme.new_meaning.length >= 45, `${meme.name} new meaning is too short`);
    assert.ok(meme.usage_scenes.length >= 50, `${meme.name} usage scenes are too short`);
    assert.ok(Array.isArray(meme.related_news) && meme.related_news.length >= 1, `${meme.name} has no related news`);
    for (const news of meme.related_news) {
      assert.match(news.url, /^https:\/\//, `${meme.name} has invalid news URL`);
      assert.match(news.published_at, /^2026-\d{2}-\d{2}$/, `${meme.name} has invalid news date`);
      assert.ok(news.title.length >= 8 && news.summary.length >= 25, `${meme.name} has shallow news context`);
    }
  }
});

test('editorial rewrites replace shallow legacy fields', () => {
  assert.ok(editorial.updates.length >= 10);
  for (const meme of editorial.updates) {
    for (const field of ['summary', 'origin', 'original_meaning', 'new_meaning', 'usage_scenes', 'first_appearance']) {
      assert.ok(String(meme[field] || '').length >= (field === 'first_appearance' ? 25 : 45), `${meme.name} has shallow ${field}`);
      assert.doesNotMatch(meme[field], /名称最初指向|用于社交媒体评论、群聊接梗|入选或代表/, `${meme.name} retains template copy`);
    }
  }
});

test('the full public archive clears the detailed quality gate', () => {
  const minimums = { summary: 70, origin: 100, original_meaning: 80, new_meaning: 90, usage_scenes: 90, first_appearance: 60 };
  const templates = /入选或代表|名称最初指向|用于社交媒体评论、群聊接梗|中文论坛、社交媒体或弹幕文化中反复使用/;
  assert.ok(fullArchive.memes.length >= 518);
  assert.equal(new Set(fullArchive.memes.map((meme) => normalizeName(meme.name))).size, fullArchive.memes.length);
  for (const meme of fullArchive.memes) {
    for (const [field, minimum] of Object.entries(minimums)) {
      assert.ok(meme[field].length >= minimum, `${meme.name} has shallow ${field}`);
      assert.doesNotMatch(meme[field], templates, `${meme.name} retains legacy template copy`);
    }
    assert.match(meme.research_method, /^(editorial|source_page|source_context)$/);
  }
  assert.equal(new Set(fullArchive.memes.map((meme) => meme.summary)).size, fullArchive.memes.length);
  assert.equal(new Set(fullArchive.memes.map((meme) => meme.origin)).size, fullArchive.memes.length);
});
