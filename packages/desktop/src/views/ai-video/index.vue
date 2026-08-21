<template>
  <div class="ai-video-workspace">
    <!-- 左侧功能导航 -->
    <aside class="nav-panel">
      <div class="nav-title">
        <el-icon :size="18"><VideoCamera /></el-icon>
        <span>AI 视频创作台</span>
      </div>
      <el-menu :default-active="aiVideoStore.activeView" class="nav-menu" @select="onSelect">
        <el-menu-item index="generate">
          <el-icon><MagicStick /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">智能成片</div>
              <div class="menu-desc">主题一键生成视频</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="digital-human">
          <el-icon><Avatar /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">数字人口播</div>
              <div class="menu-desc">形象 + 文案出口播</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="copywriting">
          <el-icon><EditPen /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">文案大师</div>
              <div class="menu-desc">爆款文案 AI 生成</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="competitor">
          <el-icon><Monitor /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">同行监控</div>
              <div class="menu-desc">竞品账号作品追踪</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="viral">
          <el-icon><Lightning /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">一键追爆</div>
              <div class="menu-desc">爆款链接拆解文案</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="acquisition">
          <el-icon><DataLine /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">智能获客</div>
              <div class="menu-desc">平台数据批量采集</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="mixcut">
          <el-icon><Scissor /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">智能混剪</div>
              <div class="menu-desc">文案素材批量成片</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="works">
          <el-icon><FolderOpened /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">我的作品库</div>
              <div class="menu-desc">成片管理与下载</div>
            </div>
          </template>
        </el-menu-item>
        <el-menu-item index="publish">
          <el-icon><Promotion /></el-icon>
          <template #title>
            <div class="menu-text">
              <div class="menu-name">多平台发布</div>
              <div class="menu-desc">一键分发到各平台</div>
            </div>
          </template>
        </el-menu-item>
      </el-menu>
    </aside>

    <!-- 内容区 -->
    <main class="content-panel">
      <keep-alive>
        <component :is="currentView" />
      </keep-alive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  VideoCamera,
  MagicStick,
  Avatar,
  EditPen,
  Monitor,
  Lightning,
  DataLine,
  Scissor,
  FolderOpened,
  Promotion,
} from '@element-plus/icons-vue';
import { aiVideoStore } from './store';
import GenerateView from './generate.vue';
import DigitalHumanView from './digital-human.vue';
import CopywritingView from './copywriting.vue';
import CompetitorView from './competitor.vue';
import ViralView from './viral.vue';
import AcquisitionView from './acquisition.vue';
import MixcutView from './mixcut.vue';
import WorksView from './works.vue';
import PublishView from './publish.vue';

const currentView = computed(() => {
  const map: Record<string, any> = {
    generate: GenerateView,
    'digital-human': DigitalHumanView,
    copywriting: CopywritingView,
    competitor: CompetitorView,
    viral: ViralView,
    acquisition: AcquisitionView,
    mixcut: MixcutView,
    works: WorksView,
    publish: PublishView,
  };
  return map[aiVideoStore.activeView] || GenerateView;
});

function onSelect(index: string) {
  aiVideoStore.activeView = index;
}
</script>

<style scoped>
.ai-video-workspace {
  display: flex;
  gap: 16px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.nav-panel {
  width: 190px;
  flex-shrink: 0;
  background: #fff;
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 15px;
  font-weight: 700;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

.nav-menu {
  flex: 1;
  border-right: none;
  padding: 8px;
}

.nav-menu :deep(.el-menu-item) {
  height: 56px;
  margin: 3px 0;
  border-radius: 10px;
  transition: all 0.2s;
}

.nav-menu :deep(.el-menu-item:hover) {
  background: #eff6ff;
}

.nav-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
}

.nav-menu :deep(.el-menu-item.is-active .menu-desc) {
  color: rgba(255, 255, 255, 0.8);
}

.menu-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.menu-desc {
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
  line-height: 1.2;
}

.content-panel {
  flex: 1;
  min-width: 0;
  background: #fff;
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-color, #e2e8f0);
  box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
