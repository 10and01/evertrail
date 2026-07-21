import type { GameState } from '@/types/game';
import type { GameSave } from '@/lib/storage';
import type { EvertrailStoryPackageV1 } from '@/types/narrative';

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] ?? character);
}

export function buildStoryHTML(data: EvertrailStoryPackageV1): string {
  const payload = escapeJson(data);
  const title = escapeHtml(data.project.title);
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} · Evertrail</title><style>
:root{color-scheme:dark;--ink:#f7f1e7;--muted:#c8bdac;--accent:#f3bd72}*{box-sizing:border-box}body{margin:0;background:#111814;color:var(--ink);font-family:ui-serif,"Noto Serif SC",serif;min-height:100vh;overflow:hidden}.app{height:100vh;display:grid;place-items:center;padding:clamp(16px,4vw,48px);position:relative}.scene{width:min(100%,980px);height:min(82vh,680px);position:relative;overflow:hidden;border-radius:32px;background:linear-gradient(160deg,#243e46,#b77d68 48%,#e4b36e);box-shadow:0 40px 100px #0009;border:1px solid #fff3;isolation:isolate}.scene:before,.scene:after{content:"";position:absolute;border-radius:50%;filter:blur(1px)}.scene:before{width:80%;height:55%;left:-18%;bottom:-25%;background:#17382f}.scene:after{width:90%;height:50%;right:-22%;bottom:-28%;background:#0c2823}.paper{position:absolute;inset:0;opacity:.13;mix-blend-mode:soft-light;background-image:repeating-linear-gradient(0deg,#fff1 0 1px,transparent 1px 4px)}.content{position:absolute;z-index:3;left:clamp(24px,7vw,80px);bottom:clamp(40px,9vh,96px);max-width:620px;text-shadow:0 2px 18px #0009}.eyebrow{font:600 11px/1.4 ui-sans-serif,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(30px,6vw,64px);line-height:1.05;margin:.25em 0}.excerpt{font-size:clamp(16px,2.2vw,23px);line-height:1.8;margin:0}.narration{border-left:2px solid var(--accent);padding-left:16px;color:#fffbd8}.photo{position:absolute;inset:6% 6% auto auto;width:min(42%,360px);height:50%;object-fit:cover;border-radius:22px;transform:rotate(2deg);box-shadow:0 20px 50px #0008;border:8px solid #fff7}.controls{position:absolute;z-index:5;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center}.controls button{border:1px solid #fff5;background:#111a;color:#fff;border-radius:999px;padding:10px 16px;cursor:pointer}.counter{font:12px ui-sans-serif,sans-serif;color:var(--muted)}@media(max-width:640px){.app{padding:0}.scene{height:100vh;border-radius:0}.photo{inset:7% 7% auto;width:86%;height:36%}.content{left:24px;right:24px;bottom:90px}}
@media(prefers-reduced-motion:no-preference){.content{animation:enter .65s ease both}.scene:before{animation:drift 8s ease-in-out infinite alternate}@keyframes enter{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes drift{to{transform:translateX(5%) translateY(-2%)}}}
</style></head><body><main class="app"><section class="scene" id="scene"><div class="paper"></div><img class="photo" id="photo" hidden/><div class="content"><p class="eyebrow" id="date"></p><h1 id="title"></h1><p class="excerpt" id="excerpt"></p><p class="narration" id="narration"></p></div></section><nav class="controls"><button id="prev">←</button><span class="counter" id="counter"></span><button id="next">→</button></nav></main><script>
const story=${payload};let index=0;const byId=new Map(story.entries.map(e=>[e.id,e]));const ordered=story.project.sceneIds.map(id=>story.project.scenes.find(s=>s.id===id)).filter(Boolean);function draw(){const scene=ordered[index],entry=byId.get(scene.entryId)||{};document.getElementById('date').textContent=entry.date||story.project.subtitle;document.getElementById('title').textContent=scene.title;document.getElementById('excerpt').textContent=scene.excerpt;const narration=document.getElementById('narration');narration.textContent=scene.narration||'';narration.hidden=!scene.narration;const photo=document.getElementById('photo');photo.hidden=!entry.image;photo.src=entry.image||'';photo.alt=scene.title;document.getElementById('counter').textContent=(index+1)+' / '+ordered.length;document.getElementById('prev').disabled=index===0;document.getElementById('next').textContent=index===ordered.length-1?'重新开始':'→'}document.getElementById('prev').onclick=()=>{index=Math.max(0,index-1);draw()};document.getElementById('next').onclick=()=>{index=index===ordered.length-1?0:index+1;draw()};document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')document.getElementById('prev').click();if(e.key==='ArrowRight'||e.key===' ')document.getElementById('next').click()});draw();
</script></body></html>`;
}

export async function buildStoryPoster(data: EvertrailStoryPackageV1): Promise<Blob> {
  const width = 1200;
  const sceneHeight = 680;
  const height = Math.max(900, 260 + data.entries.length * sceneHeight + 220);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建长图');
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1d3940');
  gradient.addColorStop(0.45, '#9a685b');
  gradient.addColorStop(1, '#152d28');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#f3bd72';
  context.font = '24px serif';
  context.fillText('EVERTRAIL STORY', 90, 90);
  context.fillStyle = '#fff7ea';
  context.font = 'bold 62px serif';
  drawWrappedText(context, data.project.title, 90, 170, 1020, 74);
  let y = 300;
  for (const entry of data.entries) {
    context.fillStyle = 'rgba(255,255,255,.08)';
    roundRect(context, 70, y, 1060, sceneHeight - 40, 28);
    context.fill();
    context.fillStyle = '#f3bd72';
    context.font = '20px sans-serif';
    context.fillText(entry.date, 110, y + 62);
    context.fillStyle = '#fff7ea';
    context.font = 'bold 42px serif';
    const titleBottom = drawWrappedText(context, entry.title, 110, y + 125, 900, 52);
    context.fillStyle = '#eee5d9';
    context.font = '26px serif';
    const excerptBottom = drawWrappedText(context, entry.excerpt, 110, titleBottom + 42, 900, 42, 8);
    if (entry.narration) {
      context.fillStyle = '#f2d9aa';
      context.font = '23px serif';
      drawWrappedText(context, `“${entry.narration}”`, 110, excerptBottom + 46, 900, 38, 4);
    }
    y += sceneHeight;
  }
  context.fillStyle = '#d6c8b7';
  context.font = '22px serif';
  context.fillText(data.project.endingNote || '故事仍在继续。', 90, height - 110);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('长图生成失败')), 'image/png'));
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  let line = '';
  let lineCount = 0;
  for (const character of text) {
    if (context.measureText(line + character).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = character;
      lineCount++;
      if (lineCount >= maxLines) return y + lineCount * lineHeight;
    } else line += character;
  }
  if (lineCount < maxLines) context.fillText(line, x, y + lineCount * lineHeight);
  return y + (lineCount + 1) * lineHeight;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
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
    // 移除构建工具注入的立即执行脚本。
    .replace(/<script[^>]*>\s*\(function\(\)\s*\{[\s\S]*?\}\)\(\)\s*;?\s*<\/script>/gi, '')
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
