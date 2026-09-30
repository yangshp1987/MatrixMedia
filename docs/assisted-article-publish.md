# 人工确认文章发布设计

## 安全不变量

- `assisted` 与 `manual-confirm` 归一为同一模式。
- 主进程和渲染进程都强制 `show=true`、`closeWindowAfterPublish=false`。
- 适配器只填写内容和上传图片，不查找、不点击最终发送按钮。
- 准备完成回执是 `ready_for_manual_send`，不是 `success`；用户关闭窗口则为 `skipped`。
- 不处理验证码，不伪造验证结果，不规避风控或平台限制。

## 架构

`src/main/services/upLoad/assistedArticle.js` 提供通用适配器；知乎、微信公众号、X/Twitter 和掘金人工模式只提供编辑器 selector/正文组合规则。CLI、HTTP、MCP 都进入相同的 `puppeteerFile` 队列。GUI 账号树仅显示文章平台账号。

## 真机验证清单

平台页面会动态改版，合并前仍需在真实账号逐项确认：

- 知乎：标题 `textarea.WriteIndex-titleInput`，正文 Draft.js `contenteditable`，图片 file input。
- 微信公众号：标题 `#title`，正文编辑 iframe 中 `body.view[contenteditable=true]`，封面/正文图片 input；创建页 URL 可能附加动态 token。
- X/Twitter：正文 `[data-testid=tweetTextarea_0]`，图片 `[data-testid=fileInput]`；长文账号与普通 Post 字数/编辑器能力不同。
- 掘金人工模式：CodeMirror textarea 与封面 input。

验证重点是“字段已填入但最终按钮未触发”。页面出现验证码、二次验证或权限提示时必须交由用户处理。
