"use strict";

require("@babel/register")({
  extensions: [".js"],
  ignore: [/node_modules/],
});

const assert = require("assert");
const { parsePublishMultipostArgs } = require("../src/main/cli/parsePublishMultipostArgs");

function ok(argv) {
  const parsed = parsePublishMultipostArgs(argv);
  assert.strictEqual(parsed.ok, true, parsed.error);
  return parsed.value;
}

function fail(argv, text) {
  const parsed = parsePublishMultipostArgs(argv);
  assert.strictEqual(parsed.ok, false, "expected failure but got ok");
  assert.ok(parsed.error.includes(text), `error "${parsed.error}" should include "${text}"`);
}

// help
{
  const h = parsePublishMultipostArgs(["--help"]);
  assert.strictEqual(h.ok, true);
  assert.strictEqual(h.value.help, true);
  console.log("✓ help");
}

// article basic
{
  const v = ok(["-p", "知乎", "-p", "ARTICLE_CSDN", "-t", "标题", "--content", "正文"]);
  assert.deepStrictEqual(v.platforms, ["ARTICLE_ZHIHU", "ARTICLE_CSDN"]);
  assert.strictEqual(v.contentType, "ARTICLE");
  assert.strictEqual(v.autoPublish, false);
  assert.strictEqual(v.title, "标题");
  assert.strictEqual(v.markdownContent, "正文");
  console.log("✓ article basic");
}

// aliases: csdn / 简书 / medium
{
  const v = ok(["--platform", "csdn,简书", "-t", "t", "--content", "c"]);
  assert.deepStrictEqual(v.platforms, ["ARTICLE_CSDN", "ARTICLE_JIANSHU"]);
  console.log("✓ aliases: csdn / 简书");
}

// --type video
{
  const v = ok(["--type", "video", "-p", "抖音", "-t", "t", "--video", "/tmp/v.mp4"]);
  assert.strictEqual(v.contentType, "VIDEO");
  assert.strictEqual(v.platforms[0], "VIDEO_DOUYIN");
  console.log("✓ type=video");
}

// --type dynamic
{
  const v = ok(["--type", "dynamic", "-p", "DYNAMIC_WEIBO", "-t", "t", "--content", "内容"]);
  assert.strictEqual(v.contentType, "DYNAMIC");
  assert.strictEqual(v.platforms[0], "DYNAMIC_WEIBO"); // direct platform id passthrough
  console.log("✓ type=dynamic");
}

// mode auto-publish
{
  const v = ok(["-p", "知乎", "-t", "t", "--content", "c", "--mode", "auto-publish"]);
  assert.strictEqual(v.autoPublish, true);
  console.log("✓ mode=auto-publish");
}

// extension-id
{
  const v = ok(["-p", "知乎", "-t", "t", "--content", "c", "--extension-id", "abc123"]);
  assert.strictEqual(v.extensionId, "abc123");
  console.log("✓ extension-id");
}

// cover / image / tags / summary
{
  const v = ok(["-p", "ARTICLE_CSDN", "-t", "t", "--content", "c", "--cover", "/c.png", "--image", "/a.jpg", "--image", "/b.jpg", "--tags", "js node", "--summary", "摘要"]);
  assert.strictEqual(v.coverPath, "/c.png");
  assert.deepStrictEqual(v.imagePaths, ["/a.jpg", "/b.jpg"]);
  assert.strictEqual(v.tags, "js node");
  assert.strictEqual(v.summary, "摘要");
  console.log("✓ cover/image/tags/summary");
}

// failures
fail([], "缺少发布平台");
fail(["-p", "知乎"], "缺少标题");
fail(["-p", "知乎", "-t", "t"], "缺少正文");
fail(["-p", "知乎", "-t", "t", "--content", "c", "--mode", "garbage"], "未知发布模式");
fail(["--type", "video", "-p", "抖音", "-t", "t"], "视频文件");
fail(["--type", "xxx", "-p", "知乎", "-t", "t", "--content", "c"], "未知内容类型");
// unsupported platform for type
fail(["--type", "video", "-p", "掘金", "-t", "t", "--video", "/v.mp4"], "不支持平台");
console.log("✓ failure cases");

console.log("ALL PASS");
