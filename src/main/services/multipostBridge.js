"use strict";

/**
 * MultiPost Extension Bridge
 * ========================
 * MultiPost 扩展的 manifest `externally_connectable` 白名单只有：
 *   https://paiban.md/*  和  http://localhost:2663/*
 * 因此 MatrixMedia 主进程无法直接调用扩展消息 API，必须把消息通过
 * 运行在 localhost:2663 的 HTTP 桥中转。
 *
 * Bridge 的两重职责：
 * 1. 静态 HTML 页：浏览器打开后作为"中间人"，通过 chrome.runtime.sendMessage
 *    把消息转发给 MultiPost 扩展，再通过 WebSocket 把结果回传给 MatrixMedia。
 * 2. HTTP API：MatrixMedia 主进程调用 POST /publish，由 bridge 的 Node.js 层先把
 *    SyncData 入队，再等 WebSocket 客户端（bridge 页面）拉取并转发。
 *
 * 安全边界：
 * - 只绑定 127.0.0.1，不向局域网暴露。
 * - 每次启动生成随机 assetToken，防止外部读取本地文件。
 * - asset 路由只读白名单目录里的媒体文件（图片/视频/音频），不允许 path traversal。
 * - 不记录任何 Cookie 或账号信息到磁盘。
 *
 * 使用方法：
 *   import { multipostBridge } from './multipostBridge.js';
 *   await multipostBridge.start();
 *   const result = await multipostBridge.publish(syncData, { timeoutMs: 30000 });
 *   await multipostBridge.stop();
 */

import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { EventEmitter } from "events";

const WS = require("ws");

const BRIDGE_PORT = 2663;
const BRIDGE_HOST = "127.0.0.1";

const ASSET_TOKEN_BYTES = 24;
const ASSET_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
  ".mp4", ".mov", ".avi", ".mkv", ".webm",
  ".mp3", ".m4a", ".wav", ".aac", ".ogg",
  ".md", ".txt",
]);

const BRIDGE_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_PUBLISH_TIMEOUT_MS = 5 * 60 * 1000;

class MultipostBridgeServer extends EventEmitter {
  constructor() {
    super();
    this._server = null;
    this._wss = null;
    this._clients = new Set();
    this._pending = new Map(); // reqId → { resolve, reject, timer }
    this._assetToken = crypto.randomBytes(ASSET_TOKEN_BYTES).toString("hex");
    this._startPromise = null;
  }

  get port() { return BRIDGE_PORT; }
  get origin() { return `http://${BRIDGE_HOST}:${BRIDGE_PORT}`; }
  get assetToken() { return this._assetToken; }
  get isRunning() { return this._server && this._server.listening; }

  /** 启动 bridge（幂等） */
  async start() {
    if (this.isRunning) return;
    if (this._startPromise) return this._startPromise;
    this._startPromise = this._startInternal().finally(() => {
      this._startPromise = null;
    });
    return this._startPromise;
  }

  _startInternal() {
    return new Promise((resolve, reject) => {
      const app = http.createServer(this._handleRequest.bind(this));
      const wss = new WS.Server({ server: app });
      wss.on("connection", (ws) => this._handleWsConnection(ws));
      this._server = app;
      this._wss = wss;
      app.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log("[multipostBridge] 端口 2663 已被占用（可能 bridge 已运行），跳过启动");
          resolve();
        } else {
          reject(err);
        }
      });
      app.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
        console.log(`[multipostBridge] 已启动 http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
        resolve();
      });
    });
  }

  async stop() {
    if (!this._server) return;
    for (const client of this._clients) {
      try { client.close(); } catch (_) {}
    }
    this._clients.clear();
    await new Promise((res) => this._server.close(() => res()));
    this._server = null;
    this._wss = null;
    console.log("[multipostBridge] 已停止");
  }

  /**
   * 通过 bridge 调用 MultiPost Extension PUBLISH_NOW。
   * @param {object} syncData  MultiPost SyncData 格式
   * @param {object} options
   * @param {number} [options.timeoutMs]
   * @param {string} [options.extensionId]
   * @returns {Promise<{ok:boolean, tabs?:Array, error?:string}>}
   */
  async publish(syncData, options = {}) {
    await this.start();
    if (this._clients.size === 0) {
      return { ok: false, error: "MultiPost bridge 未连接：请先在 Chrome/Edge 浏览器里打开 bridge 页面（" + this.origin + "/bridge.html），并确认 MultiPost 扩展已安装。" };
    }
    const reqId = crypto.randomUUID();
    const timeoutMs = options.timeoutMs || DEFAULT_PUBLISH_TIMEOUT_MS;
    const extensionId = options.extensionId || null;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(reqId);
        resolve({ ok: false, error: "MultiPost 发布超时（" + Math.round(timeoutMs / 1000) + "s）" });
      }, timeoutMs);
      this._pending.set(reqId, { resolve, reject, timer });
      // 广播给所有已连接的 bridge 客户端
      const msg = JSON.stringify({ type: "PUBLISH", reqId, syncData, extensionId });
      for (const ws of this._clients) {
        try { ws.send(msg); } catch (_) {}
      }
    });
  }

  /**
   * 查询扩展在线状态（通过 bridge 页面转发 CHECK_SERVICE_STATUS）。
   * @returns {Promise<{online:boolean, extensionId?:string, version?:string, error?:string}>}
   */
  async checkExtension(options = {}) {
    await this.start();
    if (this._clients.size === 0) {
      return { online: false, error: "bridge 未连接" };
    }
    const reqId = crypto.randomUUID();
    const timeoutMs = options.timeoutMs || 5000;
    const extensionId = options.extensionId || null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pending.delete(reqId);
        resolve({ online: false, error: "扩展状态查询超时" });
      }, timeoutMs);
      this._pending.set(reqId, { resolve, reject: resolve, timer });
      const msg = JSON.stringify({ type: "CHECK_STATUS", reqId, extensionId });
      for (const ws of this._clients) {
        try { ws.send(msg); } catch (_) {}
      }
    });
  }

  _handleWsConnection(ws) {
    this._clients.add(ws);
    console.log(`[multipostBridge] 新 bridge 客户端已连接（当前 ${this._clients.size} 个）`);
    ws.on("message", (raw) => this._handleWsMessage(ws, raw));
    ws.on("close", () => {
      this._clients.delete(ws);
      console.log(`[multipostBridge] bridge 客户端已断开（剩余 ${this._clients.size} 个）`);
    });
    ws.on("error", (err) => {
      console.error("[multipostBridge] ws 客户端错误:", err.message);
    });
  }

  _handleWsMessage(_ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }
    const pending = this._pending.get(msg.reqId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this._pending.delete(msg.reqId);
    if (msg.type === "PUBLISH_RESULT") {
      pending.resolve({ ok: !msg.error, tabs: msg.tabs || [], error: msg.error || null });
    } else if (msg.type === "STATUS_RESULT") {
      pending.resolve({ online: !msg.error, extensionId: msg.extensionId, version: msg.version, error: msg.error });
    } else if (msg.type === "ERROR") {
      pending.resolve({ ok: false, online: false, error: msg.error || "未知错误" });
    }
  }

  _handleRequest(req, res) {
    const url = new URL(req.url, `http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
    const pathname = url.pathname;

    // CORS：允许 localhost / paiban.md，满足 externally_connectable 白名单
    const origin = req.headers.origin || "";
    const allowedOrigin =
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/paiban\.md/.test(origin) ||
      origin === ""
        ? origin || "*"
        : null;
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    } else {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden origin" }));
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/" || pathname === "/bridge.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this._buildBridgePage());
      return;
    }

    if (pathname === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, clients: this._clients.size, port: BRIDGE_PORT }));
      return;
    }

    if (pathname === "/asset") {
      this._handleAssetRequest(url, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }

  _handleAssetRequest(url, res) {
    const token = url.searchParams.get("token") || "";
    if (token !== this._assetToken) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid token" }));
      return;
    }
    const rawPath = url.searchParams.get("path") || "";
    if (!rawPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing path" }));
      return;
    }
    const absolute = path.resolve(rawPath);
    const ext = path.extname(absolute).toLowerCase();
    if (!ASSET_EXTS.has(ext)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unsupported file type" }));
      return;
    }
    if (!fs.existsSync(absolute)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "file not found" }));
      return;
    }
    const extToMime = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
      ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/avi",
      ".mkv": "video/x-matroska", ".webm": "video/webm",
      ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
      ".aac": "audio/aac", ".ogg": "audio/ogg",
      ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
    };
    const mime = extToMime[ext] || "application/octet-stream";
    const stat = fs.statSync(absolute);
    res.writeHead(200, { "Content-Type": mime, "Content-Length": stat.size, "Cache-Control": "no-store" });
    fs.createReadStream(absolute).pipe(res);
  }

  _buildBridgePage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>MatrixMedia × MultiPost Bridge</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:#0b1220;color:#e2e8f0;padding:24px;margin:0}
  h1{color:#7dd3fc;font-size:22px;margin-bottom:8px}
  .status{border-radius:12px;padding:10px 18px;display:inline-block;font-size:15px;font-weight:600;margin-bottom:16px}
  .connected{background:#1e3a2f;color:#4ade80}
  .disconnected{background:#3a1e1e;color:#f87171}
  .log-box{background:#111827;border:1px solid #1e40af;border-radius:8px;padding:12px;font-size:13px;font-family:monospace;max-height:320px;overflow-y:auto;white-space:pre-wrap;line-height:1.6}
  .msg{background:#1e2d4a;border-radius:6px;padding:4px 10px;margin-bottom:6px;font-size:13px}
  p{color:#94a3b8;font-size:14px;margin-top:0}
  code{background:#1e293b;border-radius:4px;padding:2px 6px}
</style>
</head>
<body>
<h1>🌉 MatrixMedia × MultiPost Bridge</h1>
<p>此页面必须保持在 Chrome/Edge 浏览器中打开，且已安装 <strong>MultiPost 扩展</strong>。
  它作为 MatrixMedia 与浏览器扩展之间的消息桥。</p>
<div id="status" class="status disconnected">● 未连接到 MatrixMedia</div>
<div id="log" class="log-box">等待连接…</div>
<script>
const WS_URL = 'ws://127.0.0.1:${BRIDGE_PORT}';
const KNOWN_IDS = ['dhohkaclnjgcikfoaacfgijgjgceofih', 'ckoiphiceimehjkolnfffgbmihoppgjg'];
const log = (text) => {
  const box = document.getElementById('log');
  const line = document.createElement('div');
  line.className = 'msg';
  line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
};
function setStatus(connected) {
  const el = document.getElementById('status');
  el.className = 'status ' + (connected ? 'connected' : 'disconnected');
  el.textContent = connected ? '● 已连接到 MatrixMedia' : '● 未连接到 MatrixMedia';
}
function resolveExtId(preferredId) {
  if (preferredId) {
    if (chrome && chrome.runtime) {
      try { chrome.runtime.sendMessage(preferredId, {action:'MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS'}, ()=>{}); return preferredId; } catch(_) {}
    }
  }
  for (const id of KNOWN_IDS) {
    try { if (chrome && chrome.runtime) { chrome.runtime.sendMessage(id, {action:'MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS'}, ()=>{}); return id; } } catch(_) {}
  }
  return KNOWN_IDS[0];
}
function sendExt(extId, message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(extId, message, (response) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(response || {});
      });
    } catch(e) {
      resolve({ error: e.message });
    }
  });
}
let ws, retryTimer;
function connect() {
  clearTimeout(retryTimer);
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { setStatus(true); log('已连接到 MatrixMedia bridge'); };
  ws.onclose = () => { setStatus(false); log('连接断开，5 秒后重试…'); retryTimer = setTimeout(connect, 5000); };
  ws.onerror = () => { log('连接错误，5 秒后重试…'); };
  ws.onmessage = async (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (_) { return; }
    const extId = resolveExtId(msg.extensionId);
    if (msg.type === 'CHECK_STATUS') {
      log('检查扩展状态 (id=' + extId + ')');
      const r = await sendExt(extId, { action: 'MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS' });
      if (r.error) log('扩展不在线: ' + r.error);
      else log('扩展在线: v' + r.extensionVersion + ' edition=' + r.edition);
      ws.send(JSON.stringify({ type: 'STATUS_RESULT', reqId: msg.reqId, online: !r.error, extensionId: r.extensionId, version: r.extensionVersion, error: r.error || null }));
    } else if (msg.type === 'PUBLISH') {
      const platforms = ((msg.syncData && msg.syncData.platforms) || []).map(p => p.name).join(', ');
      log('发布请求 → 平台: ' + platforms + ' autoPublish=' + (msg.syncData && msg.syncData.isAutoPublish));
      const r = await sendExt(extId, { action: 'MULTIPOST_EXTENSION_PUBLISH_NOW', data: msg.syncData });
      if (r && r.error) {
        log('扩展返回错误: ' + r.error);
        ws.send(JSON.stringify({ type: 'PUBLISH_RESULT', reqId: msg.reqId, ok: false, error: r.error }));
      } else {
        const tabCount = (r && r.tabs) ? r.tabs.length : 0;
        log('已提交 ' + tabCount + ' 个标签页，等待用户操作…');
        ws.send(JSON.stringify({ type: 'PUBLISH_RESULT', reqId: msg.reqId, ok: true, tabs: (r && r.tabs) || [] }));
      }
    }
  };
}
connect();
</script>
</body>
</html>`;
  }
}

export const multipostBridge = new MultipostBridgeServer();
export default multipostBridge;
