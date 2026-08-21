<template>
  <div class="page-container">
    <el-alert
      v-if="unconfiguredCount > 0"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    >
      <template #title>
        有 {{ unconfiguredCount }} 个平台尚未配置 API Key，部分功能不可用。
        申请到密钥后，点击对应平台的「配置」按钮填入即可。
      </template>
    </el-alert>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="AI 模型服务" name="ai">
        <div class="platform-grid">
          <el-card v-for="p in aiPlatforms" :key="p.platform" class="platform-card" shadow="hover">
            <div class="platform-header">
              <div class="platform-name">{{ p.name }}</div>
              <el-tag :type="p.configured ? (p.status === 2 ? 'success' : 'primary') : 'info'" size="small">
                {{ p.configured ? (p.status === 2 ? '已验证' : '已配置') : '未配置' }}
              </el-tag>
            </div>
            <p class="platform-desc">{{ p.description }}</p>
            <div v-if="p.configured" class="platform-keys">
              <div class="key-row">
                <span class="key-label">Key:</span>
                <span class="key-value">{{ p.maskedKey || '—' }}</span>
              </div>
            </div>
            <div class="platform-actions">
              <el-button size="small" @click="openConfig(p)">配置</el-button>
              <el-button v-if="p.configured" size="small" type="success" plain @click="handleVerify(p)">
                验证
              </el-button>
              <a v-if="p.applyUrl" :href="p.applyUrl" target="_blank" class="apply-link">
                <el-button size="small" link type="primary">申请地址</el-button>
              </a>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="社交平台" name="platform">
        <div class="platform-grid">
          <el-card v-for="p in socialPlatforms" :key="p.platform" class="platform-card" shadow="hover">
            <div class="platform-header">
              <div class="platform-name">{{ p.name }}</div>
              <el-tag :type="p.configured ? (p.status === 2 ? 'success' : 'primary') : 'info'" size="small">
                {{ p.configured ? (p.status === 2 ? '已验证' : '已配置') : '未配置' }}
              </el-tag>
            </div>
            <p class="platform-desc">{{ p.description }}</p>
            <div v-if="p.configured" class="platform-keys">
              <div class="key-row">
                <span class="key-label">Key:</span>
                <span class="key-value">{{ p.maskedKey || '—' }}</span>
              </div>
            </div>
            <div class="platform-actions">
              <el-button size="small" @click="openConfig(p)">配置</el-button>
              <el-button v-if="p.configured" size="small" type="success" plain @click="handleVerify(p)">
                验证
              </el-button>
              <a v-if="p.applyUrl" :href="p.applyUrl" target="_blank" class="apply-link">
                <el-button size="small" link type="primary">申请地址</el-button>
              </a>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 配置弹窗 -->
    <el-dialog v-model="dialogVisible" :title="`配置 - ${currentPlatform?.name || ''}`" width="560px">
      <el-form label-width="130px">
        <el-form-item
          v-for="field in currentPlatform?.fields || []"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <el-input
            v-model="configForm[field.key]"
            :placeholder="field.placeholder || '请输入'"
            :type="field.key === 'apiKey' || field.key === 'apiSecret' ? 'password' : 'text'"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { getPlatformConfigs, savePlatformConfig, verifyPlatformConfig } from '@/api';

const activeTab = ref('ai');
const platforms = ref<any[]>([]);
const dialogVisible = ref(false);
const currentPlatform = ref<any>(null);
const configForm = reactive<Record<string, string>>({});
const saving = ref(false);

const aiPlatforms = computed(() => platforms.value.filter((p) => p.category === 'ai'));
const socialPlatforms = computed(() => platforms.value.filter((p) => p.category === 'platform'));
const unconfiguredCount = computed(() => platforms.value.filter((p) => !p.configured).length);

const loadPlatforms = async () => {
  platforms.value = (await getPlatformConfigs()) as any[];
};

onMounted(loadPlatforms);

const openConfig = (p: any) => {
  currentPlatform.value = p;
  Object.keys(configForm).forEach((k) => delete configForm[k]);
  (p.fields || []).forEach((f: any) => {
    configForm[f.key] = '';
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  saving.value = true;
  try {
    await savePlatformConfig(currentPlatform.value.platform, configForm);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await loadPlatforms();
  } finally {
    saving.value = false;
  }
};

const handleVerify = async (p: any) => {
  const res: any = await verifyPlatformConfig(p.platform);
  if (res.verified) {
    ElMessage.success('验证成功，配置可用');
  } else {
    ElMessage.error(res.message || '验证失败');
  }
  await loadPlatforms();
};
</script>

<style scoped>
.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.platform-card {
  border-radius: 8px;
}

.platform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.platform-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.platform-desc {
  color: #909399;
  font-size: 13px;
  min-height: 36px;
  margin-bottom: 12px;
}

.platform-keys {
  margin-bottom: 12px;
}

.key-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}

.key-label {
  flex-shrink: 0;
}

.key-value {
  font-family: monospace;
  word-break: break-all;
}

.platform-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.apply-link {
  text-decoration: none;
}
</style>
