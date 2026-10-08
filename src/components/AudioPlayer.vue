<template>
  <div class="audio-player-card" :class="{ 'is-ready': Boolean(audioUrl) }">
    <audio
      ref="audioEl"
      :src="audioUrl"
      @play="onAudioPlay"
      @pause="onAudioPause"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onAudioEnded"
    />

    <!-- 左侧主播放/暂停大按钮 -->
    <button
      class="play-main-btn"
      :disabled="!audioUrl"
      :title="isPlaying ? '暂停' : '播放'"
      @click="togglePlay"
    >
      <el-icon v-if="!isPlaying"><VideoPlay /></el-icon>
      <el-icon v-else><VideoPause /></el-icon>
    </button>

    <!-- 中间播放信息与进度条 -->
    <div class="player-center">
      <div class="track-info-row">
        <div class="track-meta">
          <span class="track-title">{{ title || '尚未合成音频' }}</span>
          <span v-if="voiceName" class="track-badge">{{ voiceName }}</span>
        </div>
        <div class="time-display">
          <span>{{ formatDuration(currentTime) }}</span>
          <span class="separator">/</span>
          <span>{{ formatDuration(duration) }}</span>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-bar-wrap">
        <el-slider
          v-model="sliderTime"
          :max="duration || 100"
          :disabled="!audioUrl"
          :show-tooltip="false"
          @change="onSliderChange"
          @input="onSliderInput"
        />
      </div>
    </div>

    <!-- 右侧音量与下载动作 -->
    <div class="player-right-actions">
      <!-- 播放倍速 -->
      <el-dropdown trigger="click" @command="changePlaybackRate">
        <span class="speed-btn">
          {{ playbackRate }}x
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :command="0.75">0.75x</el-dropdown-item>
            <el-dropdown-item :command="1.0">1.0x (正常)</el-dropdown-item>
            <el-dropdown-item :command="1.25">1.25x</el-dropdown-item>
            <el-dropdown-item :command="1.5">1.5x</el-dropdown-item>
            <el-dropdown-item :command="2.0">2.0x</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 静音/音量滑块弹出 -->
      <el-popover placement="top" :width="140" trigger="hover">
        <template #reference>
          <button class="icon-btn" :disabled="!audioUrl">
            <el-icon v-if="isMuted || volume === 0"><Mute /></el-icon>
            <el-icon v-else><Headset /></el-icon>
          </button>
        </template>
        <div class="volume-popover">
          <span class="vol-label">{{ Math.round(volume * 100) }}%</span>
          <el-slider v-model="volumePercent" :min="0" :max="100" @input="onVolumeChange" />
        </div>
      </el-popover>

      <!-- 下载音频文件 -->
      <el-tooltip content="下载音频文件到本地" placement="top">
        <button class="icon-btn download" :disabled="!audioUrl" @click="downloadAudio">
          <el-icon><Download /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { formatDuration } from '../utils/ssml'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'

const props = defineProps<{
  audioUrl?: string
  title?: string
  voiceName?: string
  format?: 'mp3' | 'wav'
}>()

const ttsStore = useTtsStore()
const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const sliderTime = ref(0)
const isDragging = ref(false)
const volume = ref(1.0)
const volumePercent = ref(100)
const isMuted = ref(false)
const playbackRate = ref(1.0)

const playAudioNow = () => {
  if (!audioEl.value || !props.audioUrl) return
  audioEl.value.currentTime = 0
  currentTime.value = 0
  sliderTime.value = 0

  const playPromise = audioEl.value.play()
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isPlaying.value = true
      })
      .catch((err) => {
        console.warn('[AudioPlayer] 自动播放受阻或缓冲中:', err)
        // 若因数据加载延迟导致，监听 canplay 触发
        const onCanPlay = () => {
          audioEl.value?.removeEventListener('canplay', onCanPlay)
          audioEl.value
            ?.play()
            .then(() => {
              isPlaying.value = true
            })
            .catch(() => {})
        }
        audioEl.value?.addEventListener('canplay', onCanPlay)
      })
  }
}

// 监听显式播放触发信号 (点击单句试听、重播试听、历史试听)
watch(
  () => ttsStore.playAudioTrigger,
  () => {
    nextTick(() => {
      playAudioNow()
    })
  }
)

watch(
  () => props.audioUrl,
  (newUrl) => {
    if (newUrl) {
      currentTime.value = 0
      sliderTime.value = 0
      isPlaying.value = false
      if (audioEl.value) {
        audioEl.value.load()
      }
    }
  }
)

const togglePlay = () => {
  if (!audioEl.value || !props.audioUrl) return
  if (isPlaying.value) {
    audioEl.value.pause()
  } else {
    audioEl.value
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch((err) => {
        console.warn('[AudioPlayer] 播放失败:', err)
      })
  }
}

const onAudioPlay = () => {
  isPlaying.value = true
}

const onAudioPause = () => {
  isPlaying.value = false
}

const onTimeUpdate = () => {
  if (!audioEl.value || isDragging.value) return
  currentTime.value = audioEl.value.currentTime
  sliderTime.value = audioEl.value.currentTime
}

const onLoadedMetadata = () => {
  if (!audioEl.value) return
  duration.value = audioEl.value.duration || 0
}

const onAudioEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
  sliderTime.value = 0
}

const onSliderInput = (val: number | number[]) => {
  isDragging.value = true
  currentTime.value = typeof val === 'number' ? val : val[0]
}

const onSliderChange = (val: number | number[]) => {
  isDragging.value = false
  const target = typeof val === 'number' ? val : val[0]
  if (audioEl.value) {
    audioEl.value.currentTime = target
  }
}

const onVolumeChange = (val: number | number[]) => {
  const v = (typeof val === 'number' ? val : val[0]) / 100
  volume.value = v
  if (audioEl.value) {
    audioEl.value.volume = v
  }
}

const changePlaybackRate = (rate: number) => {
  playbackRate.value = rate
  if (audioEl.value) {
    audioEl.value.playbackRate = rate
  }
}

const downloadAudio = () => {
  if (!props.audioUrl) {
    ElMessage.warning('暂无可下载的音频')
    return
  }
  const ext = props.format || 'mp3'
  const link = document.createElement('a')
  link.href = props.audioUrl
  link.download = `Azure_TTS_${props.voiceName || 'voice'}_${Date.now()}.${ext}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success('已开始下载音频文件')
}
</script>

<style scoped>
.audio-player-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.audio-player-card.is-ready {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%);
}

.play-main-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: var(--azure-blue);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 120, 212, 0.3);
}

.play-main-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.05);
}

.play-main-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  box-shadow: none;
}

.player-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.track-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.track-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.track-title {
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.track-badge {
  font-size: 11px;
  padding: 1px 6px;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 4px;
  font-weight: 500;
}

.time-display {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

.progress-bar-wrap {
  padding: 0 2px;
  margin-top: -6px;
}

.player-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-regular);
  display: flex;
  align-items: center;
  gap: 2px;
}

.speed-btn:hover {
  background: #e2e8f0;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--text-regular);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: var(--azure-blue);
}

.icon-btn.download:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
  color: var(--azure-blue);
}

.icon-btn:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
  border-color: #f1f5f9;
}

.volume-popover {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
}

.vol-label {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted);
  width: 32px;
}
</style>
