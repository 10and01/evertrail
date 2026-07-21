# 架构与数据流

## 应用层

- React Router 管理“今天、旅程、故事工坊、展厅、成长、设置”。
- Zustand 管理可编辑领域状态。
- Canvas 游戏运行时负责世界、角色、实体、光照、粒子和独立记忆场景。
- localForage/IndexedDB 保存版本化状态、游戏进度和设置。

## 领域边界

- `JournalEntry`：私人来源记录，包含公开级别和叙事信号。
- `ThemeProfile`：用户选择的视角、色板、节奏、角色风格和偏好意象。
- `StoryProject` / `StoryScene`：故事工坊中的显式编辑结果。
- `WorldDelta`：挖掘、采集和植物变化等不可重算的世界修改。
- `EvertrailStoryPackageV1`：只读的离线公开作品格式。

派生地图、属性和自动章节可以从记录重新计算；用户编辑、世界差量和作品编排必须持久化。
