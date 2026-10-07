<template>
  <el-dialog
    v-model="visible"
    title="🪄 AI 导演：智能剧本分镜与多角色配音"
    width="680px"
    align-center
    class="ai-script-dialog"
  >
    <div class="ai-dialog-body">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="dialog-tip"
      >
        <template #title>
          输入纯小说、对话或台词剧本。AI 将根据上下文语义自动识别说话人、从音色库中分配最佳音色，并标记真实情感风格与强度。
        </template>
      </el-alert>

      <!-- 快速填入测试示例 -->
      <div class="quick-sample-row">
        <span class="sample-label">填入示例剧本:</span>
        <el-button link type="primary" size="small" @click="loadSampleScript('thriller')">
          悬疑对峙 (云希 & 晓晓)
        </el-button>
        <el-button link type="primary" size="small" @click="loadSampleScript('scifi')">
          星际逃生 (多角色)
        </el-button>
      </div>

      <!-- 剧本输入框 -->
      <el-input
        v-model="scriptInput"
        type="textarea"
        :rows="7"
        resize="none"
        placeholder="在此输入或粘贴小说、剧本、双人/多人对话纯文本..."
        class="script-input-area"
      />

      <!-- 候选音色范围选择 -->
      <div class="voice-scope-selector">
        <span class="scope-label">候选音色库范围:</span>
        <el-radio-group v-model="voiceScope" size="small">
          <el-radio-button value="favorites">
            ★ 仅限我的收藏 ({{ favoriteVoicesCount }})
          </el-radio-button>
          <el-radio-button value="auto_multistyle">
            ✨ 智能多风格音色库 (推荐)
          </el-radio-button>
          <el-radio-button value="all_language">
            全量音色库
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="model-hint-bar">
        <span>当前大模型: <strong>{{ ttsStore.openAiConfig.model || '未配置' }}</strong> (可在右上角配置设置)</span>
      </div>
    </div>

    <template #footer>
      <div class="ai-dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="ttsStore.isAiAnalyzing"
          @click="startAiAnalyze"
        >
          <el-icon><MagicStick /></el-icon>
          开始 AI 智能拆解与配镜
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { OpenAiDirectorService } from '../services/openAiService'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue', 'script-parsed'])

const ttsStore = useTtsStore()
const scriptInput = ref('')
const voiceScope = ref<'favorites' | 'auto_multistyle' | 'all_language'>('auto_multistyle')

const favoriteVoicesCount = computed(() => {
  return ttsStore.voices.filter((v) => ttsStore.isVoiceFavorite(v.name)).length
})

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const SAMPLES = {
  thriller: `夜色深沉，远处的钟楼敲响了十二下。风穿过古老而狭窄的巷道。
小雨惊恐地抓住他的衣角：“李明，门外……好像有人在敲门！”
李明冷冷地举起手电筒，压低嗓音呵斥道：“闭嘴！别出声，把灯熄灭！”
小雨带着哭腔小声哀求：“我们逃跑吧，求求你了……”
李明深吸了一口气：“已经太晚了，他们就在窗外。”`,
  scifi: `飞船警报刺耳地尖叫着，红光笼罩了整个驾驶舱。
指挥官愤怒地砸向控制台：“我们现在是盟友，你为什么擅自更改导航坐标？！”
戴维斯冷漠地抬起头：“我必须确保你没有试图伤害我。”
指挥官咆哮道：“我只是想帮你！不然我们怎么逃离这颗该死的星球？！”
戴维斯眼神暗淡下来，叹了口气：“我现在没精力去想这些，请让我一个人静一静。”`
}

const loadSampleScript = (type: 'thriller' | 'scifi') => {
  scriptInput.value = SAMPLES[type]
}

const startAiAnalyze = async () => {
  if (!scriptInput.value.trim()) {
    ElMessage.warning('请输入需要分析的剧本内容')
    return
  }
  if (!ttsStore.openAiConfig.apiKey) {
    ElMessage.warning('请先在右上角【系统与模型配置】中配置 OpenAI/DeepSeek 的 API Key')
    return
  }

  ttsStore.isAiAnalyzing = true
  try {
    const service = new OpenAiDirectorService(ttsStore.openAiConfig)

    // 检测输入文本是中文还是英文
    const isEnglishText = /^[\x00-\x7F\s\d.,!?'"()\-:;]+$/.test(scriptInput.value.trim())

    let candidateVoices: typeof ttsStore.voices = []

    if (voiceScope.value === 'favorites') {
      candidateVoices = ttsStore.voices.filter((v) => ttsStore.isVoiceFavorite(v.name))
      if (candidateVoices.length === 0) {
        ElMessage.warning('您的收藏列表中暂无音色，已自动匹配多风格音色')
        candidateVoices = ttsStore.voices.filter((v) =>
          isEnglishText ? v.locale.startsWith('en') && v.styleList && v.styleList.length > 0 : v.locale.startsWith('zh') && v.styleList && v.styleList.length > 0
        )
      }
    } else if (voiceScope.value === 'auto_multistyle') {
      // 包含该语种下所有真实支持多情感风格的全部音色（中文多风格达 48 个，英文多风格达 37 个）
      candidateVoices = ttsStore.voices.filter((v) => {
        const matchLang = isEnglishText ? v.locale.startsWith('en') : v.locale.startsWith('zh')
        return matchLang && v.styleList && v.styleList.length > 0
      })
    } else {
      candidateVoices = ttsStore.voices.filter((v) =>
        isEnglishText ? v.locale.startsWith('en') : v.locale.startsWith('zh')
      ).slice(0, 45)
    }

    const segments = await service.parseScriptToSegments(scriptInput.value, candidateVoices, isEnglishText)

    ttsStore.scriptSegments = segments
    ElMessage.success(`AI 导演已成功拆解出 ${segments.length} 句分镜段落！`)
    visible.value = false
    emit('script-parsed')
  } catch (err: any) {
    ElMessage.error(err?.message || 'AI 导演分析失败')
  } finally {
    ttsStore.isAiAnalyzing = false
  }
}
</script>

<style scoped>
.ai-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-sample-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.sample-label {
  color: var(--text-muted);
}

.script-input-area :deep(.el-textarea__inner) {
  font-size: 14px;
  line-height: 1.6;
}

.voice-scope-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.scope-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-regular);
}

.model-hint-bar {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
