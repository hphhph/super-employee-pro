<template>
  <div class="wk-container">
    <!-- 顶部统计 + 筛选 -->
    <div class="wk-toolbar">
      <el-radio-group v-model="filter" size="large">
        <el-radio-button label="all">全部（{{ items.length }}）</el-radio-button>
        <el-radio-button label="smart">智能成片（{{ smartCount }}）</el-radio-button>
        <el-radio-button label="digital">数字人口播（{{ digitalCount }}）</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-button :icon="Refresh" circle :loading="loading" @click="loadAll" />
    </div>

    <div v-if="items.length === 0 && !loading" class="empty-state">
      <el-icon :size="56" color="#cbd5e1"><FolderOpened /></el-icon>
      <p>作品库还是空的<br />在「智能成片」或「数字人口播」生成视频后点击「存入作品库」</p>
    </div>

    <!-- 作品网格 -->
    <div class="work-grid">
      <el-card v-for="item in filteredItems" :key="item.key" class="work-card" shadow="hover">
        <div class="work-preview">
          <video v-if="blobUrls[item.key]" :src="blobUrls[item.key]" controls class="work-video" />
          <div v-else class="preview-placeholder">
            <el-icon :size="40" color="#cbd5e1"><VideoCameraFilled /></el-icon>
            <span v-if="item.stateText === '生成中'">生成中 {{ item.progress }}%</span>
            <span v-else-if="item.stateText === '失败'">生成失败</span>
            <span v-else>加载中…</span>
          </div>
          <el-tag :type="item.source === 'smart' ? 'primary' : 'warning'" size="small" class="source-tag">
            {{ item.source === 'smart' ? '智能成片' : '数字人口播' }}
          </el-tag>
          <el-tag :type="item.stateTag" size="small" class="state-tag">{{ item.stateText }}</el-tag>
        </div>
        <div class="work-info">
          <div class="work-title" :title="item.title">{{ item.title }}</div>
          <div class="work-meta">
            <span>{{ item.duration ? '时长 ' + item.duration : '' }}</span>
            <span>{{ item.date }}</span>
          </div>
        </div>
        <div class="work-actions">
          <el-button
            v-if="item.downloadUrl"
            size="small"
            type="primary"
            :loading="downloading === item.key"
            :disabled="!blobUrls[item.key]"
            @click="handleDownload(item)"
          >
            下载
          </el-button>
          <el-button size="small" type="success" plain @click="handlePublish(item)">一键发布</el-button>
          <el-popconfirm title="删除该作品？" @confirm="handleDelete(item)">
            <template #reference>
              <el-button size="small" type="danger" plain>删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderOpened, Refresh, VideoCameraFilled } from '@element-plus/icons-vue';
import {
  getVideoTasks,
  deleteVideoTask,
  getDigitalHumanTasks,
  deleteDigitalHumanTask,
  fetchVideoFile,
  fetchDigitalHumanFile,
} from '@/api';
import { aiVideoStore } from './store';

const filter = ref('all');
const loading = ref(false);
const downloading = ref('');
const items = ref<any[]>([]);
const blobUrls = ref<Record<string, string>>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;

const smartCount = computed(() => items.value.filter((i) => i.source === 'smart').length);
const digitalCount = computed(() => items.value.filter((i) => i.source === 'digital').length);
const filteredItems = computed(() =>
  filter.value === 'all' ? items.value : items.value.filter((i) => i.source === filter.value),
);

const videoStateText = (s: number) =>
  ({ 1: '已完成', 4: '生成中', [-1]: '失败' } as Record<number, string>)[s] || '排队中';
const videoStateTag = (s: number) =>
  ({ 1: 'success', 4: 'primary', [-1]: 'danger' } as Record<number, any>)[s] || 'info';
const dhStateText = (s: string) =>
  ({ completed: '已完成', processing: '生成中', failed: '失败', pending: '排队中' } as Record<string, string>)[s] || s;
const dhStateTag = (s: string) =>
  ({ completed: 'success', processing: 'primary', failed: 'danger', pending: 'info' } as Record<string, any>)[s] || 'info';

onMounted(async () => {
  await loadAll();
  // 处理中的任务轮询刷新
  pollTimer = setInterval(async () => {
    const busy = items.value.some((i) => i.stateText === '生成中' || i.stateText === '排队中');
    if (busy) await loadAll();
  }, 3000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  Object.values(blobUrls.value).forEach((u) => URL.revokeObjectURL(u));
});

async function loadAll() {
  loading.value = true;
  try {
    const [smartRes, dhRes]: any[] = await Promise.all([getVideoTasks({ page: 1, pageSize: 50 }), getDigitalHumanTasks()]);
    const smartTasks = smartRes?.tasks || [];
    const dhTasks = Array.isArray(dhRes) ? dhRes : dhRes?.list || [];

    const merged: any[] = [];
    for (const t of smartTasks) {
      if (t.state !== 1) continue; // 只展示成片
      const videoUrls = Array.isArray(t.videos) ? t.videos : [];
      if (!videoUrls.length) continue;
      const key = `smart-${t.task_id}`;
      merged.push({
        key,
        source: 'smart',
        sourceId: t.task_id,
        title: t.params?.video_subject || '未命名视频',
        stateText: videoStateText(t.state),
        stateTag: videoStateTag(t.state),
        progress: t.progress || 0,
        downloadUrl: videoUrls[0],
        date: formatDate(t.created_at),
        duration: '',
      });
      if (!blobUrls.value[key]) await loadBlob(key, videoUrls[0], false);
    }

    for (const t of dhTasks) {
      if (t.status !== 'completed' || !t.videoUrl) continue;
      const key = `digital-${t.id}`;
      merged.push({
        key,
        source: 'digital',
        sourceId: t.id,
        title: t.title || t.script?.slice(0, 30) || '口播视频',
        stateText: dhStateText(t.status),
        stateTag: dhStateTag(t.status),
        progress: t.progress || 0,
        downloadUrl: t.videoUrl,
        date: formatDate(t.createdAt),
        duration: t.duration ? `${t.duration}秒` : '',
      });
      if (!blobUrls.value[key]) await loadBlob(key, t.videoUrl, true);
    }

    // 最新的在前
    merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    items.value = merged;
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    loading.value = false;
  }
}

async function loadBlob(key: string, url: string, isDigital: boolean) {
  try {
    const blob: any = isDigital ? await fetchDigitalHumanFile(url) : await fetchVideoFile(url);
    blobUrls.value[key] = URL.createObjectURL(blob);
  } catch {
    /* 单个作品加载失败不阻塞列表 */
  }
}

async function handleDownload(item: any) {
  downloading.value = item.key;
  try {
    const blob: any = item.source === 'digital' ? await fetchDigitalHumanFile(item.downloadUrl) : await fetchVideoFile(item.downloadUrl);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${item.title}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    downloading.value = '';
  }
}

async function handleDelete(item: any) {
  try {
    if (item.source === 'smart') {
      await deleteVideoTask(item.sourceId);
    } else {
      await deleteDigitalHumanTask(item.sourceId);
    }
    if (blobUrls.value[item.key]) URL.revokeObjectURL(blobUrls.value[item.key]);
    delete blobUrls.value[item.key];
    items.value = items.value.filter((i) => i.key !== item.key);
    ElMessage.success('已删除');
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

function handlePublish(item: any) {
  aiVideoStore.activeView = 'publish';
  // 将作品信息带到发布页（通过 store 或 query，publish 页内会重新加载作品列表）
  ElMessage.info('已跳转到「多平台发布」，请在弹窗中选择该作品');
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style scoped>
.wk-container {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}
.wk-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}
.spacer {
  flex: 1;
}
.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.work-card :deep(.el-card__body) {
  padding: 12px;
}
.work-preview {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: #000;
  aspect-ratio: 9/16;
  max-height: 320px;
}
.work-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 12px;
}
.source-tag {
  position: absolute;
  top: 8px;
  left: 8px;
}
.state-tag {
  position: absolute;
  top: 8px;
  right: 8px;
}
.work-info {
  padding: 8px 2px 0;
}
.work-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.work-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.work-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 80px 0;
  font-size: 13px;
  line-height: 2;
}
</style>
