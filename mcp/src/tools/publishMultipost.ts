import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { runCli } from '../runner.js';

export const publishMultipostTool: Tool = {
  name: 'publish_multipost',
  description: '通过 MultiPost Extension 把内容（图文/视频/动态）发布到 30+ 个扩展覆盖的平台（CSDN、简书、掘金、知乎、微博、Bilibili、B 站文章、Medium、Substack、WordPress、Instagram、Facebook、LinkedIn、Reddit、Pinterest 等）。需要在 Chrome/Edge 浏览器中打开 http://localhost:2663/bridge.html 并安装 MultiPost 扩展。',
  inputSchema: {
    type: 'object',
    properties: {
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: '目标平台列表，支持：MatrixMedia 中文平台名（知乎、微信公众号 …）、MultiPost 原始标识（ARTICLE_CSDN、DYNAMIC_X …）或常用别名（csdn、简书、medium …）',
      },
      type: { type: 'string', enum: ['article', 'video', 'dynamic', 'podcast'], description: '内容类型，默认 article' },
      title: { type: 'string' },
      content: { type: 'string', description: 'Markdown 正文（与 file 二选一）' },
      file: { type: 'string', description: '.md 或 .txt 文件的绝对路径（与 content 二选一）' },
      cover: { type: 'string', description: '封面图片绝对路径' },
      images: { type: 'array', items: { type: 'string' }, description: '正文图片路径列表' },
      tags: { type: 'string', description: '逗号或空格分隔的标签' },
      category: { type: 'string' },
      summary: { type: 'string', description: '摘要，最多 120 字' },
      video: { type: 'string', description: '视频文件绝对路径（type=video 时必填）' },
      mode: { type: 'string', enum: ['assisted', 'auto-publish'], description: 'assisted：只填内容，人工点击发布（默认）；auto-publish：扩展自动点击发布按钮' },
      extensionId: { type: 'string', description: '指定 MultiPost 扩展 ID（默认 Chrome 商店）' },
    },
    required: ['platforms', 'title'],
  },
};

function nonEmpty(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function handlePublishMultipost(args: Record<string, unknown>): Promise<string> {
  const platforms = (Array.isArray(args.platforms) ? args.platforms : []).map(String).filter(Boolean);
  if (!platforms.length) throw new Error('platforms must be a non-empty array');
  const title = nonEmpty(args.title);
  if (!title) throw new Error('title must be non-empty');

  const type = nonEmpty(args.type) || 'article';
  const content = nonEmpty(args.content);
  const file = nonEmpty(args.file);
  if (type === 'article' && !content && !file) throw new Error('content or file must be provided for article type');
  if (type === 'dynamic' && !content) throw new Error('content is required for dynamic type');
  const video = nonEmpty(args.video);
  if (type === 'video' && !video) throw new Error('video path is required for video type');

  const mode = nonEmpty(args.mode) || 'assisted';
  const cover = nonEmpty(args.cover);
  const summary = nonEmpty(args.summary);
  const tags = nonEmpty(args.tags);
  const category = nonEmpty(args.category);
  const extensionId = nonEmpty(args.extensionId);
  const images = (Array.isArray(args.images) ? args.images : []).map(String).filter(Boolean);

  const cliArgs = [
    'publish-multipost',
    ...platforms.flatMap((p) => ['--platform', p]),
    '--type', type,
    '--title', title,
    '--mode', mode,
    ...(content ? ['--content', content] : []),
    ...(file ? ['--file', file] : []),
    ...(cover ? ['--cover', cover] : []),
    ...(video ? ['--video', video] : []),
    ...(summary ? ['--summary', summary] : []),
    ...(tags ? ['--tags', tags] : []),
    ...(category ? ['--category', category] : []),
    ...(extensionId ? ['--extension-id', extensionId] : []),
    ...images.flatMap((img) => ['--image', img]),
  ];

  const result = await runCli(cliArgs);
  if (result.exitCode === 0) {
    const json = result.lastJson as { message?: string; platforms?: string[]; status?: string; autoPublish?: boolean } | null;
    const msg = json?.message || 'MultiPost 发布已提交';
    const detail = json?.autoPublish
      ? '（自动发布模式：扩展会自动点击发布按钮）'
      : '（人工确认模式：请在浏览器各平台窗口手动点击发布按钮）';
    return `${msg} ${detail}\n平台: ${(json?.platforms || platforms).join(', ')}\n状态: ${json?.status || 'ok'}`;
  }
  const errMsg = result.stderr.trim().slice(0, 300) || '发布失败';
  throw new Error(`publish-multipost exitCode=${result.exitCode}: ${errMsg}`);
}
