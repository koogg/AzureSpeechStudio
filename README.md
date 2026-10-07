# Azure Speech Studio 现代语音合成与 AI 导演工作台

基于 **Vue 3.5 + TypeScript 5.9 + Vite 6.4 + Element Plus 2.14 + Pinia 3.0 + microsoft-cognitiveservices-speech-sdk 1.52** 构建的高性能现代神经文本转语音（TTS）工作台。
交互界面参考微软官方 **Azure Speech Studio Voice Gallery** 风格设计，并集成了**兼容 OpenAI 协议的大模型（AI 导演）**，实现剧本多角色自动分镜、情感风格与强度自动打标、单句试听与整剧合成。

---

## 🌟 核心特性与功能架构

### 1. 微软官方级多情感音色库 (Voice Gallery)
- **869 个全量官方云端音色**：支持在线全量同步与本地离线持久化加载。
- **48 个中文多情感风格音色 & 37 个英文多情感风格音色**：覆盖 `zh-CN`（晓晓、云希、云健、晓伊、晓涵等）与 `en-US`（Jenny、Guy 等）。
- **多维度筛选**：按语言、性别（男声/女声）、仅看多风格（✨）、关键词实时搜索。
- **音色星标收藏**：支持一键收藏常驻音色，提供“我的收藏”快捷筛选。

### 2. 韵律微调与 SSML 引擎 (Tuning & SSML)
- **情感风格 (Style)**：支持切换开心、愤怒、严肃、恐惧、舒缓叙述、低语、纪录片、体育解说等丰富风格。
- **风格强度 (styledegree)**：支持从 `0.5x` 到 `2.0x` 连续微调，放大或克制情绪张力。
- **角色扮演 (Role-play)**：支持切换男孩、女孩、年轻男性、年长女性等角色人设。
- **韵律微调 (Prosody)**：语速（Rate: -50% ~ +100%）、音调（Pitch: -50% ~ +50%）、音量（Volume: 0 ~ 100%）。
- **原始 SSML 调试器**：可实时查看、直接修改或手动编写微软多发音人 XML 标记语言。

### 3. 🪄 AI 导演：智能剧本分镜与多角色配音
- **OpenAI 兼容模型直连**：支持直连 OpenAI（默认 `GPT-6.1 Sol`）、DeepSeek（默认 `deepseek-flash`）、Kimi、通义千问或本地 Ollama 等。
- **剧情动作与台词精准剥离**：AI 自动将“李明冷冷地举起手电筒，压低嗓音呵斥道：”归为旁白，将“闭嘴！别出声，把灯熄灭！”归为人物台词，严禁旁白混杂。
- **相邻旁白智能合并**：强约束禁止切碎环境与动作描写，合并为连续自然的分镜。
- **双语自适应音色池**：自动识别中/英文小说，中文剧本 100% 锁定中文音色，英文剧本 100% 锁定英文音色，杜绝串音与音色幻觉。
- **精准情感风格与强度标记**：根据台词潜台词为呵斥/命令打标 `angry`/`serious` (1.3x~1.5x)，为恐惧哀求打标 `fearful` (1.2x)。
- **🎭 角色配音一键替换（演员表映射）**：扫描整部剧本角色台词量，一键批量替换某角色全篇音色，杜绝同一人声线不一致。
- **单句独立试听（精准控本）**：每句分镜配备独立试听按钮，满意后再一键整篇合成，严防浪费 50 万字符免费额度。

### 4. 真实对齐微软计费看板 (500,000 字符/月)
- **严格遵循官方计费规则**：
  1. 中日韩汉字（CJK）在 Azure 官方按 **2 个字符** 计费；
  2. 情感与调节标签（`<mstts:express-as>`、`<prosody>`）全额计入；
  3. 过滤最外层 `<speak>`、`<voice>` 标签。
- **环形进度看板**：实时计算当月用量与剩余额度，超过 90% 触发预警，跨月自动归零重置。
- **一键校准云端用量**：支持直接输入 Azure Portal 监控指标查看到的数值进行基准校准。

### 5. 双轨本地持久化架构（防缓存误清）
- **配置文件与剧本记录**：全部持久化写入本地磁盘文件 `data/app_storage.json`。
- **音色库全量缓存**：写入本地磁盘文件 `data/azure_voices_cache.json`，刷新页面或重启即刻秒开。
- **合成音频二进制数据**：保存在浏览器/客户端底层的 `IndexedDB (azure_tts_db)` 中，历史音频断网亦可秒级回放，支持一键下载 `.mp3` 与 `.wav` 无损格式。

---

## 💻 本地运行与开发

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动浏览器 Web 开发模式
```bash
pnpm run dev
```
浏览器访问：`http://localhost:5173/`

### 3. 生成绿色免安装便携包
```bash
pnpm run pack:portable
```
执行后将自动生成：
- `portable-dist/` 独立免安装文件夹（内嵌轻量 Node.js、静态前端与服务，双击 `一键启动.bat` 运行）；
- `release/AzureSpeechStudio-Portable-Green.zip`（仅约 33MB 便携压缩包，解压后拷贝至任意电脑双击即用）。

### 4. GitHub 自动构建 Releases
项目已内置 GitHub Actions 工作流（`.github/workflows/release.yml`）：
- **自动触发**：推送版本 Tag（例如 `git tag v1.0.0 && git push origin v1.0.0`），云端自动编译并发布至 Releases；
- **手动触发**：在 GitHub 仓库页面打开 **Actions** -> 选择 **Release Build** -> 点击 **Run workflow** 即可在线一键打包出最新的 Release 资产。

---

## 📂 项目结构概览

```text
├── data/                               # 本地磁盘数据持久化目录
│   ├── app_storage.json                # 凭据、用量、收藏、设置及历史
│   └── azure_voices_cache.json         # 官方 869 个全量音色缓存
├── portable-dist/                      # 一键便携绿色分发目录（内嵌运行引擎与数据）
│   ├── 一键启动.bat                     # 便携运行脚本
│   ├── bin/node.exe                    # 内置轻量运行引擎
│   ├── server.js                       # 独立本地服务
│   ├── dist/                           # 前端编译包
│   └── data/                           # 便携数据
├── release/                            # 最终压缩归档包发布目录
├── src/
│   ├── components/
│   │   ├── HeaderBar.vue               # 顶栏、用量胶囊、凭据与 AI 模型配置弹窗
│   │   ├── VoiceGallery.vue            # 音色与风格库：筛选、搜索、星标收藏
│   │   ├── VoiceDetailSettings.vue     # 当前音色精细调音、风格网格、风格强度
│   │   ├── EditorConsole.vue           # 核心编辑区、多模式切换、播放控制台
│   │   ├── SegmentsViewer.vue          # 可视化剧本分镜列表、单句试听、演员表一键替换
│   │   ├── AiDirectorModal.vue         # AI 导演剧本输入与分析弹窗
│   │   ├── AudioPlayer.vue             # 高质感音频播放器、进度条拖拽、音量倍速
│   │   ├── HistoryModal.vue            # 最近合成历史对话框
│   │   └── QuotaModal.vue              # 50万字符配额看板与云端校准
│   ├── services/
│   │   ├── azureSpeech.ts              # Azure Speech SDK 封装
│   │   ├── openAiService.ts            # OpenAI 兼容模型 AI 导演服务
│   │   ├── indexedDBService.ts         # 本地音频二进制 IndexedDB 引擎
│   │   └── storageService.ts           # 本地文件读写客户端
│   ├── stores/
│   │   └── ttsStore.ts                 # Pinia 核心状态管理与数据总线
│   ├── utils/
│   │   └── ssml.ts                     # SSML 构造与微软官方计费算法
│   ├── App.vue                         # 顶层工作台布局
│   └── main.ts
├── vite.config.ts                      # Vite 构建与本地服务插件配置
├── vite-plugin-local-store.ts          # 开发环境本地文件读写中间件
├── pack-portable.js                    # 便携包自动组装工具
├── server.js                           # 生产环境本地服务引擎
└── package.json
```
