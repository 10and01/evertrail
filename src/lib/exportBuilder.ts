import type { GameState } from '@/types/game';
import type { GameSave } from '@/lib/storage';

export interface ExportBundleData {
  gameState: GameState;
  save: GameSave;
}

function escapeJson(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\/');
}

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractFilename(path: string): string {
  try {
    const url = new URL(path, window.location.href);
    return url.pathname;
  } catch {
    return path;
  }
}

/**
 * 构建可独立打开的分享 HTML。
 * 该 HTML 会内联打包后的 JS/CSS，并嵌入完整的游戏状态与存档数据。
 * 接收者打开文件后，应用会自动把数据写入本地存储并进入游戏。
 */
export async function buildShareHTML(title: string, data: ExportBundleData): Promise<string> {
  const indexHtml = await fetchText('/index.html');
  if (!indexHtml) {
    return buildFallbackHTML(title, '无法获取应用资源，请确保已执行 npm run build。');
  }

  // 解析入口资源路径，允许存在 crossorigin 等任意属性。
  const scriptMatch = indexHtml.match(/<script[^>]+type="module"[^>]*?\s+src="([^"]+)"[^>]*><\/script>/i)
    || indexHtml.match(/<script[^>]+src="([^"]+)"[^>]+type="module"[^>]*><\/script>/i);
  const cssMatch = indexHtml.match(/<link[^>]+rel="stylesheet"[^>]*?\s+href="([^"]+)"[^>]*>/i)
    || indexHtml.match(/<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"[^>]*>/i);

  const scriptPath = scriptMatch ? extractFilename(scriptMatch[1]) : null;
  const cssPath = cssMatch ? extractFilename(cssMatch[1]) : null;

  // 开发模式下 index.html 指向 /src/main.tsx 且没有 CSS 文件，提前给出明确提示。
  if (!scriptPath || scriptPath.endsWith('.tsx') || scriptPath.startsWith('/src/')) {
    return buildFallbackHTML(title, '当前处于开发模式，请先执行 npm run build 生成构建产物后再导出。');
  }

  const [jsText, cssText] = await Promise.all([
    scriptPath ? fetchText(scriptPath) : Promise.resolve(null),
    cssPath ? fetchText(cssPath) : Promise.resolve(''),
  ]);

  if (!jsText) {
    return buildFallbackHTML(title, '无法内联应用资源，请检查构建产物是否完整。');
  }

  // 清理外部资源与开发脚本，保证离线可用。
  let html = indexHtml
    // 移除 Vite 开发错误处理脚本（使用 import.meta.hot）。
    .replace(/<script[^>]*>\s*if\s*\(\s*import\.meta\.hot[\s\S]*?<\/script>/gi, '')
    // 移除 trae badge 等立即执行脚本。
    .replace(/<script[^>]*>\s*\(function\(\)\s*\{[\s\S]*?\}\)\(\)\s*;?\s*<\/script>/gi, '')
    .replace(/<script[^>]+src="[^"]*trae[^"]*"[^>]*><\/script>/gi, '')
    .replace(/<link[^>]+rel="preconnect"[^>]*>/gi, '')
    .replace(/<link[^>]+rel="icon"[^>]*>/gi, '')
    .replace(/<link[^>]+href="https?:\/\/[^"]+"[^>]*>/gi, '');

  // 内联 CSS（如果没有则移除原标签）。
  if (cssMatch) {
    if (cssText) {
      html = html.replace(cssMatch[0], `<style>\n${cssText}\n</style>`);
    } else {
      html = html.replace(cssMatch[0], '');
    }
  }

  // 内联 JS：作为普通脚本运行，避免 file:// 协议下 ES Module 的 CORS 限制。
  const dataScript = `<script>window.__EVERTRAIL_DATA__=${escapeJson(data)};</script>`;
  if (scriptMatch) {
    html = html.replace(scriptMatch[0], `${dataScript}\n<script>\n${jsText}\n</script>`);
  }

  // 更新标题与 meta。
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title} · Evertrail</title>`);

  // 移除 base 标签，避免本地打开时资源路径解析异常。
  html = html.replace(/<base[^>]*>/gi, '');

  return html;
}

function buildFallbackHTML(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} · Evertrail</title>
<style>
body{margin:0;background:#0f1c15;color:#f3f0e6;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
.panel{max-width:480px;background:#1a2f23;border:2px solid #5c4033;padding:2rem;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,0.25)}
h1{color:#f4c430;font-size:1.25rem;margin:0 0 1rem}
p{line-height:1.6;margin:0;color:#a0a0a0}
</style>
</head>
<body>
<div class="panel">
  <h1>导出失败</h1>
  <p>${message}</p>
</div>
</body>
</html>`;
}
