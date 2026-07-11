import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyChannel, classifyAssistant } from "../lib/db.js";

test("AI assistants (Western) → ai channel + named", () => {
  for (const [ref, name] of [
    ["https://chatgpt.com/", "ChatGPT"],
    ["https://www.perplexity.ai/search", "Perplexity"],
    ["https://claude.ai/chat/abc", "Claude"],
    ["https://gemini.google.com/app", "Gemini"],
    ["https://copilot.microsoft.com/", "Copilot"],
  ]) {
    assert.equal(classifyChannel(ref), "ai", `${ref} should be ai`);
    assert.equal(classifyAssistant(ref), name, `${ref} → ${name}`);
  }
});

test("Chinese AI assistants → ai channel + named (the traffic we were blind to)", () => {
  assert.equal(classifyChannel("https://yuanbao.tencent.com/chat"), "ai");
  assert.equal(classifyAssistant("https://yuanbao.tencent.com/chat"), "Yuanbao");
  assert.equal(classifyAssistant("https://www.doubao.com/"), "Doubao");
  assert.equal(classifyAssistant("https://kimi.moonshot.cn/"), "Kimi");
  assert.equal(classifyAssistant("https://chat.deepseek.com/"), "DeepSeek");
});

test("Baidu SEARCH is organic, Baidu AI is ai", () => {
  assert.equal(classifyChannel("https://m.baidu.com/s?word=ai+agents"), "organic");
  assert.equal(classifyChannel("https://chat.baidu.com/"), "ai");
});

test("regular search engines stay organic", () => {
  assert.equal(classifyChannel("https://www.google.com/"), "organic");
  assert.equal(classifyChannel("https://www.bing.com/search?q=x"), "organic");
  assert.equal(classifyChannel("https://duckduckgo.com/"), "organic");
});

test("social + direct unchanged", () => {
  assert.equal(classifyChannel("https://www.reddit.com/r/LocalLLaMA"), "social");
  assert.equal(classifyChannel("https://news.ycombinator.com/"), "social");
  assert.equal(classifyChannel(""), "direct");
});

test("unknown external host → referral, not misfiled as ai", () => {
  assert.equal(classifyChannel("https://someblog.example.com/post"), "referral");
  assert.equal(classifyAssistant("https://someblog.example.com/post"), null);
});
