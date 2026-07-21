import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { JournalEntry } from '@/types/game';
import type { MemoryAnchor, MemoryPuzzleStatus, MemorySceneBlueprint, ReflectionTone } from '@/types/life';
import type { ThemeProfile } from '@/types/narrative';

interface JourneyRendererProps {
  blueprint: MemorySceneBlueprint;
  entry: JournalEntry;
  directionRef: React.MutableRefObject<-1 | 0 | 1>;
  interactRef: React.MutableRefObject<boolean>;
  reduceMotion: boolean;
  discoveredAnchorIds: string[];
  puzzleStatus: MemoryPuzzleStatus;
  resolutionTone?: ReflectionTone;
  initialProgress: number;
  avatarStyle: ThemeProfile['avatarStyle'];
  onNearbyAnchor: (anchor: MemoryAnchor | null) => void;
  onInteractAnchor: (anchor: MemoryAnchor) => void;
  onPlayerProgress: (progress: number) => void;
}

interface SceneRuntime {
  worldWidth: number;
  groundY: number;
  playerX: number;
  cameraX: number;
  player: Container;
  layers: Array<{ container: Container; factor: number }>;
  anchors: Array<{ data: MemoryAnchor; x: number; view: Container }>;
  particles: Array<{ view: Graphics; vx: number; vy: number }>;
  unresolved: Container;
  resolutionGlow: Graphics;
  textures: Texture[];
  lastProgressReport: number;
  lastProgressValue: number;
}

export function JourneyRenderer(props: JourneyRendererProps) {
  const { avatarStyle, blueprint, entry, resolutionTone } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef(props);
  const initialProgressRef = useRef(props.initialProgress);
  const initialSceneIdRef = useRef(blueprint.id);
  if (initialSceneIdRef.current !== blueprint.id) {
    initialSceneIdRef.current = blueprint.id;
    initialProgressRef.current = props.initialProgress;
  }
  callbacksRef.current = props;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let initialized = false;
    let runtime: SceneRuntime | null = null;
    let lastAnchorId = '';
    const app = new Application();

    const init = async () => {
      await app.init({
        resizeTo: host,
        antialias: false,
        backgroundAlpha: 0,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl',
      });
      initialized = true;
      if (disposed) {
        app.destroy(true);
        return;
      }
      app.canvas.className = 'journey-canvas';
      app.canvas.setAttribute('aria-label', `可探索的记忆场景：${blueprint.location || blueprint.date}`);
      host.appendChild(app.canvas);
      runtime = buildScene(app, blueprint, entry, initialProgressRef.current, resolutionTone, avatarStyle);

      app.ticker.add((ticker) => {
        if (!runtime) return;
        const current = callbacksRef.current;
        const dt = Math.min(36, ticker.deltaMS) / 1000;
        const speed = current.blueprint.energy <= 2 ? 225 : current.blueprint.energy >= 4 ? 285 : 255;
        runtime.playerX = clamp(runtime.playerX + current.directionRef.current * speed * dt, 90, runtime.worldWidth - 90);
        const maxCamera = Math.max(0, runtime.worldWidth - app.screen.width);
        const targetCamera = clamp(runtime.playerX - app.screen.width * 0.42, 0, maxCamera);
        runtime.cameraX += (targetCamera - runtime.cameraX) * (current.reduceMotion ? 0.3 : 0.085);
        runtime.player.x = runtime.playerX - runtime.cameraX;
        runtime.player.y = runtime.groundY + (current.reduceMotion ? 0 : Math.sin(app.ticker.lastTime * 0.008) * 2);
        runtime.player.scale.x = current.directionRef.current < 0 ? -1 : 1;
        for (const layer of runtime.layers) layer.container.x = -runtime.cameraX * layer.factor;
        for (const particle of runtime.particles) {
          if (current.reduceMotion) continue;
          particle.view.x += particle.vx * dt;
          particle.view.y += particle.vy * dt;
          if (particle.view.y > app.screen.height + 20) particle.view.y = -20;
          if (particle.view.x > app.screen.width + 20) particle.view.x = -20;
          if (particle.view.x < -20) particle.view.x = app.screen.width + 20;
        }

        const puzzleResolved = current.puzzleStatus === 'solved' || current.puzzleStatus === 'skipped' || Boolean(current.resolutionTone);
        const unresolvedTarget = puzzleResolved ? 0.08 : 0.82;
        runtime.unresolved.alpha += (unresolvedTarget - runtime.unresolved.alpha) * 0.06;
        const glowTarget = puzzleResolved ? 0.58 : 0.08;
        runtime.resolutionGlow.alpha += (glowTarget - runtime.resolutionGlow.alpha) * 0.05;
        if (!current.reduceMotion) runtime.resolutionGlow.scale.set(1 + Math.sin(app.ticker.lastTime * 0.0025) * 0.04);

        let nearest: SceneRuntime['anchors'][number] | undefined;
        let nearestDistance = Infinity;
        for (const anchor of runtime.anchors) {
          const distance = Math.abs(runtime.playerX - anchor.x);
          const isDiscovered = current.discoveredAnchorIds.includes(anchor.data.id);
          const lockedMeaning = anchor.data.kind === 'meaning' && !puzzleResolved;
          const near = distance < 110;
          const baseAlpha = lockedMeaning ? 0.24 : isDiscovered ? 0.45 : 0.72;
          anchor.view.alpha = near ? (lockedMeaning ? 0.45 : 1) : baseAlpha;
          anchor.view.scale.set(near && !current.reduceMotion ? 1 + Math.sin(app.ticker.lastTime * 0.006) * 0.08 : isDiscovered ? 0.9 : 1);
          if (distance < nearestDistance) {
            nearest = anchor;
            nearestDistance = distance;
          }
        }
        const nearby = nearestDistance < 100 ? nearest : undefined;
        const nextId = nearby?.data.id ?? '';
        if (nextId !== lastAnchorId) {
          lastAnchorId = nextId;
          current.onNearbyAnchor(nearby?.data ?? null);
        }
        if (current.interactRef.current) {
          current.interactRef.current = false;
          if (nearby) current.onInteractAnchor(nearby.data);
        }

        runtime.lastProgressReport += ticker.deltaMS;
        const playerProgress = clamp(runtime.playerX / runtime.worldWidth, 0, 1);
        if (runtime.lastProgressReport > 850 && Math.abs(playerProgress - runtime.lastProgressValue) > 0.012) {
          runtime.lastProgressReport = 0;
          runtime.lastProgressValue = playerProgress;
          current.onPlayerProgress(playerProgress);
        }
      });
    };

    init().catch((error) => console.error('Journey renderer failed:', error));
    return () => {
      disposed = true;
      callbacksRef.current.onNearbyAnchor(null);
      if (runtime) callbacksRef.current.onPlayerProgress(clamp(runtime.playerX / runtime.worldWidth, 0, 1));
      runtime?.textures.forEach((texture) => texture.destroy(true));
      if (initialized) app.destroy(true, { children: true, texture: false });
    };
  }, [avatarStyle, blueprint, entry, resolutionTone]);

  return <div ref={hostRef} className="journey-render-host" />;
}

function buildScene(
  app: Application,
  blueprint: MemorySceneBlueprint,
  entry: JournalEntry,
  initialProgress: number,
  resolutionTone: ReflectionTone | undefined,
  avatarStyle: ThemeProfile['avatarStyle']
): SceneRuntime {
  const width = Math.max(320, app.screen.width);
  const height = Math.max(480, app.screen.height);
  const worldWidth = Math.max(1850, width * (blueprint.puzzle.template === 'route' ? 2.55 : 2.3));
  const groundY = height * 0.75;
  const textures: Texture[] = [];
  const layers: SceneRuntime['layers'] = [];
  const transformation = resolutionTone ? blueprint.transformations[resolutionTone] : undefined;
  const paletteHex = transformation?.palette ?? blueprint.palette;
  const palette = paletteHex.map(hex);
  const weather = transformation?.weather ?? blueprint.weather;

  const skyTexture = gradientTexture(width, height, paletteHex[0], paletteHex[1], blueprint.id);
  textures.push(skyTexture);
  const sky = new Sprite(skyTexture);
  sky.width = width;
  sky.height = height;
  app.stage.addChild(sky);

  const distant = new Container();
  drawDistantLandscape(distant, worldWidth, groundY, blueprint, palette);
  app.stage.addChild(distant);
  layers.push({ container: distant, factor: 0.14 });

  const middle = new Container();
  drawLocation(middle, worldWidth, groundY, blueprint, palette, transformation?.pathState);
  app.stage.addChild(middle);
  layers.push({ container: middle, factor: 0.38 });

  const world = new Container();
  drawGround(world, worldWidth, height, groundY, blueprint, palette, transformation?.pathState);
  drawPeople(world, blueprint, worldWidth, groundY, palette, transformation?.peopleState);
  drawObjects(world, blueprint, worldWidth, groundY, palette);
  drawPhoto(world, entry, blueprint, worldWidth, groundY);
  app.stage.addChild(world);
  layers.push({ container: world, factor: 1 });

  const unresolved = drawUnresolvedState(blueprint, worldWidth, groundY, palette);
  unresolved.alpha = transformation ? 0.08 : 0.82;
  world.addChild(unresolved);

  const resolutionGlow = new Graphics()
    .rect(worldWidth * 0.9 - 44, groundY - 8, 88, 8)
    .fill({ color: palette[4], alpha: 0.36 });
  resolutionGlow.alpha = transformation ? 0.58 : 0.08;
  world.addChild(resolutionGlow);

  const anchors = blueprint.anchors.map((anchor, index) => {
    const x = worldWidth * anchor.x;
    const view = createAnchor(anchor, palette, blueprint.visual.locationGrammar);
    view.x = x;
    view.y = groundY - (index % 2) * 4;
    world.addChild(view);
    return { data: anchor, x, view };
  });

  const player = createPixelPerson(palette[3], palette[4], true, avatarStyle, 'player');
  const playerX = clamp(initialProgress * worldWidth, 90, worldWidth - 90);
  player.x = playerX;
  player.y = groundY;
  app.stage.addChild(player);

  const foreground = new Container();
  drawForeground(foreground, worldWidth, height, groundY, palette, blueprint.visual.paperTexture);
  app.stage.addChild(foreground);
  layers.push({ container: foreground, factor: 1.18 });

  const particles = createWeather(app.stage, weather, width, height, palette, blueprint.id);
  const paperTexture = paperOverlayTexture(width, height, blueprint.id, blueprint.visual.paperTexture);
  textures.push(paperTexture);
  const paper = new Sprite(paperTexture);
  paper.width = width;
  paper.height = height;
  paper.alpha = 0.08;
  app.stage.addChild(paper);

  const vignetteTexture = vignetteTextureFor(width, height);
  textures.push(vignetteTexture);
  const vignette = new Sprite(vignetteTexture);
  vignette.width = width;
  vignette.height = height;
  app.stage.addChild(vignette);

  return {
    worldWidth, groundY, playerX, cameraX: clamp(playerX - width * 0.42, 0, Math.max(0, worldWidth - width)),
    player, layers, anchors, particles, unresolved, resolutionGlow, textures,
    lastProgressReport: 0, lastProgressValue: playerX / worldWidth,
  };
}

function drawDistantLandscape(container: Container, worldWidth: number, groundY: number, blueprint: MemorySceneBlueprint, palette: number[]) {
  const seed = hashNumber(blueprint.id);
  const sunX = 460 + (seed % 520);
  const sun = new Graphics()
    .rect(sunX, groundY - 430, 112, 112)
    .fill({ color: palette[4], alpha: 0.68 })
    .rect(sunX - 16, groundY - 398, 144, 48)
    .fill({ color: palette[4], alpha: 0.3 });
  container.addChild(sun);
  for (let index = 0; index < 7; index++) {
    drawPixelCloud(container, 130 + index * 520 + (seed % 90), groundY - 390 - (index % 3) * 58, palette[4], 0.18 + (index % 2) * 0.06);
  }
  const skyline = new Graphics();
  if (blueprint.visual.locationGrammar === 'transit' || blueprint.visual.locationGrammar === 'home') {
    for (let index = 0; index < 18; index++) {
      const x = index * 210;
      const height = 76 + ((seed + index * 43) % 110);
      skyline.rect(x, groundY - height - 84, 150, height).fill({ color: palette[3], alpha: 0.18 });
      skyline.rect(x + 24, groundY - height - 52, 20, 20).rect(x + 68, groundY - height - 52, 20, 20).fill({ color: palette[4], alpha: 0.12 });
    }
  } else {
    skyline.moveTo(0, groundY - 58);
    for (let index = 0; index < 14; index++) skyline.lineTo(index * 280, groundY - 118 - ((seed + index * 51) % 120));
    skyline.lineTo(worldWidth, groundY - 58).closePath().fill({ color: palette[2], alpha: 0.24 });
  }
  container.addChild(skyline);
}

function drawLocation(
  container: Container,
  worldWidth: number,
  groundY: number,
  blueprint: MemorySceneBlueprint,
  palette: number[],
  pathState?: 'lit' | 'open' | 'unfinished'
) {
  const seed = hashNumber(blueprint.location || blueprint.id);
  if (blueprint.visual.locationGrammar === 'transit') {
    for (let x = 80; x < worldWidth; x += 720) drawStationModule(container, x, groundY, palette, pathState === 'lit');
    for (let x = 420; x < worldWidth; x += 560) drawLamp(container, x, groundY, palette[3], palette[4], pathState === 'lit');
  } else if (blueprint.visual.locationGrammar === 'home') {
    for (let index = 0; index < 8; index++) {
      const x = index * 410 + 55;
      drawPixelHouse(container, x, groundY, palette, pathState === 'lit' || index === seed % 8);
      drawFence(container, x + 230, groundY, palette[3]);
    }
    for (let x = 310; x < worldWidth; x += 820) drawMailbox(container, x, groundY, palette[3], palette[4]);
  } else if (blueprint.visual.locationGrammar === 'water') {
    const water = new Graphics().rect(0, groundY - 120, worldWidth, 120).fill({ color: palette[1], alpha: 0.5 });
    for (let x = 0; x < worldWidth; x += 96) water.rect(x, groundY - 92 + (x / 96 % 3) * 18, 58, 4).fill({ color: palette[4], alpha: 0.22 });
    container.addChild(water);
    for (let x = 160; x < worldWidth; x += 760) drawPier(container, x, groundY, palette);
    drawLighthouse(container, worldWidth * 0.54, groundY, palette, pathState === 'lit');
  } else {
    for (let index = 0; index < 15; index++) drawPixelTree(container, index * 225 + (seed % 80), groundY, palette, 0.75 + (index % 3) * 0.12);
    for (let x = 300; x < worldWidth; x += 780) {
      drawBench(container, x, groundY, palette[3], palette[4]);
      drawLamp(container, x + 150, groundY, palette[3], palette[4], pathState === 'lit');
    }
    drawPixelCabin(container, worldWidth * 0.63, groundY, palette, pathState === 'lit');
  }
}

function drawGround(
  container: Container,
  worldWidth: number,
  height: number,
  groundY: number,
  blueprint: MemorySceneBlueprint,
  palette: number[],
  pathState?: 'lit' | 'open' | 'unfinished'
) {
  const ground = new Graphics();
  if (blueprint.visual.locationGrammar === 'transit') {
    ground.rect(0, groundY, worldWidth, height - groundY + 100).fill({ color: 0x4d5352, alpha: 0.98 });
    ground.rect(0, groundY, worldWidth, 18).fill({ color: 0xc6b58b, alpha: 0.92 });
    ground.rect(0, groundY + 18, worldWidth, 48).fill({ color: 0x777a72, alpha: 0.95 });
    ground.rect(0, groundY + 66, worldWidth, 12).fill({ color: 0x252a2c, alpha: 1 });
    ground.rect(0, groundY + 112, worldWidth, 10).fill({ color: 0x22272a, alpha: 1 });
    for (let x = 0; x < worldWidth; x += 54) ground.rect(x, groundY + 82, 32, 8).rect(x + 10, groundY + 130, 32, 8).fill({ color: 0x3b3430, alpha: 0.9 });
  } else if (blueprint.visual.locationGrammar === 'water') {
    ground.rect(0, groundY, worldWidth, height - groundY + 100).fill({ color: 0x8b7653, alpha: 0.95 });
    ground.rect(0, groundY, worldWidth, 12).fill({ color: palette[4], alpha: 0.48 });
    for (let x = 0; x < worldWidth; x += 70) ground.rect(x, groundY + 28 + (x / 70 % 2) * 18, 26, 4).fill({ color: 0xd7c38d, alpha: 0.38 });
  } else {
    ground.rect(0, groundY, worldWidth, height - groundY + 100).fill({ color: palette[3], alpha: 0.98 });
    ground.rect(0, groundY, worldWidth, 12).fill({ color: palette[2], alpha: 0.92 });
    const pathColor = pathState === 'open' ? 0xb7a581 : 0x847861;
    ground.rect(0, groundY + 52, worldWidth, pathState === 'open' ? 92 : 66).fill({ color: pathColor, alpha: pathState === 'lit' ? 0.7 : 0.48 });
    for (let x = 0; x < worldWidth; x += 90) ground.rect(x, groundY + 74 + (x / 90 % 3) * 12, 34, 5).fill({ color: palette[4], alpha: 0.12 });
  }
  container.addChild(ground);
}

function drawPeople(
  container: Container,
  blueprint: MemorySceneBlueprint,
  worldWidth: number,
  groundY: number,
  palette: number[],
  resolvedState?: 'near' | 'distant' | 'echoing'
) {
  const spacing = resolvedState === 'near' || blueprint.visual.silhouetteSpacing === 'near' ? 0.07 : resolvedState === 'distant' || blueprint.visual.silhouetteSpacing === 'apart' ? 0.16 : 0.11;
  blueprint.people.slice(0, 4).forEach((_, index) => {
    const person = createPixelPerson(palette[3], palette[4], false, 'traveler', `npc-${index}`);
    person.x = worldWidth * (0.34 + index * spacing);
    person.y = groundY;
    person.alpha = resolvedState === 'echoing' ? 0.48 + index * 0.08 : 0.78 + index * 0.05;
    person.scale.set(0.86 + index * 0.025);
    container.addChild(person);
  });
}

function drawObjects(container: Container, blueprint: MemorySceneBlueprint, worldWidth: number, groundY: number, palette: number[]) {
  const objects = blueprint.objects.length ? blueprint.objects : blueprint.motifs.slice(0, 3);
  objects.slice(0, 4).forEach((object, index) => {
    const x = worldWidth * (0.24 + index * 0.17);
    const prop = drawPixelProp(object, palette[3], palette[4]);
    prop.x = x;
    prop.y = groundY;
    container.addChild(prop);
  });
}

function drawPhoto(container: Container, entry: JournalEntry, blueprint: MemorySceneBlueprint, worldWidth: number, groundY: number) {
  if (!entry.image) return;
  const texture = Texture.from(entry.image);
  const photo = new Sprite(texture);
  const x = worldWidth * 0.16;
  const board = new Graphics().rect(x - 14, groundY - 244, 228, 164).fill({ color: 0x54483b, alpha: 0.96 }).rect(x - 8, groundY - 238, 216, 152).fill({ color: 0xe7dcc6, alpha: 0.96 }).rect(x + 92, groundY - 80, 12, 80).fill({ color: 0x4a3d33, alpha: 0.96 });
  container.addChild(board);
  photo.x = x;
  photo.y = groundY - 230;
  photo.width = 200;
  photo.height = 136;
  photo.alpha = blueprint.visual.photoTreatment === 'fragments' ? 0.78 : 0.92;
  container.addChild(photo);
}

function drawUnresolvedState(blueprint: MemorySceneBlueprint, worldWidth: number, groundY: number, palette: number[]): Container {
  const view = new Container();
  if (blueprint.puzzle.template === 'route') {
    for (let index = 0; index < 3; index++) drawBarricade(view, worldWidth * (0.34 + index * 0.15), groundY, palette[4]);
  } else if (blueprint.puzzle.template === 'thread') {
    const wire = new Graphics().rect(worldWidth * 0.38, groundY - 150, 8, 150).rect(worldWidth * 0.62, groundY - 150, 8, 150).fill({ color: 0x3b342f, alpha: 0.9 });
    for (let index = 0; index < 7; index++) wire.rect(worldWidth * 0.39 + index * 82, groundY - 138 + (index % 2) * 18, 42, 4).fill({ color: palette[4], alpha: 0.42 });
    view.addChild(wire);
  } else {
    const pedestalX = worldWidth * 0.62;
    view.addChild(new Graphics().rect(pedestalX - 44, groundY - 44, 88, 44).fill({ color: 0x5c5144, alpha: 0.94 }).rect(pedestalX - 28, groundY - 74, 56, 30).stroke({ color: palette[4], width: 4, alpha: 0.55 }));
  }
  return view;
}

function drawForeground(
  container: Container,
  worldWidth: number,
  height: number,
  groundY: number,
  palette: number[],
  texture: MemorySceneBlueprint['visual']['paperTexture']
) {
  void texture;
  const foreground = new Graphics().rect(0, height - 22, worldWidth, 22).fill({ color: 0x17251f, alpha: 0.82 });
  for (let index = 0; index < 80; index++) {
    const x = index * (worldWidth / 79);
    const h = 8 + (index % 5) * 4;
    foreground.rect(x, groundY - h, 4, h).rect(x + 6, groundY - h + 5, 4, h - 5).fill({ color: index % 2 ? palette[2] : palette[4], alpha: 0.34 });
  }
  container.addChild(foreground);
}

function createPixelPerson(
  body: number,
  accent: number,
  player: boolean,
  avatarStyle: ThemeProfile['avatarStyle'],
  role: string
): Container {
  const view = new Container();
  const skin = role.includes('1') ? 0xd59b72 : 0xe1ad82;
  const hair = role.includes('2') ? 0x5b3a2e : 0x332923;
  const jacket = player ? accent : role.includes('1') ? 0x8a6f86 : role.includes('2') ? 0x4f7482 : body;
  const alpha = avatarStyle === 'spirit' && player ? 0.78 : 1;
  const sprite = new Graphics()
    .rect(-18, -2, 40, 6).fill({ color: 0x111111, alpha: 0.24 })
    .rect(-12, -28, 9, 28).rect(5, -28, 9, 28).fill({ color: 0x27313a, alpha })
    .rect(-15, -68, 32, 42).fill({ color: jacket, alpha })
    .rect(-19, -61, 5, 28).rect(17, -61, 5, 28).fill({ color: jacket, alpha })
    .rect(-12, -94, 26, 27).fill({ color: skin, alpha })
    .rect(-14, -100, 30, 11).rect(-14, -90, 5, 12).fill({ color: hair, alpha })
    .rect(-6, -82, 3, 3).rect(7, -82, 3, 3).fill({ color: 0x2a211d, alpha })
    .rect(-11, -30, 8, 5).rect(6, -30, 8, 5).fill({ color: 0xefe5d6, alpha: 0.85 });
  if (player) {
    sprite.rect(-16, -69, 36, 6).fill({ color: accent, alpha: 0.96 });
    sprite.rect(17, -64, 28, 5).rect(33, -59, 18, 5).fill({ color: accent, alpha: 0.9 });
    sprite.rect(-6, -57, 12, 12).fill({ color: 0xf3d38b, alpha: 0.92 });
  }
  if (avatarStyle === 'silhouette') sprite.rect(-16, -100, 34, 100).fill({ color: 0x2d302e, alpha: 0.26 });
  view.addChild(sprite);
  return view;
}

function createAnchor(anchor: MemoryAnchor, palette: number[], grammar: MemorySceneBlueprint['visual']['locationGrammar']): Container {
  const view = new Container();
  const sparkles = new Graphics();
  for (let index = 0; index < 6; index++) sparkles.rect(-38 + index * 14, -118 - (index % 3) * 10, 5, 5).fill({ color: palette[4], alpha: 0.35 + (index % 2) * 0.25 });
  view.addChild(sparkles);
  if (anchor.kind === 'place') {
    const sign = new Graphics().rect(-42, -92, 84, 48).fill({ color: grammar === 'transit' ? 0x426d78 : 0x5d7048, alpha: 1 }).rect(-34, -84, 68, 7).rect(-34, -68, 46, 6).fill({ color: 0xf0e4c8, alpha: 0.86 }).rect(-5, -44, 10, 44).fill({ color: 0x4b3b2f, alpha: 1 });
    view.addChild(sign);
  } else if (anchor.kind === 'person') {
    const person = createPixelPerson(palette[3], palette[4], false, 'traveler', 'anchor-person');
    person.scale.set(1.05);
    view.addChild(person);
  } else if (anchor.kind === 'object') {
    const prop = drawPixelProp(anchor.label, palette[3], palette[4]);
    prop.scale.set(1.18);
    view.addChild(prop);
  } else if (anchor.kind === 'feeling') {
    drawLamp(view, 0, 0, palette[3], palette[4], true);
  } else {
    const kiosk = new Graphics().rect(-36, -96, 72, 96).fill({ color: 0x4b4036, alpha: 1 }).rect(-27, -84, 54, 62).fill({ color: 0xe8dcc2, alpha: 0.95 }).rect(-17, -73, 34, 5).rect(-17, -58, 28, 5).rect(-17, -43, 38, 5).fill({ color: palette[3], alpha: 0.68 }).rect(-44, -104, 88, 10).fill({ color: palette[4], alpha: 0.85 });
    view.addChild(kiosk);
  }
  return view;
}

function createWeather(
  container: Container,
  weather: MemorySceneBlueprint['weather'],
  width: number,
  height: number,
  palette: number[],
  seedText: string
) {
  const particles: SceneRuntime['particles'] = [];
  const count = weather === 'clear' ? 20 : 48;
  const random = seededRandom(hashNumber(seedText));
  for (let index = 0; index < count; index++) {
    const view = new Graphics();
    if (weather === 'rain') view.moveTo(0, 0).lineTo(-5, 14).stroke({ color: 0xd7e6ef, width: 1.4, alpha: 0.42 });
    else if (weather === 'snow') view.circle(0, 0, 2 + index % 2).fill({ color: 0xffffff, alpha: 0.54 });
    else if (weather === 'embers') view.circle(0, 0, 2 + index % 3).fill({ color: 0xffb267, alpha: 0.55 });
    else view.circle(0, 0, 1.5 + index % 2).fill({ color: palette[4], alpha: weather === 'mist' ? 0.14 : 0.32 });
    view.x = random() * width;
    view.y = random() * height;
    container.addChild(view);
    particles.push({
      view,
      vx: weather === 'wind' ? 36 + index % 20 : weather === 'embers' ? 8 : weather === 'snow' ? -4 : -8,
      vy: weather === 'embers' ? -14 - index % 12 : weather === 'rain' ? 120 : weather === 'snow' ? 12 + index % 8 : 8 + index % 8,
    });
  }
  return particles;
}

function drawPixelCloud(container: Container, x: number, y: number, color: number, alpha: number) {
  container.addChild(new Graphics()
    .rect(x, y + 16, 112, 24).rect(x + 24, y, 54, 24).rect(x + 72, y + 8, 66, 32)
    .fill({ color, alpha }));
}

function drawStationModule(container: Container, x: number, groundY: number, palette: number[], lit: boolean) {
  const station = new Graphics()
    .rect(x, groundY - 214, 420, 18).fill({ color: 0x4a4640, alpha: 1 })
    .rect(x + 18, groundY - 196, 12, 196).rect(x + 390, groundY - 196, 12, 196).fill({ color: 0x5b554b, alpha: 1 })
    .rect(x + 48, groundY - 172, 300, 148).fill({ color: 0x817969, alpha: 0.94 })
    .rect(x + 70, groundY - 146, 76, 72).rect(x + 164, groundY - 146, 76, 72).fill({ color: lit ? palette[4] : 0x39484c, alpha: lit ? 0.72 : 0.76 })
    .rect(x + 265, groundY - 126, 54, 102).fill({ color: 0x403a34, alpha: 1 })
    .rect(x + 116, groundY - 190, 190, 34).fill({ color: 0x315f6a, alpha: 1 })
    .rect(x + 134, groundY - 179, 154, 7).fill({ color: 0xf1e5c9, alpha: 0.86 });
  container.addChild(station);
  drawBench(container, x + 330, groundY, 0x4a3a2d, palette[4]);
}

function drawPixelHouse(container: Container, x: number, groundY: number, palette: number[], lit: boolean) {
  const house = new Graphics()
    .rect(x, groundY - 156, 220, 156).fill({ color: 0x78695a, alpha: 1 })
    .moveTo(x - 20, groundY - 156).lineTo(x + 110, groundY - 252).lineTo(x + 240, groundY - 156).closePath().fill({ color: 0x51463d, alpha: 1 })
    .rect(x + 88, groundY - 82, 48, 82).fill({ color: 0x382f2a, alpha: 1 })
    .rect(x + 24, groundY - 124, 48, 44).rect(x + 152, groundY - 124, 48, 44).fill({ color: lit ? palette[4] : 0x35464c, alpha: lit ? 0.76 : 0.7 })
    .rect(x + 32, groundY - 118, 4, 32).rect(x + 58, groundY - 118, 4, 32).rect(x + 160, groundY - 118, 4, 32).rect(x + 186, groundY - 118, 4, 32).fill({ color: 0xe4d7bd, alpha: 0.55 });
  container.addChild(house);
}

function drawPixelCabin(container: Container, x: number, groundY: number, palette: number[], lit: boolean) {
  const cabin = new Graphics()
    .rect(x, groundY - 112, 170, 112).fill({ color: 0x594536, alpha: 1 })
    .moveTo(x - 18, groundY - 112).lineTo(x + 84, groundY - 184).lineTo(x + 188, groundY - 112).closePath().fill({ color: 0x3c332c, alpha: 1 })
    .rect(x + 64, groundY - 66, 38, 66).fill({ color: 0x2f2925, alpha: 1 })
    .rect(x + 18, groundY - 84, 38, 36).rect(x + 116, groundY - 84, 38, 36).fill({ color: lit ? palette[4] : 0x29413d, alpha: lit ? 0.74 : 0.7 });
  container.addChild(cabin);
}

function drawPixelTree(container: Container, x: number, groundY: number, palette: number[], scale: number) {
  const tree = new Container();
  tree.x = x;
  tree.y = groundY;
  tree.scale.set(scale);
  tree.addChild(new Graphics()
    .rect(-10, -128, 20, 128).fill({ color: 0x49392e, alpha: 1 })
    .rect(-46, -188, 92, 64).rect(-68, -164, 136, 54).rect(-34, -224, 68, 42)
    .fill({ color: palette[2], alpha: 0.96 })
    .rect(-50, -174, 38, 18).rect(18, -204, 30, 18).fill({ color: palette[4], alpha: 0.12 }));
  container.addChild(tree);
}

function drawBench(container: Container, x: number, groundY: number, body: number, accent: number) {
  container.addChild(new Graphics()
    .rect(x - 52, groundY - 52, 104, 14).rect(x - 52, groundY - 84, 104, 12).fill({ color: body, alpha: 1 })
    .rect(x - 42, groundY - 38, 8, 38).rect(x + 34, groundY - 38, 8, 38).fill({ color: 0x312821, alpha: 1 })
    .rect(x - 45, groundY - 80, 90, 3).fill({ color: accent, alpha: 0.28 }));
}

function drawLamp(container: Container, x: number, groundY: number, body: number, light: number, lit: boolean) {
  const lamp = new Graphics()
    .rect(x - 5, groundY - 132, 10, 132).fill({ color: body, alpha: 1 })
    .rect(x - 22, groundY - 150, 44, 24).fill({ color: 0x3b3833, alpha: 1 })
    .rect(x - 15, groundY - 144, 30, 16).fill({ color: lit ? light : 0x6b665d, alpha: lit ? 0.9 : 0.7 })
    .rect(x - 16, groundY - 4, 32, 4).fill({ color: 0x292724, alpha: 1 });
  container.addChild(lamp);
}

function drawFence(container: Container, x: number, groundY: number, color: number) {
  const fence = new Graphics();
  for (let index = 0; index < 5; index++) fence.rect(x + index * 34, groundY - 60, 10, 60).fill({ color, alpha: 0.82 });
  fence.rect(x - 5, groundY - 48, 170, 9).rect(x - 5, groundY - 22, 170, 9).fill({ color, alpha: 0.82 });
  container.addChild(fence);
}

function drawMailbox(container: Container, x: number, groundY: number, body: number, accent: number) {
  container.addChild(new Graphics()
    .rect(x - 22, groundY - 82, 44, 34).fill({ color: accent, alpha: 0.9 })
    .rect(x - 5, groundY - 48, 10, 48).fill({ color: body, alpha: 1 })
    .rect(x + 12, groundY - 92, 5, 30).fill({ color: 0xc85c4b, alpha: 1 }));
}

function drawPier(container: Container, x: number, groundY: number, palette: number[]) {
  const pier = new Graphics().rect(x, groundY - 34, 280, 34).fill({ color: 0x65503d, alpha: 1 });
  for (let index = 0; index < 6; index++) pier.rect(x + index * 52, groundY - 30, 6, 82).fill({ color: 0x40362d, alpha: 0.9 });
  pier.rect(x + 8, groundY - 28, 260, 4).fill({ color: palette[4], alpha: 0.16 });
  container.addChild(pier);
}

function drawLighthouse(container: Container, x: number, groundY: number, palette: number[], lit: boolean) {
  const tower = new Graphics()
    .moveTo(x - 30, groundY).lineTo(x - 18, groundY - 190).lineTo(x + 18, groundY - 190).lineTo(x + 30, groundY).closePath().fill({ color: 0xe5ddce, alpha: 0.95 })
    .rect(x - 22, groundY - 150, 44, 22).rect(x - 26, groundY - 82, 52, 22).fill({ color: 0xb75b4c, alpha: 0.9 })
    .rect(x - 34, groundY - 222, 68, 34).fill({ color: 0x37342f, alpha: 1 })
    .rect(x - 24, groundY - 214, 48, 20).fill({ color: lit ? palette[4] : 0x4b5555, alpha: lit ? 0.9 : 0.72 });
  container.addChild(tower);
}

function drawBarricade(container: Container, x: number, groundY: number, accent: number) {
  container.addChild(new Graphics()
    .rect(x - 52, groundY - 68, 104, 20).fill({ color: 0x5a4635, alpha: 1 })
    .rect(x - 42, groundY - 64, 28, 12).rect(x + 8, groundY - 64, 28, 12).fill({ color: accent, alpha: 0.74 })
    .rect(x - 38, groundY - 48, 10, 48).rect(x + 28, groundY - 48, 10, 48).fill({ color: 0x43362c, alpha: 1 }));
}

function drawPixelProp(label: string, body: number, accent: number): Container {
  const view = new Container();
  const prop = new Graphics();
  if (/票|信|纸|照片/.test(label)) {
    prop.rect(-28, -52, 56, 38).fill({ color: 0xeee3c9, alpha: 1 }).rect(-20, -44, 38, 5).rect(-20, -32, 28, 4).fill({ color: body, alpha: 0.5 });
    if (/票/.test(label)) prop.rect(-28, -52, 8, 38).rect(20, -52, 8, 38).fill({ color: accent, alpha: 0.55 });
  } else if (/伞/.test(label)) {
    prop.rect(-4, -70, 8, 70).fill({ color: 0x4b3a31, alpha: 1 }).rect(-42, -74, 84, 14).rect(-32, -86, 64, 12).fill({ color: accent, alpha: 0.92 });
  } else if (/书|日记/.test(label)) {
    prop.rect(-26, -50, 52, 42).fill({ color: accent, alpha: 0.9 }).rect(-20, -44, 40, 5).rect(-20, -32, 26, 4).fill({ color: 0xf0e4cb, alpha: 0.75 });
  } else if (/花|植物|叶/.test(label)) {
    prop.rect(-4, -58, 8, 58).fill({ color: 0x486f4e, alpha: 1 }).rect(-26, -78, 22, 22).rect(4, -88, 26, 26).rect(-12, -102, 24, 24).fill({ color: accent, alpha: 0.9 });
  } else if (/灯|光|星/.test(label)) {
    prop.rect(-5, -64, 10, 64).fill({ color: body, alpha: 1 }).rect(-22, -84, 44, 28).fill({ color: accent, alpha: 0.92 });
  } else {
    prop.rect(-30, -48, 60, 48).fill({ color: 0x735947, alpha: 1 }).rect(-18, -60, 36, 14).stroke({ color: accent, width: 5, alpha: 0.85 }).rect(-8, -28, 16, 8).fill({ color: accent, alpha: 0.72 });
  }
  view.addChild(prop);
  return view;
}

function gradientTexture(width: number, height: number, top: string, bottom: string, seedText: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1920, Math.ceil(width));
  canvas.height = Math.min(1080, Math.ceil(height));
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(hashNumber(seedText));
  for (let index = 0; index < 260; index++) {
    context.fillStyle = index % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.018)';
    const size = 2 + Math.floor(random() * 4);
    context.fillRect(Math.floor(random() * canvas.width / 4) * 4, Math.floor(random() * canvas.height / 4) * 4, size, size);
  }
  return Texture.from(canvas);
}

function paperOverlayTexture(
  width: number,
  height: number,
  seedText: string,
  texture: MemorySceneBlueprint['visual']['paperTexture']
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const context = canvas.getContext('2d')!;
  const random = seededRandom(hashNumber(`${seedText}:${texture}`));
  const count = texture === 'fiber' ? 180 : texture === 'wash' ? 80 : 130;
  for (let index = 0; index < count; index++) {
    const alpha = 0.015 + random() * 0.025;
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    const size = texture === 'wash' ? 12 : 3;
    context.fillRect(Math.floor(random() * canvas.width / size) * size, Math.floor(random() * canvas.height / size) * size, size, size);
  }
  return Texture.from(canvas);
}

function vignetteTextureFor(width: number, height: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, Math.max(width, height) * 0.72);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.72, 'rgba(0,0,0,0.07)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  return Texture.from(canvas);
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hex(value: string): number { return Number.parseInt(value.replace('#', ''), 16); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function hashNumber(value: string) { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash; }
