<template>
  <div class="ig-container">
    <!-- 工具条 -->
    <div class="ig-toolbar">
      <div class="ig-info">
        <div class="ig-title">
          {{ title }}
          <el-tag
            size="small"
            :type="online ? 'success' : 'danger'"
            effect="light"
            class="ig-status"
          >
            <span class="dot" :class="{ ok: online }"></span>
            {{ online ? '服务在线' : '服务离线' }}
          </el-tag>
        </div>
        <div class="ig-desc">{{ desc }}</div>
      </div>
      <div class="ig-actions">
        <el-button size="small" :loading="checking" @click="refresh">刷新状态</el-button>
        <el-button size="small" :disabled="!online" @click="toggleFullscreen">
          <el-icon style="margin-right: 4px"><FullScreen /></el-icon>{{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
        <el-button size="small" type="primary" :disabled="!online" @click="openNewWindow">
          <el-icon style="margin-right: 4px"><TopRight /></el-icon>新窗口打开
        </el-button>
      </div>
    </div>

    <!-- 嵌入区 -->
    <div class="ig-frame-wrap">
      <iframe
        v-if="online"
        :key="iframeKey"
        :src="serviceUrl"
        class="ig-frame"
        frameborder="0"
        referrerpolicy="no-referrer"
        allow="clipboard-write; clipboard-read; autoplay; microphone; camera"
      />
      <div v-else class="ig-offline">
        <el-icon :size="52" color="#94a3b8"><WarningFilled /></el-icon>
        <h3>本地服务未启动</h3>
        <p>该功能由本地开源服务提供（第三方工具），启动后自动嵌入本页面</p>
        <div class="ig-cmd-row">
          <el-input :model-value="startCommand" readonly class="ig-cmd">
            <template #prepend>启动命令</template>
          </el-input>
          <el-button type="primary" @click="copyCommand">复制</el-button>
        </div>
        <p class="ig-hint">双击项目根目录「一键启动.command」，或终端执行 bash start-all.sh</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated, onDeactivated, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { TopRight, WarningFilled, FullScreen } from '@element-plus/icons-vue';
import { getIntegrationStatus } from '@/api';

const props = defineProps<{
  serviceKey: string;
  title: string;
  desc: string;
}>();

const statusList = ref<any[]>([]);
const checking = ref(false);
const iframeKey = ref(0);
const lastOnline = ref<boolean | null>(null);
const isFullscreen = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const service = computed(() => statusList.value.find((s) => s.key === props.serviceKey));
const online = computed(() => !!service.value?.online);
const serviceUrl = computed(() => service.value?.url || '');
const startCommand = 'bash start-all.sh';

// 服务从「离线 → 在线」时自动刷新 iframe，避免停留在死页面
watch(online, (val) => {
  if (val && lastOnline.value === false) {
    iframeKey.value++;
    ElMessage.success('服务已恢复，页面已自动刷新');
  }
  lastOnline.value = val;
});

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen?.();
    isFullscreen.value = false;
  }
}

async function refresh() {
  checking.value = true;
  try {
    statusList.value = await getIntegrationStatus();
  } catch {
    statusList.value = [];
  } finally {
    checking.value = false;
  }
}

function startTimer() {
  if (!timer) timer = setInterval(refresh, 20000);
}
function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function openNewWindow() {
  if (serviceUrl.value) window.open(serviceUrl.value, '_blank');
}

function copyCommand() {
  navigator.clipboard
    .writeText(startCommand)
    .then(() => ElMessage.success('启动命令已复制'))
    .catch(() => ElMessage.error('复制失败，请手动复制'));
}

onMounted(() => {
  refresh();
  startTimer();
  document.addEventListener('fullscreenchange', onFullscreenChange);
});
onActivated(() => {
  refresh();
  startTimer();
});
onDeactivated(() => stopTimer());
onUnmounted(() => {
  stopTimer();
  document.removeEventListener('fullscreenchange', onFullscreenChange);
});
</script>

<style scoped>
.ig-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ig-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: #fff;
  flex-shrink: 0;
}

.ig-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.ig-status {
  border-radius: 20px;
  font-weight: 500;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
  margin-right: 4px;
}

.dot.ok {
  background: #10b981;
}

.ig-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.ig-frame-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  background: #f8fafc;
}

.ig-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.ig-offline {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #f8fafc;
  color: var(--text-secondary, #475569);
  padding: 20px;
  text-align: center;
}

.ig-offline h3 {
  margin: 6px 0 0;
  font-size: 18px;
  color: var(--text-primary, #1e293b);
}

.ig-offline p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #94a3b8);
}

.ig-cmd-row {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 520px;
  margin-top: 8px;
}

.ig-cmd :deep(.el-input__inner) {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  color: #2563eb;
  background: #eff6ff;
}

.ig-hint {
  font-size: 12px !important;
}
</style>
