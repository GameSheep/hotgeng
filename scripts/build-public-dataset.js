const fs = require('node:fs');
const path = require('node:path');

const fullArchive = require('../data/full-archive-2026-08-12.json').memes;

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

function qualityOf(meme) {
  const values = ['summary', 'origin', 'original_meaning', 'new_meaning', 'usage_scenes'].map((key) => String(meme[key] || ''));
  const template = values.some((value) => /入选或代表|名称最初指向|用于社交媒体评论、群聊接梗|中文论坛、社交媒体或弹幕文化中反复使用/.test(value));
  return !template && values[0].length >= 70 && values[1].length >= 100 && values[2].length >= 80 && values[3].length >= 90 && values[4].length >= 90 && String(meme.first_appearance || '').length >= 60 ? 'detailed' : 'needs_review';
}

const merged = fullArchive;

const output = {
  generated_at: new Date().toISOString(),
  total: merged.length,
  memes: merged.map((meme) => ({ ...meme, related_news: meme.related_news || [], quality: qualityOf(meme) }))
};
const outputPath = path.join(__dirname, '..', 'sites-preview', 'public', 'memes.json');
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, total: output.total, detailed: output.memes.filter((meme) => meme.quality === 'detailed').length }, null, 2));
