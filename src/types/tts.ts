export interface AzureVoiceStyle {
  name: string
  displayName: string
  description?: string
}

export interface AzureVoiceRole {
  name: string
  displayName: string
}

export interface VoiceMetadata {
  name: string // 比如 "zh-CN-XiaoxiaoNeural"
  displayName: string // 比如 "晓晓"
  localName: string
  locale: string // 比如 "zh-CN"
  localeName: string // 比如 "中文 (普通话，简体)"
  gender: 'Female' | 'Male' | 'Neutral'
  voiceType: string // "Neural"
  styleList?: string[]
  rolePlayList?: string[]
  sampleRateHertz?: string
  status?: string
  wordsPerMinute?: string
  // 扩展展示属性
  categories?: string[] // 如 ["新闻", "有声书", "助手"]
  description?: string
  avatarColor?: string
}

export interface SynthesisSettings {
  rate: number // -100 to 100, default 0 (0% change)
  pitch: number // -50 to 50, default 0 (0% change)
  volume: number // 0 to 100, default 100 (100% volume)
  style: string // style name or ""
  styleDegree: number // 0.5 to 2.0, default 1.0
  role: string // role name or ""
  audioOutputFormat: string // e.g. "audio-24khz-48kbitrate-mono-mp3"
}

export interface HistoryItem {
  id: string
  timestamp: number
  text: string
  ssml: string
  voiceName: string
  voiceDisplayName: string
  locale: string
  style?: string
  styleDegree?: number
  role?: string
  charCount: number
  audioUrl?: string
  audioBlob?: Blob
  audioFormat: 'mp3' | 'wav'
  duration?: number
}

export interface MonthlyQuotaUsage {
  monthKey: string // "YYYY-MM"
  usedChars: number
  quotaLimit: number // 500,000
  historyCount: number
  lastUpdated: number
}

// ==============================
// AI 导演 / 剧本分镜 / 段落结构定义
// ==============================

export interface OpenAiConfig {
  baseUrl: string // e.g. "https://api.openai.com/v1" or "https://api.deepseek.com/v1"
  apiKey: string
  model: string // e.g. "gpt-4o", "deepseek-chat"
}

export interface ScriptDialogueSegment {
  id: string
  character: string // 角色名字/称谓，如 "旁白", "张三", "李四", "Nancy"
  voiceName: string // Azure 音色名，如 "zh-CN-YunxiNeural"
  voiceDisplayName: string // 友好展示名，如 "云希"
  style?: string // 情感风格，如 "angry", "fearful", "cheerful"
  styleDegree?: number // 风格强度 0.5 - 2.0，默认 1.0
  role?: string // 角色扮演，如 "YoungAdultMale"
  text: string // 该句具体台词/旁白内容
  // 试听状态缓存
  audioUrl?: string
  audioBlob?: Blob
  isPlaying?: boolean
  isSynthesizing?: boolean
}

