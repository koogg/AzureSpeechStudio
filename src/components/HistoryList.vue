<template>
  <div class="history-panel-container">
    <div class="panel-header">
      <div class="header-title-box">
        <el-icon class="icon-clock"><Clock /></el-icon>
        <span class="header-title">最近合成历史 ({{ ttsStore.historyList.length }})</span>
      </div>

      <div v-if="ttsStore.historyList.length > 0" class="header-actions">
        <el-button link type="danger" size="small" @click="handleClear">
          <el-icon><Delete /></el-icon>
          清空全部
        </el-button>
      </div>
    </div>

    <!-- 列表区 -->
    <div v-if="ttsStore.historyList.length > 0" class="history-list">
      <div
        v-for="item in ttsStore.historyList"
        :key="item.id"
        class="history-card"
      >
        <div class="card-top-row">
          <div class="speaker-tag">
            <span class="speaker-name">{{ item.voiceDisplayName }}</span>
            <span v-if="item.style" class="speaker-style">{{ getStyleLabel(item.style) }}</span>
            <span v-if="item.role" class="speaker-role">{{ item.role }}</span>
          </div>
          <div class="card-time">{{ formatTime(item.timestamp) }}</div>
        </div>

        <!-- 文本摘要 -->
        <p class="history-snippet" :title="item.text">
          {{ item.text }}
        </p>

        <!-- 底部信息与动作 -->
        <div class="card-bottom-row">
          <div class="meta-tags">
            <span class="char-count-tag">{{ item.charCount }} 字符</span>
            <span class="format-tag">{{ item.audioFormat.toUpperCase() }}</span>
          </div>

          <div class="card-actions">
            <!-- 播放该条音频 -->
            <el-button
              v-if="item.audioUrl"
              size="small"
              circle
              type="primary"
              plain
              title="试听"
              @click="playHistoryAudio(item)"
            >
              <el-icon><VideoPlay /></el-icon>
            </el-button>

            <!-- 复制文本回填 -->
            <el-button
              size="small"
              circle
              title="载入此文本到编辑区"
              @click="loadTextToEditor(item.text)"
            >
              <el-icon><DocumentCopy /></el-icon>
            </el-button>

            <!-- 下载 -->
            <el-button
              v-if="item.audioUrl"
              size="small"
              circle
              title="下载音频"
              @click="downloadItemAudio(item)"
            >
              <el-icon><Download /></el-icon>
            </el-button>

            <!-- 单条删除 -->
            <el-button
              size="small"
              circle
              type="danger"
              plain
              title="删除"
              @click="ttsStore.deleteHistoryItem(item.id)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-history">
      <el-empty :image-size="60" description="暂无历史合成记录" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { STYLE_NAME_MAP } from '../constants/presets'
import type { HistoryItem } from '../types/tts'

const ttsStore = useTtsStore()

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
  try {
    const success = await ttsStore.playHistoryItemAudio(item)
    if (success) {
      ElMessage.success(`已载入「${item.voiceDisplayName}」的历史录音并播放`)
    } else {
      ElMessage.warning('未能加载该录音')
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '播放历史录音失败')
  }
}

const loadTextToEditor = (text: string) => {
  ttsStore.inputText = text
  ElMessage.success('已载入文本到编辑区')
}

const downloadItemAudio = (item: HistoryItem) => {
  if (!item.audioUrl) return
  const link = document.createElement('a')
  link.href = item.audioUrl
  link.download = `Azure_TTS_${item.voiceDisplayName}_${item.id}.${item.audioFormat}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
.history-panel-container {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  max-height: calc(100vh - 120px);
  overflow: hidden;
}

.panel-header {
  padding: 14px 18px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-clock {
  color: var(--azure-blue);
  font-size: 16px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.history-list {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
}

.history-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.speaker-tag {
  display: flex;
  align-items: center;
  gap: 6px;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.speaker-style,
.speaker-role {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 1px 6px;
  border-radius: 4px;
}

.speaker-role {
  background: #f5f3ff;
  color: #6d28d9;
}

.card-time {
  font-size: 11px;
  color: var(--text-muted);
}

.history-snippet {
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.card-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed #f1f5f9;
  padding-top: 6px;
}

.meta-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.char-count-tag,
.format-tag {
  font-size: 10px;
  color: var(--text-muted);
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 3px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-history {
  padding: 40px 20px;
  text-align: center;
}
</style>
