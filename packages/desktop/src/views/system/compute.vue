<template>
  <div class="page-container">
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>算力配额</span></template>
          <div style="text-align: center; padding: 12px 0">
            <el-progress type="dashboard" :percentage="usedPercentage" :width="140">
              <template #default>
                <div style="font-size: 24px; font-weight: 700">{{ quota.remaining ?? '-' }}</div>
                <div style="font-size: 12px; color: #909399">剩余</div>
              </template>
            </el-progress>
            <div style="margin-top: 12px; color: #909399; font-size: 13px">
              总量 {{ quota.total ?? '-' }} / 已用 {{ quota.used ?? '-' }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header><span>消耗类型说明</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="AI 对话">每次 1 点</el-descriptions-item>
            <el-descriptions-item label="AI 生图">每次 10 点</el-descriptions-item>
            <el-descriptions-item label="AI 生视频">每次 50 点</el-descriptions-item>
            <el-descriptions-item label="语音合成 TTS">每次 5 点</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header><span>消耗记录</span></template>
      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column label="类型" width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="typeMap[row.type]?.tagType || 'info'">{{ typeMap[row.type]?.label || row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cost" label="消耗" width="100" />
        <el-table-column prop="detail" label="详情" min-width="300" show-overflow-tooltip />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getComputeQuota, getComputeLogs } from '@/api';
import dayjs from 'dayjs';

const quota = ref<any>({});
const logs = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);

const typeMap: Record<string, { label: string; tagType: string }> = {
  chat: { label: 'AI对话', tagType: 'primary' },
  image: { label: 'AI生图', tagType: 'success' },
  video: { label: 'AI生视频', tagType: 'warning' },
  tts: { label: '语音合成', tagType: 'info' },
  digital_human: { label: '数字人', tagType: 'danger' },
  sora: { label: 'Sora生成', tagType: 'warning' },
};

const usedPercentage = computed(() => {
  if (!quota.value.total) return 0;
  return Math.min(100, Math.round((quota.value.used / quota.value.total) * 100));
});

const loadData = async () => {
  loading.value = true;
  try {
    quota.value = (await getComputeQuota()) || {};
    const res: any = await getComputeLogs({ page: page.value, pageSize: 20 });
    logs.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
};

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss');

onMounted(loadData);
</script>
