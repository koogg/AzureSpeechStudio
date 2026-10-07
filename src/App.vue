<template>
  <div class="workbench-layout">
    <!-- 顶部导航栏 -->
    <HeaderBar
      @open-quota="showQuotaModal = true"
      @open-history="showHistoryModal = true"
    />

    <!-- 主体双列并排工作台布局 -->
    <main class="workbench-body">
      <div class="workbench-main-split">
        <!-- 左侧列：大文本输入区与高质感音频播放控制台 -->
        <section class="left-editor-section">
          <div class="current-voice-status-bar">
            <div class="voice-status-left">
              <span class="label-text">当前发音人:</span>
              <el-tag effect="dark" type="primary" class="voice-name-tag">
                {{ ttsStore.currentVoice.displayName }}
                <span v-if="ttsStore.settings.style"> ({{ getStyleLabel(ttsStore.settings.style) }})</span>
              </el-tag>
              <el-tag
                v-if="ttsStore.isVoiceFavorite(ttsStore.currentVoice.name)"
                effect="plain"
                type="warning"
                size="small"
              >
                ★ 已收藏
              </el-tag>
            </div>

            <div class="voice-status-right">
              <span class="locale-label">{{ ttsStore.currentVoice.localeName || ttsStore.currentVoice.locale }}</span>
            </div>
          </div>

          <!-- 文本编辑控制台 & 播放器 -->
          <EditorConsole />
        </section>

        <!-- 右侧列：原本历史记录位置，现放置「音色库」与「精细调音」切换卡片 -->
        <aside class="right-voice-control-section">
          <div class="control-panel-card">
            <!-- 切换标签头 -->
            <div class="panel-tabs-header">
              <div
                class="tab-btn"
                :class="{ active: currentPanelTab === 'gallery' }"
                @click="currentPanelTab = 'gallery'"
              >
                <el-icon><Menu /></el-icon>
                <span>音色与风格库</span>
              </div>

              <div
                class="tab-btn"
                :class="{ active: currentPanelTab === 'tuning' }"
                @click="currentPanelTab = 'tuning'"
              >
                <el-icon><Operation /></el-icon>
                <span>精细调音</span>
              </div>
            </div>

            <!-- 面板内容体 -->
            <div class="panel-tabs-content">
              <div v-show="currentPanelTab === 'gallery'" class="tab-pane">
                <VoiceGallery />
              </div>

              <div v-show="currentPanelTab === 'tuning'" class="tab-pane">
                <VoiceDetailSettings />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <!-- 50万字符配额看板模态窗 -->
    <QuotaModal v-model="showQuotaModal" />

    <!-- 最近合成历史模态窗 (右上角独立按钮唤起) -->
    <HistoryModal v-model="showHistoryModal" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTtsStore } from './stores/ttsStore'
import { STYLE_NAME_MAP } from './constants/presets'
import HeaderBar from './components/HeaderBar.vue'
import VoiceGallery from './components/VoiceGallery.vue'
import VoiceDetailSettings from './components/VoiceDetailSettings.vue'
import EditorConsole from './components/EditorConsole.vue'
import QuotaModal from './components/QuotaModal.vue'
import HistoryModal from './components/HistoryModal.vue'

const ttsStore = useTtsStore()
const currentPanelTab = ref<'gallery' | 'tuning'>('gallery')
const showQuotaModal = ref(false)
const showHistoryModal = ref(false)

const getStyleLabel = (style: string) => {
  return STYLE_NAME_MAP[style] || style
}
</script>

<style scoped>
.workbench-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-app);
  overflow: hidden;
}

.workbench-body {
  max-width: 1760px;
  width: 100%;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.workbench-main-split {
  display: grid;
  grid-template-columns: minmax(500px, 1fr) 460px;
  gap: 20px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

@media (max-width: 1100px) {
  .workbench-layout {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .workbench-main-split {
    grid-template-columns: 1fr;
  }
}

.left-editor-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.current-voice-status-bar {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.voice-status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-text {
  font-size: 13px;
  color: var(--text-muted);
}

.voice-name-tag {
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
}

.locale-label {
  font-size: 12px;
  color: var(--text-muted);
}

.right-voice-control-section {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.control-panel-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel-tabs-header {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: var(--azure-blue);
  background: #f1f5f9;
}

.tab-btn.active {
  color: var(--azure-blue);
  background: #ffffff;
  border-bottom-color: var(--azure-blue);
}

.panel-tabs-content {
  padding: 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-pane {
  animation: fadeIn 0.15s ease-in-out;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
