<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <span style="font-weight: 600">智能体管理</span>
        <el-button type="primary" :icon="Plus" @click="openDialog()">创建智能体</el-button>
      </div>

      <el-row :gutter="16">
        <el-col :span="8" v-for="agent in list" :key="agent.id">
          <el-card shadow="hover" style="margin-bottom: 16px">
            <div class="agent-card">
              <el-avatar :size="48" style="background: linear-gradient(135deg, #667eea, #764ba2)">
                {{ agent.name?.[0] }}
              </el-avatar>
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-desc">{{ agent.description || '暂无描述' }}</div>
                <div class="agent-meta">
                  <el-tag size="small">{{ agent.model }}</el-tag>
                  <el-tag v-if="agent.botId" size="small" type="success">Coze</el-tag>
                </div>
              </div>
            </div>
            <div class="agent-actions">
              <el-button size="small" type="primary" plain @click="$router.push('/ai-chat')">对话</el-button>
              <el-button size="small" @click="openDialog(agent)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="handleDelete(agent)">删除</el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑智能体' : '创建智能体'" width="620px">
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：销售话术专家" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="一句话描述智能体用途" />
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="form.model" style="width: 100%">
            <el-option label="DeepSeek Chat" value="deepseek-chat" />
            <el-option label="DeepSeek Reasoner" value="deepseek-reasoner" />
          </el-select>
        </el-form-item>
        <el-form-item label="Coze Bot ID">
          <el-input v-model="form.botId" placeholder="可选，接入 Coze 智能体平台" />
        </el-form-item>
        <el-form-item label="系统提示词">
          <el-input v-model="form.systemPrompt" type="textarea" :rows="6"
            placeholder="定义智能体的角色、能力边界和行为规范" />
        </el-form-item>
        <el-form-item label="温度">
          <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" style="width: 90%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getKnowledgeAgents, createKnowledgeAgent, updateKnowledgeAgent, deleteKnowledgeAgent } from '@/api';

const list = ref<any[]>([]);
const dialogVisible = ref(false);
const editing = ref<any>(null);
const form = reactive({
  name: '', description: '', model: 'deepseek-chat', botId: '',
  systemPrompt: '', temperature: 0.7,
});

const loadData = async () => {
  const res: any = await getKnowledgeAgents({ page: 1, pageSize: 50 });
  list.value = res.list || [];
};

const openDialog = (row?: any) => {
  editing.value = row || null;
  Object.assign(form, {
    name: row?.name || '',
    description: row?.description || '',
    model: row?.model || 'deepseek-chat',
    botId: row?.botId || '',
    systemPrompt: row?.systemPrompt || '',
    temperature: row?.temperature ?? 0.7,
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!form.name) return ElMessage.warning('请输入名称');
  if (editing.value) {
    await updateKnowledgeAgent(editing.value.id, { ...form });
  } else {
    await createKnowledgeAgent({ ...form });
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadData();
};

const handleDelete = async (agent: any) => {
  await ElMessageBox.confirm(`确定删除智能体「${agent.name}」吗？`, '提示', { type: 'warning' });
  await deleteKnowledgeAgent(agent.id);
  ElMessage.success('已删除');
  await loadData();
};

onMounted(loadData);
</script>

<style scoped>
.agent-card { display: flex; gap: 14px; }
.agent-name { font-size: 16px; font-weight: 600; color: #303133; }
.agent-desc { font-size: 13px; color: #909399; margin: 4px 0 8px; min-height: 20px; }
.agent-meta { display: flex; gap: 6px; }
.agent-actions { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
</style>
