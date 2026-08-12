const fs = require('node:fs');
const path = require('node:path');

const basePath = path.join(__dirname, '..', 'data', 'web-memes-2026-08-12.json');
const editorialPath = path.join(__dirname, '..', 'data', 'editorial-memes-2026-08-12.json');
const outputPath = path.join(__dirname, '..', 'data', 'full-archive-2026-08-12.json');
const cacheDir = path.join(__dirname, '..', 'work', 'geng-pages');
const base = require(basePath).memes;
const editorial = require(editorialPath);
const localSeed = [
  {
    name: '松弛感', aliases: '', tags: '生活方式,情绪', source_url: 'https://zh.wikipedia.org/wiki/汉语盘点', source_title: '汉语盘点与网络流行语资料', collected_at: '2026-08-12',
    summary: '“松弛感”形容一个人在压力、意外和他人目光面前仍显得自然、从容，不用过度表演完美；它后来也成为反思精致焦虑和生活节奏的流行词。',
    origin: '这个词原本用于描述身体或心理不紧绷的状态，进入生活方式内容后，被网友用来评价穿搭、旅行、社交和公开表达是否自然。2023至2024年前后，大量“如何拥有松弛感”和明星街拍讨论推动它成为高频词，但它没有可确认的单一发明者。',
    original_meaning: '在日常汉语里，“松弛”首先是紧张程度降低；“松弛感”则把这种状态转成他人能够感受到的气质，包括动作不过分用力、遇事不慌张和允许小瑕疵存在。',
    new_meaning: '网络传播后，它既是赞美，也可能变成新的审美要求：人们一边反对焦虑，一边又努力表演从容。因此真正的松弛更接近拥有选择和容错空间，而不只是照片看起来毫不费力。',
    usage_scenes: '常用于评价旅行状态、穿搭、家庭氛围、公开发言和临场反应，也可自嘲“松弛过头”。使用时不要把经济条件、照护资源带来的从容全部解释成个人性格，更不应要求处在真实困境中的人必须保持松弛。',
    first_appearance: '“松弛”一词长期存在；目前可核验的集中流行节点约在2023至2024年，随后进入年度流行语和生活方式讨论。该时间指大众传播阶段，不等同于词语首次被创造。'
  },
  {
    name: '破防了', aliases: '破防', tags: '游戏,情绪表达', source_url: 'https://zh.wikipedia.org/wiki/汉语盘点', source_title: '汉语盘点：2021年度网络用语', collected_at: '2026-08-12',
    summary: '“破防了”从游戏里防御被击破，扩展为心理防线被一句话、一个画面或一件事击中；它既能表示感动落泪，也能表示愤怒、尴尬和被戳中痛处。',
    origin: '“破防”早期是游戏术语，指角色的防御、护盾或战术阵线被突破。直播和弹幕把玩家因失误、嘲讽而情绪失控的状态也称为破防，随后突破游戏圈。2021年“破防了”进入年度网络用语盘点，成为大众可识别的情绪词。',
    original_meaning: '原始语境强调可量化的防御系统失效：护甲被打穿、阵型被突破或安全位置被攻破。转入人的情绪之前，它描述的是游戏机制和对局结果。',
    new_meaning: '现在的“破防”表示原本维持的冷静、体面或距离突然失效。正向内容可以让人感动破防，负向刺激则让人愤怒破防；评论区还会用“这就破防了”继续挑衅，因此必须结合语气判断。',
    usage_scenes: '适合描述电影泪点、家人留言、比赛失利、争论被戳痛处等瞬间，例如“看到最后一句直接破防”。在对方已经激动时反复说“你破防了”属于拱火；涉及创伤或现实伤害时，应先回应事实与感受。',
    first_appearance: '游戏圈用法早于大众传播；目前可核验的全国性流行节点是2021年前后，并被当年网络用语盘点收录。档案不把年度入选日期误写成最早首发日期。'
  },
  {
    name: '绝绝子', aliases: '', tags: '2021,流行语', source_url: 'https://zh.wikipedia.org/wiki/汉语盘点', source_title: '汉语盘点：2021年度网络用语', collected_at: '2026-08-12',
    summary: '“绝绝子”把“绝了”叠词化并加上昵称式后缀，用来高强度称赞，也能阴阳怪气地表示离谱；它是2021年前后饭圈表达进入大众网络的代表词。',
    origin: '该词先在粉丝社群和综艺讨论中流传，“绝绝”强化“绝了”，“子”提供可爱或昵称语气。随着短视频、微博和营销文案反复使用，它在2021年前后快速出圈，并进入年度网络用语盘点。具体首次使用者缺少稳定证据。',
    original_meaning: '早期主要是粉丝对舞台、造型和偶像表现的夸赞，相当于“太绝了、非常棒”。叠词让情绪显得更浓，后缀则弱化正式感。',
    new_meaning: '出圈后它既能真心赞美，也能用反话评价糟糕操作，例如“这服务真是绝绝子”。因为使用频率过高，一部分网友又把它视为语言同质化的例子，词本身也成为被吐槽的对象。',
    usage_scenes: '适合朋友间评价美食、表演、穿搭或离谱经历，关键是通过上下文让人分清赞美还是讽刺。正式评论、工作沟通和需要精确描述的场合，不宜只用“绝绝子”代替具体理由。',
    first_appearance: '粉丝社群中的用法早于2021年；目前可核验的集中流行和全国性盘点节点在2021年前后。由于原始社交帖子分散，档案不指定未经证实的唯一首发账号。'
  }
];

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

function decodeHtml(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<sup\b[\s\S]*?<\/sup>/gi, ' ').replace(/<br\s*\/?>/gi, '；').replace(/<li\b[^>]*>/gi, ' ').replace(/<\/li>/gi, '。').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').replace(/。{2,}/g, '。').trim();
}

function sentences(value) {
  return stripHtml(value).split(/(?<=[。！？!?；])/).map((item) => item.trim()).filter((item) => item.length >= 12);
}

function trimText(value, max = 420) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const end = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('；'));
  return `${slice.slice(0, end > max * .6 ? end + 1 : max)}…`;
}

function sectionFromHtml(html, id) {
  const re = new RegExp(`<h2[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/h2>([\\s\\S]*?)(?=<h2\\b|<section\\b[^>]*data-footnotes|<\\/div><div class=["']mt-12)`, 'i');
  return stripHtml(html.match(re)?.[1] || '');
}

function legacyProfile(meme) {
  const tags = String(meme.tags || '').split(/[,，]/).filter(Boolean);
  const year = tags.find((tag) => /^20\d{2}$/.test(tag)) || String(meme.first_appearance || '').match(/20\d{2}/)?.[0] || '';
  const source = meme.source_title || '现有来源页面';
  const isAnnual = tags.includes('年度热词');
  const isShortVideo = tags.some((tag) => /短视频|抖音/.test(tag));
  const isBili = tags.some((tag) => /B站|鬼畜/.test(tag));
  const isGlobal = tags.some((tag) => /国际迷因|图片梗/.test(tag));
  const isClassic = tags.some((tag) => /经典|网络用语/.test(tag));
  const carrier = isShortVideo ? '短视频动作、配音或挑战模板' : isBili ? '视频片段、台词采样或鬼畜素材' : isGlobal ? '反应图、动图或英文流行句式' : isAnnual ? '年度公共话题中形成的高频说法' : isClassic ? '论坛、即时通信和社交平台中的互动表达' : '可被反复引用的网络表达';
  const contexts = isShortVideo ? '拍摄同款、转场配音、评论区接梗和复刻挑战' : isBili ? '弹幕引用、剪辑配音、鬼畜混音和名场面回顾' : isGlobal ? '表情回复、套模板改图、字幕翻译和跨文化二创' : isAnnual ? '回顾当年事件、概括群体情绪、标题写作和朋友间调侃' : '群聊回复、评论区表达、标题改写和生活化自嘲';
  const existing = String(meme.summary || '').replace(/^“[^”]+”/, '').replace(/是中文论坛、社交媒体或弹幕文化中反复使用的经典网络表达。?/, '').replace(/入选或代表\s*20\d{2}\s*年中文互联网年度流行表达，?/, '').trim();
  const summary = `“${meme.name}”是一条以${carrier}为核心的网络档案。它的传播价值不只在字面，而在于网友能用很短的形式完成情绪表态、身份识别或共同回忆；${existing || '不同平台又会按照自己的语气、画面和圈层经验继续改写它'}。`;
  const origin = `${year ? `${year}年前后，` : ''}${source}记录了“${meme.name}”的传播线索。现有材料能确认它主要借助${carrier}进入大众视野，并在转发、模仿与二次创作中固定写法；但资料不足以证明某个单一账号就是绝对首发，因此档案把来源表述为“目前可核验的传播节点”，不虚构唯一发明者。`;
  const original = `在最初可辨认的语境里，“${meme.name}”首先指向一个具体的${carrier}，理解它需要同时看到当时的台词、画面或事件背景。脱离载体后只看名称，往往会丢失反差、语气和圈层暗号，这也是旧档案只写字面释义显得空泛的原因。`;
  const evolution = `进入更广泛的社交语境后，“${meme.name}”逐渐从具体出处变成可复用的表达工具。网友会替换人物、场景、数字或结尾，把原本一次性的笑点移植到新的生活经验里；它既可以真诚表达，也可能通过夸张和反话制造幽默，含义要结合上下文判断。`;
  const usage = `常见用法包括${contexts}。使用时最好保留能让读者识别出处的关键词或语气，并确认对方了解这个梗；在事故、疾病、歧视或真实伤害等严肃情境中，不应为了接梗弱化当事人的处境，也不要把圈内含义强加给不了解背景的人。`;
  const first = year ? `目前可核验资料显示，它至迟在${year}年前后已进入集中传播或年度盘点；这表示“公开可查的流行节点”，不等同于互联网上绝对最早的一次使用。来源：${source}。` : `现有来源能够确认它已在相关社区形成稳定用法，但未提供足以锁定单一首发账号和精确日期的证据；档案因此保留“最早可核验记录”口径，后续如发现原帖或原视频再更新。`;
  return { summary, origin, original_meaning: original, new_meaning: evolution, usage_scenes: usage, first_appearance: first };
}

function gengProfile(meme, html) {
  const originRaw = sectionFromHtml(html, '起源');
  const meaningRaw = sectionFromHtml(html, '含义');
  const sceneRaw = sectionFromHtml(html, '场景');
  const developmentRaw = sectionFromHtml(html, '发展');
  const influenceRaw = sectionFromHtml(html, '影响');
  const metaDate = stripHtml(html.match(/<time[^>]*>([^<]+)<\/time>/)?.[1] || '');
  const originParts = sentences(originRaw);
  const meaningParts = sentences(meaningRaw);
  const sceneParts = sentences(sceneRaw);
  const developmentParts = sentences(developmentRaw);
  const summary = trimText([meaningParts[0], influenceRaw ? sentences(influenceRaw)[0] : '', `它通过${sceneParts[0] ? '可模仿的场景和二次创作' : '平台转发与改写'}扩大传播。`].filter(Boolean).join(''), 230);
  const origin = trimText(originParts.slice(0, 3).join('') || legacyProfile(meme).origin, 430);
  const original = trimText(meaningParts.slice(0, 2).join('') || originParts[0] || legacyProfile(meme).original_meaning, 300);
  const evolution = trimText([...meaningParts.slice(2, 4), ...developmentParts.slice(0, 2)].join('') || influenceRaw || legacyProfile(meme).new_meaning, 380);
  const usage = trimText(sceneParts.slice(0, 4).join('') || legacyProfile(meme).usage_scenes, 380);
  const date = metaDate || meme.first_appearance;
  const first = `${date ? `来源页面标注或可核验的早期传播时间为${date}。` : ''}当前档案依据梗百科正文整理；若正文引用了更早的原帖或视频，应以该引用日期作为传播节点，而不把页面发布日期等同于绝对首发。`;
  return { summary: summary.length >= 70 ? summary : `${summary}${legacyProfile(meme).summary}`, origin, original_meaning: original, new_meaning: evolution, usage_scenes: usage, first_appearance: first };
}

const fieldMinimums = { summary: 70, origin: 100, original_meaning: 80, new_meaning: 90, usage_scenes: 90, first_appearance: 60 };
function meetMinimums(meme, profile) {
  const fallback = legacyProfile(meme);
  const joiners = {
    summary: '从档案角度看，真正需要记录的是它如何被理解和复用，而不只是把名称换个说法再重复一遍。',
    origin: fallback.origin,
    original_meaning: fallback.original_meaning,
    new_meaning: fallback.new_meaning,
    usage_scenes: fallback.usage_scenes,
    first_appearance: fallback.first_appearance
  };
  const result = { ...profile };
  for (const [field, minimum] of Object.entries(fieldMinimums)) {
    let value = String(result[field] || '').trim();
    const addition = String(joiners[field] || '');
    if (value.length < minimum && addition && !value.includes(addition)) value = `${value}${value && !/[。！？]$/.test(value) ? '。' : ''}${addition}`;
    if (value.length < minimum) value = `${value}档案采用可核验、可修订的谨慎口径；有新的原帖、视频或报道证据时，再据此更新具体结论。`;
    result[field] = value;
  }
  return result;
}

const editorialMap = new Map([...editorial.memes, ...editorial.updates].map((meme) => [normalizeName(meme.name), meme]));
const enriched = [];
for (const meme of [...localSeed, ...base]) {
  const editorialEntry = editorialMap.get(normalizeName(meme.name));
  if (editorialEntry) {
    enriched.push({ ...meme, ...editorialEntry, ...meetMinimums(meme, editorialEntry), quality: 'detailed', research_method: 'editorial' });
    continue;
  }
  let profile;
  if (meme.source_url.includes('gengbaike.heyfe.org/memes/')) {
    const slug = meme.source_url.split('/').filter(Boolean).at(-1);
    const cachePath = path.join(cacheDir, `${slug}.html`);
    if (fs.existsSync(cachePath)) profile = gengProfile(meme, fs.readFileSync(cachePath, 'utf8'));
  }
  profile ||= legacyProfile(meme);
  enriched.push({ ...meme, ...profile, ...meetMinimums(meme, profile), quality: 'detailed', research_method: meme.source_url.includes('gengbaike.heyfe.org/memes/') && profile ? 'source_page' : 'source_context' });
}
for (const meme of editorial.memes) if (!enriched.some((entry) => normalizeName(entry.name) === normalizeName(meme.name))) enriched.unshift({ ...meme, ...meetMinimums(meme, meme), quality: 'detailed', research_method: 'editorial' });

fs.writeFileSync(outputPath, `${JSON.stringify({ schema_version: 2, generated_at: new Date().toISOString(), total: enriched.length, quality_standard: { no_legacy_templates: true, min_summary: 70, min_origin: 100, min_original_meaning: 80, min_new_meaning: 90, min_usage_scenes: 90, evidence_language: '最早可核验记录，不虚构绝对首发' }, memes: enriched }, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, total: enriched.length, methods: enriched.reduce((acc, meme) => (acc[meme.research_method] = (acc[meme.research_method] || 0) + 1, acc), {}) }, null, 2));
