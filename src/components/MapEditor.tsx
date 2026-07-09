import { useMemo, useState, useRef, useEffect } from 'react';
import type { Tile, Mood, JournalEntry } from '@/types/game';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { TILE_SIZE, WORLD_GROUND_Y } from '@/lib/game';
import { MOOD_LIST } from '@/lib/moods';
import { generateMapNodes } from '@/lib/mapGenerator';
import { createNoise2D } from 'simplex-noise';

interface MapEditorProps {
  chapterId: string;
  entries: JournalEntry[];
  manualTiles: Tile[];
  onChange: (tiles: Tile[]) => void;
}

const TILE_TYPES: { type: Tile['type']; label: string }[] = [
  { type: 'grass', label: '草地' },
  { type: 'dirt', label: '泥土' },
  { type: 'stone', label: '岩石' },
  { type: 'sand', label: '沙地' },
  { type: 'snow', label: '雪' },
  { type: 'mud', label: '泥沼' },
  { type: 'ash', label: '灰烬' },
  { type: 'mycelium', label: '菌丝' },
  { type: 'water', label: '水' },
  { type: 'lava', label: '岩浆' },
  { type: 'platform', label: '平台' },
  { type: 'wood', label: '木材' },
  { type: 'gap', label: '空隙' },
  { type: 'raincurtain', label: '雨幕' },
  { type: 'brittle', label: '脆岩' },
  { type: 'door', label: '门' },
  { type: 'window', label: '窗' },
];

const BIOMES: Mood[] = MOOD_LIST;

const TILE_COLORS: Record<Tile['type'], string> = {
  grass: '#4a8f4a',
  dirt: '#8b5a2b',
  stone: '#7a7a7a',
  sand: '#d2b48c',
  snow: '#e8e8e8',
  mud: '#5d4037',
  ash: '#4a4a4a',
  mycelium: '#7a5a8a',
  water: '#3c70a0',
  lava: '#c04020',
  platform: '#8b5a2b',
  wood: '#6b4e32',
  gap: '#1a1a1a',
  raincurtain: '#5a6a9a',
  brittle: '#a05040',
  door: '#7a5a42',
  window: '#87ceeb',
};

function isSolidByDefault(type: Tile['type']): boolean {
  switch (type) {
    case 'water':
    case 'lava':
    case 'gap':
    case 'door':
    case 'window':
      return false;
    default:
      return true;
  }
}

export function MapEditor({ entries, manualTiles, onChange }: MapEditorProps) {
  const [selectedType, setSelectedType] = useState<Tile['type']>('grass');
  const [selectedBiome, setSelectedBiome] = useState<Mood>('calm');
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [brushSize, setBrushSize] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nodes = useMemo(() => generateMapNodes(entries), [entries]);
  const tiles = useMemo(() => [...manualTiles].sort((a, b) => a.x - b.x || a.y - b.y), [manualTiles]);

  const originX = 80;
  const originY = 32;
  const canvasWidth = useMemo(() => {
    if (nodes.length === 0) return 800;
    return Math.max(800, nodes[nodes.length - 1].x + 400);
  }, [nodes]);
  const canvasHeight = 480;

  const surfaceNoise = useMemo(() => createNoise2D(() => 0.42), []);
  const getSurfaceY = (wx: number) =>
    WORLD_GROUND_Y + Math.round((surfaceNoise(wx * 0.005, 0) * 60) / TILE_SIZE) * TILE_SIZE;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#0f1c15';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = originX; x < canvasWidth; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = originY; y < canvasHeight; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(120,200,120,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px < canvasWidth; px += 4) {
      const wx = px - originX;
      const sy = getSurfaceY(wx);
      const screenY = originY + sy;
      if (px === 0) ctx.moveTo(px, screenY);
      else ctx.lineTo(px, screenY);
    }
    ctx.stroke();

    for (const node of nodes) {
      const sx = originX + node.x;
      const sy = originY + node.y;
      ctx.fillStyle = '#f0e6d2';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,230,210,0.7)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(String(node.index + 1), sx + 6, sy - 6);
    }

    for (const t of manualTiles) {
      const sx = originX + t.x;
      const sy = originY + t.y;
      ctx.fillStyle = TILE_COLORS[t.type] ?? '#888';
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  };

  useEffect(() => {
    draw();
  }, [manualTiles, nodes, canvasWidth]);

  const getWorldPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const gx = Math.floor((mx - originX) / TILE_SIZE);
    const gy = Math.floor((my - originY) / TILE_SIZE);
    return { x: gx * TILE_SIZE, y: gy * TILE_SIZE };
  };

  const paintAt = (e: React.MouseEvent<HTMLCanvasElement>, erase: boolean) => {
    const { x: baseX, y: baseY } = getWorldPos(e);
    setXInput(String(baseX));
    setYInput(String(baseY));

    if (erase) {
      const toRemove = new Set<string>();
      for (let dx = 0; dx < brushSize; dx++) {
        for (let dy = 0; dy < brushSize; dy++) {
          toRemove.add(`${baseX + dx * TILE_SIZE},${baseY + dy * TILE_SIZE}`);
        }
      }
      onChange(manualTiles.filter((t) => !toRemove.has(`${t.x},${t.y}`)));
      return;
    }

    const next = [...manualTiles];
    const size = Math.max(1, Math.min(5, brushSize));
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        const x = baseX + dx * TILE_SIZE;
        const y = baseY + dy * TILE_SIZE;
        const filtered = next.filter((t) => t.x !== x || t.y !== y);
        const tile: Tile = {
          x,
          y,
          type: selectedType,
          biome: selectedBiome,
          solid: isSolidByDefault(selectedType),
          destructible: selectedType !== 'lava' && selectedType !== 'raincurtain',
        };
        next.length = 0;
        next.push(...filtered, tile);
      }
    }
    onChange(next);
  };

  const draggingRef = useRef(false);
  const eraseRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    eraseRef.current = e.button === 2;
    paintAt(e, eraseRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getWorldPos(e);
    setXInput(String(pos.x));
    setYInput(String(pos.y));
    if (!draggingRef.current) return;
    paintAt(e, eraseRef.current);
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  const handleMouseLeave = () => {
    draggingRef.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const addTile = () => {
    const baseX = parseInt(xInput, 10);
    const baseY = parseInt(yInput, 10);
    if (Number.isNaN(baseX) || Number.isNaN(baseY)) return;

    const x = Math.floor(baseX / TILE_SIZE) * TILE_SIZE;
    const y = Math.floor(baseY / TILE_SIZE) * TILE_SIZE;
    const next = manualTiles.filter((t) => t.x !== x || t.y !== y);
    next.push({
      x,
      y,
      type: selectedType,
      biome: selectedBiome,
      solid: isSolidByDefault(selectedType),
      destructible: selectedType !== 'lava' && selectedType !== 'raincurtain',
    });
    onChange(next);
  };

  const removeTile = (x: number, y: number) => {
    onChange(manualTiles.filter((t) => t.x !== x || t.y !== y));
  };

  const clearTiles = () => {
    if (confirm('确定清空本章所有手动编辑的瓦片吗？')) {
      onChange([]);
    }
  };

  return (
    <div className="space-y-4">
      <PixelPanel className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-et-gold">地图编辑</h3>
          <span className="text-xs text-et-muted">{manualTiles.length} 块手动瓦片</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-et-muted">瓦片类型</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as Tile['type'])}
              className="w-full text-sm bg-et-panel border border-et-border rounded px-2 py-1"
            >
              {TILE_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-et-muted">生态</label>
            <select
              value={selectedBiome}
              onChange={(e) => setSelectedBiome(e.target.value as Mood)}
              className="w-full text-sm bg-et-panel border border-et-border rounded px-2 py-1"
            >
              {BIOMES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-et-muted">X 坐标</label>
            <input
              type="number"
              value={xInput}
              onChange={(e) => setXInput(e.target.value)}
              placeholder="0"
              step={TILE_SIZE}
              className="w-full text-sm bg-et-panel border border-et-border rounded px-2 py-1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-et-muted">Y 坐标</label>
            <input
              type="number"
              value={yInput}
              onChange={(e) => setYInput(e.target.value)}
              placeholder="0"
              step={TILE_SIZE}
              className="w-full text-sm bg-et-panel border border-et-border rounded px-2 py-1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-et-muted">笔刷大小</label>
            <input
              type="number"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={5}
              className="w-full text-sm bg-et-panel border border-et-border rounded px-2 py-1"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <PixelButton type="button" onClick={addTile} className="text-sm flex-1">
            放置瓦片
          </PixelButton>
          <PixelButton type="button" variant="secondary" onClick={clearTiles} className="text-sm">
            清空
          </PixelButton>
        </div>

        <p className="text-xs text-et-muted">
          提示：坐标会自动对齐到 {TILE_SIZE}px 网格。放置的瓦片会在该章节进入游戏时覆盖自动生成地形。
          在下方画布中左键点击/拖动绘制，右键点击/拖动擦除。
        </p>
      </PixelPanel>

      <PixelPanel className="overflow-auto">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />
      </PixelPanel>

      <PixelPanel className="max-h-64 overflow-auto">
        {tiles.length === 0 ? (
          <p className="text-sm text-white/50">本章还没有手动编辑的瓦片。</p>
        ) : (
          <div className="space-y-1">
            {tiles.map((t) => (
              <div
                key={`${t.x},${t.y}`}
                className="flex items-center justify-between p-2 rounded border border-et-border/50 bg-et-panel/50 text-sm"
              >
                <span className="text-et-muted">
                  ({t.x}, {t.y}){' '}
                  <span className="text-white/80">{TILE_TYPES.find((x) => x.type === t.type)?.label ?? t.type}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeTile(t.x, t.y)}
                  className="w-6 h-6 text-xs border border-et-border rounded hover:border-red-400 text-red-300"
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </PixelPanel>
    </div>
  );
}
