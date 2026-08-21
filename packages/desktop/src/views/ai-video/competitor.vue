<template>
  <div class="cp-container">
    <!-- 顶部看板 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">{{ stats.accountCount ?? 0 }}</div>
        <div class="stat-label">监控账号</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.workCount ?? 0 }}</div>
        <div class="stat-label">收录作品</div>
      </div>
      <div class="stat-card hot">
        <div class="stat-num">{{ stats.hotCount ?? 0 }}</div>
        <div class="stat-label">爆款作品</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.recent7d ?? 0 }}</div>
        <div class="stat-label">7 日新增</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ formatNum(stats.totalLikes) }}</div>
        <div class="stat-label">累计点赞</div>
      </div>
    </div>

    <el-tabs v-model="tab" class="cp-tabs">
      <!-- ===== 热门作品 ===== -->
      <el-tab-pane label="爆款榜" name="hot">
        <div class="hot-list">
          <div v-if="stats.topWorks?.length === 0" class="empty-state">
            <el-icon :size="44" color="#cbd5e1"><TrendCharts /></el-icon>
            <p>暂无爆款数据<br />在「作品管理」中录入作品并标记爆款</p>
          </div>
          <div v-for="(w, i) in stats.topWorks" :key="w.id" class="hot-item">
            <div class="hot-rank" :class="{ top: i < 3 }">{{ i + 1 }}</div>
            <div class="hot-info">
              <div class="hot-title">{{ w.title }}</div>
              <div class="hot-meta">
                <el-tag size="small" type="info">{{ platformLabel(w.platform) }}</el-tag>
                <span>{{ w.accountName }}</span>
                <span class="hot-like">♥ {{ formatNum(w.likes) }}</span>
                <span>播放 {{ formatNum(w.views) }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 账号管理 ===== -->
      <el-tab-pane label="账号管理" name="accounts">
        <div class="toolbar">
          <el-button type="primary" :icon="Plus" @click="openAccountDialog()">新增账号</el-button>
          <el-button :icon="Refresh" circle @click="loadAll" :loading="loading" />
        </div>
        <el-table :data="accounts" v-loading="loading" border stripe size="default">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="平台" width="120">
            <template #default="{ row }">
              <el-tag :type="platformTagType(row.platform)" size="small">{{ platformLabel(row.platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="账号名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="fans" label="粉丝数" width="110">
            <template #default="{ row }">{{ formatNum(row.fans) }}</template>
          </el-table-column>
          <el-table-column prop="workCount" label="作品数" width="90" />
          <el-table-column prop="url" label="主页链接" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link v-if="row.url" type="primary" :href="row.url" target="_blank">{{ row.url }}</el-link>
              <span v-else class="muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                {{ row.status === 1 ? '监控中' : '已停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openAccountDialog(row)">编辑</el-button>
              <el-popconfirm title="删除该账号及其全部作品？" @confirm="handleDeleteAccount(row.id)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ===== 作品管理 ===== -->
      <el-tab-pane label="作品管理" name="works">
        <div class="toolbar">
          <el-select v-model="workFilter.accountId" clearable placeholder="全部账号" style="width: 200px" @change="loadWorks">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
          <el-button type="primary" :icon="Plus" @click="openWorkDialog()">录入作品</el-button>
          <el-button :icon="Refresh" circle @click="loadWorks" :loading="loadingWorks" />
        </div>
        <el-table :data="workList" v-loading="loadingWorks" border stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="账号" width="140">
            <template #default="{ row }">
              <span>{{ row.account?.name || '-' }}</span>
              <el-tag size="small" type="info" style="margin-left: 4px">{{ platformLabel(row.account?.platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="作品标题" min-width="200" show-overflow-tooltip />
          <el-table-column prop="views" label="播放" width="100">
            <template #default="{ row }">{{ formatNum(row.views) }}</template>
          </el-table-column>
          <el-table-column prop="likes" label="点赞" width="100">
            <template #default="{ row }">{{ formatNum(row.likes) }}</template>
          </el-table-column>
          <el-table-column prop="comments" label="评论" width="90">
            <template #default="{ row }">{{ formatNum(row.comments) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="分享" width="90">
            <template #default="{ row }">{{ formatNum(row.shares) }}</template>
          </el-table-column>
          <el-table-column label="爆款" width="90">
            <template #default="{ row }">
              <el-switch :model-value="!!row.isHot" @change="(v: boolean) => toggleHot(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="发布时间" width="160">
            <template #default="{ row }">{{ formatDate(row.publishedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openWorkDialog(row)">编辑</el-button>
              <el-popconfirm title="删除该作品？" @confirm="handleDeleteWork(row.id)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            layout="total, prev, pager, next"
            :total="workTotal"
            :page-size="workPageSize"
            :current-page="workPage"
            @current-change="(p: number) => { workPage = p; loadWorks(); }"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 账号编辑弹窗 -->
    <el-dialog v-model="accountDialog.visible" :title="accountDialog.form.id ? '编辑账号' : '新增账号'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="平台" required>
          <el-select v-model="accountDialog.form.platform" style="width: 100%">
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号名称" required>
          <el-input v-model="accountDialog.form.name" maxlength="100" placeholder="例如：XX美妆日记" />
        </el-form-item>
        <el-form-item label="粉丝数">
          <el-input-number v-model="accountDialog.form.fans" :min="0" :step="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="主页链接">
          <el-input v-model="accountDialog.form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="accountDialog.form.remark" type="textarea" :rows="2" placeholder="关注原因 / 对标方向" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingAccount" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>

    <!-- 作品编辑弹窗 -->
    <el-dialog v-model="workDialog.visible" :title="workDialog.form.id ? '编辑作品' : '录入作品'" width="560px">
      <el-form label-width="80px">
        <el-form-item label="所属账号" required>
          <el-select v-model="workDialog.form.accountId" style="width: 100%" placeholder="选择账号">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="作品标题" required>
          <el-input v-model="workDialog.form.title" maxlength="500" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="播放量"><el-input-number v-model="workDialog.form.views" :min="0" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="点赞数"><el-input-number v-model="workDialog.form.likes" :min="0" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评论数"><el-input-number v-model="workDialog.form.comments" :min="0" style="width: 100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分享数"><el-input-number v-model="workDialog.form.shares" :min="0" style="width: 100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="发布时间">
          <el-date-picker v-model="workDialog.form.publishedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="作品链接">
          <el-input v-model="workDialog.form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="封面链接">
          <el-input v-model="workDialog.form.coverUrl" placeholder="https://...（可选）" />
        </el-form-item>
        <el-form-item label="标记爆款">
          <el-switch v-model="workDialog.form.isHot" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="workDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingWork" @click="saveWork">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Refresh, TrendCharts } from '@element-plus/icons-vue';
import {
  getCompetitorPlatforms,
  getCompetitorStats,
  getCompetitorAccounts,
  createCompetitorAccount,
  updateCompetitorAccount,
  deleteCompetitorAccount,
  getCompetitorWorks,
  createCompetitorWork,
  updateCompetitorWork,
  deleteCompetitorWork,
} from '@/api';

const tab = ref('hot');
const stats = ref<any>({});
const platforms = ref<any[]>([]);
const accounts = ref<any[]>([]);
const loading = ref(false);

// 作品列表
const workList = ref<any[]>([]);
const loadingWorks = ref(false);
const workPage = ref(1);
const workPageSize = 10;
const workTotal = ref(0);
const workFilter = reactive<{ accountId: number | null }>({ accountId: null });

// 账号弹窗
const accountDialog = reactive({
  visible: false,
  saving: false,
  form: { id: 0, platform: 'douyin', name: '', fans: 0, url: '', remark: '' },
});
const savingAccount = ref(false);

// 作品弹窗
const workDialog = reactive({
  visible: false,
  form: {
    id: 0,
    accountId: 0,
    title: '',
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    publishedAt: '',
    url: '',
    coverUrl: '',
    isHot: false,
  },
});
const savingWork = ref(false);

const PLATFORM_MAP: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  wechat_channels: '微信视频号',
  bilibili: 'B站',
  weibo: '微博',
};

onMounted(async () => {
  try {
    const res: any = await getCompetitorPlatforms();
    platforms.value = res || [];
  } catch {
    /* 错误已在拦截器中提示 */
  }
  await Promise.all([loadStats(), loadAccounts(), loadWorks()]);
});

async function loadStats() {
  try {
    const res: any = await getCompetitorStats();
    stats.value = res || {};
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

async function loadAccounts() {
  loading.value = true;
  try {
    const res: any = await getCompetitorAccounts();
    accounts.value = res || [];
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    loading.value = false;
  }
}

async function loadWorks() {
  loadingWorks.value = true;
  try {
    const res: any = await getCompetitorWorks({
      page: workPage.value,
      pageSize: workPageSize,
      accountId: workFilter.accountId || undefined,
    });
    workList.value = res?.list || [];
    workTotal.value = res?.total || 0;
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    loadingWorks.value = false;
  }
}

async function loadAll() {
  await Promise.all([loadStats(), loadAccounts(), loadWorks()]);
}

function openAccountDialog(row?: any) {
  accountDialog.form = row
    ? { id: row.id, platform: row.platform, name: row.name, fans: row.fans, url: row.url || '', remark: row.remark || '' }
    : { id: 0, platform: 'douyin', name: '', fans: 0, url: '', remark: '' };
  accountDialog.visible = true;
}

async function saveAccount() {
  if (!accountDialog.form.name.trim()) {
    ElMessage.warning('请填写账号名称');
    return;
  }
  savingAccount.value = true;
  try {
    const f = accountDialog.form;
    if (f.id) {
      await updateCompetitorAccount(f.id, { ...f });
    } else {
      await createCompetitorAccount({ ...f });
    }
    ElMessage.success('已保存');
    accountDialog.visible = false;
    await loadAll();
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    savingAccount.value = false;
  }
}

async function handleDeleteAccount(id: number) {
  try {
    await deleteCompetitorAccount(id);
    ElMessage.success('已删除');
    await loadAll();
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

function openWorkDialog(row?: any) {
  workDialog.form = row
    ? {
        id: row.id,
        accountId: row.accountId,
        title: row.title,
        views: row.views || 0,
        likes: row.likes || 0,
        comments: row.comments || 0,
        shares: row.shares || 0,
        publishedAt: row.publishedAt ? String(row.publishedAt).slice(0, 19) : '',
        url: row.url || '',
        coverUrl: row.coverUrl || '',
        isHot: !!row.isHot,
      }
    : {
        id: 0,
        accountId: workFilter.accountId || accounts.value[0]?.id || 0,
        title: '',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        publishedAt: '',
        url: '',
        coverUrl: '',
        isHot: false,
      };
  workDialog.visible = true;
}

async function saveWork() {
  if (!workDialog.form.accountId) {
    ElMessage.warning('请选择所属账号');
    return;
  }
  if (!workDialog.form.title.trim()) {
    ElMessage.warning('请填写作品标题');
    return;
  }
  savingWork.value = true;
  try {
    const f = workDialog.form;
    const payload = { ...f };
    if (f.id) {
      await updateCompetitorWork(f.id, payload);
    } else {
      await createCompetitorWork(payload);
    }
    ElMessage.success('已保存');
    workDialog.visible = false;
    await Promise.all([loadWorks(), loadStats(), loadAccounts()]);
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    savingWork.value = false;
  }
}

async function toggleHot(row: any, v: boolean) {
  try {
    await updateCompetitorWork(row.id, { isHot: v });
    ElMessage.success(v ? '已标记为爆款' : '已取消爆款');
    await Promise.all([loadWorks(), loadStats()]);
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

async function handleDeleteWork(id: number) {
  try {
    await deleteCompetitorWork(id);
    ElMessage.success('已删除');
    await Promise.all([loadWorks(), loadStats()]);
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

function platformLabel(v?: string) {
  return (v && PLATFORM_MAP[v]) || v || '-';
}
function platformTagType(v?: string) {
  const map: Record<string, string> = { douyin: 'danger', xiaohongshu: 'danger', kuaishou: 'warning', wechat_channels: 'success', bilibili: 'primary', weibo: 'info' };
  return (v && map[v]) || 'info';
}
function formatNum(n?: number) {
  if (n === null || n === undefined) return '0';
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}
function formatDate(iso?: string) {
  if (!iso) return '-';
  return String(iso).replace('T', ' ').slice(0, 16);
}
</script>

<style scoped>
.cp-container {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.stat-card {
  background: linear-gradient(135deg, #f5f7fa, #fff);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}
.stat-card.hot {
  background: linear-gradient(135deg, #fef0f0, #fff);
  border-color: #fde2e2;
}
.stat-num {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}
.stat-card.hot .stat-num {
  color: #f56c6c;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.cp-tabs {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 8px 16px 16px;
}
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.hot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 14px;
  background: #fafafa;
}
.hot-rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #dcdfe6;
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.hot-rank.top {
  background: #f56c6c;
}
.hot-info {
  flex: 1;
  min-width: 0;
}
.hot-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.hot-like {
  color: #f56c6c;
}
.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 13px;
  line-height: 1.8;
}
.muted {
  color: #cbd5e1;
}
</style>
