"use strict";

/**
 * MultiPost Extension 接入契约（主进程 / CLI / MCP / 渲染进程共用）。
 *
 * 背景：MultiPost 是浏览器扩展，多平台发布通过扩展消息
 * `MULTIPOST_EXTENSION_PUBLISH_NOW` 触发，payload 为 SyncData。
 * 扩展 manifest 的 externally_connectable 只放行
 * `https://paiban.md/*` 与 `http://localhost:2663/*`，
 * 所以 MatrixMedia 不能直接调用扩展消息，必须经由本机 2663 端口上的
 * bridge 页面（见 src/main/services/multipostBridge.js）转发。
 *
 * 语义对齐：MultiPost 的 `isAutoPublish` 与 MatrixMedia 的 `publishMode` 一一对应——
 *   assisted（人工确认） → isAutoPublish: false（只填内容，停在发送前）
 *   publish（自动发布）  → isAutoPublish: true
 */

export const MULTIPOST_BRIDGE_PORT = 2663;
export const MULTIPOST_BRIDGE_ORIGIN = `http://localhost:${MULTIPOST_BRIDGE_PORT}`;

/** 扩展默认 ID（Chrome 商店 / Edge 商店），可用 --extension-id 覆盖 */
export const MULTIPOST_DEFAULT_EXTENSION_ID = "dhohkaclnjgcikfoaacfgijgjgceofih";
export const MULTIPOST_EDGE_EXTENSION_ID = "ckoiphiceimehjkolnfffgbmihoppgjg";
export const MULTIPOST_KNOWN_EXTENSION_IDS = [
  MULTIPOST_DEFAULT_EXTENSION_ID,
  MULTIPOST_EDGE_EXTENSION_ID,
];

/** MultiPost 扩展消息 action */
export const MULTIPOST_EXTENSION_ACTIONS = {
  CHECK_STATUS: "MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS",
  PLATFORMS: "MULTIPOST_EXTENSION_PLATFORMS",
  PUBLISH: "MULTIPOST_EXTENSION_PUBLISH",
  PUBLISH_NOW: "MULTIPOST_EXTENSION_PUBLISH_NOW",
  GET_ACCOUNT_INFOS: "MULTIPOST_EXTENSION_GET_ACCOUNT_INFOS",
};

export const MULTIPOST_CONTENT_TYPES = ["ARTICLE", "VIDEO", "DYNAMIC", "PODCAST"];

export const MULTIPOST_CONTENT_TYPE_LABELS = {
  ARTICLE: "图文",
  VIDEO: "视频",
  DYNAMIC: "动态",
  PODCAST: "播客",
};

/** MatrixMedia 平台名 → MultiPost infoMap 平台标识（按内容类型） */
export const MULTIPOST_PLATFORM_MAP = {
  抖音: { VIDEO: "VIDEO_DOUYIN", DYNAMIC: "DYNAMIC_DOUYIN" },
  视频号: { VIDEO: "VIDEO_WEIXINCHANNEL", DYNAMIC: "DYNAMIC_WEIXINCHANNEL" },
  哔哩哔哩: {
    VIDEO: "VIDEO_BILIBILI",
    ARTICLE: "ARTICLE_BILIBILI",
    DYNAMIC: "DYNAMIC_BILIBILI",
  },
  百家号: {
    VIDEO: "VIDEO_BAIJIAHAO",
    ARTICLE: "ARTICLE_BAIJIAHAO",
    DYNAMIC: "DYNAMIC_BAIJIAHAO",
  },
  头条: {
    VIDEO: "VIDEO_TOUTIAOHAO",
    ARTICLE: "ARTICLE_TOUTIAO",
    DYNAMIC: "DYNAMIC_TOUTIAOHAO",
  },
  快手: { VIDEO: "VIDEO_KUAISHOU", DYNAMIC: "DYNAMIC_KUAISHOU" },
  小红书: { VIDEO: "VIDEO_REDNOTE", DYNAMIC: "DYNAMIC_REDNOTE" },
  知乎: { VIDEO: "VIDEO_ZHIHU", ARTICLE: "ARTICLE_ZHIHU", DYNAMIC: "DYNAMIC_ZHIHU" },
  掘金: { ARTICLE: "ARTICLE_JUEJIN", DYNAMIC: "DYNAMIC_JUEJIN" },
  微信公众号: { ARTICLE: "ARTICLE_WEIXIN", DYNAMIC: "DYNAMIC_WEIXIN" },
  "X/Twitter": { ARTICLE: "ARTICLE_XARTICLE", DYNAMIC: "DYNAMIC_X" },
};

/**
 * MultiPost 独有（MatrixMedia 无对应适配器）的额外平台别名。
 * 用户可直接用这些名字或 MultiPost 原始平台标识作为 --platform 参数。
 */
export const MULTIPOST_EXTRA_PLATFORM_ALIASES = {
  csdn: "ARTICLE_CSDN",
  博客园: "ARTICLE_CNBLOGS",
  cnblogs: "ARTICLE_CNBLOGS",
  简书: "ARTICLE_JIANSHU",
  jianshu: "ARTICLE_JIANSHU",
  segmentfault: "ARTICLE_SEGMENTFAULT",
  思否: "ARTICLE_SEGMENTFAULT",
  medium: "ARTICLE_MEDIUM",
  substack: "ARTICLE_SUBSTACK",
  wordpress: "ARTICLE_WORDPRESS",
  微博: "ARTICLE_WEIBO",
  weibo: "ARTICLE_WEIBO",
  雪球: "ARTICLE_XUEQIU",
  xueqiu: "ARTICLE_XUEQIU",
  豆瓣: "ARTICLE_DOUBAN",
  douban: "ARTICLE_DOUBAN",
  infoq: "ARTICLE_INFOQ",
  oschina: "ARTICLE_OSCHINA",
  开源中国: "ARTICLE_OSCHINA",
  "51cto": "ARTICLE_51CTO",
  腾讯云: "ARTICLE_TENCENTYUN",
  cloudtencent: "ARTICLE_TENCENTYUN",
  阿里云: "ARTICLE_ALIYUN",
  aliyun: "ARTICLE_ALIYUN",
  火山引擎: "ARTICLE_VOLCENGINE",
  volcengine: "ARTICLE_VOLCENGINE",
  什么值得买: "ARTICLE_SMZDM",
  smzdm: "ARTICLE_SMZDM",
  人人都是产品经理: "ARTICLE_WOSHIPM",
  woshipm: "ARTICLE_WOSHIPM",
  格隆汇: "ARTICLE_GELONGHUI",
  网易: "ARTICLE_NETEASE",
  netease: "ARTICLE_NETEASE",
  搜狐: "ARTICLE_SOHU",
  sohu: "ARTICLE_SOHU",
  大鱼号: "ARTICLE_DAYUHAO",
  一点资讯: "ARTICLE_YIDIANZIXUN",
  知识星球: "ARTICLE_ZSXQ",
  zsxq: "ARTICLE_ZSXQ",
  汽车之家: "ARTICLE_AUTOHOME",
  懂车帝: "ARTICLE_DONGCHEDI",
  同花顺: "ARTICLE_TONGHUASHUN",
  东方财富: "ARTICLE_EASTMONEY",
  x文章: "ARTICLE_XARTICLE",
  xarticle: "ARTICLE_XARTICLE",
  // 动态
  instagram: "DYNAMIC_INSTAGRAM",
  facebook: "DYNAMIC_FACEBOOK",
  linkedin: "DYNAMIC_LINKEDIN",
  reddit: "DYNAMIC_REDDIT",
  pinterest: "DYNAMIC_PINTEREST",
  threads: "DYNAMIC_THREADS",
  bluesky: "DYNAMIC_BLUESKY",
  v2ex: "DYNAMIC_V2EX",
  即刻: "DYNAMIC_OKJIKE",
  okjike: "DYNAMIC_OKJIKE",
  脉脉: "DYNAMIC_MAIMAI",
  maimai: "DYNAMIC_MAIMAI",
  得到: "DYNAMIC_DEDAO",
  dedao: "DYNAMIC_DEDAO",
  小黑盒: "DYNAMIC_XIAOHEIHE",
};

export const MULTIPOST_PUBLISH_STATUS = {
  SUBMITTED: "submitted",
  MANUAL_READY: "ready_for_manual_send",
  FAILED: "failed",
};

export const MULTIPOST_DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

function text(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

/** 归一化内容类型：接受 article/video/dynamic/podcast 或大写形式 */
export function normalizeMultipostContentType(raw) {
  const value = text(raw).toUpperCase();
  if (MULTIPOST_CONTENT_TYPES.includes(value)) return value;
  const short = {
    A: "ARTICLE",
    图文: "ARTICLE",
    文章: "ARTICLE",
    V: "VIDEO",
    视频: "VIDEO",
    D: "DYNAMIC",
    动态: "DYNAMIC",
    短内容: "DYNAMIC",
    P: "PODCAST",
    播客: "PODCAST",
  };
  return short[value] || short[text(raw)] || "";
}

/**
 * 解析平台参数为 MultiPost 平台标识。
 * 支持：MatrixMedia 中文平台名、MultiPost 原始标识（ARTICLE_XXX）、额外别名。
 */
export function resolveMultipostPlatform(platform, contentType) {
  const raw = text(platform);
  if (!raw) return "";
  const type = normalizeMultipostContentType(contentType) || "ARTICLE";
  const mapped = MULTIPOST_PLATFORM_MAP[raw];
  if (mapped && mapped[type]) return mapped[type];
  const upper = raw.toUpperCase();
  if (/^(ARTICLE|VIDEO|DYNAMIC|PODCAST)_[A-Z0-9_]+$/.test(upper)) return upper;
  return MULTIPOST_EXTRA_PLATFORM_ALIASES[raw.toLowerCase()] || "";
}

/** 某内容类型下，MatrixMedia 原生平台里 MultiPost 支持哪些 */
export function getMultipostPlatforms(contentType) {
  const type = normalizeMultipostContentType(contentType) || "ARTICLE";
  return Object.keys(MULTIPOST_PLATFORM_MAP)
    .filter((name) => Boolean(MULTIPOST_PLATFORM_MAP[name][type]))
    .map((name) => ({ platform: name, multipostName: MULTIPOST_PLATFORM_MAP[name][type] }));
}

/** 某内容类型下，MultiPost 独有（无 MatrixMedia 适配器）的平台别名清单 */
export function getMultipostExtraPlatforms(contentType) {
  const type = normalizeMultipostContentType(contentType) || "ARTICLE";
  const prefix = `${type}_`;
  const seen = new Set();
  const list = [];
  for (const [alias, name] of Object.entries(MULTIPOST_EXTRA_PLATFORM_ALIASES)) {
    if (!name.startsWith(prefix) || seen.has(name)) continue;
    seen.add(name);
    list.push({ alias, multipostName: name });
  }
  return list;
}

export function isMultipostSupported(platform, contentType) {
  return Boolean(resolveMultipostPlatform(platform, contentType));
}

/** assisted → isAutoPublish:false；publish → true */
export function isMultipostAutoPublish(mode) {
  return text(mode).toLowerCase() !== "assisted";
}

export function parseMultipostPlatformList(raw) {
  if (Array.isArray(raw)) return raw.map(text).filter(Boolean);
  return text(raw)
    .split(/[,，\s]+/)
    .map(text)
    .filter(Boolean);
}

/** 极简 Markdown → HTML，够 MultiPost 的图文编辑器使用即可，不引入额外依赖 */
export function markdownToSimpleHtml(markdown) {
  const source = String(markdown || "");
  if (!source.trim()) return "";
  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const inline = (value) =>
    escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const out = [];
  let listBuffer = [];
  let codeBuffer = [];
  let inCode = false;
  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(`<ul>${listBuffer.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    listBuffer = [];
  };
  const flushCode = () => {
    if (!codeBuffer.length) return;
    out.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    codeBuffer = [];
  };

  for (const line of source.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      listBuffer.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushCode();
  return out.join("\n");
}

/** 把本地文件路径转成 bridge 可访问的 HTTP URL（bridge 只读白名单目录） */
export function buildBridgeAssetUrl(origin, token, filePath) {
  const base = text(origin).replace(/\/$/, "") || MULTIPOST_BRIDGE_ORIGIN;
  return `${base}/asset?token=${encodeURIComponent(text(token))}&path=${encodeURIComponent(text(filePath))}`;
}

function fileData(name, url, filePath) {
  return { name: text(name), url: text(url), type: "", size: 0, path: text(filePath) };
}

/**
 * 组装 MultiPost SyncData。
 * @param {object} input
 * @param {string[]} input.platforms  MultiPost 平台标识列表
 * @param {string} input.contentType  ARTICLE / VIDEO / DYNAMIC / PODCAST
 * @param {boolean} input.autoPublish 是否自动点击最终发布按钮
 * @param {object} input.article      图文/动态字段
 * @param {object} input.video        视频字段
 * @param {string} input.origin       bridge origin
 * @param {string} input.token        bridge 资产令牌
 */
export function buildMultipostSyncData(input) {
  const options = input || {};
  const platforms = (Array.isArray(options.platforms) ? options.platforms : []).map(text).filter(Boolean);
  if (!platforms.length) throw new Error("缺少发布平台（--platform）");

  const contentType = normalizeMultipostContentType(options.contentType);
  if (!contentType) throw new Error(`未知内容类型: ${options.contentType}`);
  if (contentType === "VIDEO" && !options.video) throw new Error("视频发布缺少视频信息");
  if (contentType !== "VIDEO" && !options.article) throw new Error("图文发布缺少内容信息");

  const origin = text(options.origin) || MULTIPOST_BRIDGE_ORIGIN;
  const token = text(options.token);
  const asset = (name, absolutePath) =>
    absolutePath ? buildBridgeAssetUrl(origin, token, absolutePath) : "";

  let data;
  let origin_ = undefined;
  if (contentType === "VIDEO") {
    const video = options.video;
    const videoPath = text(video.videoPath);
    if (!videoPath) throw new Error("视频发布缺少视频文件");
    data = {
      title: text(video.title),
      content: text(video.content || video.description),
      video: videoPath ? fileData(video.videoName || "", asset("", videoPath), videoPath) : undefined,
      cover: video.coverPath ? fileData("", asset("", video.coverPath), video.coverPath) : undefined,
      verticalCover: video.verticalCoverPath
        ? fileData("", asset("", video.verticalCoverPath), video.verticalCoverPath)
        : undefined,
      horizontalCover: video.horizontalCoverPath
        ? fileData("", asset("", video.horizontalCoverPath), video.horizontalCoverPath)
        : undefined,
      tags: parseMultipostPlatformList(video.tags),
      category: video.category,
      original: video.original === true,
      collectionId: video.collectionId,
      description: text(video.description),
    };
  } else if (contentType === "ARTICLE") {
    const article = options.article;
    const markdown = String(article.markdownContent || article.content || "");
    const html = String(article.htmlContent || markdownToSimpleHtml(markdown));
    const cover = text(article.coverPath);
    data = {
      title: text(article.title),
      digest: text(article.digest || article.summary).slice(0, 120),
      cover: cover ? fileData("", asset("", cover), cover) : undefined,
      htmlContent: html,
      markdownContent: markdown,
      images: (article.imagePaths || []).map((p) => fileData("", asset("", p), p)),
      tags: parseMultipostPlatformList(article.tags),
      category: article.category,
      original: article.original === true,
      allowComment: article.allowComment !== false,
      scheduledPublishTime: article.scheduledPublishTime,
    };
  } else if (contentType === "DYNAMIC") {
    const dynamic = options.article || options.dynamic || {};
    data = {
      title: text(dynamic.title),
      content: String(dynamic.content || dynamic.markdownContent || ""),
      images: (dynamic.imagePaths || []).map((p) => fileData("", asset("", p), p)),
      videos: (dynamic.videoPaths || []).map((p) => fileData("", asset("", p), p)),
      tags: parseMultipostPlatformList(dynamic.tags),
      scheduledPublishTime: dynamic.scheduledPublishTime,
    };
  } else {
    throw new Error(`暂不支持通过 MultiPost 发布${MULTIPOST_CONTENT_TYPE_LABELS[contentType] || contentType}`);
  }

  return {
    platforms: platforms.map((name) => ({ name })),
    isAutoPublish: options.autoPublish === true,
    data,
    ...(origin_ ? { origin: origin_ } : {}),
  };
}

export function multipostHelpLines() {
  return [
    `图文可用平台: ${getMultipostPlatforms("ARTICLE").map((i) => i.platform).join(" / ")}`,
    `视频可用平台: ${getMultipostPlatforms("VIDEO").map((i) => i.platform).join(" / ")}`,
    `动态可用平台: ${getMultipostPlatforms("DYNAMIC").map((i) => i.platform).join(" / ")}`,
    `MultiPost 独有平台: ${Object.keys(MULTIPOST_EXTRA_PLATFORM_ALIASES).slice(0, 12).join(" / ")} ...`,
  ];
}
