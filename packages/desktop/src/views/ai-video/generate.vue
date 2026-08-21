<template>
  <div class="video-container">
    <!-- 左侧：创作表单 -->
    <div class="form-panel">
      <div class="panel-title">
        <el-icon><MagicStick /></el-icon>
        <span>智能成片 · AI 短视频创作</span>
        <el-tag size="small" type="success" effect="plain">Pixabay 素材</el-tag>
      </div>
      <div class="form-body">
        <el-form label-position="top" size="large">
          <el-form-item label="视频主题 / 关键词" required>
            <el-input
              v-model="form.videoSubject"
              placeholder="例如：AI 如何改变中小企业获客方式"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="视频脚本">
            <div class="script-row">
              <el-input
                v-model="form.videoScript"
                type="textarea"
                :rows="6"
                placeholder="可留空由 AI 生成，也可粘贴自己的文案"
              />
              <el-button
                type="primary"
                plain
                :loading="generatingScript"
                :disabled="!form.videoSubject.trim()"
                @click="handleGenerateScript"
              >
                AI 生成脚本
              </el-button>
            </div>
          </el-form-item>

          <!-- 脚本高级参数 -->
          <el-collapse class="adv-collapse">
            <el-collapse-item name="script-adv" title="脚本参数（段落数 / 提示词）">
              <el-form-item label="段落数（决定视频时长，建议 2-4 段）">
                <el-slider v-model="form.paragraphNumber" :min="1" :max="10" show-input />
              </el-form-item>
              <el-form-item label="脚本提示词（可选，指导 AI 怎么写）">
                <el-input
                  v-model="form.videoScriptPrompt"
                  type="textarea"
                  :rows="2"
                  placeholder="例如：口语化、有感染力、适合口播"
                />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>

          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="画面比例">
                <el-select v-model="form.videoAspect">
                  <el-option label="竖屏 9:16（抖音/视频号）" value="9:16" />
                  <el-option label="横屏 16:9（西瓜/B站）" value="16:9" />
                  <el-option label="方形 1:1（朋友圈）" value="1:1" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="生成数量">
                <el-input-number v-model="form.videoCount" :min="1" :max="5" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="素材来源">
                <el-select v-model="form.videoSource">
                  <el-option label="Pixabay（推荐）" value="pixabay" />
                  <el-option label="Pexels" value="pexels" />
                  <el-option label="Coverr" value="coverr" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="单段素材时长（秒）">
                <el-slider v-model="form.videoClipDuration" :min="1" :max="120" show-input />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="素材播放速度">
                <el-slider v-model="form.videoClipSpeed" :min="0.5" :max="2" :step="0.1" show-input />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="显示字幕">
                <el-switch v-model="form.subtitleEnabled" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="配音音色">
            <div class="voice-row">
              <el-select v-model="form.voiceName" filterable class="voice-select">
                <el-option
                  v-for="v in voiceOptions"
                  :key="v.value"
                  :label="v.label"
                  :value="v.value"
                />
              </el-select>
              <el-form-item label="音量" class="volume-item">
                <el-slider v-model="form.voiceVolume" :min="0.1" :max="2" :step="0.1" />
              </el-form-item>
            </div>
          </el-form-item>

          <el-form-item label="背景音乐">
            <div class="voice-row">
              <el-select v-model="form.bgmType" class="voice-select">
                <el-option label="随机 BGM" value="random" />
                <el-option label="无背景音乐" value="none" />
              </el-select>
              <el-form-item label="音量" class="volume-item">
                <el-slider v-model="form.bgmVolume" :min="0" :max="1" :step="0.05" />
              </el-form-item>
            </div>
          </el-form-item>

          <!-- 字幕细节 -->
          <el-collapse class="adv-collapse">
            <el-collapse-item name="subtitle-adv" title="字幕样式（位置 / 字体 / 字号 / 背景）">
              <el-form-item label="字幕位置">
                <el-select v-model="form.subtitlePosition">
                  <el-option label="底部" value="bottom" />
                  <el-option label="顶部" value="top" />
                  <el-option label="居中" value="center" />
                </el-select>
              </el-form-item>
              <el-form-item label="字体">
                <el-select v-model="form.fontName">
                  <el-option label="黑体-中" value="STHeitiMedium.ttc" />
                  <el-option label="黑体-细" value="STHeitiLight.ttc" />
                  <el-option label="微软雅黑-常规" value="MicrosoftYaHeiNormal.ttc" />
                  <el-option label="微软雅黑-粗体" value="MicrosoftYaHeiBold.ttc" />
                </el-select>
              </el-form-item>
              <el-form-item label="字号">
                <el-slider v-model="form.fontSize" :min="30" :max="120" show-input />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="字幕背景">
                    <el-switch v-model="form.subtitleBackgroundEnabled" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="圆角背景">
                    <el-switch v-model="form.roundedSubtitleBackground" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-collapse-item>
          </el-collapse>

          <!-- 水印 -->
          <el-collapse class="adv-collapse">
            <el-collapse-item name="watermark-adv" title="水印（品牌标识）">
              <el-form-item label="启用水印">
                <el-switch v-model="form.watermarkEnabled" />
              </el-form-item>
              <template v-if="form.watermarkEnabled">
                <el-form-item label="水印位置">
                  <el-select v-model="form.watermarkPosition">
                    <el-option label="右下角" value="bottom-right" />
                    <el-option label="左下角" value="bottom-left" />
                    <el-option label="右上角" value="top-right" />
                    <el-option label="左上角" value="top-left" />
                    <el-option label="居中" value="center" />
                  </el-select>
                </el-form-item>
                <el-form-item label="透明度">
                  <el-slider v-model="form.watermarkOpacity" :min="0" :max="1" :step="0.05" show-input />
                </el-form-item>
                <el-form-item label="大小（相对画面比例）">
                  <el-slider v-model="form.watermarkScale" :min="0.05" :max="0.5" :step="0.05" show-input />
                </el-form-item>
                <el-alert
                  type="info"
                  :closable="false"
                  show-icon
                  title="水印图片需放入 video-api 的 resource/watermarks/ 目录，文件名默认 watermark.png"
                />
              </template>
            </el-collapse-item>
          </el-collapse>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="create-btn"
              :loading="creating"
              :disabled="!form.videoSubject.trim()"
              @click="handleCreateTask"
            >
              <el-icon><MagicStick /></el-icon>
              生成视频
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 右侧：任务列表 -->
    <div class="tasks-panel">
      <div class="panel-title">
        <el-icon><Film /></el-icon>
        <span>生成任务</span>
        <el-button size="small" text :icon="Refresh" circle @click="loadTasks" :loading="loadingTasks" />
      </div>

      <div class="tasks-list">
        <div v-if="tasks.length === 0 && !loadingTasks" class="empty-state">
          <el-icon :size="56" color="#cbd5e1"><VideoCameraFilled /></el-icon>
          <p>还没有任务，填写主题开始创作</p>
        </div>

        <el-card v-for="task in tasks" :key="task.task_id" class="task-card" shadow="hover">
          <div class="task-header">
            <div class="task-subject">{{ task.params?.video_subject || '未命名主题' }}</div>
            <el-tag :type="stateTagType(task.state)" size="small">{{ stateText(task.state) }}</el-tag>
          </div>

          <el-progress
            v-if="task.state === 4"
            :percentage="task.progress || 0"
            :stroke-width="6"
            :show-text="false"
          />

          <div v-if="task.state === -1" class="task-error">{{ task.error || '生成失败' }}</div>

          <template v-if="task.state === 1 && taskVideos(task).length">
            <video
              v-for="(v, i) in taskVideos(task)"
              :key="i"
              :src="blobUrls[v] || ''"
              controls
              class="task-video"
            />
          </template>

          <div class="task-actions">
            <el-button
              v-if="task.state === 1 && taskVideos(task).length"
              size="small"
              type="primary"
              :loading="downloading === task.task_id"
              @click="handleDownload(task)"
            >
              下载视频
            </el-button>
            <el-button
              v-if="task.state === 1 && taskVideos(task).length"
              size="small"
              @click="addToWorks(task)"
            >
              存入作品库
            </el-button>
            <el-popconfirm title="删除该任务及产物？" @confirm="handleDelete(task.task_id)">
              <template #reference>
                <el-button size="small" type="danger" plain>删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import {
  generateVideoScript,
  createVideoTask,
  getVideoTasks,
  deleteVideoTask,
  fetchVideoFile,
} from '@/api';
import { aiVideoStore } from './store';

/** 中文音色（edge-tts 免费可用，与 MoneyPrinterTurbo 官方列表一致） */
const voiceOptions = [
  { label: '晓晓（女声·温柔）', value: 'zh-CN-XiaoxiaoNeural-Female' },
  { label: '晓伊（女声·活泼）', value: 'zh-CN-XiaoyiNeural-Female' },
  { label: '晓晓-多语言（女声）', value: 'zh-CN-XiaoxiaoMultilingualNeural-V2-Female' },
  { label: '云希（男声·阳光）', value: 'zh-CN-YunxiNeural-Male' },
  { label: '云健（男声·浑厚）', value: 'zh-CN-YunjianNeural-Male' },
  { label: '云扬（男声·播音）', value: 'zh-CN-YunyangNeural-Male' },
  { label: '云夏（男声·少年）', value: 'zh-CN-YunxiaNeural-Male' },
  { label: '晓北（辽宁·女声）', value: 'zh-CN-liaoning-XiaobeiNeural-Female' },
  { label: '晓妮（陕西·女声）', value: 'zh-CN-shaanxi-XiaoniNeural-Female' },
];

const form = reactive({
  videoSubject: '',
  videoScript: '',
  videoScriptPrompt: '',
  paragraphNumber: 3,
  videoAspect: '9:16',
  videoCount: 1,
  videoSource: 'pixabay',
  videoClipDuration: 6,
  videoClipSpeed: 1,
  voiceName: 'zh-CN-XiaoxiaoNeural-Female',
  voiceVolume: 1,
  bgmType: 'random',
  bgmVolume: 0.2,
  subtitleEnabled: true,
  subtitlePosition: 'bottom',
  fontName: 'STHeitiMedium.ttc',
  fontSize: 60,
  subtitleBackgroundEnabled: false,
  roundedSubtitleBackground: false,
  watermarkEnabled: false,
  watermarkPosition: 'bottom-right',
  watermarkOpacity: 0.5,
  watermarkScale: 0.15,
});

const generatingScript = ref(false);
const creating = ref(false);
const loadingTasks = ref(false);
const tasks = ref<any[]>([]);
const downloading = ref('');
const blobUrls = ref<Record<string, string>>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;

const stateText = (state: number) =>
  ({ 1: '已完成', 4: '生成中', [-1]: '失败' } as Record<number, string>)[state] || '排队中';
const stateTagType = (state: number) =>
  ({ 1: 'success', 4: 'primary', [-1]: 'danger' } as Record<number, any>)[state] || 'info';
const taskVideos = (task: any) => (Array.isArray(task.videos) ? task.videos : []);

/** 从文案大师带过来的草稿自动填充 */
watch(
  () => aiVideoStore.draftScript,
  (v) => {
    if (v) {
      form.videoScript = v;
      if (aiVideoStore.draftSubject) form.videoSubject = aiVideoStore.draftSubject;
      aiVideoStore.draftScript = '';
      aiVideoStore.draftSubject = '';
      ElMessage.success('已带入文案大师生成的文案，可微调后直接生成');
    }
  },
);

/** 加载任务列表，自动为已完成任务拉取视频 blob */
async function loadTasks() {
  loadingTasks.value = true;
  try {
    const res: any = await getVideoTasks({ page: 1, pageSize: 20 });
    tasks.value = res?.tasks || [];
    for (const task of tasks.value) {
      if (task.state === 1) {
        for (const v of taskVideos(task)) {
          if (v && !blobUrls.value[v]) await loadBlob(v);
        }
      }
    }
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    loadingTasks.value = false;
  }
}

async function loadBlob(url: string) {
  try {
    const blob: any = await fetchVideoFile(url);
    blobUrls.value[url] = URL.createObjectURL(blob);
  } catch {
    /* 单个视频加载失败不阻塞列表 */
  }
}

async function handleGenerateScript() {
  generatingScript.value = true;
  try {
    const res: any = await generateVideoScript({
      videoSubject: form.videoSubject,
      videoLanguage: '',
      paragraphNumber: form.paragraphNumber,
      videoScriptPrompt: form.videoScriptPrompt,
    });
    if (res?.video_script) {
      form.videoScript = res.video_script;
      ElMessage.success('脚本已生成');
    }
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    generatingScript.value = false;
  }
}

async function handleCreateTask() {
  creating.value = true;
  try {
    await createVideoTask({
      video_subject: form.videoSubject,
      video_script: form.videoScript,
      paragraph_number: form.paragraphNumber,
      video_script_prompt: form.videoScriptPrompt,
      video_aspect: form.videoAspect,
      video_count: form.videoCount,
      video_source: form.videoSource,
      video_clip_duration: form.videoClipDuration,
      video_clip_speed: form.videoClipSpeed,
      voice_name: form.voiceName,
      voice_volume: form.voiceVolume,
      bgm_type: form.bgmType,
      bgm_volume: form.bgmVolume,
      subtitle_enabled: form.subtitleEnabled,
      subtitle_position: form.subtitlePosition,
      font_name: form.fontName,
      font_size: form.fontSize,
      subtitle_background_enabled: form.subtitleBackgroundEnabled,
      rounded_subtitle_background: form.roundedSubtitleBackground,
      watermark_enabled: form.watermarkEnabled,
      watermark_position: form.watermarkPosition,
      watermark_opacity: form.watermarkOpacity,
      watermark_scale: form.watermarkScale,
    });
    ElMessage.success('任务已创建，正在生成中');
    await loadTasks();
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    creating.value = false;
  }
}

async function handleDownload(task: any) {
  const url = taskVideos(task)[0];
  if (!url) return;
  downloading.value = task.task_id;
  try {
    const blob: any = await fetchVideoFile(url);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${task.params?.video_subject || 'video'}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    /* 错误已在拦截器中提示 */
  } finally {
    downloading.value = '';
  }
}

async function handleDelete(taskId: string) {
  try {
    await deleteVideoTask(taskId);
    ElMessage.success('已删除');
    await loadTasks();
  } catch {
    /* 错误已在拦截器中提示 */
  }
}

/** 存入作品库：跳转到作品库并提示（作品库从任务列表自动汇总，无需额外动作） */
function addToWorks(_task: any) {
  aiVideoStore.activeView = 'works';
}

/** 存在进行中的任务时每 5 秒轮询 */
function startPolling() {
  pollTimer = setInterval(async () => {
    if (tasks.value.some((t) => t.state === 4)) await loadTasks();
  }, 5000);
}

onMounted(() => {
  loadTasks();
  startPolling();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  Object.values(blobUrls.value).forEach((u) => URL.revokeObjectURL(u));
});
</script>

<style scoped>
.video-container {
  display: flex;
  gap: 16px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.form-panel {
  width: 460px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}

.panel-title span {
  flex: 1;
}

.form-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.script-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: flex-start;
}

.script-row .el-button {
  margin-top: 2px;
}

.create-btn {
  width: 100%;
}

.adv-collapse {
  margin-bottom: 18px;
  border: none;
  --el-collapse-header-height: 36px;
  --el-collapse-content-padding-bottom: 4px;
}

.adv-collapse :deep(.el-collapse-item__header) {
  font-size: 13px;
  color: #475569;
  border-bottom: 1px dashed #e2e8f0;
}

.adv-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.voice-row {
  display: flex;
  gap: 16px;
  width: 100%;
  align-items: flex-start;
}

.voice-select {
  flex: 1;
  min-width: 0;
}

.volume-item {
  flex: 0 0 160px;
  margin-bottom: 0;
}

.tasks-panel {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
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
  gap: 12px;
  color: #94a3b8;
}

.task-card :deep(.el-card__body) {
  padding: 14px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-subject {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.task-error {
  color: #f56c6c;
  font-size: 13px;
  margin-top: 6px;
}

.task-video {
  width: 100%;
  max-height: 320px;
  border-radius: 6px;
  margin-top: 10px;
  background: #000;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
