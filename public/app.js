const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modalRoot');
const authButton = document.querySelector('#authButton');
let memes = [];
let me = null;
let totalMemes = 0;
let discoverMemes = [];
let exploreTags = [];
let nextCursor = null;
let hasMoreMemes = false;
let stopTagCloud = null;
let lastFocusedElement = null;

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const fields = [
  ['name', '热梗名称', 'input'], ['aliases', '别名 / 相关写法', 'input'], ['summary', '一句话释义', 'input'],
  ['origin', '起源', 'textarea'], ['original_meaning', '原本含义', 'textarea'], ['new_meaning', '新的意义', 'textarea'],
  ['usage_scenes', '使用场景', 'textarea'], ['first_appearance', '初次登场地点', 'textarea'], ['image_url', '配图 URL（HTTPS）', 'input'],
  ['video_url', '视频 URL（可选）', 'input'], ['tags', '标签（用逗号分隔）', 'input']
];

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function navigate(path) { location.hash = path; }
function renderLoading() { app.innerHTML = '<div class="page loading-shell"><div class="skeleton loading-title"></div><div class="skeleton loading-row"></div><div class="skeleton loading-row"></div><div class="skeleton loading-row"></div></div>'; }
function enterRoute() { app.classList.remove('route-enter'); requestAnimationFrame(() => app.classList.add('route-enter')); }
function tagList(value = '') { return value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean); }
function tagMarkup(value = '') { const tags = tagList(value); return (tags.length ? tags : ['待分类']).map((tag) => `<span class="tag">${esc(tag)}</span>`).join(''); }

async function loadMemes(query = '', append = false, options = {}) {
  const params = new URLSearchParams({ limit: '36', offset: append ? String(memes.length) : '0', sort: options.sort || 'newest' });
  if (query) params.set('q', query);
  if (options.tags?.length) params.set('tags', options.tags.join(','));
  if (append && nextCursor && (options.sort || 'newest') === 'newest') params.set('cursor', nextCursor);
  const data = await api(`/api/memes?${params}`);
  memes = append ? memes.concat(data.memes) : data.memes;
  totalMemes = data.total;
  nextCursor = data.next_cursor;
  hasMoreMemes = Boolean(data.has_more || data.next_cursor);
  return memes;
}

async function loadDiscovery() {
  const [discovery, tagData] = await Promise.all([api('/api/discover?limit=22'), api('/api/tags?limit=18')]);
  discoverMemes = discovery.memes;
  exploreTags = tagData.tags;
}

function home() {
  const words = discoverMemes.length ? discoverMemes : memes;
  app.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">Internet language observatory · since 2026</div><h1>今天又有<br><em>什么梗？</em></h1><p class="hero-lede">从一句话开始，追溯互联网的集体记忆。这里记录热梗的来路、变形，以及它们被使用的真实时刻。</p><div class="hero-meta"><span><strong>${String(totalMemes).padStart(2, '0')}</strong> 条公开档案</span><i></i><span>人工校订 · 持续生长</span></div><form class="search-shell" id="heroSearch"><input name="q" placeholder="输入一句话、出处或场景" aria-label="搜索热梗"><button>开始检索 <span>↗</span></button></form><div class="signal-legend"><span><i class="signal-hot"></i>近期热门</span><span><i class="signal-new"></i>最新收录</span><span><i class="signal-editorial"></i>编辑精选</span></div></div><div class="cloud cloud-3d" id="tagCloud" aria-label="可拖动的热梗词云"><span class="orbit-axis" aria-hidden="true"></span>${words.map((m) => `<button class="meme-word signal-${esc(m.signal || 'editorial')}" style="--heat:${Math.min(Number(m.signal_score || 1), 30)}" data-id="${m.id}" aria-label="查看 ${esc(m.name)} 的档案">${esc(m.name)}</button>`).join('')}</div><div class="cloud-hint">热门 × 最新 · 拖动探索 · 点击查看</div><div class="hero-footer"><div class="view-links"><a class="pill" href="#/list">文字索引 <span>↗</span></a><a class="pill" href="#/card">视觉图鉴 <span>↗</span></a></div><div class="scroll-note">LIVE SIGNAL / ${new Date().getFullYear()}</div></div></section><section class="tag-observatory"><div class="tag-observatory-head"><div><div class="eyebrow">Explore by signals</div><h2>从标签进入</h2></div><a href="#/list">查看全部档案 ↗</a></div><div class="tag-constellation">${exploreTags.map((tag) => `<a href="#/list?tags=${encodeURIComponent(tag.normalized_name)}"><span>${esc(tag.name)}</span><small>${tag.meme_count} 条 · 活跃度 ${tag.activity_score}</small></a>`).join('')}</div></section>`;
  document.querySelector('#heroSearch').addEventListener('submit', (event) => { event.preventDefault(); navigate(`/list?q=${encodeURIComponent(new FormData(event.target).get('q'))}`); });
  document.querySelectorAll('.meme-word').forEach((word) => word.addEventListener('click', () => word.dataset.id !== '0' && openDetail(word.dataset.id)));
  setupTagCloud();
}

function setupTagCloud() {
  stopTagCloud?.();
  const cloud = document.querySelector('#tagCloud');
  if (!cloud) return;
  const nodes = [...cloud.querySelectorAll('.meme-word')];
  const points = nodes.map((node, index) => {
    const phi = Math.acos(-1 + (2 * index + 1) / nodes.length);
    const theta = Math.sqrt(nodes.length * Math.PI) * phi;
    return { node, x: Math.cos(theta) * Math.sin(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(phi) };
  });
  let rotationX = 0.2; let rotationY = -0.35; let dragging = false; let hoveringWord = false; let lastX = 0; let lastY = 0; let travel = 0; let pressedWord = null;
  let velocityX = .00004; let velocityY = .00018; let visible = true; let frame = 0; let previousTime = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) frame = requestAnimationFrame(draw); });
  observer.observe(cloud);
  function draw(time) {
    frame = 0;
    if (!visible || !document.contains(cloud)) return;
    const delta = Math.min(time - previousTime, 32); previousTime = time;
    const rect = cloud.getBoundingClientRect(); const radius = Math.min(rect.width, rect.height) * .36;
    for (const point of points) {
      const x1 = point.x * Math.cos(rotationY) - point.z * Math.sin(rotationY); const z1 = point.x * Math.sin(rotationY) + point.z * Math.cos(rotationY);
      const y = point.y * Math.cos(rotationX) - z1 * Math.sin(rotationX); const z = point.y * Math.sin(rotationX) + z1 * Math.cos(rotationX);
      const heatBoost = point.node.classList.contains('signal-hot') ? Math.min(Math.log2(Number(point.node.style.getPropertyValue('--heat')) + 1) * .035, .15) : 0;
      const scale = .58 + (z + 1) * .27 + heatBoost;
      point.node.style.setProperty('--x', `${x1 * radius}px`); point.node.style.setProperty('--y', `${y * radius}px`); point.node.style.setProperty('--scale', scale.toFixed(3));
      point.node.style.zIndex = String(Math.round((z + 1) * 100)); point.node.style.opacity = String(.35 + (z + 1) * .32);
    }
    if (!dragging && !hoveringWord && !reducedMotion) { rotationY += velocityY * delta; rotationX += velocityX * delta; velocityY += (.00018 - velocityY) * .035; velocityX += (.00004 - velocityX) * .035; }
    frame = requestAnimationFrame(draw);
  }
  cloud.addEventListener('pointerdown', (event) => { dragging = true; travel = 0; pressedWord = event.target.closest('.meme-word'); lastX = event.clientX; lastY = event.clientY; cloud.classList.add('dragging'); cloud.setPointerCapture(event.pointerId); });
  cloud.addEventListener('pointermove', (event) => { if (!dragging) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; travel += Math.hypot(dx, dy); rotationY += dx * .008; rotationX = Math.max(-1.1, Math.min(1.1, rotationX + dy * .008)); velocityY = dx * .00035; velocityX = dy * .0002; lastX = event.clientX; lastY = event.clientY; });
  const release = (event) => { const clickedWord = pressedWord; const isTap = travel < 7; dragging = false; pressedWord = null; cloud.classList.remove('dragging'); if (isTap && clickedWord && event.type === 'pointerup') clickedWord.click(); };
  cloud.addEventListener('pointerup', release); cloud.addEventListener('pointercancel', release);
  cloud.addEventListener('pointerover', (event) => { if (event.target.closest('.meme-word')) hoveringWord = true; });
  cloud.addEventListener('pointerout', (event) => { if (event.target.closest('.meme-word')) hoveringWord = false; });
  frame = requestAnimationFrame(draw);
  stopTagCloud = () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); frame = 0; };
}

function browse(mode, query = '', options = {}) {
  const isCard = mode === 'card';
  const activeTags = options.tags || [];
  const filterQuery = new URLSearchParams(); if (query) filterQuery.set('q', query); if (activeTags.length) filterQuery.set('tags', activeTags.join(',')); if (options.sort === 'popular') filterQuery.set('sort', 'popular');
  app.innerHTML = `<div class="page"><div class="page-head"><div><div class="eyebrow">The public index · 人工校订</div><div class="page-title-row"><h1>${isCard ? '视觉图鉴' : '文字索引'}</h1><span class="result-count">${query ? `“${esc(query)}” · ` : ''}${totalMemes} 条</span></div></div><div class="page-actions"><form id="browseSearch"><input class="soft-input" name="q" value="${esc(query)}" placeholder="检索档案" aria-label="检索档案"></form><div class="switcher" aria-label="切换浏览方式"><button class="${!isCard ? 'active' : ''}" data-view="list">索引</button><button class="${isCard ? 'active' : ''}" data-view="card">图鉴</button></div></div></div><div class="filter-deck"><div class="filter-scroll"><button class="filter-tag ${activeTags.length ? '' : 'active'}" data-clear-tags>全部标签</button>${exploreTags.map((tag) => `<button class="filter-tag ${activeTags.includes(tag.normalized_name) ? 'active' : ''}" data-tag="${esc(tag.normalized_name)}">#${esc(tag.name)} <small>${tag.meme_count}</small></button>`).join('')}</div><div class="sort-control"><button class="${options.sort !== 'popular' ? 'active' : ''}" data-sort="newest">最新</button><button class="${options.sort === 'popular' ? 'active' : ''}" data-sort="popular">热门</button></div></div><div id="browseContent"></div></div>`;
  const goWith = (changes = {}) => { const params = new URLSearchParams(filterQuery); Object.entries(changes).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key)); navigate(`/${changes.mode || mode}?${params}`); };
  document.querySelector('#browseSearch').addEventListener('submit', (event) => { event.preventDefault(); goWith({ q: new FormData(event.target).get('q') }); });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => navigate(`/${button.dataset.view}?${filterQuery}`)));
  document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => goWith({ sort: button.dataset.sort === 'popular' ? 'popular' : '' })));
  document.querySelector('[data-clear-tags]').addEventListener('click', () => goWith({ tags: '' }));
  document.querySelectorAll('[data-tag]').forEach((button) => button.addEventListener('click', () => { const value = button.dataset.tag; const tags = activeTags.includes(value) ? activeTags.filter((tag) => tag !== value) : [...activeTags, value].slice(0, 5); goWith({ tags: tags.join(',') }); }));
  const content = document.querySelector('#browseContent');
  if (!memes.length) return content.innerHTML = '<p class="empty">还没有收录公开热梗。</p>';
  content.innerHTML = `${isCard ? `<div class="card-grid">${memes.map((m) => `<article class="meme-card" data-id="${m.id}" tabindex="0" role="button" aria-label="查看 ${esc(m.name)} 的档案">${m.image_url ? `<img src="${esc(m.image_url)}" alt="" loading="lazy">` : `<div class="card-sigil" aria-hidden="true">${esc(m.name.slice(0, 1))}</div>`}<div class="card-overlay"></div><span class="card-number">FILE / ${String(m.id).padStart(4, '0')}</span><span class="card-status">${options.sort === 'popular' ? `${m.popularity_score || 0} HEAT` : 'ARCHIVED'}</span><div class="card-content"><h3>${esc(m.name)}</h3><p>${esc(m.summary || '打开查看完整档案')}</p></div></article>`).join('')}</div>` : `<div class="meme-list">${memes.map((m, i) => `<article class="meme-row" data-id="${m.id}" tabindex="0" role="button" aria-label="查看 ${esc(m.name)} 的档案"><span class="row-index">${String(i + 1).padStart(2, '0')}</span><div><div class="row-name">${esc(m.name)}</div><div class="row-summary">${esc(m.summary || '打开查看完整档案')}</div></div><span class="row-tags">${tagMarkup(m.tags)}</span><span class="row-arrow" aria-hidden="true">↗</span></article>`).join('')}</div>`}${hasMoreMemes ? '<button class="load-more" id="loadMore">继续加载 ↓</button>' : ''}`;
  document.querySelectorAll('[data-id]').forEach((item) => item.addEventListener('click', () => openDetail(item.dataset.id)));
  document.querySelectorAll('[data-id]').forEach((item) => item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(item.dataset.id); } }));
  document.querySelector('#loadMore')?.addEventListener('click', async () => { await loadMemes(query, true, options); browse(mode, query, options); });
}

async function openDetail(id) {
  lastFocusedElement = document.activeElement;
  const { meme: m } = await api(`/api/memes/${id}`);
  api(`/api/memes/${id}/view`, { method: 'POST' }).catch(() => {});
  const visual = m.image_url ? `<img src="${esc(m.image_url)}" alt="${esc(m.name)}" loading="eager">` : m.video_url ? `<iframe src="${esc(m.video_url)}" title="${esc(m.name)} 视频" allowfullscreen></iframe>` : `<div class="detail-glyph" aria-hidden="true">${esc(m.name.slice(0, 1))}</div>`;
  modalRoot.innerHTML = `<div class="modal-backdrop" id="detailBackdrop"><article class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><button class="close-modal" id="closeModal" aria-label="关闭档案">×</button><div class="detail-hero"><div class="detail-heading"><div class="detail-kicker">MEME FILE / ${String(m.id).padStart(4, '0')}</div><h2 id="detailTitle">${esc(m.name)}</h2><p class="detail-summary">${esc(m.summary || '这条档案正在补充释义。')}</p><div class="detail-tags">${tagMarkup(m.tags)}</div></div><div class="detail-visual">${visual}</div></div><div class="detail-body"><div class="detail-sections">${[['origin','起源'],['original_meaning','原本含义'],['new_meaning','新的意义'],['usage_scenes','使用场景'],['first_appearance','初次登场地点']].map(([key, label], index) => `<section class="detail-section"><span>${String(index + 1).padStart(2, '0')}</span><h3>${label}</h3><p>${esc(m[key] || '暂无记录')}</p></section>`).join('')}</div><div class="detail-foot"><div class="contributor">ARCHIVED BY / ${esc(m.contributor)}<br>LAST UPDATED / ${esc(String(m.updated_at || '').slice(0, 10))}</div>${me ? '<button class="primary" id="editMeme">提交修订 ↗</button>' : ''}</div></div></article></div>`;
  document.body.classList.add('modal-open');
  document.querySelector('#closeModal').addEventListener('click', closeModal);
  document.querySelector('#detailBackdrop').addEventListener('click', (event) => event.target.id === 'detailBackdrop' && closeModal());
  document.querySelector('#editMeme')?.addEventListener('click', () => { closeModal(); contributionForm(m); });
  document.querySelector('#closeModal').focus();
}
function closeModal() { if (!modalRoot.firstChild) return; modalRoot.innerHTML = ''; document.body.classList.remove('modal-open'); lastFocusedElement?.focus?.(); }

function authPage(register = false) {
  app.innerHTML = `<div class="page form-page"><div class="eyebrow">Your contribution matters</div><h1>${register ? '加入档案馆' : '欢迎回来'}</h1><p class="form-intro">每一次补充，都是为正在消失的互联网语境留下坐标。</p><form class="form" id="authForm">${register ? '<div class="field"><label>邮箱 · 用于找回密码</label><input name="email" type="email" required autocomplete="email"></div>' : ''}<div class="field"><label>用户名</label><input name="username" required autocomplete="username"></div><div class="field"><label>密码</label><input name="password" type="password" required minlength="8" autocomplete="current-password"></div><button class="primary">${register ? '注册并开始贡献 ↗' : '登录 ↗'}</button></form><p class="contributor">${register ? '已有账号？' : '还没有账号？'} <a href="#/${register ? 'login' : 'register'}">${register ? '直接登录' : '注册一个'}</a>${!register ? ' · <a href="#/forgot-password">找回密码</a>' : ''}</p></div>`;
  document.querySelector('#authForm').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api(`/api/auth/${register ? 'register' : 'login'}`, { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); me = data.user; toast('登录成功'); navigate('/'); } catch (error) { toast(error.message); } });
}

function forgotPage() {
  app.innerHTML = `<div class="page form-page"><div class="eyebrow">ACCOUNT RECOVERY</div><h1>找回密码</h1><form class="form" id="forgotForm"><div class="field"><label>EMAIL</label><input name="email" type="email" required placeholder="注册时使用的邮箱"></div><button class="primary">发送找回链接 ↗</button></form><p class="contributor">开发环境的链接会输出在服务端日志中。</p></div>`;
  document.querySelector('#forgotForm').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/api/auth/forgot-password', { method:'POST', body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); toast(data.message); } catch (error) { toast(error.message); } });
}

function resetPage(token) {
  app.innerHTML = `<div class="page form-page"><div class="eyebrow">NEW PASSWORD</div><h1>设置新密码</h1><form class="form" id="resetForm"><div class="field"><label>NEW PASSWORD</label><input name="password" type="password" minlength="8" required></div><button class="primary">更新密码 ↗</button></form></div>`;
  document.querySelector('#resetForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/api/auth/reset-password', { method:'POST', body:JSON.stringify({ token, password:new FormData(event.target).get('password') }) }); toast('密码已更新'); navigate('/login'); } catch (error) { toast(error.message); } });
}

function contributionForm(edit = null) {
  const values = edit ? edit : {};
  app.innerHTML = `<div class="page form-page"><div class="eyebrow">Edit the record</div><h1>${edit ? '修订档案' : '提交热梗'}</h1><p class="form-intro">所有内容都会先进入审核队列；通过校订后，才会出现在公开档案中。</p><form class="form" id="memeForm">${fields.map(([key, label, type]) => `<div class="field"><label>${label}</label>${type === 'textarea' ? `<textarea name="${key}">${esc(values[key] || '')}</textarea>` : `<input name="${key}" value="${esc(values[key] || '')}" ${key === 'name' ? 'required' : ''}>`}</div>`).join('')}<div class="field"><label>修订说明</label><textarea name="change_note" placeholder="简述这次新增或修订的依据"></textarea></div><button class="primary">提交校订 ↗</button></form></div>`;
  document.querySelector('#memeForm').addEventListener('submit', async (event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target)); if (edit) body.meme_id = edit.id; try { await api('/api/revisions', { method:'POST', body:JSON.stringify(body) }); toast('已提交，等待管理员审核'); navigate('/'); } catch (error) { toast(error.message); } });
}

async function adminPage() {
  const [{ revisions }, { tags }] = await Promise.all([api('/api/admin/revisions'), api('/api/admin/tags')]);
  app.innerHTML = `<div class="page"><div class="eyebrow">Editorial desk</div><div class="page-head"><div><h1 style="font-size:56px;margin:8px 0 0">审核台</h1><p class="form-intro" style="margin:12px 0 0">校订用户贡献，也维护自由标签的秩序。</p></div><button class="primary" id="adminCreate">新增热梗 ↗</button></div><section class="admin-section"><h2>档案申请 <small>${revisions.length}</small></h2><div id="adminList">${revisions.length ? revisions.map((r) => `<article class="admin-item"><div class="eyebrow">${r.type.toUpperCase()} · ${new Date(r.created_at).toLocaleString()}</div><h3>${esc(r.payload.name || r.meme_name || '未命名')}</h3><p>${esc(r.payload.summary || '')}</p><div class="contributor">提交者 / ${esc(r.author_name)}</div><div class="admin-actions"><button class="primary" data-approve="${r.id}">通过</button><button class="primary danger" data-reject="${r.id}">驳回</button></div></article>`).join('') : '<p class="empty">档案审核队列是空的。</p>'}</div></section><section class="admin-section"><h2>新标签 <small>${tags.length}</small></h2>${tags.length ? tags.map((tag) => `<article class="admin-item tag-review"><div><div class="eyebrow">NEW TAG · ${tag.meme_count} 条档案使用</div><h3>#${esc(tag.name)}</h3><div class="contributor">创建者 / ${esc(tag.creator_name || '编辑部')}</div></div><div class="admin-actions"><button class="primary" data-tag-approve="${tag.id}">通过</button><button class="primary danger" data-tag-merge="${tag.id}">合并到...</button></div></article>`).join('') : '<p class="empty">没有待审核的新标签。</p>'}</section></div>`;
  document.querySelector('#adminCreate').addEventListener('click', () => contributionForm());
  document.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', () => review(button.dataset.approve, 'approve')));
  document.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => review(button.dataset.reject, 'reject')));
  document.querySelectorAll('[data-tag-approve]').forEach((button) => button.addEventListener('click', async () => { try { await api(`/api/admin/tags/${button.dataset.tagApprove}/approve`, { method: 'POST' }); toast('标签已通过'); adminPage(); } catch (error) { toast(error.message); } }));
  document.querySelectorAll('[data-tag-merge]').forEach((button) => button.addEventListener('click', async () => { const target = prompt('输入要合并到的已通过标签名称'); if (!target) return; try { await api(`/api/admin/tags/${button.dataset.tagMerge}/merge`, { method: 'POST', body: JSON.stringify({ target }) }); toast('标签已合并'); adminPage(); } catch (error) { toast(error.message); } }));
}
async function review(id, action) { const note = action === 'reject' ? prompt('请输入驳回原因') : ''; if (action === 'reject' && note === null) return; try { await api(`/api/admin/revisions/${id}/${action}`, { method:'POST', body:JSON.stringify({ review_note:note || '' }) }); toast(action === 'approve' ? '已发布' : '已驳回'); adminPage(); } catch (error) { toast(error.message); } }

async function refreshAuth() { me = (await api('/api/me')).user; authButton.textContent = me ? me.username : '登录'; authButton.onclick = () => me ? navigate(me.role === 'admin' ? '/admin' : '/submit') : navigate('/login'); document.querySelector('#submitLink').style.display = me ? '' : 'none'; }
function updateNavigation(path) {
  document.querySelectorAll('[data-nav]').forEach((link) => link.classList.toggle('active', path.startsWith(`/${link.dataset.nav}`)));
}
async function route() {
  stopTagCloud?.(); stopTagCloud = null;
  window.scrollTo(0, 0);
  if (!app.firstElementChild) renderLoading();
  app.setAttribute('aria-busy', 'true');
  try {
    await refreshAuth();
    const [path, search] = location.hash.slice(1).split('?'); const searchParams = new URLSearchParams(search || ''); const query = searchParams.get('q') || '';
    const options = { tags: (searchParams.get('tags') || '').split(',').filter(Boolean), sort: searchParams.get('sort') === 'popular' ? 'popular' : 'newest' };
    updateNavigation(path || '/');
    if (!exploreTags.length) { const data = await api('/api/tags?limit=18'); exploreTags = data.tags; }
    if (path === '/list' || path === '/card') await loadMemes(query, false, options); else if (!memes.length || !discoverMemes.length) { await loadMemes(); await loadDiscovery(); }
    if (path === '/list' || path === '/card') browse(path.slice(1), query, options);
    else if (path === '/login') authPage(); else if (path === '/register') authPage(true); else if (path === '/forgot-password') forgotPage(); else if (path === '/reset-password') resetPage(new URLSearchParams(search || '').get('token') || ''); else if (path === '/submit') me ? contributionForm() : navigate('/login'); else if (path === '/admin') me?.role === 'admin' ? await adminPage() : navigate('/login'); else home();
    enterRoute();
  } catch (error) { app.innerHTML = `<div class="page"><p class="empty">${esc(error.message)}</p></div>`; }
  finally { app.setAttribute('aria-busy', 'false'); }
}

window.addEventListener('hashchange', route);
document.addEventListener('keydown', (event) => event.key === 'Escape' && closeModal());
route();
