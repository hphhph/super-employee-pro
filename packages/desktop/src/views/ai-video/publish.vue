<template>
  <div class="pub-container">
    <!-- 顶部统计卡 -->
    <div class="pub-stats">
      <el-card v-for="s in statsCards" :key="s.label" class="stat-card" shadow="never">
        <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </el-card>
    </div>

    <!-- 标签页：发布任务 / 账号管理 -->
    <el-tabs v-model="activeTab" class="pub-tabs">
      <el-tab-pane label="发布任务" name="tasks">
        <div class="pub-toolbar">
          <el-button type="primary" :icon="Plus" @click="showCreate = true">新建发布任务</el-button>
          <div class="spacer" />
          <el-input v-model="search" placeholder="搜索任务标题" clearable style="width: 220px" />
          <el-button :icon="Refresh" circle :loading="loading" @click="loadTasks" />
        </div>

        <el-table :data="filteredTasks" v-loading="loading" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="作品" min-width="160">
            <template #default="{ row }">
              <div class="task-work">{{ row.videoTitle || row.videoId }}</div>
            </template>
          </el-table-column>
          <el-table-column label="平台" width="180">
            <template #default="{ row }">
              <el-tag v-for="p in row.platforms" :key="p" size="small" class="plat-tag">{{ platformName(p) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="模式" width="100">
            <template #default="{ row }">
              <el-tag :type="row.type === 'schedule' ? 'warning' : row.type === 'batch_publish' ? 'success' : 'primary'" size="small">
                {{ { publish: '立即发布', schedule: '定时发布', batch_publish: '批量发布' }[row.type] || row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              <div class="task-time">{{ formatDate(row.createdAt) }}</div>
              <div v-if="row.type === 'schedule' && row.scheduledAt" class="task-time sub">定时: {{ formatDate(row.scheduledAt) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="140">
            <template #default="{ row }">
              <div class="task-progress">
                <el-progress :percentage="progressPct(row)" :status="row.status === 'failed' ? 'exception' : row.status === 'completed' ? 'success' : undefined" :stroke-width="6" />
                <span class="prog-text">{{ row.success }}/{{ row.total }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'pending' || row.status === 'running'" size="small" text type="warning" @click="handleCancel(row)">取消</el-button>
              <el-popconfirm title="删除该任务？" @confirm="handleDelete(row)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="filteredTasks.length === 0 && !loading" class="empty-state">
          <el-icon :size="48" color="#cbd5e1"><Promotion /></el-icon>
          <p>暂无发布任务<br />点击「新建发布任务」开始多平台分发</p>
        </div>
      </el-tab-pane>

      <el-tab-pane label="账号管理" name="accounts">
        <div class="pub-toolbar">
          <el-button type="primary" :icon="Plus" @click="showAccount = true">添加账号</el-button>
          <div class="spacer" />
          <el-button :icon="Refresh" circle :loading="accLoading" @click="loadAccounts" />
        </div>

        <el-table :data="accounts" v-loading="accLoading" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="平台" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ platformName(row.platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="accountName" label="账号名称" min-width="140" />
          <el-table-column prop="accountId" label="平台账号ID" min-width="140" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-switch v-model="row.status" active-value="active" inactive-value="inactive" @change="(v: any) => toggleAccount(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text @click="editAccount(row)">编辑</el-button>
              <el-popconfirm title="删除该账号？" @confirm="deleteAccount(row)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建发布任务弹窗 -->
    <el-dialog v-model="showCreate" title="新建发布任务" width="560px" :close-on-click-modal="false">
      <el-form :model="form" label-width="90px">
        <el-form-item label="选择作品" required>
          <el-select v-model="form.videoId" placeholder="从作品库选择" style="width: 100%">
            <el-option v-for="w in works" :key="w.key" :label="w.title" :value="w.source === 'smart' ? w.sourceId : w.videoUrl">
              <span style="float: left">{{ w.title }}</span>
              <span style="float: right; color: #94a3b8; font-size: 12px">{{ w.source === 'smart' ? '智能成片' : '数字人口播' }}</span>
            </el-option>
          </el-select>
          <div v-if="works.length === 0" class="form-tip">作品库为空，先去「智能成片」或「数字人口播」生成视频</div>
        </el-form-item>

        <el-form-item label="发布平台" required>
          <el-checkbox-group v-model="form.platforms">
            <el-checkbox v-for="p in platformList" :key="p.key" :label="p.key">{{ p.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="发布模式" required>
          <el-radio-group v-model="form.type">
            <el-radio-button label="publish">立即发布</el-radio-button>
            <el-radio-button label="schedule">定时发布</el-radio-button>
            <el-radio-button label="batch_publish">批量发布</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.type === 'schedule'" label="定时时间" required>
          <el-date-picker v-model="form.scheduledAt" type="datetime" placeholder="选择发布时间" style="width: 100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>

        <el-form-item label="任务标题">
          <el-input v-model="form.title" placeholder="可选，用于标识该发布任务" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" :disabled="!canCreate" @click="handleCreate">创建任务</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑账号弹窗 -->
    <el-dialog v-model="showAccount" :title="accountForm.id ? '编辑账号' : '添加账号'" width="480px" :close-on-click-modal="false">
      <el-form :model="accountForm" label-width="100px">
        <el-form-item label="平台" required>
          <el-select v-model="accountForm.platform" placeholder="选择平台" style="width: 100%">
            <el-option v-for="p in platformList" :key="p.key" :label="p.name" :value="p.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号名称" required>
          <el-input v-model="accountForm.accountName" placeholder="如：品牌官方号" />
        </el-form-item>
        <el-form-item label="平台账号ID" required>
          <el-input v-model="accountForm.accountId" placeholder="平台侧唯一标识" />
        </el-form-item>
        <el-form-item label="主页链接">
          <el-input v-model="accountForm.homeUrl" placeholder="https://..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAccount = false">取消</el-button>
        <el-button type="primary" :loading="accSaving" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Refresh, Promotion } from '@element-plus/icons-vue';
import {
  getPublishStats,
  getPublishPlatforms,
  getPublishTasks,
  createPublishTask,
  cancelPublishTask,
  deletePublishTask,
  getPublishAccounts,
  createPublishAccount,
  updatePublishAccount,
  deletePublishAccount,
  getVideoTasks,
  getDigitalHumanTasks,
} from '@/api';

const activeTab = ref('tasks');
const loading = ref(false);
const accLoading = ref(false);
const showCreate = ref(false);
const showAccount = ref(false);
const creating = ref(false);
const accSaving = ref(false);
const search = ref('');

const stats = ref<any>({});
const tasks = ref<any[]>([]);
const accounts = ref<any[]>([]);
const platformList = ref<{ key: string; name: string }[]>([]);
const works = ref<any[]>([]);

const statsCards = computed(() => [
  { label: '绑定平台', value: stats.value.platformCount ?? 0, color: '#2563eb' },
  { label: '绑定账号', value: stats.value.accountCount ?? 0, color: '#67c23a' },
  { label: '今日发布', value: stats.value.todayCount ?? 0, color: '#e6a23c' },
  { label: '成功率', value: `${stats.value.successRate ?? 0}%`, color: '#f56c6c' },
]);

const filteredTasks = computed(() => {
  if (!search.value) return tasks.value;
  return tasks.value.filter((t) =>
    (t.videoTitle || String(t.videoId)).toLowerCase().includes(search.value.toLowerCase()),
  );
});

const form = ref({
  videoId: '',
  platforms: [] as string[],
  type: 'publish',
  scheduledAt: '',
  title: '',
});

const accountForm = ref<any>({});

const canCreate = computed(() =>
  Boolean(form.value.videoId && form.value.platforms.length),
);

onMounted(() => {
  loadStats();
  loadPlatforms();
  loadTasks();
  loadAccounts();
  loadWorks();
});

watch(showCreate, (v) => {
  if (!v) return;
  form.value = { videoId: '', platforms: [], type: 'publish', scheduledAt: '', title: '' };
  loadWorks();
});

watch(showAccount, (v) => {
  if (!v) accountForm.value = {};
});

async function loadStats() {
  try {
    const res: any = await getPublishStats();
    stats.value = res || {};
  } catch { /* */ }
}

async function loadPlatforms() {
  try {
    const res: any = await getPublishPlatforms();
    platformList.value = Array.isArray(res) ? res : res?.list || [];
  } catch { /* */ }
}

async function loadTasks() {
  loading.value = true;
  try {
    const res: any = await getPublishTasks({ page: 1, pageSize: 50 });
    tasks.value = res?.list || res?.records || [];
  } catch { /* */ } finally {
    loading.value = false;
  }
}

async function loadAccounts() {
  accLoading.value = true;
  try {
    const res: any = await getPublishAccounts();
    accounts.value = Array.isArray(res) ? res : res?.list || [];
  } catch { /* */ } finally {
    accLoading.value = false;
  }
}

async function loadWorks() {
  try {
    const [smartRes, dhRes]: any[] = await Promise.all([
      getVideoTasks({ page: 1, pageSize: 50 }),
      getDigitalHumanTasks(),
    ]);
    const smartTasks = smartRes?.tasks || [];
    const dhTasks = Array.isArray(dhRes) ? dhRes : dhRes?.list || [];
    const list: any[] = [];
    for (const t of smartTasks) {
      if (t.state !== 1) continue;
      const videoUrls = Array.isArray(t.videos) ? t.videos : [];
      if (!videoUrls.length) continue;
      list.push({
        key: `smart-${t.task_id}`,
        source: 'smart',
        sourceId: t.task_id,
        title: t.params?.video_subject || '未命名视频',
        videoUrl: videoUrls[0],
      });
    }
    for (const t of dhTasks) {
      if (t.status !== 'completed' || !t.videoUrl) continue;
      list.push({
        key: `digital-${t.id}`,
        source: 'digital',
        sourceId: t.id,
        title: t.title || t.script?.slice(0, 30) || '口播视频',
        videoUrl: t.videoUrl,
      });
    }
    works.value = list;
  } catch { /* */ }
}

async function handleCreate() {
  if (!canCreate.value) return;
  creating.value = true;
  try {
    const payload: any = {
      videoId: form.value.videoId,
      platforms: form.value.platforms,
      type: form.value.type,
      title: form.value.title || undefined,
    };
    if (form.value.type === 'schedule' && form.value.scheduledAt) {
      payload.scheduledAt = form.value.scheduledAt;
    }
    await createPublishTask(payload);
    ElMessage.success('发布任务已创建');
    showCreate.value = false;
    await loadTasks();
    await loadStats();
  } catch { /* */ } finally {
    creating.value = false;
  }
}

async function handleCancel(row: any) {
  try {
    await cancelPublishTask(row.id);
    ElMessage.success('已取消');
    await loadTasks();
    await loadStats();
  } catch { /* */ }
}

async function handleDelete(row: any) {
  try {
    await deletePublishTask(row.id);
    ElMessage.success('已删除');
    await loadTasks();
    await loadStats();
  } catch { /* */ }
}

function editAccount(row: any) {
  accountForm.value = { ...row };
  showAccount.value = true;
}

async function saveAccount() {
  accSaving.value = true;
  try {
    const data = {
      platform: accountForm.value.platform,
      accountName: accountForm.value.accountName,
      accountId: accountForm.value.accountId,
      homeUrl: accountForm.value.homeUrl || undefined,
      status: 'active',
    };
    if (accountForm.value.id) {
      await updatePublishAccount(accountForm.value.id, data);
    } else {
      await createPublishAccount(data);
    }
    ElMessage.success('保存成功');
    showAccount.value = false;
    await loadAccounts();
    await loadStats();
  } catch { /* */ } finally {
    accSaving.value = false;
  }
}

async function toggleAccount(row: any, status: string) {
  try {
    await updatePublishAccount(row.id, { status });
    ElMessage.success('状态已更新');
  } catch {
    row.status = status === 'active' ? 'inactive' : 'active';
  }
}

async function deleteAccount(row: any) {
  try {
    await deletePublishAccount(row.id);
    ElMessage.success('已删除');
    await loadAccounts();
    await loadStats();
  } catch { /* */ }
}

function platformName(key: string) {
  const map: Record<string, string> = {
    douyin: '抖音', xiaohongshu: '小红书', kuaishou: '快手',
    wechat_channels: '视频号', bilibili: 'B站', weibo: '微博',
  };
  return map[key] || key;
}

function progressPct(row: any) {
  const t = row.total || 0;
  if (!t) return 0;
  return Math.round(((row.success || 0) / t) * 100);
}

function statusText(s: string) {
  return ({ pending: '待执行', running: '执行中', completed: '已完成', cancelled: '已取消', failed: '失败' } as Record<string, string>)[s] || s;
}

function statusType(s: string) {
  return ({ pending: 'info', running: 'primary', completed: 'success', cancelled: 'warning', failed: 'danger' } as Record<string, any>)[s] || 'info';
}

function formatDate(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style scoped>
.pub-container {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}
.pub-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.stat-card :deep(.el-card__body) {
  padding: 14px 16px;
  text-align: center;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
}
.pub-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.pub-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.spacer {
  flex: 1;
}
.plat-tag {
  margin-right: 6px;
  margin-bottom: 2px;
}
.task-work {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-time {
  font-size: 12px;
  color: #475569;
}
.task-time.sub {
  color: #94a3b8;
  font-size: 11px;
}
.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-progress :deep(.el-progress) {
  flex: 1;
}
.prog-text {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}
.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 60px 0;
  font-size: 13px;
  line-height: 2;
}
.form-tip {
  font-size: 12px;
  color: #e6a23c;
  margin-top: 4px;
}
</style>
