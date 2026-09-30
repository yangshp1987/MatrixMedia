"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const adapterFiles = ["assistedArticle.js", "juejinAssisted.js", "zhihu.js", "wechatArticle.js", "twitterArticle.js"];
for (const file of adapterFiles) {
  const source = fs.readFileSync(path.join(__dirname, "../src/main/services/upLoad", file), "utf8");
  assert.ok(!/CONFIRM_BUTTON_SELECTOR|PUBLISH_BUTTON_SELECTOR/.test(source), `${file} 不得引用最终按钮 selector`);
  assert.ok(!/clickByText\s*\([^)]*(发布|群发|发送|Post|Tweet)/i.test(source), `${file} 不得按最终动作文字点击`);
}
const core = fs.readFileSync(path.join(__dirname, "../src/main/services/upLoad/assistedArticle.js"), "utf8");
assert.ok(core.includes('MANUAL_READY_STATUS = "ready_for_manual_send"'));
assert.ok(core.includes("data._manualPrepared = true"));
assert.ok(!/\.click\s*\(/.test(core), "通用人工确认适配器不得执行 click");
console.log("test-assisted-article-no-send passed");
