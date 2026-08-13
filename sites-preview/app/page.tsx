"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Meme = {
  name: string;
  aliases: string;
  summary: string;
  origin: string;
  original_meaning: string;
  new_meaning: string;
  usage_scenes: string;
  first_appearance: string;
  tags: string;
  source_url: string;
  source_title: string;
  quality: "detailed" | "needs_review";
  related_news: Array<{
    title: string;
    url: string;
    source: string;
    published_at: string;
    kind: "news" | "analysis" | "source" | "collection";
    summary: string;
  }>;
  research_method: "editorial" | "source_page" | "source_context";
  international_level: "curated" | "translated" | "orientation";
  international: {
    title_en: string;
    pronunciation: string;
    literal_en: string;
    meaning_en: string;
    culture_en: string;
    use_en: string;
    example_en: string;
  };
};

type View = "home" | "list" | "card";
type Locale = "en" | "zh";
type Point = Meme & { x: number; y: number; z: number; signal: "hot" | "new" | "editorial" };
type HitArea = { meme: Meme; x: number; y: number; width: number; height: number; z: number };

const palette = { hot: "#ef8c69", new: "#9ac9b8", editorial: "#f4f0e8" };

function tagsOf(value: string) {
  return value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
}

const tagTranslations: Record<string, string> = {
  "2026热梗": "2026 trend", "表情包": "reaction image", "职场": "work", "动物": "animals",
  "文字梗": "wordplay", "梗百科": "meme guide", "年度热词": "annual phrase", "短视频": "short video",
  "抖音": "Douyin", "经典": "classic", "网络用语": "internet slang", "B站": "Bilibili",
  "鬼畜": "remix culture", "国际迷因": "global meme", "图片梗": "image meme", "情绪表达": "emotion",
};

function tagLabel(tag: string, locale: Locale) {
  return locale === "en" && tagTranslations[tag] ? `${tagTranslations[tag]} · ${tag}` : tag;
}

function CanvasSphere({ memes, onSelect, locale }: { memes: Meme[]; onSelect: (meme: Meme) => void; locale: Locale }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onSelectRef = useRef(onSelect);
  const stateRef = useRef({ dragging: false, x: 0, y: 0, travel: 0, rotationX: 0.18, rotationY: -0.36, velocityX: 0.00004, velocityY: 0.00018 });
  const hitAreasRef = useRef<HitArea[]>([]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const points = useMemo<Point[]>(() => memes.map((meme, index) => {
    const phi = Math.acos(-1 + (2 * index + 1) / Math.max(memes.length, 1));
    const theta = Math.sqrt(memes.length * Math.PI) * phi;
    return {
      ...meme,
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(phi),
      signal: index < 6 ? "hot" : index < 13 ? "new" : "editorial",
    };
  }), [memes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = true;
    let previousTime = 0;
    let lastPaint = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(performance.now(), true);
    };

    const paint = (time: number, force = false) => {
      frame = 0;
      if (!visible || !document.contains(canvas)) return;
      if (!force && time - lastPaint < 1000 / 30) {
        frame = requestAnimationFrame(paint);
        return;
      }
      const state = stateRef.current;
      const delta = previousTime ? Math.min(time - previousTime, 48) : 16;
      previousTime = time;
      lastPaint = time;
      if (!state.dragging && !reducedMotion) {
        state.rotationY += state.velocityY * delta;
        state.rotationX += state.velocityX * delta;
        state.velocityY += (0.00018 - state.velocityY) * 0.035;
        state.velocityX += (0.00004 - state.velocityX) * 0.035;
      }

      context.clearRect(0, 0, width, height);
      const cosY = Math.cos(state.rotationY);
      const sinY = Math.sin(state.rotationY);
      const cosX = Math.cos(state.rotationX);
      const sinX = Math.sin(state.rotationX);
      const radius = Math.min(width, height) * 0.34;
      const centerX = width * 0.51;
      const centerY = height * 0.5;
      const projected = points.map((point) => {
        const x1 = point.x * cosY - point.z * sinY;
        const z1 = point.x * sinY + point.z * cosY;
        const y = point.y * cosX - z1 * sinX;
        const z = point.y * sinX + z1 * cosX;
        return { point, x: centerX + x1 * radius, y: centerY + y * radius, z };
      }).sort((a, b) => a.z - b.z);

      const hitAreas: HitArea[] = [];
      for (const item of projected) {
        const depth = (item.z + 1) / 2;
        const size = Math.max(13, Math.min(31, 13 + depth * 18));
        const alpha = 0.24 + depth * 0.76;
        context.save();
        context.globalAlpha = alpha;
        context.fillStyle = palette[item.point.signal];
        context.font = `600 ${size.toFixed(1)}px Georgia, "Noto Serif SC", "Songti SC", serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        if (item.point.signal === "hot" && depth > 0.58) {
          context.shadowColor = "rgba(239,140,105,.24)";
          context.shadowBlur = 14;
        }
        context.fillText(item.point.name, item.x, item.y, Math.min(230, width * 0.36));
        const measured = Math.min(context.measureText(item.point.name).width, Math.min(230, width * 0.36));
        hitAreas.push({ meme: item.point, x: item.x, y: item.y, width: measured + 18, height: size + 14, z: item.z });
        context.restore();
      }
      hitAreasRef.current = hitAreas.sort((a, b) => b.z - a.z);
      if (!reducedMotion) frame = requestAnimationFrame(paint);
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame((time) => paint(time, true));
      if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
    });
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    resize();

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [points]);

  const localPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const state = stateRef.current;
    state.dragging = true; state.travel = 0; state.x = point.x; state.y = point.y;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("dragging");
  };

  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;
    if (!state.dragging) return;
    const point = localPoint(event);
    const dx = point.x - state.x;
    const dy = point.y - state.y;
    state.travel += Math.hypot(dx, dy);
    state.rotationY += dx * 0.008;
    state.rotationX = Math.max(-1.1, Math.min(1.1, state.rotationX + dy * 0.008));
    state.velocityY = dx * 0.00035;
    state.velocityX = dy * 0.0002;
    state.x = point.x; state.y = point.y;
  };

  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    const state = stateRef.current;
    const isTap = state.travel < 7;
    state.dragging = false;
    event.currentTarget.classList.remove("dragging");
    if (!isTap) return;
    const hit = hitAreasRef.current.find((area) => Math.abs(point.x - area.x) <= area.width / 2 && Math.abs(point.y - area.y) <= area.height / 2);
    if (hit) onSelectRef.current(hit.meme);
  };

  return (
    <div className="sphere-shell">
      <div className="sphere-ring sphere-ring-main" aria-hidden="true" />
      <div className="sphere-ring sphere-ring-orbit" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="meme-sphere"
        aria-label={locale === "en" ? "Interactive Chinese meme sphere; drag to explore and tap a term to open its guide" : "可拖动的热梗词球；点击文字查看档案"}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      />
      <span className="render-badge"><i /> CANVAS · 1 LAYER</span>
    </div>
  );
}

function Detail({ meme, onClose, locale }: { meme: Meme; onClose: () => void; locale: Locale }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => { window.removeEventListener("keydown", close); document.body.classList.remove("modal-open"); };
  }, [onClose]);

  const sections = locale === "en" ? [
    ["MEANING / What it means", meme.international.meaning_en],
    ["LITERAL / Literal reading", meme.international.literal_en],
    ["CULTURE / Why it matters", meme.international.culture_en],
    ["USE / When to say it", meme.international.use_en],
    ["EXAMPLE / How it appears", meme.international.example_en],
  ] : [
    ["ORIGIN / 起源", meme.origin],
    ["ORIGINAL / 原本含义", meme.original_meaning],
    ["EVOLUTION / 新的意义", meme.new_meaning],
    ["SCENES / 使用场景", meme.usage_scenes],
    ["FIRST SIGNAL / 初次登场", meme.first_appearance],
  ];
  const kindLabels = { news: "事件报道", analysis: "传播观察", source: "收录依据", collection: "专题盘点" };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <article className="detail-modal" role="dialog" aria-modal="true" aria-label={locale === "en" ? `${meme.name} cultural guide` : `${meme.name}档案`} lang={locale === "en" ? "en" : "zh-CN"}>
        <button className="close-modal" onClick={onClose} aria-label={locale === "en" ? "Close" : "关闭"}>×</button>
        <div className="detail-hero">
          <div className="detail-heading">
            <span className="detail-kicker">{locale === "en" ? "CHINESE MEME / CULTURAL FIELD GUIDE" : "MEME ARCHIVE / PUBLIC FILE"}</span>
            <span className={`quality-badge quality-${meme.quality}`}>{locale === "en" ? (meme.international_level === "curated" ? "CURATED ENGLISH" : meme.international_level === "translated" ? "MACHINE-ASSISTED ENGLISH" : "ENGLISH ORIENTATION") : (meme.quality === "detailed" ? "详尽档案" : "待继续校订")}</span>
            <span className="research-badge">{locale === "en" ? (meme.international_level === "curated" ? "Edited for meaning, context and real-world use" : meme.international_level === "translated" ? "Translated from this entry’s researched Chinese record; verify nuance with the linked source" : "A concise guide; consult the linked Chinese source for full context") : (meme.research_method === "source_page" ? "依据独立正文整理" : meme.research_method === "editorial" ? "编辑核验" : "依据来源与传播语境整理")}</span>
            <h2 lang="zh-CN">{meme.name}</h2>
            {locale === "en" && <p className="international-title">{meme.international.title_en}{meme.international.pronunciation ? <small>Pronounced: {meme.international.pronunciation}</small> : null}</p>}
            <p>{locale === "en" ? meme.international.meaning_en : meme.summary}</p>
            <div className="tag-row">{tagsOf(meme.tags).map((tag) => <span key={tag}>#{tagLabel(tag, locale)}</span>)}</div>
          </div>
          <div className="detail-glyph" aria-hidden="true">{meme.name.slice(0, 1)}</div>
        </div>
        <div className="detail-body">
          <div className="detail-sections">{sections.map(([label, value]) => <section key={label}><span>{label}</span><p>{value}</p></section>)}</div>
          {meme.related_news?.length ? (
            <section className="news-dossier">
              <div className="news-head"><div><span>RELATED SIGNALS</span><h3>{locale === "en" ? "Related reporting" : "相关热点新闻"}</h3></div><strong>{locale === "en" ? `${meme.related_news.length} verified Chinese-language sources` : `${meme.related_news.length} 条可核验来源`}</strong></div>
              <div className="news-timeline">{meme.related_news.map((item) => (
                <a className="news-item" href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${item.published_at}`}>
                  <time>{item.published_at || (locale === "en" ? "Date unknown" : "日期待考")}</time>
                  <div lang="zh-CN"><div className="news-meta"><b>{locale === "en" ? "ZH SOURCE" : (kindLabels[item.kind] || "相关资料")}</b><span>{item.source}</span></div><h4>{item.title}</h4><p>{item.summary}</p></div>
                  <i aria-hidden="true">↗</i>
                </a>
              ))}</div>
            </section>
          ) : (
            <section className="news-empty"><span>RELATED SIGNALS</span><h3>{locale === "en" ? "Reporting still under review" : "相关新闻仍在核验"}</h3><p>{locale === "en" ? "No independently verifiable report has been attached yet. We do not present ordinary search results as news evidence." : "暂未找到可稳定引用的独立报道，因此不会用普通搜索结果冒充热点新闻。"}</p></section>
          )}
          <footer><span>{locale === "en" ? "PRIMARY CHINESE SOURCE" : "来源"} / {meme.source_title}</span><a href={meme.source_url} target="_blank" rel="noreferrer">{locale === "en" ? "View original source" : "查看收录依据"} ↗</a></footer>
        </div>
      </article>
    </div>
  );
}

export default function Home() {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [selected, setSelected] = useState<Meme | null>(null);
  const [visibleCount, setVisibleCount] = useState(36);
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    fetch("/memes.json?v=international-2026-08-12", { cache: "no-store" }).then((response) => response.json()).then((data) => setMemes(data.memes || [])).catch(() => setMemes([]));
  }, []);

  const changeLocale = (next: Locale) => { setLocale(next); window.localStorage.setItem("meme-archive-locale", next); };

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    memes.forEach((meme) => tagsOf(meme.tags).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [memes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return memes.filter((meme) => {
      const matchesQuery = !needle || `${meme.name} ${meme.aliases} ${meme.summary} ${meme.tags} ${meme.international?.title_en || ""} ${meme.international?.pronunciation || ""} ${meme.international?.meaning_en || ""}`.toLocaleLowerCase("zh-CN").includes(needle);
      const matchesTag = !activeTag || tagsOf(meme.tags).includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [memes, query, activeTag]);

  const go = (next: View) => { setView(next); setVisibleCount(36); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") || "");
    setQuery(value); setActiveTag(""); go("list");
  };
  const chooseTag = (tag: string) => { setActiveTag(tag); setQuery(""); go("list"); };

  return (
    <main lang={locale === "en" ? "en" : "zh-CN"}>
      <header className="site-header">
        <button className="brand" onClick={() => go("home")}><b>梗</b><span>{locale === "en" ? "Chinese Meme Archive" : "网络热梗档案馆"}<small>{locale === "en" ? "中文网络梗档案馆" : "MEME OBSERVATORY"}</small></span></button>
        <nav><button className={view === "list" ? "active" : ""} onClick={() => go("list")}>{locale === "en" ? "Index" : "索引"}</button><button className={view === "card" ? "active" : ""} onClick={() => go("card")}>{locale === "en" ? "Gallery" : "图鉴"}</button><div className="locale-switch" role="group" aria-label="Language"><button className={locale === "en" ? "active" : ""} onClick={() => changeLocale("en")}>EN</button><button className={locale === "zh" ? "active" : ""} onClick={() => changeLocale("zh")}>中文</button></div></nav>
      </header>

      {view === "home" ? <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{locale === "en" ? "A FIELD GUIDE TO CHINESE INTERNET CULTURE" : "INTERNET LANGUAGE OBSERVATORY · PUBLIC PREVIEW"}</p>
            <h1>{locale === "en" ? <>Chinese memes,<br /><em>explained.</em></> : <>今天又有<br /><em>什么梗？</em></>}</h1>
            <p className="lede">{locale === "en" ? "Keep the original Chinese. Understand the joke, the cultural context, and when you should—or should not—use it." : "从一句话开始，追溯互联网的集体记忆。这里记录热梗的来路、变形，以及它们被使用的真实时刻。"}</p>
            <div className="hero-meta"><span><strong>{String(memes.length).padStart(3, "0")}</strong> {locale === "en" ? "public entries" : "条公开档案"}</span><i /><span>{locale === "en" ? "English guide · Chinese sources" : "Canvas 词球 · 公网性能版"}</span></div>
            <form className="search-shell" onSubmit={search}><input name="q" placeholder={locale === "en" ? "Search Chinese, pinyin, meaning, or context" : "输入一句话、出处或场景"} aria-label={locale === "en" ? "Search Chinese memes" : "搜索热梗"} /><button>{locale === "en" ? "SEARCH" : "开始检索"} <span>↗</span></button></form>
            <div className="legend"><span><i className="hot" />{locale === "en" ? "trending" : "近期热门"}</span><span><i className="new" />{locale === "en" ? "newly archived" : "最新收录"}</span><span><i className="editorial" />{locale === "en" ? "editorial pick" : "编辑精选"}</span></div>
          </div>
          {memes.length ? <CanvasSphere memes={memes.slice(0, 22)} onSelect={setSelected} locale={locale} /> : <div className="sphere-loading">{locale === "en" ? "Connecting archive…" : "档案信号接入中…"}</div>}
          <div className="cloud-hint">{locale === "en" ? "DRAG TO EXPLORE · TAP A CHINESE TERM" : "拖动探索 · 点击查看 · 单画布渲染"}</div>
          <div className="hero-footer"><div><button onClick={() => go("list")}>{locale === "en" ? "Text index" : "文字索引"} ↗</button><button onClick={() => go("card")}>{locale === "en" ? "Visual gallery" : "视觉图鉴"} ↗</button></div><span>LIVE SIGNAL / 2026</span></div>
        </section>
        <section className="tag-observatory">
          <div className="section-head"><div><p className="eyebrow">EXPLORE BY SIGNALS</p><h2>{locale === "en" ? "Browse by context" : "从标签进入"}</h2></div><button onClick={() => go("list")}>{locale === "en" ? "Browse all entries" : "查看全部档案"} ↗</button></div>
          <div className="tag-grid">{tagCounts.map(([tag, count]) => <button key={tag} onClick={() => chooseTag(tag)}><span>#{tagLabel(tag, locale)}</span><small>{count} {locale === "en" ? "entries" : "条档案"}</small></button>)}</div>
        </section>
      </> : <section className="archive-page">
        <div className="archive-head"><div><p className="eyebrow">THE PUBLIC INDEX · READ ONLY</p><div><h1>{locale === "en" ? (view === "card" ? "Visual gallery" : "Text index") : (view === "card" ? "视觉图鉴" : "文字索引")}</h1><span>{filtered.length} {locale === "en" ? "results" : "条结果"}</span></div></div><form onSubmit={search}><input name="q" defaultValue={query} placeholder={locale === "en" ? "Search the archive" : "检索档案"} aria-label={locale === "en" ? "Search the archive" : "检索档案"} /></form></div>
        <div className="filters"><button className={!activeTag ? "active" : ""} onClick={() => setActiveTag("")}>{locale === "en" ? "All topics" : "全部标签"}</button>{tagCounts.slice(0, 8).map(([tag, count]) => <button className={activeTag === tag ? "active" : ""} key={tag} onClick={() => setActiveTag(tag)}>#{tagLabel(tag, locale)} <small>{count}</small></button>)}</div>
        {view === "list" ? <div className="meme-list">{filtered.slice(0, visibleCount).map((meme, index) => <button className="meme-row" key={meme.name} onClick={() => setSelected(meme)}><span>{String(index + 1).padStart(2, "0")}</span><div><h3 lang="zh-CN">{meme.name}</h3><p>{locale === "en" ? meme.international.meaning_en : meme.summary}</p></div><div className="row-tags">{tagsOf(meme.tags).map((tag) => <i key={tag}>#{tagLabel(tag, locale)}</i>)}</div><b>↗</b></button>)}</div> : <div className="card-grid">{filtered.slice(0, visibleCount).map((meme, index) => <button className="meme-card" key={meme.name} onClick={() => setSelected(meme)}><span>FILE / {String(index + 1).padStart(4, "0")}</span><i>{meme.international_level === "curated" && locale === "en" ? "CURATED EN" : "ARCHIVED"}</i><b aria-hidden="true">{meme.name.slice(0, 1)}</b><div><h3 lang="zh-CN">{meme.name}</h3><p>{locale === "en" ? meme.international.meaning_en : meme.summary}</p></div></button>)}</div>}
        {visibleCount < filtered.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + 36)}>{locale === "en" ? "Load more" : "继续加载"} ↓</button>}
      </section>}
      {selected && <Detail meme={selected} onClose={() => setSelected(null)} locale={locale} />}
    </main>
  );
}
