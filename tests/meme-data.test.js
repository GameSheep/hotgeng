const test = require('node:test');
const assert = require('node:assert/strict');
const dataset = require('../data/web-memes-2026-08-12.json');

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
