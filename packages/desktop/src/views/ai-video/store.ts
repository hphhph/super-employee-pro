import { reactive } from 'vue';

/**
 * AI 视频工作台共享状态
 * 用于子页面间联动（如：文案大师生成文案 → 一键带入智能成片）
 */
export const aiVideoStore = reactive({
  activeView: 'generate', // generate | digital-human | copywriting | competitor | viral | acquisition | mixcut | works | publish
  draftSubject: '',
  draftScript: '',
});

/** 文案带去生成视频 */
export function sendToGenerate(subject: string, script: string) {
  aiVideoStore.draftSubject = subject;
  aiVideoStore.draftScript = script;
  aiVideoStore.activeView = 'generate';
}
