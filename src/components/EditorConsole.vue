<template>
  <div class="editor-console-card">
    <!-- 顶部工具栏 -->
    <div class="editor-header">
      <div class="editor-header-left">
        <el-icon class="icon-edit"><EditPen /></el-icon>
        <span class="header-title">待合成文本内容</span>
        <span class="char-stat" :class="{ 'over-warning': ttsStore.pureCharCount > 5000 }">
          <strong>{{ ttsStore.pureCharCount }}</strong> 字
        </span>
      </div>

      <div class="editor-header-actions">
        <!-- AI 导演智能分镜唤起按钮 -->
        <el-button
          size="small"
          type="success"
          plain
          @click="showAiModal = true"
        >
          <el-icon><MagicStick /></el-icon>
          AI 智能剧本分镜
        </el-button>

        <!-- 范例文本快捷插入下拉 -->
        <el-dropdown trigger="click" @command="insertSampleText">
          <el-button size="small">
            <el-icon><Document /></el-icon>
            示范文本
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="dialogue">🎭 多角色/多音色/多风格对话 SSML 范例</el-dropdown-item>
              <el-dropdown-item command="news">📰 新闻专业播报范例</el-dropdown-item>
              <el-dropdown-item command="story">📖 有声小说情感叙事范例</el-dropdown-item>
              <el-dropdown-item command="live">🛍️ 电商直播带货快节奏范例</el-dropdown-item>
              <el-dropdown-item command="assistant">🤖 智能车载/家居语音助手</el-dropdown-item>
              <el-dropdown-item command="whisper">🌙 睡前低语解压治愈</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button size="small" @click="handleClearText">
          <el-icon><Delete /></el-icon>
          清空
        </el-button>

        <!-- 查看/编辑原始 SSML 切换 -->
        <el-button
          size="small"
          :type="showSSML ? 'primary' : 'default'"
          plain
          @click="toggleSSML"
        >
          <el-icon><Tickets /></el-icon>
          {{ showSSML ? '收起 SSML' : '查看/编辑 SSML' }}
        </el-button>
      </div>
    </div>

    <!-- 文本编辑区 -->
    <div class="editor-body">
      <!-- 模式 1：AI 智能分镜可视化段落列表 -->
      <div v-if="ttsStore.scriptSegments.length > 0 && !showSSML" class="segments-container-wrap">
        <SegmentsViewer
          @exit-segments="handleExitSegments"
          @view-merged-ssml="handleViewMergedSsml"
        />
      </div>

      <!-- 模式 2：常规单文本输入 -->
      <div v-show="ttsStore.scriptSegments.length === 0 && !showSSML" class="text-input-wrapper">
        <el-input
          v-model="ttsStore.inputText"
          type="textarea"
          resize="none"
          placeholder="在此键入或粘贴您需要合成为语音的文字..."
          class="custom-textarea"
        />
      </div>

      <!-- 模式 3：SSML 原始代码编辑器 -->
      <div v-show="showSSML" class="ssml-editor-wrapper">
        <div class="ssml-notice">
          <el-icon><InfoFilled /></el-icon>
          <span>此为 Azure 语音合成标记语言（SSML）视图。您可在此直接编写 SSML 标签。</span>
          <el-button link type="primary" size="small" @click="syncFromGeneratedSSML">
            重新根据左侧控件生成
          </el-button>
        </div>
        <el-input
          v-model="customSSMLText"
          type="textarea"
          resize="none"
          placeholder="<speak version='1.0'>...</speak>"
          class="ssml-textarea"
        />
      </div>
    </div>

    <!-- 底部控制栏：主触发合成按钮 & 播放器 -->
    <div class="editor-footer">
      <div class="action-btn-row">
        <el-button
          type="primary"
          size="large"
          class="synthesize-btn"
          :loading="ttsStore.isSynthesizing"
          @click="handleSynthesize"
        >
          <el-icon v-if="!ttsStore.isSynthesizing"><VideoPlay /></el-icon>
          <span>{{ ttsStore.isSynthesizing ? '正在请求微软云端合成...' : '立即生成语音 (Synthesize)' }}</span>
        </el-button>
      </div>

      <!-- 集成高质感播放器 -->
      <div class="player-wrapper">
        <AudioPlayer
          :audio-url="ttsStore.currentAudioUrl"
          :title="ttsStore.currentAudioTitle || latestTitle"
          :voice-name="ttsStore.currentAudioVoiceName || ttsStore.currentVoice.displayName"
          :format="ttsStore.settings.audioOutputFormat === 'Riff24Khz16BitMonoPcm' ? 'wav' : 'mp3'"
        />
      </div>
    </div>

    <!-- AI 导演输入对话框 -->
    <AiDirectorModal
      v-model="showAiModal"
      @script-parsed="onScriptParsed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { buildSsmlFromSegments } from '../utils/ssml'
import AudioPlayer from './AudioPlayer.vue'
import AiDirectorModal from './AiDirectorModal.vue'
import SegmentsViewer from './SegmentsViewer.vue'

const ttsStore = useTtsStore()
const showSSML = ref(false)
const showAiModal = ref(false)
const customSSMLText = ref(ttsStore.currentSSML)

// 跟踪默认合成文本片段作为备用标题
const latestTitle = computed(() => {
  if (!ttsStore.currentAudioUrl) return '尚未合成音频'
  return ttsStore.inputText.slice(0, 35) + (ttsStore.inputText.length > 35 ? '...' : '')
})

watch(
  () => ttsStore.currentSSML,
  (newVal) => {
    // 只有在没打开手动编辑模式时才自动覆盖
    if (!showSSML.value) {
      customSSMLText.value = newVal
    }
  }
)

const toggleSSML = () => {
  showSSML.value = !showSSML.value
  if (showSSML.value) {
    customSSMLText.value = ttsStore.currentSSML
  }
}

const syncFromGeneratedSSML = () => {
  customSSMLText.value = ttsStore.currentSSML
  ElMessage.success('已同步最新控件参数至 SSML')
}

const onScriptParsed = () => {
  showSSML.value = false
  // 自动将分镜合并生成的 SSML 准备好
  customSSMLText.value = buildSsmlFromSegments(ttsStore.scriptSegments)
}

const handleExitSegments = () => {
  ttsStore.scriptSegments = []
}

const handleViewMergedSsml = () => {
  customSSMLText.value = buildSsmlFromSegments(ttsStore.scriptSegments)
  showSSML.value = true
}

const handleClearText = () => {
  ttsStore.inputText = ''
  ttsStore.scriptSegments = []
}

const SAMPLE_TEXTS: Record<string, { text: string; style?: string; isSSML?: boolean }> = {
  dialogue: {
    isSSML: true,
    text: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <!-- 角色 1：Nancy 呐喊愤怒 -->
    <voice name="en-US-NancyNeural">
        <mstts:express-as style="shouting">
            "We are friends now, I don't understand why you don't discuss your plans!"
        </mstts:express-as>
        <mstts:express-as style="Default">
            <prosody contour="(0%, -36%) (44%, -36%) (65%, -4%) (77%, +57%) (85%, +0%)">
                I shouted.
            </prosody>
        </mstts:express-as>
    </voice>

    <!-- 角色 2：Davis 警惕冷漠 -->
    <voice name="en-US-DavisNeural">
        <mstts:express-as style="unfriendly">
            "<prosody contour="(4%, -1%) (49%, +0%) (76%, +49%) (83%, -27%)">I needed to make certain</prosody>
            <prosody contour="(63%, -5%) (76%, +54%) (85%, -4%)">you didn't attempt to harm me.</prosody>"
        </mstts:express-as>
    </voice>

    <!-- 角色 1：Nancy 惊恐/恐慌 -->
    <voice name="en-US-NancyNeural">
        <mstts:express-as style="terrified">
            <prosody rate="-15.00%">
                "I just wanted to help you, otherwise how can we escape from this planet?"
            </prosody>
        </mstts:express-as>
    </voice>

    <!-- 角色 2：Davis 伤心低落 -->
    <voice name="en-US-DavisNeural">
        <mstts:express-as style="sad">
            "I don't have a chance to think about it, leave me alone please."
        </mstts:express-as>
    </voice>

    <!-- 旁白叙述 -->
    <voice name="en-US-NancyNeural">
        <mstts:express-as style="Default">
            he said. I didn't answer, and I turned around and closed the door.
        </mstts:express-as>
    </voice>
</speak>`
  },
  news: {
    text: '观众朋友们晚上好，今天是十月六日。根据气象部门发布的最新快讯，未来三天冷空气将自西向东影响我国大部分地区，气温普降四到六摄氏度，请广大市民注意添衣保暖。',
    style: 'newscast'
  },
  story: {
    text: '夜色深沉，远处的钟楼敲响了十二下。风穿过古老而狭窄的巷道，发出一阵阵呜咽般的声响。他紧握着手里的信件，指关节泛白，心中翻江倒海，那正是寻找了整整十年的答案……',
    style: 'narration-relaxed'
  },
  live: {
    text: '宝宝们看过来！今天给咱们直播间所有粉丝带来的重磅福利！全场现货直降，最后五十单，手慢无，三二一，马上上链接！抢到就是赚到！',
    style: 'livecommercial'
  },
  assistant: {
    text: '早上好！今天天气晴朗，气温 23 摄氏度，路况良好。您的日程表显示，上午十点有一个产品研讨会议，我已经为您调整好会议室温度。',
    style: 'assistant'
  },
  whisper: {
    text: '闭上眼睛，深深地吸一口气……放下所有的疲惫与焦虑。在这个安静的夜晚，愿你拥有一个温暖而香甜的美梦……',
    style: 'whispering'
  }
}

const insertSampleText = (type: string) => {
  const item = SAMPLE_TEXTS[type]
  if (item) {
    if (item.isSSML) {
      showSSML.value = true
      customSSMLText.value = item.text
      ElMessage.success('已切换至 SSML 视图并载入多角色/多音色/多风格对话代码')
      return
    }
    showSSML.value = false
    ttsStore.inputText = item.text
    if (item.style && ttsStore.currentVoice.styleList?.includes(item.style)) {
      ttsStore.settings.style = item.style
    }
    ElMessage.success('已载入示范文本与推荐语境')
  }
}

const handleSynthesize = async () => {
  // 如果当前处于分镜模式且未打开代码视图
  if (ttsStore.scriptSegments.length > 0 && !showSSML.value) {
    try {
      const mergedSsml = buildSsmlFromSegments(ttsStore.scriptSegments)
      await ttsStore.synthesize(mergedSsml)
      ElMessage.success('全部分镜多角色语音合成完毕！')
    } catch (err: any) {
      ElMessage.error({
        message: err?.message || '生成失败，请检查配置与网络',
        duration: 5000
      })
    }
    return
  }

  if (!ttsStore.pureCharCount && !customSSMLText.value) {
    ElMessage.warning('请输入需要合成的文字')
    return
  }

  try {
    const ssml = showSSML.value ? customSSMLText.value : undefined
    await ttsStore.synthesize(ssml)
    ElMessage.success('语音生成完毕！')
  } catch (err: any) {
    ElMessage.error({
      message: err?.message || '生成失败，请检查配置与网络',
      duration: 5000
    })
  }
}
</script>

<style scoped>
.editor-console-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.editor-header {
  padding: 12px 18px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.editor-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-edit {
  font-size: 16px;
  color: var(--azure-blue);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.char-stat {
  font-size: 12px;
  color: var(--text-muted);
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 4px;
}

.char-stat.over-warning {
  color: #dc2626;
  background: #fee2e2;
}

.editor-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-body {
  padding: 16px;
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.segments-container-wrap {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.text-input-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.custom-textarea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.custom-textarea :deep(.el-textarea__inner) {
  border: none;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-main);
  box-shadow: none;
  padding: 4px;
  height: 100% !important;
  min-height: 100% !important;
}

.custom-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

.ssml-editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.ssml-notice {
  font-size: 12px;
  color: #475569;
  background: #f1f5f9;
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ssml-textarea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ssml-textarea :deep(.el-textarea__inner) {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background-color: #0f172a;
  color: #38bdf8;
  border-radius: 8px;
  border: 1px solid #1e293b;
  height: 100% !important;
  min-height: 100% !important;
}

.editor-footer {
  padding: 14px 18px;
  background: #f8fafc;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.action-btn-row {
  display: flex;
  justify-content: flex-end;
}

.synthesize-btn {
  height: 44px;
  padding: 0 28px;
  font-size: 15px;
  font-weight: 600;
  background: var(--azure-gradient);
  border: none;
  box-shadow: 0 4px 14px rgba(0, 120, 212, 0.35);
  transition: all 0.2s ease;
}

.synthesize-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 120, 212, 0.45);
}

.player-wrapper {
  margin-top: 4px;
}
</style>
