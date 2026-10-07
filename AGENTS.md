# AGENTS.md - 开发者与二次开发全景指南

本文档面向后续接手本项目进行二次开发、功能拓展或通过 AI Agent 协作维护的开发者。全面解析系统核心业务链路、数据流走向、架构约束与关键扩展点。

---

## 1. 架构核心原则与设计模式

1. **防幻觉设计 (Zero-Hallucination TTS Prompting)**：
   - AI 大模型绝对不能随意臆造发音人和情感风格。
   - 所有送入大模型分析的 System Prompt，都必须通过 `candidateVoices` 注入严格的音色与风格真实能力白名单（`supportedStyles`），模型只能在该子集内选点。
2. **离线优先与数据双轨落地 (Dual-track Persistence)**：
   - 严禁将核心凭据、字数用量和配置只保存在浏览器内存或易失的 Cookie/localStorage 中。
   - 所有的配置与历史记录统一通过 `/api/local-store` 同步至本地磁盘文件 `data/app_storage.json`。
   - 所有的合成音频 Blob 通过 `src/services/indexedDBService.ts` 沉淀至浏览器/桌面端底层的 `IndexedDB`，保证断网秒级回放，避免重复请求云端。
3. **真实对齐 Azure 官方计费 (Billable Characters)**：
   - 不按普通纯汉字长度计费。
   - 必须使用 `src/utils/ssml.ts` 中的 `calculateAzureBillableCharacters` 计算扣额：
     1. 中日韩汉字（CJK）必须按 **2 个字符** 计算；
     2. 排除外层 `<speak>` 与 `<voice>`，但内部所有的调节标签（`<mstts:express-as>`、`<prosody>` 及属性、标点、空格）必须全额计费。

---

## 2. 状态机与核心数据流图

```text
[用户输入小说/剧本]
        │
        ├── 点击【立即生成语音】 ──> generateSSML() ──> AzureSpeechService.synthesizeSSML() ──> IndexedDB 存储音频 ──> 主播放器
        │
        └── 点击【AI 智能剧本分镜】
                 │
                 ├── 过滤候选多情感音色池 (中文48个 / 英文37个 / 用户收藏)
                 ├── 组装结构化能力清单注入 OpenAiDirectorService
                 └── 大模型返回标准化 JSON 分镜数组: ScriptDialogueSegment[]
                             │
                             ├── 进入 SegmentsViewer 可视化剧本分镜工作台
                             ├── 单句试听: synthesizeSingleSegment() (精确扣减单句额度)
                             ├── 演员表映射: updateCharacterVoice() (全篇统一替换音色)
                             └── 满意后点击【立即生成语音】 ──> buildSsmlFromSegments() ──> 全剧一键合成
```

---

## 3. 核心文件与模块职责清单

| 模块路径 | 职责定位 | 关键导出方法 / 状态 |
| :--- | :--- | :--- |
| `src/stores/ttsStore.ts` | 全局核心状态总线 | `azureKey`, `openAiConfig`, `scriptSegments`, `historyList`, `quotaUsage`, `synthesize()`, `playHistoryItemAudio()`, `synthesizeSingleSegment()` |
| `src/services/azureSpeech.ts` | 微软官方 Speech SDK 封装 | `testConnection()`, `fetchRemoteVoices()`, `synthesizeSSML()` |
| `src/services/openAiService.ts` | OpenAI 兼容格式大模型服务 | `testConnection()`, `parseScriptToSegments()` |
| `src/services/indexedDBService.ts` | 本地音频二进制存储引擎 | `saveAudioBlobToIndexedDB()`, `getAudioBlobFromIndexedDB()`, `deleteAudioBlobFromIndexedDB()` |
| `src/services/storageService.ts` | 本地文件读写客户端通道 | `fetchLocalFileStorage()`, `saveLocalFileStorage()`, `fetchCachedVoices()`, `saveCachedVoices()` |
| `src/utils/ssml.ts` | SSML 生成与计费解析工具 | `generateSSML()`, `buildSsmlFromSegments()`, `calculateAzureBillableCharacters()` |
| `src/components/SegmentsViewer.vue` | 剧本分镜卡片流与演员表替换 | `uniqueCharacters`, `updateCharacterVoice()`, `handleListenSingle()` |
| `server.js` | 生产与便携包轻量本地服务引擎 | 独立 HTTP 服务，托管前端并提供 `/api/local-store` 与 `/api/voices-cache` |
| `pack-portable.js` | 绿色便携包一键装配工具 | 自动组合 Node 引擎、前端构建与本地持久化模板 |

---

## 4. 关键二次开发指引与扩展点

### 4.1 接入新的大模型或微调 Prompt
- 核心文件位于：`src/services/openAiService.ts`。
- 修改 `systemPrompt` 即可扩展剧本分析能力（例如支持对话停顿 `<break time="500ms"/>` 的自动生成，或支持环境音效打标）。
- 如需更改默认模型，可在 `src/stores/ttsStore.ts` 中的 `openAiConfig` 初始状态中修改。

### 4.2 扩展分镜卡片属性（如每句独立调节语速/停顿）
1. 在 `src/types/tts.ts` 的 `ScriptDialogueSegment` 接口中添加新属性（如 `rate?: number`、`pauseMs?: number`）。
2. 在 `src/components/SegmentsViewer.vue` 中添加对应的 UI 调节组件。
3. 在 `src/utils/ssml.ts` 的 `buildSsmlFromSegments` 和 `ttsStore.synthesizeSingleSegment` 中将该属性解析进 SSML。

### 4.3 批量导出音频片段（切片导出）
当前系统支持整段音频导出。如果需要将每个角色的台词单独导出为带编号的音频文件（如 `01_旁白.mp3`、`02_李明.mp3`）：
- 可在 `SegmentsViewer.vue` 中通过 `ttsStore.synthesizeSingleSegment` 循环批量执行，并将各段从 `IndexedDB` 提取打包为 `.zip`（可引入 `jszip` 库）。

### 4.4 生产打包与一键便携分发
- 项目已配置绿色便携包一键装配：`pnpm run pack:portable`
  - 自动编译最新前端并生成 `portable-dist/` 独立免安装包；
  - 自动压缩归档生成 `release/AzureSpeechStudio-Portable-Green.zip`（约 33MB），解压到任何 Windows 电脑双击 `一键启动.bat` 即可直接使用。

---

## 5. 开发调试规范与注意事项
1. **端口冲突处理**：
   - 生产/桌面内置服务端口为 `5273`；
   - Vite 开发端口为 `5173`。
2. **严格类型检查**：
   - 每次提交代码或打包前必须运行 `pnpm run build`，确保 `vue-tsc` 与 Vite 严格通过。
3. **敏感信息保护**：
   - 用户的 Azure 密钥和 AI 模型密钥仅存储在本地 `data/app_storage.json` 中，提交 Git 时建议确保 `data/` 已列入 `.gitignore`（保留空模板即可）。
