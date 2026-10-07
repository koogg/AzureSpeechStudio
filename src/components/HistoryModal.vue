<template>
  <el-dialog
    v-model="visible"
    title="最近合成历史"
    width="680px"
    align-center
    class="history-dialog"
  >
    <div class="history-dialog-content">
      <div class="dialog-top-bar">
        <span class="count-tip">共保存 <strong>{{ ttsStore.historyList.length }}</strong> 条本地记录</span>
        <el-button
          v-if="ttsStore.historyList.length > 0"
          type="danger"
          link
          size="small"
          @click="handleClear"
        >
          <el-icon><Delete /></el-icon>
          清空所有记录
        </el-button>
      </div>

      <!-- 历史卡片列表 -->
      <div v-if="ttsStore.historyList.length > 0" class="history-modal-list">
        <div
          v-for="item in ttsStore.historyList"
          :key="item.id"
          class="history-modal-card"
        >
          <div class="card-header-line">
            <div class="speaker-meta">
              <span class="name">{{ item.voiceDisplayName }}</span>
              <span v-if="item.style" class="style-badge">{{ getStyleLabel(item.style) }}</span>
              <span v-if="item.role" class="role-badge">{{ item.role }}</span>
            </div>
            <span class="time-str">{{ formatTime(item.timestamp) }}</span>
          </div>

          <p class="history-content-text">{{ item.text }}</p>

          <div class="card-footer-line">
            <div class="footer-left-info">
              <span class="info-tag">{{ item.charCount }} 字符</span>
              <span class="info-tag">{{ item.audioFormat.toUpperCase() }}</span>
            </div>

            <div class="footer-actions">
              <!-- 播放试听 -->
              <el-button
                size="small"
                type="primary"
                circle
                :loading="loadingAudioId === item.id"
                title="播放试听"
                @click="playHistoryAudio(item)"
              >
                <el-icon><VideoPlay /></el-icon>
              </el-button>

              <!-- 回填文本到输入框 -->
              <el-button
                size="small"
                circle
                title="回填至编辑框"
                @click="loadTextToEditor(item.text)"
              >
                <el-icon><DocumentCopy /></el-icon>
              </el-button>

              <!-- 下载音频 -->
              <el-button
                size="small"
                circle
                title="下载音频"
                @click="downloadItemAudio(item)"
              >
                <el-icon><Download /></el-icon>
              </el-button>

              <!-- 删除单条 -->
              <el-button
                size="small"
                type="danger"
                plain
                circle
                title="删除此条"
                @click="ttsStore.deleteHistoryItem(item.id)"
              >
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-wrap">
        <el-empty description="暂无历史合成记录" />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { STYLE_NAME_MAP } from '../constants/presets'
import type { HistoryItem } from '../types/tts'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const ttsStore = useTtsStore()
const loadingAudioId = ref<string>('')

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const getStyleLabel = (style?: string) => {
  if (!style) return ''
  return STYLE_NAME_MAP[style] || style
}

const formatTime = (ts: number) => {
  const date = new Date(ts)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

const playHistoryAudio = async (item: HistoryItem) => {
  loadingAudioId.value = item.id
  try {
    const success = await ttsStore.playHistoryItemAudio(item)
    if (success) {
      ElMessage.success(`已载入「${item.voiceDisplayName}」录音并开始播放`)
      visible.value = false
    } else {
      ElMessage.warning('未能加载该录音，可尝试点击回填文本后重新合成')
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '播放历史录音失败')
  } finally {
    loadingAudioId.value = ''
  }
}

const loadTextToEditor = (text: string) => {
  ttsStore.inputText = text
  ElMessage.success('已回填至主输入框')
  visible.value = false
}

const downloadItemAudio = async (item: HistoryItem) => {
  // 确保有 audioBlob
  let blob = item.audioBlob
  if (!blob) {
    await ttsStore.playHistoryItemAudio(item)
    blob = item.audioBlob || ttsStore.currentAudioBlob || undefined
  }
  if (blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Azure_TTS_${item.voiceDisplayName}_${item.id}.${item.audioFormat}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } else {
    ElMessage.warning('音频数据已失效')
  }
}

const handleClear = () => {
  ElMessageBox.confirm('确定要清空所有历史合成记录吗？', '提示', {
    confirmButtonText: '确定清空',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ttsStore.clearHistory()
    ElMessage.success('已清空所有历史记录')
  })
}
</script>

<style scoped>
.history-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.history-modal-list {
  max-height: 480px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.history-modal-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
}

.history-modal-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card-header-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.speaker-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.style-badge,
.role-badge {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 1px 6px;
  border-radius: 4px;
}

.role-badge {
  background: #f5f3ff;
  color: #6d28d9;
}

.time-str {
  font-size: 11px;
  color: var(--text-muted);
}

.history-content-text {
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 72px;
  overflow-y: auto;
}

.card-footer-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed #f1f5f9;
  padding-top: 8px;
}

.footer-left-info {
  display: flex;
  gap: 6px;
}

.info-tag {
  font-size: 11px;
  color: var(--text-muted);
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.footer-actions {
  display: flex;
  gap: 6px;
}

.empty-wrap {
  padding: 30px;
}
</style>
