import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'
import type { VoiceMetadata } from '../types/tts'

export class AzureSpeechService {
  private subscriptionKey: string
  private region: string

  constructor(key: string, region: string) {
    this.subscriptionKey = key.trim()
    this.region = region.trim()
  }

  /**
   * 检验凭证是否有效
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.subscriptionKey || !this.region) {
      return { success: false, message: '请先填写 Azure 密钥与地区' }
    }

    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.subscriptionKey, this.region)
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null as any)

      try {
        const result = await synthesizer.getVoicesAsync()
        synthesizer.close()
        if (result.errorDetails) {
          return { success: false, message: `连接失败: ${result.errorDetails}` }
        } else {
          return {
            success: true,
            message: `验证成功！已连接到微软 Azure (${this.region})，获取到 ${result.voices.length} 个音色。`
          }
        }
      } catch (err: any) {
        synthesizer.close()
        return { success: false, message: `连接异常: ${err?.message || err}` }
      }
    } catch (err: any) {
      return { success: false, message: `初始化失败: ${err?.message || err}` }
    }
  }

  /**
   * 从 Azure 官方服务器动态获取所有可用的声音列表
   */
  async fetchRemoteVoices(): Promise<VoiceMetadata[]> {
    if (!this.subscriptionKey || !this.region) {
      throw new Error('缺少 Azure 密钥或地区配置')
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.subscriptionKey, this.region)
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null as any)

    try {
      const result = await synthesizer.getVoicesAsync()
      synthesizer.close()
      if (result.errorDetails) {
        throw new Error(result.errorDetails)
      }

      const voices: VoiceMetadata[] = result.voices.map((v: any) => {
        return {
          name: v.name,
          displayName: v.displayName || v.localName || v.name,
          localName: v.localName || v.displayName || v.name,
          locale: v.locale,
          localeName: v.localeName || v.locale,
          gender: (v.gender === 1 ? 'Female' : v.gender === 2 ? 'Male' : 'Neutral') as any,
          voiceType: v.voiceType === 1 ? 'OnlineNeural' : 'Neural',
          styleList: v.styleList || [],
          rolePlayList: v.rolePlayList || [],
          sampleRateHertz: String(v.sampleRateHertz || '24000'),
          wordsPerMinute: String(v.wordsPerMinute || '160')
        }
      })

      return voices
    } catch (err: any) {
      synthesizer.close()
      throw new Error(err?.message || err)
    }
  }

  /**
   * 使用 SSML 进行语音合成，返回音频 Blob 及 ArrayBuffer
   */
  async synthesizeSSML(
    ssml: string,
    outputFormat: SpeechSDK.SpeechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  ): Promise<{ audioBlob: Blob; audioUrl: string; duration: number }> {
    if (!this.subscriptionKey || !this.region) {
      throw new Error('请先配置 Azure Key 和 Region')
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.subscriptionKey, this.region)
    speechConfig.speechSynthesisOutputFormat = outputFormat

    // 网页端使用 null 作为 audioConfig，从而直接将音频数据缓冲在内存中
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null as any)

    return new Promise((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (result: SpeechSDK.SpeechSynthesisResult) => {
          synthesizer.close()
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            const audioData = result.audioData
            // 根据格式推断 mime
            const isWav = outputFormat === SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
            const mimeType = isWav ? 'audio/wav' : 'audio/mp3'
            const blob = new Blob([audioData], { type: mimeType })
            const audioUrl = URL.createObjectURL(blob)
            const duration = (result.audioDuration || 0) / 10000000 // 100-nanosecond units to seconds

            resolve({
              audioBlob: blob,
              audioUrl,
              duration
            })
          } else {
            const details = SpeechSDK.CancellationDetails.fromResult(result)
            let errorMsg = `合成未成功: ${result.reason}`
            if (details) {
              errorMsg += `\n原因: ${details.errorDetails || details.reason}`
            }
            reject(new Error(errorMsg))
          }
        },
        (err: any) => {
          synthesizer.close()
          reject(new Error(`请求异常: ${err?.message || err}`))
        }
      )
    })
  }
}
