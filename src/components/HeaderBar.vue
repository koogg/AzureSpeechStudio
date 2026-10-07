<template>
  <header class="app-header">
    <div class="header-left">
      <div class="brand-logo">
        <el-icon class="brand-icon"><Microphone /></el-icon>
      </div>
      <div class="brand-info">
        <div class="brand-title">
          <span>Azure Speech Studio</span>
          <el-tag size="small" type="primary" effect="plain" class="badge">Voice Gallery</el-tag>
          <el-tag size="small" type="info" effect="light" class="version-badge">{{ appVersion }}</el-tag>
        </div>
        <p class="brand-subtitle">微软认知服务 · 神经文本转语音多情感定制工作台</p>
      </div>
    </div>

    <!-- 顶部状态与设置区 -->
    <div class="header-right">
      <!-- 月度用量快捷胶囊 -->
      <div class="quota-capsule" :class="{ warning: ttsStore.quotaPercent >= 90 }" @click="$emit('open-quota')">
        <div class="quota-icon">
          <el-icon><DataLine /></el-icon>
        </div>
        <div class="quota-text">
          <div class="quota-title">
            <span>本月用量 ({{ ttsStore.quotaPercent }}%)</span>
            <span class="quota-numbers">{{ ttsStore.quotaUsage.usedChars.toLocaleString() }} / 500k</span>
          </div>
          <el-progress
            :percentage="ttsStore.quotaPercent"
            :show-text="false"
            :stroke-width="5"
            :status="ttsStore.quotaPercent >= 90 ? 'warning' : ''"
          />
        </div>
      </div>

      <!-- 最近合成历史 独立按钮 -->
      <el-badge :value="ttsStore.historyList.length" :hidden="ttsStore.historyList.length === 0" type="primary">
        <el-button @click="$emit('open-history')">
          <el-icon><Clock /></el-icon>
          <span>合成历史</span>
        </el-button>
      </el-badge>

      <!-- 快速设置按钮 -->
      <el-button
        :type="isConfigured ? 'default' : 'danger'"
        :class="{ 'btn-unconfigured': !isConfigured }"
        @click="dialogVisible = true"
      >
        <el-icon><Setting /></el-icon>
        <span>{{ isConfigured ? '系统与模型配置' : '配置服务凭据' }}</span>
        <el-badge v-if="!isConfigured" is-dot class="setting-badge" />
      </el-button>
    </div>

    <!-- 综合凭据与模型设置对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="工作台凭据与 AI 模型配置"
      width="600px"
      align-center
      destroy-on-close
      class="settings-dialog"
    >
      <div class="dialog-content">
        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 1. Azure Speech 凭据 -->
          <el-tab-pane label="Azure Speech 语音凭据" name="azure">
            <el-alert
              type="success"
              :closable="false"
              show-icon
              class="dialog-alert"
            >
              <template #title>
                凭据保存在本地文件（<code>data/app_storage.json</code>），清理浏览器缓存绝不丢失！
              </template>
            </el-alert>

            <el-form label-position="top" class="settings-form">
              <el-form-item label="Azure Speech Key (密钥)">
                <el-input
                  v-model="formKey"
                  type="password"
                  show-password
                  placeholder="请输入 32 位 Azure 语音服务密钥"
                  clearable
                />
              </el-form-item>

              <el-form-item label="Azure Region (区域)">
                <el-select
                  v-model="formRegion"
                  filterable
                  allow-create
                  default-first-option
                  placeholder="选择或输入区域代码"
                  style="width: 100%"
                >
                  <el-option
                    v-for="region in REGION_OPTIONS"
                    :key="region.value"
                    :label="region.label"
                    :value="region.value"
                  >
                    <div class="region-option">
                      <span class="region-value">{{ region.value }}</span>
                      <span class="region-name">{{ region.name }}</span>
                    </div>
                  </el-option>
                </el-select>
                <div class="form-tip">通常为 <code>eastasia</code> (东亚-香港) 或 <code>southeastasia</code> (东南亚)</div>
              </el-form-item>
            </el-form>

            <div v-if="testResult" class="test-result-box" :class="{ success: testResult.success, error: !testResult.success }">
              <el-icon><component :is="testResult.success ? 'CircleCheck' : 'CircleClose'" /></el-icon>
              <span>{{ testResult.message }}</span>
            </div>
          </el-tab-pane>

          <!-- 2. OpenAI 兼容大模型 (AI 导演) -->
          <el-tab-pane label="AI 导演 (兼容 OpenAI)" name="openai">
            <el-alert
              type="info"
              :closable="false"
              show-icon
              class="dialog-alert"
            >
              <template #title>
                用于「一键剧本智能分镜」：自动分析台词角色并分发真实音色与细腻情感（支持 DeepSeek、OpenAI、Kimi、通义千问等）。
              </template>
            </el-alert>

            <el-form label-position="top" class="settings-form">
              <el-form-item label="API Base URL (接口地址)">
                <el-input
                  v-model="formAiBaseUrl"
                  placeholder="例如 https://api.openai.com/v1 或 https://api.deepseek.com/v1"
                  clearable
                />
              </el-form-item>

              <el-form-item label="API Key (密钥)">
                <el-input
                  v-model="formAiKey"
                  type="password"
                  show-password
                  placeholder="sk-..."
                  clearable
                />
              </el-form-item>

              <el-form-item label="Model Name (模型名称)">
                <el-input
                  v-model="formAiModel"
                  placeholder="例如 GPT-6.1 Sol, deepseek-flash"
                  clearable
                />
              </el-form-item>
            </el-form>

            <div v-if="aiTestResult" class="test-result-box" :class="{ success: aiTestResult.success, error: !aiTestResult.success }">
              <el-icon><component :is="aiTestResult.success ? 'CircleCheck' : 'CircleClose'" /></el-icon>
              <span>{{ aiTestResult.message }}</span>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="activeTab === 'azure' ? isTesting : isAiTesting" @click="activeTab === 'azure' ? handleTestConnection() : handleTestAi()">
            <el-icon><Connection /></el-icon>
            测试连通性
          </el-button>
          <div class="footer-actions">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSave">保存配置</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { AzureSpeechService } from '../services/azureSpeech'
import { OpenAiDirectorService } from '../services/openAiService'

defineEmits(['open-quota', 'open-history'])

const appVersion = __APP_VERSION__ || 'v1.0.0'
const ttsStore = useTtsStore()
const dialogVisible = ref(false)
const activeTab = ref<'azure' | 'openai'>('azure')

const formKey = ref(ttsStore.azureKey)
const formRegion = ref(ttsStore.azureRegion)
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// AI 导演配置表单
const formAiBaseUrl = ref(ttsStore.openAiConfig.baseUrl)
const formAiKey = ref(ttsStore.openAiConfig.apiKey)
const formAiModel = ref(ttsStore.openAiConfig.model)
const isAiTesting = ref(false)
const aiTestResult = ref<{ success: boolean; message: string } | null>(null)

watch(
  () => ttsStore.azureKey,
  (val) => {
    formKey.value = val
  }
)
watch(
  () => ttsStore.azureRegion,
  (val) => {
    formRegion.value = val
  }
)
watch(
  () => ttsStore.openAiConfig,
  (cfg) => {
    formAiBaseUrl.value = cfg.baseUrl
    formAiKey.value = cfg.apiKey
    formAiModel.value = cfg.model
  },
  { deep: true }
)

const isConfigured = computed(() => {
  return Boolean(ttsStore.azureKey && ttsStore.azureRegion)
})

const REGION_OPTIONS = [
  { value: 'eastasia', name: '东亚 (中国香港)', label: 'eastasia (东亚 - 香港)' },
  { value: 'southeastasia', name: '东南亚 (新加坡)', label: 'southeastasia (东南亚 - 新加坡)' },
  { value: 'japaneast', name: '日本东部 (东京)', label: 'japaneast (日本东部)' },
  { value: 'koreacentral', name: '韩国中部 (首尔)', label: 'koreacentral (韩国中部)' },
  { value: 'westus', name: '美国西部', label: 'westus (美国西部)' },
  { value: 'westus2', name: '美国西部 2', label: 'westus2 (美国西部 2)' },
  { value: 'eastus', name: '美国东部', label: 'eastus (美国东部)' },
  { value: 'eastus2', name: '美国东部 2', label: 'eastus2 (美国东部 2)' },
  { value: 'northeurope', name: '北欧 (爱尔兰)', label: 'northeurope (北欧 - 爱尔兰)' },
  { value: 'westeurope', name: '西欧 (荷兰)', label: 'westeurope (西欧 - 荷兰)' }
]

const handleTestConnection = async () => {
  if (!formKey.value.trim() || !formRegion.value.trim()) {
    ElMessage.warning('请先输入 Key 与 Region')
    return
  }
  isTesting.value = true
  testResult.value = null
  try {
    const service = new AzureSpeechService(formKey.value, formRegion.value)
    const result = await service.testConnection()
    testResult.value = result
    if (result.success) {
      ElMessage.success('Azure Speech 连接测试成功！')
    } else {
      ElMessage.error(result.message)
    }
  } catch (err: any) {
    testResult.value = { success: false, message: err?.message || '测试异常' }
  } finally {
    isTesting.value = false
  }
}

const handleTestAi = async () => {
  if (!formAiKey.value.trim()) {
    ElMessage.warning('请先输入 AI API Key')
    return
  }
  isAiTesting.value = true
  aiTestResult.value = null
  try {
    const service = new OpenAiDirectorService({
      baseUrl: formAiBaseUrl.value,
      apiKey: formAiKey.value,
      model: formAiModel.value
    })
    const res = await service.testConnection()
    aiTestResult.value = res
    if (res.success) {
      ElMessage.success('AI 模型连通性测试成功！')
    } else {
      ElMessage.error(res.message)
    }
  } catch (err: any) {
    aiTestResult.value = { success: false, message: err?.message || '测试异常' }
  } finally {
    isAiTesting.value = false
  }
}

const handleSave = async () => {
  if (!formKey.value.trim()) {
    ElMessage.warning('请输入 Azure Key')
    return
  }
  ttsStore.setCredentials(formKey.value, formRegion.value)
  ttsStore.openAiConfig = {
    baseUrl: formAiBaseUrl.value,
    apiKey: formAiKey.value,
    model: formAiModel.value
  }
  ElMessage.success('配置已保存到本地文件')
  dialogVisible.value = false

  try {
    const count = await ttsStore.refreshVoicesFromAzure()
    ElMessage.success(`已同步微软官方最新音色库 (共 ${count} 个音色)`)
  } catch (e) {}
}
</script>

<style scoped>
.app-header {
  height: 68px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  width: 42px;
  height: 42px;
  background: var(--azure-gradient);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(0, 120, 212, 0.3);
}

.brand-icon {
  font-size: 24px;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
}

.version-badge {
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  padding: 0 6px;
  height: 20px;
  line-height: 18px;
}

.brand-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quota-capsule {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  background: #f1f5f9;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.quota-capsule:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.quota-capsule.warning {
  background: #fef2f2;
  border-color: #fecaca;
}

.quota-icon {
  color: var(--azure-blue);
  font-size: 16px;
  display: flex;
  align-items: center;
}

.quota-capsule.warning .quota-icon {
  color: #ef4444;
}

.quota-text {
  width: 140px;
}

.quota-title {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-regular);
  margin-bottom: 3px;
}

.quota-numbers {
  font-family: monospace;
  color: var(--text-muted);
}

.btn-unconfigured {
  animation: pulse 2s infinite;
}

.setting-badge {
  margin-left: 6px;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

.dialog-alert {
  margin-bottom: 18px;
}

.preset-provider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.preset-label {
  font-size: 13px;
  color: var(--text-muted);
}

.form-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.form-tip code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: var(--azure-blue);
}

.region-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.region-value {
  font-weight: 600;
  font-size: 13px;
}

.region-name {
  font-size: 12px;
  color: var(--text-muted);
}

.test-result-box {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.test-result-box.success {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.test-result-box.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-actions {
  display: flex;
  gap: 10px;
}
</style>
