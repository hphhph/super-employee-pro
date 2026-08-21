<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-icon" :style="{ backgroundColor: card.color }">
              <el-icon :size="24" color="#fff"><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 今日数据 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>今日对话</span></template>
          <div class="today-stat">
            <span class="today-value">{{ overview.today?.chats || 0 }}</span>
            <span class="today-label">条消息</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>今日生成图片</span></template>
          <div class="today-stat">
            <span class="today-value">{{ overview.today?.images || 0 }}</span>
            <span class="today-label">张</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>本月算力消耗</span></template>
            <div class="today-stat">
            <span class="today-value">{{ overview.monthComputeCost || 0 }}</span>
            <span class="today-label">点</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 7天趋势 -->
    <el-card shadow="hover">
      <template #header><span>最近 7 天使用趋势</span></template>
      <el-table :data="trend" stripe>
        <el-table-column prop="date" label="日期" width="150" />
        <el-table-column prop="chats" label="AI对话消息数" />
        <el-table-column prop="messages" label="企微消息数" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getDashboardOverview, getDashboardTrend } from '@/api';

const overview = ref<any>({});
const trend = ref<any[]>([]);

const statCards = computed(() => [
  { label: '企业用户', value: overview.value.users ?? '-', icon: 'User', color: '#409eff' },
  { label: '企微客户', value: overview.value.fans ?? '-', icon: 'Star', color: '#67c23a' },
  { label: 'AI会话', value: overview.value.chatSessions ?? '-', icon: 'ChatDotRound', color: '#e6a23c' },
  { label: '消息总量', value: overview.value.messages ?? '-', icon: 'Message', color: '#f56c6c' },
]);

onMounted(async () => {
  overview.value = (await getDashboardOverview()) || {};
  trend.value = ((await getDashboardTrend()) as any[]) || [];
});
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.today-stat {
  text-align: center;
  padding: 10px 0;
}

.today-value {
  font-size: 32px;
  font-weight: 700;
  color: #409eff;
}

.today-label {
  margin-left: 8px;
  color: #909399;
}
</style>
