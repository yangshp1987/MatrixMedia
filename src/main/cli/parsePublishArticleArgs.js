"use strict";

import {
  ARTICLE_PUBLISH_MODE,
  AUTOMATIC_ARTICLE_PLATFORMS,
  isAssistedArticlePlatform,
  normalizeArticlePublishMode,
  resolveArticlePlatform,
} from "../../shared/articlePublish.js";

function readOptionValue(args, index, optionName) {
  const next = args[index + 1];
  if (next === undefined || String(next).startsWith("-")) {
    return { ok: false, error: `缺少 ${optionName} 的值` };
  }
  return { ok: true, value: next, nextIndex: index + 1 };
}

function useNonBlank(value, fallback) {
  const text = String(value || "").trim();
  return text ? value : fallback;
}

function hasNonBlank(value) {
  return String(value || "").trim().length > 0;
}

/**
 * 解析 `cli publish-article` 后的 argv（不含子命令名 publish-article）
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function parsePublishArticleArgs(subArgv) {
  const args = Array.isArray(subArgv) ? subArgv : [];
  if (args.includes("--help") || args.includes("-h")) {
    return { ok: true, value: { help: true } };
  }

  const out = {
    platform: null,
    title: null,
    content: "",
    file: null,
    cover: "",
    phone: null,
    partition: null,
    category: "前端",
    tags: "前端 Electron",
    summary: "",
    publishAt: null,
    show: false,
    closeWindowAfterPublish: true,
    mode: ARTICLE_PUBLISH_MODE.AUTOMATIC,
    images: [],
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--platform" || a === "-p") {
      const read = readOptionValue(args, i, "--platform");
      if (!read.ok) return { ok: false, error: read.error };
      out.platform = read.value;
      i = read.nextIndex;
    } else if (a === "--title" || a === "-t") {
      const read = readOptionValue(args, i, "--title");
      if (!read.ok) return { ok: false, error: read.error };
      out.title = read.value;
      i = read.nextIndex;
    } else if (a === "--content") {
      const read = readOptionValue(args, i, "--content");
      if (!read.ok) return { ok: false, error: read.error };
      out.content = read.value || "";
      i = read.nextIndex;
    } else if (a === "--file" || a === "-f") {
      const read = readOptionValue(args, i, "--file");
      if (!read.ok) return { ok: false, error: read.error };
      out.file = read.value;
      i = read.nextIndex;
    } else if (a === "--cover") {
      const read = readOptionValue(args, i, "--cover");
      if (!read.ok) return { ok: false, error: read.error };
      out.cover = read.value || "";
      i = read.nextIndex;
    } else if (a === "--phone") {
      const read = readOptionValue(args, i, "--phone");
      if (!read.ok) return { ok: false, error: read.error };
      out.phone = String(read.value || "").trim();
      i = read.nextIndex;
    } else if (a === "--partition") {
      const read = readOptionValue(args, i, "--partition");
      if (!read.ok) return { ok: false, error: read.error };
      out.partition = String(read.value || "").trim();
      i = read.nextIndex;
    } else if (a === "--category") {
      const read = readOptionValue(args, i, "--category");
      if (!read.ok) return { ok: false, error: read.error };
      out.category = useNonBlank(read.value, out.category);
      i = read.nextIndex;
    } else if (a === "--tags") {
      const read = readOptionValue(args, i, "--tags");
      if (!read.ok) return { ok: false, error: read.error };
      out.tags = useNonBlank(read.value, out.tags);
      i = read.nextIndex;
    } else if (a === "--summary") {
      const read = readOptionValue(args, i, "--summary");
      if (!read.ok) return { ok: false, error: read.error };
      out.summary = read.value || "";
      i = read.nextIndex;
    } else if (a === "--publish-at") {
      const read = readOptionValue(args, i, "--publish-at");
      if (!read.ok) return { ok: false, error: read.error };
      out.publishAt = read.value;
      i = read.nextIndex;
    } else if (a === "--mode") {
      const read = readOptionValue(args, i, "--mode");
      if (!read.ok) return { ok: false, error: read.error };
      out.mode = normalizeArticlePublishMode(read.value);
      if (!out.mode) return { ok: false, error: `未知文章发布模式: ${read.value}` };
      i = read.nextIndex;
    } else if (a === "--image") {
      const read = readOptionValue(args, i, "--image");
      if (!read.ok) return { ok: false, error: read.error };
      out.images.push(read.value);
      i = read.nextIndex;
    } else if (a === "--show") {
      out.show = true;
    } else if (a === "--no-close-window") {
      out.closeWindowAfterPublish = false;
    }
  }

  if (!out.platform) {
    return { ok: false, error: "缺少 --platform（或 -p）" };
  }

  const pt = resolveArticlePlatform(out.platform);
  if (!isAssistedArticlePlatform(pt)) {
    return { ok: false, error: `未知平台: ${out.platform}` };
  }
  if (out.mode !== ARTICLE_PUBLISH_MODE.ASSISTED && !AUTOMATIC_ARTICLE_PLATFORMS.includes(pt)) {
    return { ok: false, error: `${pt} 仅支持 --mode assisted（manual-confirm）` };
  }
  out.platform = pt;

  if (!hasNonBlank(out.partition)) {
    if (!hasNonBlank(out.phone)) {
      return {
        ok: false,
        error: "缺少 --phone 或完整 --partition（与 GUI 一致，如 persist:13800138000掘金）",
      };
    }
    const phoneSeg = String(out.phone).split("-")[0];
    out.partition = `persist:${phoneSeg}${out.platform}`;
  }

  if (!out.title || !String(out.title).trim()) {
    return { ok: false, error: "缺少 --title（或 -t）文章标题" };
  }

  if (!String(out.content || "").trim() && !hasNonBlank(out.file)) {
    return { ok: false, error: "缺少 --content 或 --file（至少提供正文或 Markdown 文件路径）" };
  }

  if (out.mode === ARTICLE_PUBLISH_MODE.ASSISTED) {
    if (out.publishAt) return { ok: false, error: "人工确认模式不支持 --publish-at" };
    // 强制安全不变量：人工确认必须可见，且不得由程序关闭待发送窗口。
    out.show = true;
    out.closeWindowAfterPublish = false;
  } else if (out.show) {
    console.warn("MatrixMedia: CLI 自动文章发布不显示浏览器窗口，已忽略 --show。");
    out.show = false;
  }

  return { ok: true, value: out };
}

export function publishArticleHelpText() {
  return `
用法: <应用> cli publish-article [选项]

选项:
  -p, --platform <id>   平台：juejin / zhihu / wechat / x / twitter（支持中文别名）
  -t, --title <text>    文章标题（必填）
      --content <text>  文章正文；与 --file 至少提供一个
  -f, --file <path>     Markdown 正文文件路径；与 --content 至少提供一个
      --cover <path>    封面图片路径
      --image <path>    正文图片，可重复传入
      --phone <id>      账号手机号（与 GUI 账号树一致，可与 partition 二选一）
      --partition <p>   完整 session partition，如 persist:13800138000掘金
      --category <name> 分类，默认 "前端"
      --tags <text>     标签，默认 "前端 Electron"，多个标签用空格分隔
      --summary <text>  文章摘要
      --mode <mode>     publish（仅掘金）或 assisted / manual-confirm
      --publish-at <t>  一次性定时发布；assisted 不支持
      --show            自动模式忽略；assisted 模式强制显示
      --no-close-window 不自动关窗；assisted 模式强制启用
  -h, --help            显示帮助

示例:
  matrixmedia cli publish-article -p juejin --phone 13800138000 -t "标题" --content "正文"
  matrixmedia cli publish-article -p jj --phone 13800138000 -t "标题" -f ./article.md --tags "前端 Electron"
  matrixmedia cli publish-article -p zhihu --phone 13800138000 -t "标题" --content "正文" --mode assisted
  matrixmedia cli publish-article -p wechat --phone 公众号A -t "标题" -f ./article.md --mode manual-confirm
  matrixmedia cli publish-article -p x --phone account -t "标题" --content "正文" --mode assisted
`.trim();
}
