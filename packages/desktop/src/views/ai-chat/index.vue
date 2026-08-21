<template>
  <div class="chat-container">
    <!-- 会话列表 -->
    <div class="sessions-panel">
      <div class="sessions-header">
        <span>对话列表</span>
        <el-button type="primary" size="small" :icon="Plus" circle @click="handleNewSession" />
      </div>
      <div class="sessions-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === currentSessionId }"
          @click="selectSession(s.id)"
        >
          <div class="session-title">{{ s.title }}</div>
          <div class="session-meta">{{ s._count?.messages || 0 }} 条消息</div>
          <el-icon class="session-delete" @click.stop="handleDelete(s.id)"><Delete /></el-icon>
        </div>
      </div>
    </div>

    <!-- 聊天区 -->
    <div class="chat-panel">
      <div class="messages-container" ref="messagesRef">
        <div v-if="!currentSessionId" class="empty-state">
          <el-icon :size="64" color="#c0c4cc"><ChatDotRound /></el-icon>
          <p>创建一个新对话开始使用</p>
          <el-button type="primary" @click="handleNewSession">新建对话</el-button>
        </div>
        <template v-else>
          <div v-for="msg in messages" :key="msg.id" class="message-row" :class="msg.role">
            <div class="message-avatar">
              <el-avatar v-if="msg.role === 'user'" :size="36">{{ userStore.userInfo?.nickname?.[0] || '我' }}</el-avatar>
              <el-avatar v-else :size="36" style="background-color: #409eff">AI</el-avatar>
            </div>
            <div class="message-bubble">
              <div class="message-content">{{ msg.content }}</div>
            </div>
          </div>
          <div v-if="sending" class="message-row assistant">
            <div class="message-avatar"><el-avatar :size="36" style="background-color: #409eff">AI</el-avatar></div>
            <div class="message-bubble typing">AI 正在思考...</div>
          </div>
        </template>
      </div>

      <!-- 输入区 -->
      <div class="input-area" v-if="currentSessionId">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          @keydown.enter.exact.prevent="handleSend"
          :disabled="sending"
        />
        <div class="input-actions">
          <span class="quota-info">剩余算力: {{ quota.remaining ?? '-' }}</span>
          <el-button type="primary" :loading="sending" @click="handleSend">发送</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  getChatSessions, createChatSession, getChatMessages,
  sendChatMessage, deleteChatSession,
} from '@/api';
import { getComputeQuota } from '@/api';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const sessions = ref<any[]>([]);
const messages = ref<any[]>([]);
const currentSessionId = ref<number | null>(null);
const inputText = ref('');
const sending = ref(false);
const quota = ref<any>({});
const messagesRef = ref<HTMLElement>();

const loadSessions = async () => {
  sessions.value = ((await getChatSessions()) as any[]) || [];
};

const loadQuota = async () => {
  quota.value = (await getComputeQuota()) || {};
};

const selectSession = async (id: number) => {
  currentSessionId.value = id;
  messages.value = ((await getChatMessages(id)) as any[]) || [];
  scrollToBottom();
};

const handleNewSession = async () => {
  const s: any = await createChatSession();
  await loadSessions();
  await selectSession(s.id);
};

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该对话吗？', '提示', { type: 'warning' });
  await deleteChatSession(id);
  if (currentSessionId.value === id) {
    currentSessionId.value = null;
    messages.value = [];
  }
  await loadSessions();
};

const handleSend = async () => {
  const content = inputText.value.trim();
  if (!content || !currentSessionId.value) return;
  sending.value = true;
  inputText.value = '';

  // 先显示用户消息
  messages.value.push({ id: Date.now(), role: 'user', content });
  scrollToBottom();

  try {
    const reply: any = await sendChatMessage(currentSessionId.value, content);
    messages.value.push(reply);
    await loadSessions();
    await loadQuota();
  } catch (e) {
    messages.value.push({ id: Date.now() + 1, role: 'user', content });
  } finally {
    sending.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' });
  });
};

onMounted(async () => {
  await loadSessions();
  await loadQuota();
});
</script>

<style scoped>
.chat-container {
  display: flex;
  height: calc(100vh - 140px);
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.sessions-panel {
  width: 260px;
  border-right: 1px solid #e6e8eb;
  display: flex;
  flex-direction: column;
}

.sessions-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  border-bottom: 1px solid #e6e8eb;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  margin-bottom: 4px;
}

.session-item:hover { background: #f5f7fa; }
.session-item.active { background: #ecf5ff; }

.session-title {
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 24px;
}

.session-meta {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.session-delete {
  position: absolute;
  right: 12px;
  top: 14px;
  color: #c0c4cc;
  display: none;
}
.session-item:hover .session-delete { display: block; }

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #909399;
}

.message-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.message-row.user { flex-direction: row-reverse; }

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  background: #f5f7fa;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.message-row.user .message-bubble {
  background: #409eff;
  color: #fff;
}

.typing {
  color: #909399;
  font-style: italic;
}

.input-area {
  padding: 16px;
  border-top: 1px solid #e6e8eb;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.quota-info {
  font-size: 12px;
  color: #909399;
}
</style>
