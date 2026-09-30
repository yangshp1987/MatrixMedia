import {
  ARTICLE_PUBLISH_MODE,
  ASSISTED_ARTICLE_PLATFORMS,
} from "../../shared/articlePublish.js";

export const ARTICLE_ACCOUNT_PLATFORMS = ASSISTED_ARTICLE_PLATFORMS;

export function isArticleAccount(meta) {
  return !!meta && ARTICLE_ACCOUNT_PLATFORMS.includes(String(meta.pt || "").trim());
}

export function applyArticleModeSafety(mode, state = {}) {
  if (mode === ARTICLE_PUBLISH_MODE.ASSISTED) {
    return { ...state, show: true, closeWindowAfterPublish: false };
  }
  return state;
}
