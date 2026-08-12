const db = require('../db');
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
if (!admin) throw new Error('Run npm run init-admin first');

const samples = [
  {
    name: '松弛感', aliases: '松弛文学', summary: '不被外界节奏裹挟，允许自己自然展开的状态。',
    origin: '从生活方式与心理话题进入社交媒体讨论。', original_meaning: '形容身体或精神上的放松。',
    new_meaning: '一种不急于证明自己、面对突发状况也保持从容的生活姿态。', usage_scenes: '夸赞一个人穿着随意但有自己的节奏，或形容处理尴尬场面时的淡定。', first_appearance: '2023 年中文社交媒体生活方式讨论。', tags: '生活,状态'
  },
  {
    name: '破防了', aliases: '我破防了', summary: '心理防线被某个瞬间击中，情绪突然涌上来。',
    origin: '原本是游戏语境里的防御机制被突破。', original_meaning: '防御状态被打破。',
    new_meaning: '被感动、委屈、好笑或刺痛到，情绪无法继续保持平静。', usage_scenes: '看到旧照片、感人故事，也可以在被朋友精准吐槽时使用。', first_appearance: '游戏直播与弹幕语境，后扩散至日常表达。', tags: '情绪,弹幕'
  },
  {
    name: '绝绝子', aliases: '绝了', summary: '对人或事物的强烈肯定，表示“太棒了”。',
    origin: '由“绝”叠词化而来，在短视频评论区获得高频使用。', original_meaning: '“绝”表示极致、非常。',
    new_meaning: '可正可反，依赖语气表达惊喜、赞叹或略带玩笑的夸张。', usage_scenes: '评价穿搭、美食、作品，也可用于调侃离谱的结果。', first_appearance: '短视频平台评论区。', tags: '夸赞,短视频'
  }
];
const insert = db.prepare(`INSERT INTO memes (name, aliases, summary, origin, original_meaning, new_meaning, usage_scenes, first_appearance, image_url, video_url, tags, contributor_id) VALUES (@name, @aliases, @summary, @origin, @original_meaning, @new_meaning, @usage_scenes, @first_appearance, @image_url, @video_url, @tags, @contributor_id)`);
const seed = db.transaction(() => {
  for (const sample of samples) {
    if (!db.prepare('SELECT id FROM memes WHERE name = ?').get(sample.name)) insert.run({ ...sample, image_url: '', video_url: '', contributor_id: admin.id });
  }
});
seed();
console.log(`Seeded ${samples.length} sample memes`);
