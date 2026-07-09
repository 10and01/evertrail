import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { buildShareHTML, type ExportBundleData } from '@/lib/exportBuilder';
import { loadGame } from '@/lib/storage';
import { Download, Share2, Loader2 } from 'lucide-react';

export default function Export() {
  const profile = useGameStore((s) => s.profile);
  const gameState = useGameStore((s) => s);
  const markStoryteller = useGameStore((s) => s.markStoryteller);

  const [title, setTitle] = useState(`${profile?.nickname || '我'} 的 Evertrail`);
  const [url, setUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const save = (await loadGame()) || {
        nodeId: '',
        x: 0,
        y: 0,
        light: 100,
        inventory: { items: [], crafted: [], equippedTrinkets: [] },
        activatedWaypoints: [],
        collectedCollectibles: [],
        savedAt: Date.now(),
      };

      const data: ExportBundleData = {
        gameState: {
          profile: gameState.profile,
          entries: gameState.entries,
          nodes: gameState.nodes,
          chapters: gameState.chapters,
          manualChapters: gameState.manualChapters,
          hiddenChapters: gameState.hiddenChapters,
          talkedEchoIds: gameState.talkedEchoIds,
          unlockedHiddenChapterIds: gameState.unlockedHiddenChapterIds,
          unlockedAchievements: gameState.unlockedAchievements,
          activeChapterId: gameState.activeChapterId,
          manualTiles: gameState.manualTiles,
          loaded: true,
        },
        save,
      };

      const html = await buildShareHTML(title, data);
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      setUrl(blobUrl);
      markStoryteller();
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `evertrail-${Date.now()}.html`;
    a.click();
  };

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-0">
      <h2 className="font-display text-2xl text-et-gold mb-4">导出分享包</h2>
      <PixelPanel className="space-y-4">
        <div>
          <label className="block text-sm text-et-muted mb-1">分享标题</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" />
        </div>

        <div className="text-sm text-white/70 leading-relaxed">
          <p>导出的文件包含完整的游戏数据（日记、地图、章节、小屋布置与当前存档）。</p>
          <p>接收者直接用浏览器打开该 HTML 即可进入你的 Evertrail 世界。</p>
        </div>

        <div className="flex gap-3">
          <PixelButton onClick={generate} disabled={generating} className="flex-1">
            {generating ? (
              <Loader2 className="w-4 h-4 mr-1 inline animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 mr-1 inline" />
            )}
            生成网页游戏包
          </PixelButton>
          {url && (
            <PixelButton variant="secondary" onClick={download}>
              <Download className="w-4 h-4 mr-1 inline" />
              下载
            </PixelButton>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {url && (
          <div className="text-sm text-et-muted">
            <p>已生成独立的 HTML 文件，可发送给朋友直接打开游玩。</p>
            <p className="mt-1">当前为公开分享，任何人拿到文件均可查看内容。</p>
          </div>
        )}
      </PixelPanel>
    </div>
  );
}
