"use strict";

export const ARTICLE_PUBLISH_MODE = {
  AUTOMATIC: "publish",
  ASSISTED: "assisted",
};

export const ARTICLE_PLATFORM_ALIASES = {
  juejin: "掘金",
  jj: "掘金",
  掘金: "掘金",
  zhihu: "知乎",
  zh: "知乎",
  知乎: "知乎",
  wechat: "微信公众号",
  weixin: "微信公众号",
  wx: "微信公众号",
  mp: "微信公众号",
  wechatmp: "微信公众号",
  微信公众号: "微信公众号",
  公众号: "微信公众号",
  x: "X/Twitter",
  twitter: "X/Twitter",
  tweet: "X/Twitter",
  "x/twitter": "X/Twitter",
  推特: "X/Twitter",
};

export const ASSISTED_ARTICLE_PLATFORMS = ["掘金", "知乎", "微信公众号", "X/Twitter"];
export const AUTOMATIC_ARTICLE_PLATFORMS = ["掘金"];

export function resolveArticlePlatform(raw) {
  const text = String(raw || "").trim();
  return ARTICLE_PLATFORM_ALIASES[text] || ARTICLE_PLATFORM_ALIASES[text.toLowerCase()] || text;
}

export function normalizeArticlePublishMode(raw) {
  const text = String(raw || "publish").trim().toLowerCase();
  if (["assisted", "manual-confirm", "manual_confirm", "manual"].includes(text)) {
    return ARTICLE_PUBLISH_MODE.ASSISTED;
  }
  if (["publish", "automatic", "auto"].includes(text)) {
    return ARTICLE_PUBLISH_MODE.AUTOMATIC;
  }
  return "";
}

export function isAssistedArticlePlatform(platform) {
  return ASSISTED_ARTICLE_PLATFORMS.includes(String(platform || ""));
}

export function isAssistedArticleTask(data) {
  return normalizeArticlePublishMode(data && data.publishMode) === ARTICLE_PUBLISH_MODE.ASSISTED;
}
