import type { JournalEntry, Mood } from '@/types/game';
import type {
  LifeGraph,
  MemoryAnchor,
  MemoryPuzzleBlueprint,
  MemorySceneBlueprint,
  PersonalizationSource,
  ReflectionChoice,
  ReflectionTone,
  SceneArchetype,
  SceneTransformation,
} from '@/types/life';
import type { NarrativeLens, ThemeProfile } from '@/types/narrative';
import { DEFAULT_THEME_PROFILE } from '@/types/narrative';
import { entitiesForEntry, stableLifeId } from './lifeGraphEngine';
import { normalizeSignals } from './narrativeEngine';
import { MOODS } from './moods';

const PALETTES: Record<Mood, [string, string, string, string, string]> = {
  joy: ['#f8d89a', '#db9368', '#627d68', '#24483f', '#fff0c7'],
  calm: ['#b9d7d2', '#719b91', '#496b61', '#203d38', '#e8d9b9'],
  sad: ['#9eb4cb', '#667d9c', '#596079', '#2c3146', '#d8c8bd'],
  angry: ['#e8aa79', '#b95f4d', '#713b3b', '#2f282c', '#ffd2a4'],
  tired: ['#c6bca9', '#8f887c', '#625f5b', '#302f32', '#e6d8bc'],
  anxious: ['#d9b17d', '#9a735e', '#596372', '#283442', '#f1d29f'],
};

const LENS_LABELS: Record<NarrativeLens, string> = {
  wanderer: '漫游者',
  collector: '收藏家',
  chronicler: '记录者',
};

export function compileMemoryScenes(
  entries: JournalEntry[],
  graph: LifeGraph,
  theme: ThemeProfile = DEFAULT_THEME_PROFILE
): MemorySceneBlueprint[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => compileMemoryScene(entry, graph, theme));
}

export function compileMemoryScene(
  entry: JournalEntry,
  graph: LifeGraph,
  theme: ThemeProfile = DEFAULT_THEME_PROFILE
): MemorySceneBlueprint {
  const signals = normalizeSignals(entry);
  const entities = entitiesForEntry(graph, entry.id);
  const people = Array.from(new Set([
    ...signals.people,
    ...signals.relationship.split(/[，,、/]/).map((value) => value.trim()).filter(Boolean),
  ]));
  const season = graph.seasons.find((item) => item.entryIds.includes(entry.id));
  const archetype = resolveArchetype(entry, people);
  const entityIds = entities.map((entity) => entity.id);
  const motifs = signals.motifs.length ? signals.motifs : fallbackMotifs(entry.mood, archetype);
  const location = signals.location || fallbackLocation(archetype, motifs, entry.mood);
  const anchors = buildAnchors(entry, people, motifs, entityIds, location);
  const puzzle = buildPuzzle(entry, theme.lens, anchors, people, motifs);
  const palette = PALETTES[entry.mood];
  const weather = resolveWeather(entry.mood, motifs);
  const threads = graph.threads.filter((thread) => thread.entryIds.includes(entry.id)).map((thread) => thread.id);
  const locationGrammar = resolveLocationGrammar(location, motifs);

  return {
    id: stableLifeId('scene', entry.id),
    entryId: entry.id,
    seasonId: season?.id ?? stableLifeId('season', entry.date.slice(0, 4)),
    threadIds: threads,
    archetype,
    date: entry.date,
    location,
    people,
    objects: signals.objects,
    motifs,
    mood: entry.mood,
    energy: signals.energy,
    palette,
    weather,
    objective: puzzleObjective(puzzle.template, location, people[0], signals.objects[0] || motifs[0]),
    unresolvedState: unresolvedState(entry.mood, puzzle.template),
    layers: [
      { id: 'sky', depth: 0.05, motif: 'sky', opacity: 1 },
      { id: 'distance', depth: 0.14, motif: location, opacity: 0.8 },
      { id: 'memory', depth: 0.3, motif: archetype, opacity: 0.9 },
      { id: 'people', depth: 0.55, motif: people[0] || 'self', opacity: people.length ? 1 : 0.45 },
      { id: 'foreground', depth: 0.85, motif: signals.objects[0] || motifs[1] || 'grass', opacity: 1 },
      { id: 'atmosphere', depth: 0.2, motif: weather, opacity: 0.6 },
    ],
    anchors,
    puzzle,
    visual: {
      locationGrammar,
      photoTreatment: theme.lens === 'collector' ? 'fragments' : theme.lens === 'chronicler' ? 'frame' : locationGrammar === 'water' ? 'reflection' : 'window',
      paperTexture: theme.palette === 'paper' ? 'fiber' : theme.pacing === 'cinematic' ? 'wash' : 'grain',
      silhouetteSpacing: archetype === 'encounter' || archetype === 'celebration' ? 'near' : archetype === 'farewell' || archetype === 'conflict' ? 'apart' : 'passing',
      motifProp: motifs[0] || '微光',
      ambientTone: entry.mood === 'joy' ? 'warm' : entry.mood === 'anxious' || entry.mood === 'angry' ? 'restless' : entry.mood === 'sad' || entry.mood === 'tired' ? 'hushed' : 'open',
    },
    transformations: buildTransformations(palette, weather, people.length > 0),
    personalization: buildPersonalization(entry, people, motifs, theme.lens, location),
    reflectionPrompt: signals.growthIntent
      ? `如今再回到这里，“${signals.growthIntent}”对你意味着什么？`
      : '如今再回到这里，你想怎样理解这段经历？',
    reflectionChoices: reflectionChoices(archetype),
    keepsake: {
      id: stableLifeId('keepsake', entry.id),
      entryId: entry.id,
      sceneId: stableLifeId('scene', entry.id),
      label: keepsakeLabel(signals.objects[0], motifs[0], location),
      motif: signals.objects[0] || motifs[0] || '一束微光',
      storyPrompt: `把“${signals.objects[0] || motifs[0] || signals.location || '这束微光'}”作为故事中的转场意象。`,
      acquiredAt: 0,
    },
  };
}

function buildAnchors(
  entry: JournalEntry,
  people: string[],
  motifs: string[],
  entityIds: string[],
  location: string
): MemoryAnchor[] {
  const signals = normalizeSignals(entry);
  const mood = MOODS[entry.mood];
  const person = people[0] || '那时的我';
  const object = signals.objects[0] || motifs[0] || '留下来的微光';
  const place = location;
  const fact = [entry.date, location, people.join('、')].filter(Boolean).join(' · ');
  const positions = stablePositions(entry.id);

  return [
    {
      id: `${entry.id}:place`, kind: 'place', x: positions[0], order: 0,
      label: place, detail: fact || entry.text.slice(0, 90), entityIds,
      clue: `这里保存着事情发生的边界：${place}。`,
    },
    {
      id: `${entry.id}:person`, kind: 'person', x: positions[1], order: 2,
      label: person, detail: people.length ? `这段记忆里出现了：${people.join('、')}` : '有时，最需要重新看见的人是当时的自己。', entityIds,
      clue: `${person}与这段经历之间仍留着一条没有说完的线。`,
    },
    {
      id: `${entry.id}:object`, kind: 'object', x: positions[2], order: 1,
      label: object, detail: signals.objects.length ? `你记得的物件：${signals.objects.join('、')}` : `这段画面反复浮现出“${motifs.join('、')}”。`, entityIds,
      clue: `“${object}”也许不是答案，但它记得当时的方向。`,
    },
    {
      id: `${entry.id}:feeling`, kind: 'feeling', x: positions[3], order: 3,
      label: `${mood.label} · 能量 ${signals.energy}/5`, detail: entry.personalMeaning || '先停下来，感受这段记忆留下的距离和温度。', entityIds,
      clue: `情绪并不是障碍，它告诉你这段记忆仍然在意什么。`,
    },
    {
      id: `${entry.id}:meaning`, kind: 'meaning', x: 0.9, order: 4,
      label: signals.growthIntent || '现在的理解', detail: entry.personalMeaning || '你不需要为过去找到标准答案。', entityIds,
      clue: '只有当散落的线索重新连起来，这里才会显现。', optional: true,
    },
  ];
}

function buildPuzzle(
  entry: JournalEntry,
  lens: NarrativeLens,
  anchors: MemoryAnchor[],
  people: string[],
  motifs: string[]
): MemoryPuzzleBlueprint {
  const place = anchors.find((anchor) => anchor.kind === 'place')!;
  const person = anchors.find((anchor) => anchor.kind === 'person')!;
  const object = anchors.find((anchor) => anchor.kind === 'object')!;
  const feeling = anchors.find((anchor) => anchor.kind === 'feeling')!;

  if (lens === 'collector') {
    return {
      id: `${entry.id}:puzzle:keepsake`, template: 'keepsake', title: '把信物放回画面',
      prompt: `“${object.label}”原本属于这段记忆的哪里？`,
      instructions: '先选择信物，再选择它应当回到的地点。',
      anchorIds: [object.id, place.id, feeling.id], solution: [object.id, place.id],
      hint: `从“${object.label}”开始，再想想它最接近哪个地方。`,
      completion: '物件回到画面后，记忆不再只是一组散落的碎片。',
    };
  }

  if (lens === 'chronicler') {
    return {
      id: `${entry.id}:puzzle:thread`, template: 'thread', title: '补上没有说完的线',
      prompt: people.length ? `哪两条线索最能说明“${person.label}”为何留在这里？` : '哪两条线索最能说明当时的你为何留在这里？',
      instructions: '依次选择人物与感受，让因果重新连起来。',
      anchorIds: [person.id, feeling.id, object.id], solution: [person.id, feeling.id],
      hint: '先从“谁在这里”开始，再连接“当时如何感受”。',
      completion: `一条关于${people[0] || '当时的你'}的线重新变得可见。`,
    };
  }

  return {
    id: `${entry.id}:puzzle:route`, template: 'route', title: '找回这段路的顺序',
    prompt: `如果从${place.label}重新出发，哪些线索会依次带你走到现在？`,
    instructions: '按照“地点—信物—感受”的顺序选择线索。',
    anchorIds: [place.id, object.id, feeling.id, person.id], solution: [place.id, object.id, feeling.id],
    hint: `从“${place.label}”开始，最后回到身体记住的感受。`,
    completion: `道路穿过${motifs[0] || '旧日的光'}，重新延伸到你脚下。`,
  };
}

function resolveArchetype(entry: JournalEntry, people: string[]): SceneArchetype {
  const text = `${entry.text} ${entry.tags.join(' ')}`;
  if (/告别|离开|失去|结束|再见|分手/.test(text)) return 'farewell';
  if (/搬|出发|来到|转学|毕业|换工作|开始|重新/.test(text)) return 'transition';
  if (/争吵|冲突|压力|害怕|失败|崩溃|生气/.test(text) || ['angry', 'anxious'].includes(entry.mood)) return 'conflict';
  if (/完成|成功|庆祝|获得|第一次|终于/.test(text) || entry.mood === 'joy') return 'celebration';
  if (people.length > 0) return 'encounter';
  return 'ritual';
}

function reflectionChoices(archetype: SceneArchetype): ReflectionChoice[] {
  const contextual: Record<SceneArchetype, string> = {
    encounter: '我愿意重新看见这段关系', ritual: '平凡的重复也构成了我', transition: '改变把我带到了这里',
    conflict: '我承认当时的自己已经尽力', celebration: '我愿意记住自己的光亮', farewell: '我允许这段告别留有余音',
  };
  return [
    { id: 'hold', label: contextual[archetype], echo: '场景里的光会停留得更久，信物也会以清晰的形状进入展厅。', tone: 'hold' },
    { id: 'release', label: '我愿意放下一部分重量', echo: '雾与遮挡会散开，道路把更多空间还给现在的你。', tone: 'release' },
    { id: 'continue', label: '我还想继续理解它', echo: '道路暂时保持未完成，这条人生线索会在未来再次出现。', tone: 'continue' },
  ];
}

function buildTransformations(
  palette: [string, string, string, string, string],
  weather: MemorySceneBlueprint['weather'],
  hasPeople: boolean
): Record<ReflectionTone, SceneTransformation> {
  return {
    hold: {
      tone: 'hold', weather: 'clear', palette: tintPalette(palette, '#ffd8a8', 0.2), pathState: 'lit',
      peopleState: hasPeople ? 'near' : 'echoing', soundscape: 'chimes', ending: '这段记忆被完整地珍藏下来。',
    },
    release: {
      tone: 'release', weather: 'wind', palette: tintPalette(palette, '#d6edf0', 0.28), pathState: 'open',
      peopleState: 'distant', soundscape: 'wind', ending: '风带走一部分重量，也留下更开阔的距离。',
    },
    continue: {
      tone: 'continue', weather, palette: tintPalette(palette, '#c6b8dd', 0.14), pathState: 'unfinished',
      peopleState: 'echoing', soundscape: 'pulse', ending: '答案没有被封口，这条线索仍会继续生长。',
    },
  };
}

function buildPersonalization(
  entry: JournalEntry,
  people: string[],
  motifs: string[],
  lens: NarrativeLens,
  location: string
): PersonalizationSource[] {
  const signals = normalizeSignals(entry);
  return [
    { field: 'location' as const, label: signals.location ? '地点骨架' : '场景建议', value: location },
    people.length > 0 && { field: 'people' as const, label: '人物剪影', value: people.join('、') },
    signals.objects.length > 0 && { field: 'objects' as const, label: '场景信物', value: signals.objects.join('、') },
    motifs.length > 0 && { field: 'motifs' as const, label: '反复意象', value: motifs.join('、') },
    { field: 'mood' as const, label: '情绪天气', value: MOODS[entry.mood].label },
    { field: 'energy' as const, label: '场景明暗', value: `${signals.energy}/5` },
    signals.lifeStage !== 'unspecified' && { field: 'lifeStage' as const, label: '人生阶段', value: signals.lifeStage },
    { field: 'lens' as const, label: '叙事视角', value: LENS_LABELS[lens] },
  ].filter(Boolean) as PersonalizationSource[];
}

function puzzleObjective(template: MemoryPuzzleBlueprint['template'], location?: string, person?: string, object?: string): string {
  if (template === 'keepsake') return `找到“${object || '信物'}”，把它放回属于它的画面。`;
  if (template === 'thread') return `连接${person || '当时的你'}与那份没有说完的感受。`;
  return `从${location || '记忆的入口'}出发，找回这段路的顺序。`;
}

function unresolvedState(mood: Mood, template: MemoryPuzzleBlueprint['template']): string {
  if (template === 'route') return mood === 'anxious' ? '道路被急促的风切成了几段。' : '前方的路在记忆里断开了。';
  if (template === 'thread') return mood === 'sad' ? '人物之间只剩下模糊的雨声。' : '两道剪影之间的线已经熄灭。';
  return mood === 'tired' ? '信物沉在低低的雾里。' : '一个重要物件离开了它原本的位置。';
}

function resolveWeather(mood: Mood, motifs: string[]): MemorySceneBlueprint['weather'] {
  if (motifs.includes('雨') || mood === 'sad') return 'rain';
  if (motifs.includes('雪')) return 'snow';
  if (mood === 'anxious') return 'wind';
  if (mood === 'angry') return 'embers';
  if (mood === 'tired') return 'mist';
  return 'clear';
}

function resolveLocationGrammar(location: string, motifs: string[]): MemorySceneBlueprint['visual']['locationGrammar'] {
  if (/车站|站台|地铁|火车|机场|路口|街|广场|学校|公司/.test(location)) return 'transit';
  if (/家|房|室|宿舍|厨房|卧室/.test(location)) return 'home';
  if (/海|湖|江|河|岸/.test(location) || motifs.includes('海')) return 'water';
  return 'grove';
}

function fallbackLocation(archetype: SceneArchetype, motifs: string[], mood: Mood): string {
  if (motifs.some((motif) => /海|浪|潮|船/.test(motif))) return '海边栈桥';
  if (motifs.some((motif) => /树|花|草|植物|森林/.test(motif))) return '林间小路';
  if (motifs.some((motif) => /车站|出发|道路/.test(motif)) || archetype === 'transition' || archetype === 'farewell') return '旧城站台';
  if (archetype === 'encounter') return '小城街角';
  if (archetype === 'celebration') return '灯火广场';
  if (mood === 'sad' || mood === 'anxious') return '雨后的街口';
  return '林间小屋外';
}

function fallbackMotifs(mood: Mood, archetype: SceneArchetype): string[] {
  const byMood: Record<Mood, string> = { joy: '光', calm: '风', sad: '雨', angry: '火', tired: '夜', anxious: '回声' };
  return [byMood[mood], archetype === 'transition' ? '道路' : '窗'];
}

function keepsakeLabel(object?: string, motif?: string, location?: string): string {
  if (object) return object;
  if (motif) return `${motif}的信物`;
  if (location) return `${location}留下的光`;
  return '没有名字的纪念';
}

function stablePositions(seed: string): [number, number, number, number] {
  const offset = (hashNumber(seed) % 7) / 100;
  return [0.18 + offset, 0.39 - offset / 2, 0.59 + offset / 3, 0.76 - offset / 4];
}

function tintPalette(
  palette: [string, string, string, string, string],
  tint: string,
  amount: number
): [string, string, string, string, string] {
  return palette.map((color) => mixHex(color, tint, amount)) as [string, string, string, string, string];
}

function mixHex(base: string, tint: string, amount: number): string {
  const a = Number.parseInt(base.slice(1), 16);
  const b = Number.parseInt(tint.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${[channel(16), channel(8), channel(0)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function hashNumber(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
