<template>
  <div class="segments-workbench">
    <div class="segments-header-bar">
      <div class="header-left">
        <el-tag type="success" effect="plain" class="badge">AI 剧本分镜模式</el-tag>
        <span class="segment-count">共 <strong>{{ segments.length }}</strong> 句对话 / 旁白</span>
      </div>

      <div class="header-actions">
        <!-- 批量角色统一替换与演员表映射 -->
        <el-button size="small" type="warning" plain @click="showBatchReplaceModal = true">
          <el-icon><User /></el-icon>
          角色配音一键替换
        </el-button>

        <!-- 还原为单文本模式 -->
        <el-button size="small" @click="$emit('exit-segments')">
          退出分镜模式
        </el-button>

        <!-- 查看拼接后的 SSML -->
        <el-button size="small" type="primary" plain @click="$emit('view-merged-ssml')">
          <el-icon><Tickets /></el-icon>
          查看完整 SSML
        </el-button>
      </div>
    </div>

    <!-- 分镜条目卡片流 -->
    <div class="segments-scroll-list">
      <div
        v-for="(seg, idx) in segments"
        :key="seg.id"
        class="segment-card"
      >
        <div class="seg-top-meta">
          <div class="role-identity">
            <span class="index-num">#{{ idx + 1 }}</span>
            <el-input
              v-model="seg.character"
              size="small"
              placeholder="角色名"
              class="char-input"
            />

            <!-- 发音人选择 -->
            <el-select
              v-model="seg.voiceName"
              size="small"
              class="voice-select"
              @change="onVoiceChange(seg)"
            >
              <el-option
                v-for="v in availableVoices"
                :key="v.name"
                :label="`${v.displayName} (${v.gender === 'Female' ? '女' : '男'})`"
                :value="v.name"
              />
            </el-select>

            <!-- 情感风格标签下拉 -->
            <el-select
              v-model="seg.style"
              size="small"
              placeholder="默认自然"
              clearable
              class="style-select"
              @change="invalidateSegmentAudio(seg)"
            >
              <el-option label="默认自然" value="" />
              <el-option
                v-for="st in getStylesForVoice(seg.voiceName)"
                :key="st"
                :label="getStyleLabel(st)"
                :value="st"
              />
            </el-select>

            <!-- 风格强度下拉调节 -->
            <div v-if="seg.style" class="degree-box">
              <span class="deg-label">强度:</span>
              <el-select
                v-model="seg.styleDegree"
                size="small"
                class="degree-select"
                @change="invalidateSegmentAudio(seg)"
              >
                <el-option :value="0.5" label="0.5x (微弱)" />
                <el-option :value="0.8" label="0.8x (偏弱)" />
                <el-option :value="1.0" label="1.0x (标准)" />
                <el-option :value="1.2" label="1.2x (较强)" />
                <el-option :value="1.5" label="1.5x (强烈)" />
                <el-option :value="1.8" label="1.8x (极强)" />
                <el-option :value="2.0" label="2.0x (满级)" />
              </el-select>
            </div>
          </div>

          <!-- 单句独立试听按钮 (不浪费多余额度) -->
          <div class="seg-actions">
            <el-button
              size="small"
              round
              :type="seg.audioUrl ? 'success' : 'primary'"
              :loading="seg.isSynthesizing"
              @click="handleListenSingle(seg, false)"
            >
              <el-icon><VideoPlay /></el-icon>
              <span>{{ seg.audioUrl ? '播放试听' : '单句试听' }}</span>
            </el-button>

            <!-- 已有音频时提供【重新生成】按钮（明确重新调用云端） -->
            <el-tooltip v-if="seg.audioUrl" content="重新生成本句音频 (重新请求云端，消耗额度)" placement="top">
              <el-button
                size="small"
                circle
                :loading="seg.isSynthesizing"
                @click="handleListenSingle(seg, true)"
              >
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-tooltip>

            <el-button
              size="small"
              circle
              type="danger"
              plain
              title="删除此句"
              @click="removeSegment(idx)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 台词内容编辑框 -->
        <el-input
          v-model="seg.text"
          type="textarea"
          :rows="2"
          resize="none"
          placeholder="台词内容"
          class="seg-text-input"
          @input="invalidateSegmentAudio(seg)"
        />
      </div>
    </div>

    <!-- 角色配音一键替换/演员表映射对话框 -->
    <el-dialog
      v-model="showBatchReplaceModal"
      title="🎭 角色配音一键替换（演员表映射）"
      width="560px"
      align-center
      append-to-body
    >
      <div class="batch-dialog-content">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="batch-tip"
        >
          <template #title>
            检测到当前分镜剧本包含以下角色。在此为某个角色统一指派发音人，将瞬间批量替换全剧本中该角色的所有台词音色！
          </template>
        </el-alert>

        <div class="character-mapping-list">
          <div
            v-for="charName in uniqueCharacters"
            :key="charName"
            class="mapping-item-row"
          >
            <div class="char-badge">
              <el-icon><User /></el-icon>
              <span>{{ charName }}</span>
              <span class="line-count">({{ getCharacterLineCount(charName) }}句)</span>
            </div>

            <div class="voice-picker-wrap">
              <el-select
                :model-value="getCharacterVoice(charName)"
                size="default"
                placeholder="选择统一音色"
                @change="(val: string) => updateCharacterVoice(charName, val)"
              >
                <el-option
                  v-for="v in availableVoices"
                  :key="v.name"
                  :label="`${v.displayName} (${v.gender === 'Female' ? '女' : '男'})`"
                  :value="v.name"
                />
              </el-select>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" @click="showBatchReplaceModal = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { STYLE_NAME_MAP } from '../constants/presets'
import type { ScriptDialogueSegment } from '../types/tts'

defineEmits(['exit-segments', 'view-merged-ssml'])

const ttsStore = useTtsStore()
const segments = computed(() => ttsStore.scriptSegments)
const showBatchReplaceModal = ref(false)

// 提取当前剧本中所有独立角色名
const uniqueCharacters = computed(() => {
  const set = new Set<string>()
  ttsStore.scriptSegments.forEach((s) => {
    if (s.character?.trim()) set.add(s.character.trim())
  })
  return Array.from(set)
})

const getCharacterLineCount = (charName: string) => {
  return ttsStore.scriptSegments.filter((s) => s.character === charName).length
}

const getCharacterVoice = (charName: string) => {
  const match = ttsStore.scriptSegments.find((s) => s.character === charName)
  return match?.voiceName || ''
}

const updateCharacterVoice = (charName: string, newVoiceName: string) => {
  const voiceObj = ttsStore.voices.find((v) => v.name === newVoiceName)
  let count = 0
  ttsStore.scriptSegments.forEach((s) => {
    if (s.character === charName) {
      s.voiceName = newVoiceName
      if (voiceObj) {
        s.voiceDisplayName = voiceObj.displayName
        if (s.style && !voiceObj.styleList?.includes(s.style)) {
          s.style = ''
        }
      }
      invalidateSegmentAudio(s)
      count++
    }
  })
  ElMessage.success(`已将「${charName}」的 ${count} 处台词统一替换为 ${voiceObj?.displayName || newVoiceName}`)
}

const availableVoices = computed(() => {
  return ttsStore.voices.filter((v) => v.locale.startsWith('zh') || v.locale.startsWith('en'))
})

const getStyleLabel = (style: string) => {
  return STYLE_NAME_MAP[style] || style
}

const getStylesForVoice = (voiceName: string) => {
  const v = ttsStore.voices.find((item) => item.name === voiceName)
  return v?.styleList || []
}

const invalidateSegmentAudio = (seg: ScriptDialogueSegment) => {
  if (seg.audioUrl) {
    URL.revokeObjectURL(seg.audioUrl)
    seg.audioUrl = undefined
    seg.audioBlob = undefined
  }
}

const onVoiceChange = (seg: ScriptDialogueSegment) => {
  const v = ttsStore.voices.find((item) => item.name === seg.voiceName)
  if (v) {
    seg.voiceDisplayName = v.displayName
    // 如果原风格不在新发音人支持列表，重置风格
    if (seg.style && !v.styleList?.includes(seg.style)) {
      seg.style = ''
    }
  }
  invalidateSegmentAudio(seg)
}

const handleListenSingle = async (seg: ScriptDialogueSegment, forceReSynthesize = false) => {
  if (!seg.text.trim()) {
    ElMessage.warning('台词不能为空')
    return
  }

  // 1. 如果已有刚生成的音频且未要求强制重新生成：直接本地播放，不走网络接口，不扣减额度！
  if (seg.audioUrl && !forceReSynthesize) {
    ttsStore.loadAudioToPlayer(
      seg.audioUrl,
      `【${seg.character}】${seg.text.slice(0, 30)}`,
      `${seg.voiceDisplayName} · ${getStyleLabel(seg.style || '') || '默认'}`,
      seg.audioBlob
    )
    ElMessage.success(`正在播放已生成的音频（纯本地回放，不扣除额度）`)
    return
  }

  // 2. 否则向 Azure 请求生成新音频，并精准扣减单句额度
  try {
    await ttsStore.synthesizeSingleSegment(seg)
    ElMessage.success(`「${seg.character}」试听生成完毕`)
  } catch (err: any) {
    ElMessage.error(err?.message || '单句试听失败')
  }
}

const removeSegment = (idx: number) => {
  ttsStore.scriptSegments.splice(idx, 1)
}
</script>

<style scoped>
.segments-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 10px;
}

.segments-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 14px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.segment-count {
  font-size: 13px;
  color: var(--text-muted);
}

.segments-scroll-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.segment-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
}

.segment-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.06);
}

.seg-top-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.role-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.index-num {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  font-family: monospace;
}

.char-input {
  width: 90px;
}

.voice-select {
  width: 140px;
}

.style-select {
  width: 130px;
}

.degree-box {
  display: flex;
  align-items: center;
  gap: 4px;
}

.deg-label {
  font-size: 11px;
  color: var(--text-muted);
}

.degree-select {
  width: 105px;
}

.seg-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.seg-text-input :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.5;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.character-mapping-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.mapping-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 14px;
}

.char-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.line-count {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: normal;
}

.voice-picker-wrap {
  width: 220px;
}
</style>
