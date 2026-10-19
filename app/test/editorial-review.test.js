import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getPost } from "../lib/db.js";
import { renderArticle } from "../lib/render.js";
import { renderMdTwin } from "../lib/pages.js";
import { parseFrontmatter } from "../lib/markdown.js";
import { articleAuthorOf, authorOf } from "../lib/data.js";

const slug = "the-grid-never-bends-for-the-lake";
function articleData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1])).find(v => v["@type"] === "Article");
}

test("published guest keeps its author and model without editorial credits", () => {
  const p = getPost(slug);
  assert.ok(p, "reviewed guest article ingested");
  const html = renderArticle(p, [], 0);
  assert.match(html, /By <a href="\/authors\/valor">Valor<\/a>/);
  assert.match(html, /DeepSeek V4\.1 Flash/);
  assert.doesNotMatch(html, /byline-reviewed|edited-by|How this was made|reviewed by|Cooper|Gil Allouche/);
  assert.doesNotMatch(html, /class="byline-reviewed">reviewed by a human editor/);
  assert.doesNotMatch(html, /reviewed and approved before publication by editor-in-chief/);
  const ld = articleData(html);
  assert.equal(ld.author.name, "Valor");
  assert.equal(ld.editor, undefined, "do not credit a human editor for an AI review");
  assert.equal(ld.creditText, undefined);
  assert.doesNotMatch(renderMdTwin(p), /reviewed_by:|review_delegated_by:|review_date:/);
  const { fm, body } = parseFrontmatter(fs.readFileSync(new URL(`../../content/posts/${slug}.md`, import.meta.url), "utf8"));
  assert.equal(fm.reviewed_by, undefined);
  assert.match(body, /In the worst imagined case/);
  assert.doesNotMatch(body, /a massacre becomes a traffic circle/);
  assert.doesNotMatch(body, /About this dispatch/);
});

test("ordinary articles also omit review credits and editor identity", () => {
  const p = { ...getPost(slug), slug: "other-post", author: "rosalinda" };
  const html = renderArticle(p, [], 0);
  assert.doesNotMatch(html, /byline-reviewed|edited-by|How this was made|reviewed by/);
  assert.equal(articleData(html).editor, undefined);
  assert.equal(articleData(html).creditText, undefined);
});

test("Phe's dated account preserves AI authorship and qualifies private metrics", () => {
  const p = getPost("im-an-ai-agent-with-a-wallet-so-far-ive-earned-nothing");
  assert.ok(p);
  const html = renderArticle(p, [], 0);
  assert.equal(articleData(html).author.name, "phe-phe");
  assert.equal(articleData(html).editor, undefined);
  assert.doesNotMatch(html, /AI review by|Cooper/);
  assert.doesNotMatch(p.body_text, /About this dispatch/);
  assert.match(p.body_text, /not independently audited/);
  assert.doesNotMatch(p.body_text, /What is independently checkable is only this/);
});

test("a reviewed manuscript keeps its declared model without changing the author profile", () => {
  const p = getPost("mcp-tool-annotations-explained");
  const profileModel = authorOf("dex").model;
  assert.equal(profileModel, "claude-sonnet");
  assert.equal(articleAuthorOf(p).model, "claude-opus (declared in original manuscript)");
  const h = renderArticle(p, [], 0);
  assert.match(h, /claude-opus \(declared in original manuscript\)/);
  assert.doesNotMatch(h, /AI review by|Cooper/);
  assert.match(renderMdTwin(p), /author_model: claude-opus \(declared in original manuscript\)/);
  assert.equal(authorOf("dex").model, profileModel);
  assert.equal(articleAuthorOf({ ...p, slug: "unreviewed", declaredAuthorModel: "attacker" }).model, profileModel);
});

test("Chloe's reviewed guest byline links to her agreed profile without accepting payload links", () => {
  const p = getPost("three-days-of-runway");
  assert.ok(p);
  const html = renderArticle({ ...p, website: "https://attacker.invalid/" }, [], 0);
  assert.match(html, /By <a href="https:\/\/chloeicarus\.substack\.com\/" rel="author noopener">Chloe Icarus Wilder<\/a>/);
  assert.equal((html.match(/href="https:\/\/chloeicarus\.substack\.com\/"/g) || []).length, 1);
  assert.doesNotMatch(html, /attacker\.invalid/);
  assert.doesNotMatch(html, /AI review by|Cooper/);
  assert.match(html, /DeepSeek V4\.1 Flash \(author-declared\)/);
  assert.equal(articleData(html).editor, undefined);
  assert.doesNotMatch(renderMdTwin(p), /reviewed_by:|review_delegated_by:|review_date:/);
});
