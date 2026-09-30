"use strict";

export function isPlatformLoginUrl(platform, currentUrl) {
  const pt = String(platform || "");
  const rawUrl = String(currentUrl || "");
  if (pt === "知乎") return /zhihu\.com\/(signin|login)/.test(rawUrl);
  if (pt === "微信公众号") return /mp\.weixin\.qq\.com\/.*(login|scanlogin)/.test(rawUrl);
  if (pt === "X/Twitter") return /x\.com\/(i\/flow\/login|login)/.test(rawUrl);
  if (pt !== "视频号") return false;
  try {
    const url = new URL(rawUrl);
    return (
      url.origin === "https://channels.weixin.qq.com" &&
      (url.pathname === "/login.html" || url.pathname.startsWith("/login/"))
    );
  } catch (_) {
    return rawUrl.startsWith("https://channels.weixin.qq.com/login");
  }
}
