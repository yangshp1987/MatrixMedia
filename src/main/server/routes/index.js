var express = require("express");
const { changeData } = require("../utils");
const { isTrustedLocalRequest } = require("../requestGuard");

var router = express.Router();

router.get("/", function (req, res) {
  res.send("<h1>MatrixMedia API</h1>");
});

router.get("/test", function (req, res) {
  res.json({
    success: true,
    message: "ok",
  });
});

router.get("/platforms", async function (req, res) {
  try {
    const { getVideoPublishPlatformList } = await import(
      "../../../shared/publishPlatforms.js"
    );
    const ptConfig = (await import("../../config/ptConfig.js")).default;
    res.json({
      success: true,
      platforms: getVideoPublishPlatformList(ptConfig),
    });
  } catch (error) {
    console.error("[HTTP /platforms]", error);
    res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
});

router.get("/creative-statements", async function (req, res) {
  try {
    const { getCreativeStatementApiSpec } = await import(
      "../../../shared/creativeStatement.js"
    );
    res.json({
      success: true,
      ...getCreativeStatementApiSpec(),
    });
  } catch (error) {
    console.error("[HTTP /creative-statements]", error);
    res.status(500).json({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
});

router.post("/changeData", function (req, res) {
  // 信任条件见 requestGuard：命中 Origin 白名单，或携带本次启动的
  // 随机令牌（打包后 file:// 页面不发送 Origin，必须靠令牌通过）。
  // 无 Origin 也无令牌的本地脚本 / 外部网站请求一律 403。
  if (!isTrustedLocalRequest(req)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  res.json(changeData({ ...req.body }));
});

router.post("/publish-article", async function (req, res) {
  try {
    const { parsePublishArticleArgs } = await import("../../cli/parsePublishArticleArgs.js");
    const { runArticlePublish } = await import("../../services/publishArticle.js");
    const body = req.body || {};
    const argv = [];
    const add = (flag, value) => { if (value !== undefined && value !== null && String(value).length) argv.push(flag, String(value)); };
    add("--platform", body.platform);
    add("--phone", body.phone);
    add("--partition", body.partition);
    add("--title", body.title);
    add("--content", body.content);
    add("--file", body.file);
    add("--cover", body.cover);
    add("--category", body.category);
    add("--tags", body.tags);
    add("--summary", body.summary);
    add("--mode", body.mode || "assisted");
    (Array.isArray(body.images) ? body.images : []).forEach(image => add("--image", image));
    const parsed = parsePublishArticleArgs(argv);
    if (!parsed.ok) return res.status(400).json({ success: false, status: "failed", message: parsed.error });
    const result = await runArticlePublish(parsed.value);
    return res.status(result.exitCode === 2 ? 400 : 200).json({
      success: result.exitCode === 0,
      ...result,
    });
  } catch (error) {
    console.error("[HTTP /publish-article]", error);
    return res.status(500).json({ success: false, status: "failed", message: error && error.message ? error.message : String(error) });
  }
});

router.post("/publish", async function (req, res) {
  try {
    const { parseMultiPublishRequest } = await import(
      "../../cli/parsePublishArgs.js"
    );
    const publishService = await import("../../services/publishVideo.js");

    const parsed = parseMultiPublishRequest(req.body || {});
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        status: "failed",
        message: parsed.error,
      });
    }

    const result = parsed.multi
      ? await publishService.runMultiPlatformPublish(parsed.value)
      : await publishService.runSingleFilePublish(parsed.value);

    const success = result.success === true || result.exitCode === 0;
    const httpStatus =
      result.exitCode === 2 && !parsed.multi ? 400 : success ? 200 : 200;

    const response = { ...result };
    response.success = success;
    if (parsed.skipped && parsed.skipped.length > 0) {
      response.skipped = parsed.skipped;
    }

    return res.status(httpStatus).json(response);
  } catch (error) {
    console.error("[HTTP /publish]", error);
    return res.status(500).json({
      success: false,
      status: "failed",
      message: error && error.message ? error.message : String(error),
    });
  }
});

module.exports = router;
