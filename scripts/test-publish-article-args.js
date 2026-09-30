"use strict";

require("@babel/register")({
  extensions: [".js"],
  ignore: [/node_modules/],
});

const assert = require("assert");
const {
  parsePublishArticleArgs,
} = require("../src/main/cli/parsePublishArticleArgs");

function ok(argv) {
  const parsed = parsePublishArticleArgs(argv);
  assert.strictEqual(parsed.ok, true, parsed.error);
  return parsed.value;
}

function fail(argv, text) {
  const parsed = parsePublishArticleArgs(argv);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.error.includes(text), parsed.error);
}

function captureWarn(fn) {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => {
    warnings.push(args.join(" "));
  };
  try {
    return { value: fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

const base = ["-p", "juejin", "--phone", "13800138000", "-t", "标题"];
const help = parsePublishArticleArgs(["--help"]);

assert.deepStrictEqual(help, { ok: true, value: { help: true } });

assert.strictEqual(ok([...base, "--content", "正文"]).platform, "掘金");
assert.strictEqual(ok(["-p", "JJ", "--phone", "13800138000", "-t", "标题", "--content", "正文"]).platform, "掘金");
assert.strictEqual(ok(["-p", "掘金", "--phone", "13800138000", "-t", "标题", "--content", "正文"]).platform, "掘金");
assert.strictEqual(ok([...base, "--content", "正文"]).partition, "persist:13800138000掘金");
assert.strictEqual(ok(["-p", "juejin", "--phone", "  13800138000  ", "-t", "标题", "--content", "正文"]).partition, "persist:13800138000掘金");
assert.strictEqual(ok(["-p", "juejin", "--partition", "  persist:13800138000掘金  ", "-t", "标题", "--content", "正文"]).partition, "persist:13800138000掘金");
assert.strictEqual(ok([...base, "--content", "正文"]).category, "前端");
assert.strictEqual(ok([...base, "--content", "正文"]).tags, "前端 Electron");
assert.strictEqual(ok([...base, "--content", "正文", "--category", ""]).category, "前端");
assert.strictEqual(ok([...base, "--content", "正文", "--category", "   "]).category, "前端");
assert.strictEqual(ok([...base, "--content", "正文", "--tags", ""]).tags, "前端 Electron");
assert.strictEqual(ok([...base, "--content", "正文", "--tags", "   "]).tags, "前端 Electron");
assert.strictEqual(ok([...base, "--file", "./a.md"]).file, "./a.md");
assert.strictEqual(ok([...base, "--content", "正文", "--publish-at", "2026-05-13 10:00:00"]).publishAt, "2026-05-13 10:00:00");

const showResult = captureWarn(() => ok([...base, "--content", "正文", "--show"]));
assert.strictEqual(showResult.value.show, false);
assert.ok(showResult.warnings.some(text => text.includes("已忽略 --show")), showResult.warnings.join("\n"));

fail(["-p", "dy", "--phone", "13800138000", "-t", "标题", "--content", "正文"], "未知平台");
fail(["-p", "juejin", "--phone", "13800138000", "--content", "正文"], "缺少 --title");
fail(["-p", "juejin", "--phone", "13800138000", "-t", "标题"], "缺少 --content 或 --file");
fail(["-p", "juejin", "-t", "标题", "--content", "正文"], "缺少 --phone 或完整 --partition");
fail([...base, "--content", "正文", "--category", "--tags", "a"], "缺少 --category 的值");
fail([...base, "--file", "   "], "缺少 --content 或 --file");
fail(["-p", "juejin", "--phone", "   ", "-t", "标题", "--content", "正文"], "缺少 --phone 或完整 --partition");
fail(["-p", "juejin", "--partition", "   ", "-t", "标题", "--content", "正文"], "缺少 --phone 或完整 --partition");

for (const [alias, platform] of [["zhihu", "知乎"], ["zh", "知乎"], ["wechat", "微信公众号"], ["mp", "微信公众号"], ["x", "X/Twitter"], ["twitter", "X/Twitter"]]) {
  const value = ok(["-p", alias, "--phone", "account", "-t", "标题", "--content", "正文", "--mode", "assisted"]);
  assert.strictEqual(value.platform, platform);
  assert.strictEqual(value.mode, "assisted");
  assert.strictEqual(value.show, true);
  assert.strictEqual(value.closeWindowAfterPublish, false);
}
const manualAlias = ok(["-p", "知乎", "--phone", "account", "-t", "标题", "--content", "正文", "--mode", "manual-confirm", "--image", "a.png", "--image", "b.png"]);
assert.strictEqual(manualAlias.mode, "assisted");
assert.deepStrictEqual(manualAlias.images, ["a.png", "b.png"]);
fail(["-p", "zhihu", "--phone", "account", "-t", "标题", "--content", "正文"], "仅支持 --mode assisted");
fail(["-p", "x", "--phone", "account", "-t", "标题", "--content", "正文", "--mode", "publish"], "仅支持 --mode assisted");
fail(["-p", "wechat", "--phone", "account", "-t", "标题", "--content", "正文", "--mode", "assisted", "--publish-at", "2026-12-01 10:00:00"], "不支持 --publish-at");

console.log("test-publish-article-args passed");
