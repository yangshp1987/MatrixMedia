import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { runCli } from '../runner.js';

const PLATFORM_MAP: Record<string, string> = {
  juejin: '掘金', jj: '掘金',
  zhihu: '知乎', zh: '知乎',
  wechat: '微信公众号', weixin: '微信公众号', wx: '微信公众号', mp: '微信公众号', wechatmp: '微信公众号',
  x: 'X/Twitter', twitter: 'X/Twitter', tweet: 'X/Twitter',
};

export function derivePartition(phone: string, platform = 'juejin'): string {
  const canonical = PLATFORM_MAP[String(platform).toLowerCase()];
  if (!canonical) throw new Error('unsupported article platform');
  return `persist:${phone}${canonical}`;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function message(result: { lastJson: unknown; stderr: string }, fallback: string): string {
  const json = result.lastJson as { message?: unknown } | null;
  if (json && typeof json.message === 'string' && json.message.trim()) return json.message;
  return result.stderr.trim().slice(0, 300) || fallback;
}

export const publishArticleTool: Tool = {
  name: 'publish_article',
  description: '打开文章编辑页并填写内容。知乎、微信公众号、X/Twitter 仅支持 assisted 人工确认模式，工具绝不点击最终发布/群发/发送按钮。',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['juejin', 'zhihu', 'wechat', 'x', 'twitter'] },
      phone: { type: 'string', description: '本地账号分组名，用于推导持久化 session partition。' },
      title: { type: 'string' },
      content: { type: 'string' },
      file: { type: 'string' },
      cover: { type: 'string' },
      images: { type: 'array', items: { type: 'string' } },
      category: { type: 'string' },
      tags: { type: 'string' },
      summary: { type: 'string' },
      mode: { type: 'string', enum: ['publish', 'assisted', 'manual-confirm'], description: '默认 assisted；publish 仅掘金可用。' },
    },
    required: ['platform', 'phone', 'title'],
  },
};

export async function handlePublishArticle(args: Record<string, unknown>): Promise<string> {
  const platform = nonEmpty(args.platform);
  if (!platform || !PLATFORM_MAP[platform.toLowerCase()]) throw new Error('unsupported article platform');
  const phone = nonEmpty(args.phone);
  if (!phone) throw new Error('phone must be non-empty string');
  const title = nonEmpty(args.title);
  if (!title) throw new Error('title must be non-empty string');
  const content = nonEmpty(args.content);
  const file = nonEmpty(args.file);
  if (!content && !file) throw new Error('content or file must be non-empty string');
  const requestedMode = nonEmpty(args.mode) || 'assisted';
  const mode = requestedMode === 'manual-confirm' ? 'assisted' : requestedMode;
  if (mode === 'publish' && PLATFORM_MAP[platform.toLowerCase()] !== '掘金') {
    throw new Error('publish mode is only available for juejin; use assisted');
  }

  const cliArgs = ['publish-article', '-p', platform, '-t', title, '--partition', derivePartition(phone, platform), '--mode', mode];
  const add = (flag: string, value: unknown) => { const v = nonEmpty(value); if (v) cliArgs.push(flag, v); };
  add('--content', content); add('--file', file); add('--cover', args.cover);
  add('--category', args.category); add('--tags', args.tags); add('--summary', args.summary);
  if (Array.isArray(args.images)) args.images.forEach(image => add('--image', image));

  const result = await runCli(cliArgs);
  if (result.exitCode !== 0) throw new Error(message(result, '文章页面准备失败'));
  const json = result.lastJson as Record<string, unknown> | null;
  if (!json || json.channel !== 'puppeteerFile-done') throw new Error('CLI 未返回发布结果（缺少 puppeteerFile-done）');
  if (json.status === 'ready_for_manual_send' || json.readyForManualSend === true) {
    return JSON.stringify({ status: 'ready_for_manual_send', message: message(result, '内容已填写，请手动发送') });
  }
  if (json.status !== true) throw new Error(message(result, '文章发布失败'));
  return JSON.stringify({ status: 'success', message: message(result, '文章发布成功') });
}
