import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import type { VoiceMetadata, SynthesisSettings, HistoryItem, MonthlyQuotaUsage, OpenAiConfig, ScriptDialogueSegment } from '../types/tts'
import { PRESET_VOICES } from '../constants/presets'
import { AzureSpeechService } from '../services/azureSpeech'
import { generateSSML, getPureCharacterCount, calculateAzureBillableCharacters } from '../utils/ssml'
import { fetchLocalFileStorage, saveLocalFileStorage, fetchCachedVoices, saveCachedVoices } from '../services/storageService'
import {
  saveAudioBlobToIndexedDB,
  getAudioBlobFromIndexedDB,
  deleteAudioBlobFromIndexedDB,
  clearAllAudioBlobsFromIndexedDB
} from '../services/indexedDBService'

export const useTtsStore = defineStore('tts', () => {
  // 1. 凭据配置（优先从本地文件加载）
  const azureKey = ref<string>('')
  const azureRegion = ref<string>('eastasia')

  // OpenAI 兼容大模型配置 (用于 AI 导演自动分镜分析)
  const openAiConfig = ref<OpenAiConfig>({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'GPT-6.1 Sol'
  })

  // AI 智能分镜列表
  const scriptSegments = ref<ScriptDialogueSegment[]>([])
  const isAiAnalyzing = ref(false)

  // 2. 音色收藏列表 (存储 voice.name 数组)
  const favoriteVoiceNames = ref<string[]>([
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunxiNeural'
  ])

  // 3. 音色库数据
  const voices = ref<VoiceMetadata[]>([...PRESET_VOICES])
  const isFetchingVoices = ref(false)
  const isCustomVoicesLoaded = ref(false)
  const currentVoice = ref<VoiceMetadata>(voices.value[0])

  // 4. 微调设置
  const defaultSettings: SynthesisSettings = {
    rate: 0,
    pitch: 0,
    volume: 100,
    style: '',
    styleDegree: 1.0,
    role: '',
    audioOutputFormat: 'Audio24Khz48KBitRateMonoMp3'
  }
  const settings = ref<SynthesisSettings>({ ...defaultSettings })

  // 5. 输入文本
  const defaultSampleText =
    '微软 Azure 文本转语音服务具有先进的神经语音技术，能够生成流畅自然、富有情感表达的人类逼真语音。快来挑选一个你喜欢的音色试听一下吧！'
  const inputText = ref<string>(defaultSampleText)

  // 6. 当前播放器状态
  const isSynthesizing = ref(false)
  const currentAudioUrl = ref<string>('')
  const currentAudioBlob = ref<Blob | null>(null)
  const currentAudioTitle = ref<string>('')
  const currentAudioVoiceName = ref<string>('')
  const isAudioPlaying = ref(false)
  const playAudioTrigger = ref(0)

  // 7. 配额看板 (500,000 字符/月)
  const getCurrentMonthKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const quotaUsage = ref<MonthlyQuotaUsage>({
    monthKey: getCurrentMonthKey(),
    usedChars: 0,
    quotaLimit: 500000,
    historyCount: 0,
    lastUpdated: Date.now()
  })

  // 配额百分比
  const quotaPercent = computed(() => {
    const ratio = (quotaUsage.value.usedChars / quotaUsage.value.quotaLimit) * 100
    return Math.min(100, parseFloat(ratio.toFixed(2)))
  })

  // 8. 历史记录 (持久化在本地文件)
  const historyList = ref<HistoryItem[]>([])

  // 9. 实时生成的 SSML
  const currentSSML = computed(() => {
    return generateSSML(inputText.value, currentVoice.value, settings.value)
  })

  // 10. 纯文本字符计数
  const pureCharCount = computed(() => {
    return getPureCharacterCount(inputText.value)
  })

  // 是否收藏判断
  const isVoiceFavorite = (voiceName: string) => {
    return favoriteVoiceNames.value.includes(voiceName)
  }

  // 切换收藏状态
  const toggleFavoriteVoice = (voiceName: string) => {
    const idx = favoriteVoiceNames.value.indexOf(voiceName)
    if (idx !== -1) {
      favoriteVoiceNames.value.splice(idx, 1)
    } else {
      favoriteVoiceNames.value.push(voiceName)
    }
    syncToFile()
  }

  // 序列化并保存到本地文件
  const syncToFile = () => {
    saveLocalFileStorage({
      azureKey: azureKey.value,
      azureRegion: azureRegion.value,
      openAiConfig: openAiConfig.value,
      quotaUsage: quotaUsage.value,
      favoriteVoiceNames: favoriteVoiceNames.value,
      currentVoiceName: currentVoice.value.name,
      settings: settings.value,
      historyList: historyList.value.slice(0, 50).map(item => ({
        ...item,
        audioBlob: undefined,
        audioUrl: undefined // 避免存储失效的 blob: url 到磁盘
      })),
      inputText: inputText.value
    })
  }

  // 初始化从本地文件读取
  const initStoreFromFile = async () => {
    // 优先加载本地缓存的完整最新官方音色库
    try {
      const cached = await fetchCachedVoices()
      if (cached && cached.length > 0) {
        voices.value = cached
        isCustomVoicesLoaded.value = true
      }
    } catch (e) {
      console.warn('加载本地音色缓存失败', e)
    }

    const data = await fetchLocalFileStorage()
    if (data.azureKey) azureKey.value = data.azureKey
    if (data.azureRegion) azureRegion.value = data.azureRegion
    if (data.openAiConfig) {
      openAiConfig.value = { ...openAiConfig.value, ...data.openAiConfig }
    }
    if (data.favoriteVoiceNames && Array.isArray(data.favoriteVoiceNames)) {
      favoriteVoiceNames.value = data.favoriteVoiceNames
    }
    if (data.quotaUsage) {
      const curMonth = getCurrentMonthKey()
      if (data.quotaUsage.monthKey === curMonth) {
        quotaUsage.value = data.quotaUsage
      } else {
        quotaUsage.value = {
          monthKey: curMonth,
          usedChars: 0,
          quotaLimit: 500000,
          historyCount: 0,
          lastUpdated: Date.now()
        }
      }
    }
    if (data.settings) {
      settings.value = { ...defaultSettings, ...data.settings }
    }
    if (data.inputText) {
      inputText.value = data.inputText
    }
    if (data.historyList && Array.isArray(data.historyList)) {
      historyList.value = data.historyList
    }
    if (data.currentVoiceName) {
      const match = voices.value.find(v => v.name === data.currentVoiceName)
      if (match) currentVoice.value = match
    }
  }

  // 初始化执行
  initStoreFromFile()

  // 监听持久化
  watch([azureKey, azureRegion], syncToFile)
  watch(openAiConfig, syncToFile, { deep: true })
  watch(
    currentVoice,
    (v) => {
      if (v) {
        if (settings.value.style && !v.styleList?.includes(settings.value.style)) {
          settings.value.style = ''
        }
        if (settings.value.role && !v.rolePlayList?.includes(settings.value.role)) {
          settings.value.role = ''
        }
        syncToFile()
      }
    }
  )
  watch(settings, syncToFile, { deep: true })
  watch(quotaUsage, syncToFile, { deep: true })
  watch(inputText, syncToFile)
  watch(historyList, syncToFile, { deep: true })

  // 动作方法
  const setCredentials = (key: string, region: string) => {
    azureKey.value = key.trim()
    azureRegion.value = region.trim()
    syncToFile()
  }

  const selectVoice = (voice: VoiceMetadata) => {
    currentVoice.value = voice
  }

  /**
   * 刷新远程音色列表
   */
  const refreshVoicesFromAzure = async () => {
    if (!azureKey.value || !azureRegion.value) {
      throw new Error('请先在顶部设置中配置 Azure 密钥与区域！')
    }
    isFetchingVoices.value = true
    try {
      const service = new AzureSpeechService(azureKey.value, azureRegion.value)
      const remoteVoices = await service.fetchRemoteVoices()
      if (remoteVoices.length > 0) {
        const enriched = remoteVoices.map((rv) => {
          const matchPreset = PRESET_VOICES.find((pv) => pv.name === rv.name)
          if (matchPreset) {
            return {
              ...rv,
              displayName: matchPreset.displayName,
              categories: matchPreset.categories,
              description: matchPreset.description,
              avatarColor: matchPreset.avatarColor,
              styleList: rv.styleList && rv.styleList.length > 0 ? rv.styleList : matchPreset.styleList,
              rolePlayList: rv.rolePlayList && rv.rolePlayList.length > 0 ? rv.rolePlayList : matchPreset.rolePlayList
            }
          }
          return rv
        })

        voices.value = enriched
        isCustomVoicesLoaded.value = true

        // 立即持久化写入本地磁盘文件 data/azure_voices_cache.json
        await saveCachedVoices(enriched)

        const stillExists = enriched.find((v) => v.name === currentVoice.value.name)
        if (stillExists) {
          currentVoice.value = stillExists
        } else {
          currentVoice.value = enriched[0]
        }
      }
      return remoteVoices.length
    } finally {
      isFetchingVoices.value = false
    }
  }

  /**
   * 加载指定音频到播放器控制台
   */
  const loadAudioToPlayer = (url: string, title?: string, voiceName?: string, blob?: Blob, autoPlay = true) => {
    currentAudioUrl.value = url
    if (blob) currentAudioBlob.value = blob
    if (title) currentAudioTitle.value = title
    if (voiceName) currentAudioVoiceName.value = voiceName
    if (autoPlay) {
      playAudioTrigger.value++
    }
  }

  /**
   * 播放历史记录条目的音频（自动从 IndexedDB 检索或回退重造 URL，若没有则支持重新实时合成）
   */
  const playHistoryItemAudio = async (item: HistoryItem): Promise<boolean> => {
    // 1. 如果当前内存里已有有效的 blob
    if (item.audioBlob) {
      const url = URL.createObjectURL(item.audioBlob)
      item.audioUrl = url
      loadAudioToPlayer(url, item.text.slice(0, 35), item.voiceDisplayName, item.audioBlob, true)
      return true
    }

    // 2. 尝试从 IndexedDB 提取保存的真实音频二进制 Blob
    const storedBlob = await getAudioBlobFromIndexedDB(item.id)
    if (storedBlob) {
      item.audioBlob = storedBlob
      const url = URL.createObjectURL(storedBlob)
      item.audioUrl = url
      loadAudioToPlayer(url, item.text.slice(0, 35), item.voiceDisplayName, storedBlob, true)
      return true
    }

    // 3. 如果 IndexedDB 中未命中（例如刷新页面前产生的旧记录），使用其已保存的精确 SSML 重新快速请求 Azure
    if (azureKey.value && azureRegion.value && item.ssml) {
      const service = new AzureSpeechService(azureKey.value, azureRegion.value)
      const format =
        item.audioFormat === 'wav'
          ? SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
          : SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3

      const res = await service.synthesizeSSML(item.ssml, format)
      // 永久沉淀到 IndexedDB
      await saveAudioBlobToIndexedDB(item.id, res.audioBlob)
      item.audioBlob = res.audioBlob
      item.audioUrl = res.audioUrl
      loadAudioToPlayer(res.audioUrl, item.text.slice(0, 35), item.voiceDisplayName, res.audioBlob, true)
      return true
    }

    return false
  }

  /**
   * 开始合成
   */
  const synthesize = async (customSSML?: string) => {
    if (!azureKey.value || !azureRegion.value) {
      throw new Error('请先配置 Azure Key 和 Region')
    }

    const ssmlToSend = customSSML || currentSSML.value
    // 纯文本有效字数统计（供界面和历史记录显示）
    const pureCount = getPureCharacterCount(customSSML ? customSSML : inputText.value)
    // 微软官方实际计费字符数（包含调节标签 + 中文计为2个字符）
    const billableCount = calculateAzureBillableCharacters(ssmlToSend)

    if (pureCount === 0) {
      throw new Error('请输入要合成的文本内容')
    }

    isSynthesizing.value = true
    try {
      const service = new AzureSpeechService(azureKey.value, azureRegion.value)

      let outputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
      let isWav = false
      if (settings.value.audioOutputFormat === 'Riff24Khz16BitMonoPcm') {
        outputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
        isWav = true
      }

      const res = await service.synthesizeSSML(ssmlToSend, outputFormat)

      const historyId = 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

      // 将音频永久存储到 IndexedDB
      await saveAudioBlobToIndexedDB(historyId, res.audioBlob)

      // 提取标题与发音人信息（支持多发音人 SSML）
      const displayText = customSSML ? (customSSML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 35) || '多角色SSML对话') : inputText.value
      const displayVoiceName = customSSML ? '多音色/多风格' : currentVoice.value.displayName

      // 更新主控制台播放器
      loadAudioToPlayer(
        res.audioUrl,
        displayText.slice(0, 35) + (displayText.length > 35 ? '...' : ''),
        displayVoiceName,
        res.audioBlob
      )

      // 扣除/累计月度字符用量（严格按照微软官方计费规则 billableCount）
      const monthKey = getCurrentMonthKey()
      if (quotaUsage.value.monthKey !== monthKey) {
        quotaUsage.value = {
          monthKey,
          usedChars: billableCount,
          quotaLimit: 500000,
          historyCount: 1,
          lastUpdated: Date.now()
        }
      } else {
        quotaUsage.value = { ...quotaUsage.value, usedChars: quotaUsage.value.usedChars + billableCount, historyCount: quotaUsage.value.historyCount + 1, lastUpdated: Date.now() }
      }

      const historyItem: HistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        text: displayText,
        ssml: ssmlToSend,
        voiceName: customSSML ? 'MultiVoices' : currentVoice.value.name,
        voiceDisplayName: displayVoiceName,
        locale: currentVoice.value.locale,
        style: customSSML ? '多风格' : settings.value.style,
        styleDegree: settings.value.styleDegree,
        role: settings.value.role,
        charCount: pureCount,
        audioUrl: res.audioUrl,
        audioBlob: res.audioBlob,
        audioFormat: isWav ? 'wav' : 'mp3',
        duration: res.duration
      }

      historyList.value.unshift(historyItem)
      if (historyList.value.length > 50) {
        const removed = historyList.value.pop()
        if (removed) {
          deleteAudioBlobFromIndexedDB(removed.id)
        }
      }

      syncToFile()
      return historyItem
    } finally {
      isSynthesizing.value = false
    }
  }

  const deleteHistoryItem = (id: string) => {
    const idx = historyList.value.findIndex((h) => h.id === id)
    if (idx !== -1) {
      if (historyList.value[idx].audioUrl) {
        URL.revokeObjectURL(historyList.value[idx].audioUrl!)
      }
      historyList.value.splice(idx, 1)
      deleteAudioBlobFromIndexedDB(id)
      syncToFile()
    }
  }

  const clearHistory = () => {
    historyList.value.forEach((h) => {
      if (h.audioUrl) URL.revokeObjectURL(h.audioUrl)
    })
    historyList.value = []
    clearAllAudioBlobsFromIndexedDB()
    syncToFile()
  }

  const resetQuotaUsage = () => {
    quotaUsage.value.usedChars = 0
    quotaUsage.value.historyCount = 0
    quotaUsage.value.lastUpdated = Date.now()
    syncToFile()
  }

  const setQuotaUsedChars = (chars: number) => {
    quotaUsage.value.usedChars = chars
    quotaUsage.value.lastUpdated = Date.now()
    syncToFile()
  }

  /**
   * 单独为某一个分镜段落试听合成
   */
  const synthesizeSingleSegment = async (segment: ScriptDialogueSegment) => {
    if (!azureKey.value || !azureRegion.value) {
      throw new Error('请先配置 Azure Key 和 Region')
    }

    segment.isSynthesizing = true
    try {
      const matchVoice = voices.value.find((v) => v.name === segment.voiceName) || currentVoice.value
      const dummySettings: SynthesisSettings = {
        rate: 0,
        pitch: 0,
        volume: 100,
        style: segment.style || '',
        styleDegree: segment.styleDegree || 1.0,
        role: segment.role || '',
        audioOutputFormat: settings.value.audioOutputFormat
      }

      const singleSsml = generateSSML(segment.text, matchVoice, dummySettings)
      const service = new AzureSpeechService(azureKey.value, azureRegion.value)
      const res = await service.synthesizeSSML(singleSsml)

      segment.audioUrl = res.audioUrl
      segment.audioBlob = res.audioBlob

      // 将该句载入主播放器进行直接播放试听
      loadAudioToPlayer(
        res.audioUrl,
        `【${segment.character}】${segment.text.slice(0, 30)}`,
        `${segment.voiceDisplayName} · ${segment.style || '默认'}`,
        res.audioBlob,
        true
      )

      // 统计计费
      const billable = calculateAzureBillableCharacters(singleSsml)
      quotaUsage.value.usedChars += billable
      quotaUsage.value.historyCount += 1
      quotaUsage.value.lastUpdated = Date.now()
      syncToFile()

      return res
    } finally {
      segment.isSynthesizing = false
    }
  }

  return {
    azureKey,
    azureRegion,
    openAiConfig,
    scriptSegments,
    isAiAnalyzing,
    voices,
    favoriteVoiceNames,
    isVoiceFavorite,
    toggleFavoriteVoice,
    isFetchingVoices,
    isCustomVoicesLoaded,
    currentVoice,
    settings,
    inputText,
    isSynthesizing,
    currentAudioUrl,
    currentAudioBlob,
    currentAudioTitle,
    currentAudioVoiceName,
    isAudioPlaying,
    playAudioTrigger,
    quotaUsage,
    quotaPercent,
    historyList,
    currentSSML,
    pureCharCount,
    setCredentials,
    selectVoice,
    refreshVoicesFromAzure,
    loadAudioToPlayer,
    playHistoryItemAudio,
    synthesizeSingleSegment,
    synthesize,
    deleteHistoryItem,
    clearHistory,
    resetQuotaUsage,
    setQuotaUsedChars
  }
})
