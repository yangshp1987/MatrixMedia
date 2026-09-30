"use strict";

import path from "path";
import ptConfig from "../config/ptConfig.js";
import { runPuppeteerTask } from "./puppeteerFile.js";
import { CLI_PUBLISH_TIMEOUT_MS } from "./upLoad/uploadTimeouts.js";

export function createArticleTask(v) {
  const cfg = ptConfig[v.platform];
  if (!cfg) throw new Error(`未找到平台配置: ${v.platform}`);
  const title = String(v.title || "").trim();
  return {
    taskId: Date.now() + Math.random(),
    bookName: title,
    textOtherName: title,
    textType: "article",
    selectedFile: v.file ? path.basename(v.file) : "",
    data: {
      title,
      content: String(v.content || ""),
      articleFilePath: v.file ? path.resolve(v.file) : "",
      coverPath: v.cover ? path.resolve(v.cover) : "",
      images: (v.images || []).map(file => path.resolve(file)),
      category: v.category,
      tags: v.tags,
      summary: v.summary,
    },
    url: cfg.upload,
    show: v.show,
    mmCliSuppressWindow: v.mode !== "assisted",
    closeWindowAfterPublish: v.closeWindowAfterPublish,
    publishMode: v.mode,
    useragent: cfg.useragent,
    partition: v.partition,
    pt: v.platform,
    phone: v.phone || "",
  };
}

export function runArticlePublish(v, timeoutMs = CLI_PUBLISH_TIMEOUT_MS) {
  const task = createArticleTask(v);
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ exitCode: 1, status: "failed", message: "文章发布准备超时" }), timeoutMs);
    runPuppeteerTask(task, {
      reply(channel, payload) {
        if (channel !== "puppeteerFile-done") return;
        if (payload && payload.taskId != null && payload.taskId !== task.taskId) return;
        if (payload && (payload.status === "ready_for_manual_send" || payload.readyForManualSend === true)) {
          finish({ exitCode: 0, status: "ready_for_manual_send", readyForManualSend: true, message: payload.message, payload });
          return;
        }
        if (payload && payload.skipped) {
          finish({ exitCode: 0, status: "skipped", message: payload.message, payload });
          return;
        }
        finish({ exitCode: payload && payload.status === true ? 0 : 3, status: payload && payload.status === true ? "success" : "failed", message: payload && payload.message, payload });
      },
    });
  });
}
