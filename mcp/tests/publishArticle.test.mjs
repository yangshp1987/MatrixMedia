import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { derivePartition, handlePublishArticle } from '../dist/tools/publishArticle.js';

async function withFakeMatrixmedia(script, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'matrixmedia-mcp-test-'));
  const bin = path.join(dir, 'matrixmedia');
  const originalPath = process.env.PATH;
  await writeFile(bin, script, 'utf8'); await chmod(bin, 0o755);
  process.env.PATH = `${dir}${path.delimiter}${originalPath || ''}`;
  try { return await fn(); } finally { process.env.PATH = originalPath; await rm(dir, { recursive: true, force: true }); }
}

test('derivePartition supports assisted article platforms', () => {
  assert.equal(derivePartition('a', 'zhihu'), 'persist:a知乎');
  assert.equal(derivePartition('a', 'wechat'), 'persist:a微信公众号');
  assert.equal(derivePartition('a', 'twitter'), 'persist:aX/Twitter');
});

test('publish_article returns ready_for_manual_send', async () => {
  await withFakeMatrixmedia(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({ channel: 'puppeteerFile-done', status: 'ready_for_manual_send', readyForManualSend: true, message: '请手动发送' }) + '\\n');
`, async () => {
    const result = JSON.parse(await handlePublishArticle({ platform: 'zhihu', phone: 'a', title: 't', content: 'c' }));
    assert.equal(result.status, 'ready_for_manual_send');
  });
});

test('non-juejin automatic publish is rejected', async () => {
  await assert.rejects(() => handlePublishArticle({ platform: 'x', phone: 'a', title: 't', content: 'c', mode: 'publish' }), /only available/);
});
