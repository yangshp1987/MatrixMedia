import fs from "fs";
import path from "path";

export const MANUAL_READY_STATUS = "ready_for_manual_send";

// 仅用于保护性静态测试和运行时断言；适配器不得点击这些最终动作。
export const FINAL_SEND_TEXT_PATTERN = /^(发布|确认发布|群发|发送|发推|post|publish|tweet)$/i;

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function readAssistedArticleContent(data) {
  const article = (data && data.data) || {};
  const direct = String(article.content || "");
  if (direct.trim()) return direct;
  const file = article.articleFilePath || data.articleFilePath;
  if (!file) throw new Error("请填写正文或选择文章文件");
  const absolute = path.resolve(file);
  if (![".md", ".txt"].includes(path.extname(absolute).toLowerCase())) {
    throw new Error("文章文件仅支持 .md 或 .txt");
  }
  let content = fs.readFileSync(absolute, "utf8");
  if (!content.trim()) throw new Error("文章正文为空");
  const lines = content.split("\n");
  if (/^#\s+.+/.test(lines[0])) {
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
    content = lines.join("\n");
  }
  return content;
}

async function findTarget(page, selectors, preferFrames = false) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const frames = page.frames ? page.frames() : [page];
    const targets = preferFrames ? [...frames.slice(1), frames[0]] : frames;
    for (const target of targets) {
      for (const selector of selectors) {
        try {
          const handle = await target.$(selector);
          if (handle) return { target, handle, selector };
        } catch (_) {}
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function fillTarget(page, selectors, value, label, options = {}) {
  const found = await findTarget(page, selectors, options.preferFrames);
  if (!found) throw new Error(`未找到${label}`);
  await found.target.evaluate((element, text) => {
    element.focus();
    const tag = String(element.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") {
      const proto = tag === "input" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(element, text);
    } else {
      element.innerText = text;
    }
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, found.handle, value);
  return found;
}

function imagePaths(data) {
  const article = (data && data.data) || {};
  const values = [];
  if (article.coverPath || data.coverPath) values.push(article.coverPath || data.coverPath);
  const more = article.images || data.images;
  if (Array.isArray(more)) values.push(...more);
  return [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))].map(v => path.resolve(v));
}

async function uploadImages(page, selectors, files, preferFrames) {
  if (!files.length || !selectors || !selectors.length) return { requested: files.length, uploaded: 0 };
  const existing = files.filter(file => fs.existsSync(file));
  if (!existing.length) return { requested: files.length, uploaded: 0 };
  const found = await findTarget(page, selectors, preferFrames);
  if (!found) return { requested: files.length, uploaded: 0 };
  await found.handle.uploadFile(...existing);
  await page.waitForTimeout(1200);
  return { requested: files.length, uploaded: existing.length };
}

export function createAssistedArticleAdapter(config) {
  return async function assistedArticleAdapter(page, data, window, event) {
    const article = data.data || {};
    const title = firstText(article.title, article.bt1, data.bt);
    if (!title) throw new Error("请填写文章标题");
    const content = readAssistedArticleContent(data);
    const body = config.composeBody ? config.composeBody({ title, content, article, data }) : content;

    if (config.titleSelectors && config.titleSelectors.length) {
      await fillTarget(page, config.titleSelectors, title, `${config.name}标题输入框`, config);
    }
    await fillTarget(page, config.bodySelectors, body, `${config.name}正文编辑器`, config);
    const images = await uploadImages(page, config.imageInputSelectors, imagePaths(data), config.preferFrames);

    // 安全边界：只填充，绝不查找或点击最终“发布/群发/发送/Post”按钮。
    data._manualPrepared = true;
    event.reply("puppeteerFile-done", {
      ...data,
      status: MANUAL_READY_STATUS,
      readyForManualSend: true,
      images,
      message: `${config.name}内容已填写，请检查后手动点击最终发送按钮`,
    });
    if (window && !window.isDestroyed()) {
      window.show();
      window.focus();
    }
  };
}
