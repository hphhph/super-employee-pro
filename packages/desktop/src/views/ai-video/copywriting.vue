<template>
  <div class="cw-container">
    <!-- 左/上：场景模板 -->
    <div class="cw-panel template-panel">
      <div class="panel-title">
        <el-icon><EditPen /></el-icon>
        <span>场景模板</span>
        <span class="panel-sub">参考爆款结构预设，选中即用</span>
      </div>
      <div class="template-grid">
        <div
          v-for="t in templates"
          :key="t.scenario"
          class="template-card"
          :class="{ active: selectedScenario === t.scenario }"
          @click="selectedScenario = t.scenario"
        >
          <div class="tpl-icon">{{ t.icon }}</div>
          <div class="tpl-name">{{ t.desc }}</div>
          <div class="tpl-desc">{{ t.scenario }}</div>
        </div>
      </div>

      <div class="panel-title" style="margin-top: 16px">
        <el-icon><MagicStick /></el-icon>
        <span>生成文案</span>
      </div>
      <el-form label-position="top" size="large">
        <el-form-item label="主题（必填）">
          <el-input v-model="form.subject" maxlength="60" placeholder="例如：夏季敏感肌护肤指南 / 办公室神器推荐" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="核心卖点（可选）">
              <el-input v-model="form.points" maxlength="80" placeholder="用逗号分隔，例如：成分温和，见效快，性价比高" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="文案风格（可选）">
              <el-select v-model="form.style" clearable placeholder="默认由场景决定">
                <el-option label="口语化" value="口语化" />
                <el-option label="专业严谨" value="专业严谨" />
                <el-option label="幽默轻松" value="幽默轻松" />
                <el-option label="情绪煽动" value="情绪煽动" />
                <el-option label="讲故事" value="讲故事" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="视频时长">
          <el-radio-group v-model="form.duration">
            <el-radio-button label="15秒" value="15秒" />
            <el-radio-button label="30秒" value="30秒" />
            <el-radio-button label="60秒" value="60秒" />
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="generating"
            :disabled="!form.subject.trim()"
            class="gen-btn"
            @click="handleGenerate"
          >
            <el-icon><MagicStick /></el-icon>
            AI 生成文案
          </el-button>
        </el-form-item>
      </el-form>

      <template v-if="result.content">
        <div class="result-block">
          <div class="result-head">
            <span class="result-title">{{ result.title || form.subject }}</span>
            <div>
              <el-button size="small" text type="primary" :icon="CopyDocument" @click="copyText(result.content)">复制</el-button>
              <el-button size="small" type="primary" @click="sendToVideo">去生成视频</el-button>
            </div>
          </div>
          <pre class="result-content">{{ result.content }}</pre>
        </div>
      </template>
    </div>

    <!-- 右：历史记录 -->
    <div class="cw-panel records-panel">
      <div class="panel-title">
        <el-icon><Document /></el-icon>
        <span>历史文案</span>
        <el-button size="small" text :icon="Refresh" circle @click="loadRecords" :loading="loadingRecords" />
      </div>
      <div class="records-list">
        <div v-if="records.length === 0 && !loadingRecords" class="empty-state">
          <el-icon :size="44" color="#cbd5e1"><Document /></el-icon>
          <p>还没有文案记录<br />生成后自动保存到这里</p>
        </div>
        <el-card v-for="r in records" :key="r.id" class="record-card" shadow="hover">
          <div class="record-head">
            <el-tag size="small" type="info">{{ r.scenario }}</el-tag>
            <span class="record-time">{{ formatTime(r.createdAt) }}</span>
          </div>
          <div class="record-subject">{{ r.title || r.subject }}</div>
          <div class="record-content">{{ r.content }}</div>
          <div class="record-actions">
            <el-button size="small" text type="primary" :icon="CopyDocument" @click="copyText(r.content)">复制文案</el-button>
            <el-button size="small" text type="primary" @click="sendToVideo(r.subject, r.content)">去生成视频</el-button>
            <el-popconfirm title="删除该条文案记录？" @confirm="handleDelete(r.id)">
              <template #reference>
                <el-button size="small" text type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { CopyDocument, Document, Refresh } from '@element-plus/icons-vue';
import {
  getCopywritingTemplates,
  generateCopywriting,
  getCopywritingRecords,
  deleteCopywritingRecord,
} from '@/api';
import { sendToGenerate } from './store';

const templates = ref<any[]>([]);
const selectedScenario = ref('带货');
const form = reactive({
  subject: '',
  points: '',
  style: '',
  duration: '30秒',
});
const generating = ref(false);
const result = reactive({ content: '', title: '' });

const records = ref<any[]>([]);
const loadingRecords = ref(false);

onMounted(async () => {
  try {
    const res: any = await getCopywritingTemplates();
    if (Array.isArray(res) && res.length) {
      templates.value = res;
      selectedScenario.value = res[0].scenario;
    }
  } catch {
    /* 错误已在拦截器中提示 */
  }
  await loadRecords();
});

async function handleGenerate() {
  generating.value = true;
  try {
    const res: any = await generateCopywriting({
      scenario: selectedScenario.value,
      subject: form.subject,
      points: form.points,
      style: form.style,
      duration: form.duration,
    });
    result.content = res?.content || '';
    result.title = res?.record?.title || form.subject;
    if (result.content) {
      ElMessage.success('文案已生成');
      await loadRecords();
    }
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    generating.value = false;
  }
}

async function loadRecords() {
  loadingRecords.value = true;
  try {
    const res: any = await getCopywritingRecords({ page: 1, pageSize: 50 });
    records.value = res?.list || res?.records || res?.items || [];
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    loadingRecords.value = false;
  }
}

async function handleDelete(id: number) {
  try {
    await deleteCopywritingRecord(id);
    ElMessage.success('已删除');
    await loadRecords();
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

function sendToVideo(subject?: string, content?: string) {
  const s = subject || form.subject || '未命名';
  const c = content || result.content;
  if (!c) {
    ElMessage.warning('请先生成文案');
    return;
  }
  sendToGenerate(s, c);
}

function copyText(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'));
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style scoped>
.cw-container {
  display: flex;
  gap: 16px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}
.cw-panel {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.template-panel {
  flex: 1.4;
  overflow-y: auto;
}
.records-panel {
  flex: 1;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}
.panel-sub {
  font-size: 12px;
  font-weight: 400;
  color: #94a3b8;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.template-card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}
.template-card:hover {
  border-color: #2563eb;
}
.template-card.active {
  border-color: #2563eb;
  background: #eff6ff;
}
.tpl-icon {
  font-size: 24px;
  margin-bottom: 6px;
}
.tpl-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}
.tpl-desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.gen-btn {
  width: 100%;
}
.result-block {
  margin-top: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 14px;
  background: #f8f9fb;
  overflow: hidden;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}
.result-title {
  font-weight: 600;
  font-size: 14px;
}
.result-content {
  margin: 0;
  padding: 14px;
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
  color: #1e293b;
  max-height: 300px;
  overflow-y: auto;
  font-family: inherit;
}
.records-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.record-card :deep(.el-card__body) {
  padding: 12px 14px;
}
.record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.record-time {
  font-size: 11px;
  color: #94a3b8;
}
.record-subject {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.record-content {
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}
.record-actions {
  display: flex;
  gap: 4px;
}
.empty-state {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 13px;
  line-height: 1.8;
}
</style>
