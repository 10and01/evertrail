---
name: "pixel-game-dev"
description: "Guides pixel-art game development using lessons from the Evertrail project. Invoke when building 2D pixel games, procedural terrain, lighting, player movement, camera, or interactive scenes."
---

# Pixel Game Development Guide

This skill encapsulates engineering conventions, hard constraints, and lessons learned from building Evertrail, a Terraria-like pixel-art exploration game. Use it to avoid common pitfalls and maintain consistency when developing similar games.

## Core Development Principles

- Atmosphere over combat: prioritize world mood, environmental storytelling, and player customization.
- Align world coordinates to the `TILE_SIZE` grid to prevent collision and rendering bugs.
- Use `requestAnimationFrame` for the core game loop; avoid stale closures by using refs for stateful dependencies.
- Render with canvas-based pipelines; use multiply blending for dynamic lighting.

## Player Controls & Camera

- Movement: A/D for left/right; Space/W for jump.
- Interaction: E or Enter for map elements (waypoints, collectibles, doors, furniture); Space must not trigger interactions.
- In interior/hut scenes: restrict movement to horizontal (A/D) only; disable jumping.
- Camera: support manual drag; automatically resume following the player after drag ends.
- Validate camera coordinates with `Number.isFinite()` before passing to `createRadialGradient` to prevent runtime errors.

## World Generation

- Use Simplex Noise for procedural terrain generation.
- Design mood-based biomes (6+ types) with distinct palettes and decorative props.
- Non-regenerative resources: when trees/plants are harvested, clear `tile.plant`/`tile.decoration` and convert to gap; call `rebuildEntities()` to remove render entities.

## Interaction Design

- Harvesting plants uses the E key.
- Mood-based tools use the T key exclusively; do not bind T to harvesting.
- Interactive objects (doors, windows, chairs, bookshelves, ladders, murals) trigger on E key press.
- Provide visual feedback: doors open/close, windows show night light/reflection, chairs show rest aura.

## Rendering & Visibility

- Apply dark outlines and scale animals 1.2x for visibility in complex terrain.
- Use multiply blending for dynamic lights (lanterns, portals, player rim light).
- Add ceiling gradients, wall/floor pixel noise, and furniture shadows for atmospheric interiors.
- Keep UI panels rounded, semi-transparent, and pixel-styled.

## Scene-Specific Rules (Huts)

- Remove parallax/background in hut scenes.
- Initialize huts with an outer ring wall, bottom floor, and neatly arranged furniture against walls/floor.
- Include interactive elements: door, window, chair, bookshelf, ladder, workbench, photo frame, mural.
- Murals should be viewable (zoom/detail interaction).

## Common Pitfalls & Fixes

- **Non-finite camera coordinates** cause `createRadialGradient` errors; add `Number.isFinite` validation.
- **Game loop closures** with state variables cause stale state; use refs for `gamePaused` and similar dependencies.
- **Tool key conflicts**: separate harvesting (E) from mood tools (T) to prevent accidental triggers.

## When to Apply

Use this skill when:

- Starting a new 2D pixel-art game project.
- Implementing player movement, camera, or tile-based collision.
- Adding procedural terrain or biome systems.
- Building lighting, interiors, or interactive object systems.
- Debugging canvas rendering, animation loops, or input handling in pixel games.
