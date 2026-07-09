# Evertrail 音频包使用说明

## 频谱分析与当前调整

当前背景氛围使用纯振荡器生成和弦，经分析高频能量集中在：

- 和弦最高泛音（约 500Hz~1kHz）
- `filterFreq` 截止频率（原最高 2500Hz）
- 音效低通截止（原 5200Hz）

已做如下优化：

1. **和弦减音**：每个生态和弦从 4 音减为 3 音，移除最高泛音。
2. **降低低通截止**：背景 `filterFreq` 整体下调 25%~35%，并新增 1800Hz 氛围总线低通。
3. **音效低通**：从 5200Hz 降至 3800Hz，削弱刺耳高频。
4. **降低触发频率**：`tempo` 降低约 15%，减少听觉疲劳。
5. **实时频谱分析**：新增 `AnalyserNode`，可通过 `AudioManager.getFrequencyData()` 读取。

## 音频包目录结构

```
public/audio/
├── nature/
│   ├── joy.mp3
│   ├── calm.mp3
│   ├── sad.mp3
│   ├── angry.mp3
│   ├── tired.mp3
│   └── anxious.mp3
├── lofi/
│   ├── joy.mp3 ...
└── piano/
    ├── joy.mp3 ...
```

文件缺失时会自动回退到程序化合成器。

## 三套备选方案

### 1. 自然声景（nature）

- 风格：雨声、风声、森林鸟鸣、溪流
- 推荐来源：
  - Freesound 搜索关键词：`ambient rain loop`, `forest ambience`, `wind low frequency`
  - 可筛选 License：`CC0` 或 `CC-BY`
- 适用：强调沉浸、冥想式探索

### 2. 轻缓 Lo-Fi（lofi）

- 风格：柔和节拍、钢琴循环、白噪声底
- 推荐来源：
  - OpenGameArt: https://opengameart.org 搜索 `lofi ambient loop`
  - FreePD: https://freepd.com 搜索 `calm`, `ambient`
- 适用：长时间游玩、降低焦虑感

### 3. 钢琴弦乐（piano）

- 风格：叙事钢琴、铺底弦乐、情感化
- 推荐来源：
  - Freesound 搜索关键词：`piano ambient loop`, `cinematic pad`
  - MusOpen: https://musopen.org 搜索 `ambient piano`
- 适用：章节回忆、情绪化场景

## 授权注意事项

- 使用 Freesound 资源时，请查看文件页面的 License；CC-BY 需在游戏内或 README 中署名。
- 建议优先使用 CC0 资源，省去署名流程。
- 本说明本身不提供音频文件，仅作路径与授权指引。
