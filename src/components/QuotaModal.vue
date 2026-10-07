<template>
  <el-dialog
    v-model="visible"
    title="每月 500,000 字符免费配额看板"
    width="580px"
    align-center
    class="quota-modal"
  >
    <div class="quota-modal-body">
      <!-- 环形进度与用量大图 -->
      <div class="quota-hero-card" :class="{ 'is-danger': ttsStore.quotaPercent >= 90 }">
        <div class="progress-ring-wrap">
          <el-progress
            type="dashboard"
            :percentage="ttsStore.quotaPercent"
            :width="150"
            :stroke-width="12"
            :color="customColors"
          >
            <template #default="{ percentage }">
              <span class="percentage-value">{{ percentage }}%</span>
              <span class="percentage-label">已使用配额</span>
            </template>
          </el-progress>
        </div>

        <div class="quota-details">
          <div class="stat-badge">
            <el-icon><Calendar /></el-icon>
            <span>当前月份: {{ ttsStore.quotaUsage.monthKey }}</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">本月已消耗字符:</span>
            <span class="stat-val primary">{{ ttsStore.quotaUsage.usedChars.toLocaleString() }} 字符</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">每月免费额度上限:</span>
            <span class="stat-val">{{ ttsStore.quotaUsage.quotaLimit.toLocaleString() }} 字符</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">本月剩余可用额度:</span>
            <span class="stat-val highlight">{{ remainingChars.toLocaleString() }} 字符</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">累计合成任务数:</span>
            <span class="stat-val">{{ ttsStore.quotaUsage.historyCount }} 次</span>
          </div>
        </div>
      </div>

      <!-- 配额提醒 Banner -->
      <div v-if="ttsStore.quotaPercent >= 90" class="warning-alert">
        <el-icon><Warning /></el-icon>
        <div>
          <strong>配额预警：</strong> 您本月的免费额度已使用超过 90% ({{ ttsStore.quotaUsage.usedChars }} / 500k)，请留意 Azure 账号可能产生的超额计费。
        </div>
      </div>

      <!-- 规则说明卡片 -->
      <div class="rules-box">
        <div class="rule-title">
          <el-icon><InfoFilled /></el-icon>
          <span>关于微软 Azure 免费层规则说明：</span>
        </div>
        <ul class="rule-list">
          <li><strong>每月 50 万字符免费：</strong> 微软 Azure 针对语音合成 F0 免费层（Free Tier）每月赠送 500,000 个神经语音字符。</li>
          <li><strong>仅计有效纯文本：</strong> 本系统已内置过滤机制，<code>&lt;speak&gt;</code>、<code>&lt;voice&gt;</code>、<code>&lt;prosody&gt;</code> 等 SSML 标签字符不计入用量。</li>
          <li><strong>跨月自动重置：</strong> 每逢新月份首日，计数器将自动检测并重置为 0，与 Azure 账单周期保持一致。</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="quota-modal-footer">
        <div class="footer-left-btns">
          <el-button link type="danger" size="small" @click="handleReset">
            重置清零
          </el-button>
          <el-button link type="primary" size="small" @click="handleCalibrate">
            <el-icon><EditPen /></el-icon>
            校准云端用量
          </el-button>
        </div>
        <el-button type="primary" @click="visible = false">我知道了</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const ttsStore = useTtsStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const remainingChars = computed(() => {
  return Math.max(0, ttsStore.quotaUsage.quotaLimit - ttsStore.quotaUsage.usedChars)
})

const customColors = [
  { color: '#10b981', percentage: 40 },
  { color: '#0078d4', percentage: 70 },
  { color: '#eab308', percentage: 90 },
  { color: '#ef4444', percentage: 100 }
]

const handleReset = () => {
  ElMessageBox.confirm('确定要清零本月本地统计数据吗？此操作不会影响 Azure 官方后台的实际计费。', '确认重置', {
    confirmButtonText: '确定重置',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ttsStore.resetQuotaUsage()
    ElMessage.success('用量计数已重置')
  })
}

const handleCalibrate = () => {
  ElMessageBox.prompt('请输入您在 Azure Portal 监控指标查看到的本月累计字数 (例如 2300):', '校准云端实际用量', {
    confirmButtonText: '保存校准',
    cancelButtonText: '取消',
    inputPattern: /^\d+$/,
    inputErrorMessage: '请输入纯数字',
    inputValue: String(ttsStore.quotaUsage.usedChars)
  }).then(({ value }) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      ttsStore.setQuotaUsedChars(num)
      ElMessage.success(`用量已同步校准为 ${num.toLocaleString()} 字符`)
    }
  }).catch(() => {})
}
</script>

<style scoped>
.quota-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quota-hero-card {
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
  border-radius: 12px;
  border: 1px solid #dbeafe;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.quota-hero-card.is-danger {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-color: #fecaca;
}

.progress-ring-wrap {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.percentage-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.1;
}

.percentage-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

.quota-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--azure-blue);
  width: fit-content;
  border: 1px solid #e2e8f0;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.stat-label {
  color: var(--text-regular);
}

.stat-val {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-main);
}

.stat-val.primary {
  color: var(--azure-blue);
}

.stat-val.highlight {
  color: #10b981;
}

.warning-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.rules-box {
  background: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
}

.rule-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 8px;
}

.rule-list {
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.6;
}

.quota-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
</style>
