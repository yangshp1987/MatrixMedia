"use strict";

import {
  normalizeMultipostContentType,
  resolveMultipostPlatform,
  isMultipostAutoPublish,
  MULTIPOST_BRIDGE_PORT,
  MULTIPOST_DEFAULT_TIMEOUT_MS,
  MULTIPOST_CONTENT_TYPE_LABELS,
  multipostHelpLines,
} from "../../shared/multipost.js";

function readOptionValue(args, index, optionName) {
  const next = args[index + 1];
  if (next === undefined || String(next).startsWith("-")) {
    return { ok: false, error: `缺少 ${optionName} 的值` };
  }
  return { ok: true, value: next, nextIndex: index + 1 };
}

export function publishMultipostHelpText() {
  return `
用法: <应用> cli publish-multipost [选项]

通过 MultiPost Extension 发布内容到 30+ 个平台（扩展覆盖平台）。
需要在 Chrome/Edge 浏览器中打开 http://localhost:${BRIDGE_PORT}/bridge.html
并安装 MultiPost 扩展（Chrome: dhohkaclnjgcikfoaacfgijgjgceofih）。

选项:
  -p, --platform <平台>     发布平台（可指定多次，或逗号分隔），例：知乎 ARTICLE_CSDN 简书
  --type <类型>             内容类型：article（默认）/ video / dynamic / podcast
  --title <标题>            标题（必填）
  --content <正文>          Markdown 正文（与 --file 二选一）
  -f, --file <路径>         Markdown/TXT 文章文件（与 --content 二选一）
  --cover <路径>            封面图片路径
  --image <路径>            正文图片（可多次）
  --tags <标签>             逗号或空格分隔标签
  --category <分区>         分区/分类
  --summary <摘要>          文章摘要（最多 120 字）
  --video <路径>            视频文件（--type video 时必填）
  --mode <模式>             assisted（人工确认，默认）或 auto-publish（自动点击发布按钮）
  --extension-id <id>      指定 MultiPost 扩展 ID（默认 Chrome 商店 ID）

${multipostHelpLines().join('\n')}

示例:
  cli publish-multipost -p 知乎 -p ARTICLE_CSDN -t "标题" --content "正文" --mode assisted
  cli publish-multipost -p 知乎 -p 简书 -t "标题" -f ./article.md --cover ./cover.jpg
  cli publish-multipost -p 抖音 -p 哔哩哔哩 --type video --title "标题" --video ./v.mp4 --mode auto-publish
  cli publish-multipost -p 微博 -p DYNAMIC_X --type dynamic --title "T" --content "内容"
`.trim();
}

const BRIDGE_PORT = MULTIPOST_BRIDGE_PORT;

export function parsePublishMultipostArgs(subArgv) {
  const args = Array.isArray(subArgv) ? subArgv : [];
  if (args.includes("--help") || args.includes("-h")) {
    return { ok: true, value: { help: true } };
  }

  const out = {
    platforms: [],
    contentType: "ARTICLE",
    title: null,
    content: "",
    file: null,
    cover: "",
    images: [],
    tags: "",
    category: "",
    summary: "",
    video: "",
    mode: "assisted",
    extensionId: null,
    timeoutMs: MULTIPOST_DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--platform" || a === "-p") {
      const read = readOptionValue(args, i, "--platform");
      if (!read.ok) return { ok: false, error: read.error };
      read.value.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean).forEach(p => out.platforms.push(p));
      i = read.nextIndex;
    } else if (a === "--type") {
      const read = readOptionValue(args, i, "--type");
      if (!read.ok) return { ok: false, error: read.error };
      const ct = normalizeMultipostContentType(read.value);
      if (!ct) return { ok: false, error: `未知内容类型: ${read.value}` };
      out.contentType = ct;
      i = read.nextIndex;
    } else if (a === "--title" || a === "-t") {
      const read = readOptionValue(args, i, "--title");
      if (!read.ok) return { ok: false, error: read.error };
      out.title = read.value;
      i = read.nextIndex;
    } else if (a === "--content") {
      const read = readOptionValue(args, i, "--content");
      if (!read.ok) return { ok: false, error: read.error };
      out.content = read.value;
      i = read.nextIndex;
    } else if (a === "--file" || a === "-f") {
      const read = readOptionValue(args, i, "--file");
      if (!read.ok) return { ok: false, error: read.error };
      out.file = read.value;
      i = read.nextIndex;
    } else if (a === "--cover") {
      const read = readOptionValue(args, i, "--cover");
      if (!read.ok) return { ok: false, error: read.error };
      out.cover = read.value;
      i = read.nextIndex;
    } else if (a === "--image") {
      const read = readOptionValue(args, i, "--image");
      if (!read.ok) return { ok: false, error: read.error };
      out.images.push(read.value);
      i = read.nextIndex;
    } else if (a === "--tags") {
      const read = readOptionValue(args, i, "--tags");
      if (!read.ok) return { ok: false, error: read.error };
      out.tags = read.value;
      i = read.nextIndex;
    } else if (a === "--category") {
      const read = readOptionValue(args, i, "--category");
      if (!read.ok) return { ok: false, error: read.error };
      out.category = read.value;
      i = read.nextIndex;
    } else if (a === "--summary") {
      const read = readOptionValue(args, i, "--summary");
      if (!read.ok) return { ok: false, error: read.error };
      out.summary = read.value;
      i = read.nextIndex;
    } else if (a === "--video") {
      const read = readOptionValue(args, i, "--video");
      if (!read.ok) return { ok: false, error: read.error };
      out.video = read.value;
      i = read.nextIndex;
    } else if (a === "--mode") {
      const read = readOptionValue(args, i, "--mode");
      if (!read.ok) return { ok: false, error: read.error };
      const m = read.value.toLowerCase();
      if (!["assisted", "manual-confirm", "auto-publish", "automatic", "auto"].includes(m)) {
        return { ok: false, error: `未知发布模式: ${read.value}（支持 assisted / auto-publish）` };
      }
      out.mode = m;
      i = read.nextIndex;
    } else if (a === "--extension-id") {
      const read = readOptionValue(args, i, "--extension-id");
      if (!read.ok) return { ok: false, error: read.error };
      out.extensionId = read.value;
      i = read.nextIndex;
    } else if (a === "--timeout-ms") {
      const read = readOptionValue(args, i, "--timeout-ms");
      if (!read.ok) return { ok: false, error: read.error };
      const ms = parseInt(read.value, 10);
      if (!ms || ms < 5000) return { ok: false, error: "--timeout-ms 最小 5000" };
      out.timeoutMs = ms;
      i = read.nextIndex;
    }
  }

  // 必填校验
  if (!out.platforms.length) return { ok: false, error: "缺少发布平台（--platform）" };
  if (!out.title) return { ok: false, error: "缺少标题（--title）" };

  if (out.contentType === "VIDEO" && !out.video) {
    return { ok: false, error: "视频发布缺少视频文件（--video）" };
  }
  if (out.contentType === "ARTICLE" && !out.content && !out.file) {
    return { ok: false, error: "图文发布缺少正文（--content 或 --file）" };
  }
  if (out.contentType === "DYNAMIC" && !out.content) {
    return { ok: false, error: "动态发布缺少正文（--content）" };
  }

  // 解析平台
  const resolvedPlatforms = [];
  for (const p of out.platforms) {
    const r = resolveMultipostPlatform(p, out.contentType);
    if (!r) return { ok: false, error: `${out.contentType} 类型不支持平台: ${p}` };
    resolvedPlatforms.push(r);
  }

  return {
    ok: true,
    value: {
      platforms: resolvedPlatforms,
      contentType: out.contentType,
      autoPublish: isMultipostAutoPublish(out.mode),
      mode: out.mode,
      title: out.title,
      markdownContent: out.content,
      file: out.file,
      coverPath: out.cover,
      imagePaths: out.images,
      tags: out.tags,
      category: out.category,
      summary: out.summary,
      videoPath: out.video,
      extensionId: out.extensionId,
      timeoutMs: out.timeoutMs,
    },
  };
}
