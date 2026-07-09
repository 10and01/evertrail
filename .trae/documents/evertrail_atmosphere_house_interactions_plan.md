# Evertrail 氛围模式、小屋系统与环境交互实现计划

## 1. 摘要

本计划将 Evertrail 从“情绪探索 + 轻战斗”彻底转向纯氛围探索体验：移除敌人、BOSS、情绪风暴；新增友好动物、玩家小屋编辑、相框图片、传送门、摘花砍树与新材料合成；并把记忆查看改为游戏内对话框，同时修复 Canvas UI 文字溢出问题。

## 2. 当前机制调查结果

### 2.1 技术栈与主循环

- **技术栈**：React 18 + Vite + TypeScript + TailwindCSS，本地存储使用 localforage。
- **游戏主循环**：[MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) 通过 `requestAnimationFrame` 驱动，高频状态保存在 ref 中避免 React 重渲染。
- **渲染管线**：[RenderPipeline.ts](file:///d:/Evertrail/src/lib/game/RenderPipeline.ts) 按顺序绘制：视差背景 → 装饰层 → 液体 → 前景瓦片 → 小屋 → 实体/NPC → 粒子 → 光照 → 后期处理 → UI。
- **世界生成**：[World.ts](file:///d:/Evertrail/src/lib/game/World.ts) 基于 Simplex Noise 与固定种子生成地表起伏、地下洞穴、水体、平台、天空岛、岩浆层、遗迹房间、植被装饰，并在最新节点附近生成玩家小屋。

### 2.2 用户记录输入如何生成世界

用户输入 → 日记条目 `JournalEntry` → `MapNode`（位置、生态、索引、种子）→ `generateWorld(entries, nodes)`：

1. `generateMapNodes(entries)`（[mapGenerator.ts](file:///d:/Evertrail/src/lib/mapGenerator.ts)）按日记顺序为每条记录生成节点：
   - `x = index * 160 + 120 + jitterX`（横向展开）。
   - `y = surfaceYAt(x)`（基于 Simplex Noise 的地表高度减 40）。
   - `biome = entry.mood`（joy / calm / sad / angry / tired / anxious）。
   - `seed = entry.id`。
2. `generateWorld(entries, nodes)`（[World.ts](file:///d:/Evertrail/src/lib/game/World.ts)）：
   - 按节点位置决定世界宽度 `minX` / `maxX` 与最近节点生态。
   - Simplex Noise 计算每列地表高度，分配地表/地下瓦片类型：joy/calm 为草地，sad 为泥，angry 为灰烬，tired 为沙，anxious 为菌丝。
   - 雕刻洞穴、生成平台、填充水体、生成天空岛与岩浆层。
   - 添加生态特殊瓦片：sad 的雨幕、angry 的脆岩。
   - `chooseDecoration` 按生态与随机种子生成植被/岩石（tree、flower、grass、rock、deadTree、cactus、mushroom、volcanic）。
3. 交互对象从 `JournalEntry` / `MapNode` 映射而来（[InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts)）：
   - `buildWaypoints`：每个节点生成一个路径点，记录激活状态。
   - `buildCollectibles`：将日记标签映射为收集物 kind（学习/反思/工作→书、运动/户外/挑战→足迹、家庭/朋友/爱情→心、旅行/冒险→星、美食→叶、创作→火焰；有图片则为 camera）。
   - `buildEchoes`：稀有或长文本日记生成 Echo 幻影，文本被拆成 2-3 句台词。
   - `buildSaveBenches` / `buildCraftingFurnaces`：按节点生成存档石与记忆熔炉。
   - `buildChapterGates`：章节起止节点生成 ChapterGate。
4. 敌人与 BOSS 相关代码已在上轮实现中移除；`atmosphereMode` 默认 `true`（[settings.ts](file:///d:/Evertrail/src/lib/settings.ts)）。

### 2.3 已实现的氛围相关系统

| 系统 | 状态 | 关键文件 |
|---|---|---|
| 氛围模式开关 | 默认开启 | [settings.ts](file:///d:/Evertrail/src/lib/settings.ts) |
| 敌人/BOSS/风暴移除 | 已清理 | [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)、[PostProcessor.ts](file:///d:/Evertrail/src/lib/game/PostProcessor.ts)、[tools.ts](file:///d:/Evertrail/src/lib/game/tools.ts) |
| 情绪工具 | 已实现 6 种 | [tools.ts](file:///d:/Evertrail/src/lib/game/tools.ts) |
| 友好动物类型与 AI | 已实现 | [Animal.ts](file:///d:/Evertrail/src/lib/game/Animal.ts)、[Entity.ts](file:///d:/Evertrail/src/lib/game/Entity.ts) |
| 动物接入主循环 | **进行中**：MapCanvas 已导入 `buildAnimals` / `updateAnimals` / `AnimalEntity`，但主循环更新/渲染需确认完整 | [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) |
| 玩家小屋数据与渲染 | 已生成、可保存/加载、可绘制结构与装饰 | [World.ts](file:///d:/Evertrail/src/lib/game/World.ts)、[HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)、[storage.ts](file:///d:/Evertrail/src/lib/storage.ts) |
| 小屋编辑模式 | **未实现交互逻辑**：仅声明了 state/ref | [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) |
| 相框图片 | `HouseDecoration.imageUrl` 字段存在，渲染已支持，但无选择/上传 UI | [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)、[types/game.ts](file:///d:/Evertrail/src/types/game.ts) |
| 传送门 | `HousePortal` 类型存在并渲染，但无传送交互 | [types/game.ts](file:///d:/Evertrail/src/types/game.ts)、[HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts) |
| 摘花/砍树 | `PlantState` 类型与 `Collectible` 的 wood/petal/spore kind 已定义，实际交互未实现 | [types/game.ts](file:///d:/Evertrail/src/types/game.ts)、[tools.ts](file:///d:/Evertrail/src/lib/game/tools.ts) |
| 合成系统 | 11 个配方已实现，但无植物/木材相关配方 | [crafting.ts](file:///d:/Evertrail/src/lib/game/crafting.ts) |
| 记忆对话框 | 仅实现 Echo 幻影对话，未实现日记/路径点记忆对话框 | [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) |
| UI 文字换行 | 未实现 | [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)、[HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts) 等 |

### 2.4 关键缺失

1. 小屋编辑模式：没有完整 R 键切换、工具栏、网格点击替换瓦片/放置装饰的逻辑。
2. 相框挂图片：没有图片选择器 UI，没有选择日记图片或本地上传的流程。
3. 传送门：没有触发传送的交互，也没有选择目标位置的界面。
4. 摘花/砍树：没有检测装饰物、没有掉落 wood/petal/spore、没有生长/再生逻辑。
5. 新材料未接入合成系统。
6. UI 文字可能超出框外，需要自动换行。
7. 记忆（日记）目前通过外部回调 `onSelectEntry` 打开，需要改为游戏内对话框呈现。

## 3. 需求确认

根据用户反馈，最终需求如下：

1. **彻底移除情绪风暴和怪兽/BOSS**，专注氛围探索。
2. **引入友好动物**（兔子、鸟、鱼、蝴蝶、萤火虫），不同生态有不同动物。
3. **文字不能超出框外**，所有 UI 文本需要自动换行。
4. **记忆以游戏内对话框方式呈现**，而不是跳转到外部面板。
5. **用户有自己的房子**，可以改造结构与内饰，能以相框形式插入图片，通过传送门传送。
6. **更多环境交互**：摘花、砍树等，掉落材料并可用于合成。
7. 小屋传送门目标为**世界地图任意已探索位置**（简化为所有节点位置）。
8. 相框图片**支持日记图片和本地上传**两者。
9. 摘花/砍树材料**加入合成系统**。

## 4. 实现计划

### 4.1 彻底完成敌人/BOSS/情绪风暴移除并修复代码

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)
- [InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts)
- [index.ts](file:///d:/Evertrail/src/lib/game/index.ts)

**具体改动**：
1. 在 [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) 中删除所有对 `enemiesRef`、`bossProjectilesRef`、`stormMessageRef`、`stormResult`、`applyCalmToEnemies` 的引用。
2. 移除 `settings.atmosphereMode` 切换时的清空敌人逻辑（已无需）。
3. 移除 `handleCraft` 中 `calm-charm` 对 `applyCalmToEnemies` 的调用（已改为纯氛围粒子效果）。
4. 移除 drawUI 中 BOSS 投射物、风暴提示、风暴剩余时间绘制。
5. 在 [InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts) 中确认 `buildEnemies`、`buildChapterBosses` 已删除。
6. 在 [index.ts](file:///d:/Evertrail/src/lib/game/index.ts) 中确认 `EnemyAI` 与 `events` 未再导出，`AnimalEntity` 已导出。
7. 将 `MOOD_FORMS.calm.passiveDesc` 从“敌人侦测半径减半”改为“脚步更轻，不易惊扰生灵”等氛围描述。

### 4.2 将友好动物系统接入主循环

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)

**具体改动**：
1. 世界生成后调用 `buildAnimals(nodes, tiles)` 填充 `animalsRef.current`。
2. 每帧调用 `updateAnimals(animalsRef.current, playerRef.current, tilesRef.current, delta)`。
3. 将 `AnimalEntity` 实例加入 `entitiesRef.current` 列表，确保渲染。
4. 在 `drawUI` 中不显示动物血条/伤害信息，保持纯氛围。

### 4.3 小屋编辑模式

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)
- [World.ts](file:///d:/Evertrail/src/lib/game/World.ts)
- [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)

**具体改动**：
1. [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)：
   - 监听 `KeyR` 切换 `houseEditMode`，仅在 `isPlayerInsideHouse(player, houseRef.current)` 时允许切换。
   - 进入编辑模式时暂停玩家移动/重力（设置 `sittingRef` 类似标志或冻结 `updatePlayer`）。
   - 编辑模式下显示底部工具栏 UI（墙、地板、门、窗、删除、相框、椅子、桌子、灯、地毯、植物）。
   - 鼠标点击网格时，根据 `selectedHouseToolRef` 修改 `houseRef.current.floorPlan` 或 `decorations`。
   - 结构工具（wall/floor/door/window/empty）只能修改 `houseTile=true` 的瓦片；初始外墙/地板可覆盖为同类型或门窗，但不可删除为 empty。
   - 装饰工具（chair/table/lamp/rug/plant/picture-frame）在空格处放置，再次点击可移除。
   - 选择 picture-frame 时，记录 `pendingFramePosRef`，打开图片选择器。
   - 每次修改后调用 `applyHouseFloorPlan(houseRef.current, tilesRef.current)` 同步到世界瓦片。
   - 退出编辑模式时保存 `houseRef.current` 到存档。
2. [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)：
   - 编辑模式下绘制网格线、高亮鼠标悬停格子、半透明工具预览。

### 4.4 相框图片选择器

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)
- `src/components/PictureSelector.tsx`（新建）
- [storage.ts](file:///d:/Evertrail/src/lib/storage.ts)

**具体改动**：
1. 新建 `PictureSelector.tsx`：
   - 显示两栏：“来自日记”（遍历 `entries` 中 `image` 字段）和“本地上传”（`<input type="file" accept="image/*">`）。
   - 选择或上传后返回图片 URL（日记图片直接用 URL，本地图片用 FileReader 转 base64）。
2. [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)：
   - 当 `pendingFramePosRef` 不为空且 `pictureSelectorOpen=true` 时渲染 `PictureSelector`。
   - 确认后在 `houseRef.current.decorations` 添加/更新 `kind='picture-frame'` 的 `HouseDecoration`，设置 `imageUrl`。
3. [storage.ts](file:///d:/Evertrail/src/lib/storage.ts)：`GameSave.house` 已支持保存装饰数据，无需额外改动。

### 4.5 小屋传送门

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)
- [types/game.ts](file:///d:/Evertrail/src/types/game.ts)
- [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)

**具体改动**：
1. [types/game.ts](file:///d:/Evertrail/src/types/game.ts)：扩展 `HousePortal` 的目标坐标：
   ```ts
   export interface HousePortal {
     gx: number;
     gy: number;
     targetX?: number;
     targetY?: number;
   }
   ```
2. [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)：
   - 在交互检测中加入传送门：当玩家在小屋内且靠近 portal 网格时提示“按 E 打开传送门”。
   - 打开简化的世界地图选择界面（复用现有小地图渲染逻辑），只显示已探索区域（简化为所有节点位置）。
   - 选择目标后设置 `player.x/y` 到目标位置，并短暂播放粒子与音效。
   - 保存 `portal.targetX/targetY` 到存档。
3. [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)：已绘制传送门光效，无需大改。

### 4.6 摘花、砍树与环境交互

**涉及文件**：
- [World.ts](file:///d:/Evertrail/src/lib/game/World.ts)
- [tools.ts](file:///d:/Evertrail/src/lib/game/tools.ts)
- [InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts)
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)

**具体改动**：
1. [World.ts](file:///d:/Evertrail/src/lib/game/World.ts)：
   - 在 `chooseDecoration` 返回 tree/flower/mushroom 等装饰时，为对应瓦片设置 `plant` 字段：
     ```ts
     tile.plant = { kind: 'flower' | 'tree' | 'mushroom' | 'deadTree' | 'cactus', stage: 'full', growthTimer: 0 };
     ```
2. [tools.ts](file:///d:/Evertrail/src/lib/game/tools.ts)：
   - 扩展 `applyTool` 的植物交互：
     - joy 光镐 / tired 扎根杖可用于砍树（tree/deadTree/cactus），将其 stage 改为 'stump'，掉落 `wood`。
     - sad 雨铲 / calm 安抚杖可摘花（flower/mushroom），将其 stage 改为 'seed'，掉落 `petal`/`spore`。
   - 新增 `canHarvestPlant` 和 `harvestPlant` 辅助函数。
3. [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)：
   - 当玩家靠近有 `plant` 且 stage='full' 的瓦片时提示“按 E 摘花/砍树”。
   - 按 E 执行收获，与工具逻辑共用同一函数。
4. [InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts)：
   - 扩展 `labels` 字典支持 wood/petal/spore 的中文标签。

### 4.7 新材料与合成配方

**涉及文件**：
- [crafting.ts](file:///d:/Evertrail/src/lib/game/crafting.ts)
- [types/game.ts](file:///d:/Evertrail/src/types/game.ts)
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)

**具体改动**：
1. [crafting.ts](file:///d:/Evertrail/src/lib/game/crafting.ts)：
   - `countInventoryByKind` 补齐 wood/petal/spore 计数。
   - 新增配方：
     - 木椅：`{ wood: 2 }` → 放置装饰
     - 木桌：`{ wood: 3 }` → 放置装饰
     - 花盆：`{ wood: 1, petal: 1 }` → 放置装饰
     - 萤火灯：`{ spore: 2, wood: 1 }` → 扩大光源
     - 花环：`{ petal: 3 }` → 装饰/小幅恢复光芒
2. 小屋编辑模式下，只有已合成对应装饰配方才能在屋内放置该装饰（或免费放置基础装饰，高级装饰需配方）。

### 4.8 UI 文字自动换行

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)（drawUI 中的提示框、对话、叙事消息）
- [HouseRenderer.ts](file:///d:/Evertrail/src/lib/game/HouseRenderer.ts)（相框默认文字）
- [InteractiveObjects.ts](file:///d:/Evertrail/src/lib/game/InteractiveObjects.ts)（物品标签）

**具体改动**：
1. 在 `drawUI` 中，所有 `fillText` 调用前使用 `wrapText(ctx, text, x, y, maxWidth, lineHeight)` 辅助函数自动换行。
2. 对话框高度根据文本行数动态计算，而不是固定 90px。
3. 相框“照片”文字和物品标签也做边界检查。

### 4.9 记忆以对话框方式呈现

**涉及文件**：
- [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx)

**具体改动**：
1. 在 [MapCanvas.tsx](file:///d:/Evertrail/src/components/MapCanvas.tsx) 的交互逻辑中，点击 waypoint 时：
   - 如果未激活则激活并恢复光芒（保持现有逻辑）。
   - 打开 `memoryDialogRef`，显示日记日期、心情、标签、文本、图片（如果有）。
2. 绘制记忆对话框：
   - 屏幕中央半透明面板，顶部显示日期与心情图标。
   - 正文自动换行，底部显示“按 E / Enter / 点击 关闭”。
   - 若日记有图片，在对话框内显示缩略图。
3. 记忆对话框打开时暂停玩家移动与游戏逻辑（类似 Echo 对话）。
4. 关闭对话框时才调用 `onSelectEntry(entry)`，让外部应用仍有机会记录/高亮该条目。

## 5. 数据流与交互流程

### 5.1 小屋编辑流程

```
玩家进入小屋 → 按 R → 进入 houseEditMode
              ↓
显示底部工具栏（墙/地板/门/窗/删除/装饰/相框）
              ↓
鼠标点击屋内网格 → 更新 house.floorPlan / decorations
              ↓
调用 applyHouseFloorPlan 同步 tiles
              ↓
按 R 或 Esc 退出 → 调用 saveGame({..., house: houseRef.current})
```

### 5.2 传送门流程

```
玩家在小屋内靠近 portal → 提示“按 E 打开传送门”
              ↓
按 E → 打开世界地图选择（显示已探索节点）
              ↓
选择目标 → 播放粒子 → setPlayerPosition → 关闭地图
              ↓
保存 portal.targetX/targetY
```

### 5.3 摘花/砍树流程

```
玩家靠近带 plant 的瓦片 → 提示“按 E 摘花/砍树”
              ↓
按 E 或使用工具 → plant.stage 变为 'stump'/'seed'
              ↓
掉落对应 Collectible（wood/petal/spore）
              ↓
经过一段时间或离开区域后，plant.stage 恢复为 'full'
```

## 6. 假设与决策

1. **彻底删除敌人**：默认 `atmosphereMode = true`，并且从代码中移除敌人/BOSS/风暴生成逻辑，不再作为可开关功能。
2. **动物为纯氛围**：动物无伤害、无掉落，仅用于增加生机。
3. **小屋传送门目标**：世界地图任意已探索位置。实现上简化为“所有节点位置”，不引入迷雾系统。
4. **相框图片来源**：同时支持日记图片和本地上传；本地图片使用 base64 存入存档。
5. **材料用于合成**：新增以小屋装饰和氛围道具为主的配方。
6. **记忆对话框**：游戏内显示日记全文，关闭后再回调外部面板。
7. **文字换行**：优先处理 Canvas 内绘制的提示、对话、消息框。

## 7. 验证步骤

1. **类型检查**：`npm run check`（或 `tsc --noEmit`）无错误。
2. **Lint**：`npm run lint` 无错误。
3. **功能验证**：
   - 进入游戏无敌人/BOSS/风暴生成。
   - 世界中有动物在移动。
   - 玩家可进入小屋，按 R 进入编辑模式，修改墙壁/地板/门窗，放置桌椅/灯具/地毯/植物/相框。
   - 相框可从日记图片选择或本地上传。
   - 靠近传送门按 E 可打开地图并传送。
   - 靠近花/树按 E 可收获，掉落花瓣/木材/孢子。
   - 新材料可合成木椅/木桌/花盆/萤火灯/花环。
   - 点击路径点以对话框显示记忆，文字不超出框外。
4. **存档验证**：重新加载后小屋结构、装饰、传送门目标、背包材料均正确恢复。
