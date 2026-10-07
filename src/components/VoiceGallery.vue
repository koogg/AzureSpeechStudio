<template>
  <div class="voice-gallery-container">
    <!-- 顶部过滤与搜索栏 -->
    <div class="gallery-toolbar">
      <div class="search-input-wrap">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索音色名称、描述或特征（如：晓晓、新闻、磁性）..."
          clearable
          :prefix-icon="'Search'"
          size="default"
        />
      </div>

      <div class="filters-row">
        <!-- 仅看收藏开关 -->
        <el-button
          :type="onlyFavorites ? 'warning' : 'default'"
          size="default"
          class="favorite-filter-btn"
          @click="onlyFavorites = !onlyFavorites"
        >
          <el-icon><StarFilled /></el-icon>
          <span>我的收藏 ({{ ttsStore.favoriteVoiceNames.length }})</span>
        </el-button>

        <!-- 语言选择 -->
        <el-select
          v-model="selectedLocale"
          placeholder="全部语言"
          clearable
          size="default"
          class="filter-select"
        >
          <el-option label="🌐 全部语言" value="" />
          <el-option
            v-for="loc in availableLocales"
            :key="loc"
            :label="getLocaleLabel(loc)"
            :value="loc"
          />
        </el-select>

        <!-- 性别过滤 -->
        <el-radio-group v-model="selectedGender" size="default" class="gender-radio">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="Female">👩 女声</el-radio-button>
          <el-radio-button label="Male">👨 男声</el-radio-button>
        </el-radio-group>

        <!-- 多情感/风格筛选开关 -->
        <el-checkbox-button v-model="onlyMultiStyle" size="default">
          ✨ 仅多风格
        </el-checkbox-button>

        <div class="toolbar-spacer" />

        <!-- 刷新在线音色按钮 -->
        <el-tooltip content="连接 Azure 在线拉取官方全部音色" placement="top">
          <el-button
            :loading="ttsStore.isFetchingVoices"
            size="default"
            @click="handleFetchVoices"
          >
            <el-icon><Refresh /></el-icon>
            <span>{{ ttsStore.isCustomVoicesLoaded ? '已同步官方库' : '同步最新音色' }}</span>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 音色卡片列表网格 -->
    <div class="voice-cards-grid">
      <div
        v-for="voice in filteredVoices"
        :key="voice.name"
        class="voice-card"
        :class="{ active: voice.name === ttsStore.currentVoice.name }"
        @click="ttsStore.selectVoice(voice)"
      >
        <div class="card-header">
          <div
            class="avatar-circle"
            :style="{ backgroundColor: voice.avatarColor || (voice.gender === 'Female' ? '#ec4899' : '#3b82f6') }"
          >
            {{ voice.displayName.slice(0, 1) }}
          </div>
          <div class="voice-title-box">
            <div class="voice-name-row">
              <span class="voice-name">{{ voice.displayName }}</span>
              <el-tag
                size="small"
                :type="voice.gender === 'Female' ? 'danger' : 'primary'"
                effect="light"
                class="gender-tag"
              >
                {{ voice.gender === 'Female' ? '女声' : '男声' }}
              </el-tag>
            </div>
            <div class="voice-locale-str">{{ getLocaleLabel(voice.locale) }}</div>
          </div>

          <!-- 收藏星星按钮 -->
          <button
            class="favorite-toggle-btn"
            :class="{ isFav: ttsStore.isVoiceFavorite(voice.name) }"
            :title="ttsStore.isVoiceFavorite(voice.name) ? '取消收藏' : '添加收藏'"
            @click.stop="ttsStore.toggleFavoriteVoice(voice.name)"
          >
            <el-icon><StarFilled /></el-icon>
          </button>

          <div v-if="voice.name === ttsStore.currentVoice.name" class="check-badge">
            <el-icon><Check /></el-icon>
          </div>
        </div>

        <p class="voice-desc">{{ voice.description || `${voice.localName} - 微软神经高保真语音` }}</p>

        <!-- 标签与风格信息 -->
        <div class="card-footer-tags">
          <div class="feature-tags">
            <span v-if="voice.styleList && voice.styleList.length > 0" class="style-count-badge">
              <el-icon><MagicStick /></el-icon>
              {{ voice.styleList.length }} 种情感风格
            </span>
            <span v-if="voice.rolePlayList && voice.rolePlayList.length > 0" class="role-count-badge">
              <el-icon><User /></el-icon>
              {{ voice.rolePlayList.length }} 角色
            </span>
          </div>

          <div v-if="voice.categories && voice.categories.length" class="category-tags">
            <el-tag
              v-for="cat in voice.categories.slice(0, 2)"
              :key="cat"
              size="small"
              type="info"
              effect="plain"
            >
              {{ cat }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 无结果提示 -->
    <div v-if="filteredVoices.length === 0" class="empty-state">
      <el-empty description="没有找到匹配的音色，尝试更改过滤条件或查看收藏" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTtsStore } from '../stores/ttsStore'
import { LOCALE_LABEL_MAP } from '../constants/presets'
import type { VoiceMetadata } from '../types/tts'

const ttsStore = useTtsStore()

const searchKeyword = ref('')
const selectedLocale = ref('zh-CN')
const selectedGender = ref<'all' | 'Female' | 'Male'>('all')
const onlyMultiStyle = ref(false)
const onlyFavorites = ref(false)

// 提取当前列表中所有的 locale
const availableLocales = computed(() => {
  const set = new Set<string>()
  ttsStore.voices.forEach((v) => {
    if (v.locale) set.add(v.locale)
  })
  const priority = ['zh-CN', 'zh-HK', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR']
  return Array.from(set).sort((a, b) => {
    const idxA = priority.indexOf(a)
    const idxB = priority.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })
})

const getLocaleLabel = (locale: string) => {
  return LOCALE_LABEL_MAP[locale] || locale
}

// 过滤后的音色列表
const filteredVoices = computed(() => {
  return ttsStore.voices.filter((v: VoiceMetadata) => {
    // 0. 仅看收藏
    if (onlyFavorites.value && !ttsStore.isVoiceFavorite(v.name)) {
      return false
    }

    // 1. 语言过滤 (如果仅看收藏模式下不强制语言)
    if (!onlyFavorites.value && selectedLocale.value && v.locale !== selectedLocale.value) {
      return false
    }

    // 2. 性别过滤
    if (selectedGender.value !== 'all' && v.gender !== selectedGender.value) {
      return false
    }

    // 3. 多风格过滤
    if (onlyMultiStyle.value && (!v.styleList || v.styleList.length === 0)) {
      return false
    }

    // 4. 关键词搜索
    if (searchKeyword.value.trim()) {
      const q = searchKeyword.value.trim().toLowerCase()
      const matchName = v.displayName?.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)
      const matchDesc = v.description?.toLowerCase().includes(q)
      const matchCategory = v.categories?.some((c) => c.toLowerCase().includes(q))
      if (!matchName && !matchDesc && !matchCategory) {
        return false
      }
    }

    return true
  })
})

const handleFetchVoices = async () => {
  try {
    const count = await ttsStore.refreshVoicesFromAzure()
    ElMessage.success(`成功同步 ${count} 个官方云端音色！`)
  } catch (err: any) {
    ElMessage.error(err?.message || '获取失败，请先在右上角配置正确的 Azure 凭据')
  }
}
</script>

<style scoped>
.voice-gallery-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.gallery-toolbar {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.filters-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.favorite-filter-btn {
  font-weight: 600;
}

.favorite-filter-btn .el-icon {
  margin-right: 4px;
  color: #f59e0b;
}

.filter-select {
  width: 175px;
}

.toolbar-spacer {
  flex: 1;
}

.voice-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.voice-card {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  user-select: none;
}

.voice-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.08);
  transform: translateY(-1px);
}

.voice-card.active {
  border-color: var(--azure-blue);
  background-color: #f0f7ff;
  box-shadow: 0 4px 14px rgba(0, 120, 212, 0.16);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.voice-title-box {
  flex: 1;
  min-width: 0;
}

.voice-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.voice-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gender-tag {
  font-size: 10px;
  padding: 0 4px;
  height: 18px;
  line-height: 18px;
}

.voice-locale-str {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.favorite-toggle-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: #cbd5e1;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.favorite-toggle-btn:hover {
  color: #f59e0b;
  transform: scale(1.15);
}

.favorite-toggle-btn.isFav {
  color: #f59e0b;
}

.check-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--azure-blue);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-left: 2px;
}

.voice-desc {
  font-size: 12px;
  color: var(--text-regular);
  line-height: 1.4;
  margin: 8px 0;
  min-height: 32px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer-tags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed var(--border-color);
  padding-top: 6px;
  gap: 6px;
}

.feature-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.style-count-badge,
.role-count-badge {
  font-size: 11px;
  font-weight: 500;
  color: #2563eb;
  background: #eff6ff;
  padding: 1px 5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.role-count-badge {
  color: #7c3aed;
  background: #f5f3ff;
}

.category-tags {
  display: flex;
  gap: 4px;
  overflow: hidden;
}

.empty-state {
  background: #ffffff;
  border-radius: 10px;
  padding: 30px;
  text-align: center;
  border: 1px solid var(--border-color);
}
</style>
