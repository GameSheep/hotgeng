const fs = require('node:fs');
const path = require('node:path');

const TARGET = 500;
const COLLECTED_AT = '2026-08-12';
const OUTPUT = path.join(__dirname, '..', 'data', `web-memes-${COLLECTED_AT}.json`);
const SOURCES = {
  geng: {
    title: '梗百科：梗列表',
    url: 'https://gengbaike.heyfe.org/memes'
  },
  wiki: {
    title: '中国大陆网络用语列表',
    url: 'https://zh.wikipedia.org/wiki/中国大陆网络用语列表'
  },
  annual: {
    title: '汉语盘点：历年十大网络用语',
    url: 'https://zh.wikipedia.org/wiki/汉语盘点'
  },
  douyin2023: {
    title: '2023 抖音年度观察报告',
    url: 'https://file.digitaling.com/eImg/uimages/20240202/1706853402934638.pdf'
  },
  xinhuanet2025: {
    title: '新华网：2025年度十大网络流行语',
    url: 'https://app.xinhuanet.com/news/article.html?articleId=d5f1a0210686fc9d33d13681d706b2f4'
  },
  global: {
    title: 'List of Internet phenomena',
    url: 'https://en.wikipedia.org/wiki/List_of_Internet_phenomena'
  },
  bilibili: {
    title: '哔哩哔哩梗百科与年度热梗盘点',
    url: 'https://www.bilibili.com/video/BV1jXkyYeEDh/'
  }
};

const annualRows = {
  2012: '中国好声音|元芳你怎么看|高富帅|白富美|你幸福吗|江南Style|躺着也中枪|屌丝|逆袭|舌尖上的中国|最炫民族风|给跪了',
  2013: '中国大妈|高端大气上档次|爸爸去哪儿|小伙伴们都惊呆了|待我长发及腰|喜大普奔|女汉子|土豪金|摊上大事了|涨姿势',
  2014: '我也是醉了|有钱就是任性|蛮拼的|挖掘机技术哪家强|保证不打死你|萌萌哒|时间都去哪了|我读书少你别骗我|画面太美我不敢看|且行且珍惜',
  2015: '重要的事情说三遍|世界那么大我想去看看|你们城里人真会玩|为国护盘|明明可以靠脸吃饭却偏偏要靠才华|我想静静|吓死宝宝了|内心几乎是崩溃的|我妈是我妈|主要看气质',
  2016: '洪荒之力|友谊的小船|定个小目标|吃瓜群众|葛优躺|辣眼睛|全是套路|蓝瘦香菇|老司机|厉害了我的哥',
  2017: '打call|尬聊|你的良心不会痛吗|惊不惊喜意不意外|皮皮虾我们走|扎心了老铁|还有这种操作|怼|你有freestyle吗|油腻',
  2018: '锦鲤|杠精|skr|佛系|确认过眼神|官宣|C位|土味情话|皮一下|燃烧我的卡路里',
  2019: '道路千万条安全第一条|柠檬精|好嗨哟|是个狼人|雨女无瓜|硬核|996|断舍离',
  2020: '逆行者|秋天的第一杯奶茶|直播带货|云监工|奥利给|好家伙|不约而同|集美|打工人|内卷|凡尔赛文学',
  2021: 'YYDS|破防了|元宇宙|绝绝子|躺平|伤害性不高侮辱性极强|我看不懂但我大受震撼|双向奔赴|社交牛逼症|emo',
  2022: '冰墩墩|刘畊宏女孩|王心凌男孩|电子榨菜|嘴替|精神内耗|退退退|栓Q|大冤种|老六|摆烂',
  2023: '烟火气|村BA|特种兵式旅游|显眼包|主打一个|多巴胺穿搭|命运的齿轮开始转动|搭子|i人e人|公主请上车|尊嘟假嘟',
  2024: '黑神话悟空|含金量还在上升|City不City|班味|偏偏你最争气|浓人淡人|松弛感|主理人|硬控|水灵灵地|小孩哥小孩姐',
  2025: 'DeepSeek|敬自己一杯|助我破鼎|XX基础XX不基础|千百次练习只为这一刻|情绪价值|如何呢又能怎|村咖|来财|浪浪山小妖怪|活人感|从从容容游刃有余'
};

const douyin2023 = '在小小的花园里面挖呀挖呀挖|快乐呼呼呼|科目三|对视变装|放大缩小运镜舞|我姓石|看我拔剑神装备|出去闯闯对比反差挑战|爱自己的100种方式|佛山电翰|卡通脸|写实风AI|融脸变身|只因fufu|迷人反派|AI婚纱照|邪恶之笑|咖啡边牧|Shark|小猫帽子|恐龙扛狼|遥遥领先|尊嘟假嘟|公主请上车|命运的齿轮开始转动|泰裤辣|City walk|哈基米|显眼包|我家子涵怎么了'.split('|');

const classicChinese = '呵呵|2333|囧|雷人|槑|顶|沙发|楼主|楼上|火星人|灌水|马甲|潜水|围观|杯具|洗具|神马都是浮云|给力|坑爹|蛋疼|羡慕嫉妒恨|我勒个去|不明觉厉|人艰不拆|十动然拒|累觉不爱|高大上|喜大普奔|火钳刘明|查水表|前方高能|弹幕护体|空耳|鬼畜|调教|万恶之源|镇站之宝|一键三连|下次一定|白嫖|投币|UP主|失踪人口回归|爷青回|爷青结|考古|这个可以有|这个真没有|神回复|亮了|细思极恐|童年阴影|省流|课代表|划重点|知识增加了|奇怪的知识增加了|我酸了|真香|打脸|翻车|社死|塌房|房子塌了|吃瓜|瓜田里的猹|搬好小板凳|前排出售瓜子|在线等挺急|灵魂画手|手残党|脑补|脑洞大开|神转折|反转|神仙打架|降维打击|碾压|吊打|秀儿|陈独秀你坐下|请开始你的表演|戏精|键盘侠|喷子|玻璃心|佛了|酸民|云玩家|带节奏|节奏大师|实锤|锤了|求锤得锤|打扰了|告辞|惹不起|是在下输了|承包笑点|笑出猪叫|笑到头掉|笑不活了|绷不住了|破大防|麻了|寄|寄了|凉凉|芭比Q了|我裂开了|人傻了|傻眼|上头|洗脑|魔性|有毒|沙雕|快乐源泉|今日份快乐|可可爱爱没有脑袋|奶凶奶凶|awsl|kswl|xswl|dbq|zqsg|u1s1|nsdd|srds|yygq|gkd|ddys|夺笋|笋都被你夺完了'.split('|');

const bilibiliClassics = '金坷垃|元首的愤怒|葛平|成龙劝学|Duang|Are you OK|雷军英语|诸葛亮骂王朗|我从未见过如此厚颜无耻之人|你悔我影|梁非凡|吔屎啦梁非凡|面筋哥|烤面筋|波澜哥|大力哥|窃格瓦拉|打工是不可能打工的|真香警告|影流之主|新宝岛|鸡你太美|只因你太美|律师函警告|两年半练习生|唱跳rap篮球|你干嘛哎哟|老八秘制小汉堡|冬泳怪鸽|一给我里giao|药水哥|我太难了|芜湖起飞|十七张牌你能秒我|反向抽烟|全体起立|伞兵一号卢本伟|有内鬼终止交易|鸡汤来喽|二仙桥走成华大道|你这瓜保熟吗|我是卖瓜的能卖你生瓜蛋子|年轻人不讲武德|耗子尾汁|闪电五连鞭|一袋米要扛几楼|感受痛苦吧|杰哥不要|登dua郎|哼想逃|哲学|兄贵|香蕉君|改革春风吹满地|改革春风吹进门|窝窝头一块钱四个|闹太套|瞬间爆炸|贪玩蓝月|渣渣辉|大扎好我系渣渣辉|古天乐绿了|影流之镰|买瓜名场面|孙笑川你把多少人毁了|安排上了|盘他|百因必有果|你的报应就是我|郭言郭语|淡黄的长裙蓬松的头发|苏喂苏喂|无情哈拉少|社会摇|花手|刀怒斩雪翼雕|战歌起|此生无悔入华夏|此时一位靓仔路过|前方核能|空降坐标|经费在燃烧|暂停学姿势|承包这片鱼塘|叶良辰|赵日天|龙傲天|玛丽苏|霸道总裁|歪嘴战神|赘婿歪嘴|三年之期已到|有钱人的快乐往往就是这么朴实无华|平平无奇古天乐|平平无奇小天才'.split('|');

const recentChinese = '社恐|社牛|社交恐怖分子|i人|e人|Citywalk|美拉德穿搭|特种兵旅游|电子宠物|饭搭子|旅游搭子|学习搭子|嘎嘎|摸鱼|早八|退堂鼓|发疯文学|疯感|淡人|浓人|偷感很重|尊重祝福|我不理解但我尊重|听我说谢谢你|感谢有你|CPU你|PUA|画饼|职场画饼|背锅侠|甩锅|打工魂|干饭人|干饭魂|干啥啥不行吃饭第一名|干饭不积极思想有问题|废话文学|文学带师|摆烂式努力|卷王|卷不动|反内卷|内耗|停止内耗|松弛文学|精神状态良好|精神状态领先|发疯创作|一整个无语住|狠狠爱住|拿捏|拿捏住了|格局打开|打开格局|格局小了|格局拉满|DNA动了|爷的DNA动了|刻进DNA|血脉觉醒|梦回童年|回忆杀|青春回来了|泪目|泪奔|泪目了|封神|封神现场|封神之作|杀疯了|赢麻了|赢学|遥遥领先|你礼貌吗|礼貌你吗|就挺秃然的|有被冒犯到|有被安慰到|有被笑到|有内味了|味儿太冲|听君一席话如听一席话|好听吗好听就是好头|我直接好家伙|小丑竟是我自己|丑竟是我自己|小丑竟在我身边|这河里吗|离谱|离了个大谱|谱尼|大无语事件|无语子|栓Q哥|栓Q家人们|退退退大妈|冤种朋友|大聪明|小机灵鬼|老六行为|服了你个老六|你个老六|显眼包行为|主打陪伴|主打真诚|主打反差|情绪稳定|情绪价值拉满|提供情绪价值|生活搭子|赛博搭子|赛博功德|电子木鱼|功德加一|功德减一|赛博养生|朋克养生|保温杯里泡枸杞|熬最晚的夜敷最贵的面膜|脆皮大学生|脆皮年轻人|大学生哪有不疯的|淡淡的疯感|发疯外卖|鼠鼠我啊|鼠鼠文学|小镇做题家|孔乙己的长衫|脱不下长衫|45度青年|躺又躺不平卷又卷不动|整顿职场|00后整顿职场|职场发疯|班味很重|去班味|活人微死|淡淡死感|已读乱回|已读不回|糊弄学|糊弄学大师|水逆|玄学改命|电子转运|接好运|吸欧气|锦鲤附体|欧皇|非酋|玄不救非氪不改命'.split('|');

const globalMemes = 'Doge|Cheems|Pepe the Frog|Wojak|NPC Wojak|Gigachad|Sigma male|Chad|Karen|Rickroll|Never Gonna Give You Up|Distracted Boyfriend|This Is Fine|Stonks|Drake Hotline Bling|Expanding Brain|Galaxy Brain|Woman Yelling at a Cat|Grumpy Cat|Nyan Cat|Keyboard Cat|Success Kid|Bad Luck Brian|Hide the Pain Harold|Confused Nick Young|Roll Safe|Surprised Pikachu|Leonardo DiCaprio Cheers|Is This a Pigeon|Two Buttons|Change My Mind|One Does Not Simply|Ancient Aliens|Disaster Girl|Trollface|Forever Alone|Rage Guy|Yao Ming Face|Scumbag Steve|Overly Attached Girlfriend|Philosoraptor|Condescending Wonka|Mocking SpongeBob|Ight Imma Head Out|Spider-Man Pointing|Spider-Man Glasses|Kermit Sipping Tea|Salt Bae|Coffin Dance|Harlem Shake|Ice Bucket Challenge|Mannequin Challenge|Bottle Flip|Planking|Dab|T-pose|Moye Moye|Skibidi Toilet|Only in Ohio|Rizz|Gyatt|Brainrot|Italian Brainrot|What Does the Fox Say|PPAP|Gangnam Style|Baby Shark|Despacito|Among Us|Sus|Emergency Meeting|Press F to Pay Respects|F in the Chat|Mission Failed We Will Get Them Next Time|Why Are We Still Here|Ah Shit Here We Go Again|All Your Base Are Belong to Us|Leeroy Jenkins|The Cake Is a Lie|Do a Barrel Roll|Arrow to the Knee|Fus Ro Dah|Hadouken|Falcon Punch|Finish Him|Get Over Here|Wombo Combo|360 No Scope|Git Gud|GG|GLHF|EZ|Noob|AFK|NPC|Main Character Energy|Plot Twist|POV|How It Started How It Is Going|Expectation vs Reality|Starter Pack|Nobody Absolutely Nobody|Me Also Me|Me and the Boys|They Had Us in the First Half|Task Failed Successfully|Modern Problems Require Modern Solutions|Outstanding Move|UNO Draw 25|Trade Offer|Always Has Been|Wait It Is All X|Corporate Needs You to Find the Differences|They Are the Same Picture|You Guys Are Getting Paid|I See This as an Absolute Win|Perfectly Balanced|Reality Is Often Disappointing|Visible Confusion|Understandable Have a Great Day|Sir This Is a Wendy’s|Let Him Cook|Who Let Him Cook|Cooked|No Cap|Cap|Based|Cringe|Touch Grass|Go Brrr|Big Brain Time|Bruh|Oof|Yeet|Slay|Mid|Ratio|L + Ratio|POV you are|Canon Event|Multiverse of Madness|AI Slop'.split('|');

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripWiki(value) {
  return decodeHtml(String(value || ''))
    .replace(/<ref\b[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<ref\b[^>]*\/?\s*>/gi, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/-\{([^{}]+)\}-?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s，,。.!！?？、·:：;；'"“”‘’()（）【】\[\]{}<>《》/\\—_-]+/g, '');
}

function inferScene(tags) {
  if (tags.includes('游戏')) return '用于游戏对局、电竞直播、弹幕评论或相关二次创作。';
  if (tags.includes('影视')) return '用于影视综艺片段的引用、反应图和评论区接梗。';
  if (tags.includes('国际')) return '用于社交媒体反应图、套模板改图和跨文化二次创作。';
  if (tags.includes('短视频')) return '用于短视频配音、变装挑战、评论区接梗和生活化调侃。';
  return '用于社交媒体评论、群聊接梗、自我调侃或相关二次创作。';
}

function makeEntry({ name, aliases = '', summary, origin, year = '', tags = '网络用语', source, firstAppearance = '' }) {
  const cleanName = stripWiki(name).replace(/\s+/g, ' ').trim();
  const cleanSummary = stripWiki(summary || '').slice(0, 220);
  const cleanOrigin = stripWiki(origin || '').slice(0, 300);
  return {
    name: cleanName,
    aliases,
    summary: cleanSummary || `“${cleanName}”是中文互联网传播中的流行表达或迷因模板。`,
    origin: cleanOrigin || `由${source.title}收录，后在社交平台传播并产生二次创作。`,
    original_meaning: `名称最初指向“${cleanName}”对应的原始语境、台词、画面或字面表达。`,
    new_meaning: cleanSummary || `在网络语境中成为可复用的评论、调侃或情绪表达。`,
    usage_scenes: inferScene(tags),
    first_appearance: firstAppearance || (year ? `${year} 年前后进入中文互联网的集中讨论或年度盘点。` : '具体首发时间尚待进一步考据，来源页面记录了其传播线索。'),
    image_url: '',
    video_url: '',
    tags,
    source_url: source.url,
    source_title: source.title,
    collected_at: COLLECTED_AT
  };
}

function addAnnual(candidates) {
  for (const [year, row] of Object.entries(annualRows)) {
    const source = year === '2025' ? SOURCES.xinhuanet2025 : SOURCES.annual;
    for (const name of row.split('|')) {
      candidates.push(makeEntry({
        name,
        summary: `“${name}”入选或代表 ${year} 年中文互联网年度流行表达，集中反映当年的公共话题、情绪与语言创造。`,
        origin: `据${source.title}的年度榜单整理。`,
        year,
        tags: `年度热词,${year}`,
        source
      }));
    }
  }
}

function parseGeng(html) {
  const entries = [];
  const re = /<h3 class="mt-2 [^"]*">([\s\S]*?)<\/h3><p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href="(\/memes\/[^"]+)"/g;
  for (const match of html.matchAll(re)) {
    const before = html.slice(Math.max(0, match.index - 900), match.index);
    const date = [...before.matchAll(/<time[^>]*>([^<]+)<\/time>/g)].at(-1)?.[1] || '';
    const type = [...before.matchAll(/<span[^>]*>(文字梗|事件梗|图片梗)<\/span>/g)].at(-1)?.[1] || '网络热梗';
    const name = decodeHtml(match[1]).replace(/<[^>]+>/g, '').trim();
    const summary = decodeHtml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || !summary) continue;
    entries.push(makeEntry({
      name,
      summary,
      origin: summary,
      year: date.slice(0, 4),
      tags: `${type},梗百科`,
      source: { title: SOURCES.geng.title, url: new URL(match[3], SOURCES.geng.url).href },
      firstAppearance: date ? `${date}（来源页面标注日期）` : ''
    }));
  }
  return entries;
}

const allowedWikiSections = new Set(['形式', '動物類', '社交網站特有事物類', '日常生活類', '計量單位類', '理论类', '教育類']);

function parseWiki(wikitext) {
  let section = '';
  const entries = [];
  for (const line of String(wikitext || '').split(/\r?\n/)) {
    const heading = line.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    if (!allowedWikiSections.has(section) || !/^\*+\s*/.test(line)) continue;
    const clean = stripWiki(line.replace(/^\*+\s*/, ''));
    const split = clean.match(/^(.{1,55}?)[：:](.+)$/);
    if (!split) continue;
    const [name] = split[1].split(/[、，；;]/);
    entries.push(makeEntry({
      name,
      summary: split[2],
      origin: split[2],
      tags: `网络用语,${stripWiki(section)}`,
      source: SOURCES.wiki
    }));
  }
  return entries;
}

function addGroup(candidates, names, { source, summary, origin, year, tags }) {
  for (const name of names) {
    candidates.push(makeEntry({
      name,
      summary: summary(name),
      origin: origin(name),
      year,
      tags,
      source
    }));
  }
}

function isAcceptable(entry) {
  if (!entry.name || entry.name.length < 2 || entry.name.length > 55) return false;
  const unsafe = /NMSL|CGG|强奸|性侵|嫖娼|生殖器|色情|仇恨|种族歧视|辱骂|侮辱性称呼|傻逼|妈死|支那|黑鬼|绿教|神蛆|图种熊菊/i;
  const excludedNames = new Set('咒术卫生巾|寡妇|鳏夫|耽美|马上风|NYKD-54|114514|homo|INM|野兽先辈|潘驴邓小闲|LGBT|燃冬|58/42|石女|字母圈|金赛纶自杀|面首|牛头人|NTR|CMG|FTM|MTF|王大陆塌房|杀猪盘|张献忠|爸爸活|对食|1450|白左|地狱梗|Incel|Stacy|挂壁|社交牛逼症|社交牛杂症|嘉豪|唐嘉琦|安大爷|KYY|通辽|秦腔穷|信球|死人|性压抑论|邪教|经济|建模|TS|RPS|M40|5684|92 95 98|ATNN 是什么梗'.split('|'));
  return !unsafe.test(`${entry.name} ${entry.summary}`) && !excludedNames.has(entry.name.replace(/[【】]/g, ''));
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  process.stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'meme-archive-curator/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  const wikiText = await readStdin();
  const gengHtml = await fetchText(SOURCES.geng.url);
  const candidates = [];

  // Prefer entries with full explanations and authoritative platform/annual lists.
  candidates.push(...parseGeng(gengHtml));
  addAnnual(candidates);
  addGroup(candidates, douyin2023, {
    source: SOURCES.douyin2023,
    summary: (name) => `“${name}”是抖音 2023 年度热点报告列出的热门梗、玩法或创作模板。`,
    origin: () => '来自抖音热点与巨量算数年度报告中的年度热梗榜单。',
    year: '2023', tags: '短视频,抖音'
  });
  candidates.push(...parseWiki(wikiText));
  addGroup(candidates, classicChinese, {
    source: SOURCES.wiki,
    summary: (name) => `“${name}”是中文论坛、社交媒体或弹幕文化中反复使用的经典网络表达。`,
    origin: () => '从早期论坛、即时通信、微博及弹幕网站的互动语言中传播。',
    year: '', tags: '经典,网络用语'
  });
  addGroup(candidates, bilibiliClassics, {
    source: SOURCES.bilibili,
    summary: (name) => `“${name}”是中文视频社区广泛传播的鬼畜素材、名场面台词或二创梗。`,
    origin: () => '经 A站、B站等视频社区的剪辑、配音、鬼畜或弹幕互动扩散。',
    year: '', tags: 'B站,鬼畜'
  });
  addGroup(candidates, recentChinese, {
    source: SOURCES.geng,
    summary: (name) => `“${name}”是近年中文社交媒体中用于表达状态、身份、情绪或生活方式的流行说法。`,
    origin: () => '主要经微博、短视频、生活方式社区和群聊语境传播。',
    year: '2020年代', tags: '社交媒体,流行语'
  });
  addGroup(candidates, globalMemes, {
    source: SOURCES.global,
    summary: (name) => `“${name}”是国际互联网中广泛传播，并进入中文社区使用的迷因、反应图或流行句式。`,
    origin: () => '源自国际论坛、图片社区、视频网站或社交平台，后经翻译和二创进入中文网络。',
    year: '', tags: '国际迷因,图片梗'
  });

  const seen = new Set(['松弛感', '破防了', '绝绝子', '验证热梗'].map(normalizeName));
  const memes = [];
  for (const entry of candidates) {
    const key = normalizeName(entry.name);
    if (!key || seen.has(key) || !isAcceptable(entry)) continue;
    seen.add(key);
    memes.push(entry);
    if (memes.length === TARGET) break;
  }

  if (memes.length !== TARGET) throw new Error(`Only collected ${memes.length} unique acceptable entries; expected ${TARGET}`);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify({ schema_version: 1, collected_at: COLLECTED_AT, target: TARGET, sources: Object.values(SOURCES), memes }, null, 2)}\n`);
  const bySource = Object.groupBy(memes, (entry) => entry.source_title);
  console.log(`Wrote ${memes.length} memes to ${OUTPUT}`);
  for (const [source, values] of Object.entries(bySource)) console.log(`${values.length}\t${source}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
