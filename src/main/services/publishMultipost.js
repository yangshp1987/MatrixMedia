"use strict";

/**
 * MatrixMedia → MultiPost Extension 发布服务
 * 供 HTTP /publish-multipost 和 CLI publish-multipost 调用。
 */

import path from "path";
import fs from "fs";
import {
  normalizeMultipostContentType,
  buildMultipostSyncData,
  resolveMultipostPlatform,
  isMultipostAutoPublish,
  MULTIPOST_BRIDGE_PORT,
  MULTIPOST_DEFAULT_TIMEOUT_MS,
  MULTIPOST_PUBLISH_STATUS,
  MULTIPOST_CONTENT_TYPES,
} from "../../shared/multipost.js";
import { multipostBridge } from "./multipostBridge.js";

export const MULTIPOST_CLI_TIMEOUT_MS = MULTIPOST_DEFAULT_TIMEOUT_MS;

export function parseMultipostPublishRequest(body) {
  const out = body || {};

  // 平台列表
  let rawPlatforms = out.platforms || out.platform;
  let platforms = [];
  if (Array.isArray(rawPlatforms)) {
    platforms = rawPlatforms.map(String).filter(Boolean);
  } else if (rawPlatforms) {
    platforms = String(rawPlatforms).split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  }

  // 内容类型
  const contentType = normalizeMultipostContentType(out.contentType || out.content_type || "ARTICLE");
  if (!contentType) {
    return { ok: false, error: `未知内容类型: ${out.contentType || "（未指定）"}` };
  }

  // 解析为 MultiPost 平台标识
  const resolvedPlatforms = [];
  for (const p of platforms) {
    const resolved = resolveMultipostPlatform(p, contentType);
    if (!resolved) return { ok: false, error: `${contentType} 类型不支持平台: ${p}` };
    resolvedPlatforms.push(resolved);
  }
  if (!resolvedPlatforms.length) {
    return { ok: false, error: "缺少发布平台（platforms / platform）" };
  }

  const mode = String(out.mode || "assisted").toLowerCase();
  const autoPublish = isMultipostAutoPublish(mode);

  const title = String(out.title || "").trim();
  if (!title) return { ok: false, error: "缺少标题（title）" };

  // 内容字段
  const markdownContent = String(out.markdownContent || out.content || "");
  const htmlContent = String(out.htmlContent || "");
  if (contentType === "ARTICLE" && !markdownContent && !htmlContent && !out.file) {
    return { ok: false, error: "图文发布缺少正文（markdownContent / content / file）" };
  }

  const coverPath = String(out.cover || out.coverPath || "");
  const imagePaths = Array.isArray(out.images) ? out.images.map(String).filter(Boolean) :
    (out.images ? String(out.images).split(/[,，]/).map(s=>s.trim()).filter(Boolean) : []);

  const summary = String(out.summary || "").slice(0, 120);
  const tags = out.tags ? String(out.tags) : "";
  const category = out.category ? String(out.category) : "";
  const digest = String(out.digest || summary);
  const original = out.original === true || out.original === "true";
  const allowComment = out.allowComment !== false && out.allowComment !== "false";

  // 文章文件
  let fileContent = "";
  if (out.file || out.articleFilePath) {
    const filePath = path.resolve(String(out.file || out.articleFilePath));
    if (!fs.existsSync(filePath)) return { ok: false, error: `文章文件不存在: ${filePath}` };
    const ext = path.extname(filePath).toLowerCase();
    if (![".md", ".txt"].includes(ext)) return { ok: false, error: "文章文件仅支持 .md 或 .txt" };
    fileContent = fs.readFileSync(filePath, "utf8").trim();
    const lines = fileContent.split("\n");
    if (/^#\s+.+/.test(lines[0])) {
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
      fileContent = lines.join("\n");
    }
    if (!fileContent) return { ok: false, error: "文章文件正文为空" };
  }

  const finalMarkdown = fileContent || markdownContent;

  // 视频字段
  const videoPath = String(out.videoPath || out.video || "");
  if (contentType === "VIDEO" && !videoPath) {
    return { ok: false, error: "视频发布缺少视频文件（videoPath / video）" };
  }

  // 动态内容
  const dynamicContent = String(out.dynamicContent || out.content || "");
  if (contentType === "DYNAMIC" && !dynamicContent && !markdownContent) {
    return { ok: false, error: "动态发布缺少正文（content / markdownContent）" };
  }

  const extensionId = out.extensionId ? String(out.extensionId) : null;
  const timeoutMs = out.timeoutMs ? Number(out.timeoutMs) : MULTIPOST_CLI_TIMEOUT_MS;

  return {
    ok: true,
    value: {
      platforms: resolvedPlatforms,
      contentType,
      autoPublish,
      mode,
      title,
      markdownContent: finalMarkdown,
      htmlContent,
      coverPath,
      imagePaths,
      summary,
      tags,
      category,
      digest,
      original,
      allowComment,
      videoPath,
      dynamicContent,
      extensionId,
      timeoutMs,
    },
  };
}

export async function runMultipostPublish(v) {
  // 确保 bridge 已启动
  await multipostBridge.start();

  // 构建 SyncData
  let syncData;
  try {
    const articlePayload = {
      title: v.title,
      markdownContent: v.markdownContent,
      htmlContent: v.htmlContent,
      coverPath: v.coverPath,
      imagePaths: v.imagePaths,
      summary: v.summary,
      tags: v.tags,
      category: v.category,
      digest: v.digest,
      original: v.original,
      allowComment: v.allowComment,
      content: v.contentType === "DYNAMIC" ? (v.dynamicContent || v.markdownContent) : v.markdownContent,
    };
    const videoPayload = {
      title: v.title,
      videoPath: v.videoPath,
      videoName: path.basename(v.videoPath || ""),
      description: v.markdownContent,
      coverPath: v.coverPath,
      tags: v.tags,
      category: v.category,
    };
    syncData = buildMultipostSyncData({
      platforms: v.platforms,
      contentType: v.contentType,
      autoPublish: v.autoPublish,
      article: articlePayload,
      video: videoPayload,
      origin: multipostBridge.origin,
      token: multipostBridge.assetToken,
    });
  } catch (err) {
    return {
      exitCode: 2,
      success: false,
      status: MULTIPOST_PUBLISH_STATUS.FAILED,
      message: `构建发布参数失败: ${err.message}`,
    };
  }

  // 发布
  const result = await multipostBridge.publish(syncData, {
    timeoutMs: v.timeoutMs,
    extensionId: v.extensionId,
  });

  if (!result.ok) {
    return {
      exitCode: 3,
      success: false,
      status: MULTIPOST_PUBLISH_STATUS.FAILED,
      message: result.error || "MultiPost 发布失败",
    };
  }

  const tabCount = Array.isArray(result.tabs) ? result.tabs.length : 0;
  const statusMsg = v.autoPublish
    ? `MultiPost 自动发布已提交，${tabCount} 个平台标签页已打开`
    : `MultiPost 内容已填写，${tabCount} 个平台窗口已就绪，请手动点击各平台的发布按钮`;

  return {
    exitCode: 0,
    success: true,
    status: v.autoPublish ? MULTIPOST_PUBLISH_STATUS.SUBMITTED : MULTIPOST_PUBLISH_STATUS.MANUAL_READY,
    message: statusMsg,
    tabs: result.tabs || [],
    platforms: v.platforms,
    autoPublish: v.autoPublish,
  };
}
