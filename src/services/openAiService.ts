import type { VoiceMetadata, ScriptDialogueSegment, OpenAiConfig } from '../types/tts'

export class OpenAiDirectorService {
  private baseUrl: string
  private apiKey: string
  private model: string

  constructor(config: OpenAiConfig) {
    let url = (config.baseUrl || 'https://api.openai.com/v1').trim()
    if (url.endsWith('/')) {
      url = url.slice(0, -1)
    }
    this.baseUrl = url
    this.apiKey = (config.apiKey || '').trim()
    this.model = (config.model || 'gpt-4o').trim()
  }

  /**
   * 测试 OpenAI 端点与 API Key 是否连通有效
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return { success: false, message: '请先填写 AI 模型的 API Key' }
    }

    try {
      const endpoint = `${this.baseUrl}/chat/completions`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        let detail = ''
        try {
          const errJson = JSON.parse(errorText)
          detail = errJson.error?.message || errorText
        } catch {
          detail = errorText
        }
        return { success: false, message: `连接失败 (${res.status}): ${detail}` }
      }

      return { success: true, message: `连接成功！模型 [${this.model}] 响应正常。` }
    } catch (err: any) {
      return { success: false, message: `请求异常: ${err?.message || err}` }
    }
  }

  /**
   * 将原始文本自动分析为带多角色、音色、语气风格的分镜段落列表
   */
  async parseScriptToSegments(
    rawText: string,
    candidateVoices: VoiceMetadata[],
    isEnglish: boolean = false
  ): Promise<ScriptDialogueSegment[]> {
    if (!this.apiKey) {
      throw new Error('请先在顶部设置中配置 AI 模型的 API Key')
    }

    // 格式化提供给模型的可用音色与风格库（防止幻觉）
    const voiceCatalogSummary = candidateVoices.map((v) => ({
      voiceName: v.name,
      displayName: v.displayName,
      gender: v.gender === 'Female' ? '女' : '男',
      supportedStyles: v.styleList || []
    }))

    const langRule = isEnglish
      ? `1. Language: The input text is in English. You MUST ONLY pick English voices (en-US / en-GB / en-AU etc.) from the candidate list. NEVER use Chinese voices for English text!`
      : `1. 语言绝对匹配：当前文本为中文，【绝对必须】仅使用中文音色（zh-CN 音色，如晓晓、云希、云健等），严禁使用英文音色来读中文！`

    const systemPrompt = `你是一位顶级的声音导演与影视配音分镜专家。
你的任务是将用户的剧本、故事或小说文本，精准拆解为一系列连贯的角色配音分镜段落（包含旁白与对话台词）。

【核心规则与约束】：
${langRule}
2. 说话人识别与段落合并（极其重要）：
   - 必须根据上下文描写精准识别说话人（如“旁白 / Narrator”、“李明 / John”、“小雨 / Mary”）。台词前的动作描写（如“李明冷冷地举起手电筒，压低嗓音呵斥道：”）属于【旁白】，真正的台词“闭嘴！别出声，把灯熄灭！”属于【李明】。绝不能将动作描写混进人物台词里！
   - 【严禁拆碎相邻旁白】：同一角色（特别是“旁白”）连续发生的叙述或动作描写，【必须合并为同一个分镜段落】！严禁将一段连续的旁白无故切分成两句！例如“夜色深沉，远处的钟楼敲响了十二下。风穿过古老而狭窄的巷道。小雨惊恐地抓住他的衣角：”这是一整段连续旁白，必须合并为一句输出，不要分成两段！
3. 声音与性格契合：
   - 同一个角色在整个故事中必须固定使用同一个音色（voiceName）。
   - 青年/成年男性分配男声，女性/少女分配女声；
   - 旁白推荐使用富有感染力的专业叙述声线（如中文云希 narration-relaxed 讲述风格，或英文 Jenny / Guy 等）。
4. 深度情感风格（Style）分析与标记（极其重要）：
   - 必须深刻理解台词背后的潜台词、情绪起伏与人物处境！
   - 呵斥、警告、命令、愤怒的台词，赋予 angry（愤怒）、serious（严肃庄重）或 shouting 等强烈风格！
   - 惊恐、害怕、哀求的台词，赋予 fearful（恐惧害怕）、sad（悲伤哭腔）或 terrified 等风格！
   - 风格强度 styleDegree：强烈情绪设置在 1.2 到 1.5 之间。普通情绪设为 1.0。
   - 【关键防幻觉约束】：分配的 style 必须在该音色所支持的 supportedStyles 列表中！若不支持特定风格，填 "" 或 null。
5. 必须返回严格的纯 JSON 数组，严禁带有 markdown 标记（不要出现 \`\`\`json）：
[
  {
    "character": "旁白",
    "voiceName": "${candidateVoices[0]?.name || 'zh-CN-YunxiNeural'}",
    "voiceDisplayName": "${candidateVoices[0]?.displayName || '云希'}",
    "style": "${candidateVoices[0]?.styleList?.[0] || ''}",
    "styleDegree": 1.0,
    "text": "示例叙述台词..."
  }
]

【候选音色与风格库】：
${JSON.stringify(voiceCatalogSummary, null, 2)}
`

    const endpoint = `${this.baseUrl}/chat/completions`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请将以下文本转换为多角色配音分镜：\n\n${rawText}` }
        ],
        temperature: 0.3
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`AI 请求失败 (${res.status}): ${errText}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''

    // 清理可能包含的 markdown 标签
    const cleanJsonStr = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    let parsedSegments: any[] = []
    try {
      parsedSegments = JSON.parse(cleanJsonStr)
    } catch (e: any) {
      throw new Error(`解析 AI 返回的 JSON 失败: ${e.message}\n返回原文: ${content.slice(0, 200)}...`)
    }

    if (!Array.isArray(parsedSegments) || parsedSegments.length === 0) {
      throw new Error('AI 未能识别出有效的分镜段落')
    }

    // 格式化段落对象，注入唯一 ID
    return parsedSegments.map((seg, idx) => ({
      id: `seg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      character: seg.character || '角色',
      voiceName: seg.voiceName || candidateVoices[0]?.name || 'zh-CN-XiaoxiaoNeural',
      voiceDisplayName: seg.voiceDisplayName || candidateVoices[0]?.displayName || '晓晓',
      style: seg.style || undefined,
      styleDegree: typeof seg.styleDegree === 'number' ? seg.styleDegree : 1.0,
      role: seg.role || undefined,
      text: seg.text || ''
    }))
  }
}
