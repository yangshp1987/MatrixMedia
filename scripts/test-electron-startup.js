"use strict";

require("@babel/register")({
  extensions: [".js"],
  ignore: [/node_modules/],
});

const assert = require("assert");
const {
  initializeElectronRuntime,
} = require("../src/main/services/electronStartup");
const {
  isPlatformLoginText,
  isPlatformLoginUrl,
} = require("../src/shared/platformPageState");

async function testStartupOrder() {
  const calls = [];
  let ready = false;
  const switches = new Map();
  const app = {
    isReady: () => ready,
    commandLine: {
      getSwitchValue: (key) => switches.get(key) || "",
    },
    whenReady: async () => {
      calls.push("whenReady");
      ready = true;
    },
  };
  const pie = {
    initialize: async (receivedApp) => {
      assert.strictEqual(receivedApp, app);
      assert.strictEqual(ready, false);
      calls.push("initialize");
      switches.set("remote-debugging-port", "30123");
    },
  };
  const logs = [];
  await initializeElectronRuntime({
    app,
    pie,
    timeoutMs: 100,
    logger: { log: (message) => logs.push(message) },
  });
  assert.deepStrictEqual(calls, ["initialize", "whenReady"]);
  assert.ok(logs.some((line) => line.includes("调试端口=30123")));
}

async function testStartupFailure() {
  const app = {
    isReady: () => false,
    commandLine: { getSwitchValue: () => "" },
    whenReady: async () => {},
  };
  await assert.rejects(
    () =>
      initializeElectronRuntime({
        app,
        pie: {
          initialize: async () => {
            throw new Error("初始化失败");
          },
        },
        timeoutMs: 100,
        logger: { log() {} },
      }),
    /初始化失败/
  );
}

async function testStartupTimeout() {
  const app = {
    isReady: () => false,
    commandLine: { getSwitchValue: () => "" },
    whenReady: async () => {},
  };
  await assert.rejects(
    () =>
      initializeElectronRuntime({
        app,
        pie: { initialize: () => new Promise(() => {}) },
        timeoutMs: 20,
        logger: { log() {} },
      }),
    /初始化超时/
  );
}

async function main() {
  await testStartupOrder();
  await testStartupFailure();
  await testStartupTimeout();
  assert.strictEqual(
    isPlatformLoginUrl("视频号", "https://channels.weixin.qq.com/login.html"),
    true
  );
  assert.strictEqual(
    isPlatformLoginUrl(
      "视频号",
      "https://channels.weixin.qq.com/platform/post/create"
    ),
    false
  );
  assert.strictEqual(
    isPlatformLoginUrl("抖音", "https://channels.weixin.qq.com/login.html"),
    false
  );
  assert.strictEqual(
    isPlatformLoginUrl("知乎", "https://www.zhihu.com/signin?next=%2Fwrite"),
    true
  );
  assert.strictEqual(
    isPlatformLoginUrl(
      "X/Twitter",
      "https://x.com/i/jf/onboarding/web?mode=login"
    ),
    true
  );
  assert.strictEqual(
    isPlatformLoginUrl("X/Twitter", "https://x.com/compose/post"),
    false
  );
  assert.strictEqual(
    isPlatformLoginText("微信公众号", "登录超时， 请重新登录"),
    true
  );
  assert.strictEqual(
    isPlatformLoginText("微信公众号", "新建图文消息 标题 正文"),
    false
  );
  assert.strictEqual(
    isPlatformLoginText("知乎", "登录超时， 请重新登录"),
    false
  );
  console.log("test-electron-startup passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
