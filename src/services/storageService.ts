import type { VoiceMetadata } from '../types/tts'

export interface StorageData {
  azureKey?: string
  azureRegion?: string
  openAiConfig?: {
    baseUrl: string
    apiKey: string
    model: string
  }
  quotaUsage?: any
  favoriteVoiceNames?: string[]
  currentVoiceName?: string
  settings?: any
  historyList?: any[]
  inputText?: string
}

let syncTimeout: any = null

export async function fetchLocalFileStorage(): Promise<StorageData> {
  try {
    const res = await fetch('/api/local-store')
    if (res.ok) {
      const data = await res.json()
      return data || {}
    }
  } catch (e) {
    console.warn('[Storage] 获取本地持久化文件失败，降级读取 localStorage', e)
  }
  const fallback: StorageData = {}
  try {
    fallback.azureKey = localStorage.getItem('azure_tts_key') || ''
    fallback.azureRegion = localStorage.getItem('azure_tts_region') || 'eastasia'
    const quota = localStorage.getItem('azure_tts_quota_usage')
    if (quota) fallback.quotaUsage = JSON.parse(quota)
    const favs = localStorage.getItem('azure_tts_favorites')
    if (favs) fallback.favoriteVoiceNames = JSON.parse(favs)
  } catch (e) {}
  return fallback
}

export function saveLocalFileStorage(data: StorageData): void {
  try {
    if (data.azureKey !== undefined) localStorage.setItem('azure_tts_key', data.azureKey)
    if (data.azureRegion !== undefined) localStorage.setItem('azure_tts_region', data.azureRegion)
    if (data.quotaUsage !== undefined) localStorage.setItem('azure_tts_quota_usage', JSON.stringify(data.quotaUsage))
    if (data.favoriteVoiceNames !== undefined) localStorage.setItem('azure_tts_favorites', JSON.stringify(data.favoriteVoiceNames))
  } catch (e) {}

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/local-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    } catch (e) {
      console.warn('[Storage] 写入本地数据文件失败', e)
    }
  }, 300)
}

/**
 * 获取本地缓存的完整最新音色列表（从 data/azure_voices_cache.json 读取）
 */
export async function fetchCachedVoices(): Promise<VoiceMetadata[]> {
  try {
    const res = await fetch('/api/voices-cache')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch (e) {
    console.warn('[Storage] 读取音色缓存文件失败', e)
  }
  return []
}

/**
 * 将同步获取到的最新音色数据持久化写入本地缓存文件（data/azure_voices_cache.json）
 */
export async function saveCachedVoices(voices: VoiceMetadata[]): Promise<void> {
  try {
    await fetch('/api/voices-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voices)
    })
  } catch (e) {
    console.warn('[Storage] 写入音色缓存文件失败', e)
  }
}
