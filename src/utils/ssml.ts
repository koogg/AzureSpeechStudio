import type { VoiceMetadata, SynthesisSettings } from '../types/tts'

function isCjkChar(char: string): boolean {
  const code = char.codePointAt(0)
  if (!code) return false
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0xf900 && code <= 0xfaff) // CJK Compatibility Ideographs
  )
}

/**
 * 按照微软 Azure 官方计费规则（Billable Characters）计算字符数：
 * 1. 计费范围：包含传入 SSML 的主体内容，排除 <speak>、</speak>、<voice>、</voice> 标签本身。
 * 2. 标签内容计费：其余所有标签（如 <mstts:express-as>、<prosody> 等调节标签）及标点、空格、换行均计费。
 * 3. 中日韩汉字翻倍规则：每个中文字符/汉字（CJK）在 Azure 官方计费中按 2 个字符计算！
 */
export function calculateAzureBillableCharacters(rawContent: string): number {
  if (!rawContent) return 0

  let billableBody = rawContent

  // 如果传入的是完整 SSML，去除外层的 <speak> 和 <voice> 标签
  if (rawContent.includes('<speak') || rawContent.includes('</speak>')) {
    billableBody = rawContent
      .replace(/<\/?speak[^>]*>/gi, '')
      .replace(/<\/?voice[^>]*>/gi, '')
  }

  let totalBillable = 0
  for (const ch of billableBody) {
    if (isCjkChar(ch)) {
      totalBillable += 2 // 微软规则：中文汉字计为 2 个字符
    } else {
      totalBillable += 1
    }
  }

  return totalBillable
}

/**
 * 纯文本汉字字数统计（用于界面上给用户直观展示“字数”）
 */
export function getPureCharacterCount(rawText: string): number {
  if (!rawText) return 0
  const stripped = rawText.replace(/<[^>]+>/g, '')
  return stripped.trim().length
}

/**
 * 构造标准微软 Azure SSML 标记语言
 * 支持 voice name, express-as style & styledegree & role, prosody rate/pitch/volume
 */
export function generateSSML(
  text: string,
  voice: VoiceMetadata,
  settings: SynthesisSettings
): string {
  const { rate, pitch, volume, style, styleDegree, role } = settings

  // 1. 转换 prosody 格式
  // rate: 0 => +0%, -20 => -20%, 30 => +30%
  const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`
  // pitch: 0 => +0Hz or +0%, azure accepts +X%
  const pitchStr = pitch >= 0 ? `+${pitch}%` : `${pitch}%`
  // volume: 100 => +0%, 80 => -20% or 0-100 scale. Azure prosody volume accepts 'default' or percentage like '+0%'
  const volumeDiff = volume - 100
  const volumeStr = volumeDiff >= 0 ? `+${volumeDiff}%` : `${volumeDiff}%`

  // 2. 文本实体转义（如果文本未转义且不包含自闭合标签）
  // 简易转义 & < > 但保留已有的 ssml 结构如果用户特地写的话
  let cleanText = text
  if (!text.includes('<break') && !text.includes('<phoneme')) {
    cleanText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // 3. 构建 prosody 标签
  let innerContent = `<prosody rate="${rateStr}" pitch="${pitchStr}" volume="${volumeStr}">${cleanText}</prosody>`

  // 4. 构建 mstts:express-as 标签 (如果有 style 或 role)
  const hasStyle = Boolean(style && style.trim())
  const hasRole = Boolean(role && role.trim())

  if (hasStyle || hasRole) {
    const styleAttr = hasStyle ? ` style="${style}"` : ''
    const degreeAttr = hasStyle && styleDegree !== 1.0 ? ` styledegree="${styleDegree.toFixed(1)}"` : ''
    const roleAttr = hasRole ? ` role="${role}"` : ''

    innerContent = `<mstts:express-as${styleAttr}${degreeAttr}${roleAttr}>${innerContent}</mstts:express-as>`
  }

  // 5. 组合根 SSML
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.locale}">
    <voice name="${voice.name}">
        ${innerContent}
    </voice>
</speak>`.trim()
}

/**
 * 根据多分镜段落列表，拼接生成整体的完整 SSML
 */
export function buildSsmlFromSegments(segments: { voiceName: string; style?: string; styleDegree?: number; role?: string; text: string }[]): string {
  const innerVoices = segments.map((seg) => {
    let cleanText = seg.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

    let content = `<prosody rate="+0%" pitch="+0%" volume="+0%">${cleanText}</prosody>`
    if (seg.style || seg.role) {
      const styleAttr = seg.style ? ` style="${seg.style}"` : ''
      const degreeAttr = seg.style && seg.styleDegree && seg.styleDegree !== 1.0 ? ` styledegree="${seg.styleDegree.toFixed(1)}"` : ''
      const roleAttr = seg.role ? ` role="${seg.role}"` : ''
      content = `<mstts:express-as${styleAttr}${degreeAttr}${roleAttr}>${content}</mstts:express-as>`
    }

    return `    <voice name="${seg.voiceName}">\n        ${content}\n    </voice>`
  }).join('\n')

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
${innerVoices}
</speak>`.trim()
}

/**
 * 格式化字节数
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化毫秒为 mm:ss
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
