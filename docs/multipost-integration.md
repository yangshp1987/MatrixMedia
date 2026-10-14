# MultiPost Extension 集成说明

> 本文档面向使用 MatrixMedia 的开发者/用户，介绍如何通过 MultiPost Extension 把内容发布到扩展覆盖的 30+ 个平台（CSDN、简书、掘金、微博、Medium、Substack、WordPress、Instagram、Facebook、LinkedIn、Reddit 等）。

---

## 前提条件

1. 安装 Chrome 或 Edge 浏览器；
2. 安装 MultiPost Extension：
   - Chrome：[商店链接](https://chromewebstore.google.com/detail/multipost/dhohkaclnjgcikfoaacfgijgjgceofih)
   - Edge：[商店链接](https://microsoftedge.microsoft.com/addons/detail/multipost/ckoiphiceimehjkolnfffgbmihoppgjg)
3. 在 Chrome/Edge 打开 **bridge 页面**：
   ```
   http://localhost:2663/bridge.html
   ```
   此页面必须保持打开并在后台运行，它是 MatrixMedia 与扩展之间的消息中继。
   > ⚠️ 若页面不打开，所有 MultiPost 发布任务都会立即失败并提示 "MultiPost bridge 未连接"。

---

## 工作原理

```
MatrixMedia (Electron / CLI / HTTP)
    │
    └─ POST 127.0.0.1:30088/publish-multipost
         │
         └─ MultipostBridgeServer (127.0.0.1:2663, HTTP + WebSocket)
              │  ← 只有 localhost:2663 在 MultiPost 的 externally_connectable 白名单里
              └─ bridge.html（Chrome/Edge 里打开，通过 chrome.runtime.sendMessage 调扩展）
                   │
                   └─ MultiPost Extension (MULTIPOST_EXTENSION_PUBLISH_NOW)
                        └─ 为每个目标平台打开新标签页并注入发布脚本
```

两种发布模式：
- **assisted（人工确认，默认）**：扩展打开各平台编辑页、自动填写内容，**停在发布前**，由用户检查后手动点击发布按钮。对应 MultiPost 的 `isAutoPublish: false`。
- **auto-publish**：扩展自动填写内容并点击发布按钮。对应 `isAutoPublish: true`。**高频使用可能触发平台风控，请谨慎使用。**

---

## CLI 使用

```bash
# 图文：assisted 模式（默认）
matrixmedia cli publish-multipost \
  --platform 知乎 --platform ARTICLE_CSDN --platform 简书 \
  --title "我的文章标题" \
  --file ./article.md \
  --cover ./cover.jpg \
  --tags "前端 JavaScript" \
  --summary "这篇文章介绍了…" \
  --mode assisted

# 图文：多平台扩展，直接传 MultiPost 平台标识
matrixmedia cli publish-multipost \
  --platform ARTICLE_MEDIUM --platform ARTICLE_SUBSTACK --platform ARTICLE_WORDPRESS \
  --title "My Post" --content "Hello World" --mode auto-publish

# 视频发布到哔哩哔哩 + 微博
matrixmedia cli publish-multipost \
  --type video --platform 哔哩哔哩 --platform VIDEO_WEIBO \
  --title "视频标题" --video /path/to/video.mp4 --cover /path/to/cover.png

# 动态（短内容）发布
matrixmedia cli publish-multipost \
  --type dynamic --platform DYNAMIC_X --platform DYNAMIC_WEIBO --platform DYNAMIC_LINKEDIN \
  --title "短帖" --content "内容正文 #hashtag"

# 查看全部选项
matrixmedia cli publish-multipost --help
```

---

## HTTP API

```bash
# 图文
curl -X POST http://127.0.0.1:30088/publish-multipost \
  -H "Content-Type: application/json" \
  -d '{
    "platforms": ["知乎", "ARTICLE_CSDN", "简书"],
    "contentType": "article",
    "title": "文章标题",
    "markdownContent": "# 正文\n\n内容…",
    "cover": "/absolute/path/to/cover.jpg",
    "tags": "前端 Node",
    "summary": "摘要",
    "mode": "assisted"
  }'

# 视频
curl -X POST http://127.0.0.1:30088/publish-multipost \
  -H "Content-Type: application/json" \
  -d '{
    "platforms": ["VIDEO_BILIBILI", "VIDEO_DOUYIN"],
    "contentType": "video",
    "title": "视频标题",
    "videoPath": "/absolute/path/to/video.mp4",
    "mode": "assisted"
  }'

# 查询 bridge + 扩展在线状态
curl http://127.0.0.1:30088/multipost/status
```

响应：
```json
{
  "success": true,
  "status": "ready_for_manual_send",
  "message": "MultiPost 内容已填写，3 个平台窗口已就绪，请手动点击各平台的发布按钮",
  "platforms": ["ARTICLE_ZHIHU", "ARTICLE_CSDN", "ARTICLE_JIANSHU"],
  "autoPublish": false
}
```

---

## MCP 工具

```json
{
  "tool": "publish_multipost",
  "arguments": {
    "platforms": ["知乎", "ARTICLE_CSDN", "简书"],
    "title": "文章标题",
    "content": "# 标题\n\n正文内容",
    "cover": "/path/to/cover.jpg",
    "tags": "前端 JavaScript",
    "mode": "assisted"
  }
}
```

---

## 支持平台参考

### 图文（`--type article`，默认）
MatrixMedia 原有平台（通过 MultiPost）：知乎 / 掘金 / 微信公众号 / 哔哩哔哩 / 百家号 / 头条

MultiPost 独有平台（直接传标识或别名）：
| 别名 | MultiPost 标识 |
|------|---------------|
| csdn | ARTICLE_CSDN |
| 博客园 | ARTICLE_CNBLOGS |
| 简书 | ARTICLE_JIANSHU |
| segmentfault / 思否 | ARTICLE_SEGMENTFAULT |
| medium | ARTICLE_MEDIUM |
| substack | ARTICLE_SUBSTACK |
| wordpress | ARTICLE_WORDPRESS |
| 微博 | ARTICLE_WEIBO |
| 雪球 | ARTICLE_XUEQIU |
| 豆瓣 | ARTICLE_DOUBAN |
| infoq | ARTICLE_INFOQ |
| oschina / 开源中国 | ARTICLE_OSCHINA |
| 腾讯云 | ARTICLE_TENCENTYUN |
| 阿里云 | ARTICLE_ALIYUN |
| 知识星球 / zsxq | ARTICLE_ZSXQ |
| … |（完整列表见 `src/shared/multipost.js`）|

### 视频（`--type video`）
抖音 / 视频号 / 哔哩哔哩 / 百家号 / 头条 / 快手 / 小红书 / 知乎 + YouTube、TikTok、微博视频、雪球等

### 动态（`--type dynamic`）
微博 / 知乎 / 哔哩哔哩 + X/Twitter / Instagram / Facebook / LinkedIn / Reddit / Pinterest / Bluesky / Threads 等

---

## 常见问题

**Q: "MultiPost bridge 未连接" 怎么办？**
A: 在 Chrome/Edge 打开 `http://localhost:2663/bridge.html`，确认页面显示"已连接到 MatrixMedia"。

**Q: 如何确认 MultiPost 扩展在线？**
A: 调用 `GET http://127.0.0.1:30088/multipost/status`，返回 `extension.online: true` 说明扩展正常。

**Q: bridge 页面关闭了会怎样？**
A: 下一次发布请求会收到 "MultiPost bridge 未连接" 错误，重新打开 bridge 页面即可恢复。

**Q: 可以同时使用 MatrixMedia 原生发布和 MultiPost 发布吗？**
A: 可以。两套通道完全独立：`/publish` 走 Puppeteer 发布，`/publish-multipost` 走 MultiPost Extension。
