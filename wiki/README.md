# Evertrail Wiki

Evertrail 是一款本地优先的叙事创作游戏：用户在私密记录室保存生活片段，在旅程世界中发现由这些片段生成的情绪景观，再在故事工坊中选择、编排并导出可以离线分享的互动作品。

## 快速阅读

1. [产品与核心循环](./01-product-and-core-loop.md)
2. [架构与数据流](./02-architecture-and-data-flow.md)
3. [功能地图](./03-feature-map.md)
4. [游戏系统](./04-game-systems.md)
5. [视觉与交互](./05-visual-and-interaction.md)
6. [存储、导出与隐私](./06-storage-export-privacy.md)
7. [问题审查与技术债](./07-audit-and-debt.md)
8. [重设计蓝图](./08-redesign-blueprint.md)

## 系统全景

```mermaid
flowchart LR
  A[私密记录室] --> B[叙事信号]
  B --> C[旅程世界]
  B --> D[章节与意象]
  C --> E[个人展厅]
  D --> F[故事工坊]
  E --> F
  F --> G[隐私预览]
  G --> H[Evertrail Story Package v1]
```

核心原则：原始记录默认私密；派生内容可重算；用户编辑优先；分享必须显式选择；游戏化服务于表达，不制造连续打卡压力。
