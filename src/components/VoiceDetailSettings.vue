<template>
  <div class="voice-detail-container">
    <!-- 当前选中音色展示头部 -->
    <div class="voice-hero-card">
      <div
        class="hero-avatar"
        :style="{ backgroundColor: currentVoice.avatarColor || (currentVoice.gender === 'Female' ? '#ec4899' : '#3b82f6') }"
      >
        {{ currentVoice.displayName.slice(0, 1) }}
      </div>
      <div class="hero-info">
        <div class="hero-name-row">
          <h2 class="hero-name">{{ currentVoice.displayName }}</h2>
          <el-tag size="small" :type="currentVoice.gender === 'Female' ? 'danger' : 'primary'">
            {{ currentVoice.gender === 'Female' ? '女声' : '男声' }}
          </el-tag>
          <el-tag size="small" type="info">{{ currentVoice.locale }}</el-tag>

          <!-- 收藏当前音色按钮 -->
          <el-button
            size="small"
            :type="ttsStore.isVoiceFavorite(currentVoice.name) ? 'warning' : 'default'"
            round
            class="hero-fav-btn"
            @click="ttsStore.toggleFavoriteVoice(currentVoice.name)"
          >
            <el-icon><StarFilled /></el-icon>
            {{ ttsStore.isVoiceFavorite(currentVoice.name) ? '已收藏' : '收藏音色' }}
          </el-button>
        </div>
        <p class="hero-desc">{{ currentVoice.description || '微软官方高品质神经网络音色' }}</p>
      </div>
    </div>

    <!-- 1. 说话风格网格 (Style) -->
    <div v-if="hasStyles" class="section-block">
      <div class="section-title-row">
        <div class="title-with-icon">
          <el-icon class="icon-magic"><MagicStick /></el-icon>
          <span class="title-text">说话风格与情感 (Style)</span>
        </div>
        <span class="sub-tip">点击切换情感色彩</span>
      </div>

      <div class="styles-grid">
        <!-- 默认自然无风格 -->
        <div
          class="style-chip"
          :class="{ active: !ttsStore.settings.style }"
          @click="ttsStore.settings.style = ''"
        >
          <div class="chip-dot" />
          <span class="chip-label">自然/标准</span>
        </div>

        <div
          v-for="st in currentVoice.styleList"
          :key="st"
          class="style-chip"
          :class="{ active: ttsStore.settings.style === st }"
          @click="ttsStore.settings.style = st"
        >
          <div class="chip-dot" />
          <span class="chip-label">{{ getStyleLabel(st) }}</span>
          <span class="chip-sub">({{ st }})</span>
        </div>
      </div>

      <!-- 风格强度 (StyleDegree) 控制滑块 -->
      <div v-if="ttsStore.settings.style" class="style-degree-panel">
        <div class="slider-header">
          <span class="slider-title">风格强度 (Style Degree):</span>
          <span class="slider-value">{{ ttsStore.settings.styleDegree.toFixed(1) }}x</span>
        </div>
        <el-slider
          v-model="ttsStore.settings.styleDegree"
          :min="0.5"
          :max="2.0"
          :step="0.1"
          :marks="{ 0.5: '弱', 1.0: '标准', 1.5: '浓郁', 2.0: '极强' }"
        />
      </div>
    </div>

    <!-- 2. 角色扮演 (Role) -->
    <div v-if="hasRoles" class="section-block">
      <div class="section-title-row">
        <div class="title-with-icon">
          <el-icon class="icon-user"><User /></el-icon>
          <span class="title-text">角色扮演 (Role-play)</span>
        </div>
      </div>

      <div class="role-selector-row">
        <el-select
          v-model="ttsStore.settings.role"
          placeholder="无特定角色 (保持默认)"
          clearable
          style="width: 100%"
        >
          <el-option label="默认声音" value="" />
          <el-option
            v-for="role in currentVoice.rolePlayList"
            :key="role"
            :label="`${getRoleLabel(role)} (${role})`"
            :value="role"
          />
        </el-select>
      </div>
    </div>

    <!-- 3. 基础参数微调 (Rate, Pitch, Volume) -->
    <div class="section-block">
      <div class="section-title-row">
        <div class="title-with-icon">
          <el-icon class="icon-operation"><Operation /></el-icon>
          <span class="title-text">韵律与声学微调 (Prosody)</span>
        </div>
        <el-button link type="primary" size="small" @click="resetProsody">
          <el-icon><RefreshRight /></el-icon>
          重置
        </el-button>
      </div>

      <div class="prosody-sliders-list">
        <!-- 语速 -->
        <div class="prosody-item">
          <div class="item-meta">
            <span class="item-name">语速 (Rate)</span>
            <span class="item-val">{{ ttsStore.settings.rate >= 0 ? '+' : '' }}{{ ttsStore.settings.rate }}%</span>
          </div>
          <el-slider
            v-model="ttsStore.settings.rate"
            :min="-50"
            :max="100"
            :step="5"
            :marks="{ '-50': '-50%', 0: '原速', 50: '+50%', 100: '+100%' }"
          />
        </div>

        <!-- 音调 -->
        <div class="prosody-item">
          <div class="item-meta">
            <span class="item-name">音调 (Pitch)</span>
            <span class="item-val">{{ ttsStore.settings.pitch >= 0 ? '+' : '' }}{{ ttsStore.settings.pitch }}%</span>
          </div>
          <el-slider
            v-model="ttsStore.settings.pitch"
            :min="-50"
            :max="50"
            :step="2"
            :marks="{ '-50': '-50%', 0: '标准', 50: '+50%' }"
          />
        </div>

        <!-- 音量 -->
        <div class="prosody-item">
          <div class="item-meta">
            <span class="item-name">音量 (Volume)</span>
            <span class="item-val">{{ ttsStore.settings.volume }}%</span>
          </div>
          <el-slider
            v-model="ttsStore.settings.volume"
            :min="0"
            :max="100"
            :step="5"
            :marks="{ 0: '静音', 50: '50%', 100: '100%' }"
          />
        </div>
      </div>
    </div>

    <!-- 4. 音频输出格式选择 -->
    <div class="section-block compact">
      <div class="format-row">
        <span class="format-label">格式:</span>
        <el-radio-group v-model="ttsStore.settings.audioOutputFormat" size="small">
          <el-radio-button label="Audio24Khz48KBitRateMonoMp3">MP3</el-radio-button>
          <el-radio-button label="Riff24Khz16BitMonoPcm">WAV (无损)</el-radio-button>
        </el-radio-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTtsStore } from '../stores/ttsStore'
import { STYLE_NAME_MAP, ROLE_NAME_MAP } from '../constants/presets'

const ttsStore = useTtsStore()
const currentVoice = computed(() => ttsStore.currentVoice)

const hasStyles = computed(() => {
  return currentVoice.value.styleList && currentVoice.value.styleList.length > 0
})

const hasRoles = computed(() => {
  return currentVoice.value.rolePlayList && currentVoice.value.rolePlayList.length > 0
})

const getStyleLabel = (style: string) => {
  return STYLE_NAME_MAP[style] || style
}

const getRoleLabel = (role: string) => {
  return ROLE_NAME_MAP[role] || role
}

const resetProsody = () => {
  ttsStore.settings.rate = 0
  ttsStore.settings.pitch = 0
  ttsStore.settings.volume = 100
}
</script>

<style scoped>
.voice-detail-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.voice-hero-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-sm);
}

.hero-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.hero-info {
  flex: 1;
}

.hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.hero-fav-btn {
  margin-left: auto;
  font-size: 11px;
  padding: 0 8px;
  height: 24px;
}

.hero-desc {
  font-size: 12px;
  color: var(--text-regular);
  margin-top: 3px;
}

.section-block {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
}

.section-block.compact {
  padding: 10px 14px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-with-icon .el-icon {
  font-size: 15px;
  color: var(--azure-blue);
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.sub-tip {
  font-size: 11px;
  color: var(--text-muted);
}

.styles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.style-chip {
  padding: 6px 10px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  position: relative;
}

.style-chip:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.style-chip.active {
  border-color: var(--azure-blue);
  background: #eff6ff;
  box-shadow: 0 0 0 1px var(--azure-blue);
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #cbd5e1;
  position: absolute;
  top: 6px;
  right: 6px;
}

.style-chip.active .chip-dot {
  background: var(--azure-blue);
}

.chip-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
}

.chip-sub {
  font-size: 9px;
  color: var(--text-muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style-degree-panel {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid var(--border-light);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-regular);
  margin-bottom: 4px;
}

.slider-value {
  color: var(--azure-blue);
  font-family: monospace;
}

.role-selector-row {
  display: flex;
  align-items: center;
}

.prosody-sliders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prosody-item {
  padding-bottom: 4px;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-regular);
  margin-bottom: 2px;
}

.item-val {
  font-family: monospace;
  font-weight: 600;
  color: var(--azure-blue);
}

.format-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.format-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-regular);
}
</style>
