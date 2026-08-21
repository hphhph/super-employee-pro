<template>
  <div class="dh-container">
    <!-- 左：形象管理 -->
    <div class="dh-panel avatar-panel">
      <div class="panel-title">
        <el-icon><Avatar /></el-icon>
        <span>数字人形象</span>
        <el-upload
          :show-file-list="false"
          :auto-upload="false"
          :on-change="handleFileChange"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          class="upload-btn"
        >
          <el-button size="small" type="primary" :icon="Plus" :loading="uploading">上传形象</el-button>
        </el-upload>
      </div>
      <div class="avatar-list">
        <div v-if="avatars.length === 0" class="empty-state">
          <el-icon :size="44" color="#cbd5e1"><Avatar /></el-icon>
          <p>还没有形象<br />上传真人形象照 / 口播视频<br />即可生成数字人口播</p>
        </div>
        <div
          v-for="a in avatars"
          :key="a.id"
          class="avatar-card"
          :class="{ active: selectedAvatarId === a.id }"
          @click="selectedAvatarId = a.id"
        >
          <div class="avatar-thumb">
            <img v-if="a.type === 'image' && thumbUrls[a.id]" :src="thumbUrls[a.id]" alt="" />
            <video v-else-if="a.type === 'video' && thumbUrls[a.id]" :src="thumbUrls[a.id]" muted loop />
            <div v-else class="thumb-placeholder">
              <el-icon :size="26"><VideoCamera /></el-icon>
            </div>
            <el-tag class="type-tag" size="small" :type="a.type === 'video' ? 'warning' : 'success'">
              {{ a.type === 'video' ? '视频' : '图片' }}
            </el-tag>
            <div class="avatar-mask">
              <el-button size="small" circle :icon="View" @click.stop="previewAvatar(a)" />
              <el-button size="small" circle type="danger" :icon="Delete" @click.stop="handleDeleteAvatar(a)" />
            </div>
          </div>
          <div class="avatar-name">{{ a.name }}</div>
        </div>
      </div>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="建议上传正面半身照（图片）或 5-30 秒口播视频（真人形象效果最佳）"
        class="avatar-tip"
      />
    </div>

    <!-- 中：创作表单 -->
    <div class="dh-panel create-panel">
      <div class="panel-title">
        <el-icon><EditPen /></el-icon>
        <span>口播创作</span>
      </div>
      <div class="create-body">
        <el-form label-position="top" size="large">
          <el-form-item label="口播文案" required>
            <el-input
              v-model="form.script"
              type="textarea"
              :rows="7"
              maxlength="500"
              show-word-limit
              placeholder="输入口播文案（15-30 秒建议 60-120 字）"
            />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="配音音色">
                <el-select v-model="form.voiceName" filterable>
                  <el-option v-for="v in voiceOptions" :key="v.value" :label="v.label" :value="v.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="画面比例">
                <el-select v-model="form.aspect">
                  <el-option label="竖屏 9:16" value="9:16" />
                  <el-option label="横屏 16:9" value="16:9" />
                  <el-option label="方形 1:1" value="1:1" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="视频标题（可选）">
            <el-input v-model="form.title" maxlength="100" placeholder="例如：XX产品种草口播" />
          </el-form-item>
          <div class="switch-row">
            <el-form-item label="烧录字幕">
              <el-switch v-model="form.subtitleEnabled" />
            </el-form-item>
            <el-form-item label="背景音乐">
              <el-switch v-model="form.bgmEnabled" />
            </el-form-item>
          </div>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="合成在本地完成：TTS 配音 + 形象画面 + 字幕烧录，全程约 1-3 分钟"
            class="gen-tip"
          />
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="create-btn"
              :loading="creating"
              :disabled="!selectedAvatarId || !form.script.trim()"
              @click="handleCreate"
            >
              <el-icon><VideoPlay /></el-icon>
              生成口播视频
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 右：任务列表 -->
    <div class="dh-panel tasks-panel">
      <div class="panel-title">
        <el-icon><Film /></el-icon>
        <span>口播任务</span>
        <el-button size="small" text :icon="Refresh" circle @click="loadTasks" :loading="loadingTasks" />
      </div>
      <div class="dh-tasks">
        <div v-if="tasks.length === 0 && !loadingTasks" class="empty-state">
          <el-icon :size="44" color="#cbd5e1"><VideoPlay /></el-icon>
          <p>还没有口播任务</p>
        </div>
        <el-card v-for="t in tasks" :key="t.id" class="dh-task-card" shadow="hover">
          <div class="dh-task-header">
            <div class="dh-task-title">{{ t.title }}</div>
            <el-tag :type="dhStateTag(t.status)" size="small">{{ dhStateText(t.status) }}</el-tag>
          </div>
          <el-progress
            v-if="t.status === 'processing'"
            :percentage="t.progress || 0"
            :stroke-width="6"
            :show-text="false"
          />
          <div v-if="t.status === 'failed'" class="task-error">{{ t.error }}</div>
          <div class="dh-task-meta">
            <span>{{ t.avatar?.name }}</span>
            <span v-if="t.duration">{{ t.duration }} 秒</span>
            <span>{{ formatTime(t.createdAt) }}</span>
          </div>
          <video v-if="t.status === 'completed' && videoUrls[t.id]" :src="videoUrls[t.id]" controls class="dh-task-video" />
          <div class="dh-task-actions">
            <el-button
              v-if="t.status === 'completed'"
              size="small"
              type="primary"
              :loading="downloading === t.id"
              @click="handleDownload(t)"
            >
              下载
            </el-button>
            <el-button v-if="t.status === 'completed'" size="small" @click="saveToWorks(t)">存入作品库</el-button>
            <el-popconfirm title="删除该口播任务？" @confirm="handleDeleteTask(t.id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 形象预览弹窗 -->
    <el-dialog v-model="previewDialog" title="形象预览" width="420px" append-to-body>
      <div class="preview-body">
        <img v-if="previewAvatarData?.type === 'image'" :src="previewBlobUrl" alt="" />
        <video v-else :src="previewBlobUrl" controls autoplay muted />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Plus, Delete, View, VideoPlay } from '@element-plus/icons-vue';
import {
  uploadDigitalHumanAvatar,
  getDigitalHumanAvatars,
  deleteDigitalHumanAvatar,
  createDigitalHumanTask,
  getDigitalHumanTasks,
  deleteDigitalHumanTask,
  fetchDigitalHumanFile,
} from '@/api';
import { aiVideoStore } from './store';

const voiceOptions = [
  { label: '晓晓（女声·温柔）', value: 'zh-CN-XiaoxiaoNeural-Female' },
  { label: '晓伊（女声·活泼）', value: 'zh-CN-XiaoyiNeural-Female' },
  { label: '晓晓-多语言（女声）', value: 'zh-CN-XiaoxiaoMultilingualNeural-V2-Female' },
  { label: '云希（男声·阳光）', value: 'zh-CN-YunxiNeural-Male' },
  { label: '云健（男声·浑厚）', value: 'zh-CN-YunjianNeural-Male' },
  { label: '云扬（男声·播音）', value: 'zh-CN-YunyangNeural-Male' },
  { label: '云夏（男声·少年）', value: 'zh-CN-YunxiaNeural-Male' },
];

const avatars = ref<any[]>([]);
const selectedAvatarId = ref<number | null>(null);
const thumbUrls = ref<Record<number, string>>({});
const uploading = ref(false);

const form = reactive({
  title: '',
  script: '',
  voiceName: 'zh-CN-XiaoxiaoNeural-Female',
  aspect: '9:16',
  subtitleEnabled: true,
  bgmEnabled: false,
});

const creating = ref(false);
const tasks = ref<any[]>([]);
const loadingTasks = ref(false);
const videoUrls = ref<Record<number, string>>({});
const downloading = ref(0);

const previewDialog = ref(false);
const previewAvatarData = ref<any>(null);
const previewBlobUrl = ref('');

let pollTimer: ReturnType<typeof setInterval> | null = null;

const dhStateText = (s: string) =>
  ({ pending: '排队中', processing: '生成中', completed: '已完成', failed: '失败' } as Record<string, string>)[s] || s;
const dhStateTag = (s: string) =>
  ({ pending: 'info', processing: 'primary', completed: 'success', failed: 'danger' } as Record<string, any>)[s] || 'info';

const formatTime = (t: string) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '');

async function loadAvatars() {
  try {
    avatars.value = (await getDigitalHumanAvatars()) as any[];
    if (avatars.value.length && !avatars.value.some((a) => a.id === selectedAvatarId.value)) {
      selectedAvatarId.value = avatars.value[0].id;
    }
    for (const a of avatars.value) {
      if (a.fileUrl && !thumbUrls.value[a.id]) {
        try {
          const blob: any = await fetchDigitalHumanFile(a.fileUrl);
          thumbUrls.value[a.id] = URL.createObjectURL(blob);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* 拦截器已提示 */
  }
}

async function handleFileChange(file: any) {
  if (!file?.raw) return;
  const raw = file.raw as File;
  uploading.value = true;
  try {
    await uploadDigitalHumanAvatar(raw, raw.name.replace(/\.[^.]+$/, ''));
    ElMessage.success('形象上传成功');
    await loadAvatars();
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploading.value = false;
  }
}

async function handleDeleteAvatar(a: any) {
  try {
    await deleteDigitalHumanAvatar(a.id);
    if (thumbUrls.value[a.id]) URL.revokeObjectURL(thumbUrls.value[a.id]);
    delete thumbUrls.value[a.id];
    if (selectedAvatarId.value === a.id) selectedAvatarId.value = null;
    ElMessage.success('已删除');
    await loadAvatars();
  } catch {
    /* 拦截器已提示 */
  }
}

async function previewAvatar(a: any) {
  previewAvatarData.value = a;
  previewBlobUrl.value = thumbUrls.value[a.id] || '';
  previewDialog.value = true;
}

async function handleCreate() {
  if (!selectedAvatarId.value) {
    ElMessage.warning('请先选择数字人形象');
    return;
  }
  creating.value = true;
  try {
    await createDigitalHumanTask({
      avatarId: selectedAvatarId.value,
      title: form.title,
      script: form.script,
      voiceName: form.voiceName,
      aspect: form.aspect,
      subtitleEnabled: form.subtitleEnabled,
      bgmEnabled: form.bgmEnabled,
    });
    ElMessage.success('口播任务已创建，正在合成');
    form.script = '';
    await loadTasks();
  } catch {
    /* 拦截器已提示 */
  } finally {
    creating.value = false;
  }
}

async function loadTasks() {
  loadingTasks.value = true;
  try {
    tasks.value = (await getDigitalHumanTasks()) as any[];
    for (const t of tasks.value) {
      if (t.status === 'completed' && t.videoUrl && !videoUrls.value[t.id]) {
        try {
          const blob: any = await fetchDigitalHumanFile(t.videoUrl);
          videoUrls.value[t.id] = URL.createObjectURL(blob);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* 拦截器已提示 */
  } finally {
    loadingTasks.value = false;
  }
}

async function handleDownload(t: any) {
  if (!t.videoUrl) return;
  downloading.value = t.id;
  try {
    const blob: any = await fetchDigitalHumanFile(t.videoUrl);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.title || '口播视频'}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    /* 拦截器已提示 */
  } finally {
    downloading.value = 0;
  }
}

async function handleDeleteTask(id: number) {
  try {
    await deleteDigitalHumanTask(id);
    if (videoUrls.value[id]) URL.revokeObjectURL(videoUrls.value[id]);
    delete videoUrls.value[id];
    ElMessage.success('已删除');
    await loadTasks();
  } catch {
    /* 拦截器已提示 */
  }
}

function saveToWorks(t: any) {
  aiVideoStore.activeView = 'works';
}

function startPolling() {
  pollTimer = setInterval(async () => {
    if (tasks.value.some((t) => t.status === 'processing' || t.status === 'pending')) await loadTasks();
  }, 3000);
}

onMounted(() => {
  loadAvatars();
  loadTasks();
  startPolling();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  Object.values(thumbUrls.value).forEach((u) => URL.revokeObjectURL(u));
  Object.values(videoUrls.value).forEach((u) => URL.revokeObjectURL(u));
});
</script>

<style scoped>
.dh-container {
  display: flex;
  gap: 16px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.dh-panel {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.avatar-panel {
  width: 230px;
  flex-shrink: 0;
}

.create-panel {
  width: 400px;
  flex-shrink: 0;
}

.tasks-panel {
  flex: 1;
  min-width: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}

.panel-title span {
  flex: 1;
}

.upload-btn {
  flex-shrink: 0;
}

.avatar-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
  text-align: center;
  font-size: 13px;
  line-height: 1.7;
}

.avatar-card {
  border: 2px solid transparent;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.avatar-card.active {
  border-color: #2563eb;
}

.avatar-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 9/13;
  background: #f5f7fa;
}

.avatar-thumb img,
.avatar-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.type-tag {
  position: absolute;
  top: 6px;
  left: 6px;
}

.avatar-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-card:hover .avatar-mask {
  opacity: 1;
}

.avatar-name {
  padding: 8px 10px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar-tip {
  margin: 10px;
}

.create-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.switch-row {
  display: flex;
  gap: 24px;
}

.switch-row .el-form-item {
  margin-bottom: 8px;
}

.gen-tip {
  margin-bottom: 14px;
}

.create-btn {
  width: 100%;
}

.dh-tasks {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dh-task-card :deep(.el-card__body) {
  padding: 12px;
}

.dh-task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.dh-task-title {
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.dh-task-meta {
  display: flex;
  gap: 12px;
  color: #94a3b8;
  font-size: 12px;
  margin-top: 6px;
}

.task-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 6px;
}

.dh-task-video {
  width: 100%;
  max-height: 260px;
  border-radius: 6px;
  margin-top: 8px;
  background: #000;
}

.dh-task-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.preview-body img,
.preview-body video {
  width: 100%;
  border-radius: 6px;
}
</style>
