import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public meme archive shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Chinese Meme Archive — 中文网络热梗档案馆<\/title>/i);
  assert.match(html, /Chinese memes/);
  assert.match(html, /English guide/);
  assert.match(html, /DRAG TO EXPLORE/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships an expanded, traceable dataset with editorial news", async () => {
  const data = JSON.parse(await readFile(new URL("../public/memes.json", import.meta.url), "utf8"));
  assert.ok(data.memes.length >= 515);
  assert.equal(new Set(data.memes.map((meme) => meme.name)).size, data.memes.length);
  for (const meme of data.memes) {
    assert.ok(meme.name && meme.summary && meme.origin && meme.new_meaning);
    assert.match(meme.source_url, /^https:\/\//);
    assert.match(meme.quality, /^(detailed|needs_review)$/);
    assert.match(meme.international_level, /^(curated|translated|orientation)$/);
    assert.ok(meme.international?.meaning_en && meme.international?.culture_en && meme.international?.use_en);
  }
  const newsMemes = data.memes.filter((meme) => meme.related_news.length);
  assert.ok(newsMemes.length >= 15);
  assert.ok(newsMemes.every((meme) => meme.related_news.every((item) => /^https:\/\//.test(item.url))));
  assert.equal(data.memes.filter((meme) => meme.quality === "detailed").length, data.memes.length);
  assert.equal(new Set(data.memes.map((meme) => meme.summary)).size, data.memes.length);
  assert.equal(new Set(data.memes.map((meme) => meme.origin)).size, data.memes.length);
  assert.ok(data.memes.every((meme) => meme.summary.length >= 70 && meme.origin.length >= 100 && meme.usage_scenes.length >= 90));
  assert.ok(data.memes.filter((meme) => meme.international_level === "curated").length >= 15);
  assert.equal(data.memes.filter((meme) => meme.international_level === "orientation").length, 0);
  assert.equal(new Set(data.memes.map((meme) => meme.international.meaning_en)).size, data.memes.length);
});

test("uses one Canvas layer for the animated sphere", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<canvas/);
  assert.match(page, /getContext\("2d"/);
  assert.match(page, /devicePixelRatio \|\| 1, 1\.5/);
  assert.match(page, /1000 \/ 30/);
  assert.doesNotMatch(page, /className="meme-word"/);
});
