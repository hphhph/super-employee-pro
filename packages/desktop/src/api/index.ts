import request from './request';

// ===== 认证 =====
export const login = (data: { username: string; password: string }) =>
  request.post('/auth/login', data);

export const getProfile = () => request.get('/auth/profile');

export const changePassword = (data: { oldPassword: string; newPassword: string }) =>
  request.post('/auth/change-password', data);

// ===== 工作台 =====
export const getDashboardOverview = () => request.get('/dashboard/overview');
export const getDashboardTrend = () => request.get('/dashboard/trend');

// ===== API 配置中心 =====
export const getPlatformConfigs = () => request.get('/config/platforms');
export const getConfigCategories = () => request.get('/config/categories');
export const savePlatformConfig = (platform: string, data: any) =>
  request.put(`/config/platforms/${platform}`, data);
export const verifyPlatformConfig = (platform: string) =>
  request.post(`/config/platforms/${platform}/verify`);

// ===== AI 对话 =====
export const getChatSessions = () => request.get('/ai-chat/sessions');
export const createChatSession = (data?: any) => request.post('/ai-chat/sessions', data || {});
export const getChatMessages = (sessionId: number) =>
  request.get(`/ai-chat/sessions/${sessionId}/messages`);
export const sendChatMessage = (sessionId: number, content: string) =>
  request.post(`/ai-chat/sessions/${sessionId}/messages`, { content });
export const deleteChatSession = (sessionId: number) =>
  request.delete(`/ai-chat/sessions/${sessionId}`);

// ===== 企微 =====
export const getWecomStats = () => request.get('/wecom/stats');
export const getWecomFans = (params?: any) => request.get('/wecom/fans', { params });
export const getWecomLabels = () => request.get('/wecom/labels');
export const createWecomLabel = (data: any) => request.post('/wecom/labels', data);
export const updateWecomLabel = (id: number, data: any) => request.put(`/wecom/labels/${id}`, data);
export const deleteWecomLabel = (id: number) => request.delete(`/wecom/labels/${id}`);
export const getWecomKeywords = (params?: any) => request.get('/wecom/keywords', { params });
export const createWecomKeyword = (data: any) => request.post('/wecom/keywords', data);
export const updateWecomKeyword = (id: number, data: any) => request.put(`/wecom/keywords/${id}`, data);
export const deleteWecomKeyword = (id: number) => request.delete(`/wecom/keywords/${id}`);
export const getWecomSessions = (params?: any) => request.get('/wecom/sessions', { params });
export const getWecomMessages = (sessionId: number, params?: any) =>
  request.get(`/wecom/sessions/${sessionId}/messages`, { params });
export const getWecomBulkTasks = (params?: any) => request.get('/wecom/bulk-tasks', { params });
export const createWecomBulkTask = (data: any) => request.post('/wecom/bulk-tasks', data);

// ===== 知识库 =====
export const getKnowledgeBases = (params?: any) => request.get('/knowledge/bases', { params });
export const createKnowledgeBase = (data: any) => request.post('/knowledge/bases', data);
export const deleteKnowledgeBase = (id: number) => request.delete(`/knowledge/bases/${id}`);
export const getKnowledgeAgents = (params?: any) => request.get('/knowledge/agents', { params });
export const createKnowledgeAgent = (data: any) => request.post('/knowledge/agents', data);
export const updateKnowledgeAgent = (id: number, data: any) => request.put(`/knowledge/agents/${id}`, data);
export const deleteKnowledgeAgent = (id: number) => request.delete(`/knowledge/agents/${id}`);

// ===== 用户/部门 =====
export const getUsers = (params?: any) => request.get('/users', { params });
export const createUser = (data: any) => request.post('/users', data);
export const updateUser = (id: number, data: any) => request.put(`/users/${id}`, data);
export const deleteUser = (id: number) => request.delete(`/users/${id}`);
export const getDepartmentTree = () => request.get('/departments/tree');
export const createDepartment = (data: any) => request.post('/departments', data);
export const updateDepartment = (id: number, data: any) => request.put(`/departments/${id}`, data);
export const deleteDepartment = (id: number) => request.delete(`/departments/${id}`);

// ===== 算力 =====
export const getComputeQuota = () => request.get('/compute/quota');
export const getComputeLogs = (params?: any) => request.get('/compute/logs', { params });

// ===== AI 视频（MoneyPrinterTurbo）=====
export const generateVideoScript = (data: {
  videoSubject: string;
  videoLanguage?: string;
  paragraphNumber?: number;
  videoScriptPrompt?: string;
}) => request.post('/video/scripts', data);

export const generateVideoTerms = (data: {
  videoSubject: string;
  videoScript: string;
  amount?: number;
  matchMaterialsToScript?: boolean;
}) => request.post('/video/terms', data);

export const createVideoTask = (params: any) => request.post('/video/tasks', params);

export const getVideoTasks = (params?: { page?: number; pageSize?: number }) =>
  request.get('/video/tasks', { params });

export const getVideoTask = (taskId: string) => request.get(`/video/tasks/${taskId}`);

export const deleteVideoTask = (taskId: string) => request.delete(`/video/tasks/${taskId}`);

export const getVideoMusics = () => request.get('/video/musics');

/** 拉取生成的视频文件（blob），url 形如 /video/download/{taskId}/{file} */
export const fetchVideoFile = (url: string) =>
  request.get(url, { responseType: 'blob', timeout: 300000 });

// ===== 文案大师 =====
export const getCopywritingTemplates = () => request.get('/copywriting/templates');
export const generateCopywriting = (data: any) => request.post('/copywriting/generate', data);
export const getCopywritingRecords = (params?: any) =>
  request.get('/copywriting/records', { params });
export const deleteCopywritingRecord = (id: number) =>
  request.delete(`/copywriting/records/${id}`);

// ===== 同行监控 =====
export const getCompetitorPlatforms = () => request.get('/competitor/platforms');
export const getCompetitorStats = () => request.get('/competitor/stats');
export const getCompetitorAccounts = () => request.get('/competitor/accounts');
export const createCompetitorAccount = (data: any) => request.post('/competitor/accounts', data);
export const updateCompetitorAccount = (id: number, data: any) =>
  request.put(`/competitor/accounts/${id}`, data);
export const deleteCompetitorAccount = (id: number) =>
  request.delete(`/competitor/accounts/${id}`);
export const getCompetitorWorks = (params?: any) => request.get('/competitor/works', { params });
export const createCompetitorWork = (data: any) => request.post('/competitor/works', data);
export const updateCompetitorWork = (id: number, data: any) =>
  request.put(`/competitor/works/${id}`, data);
export const deleteCompetitorWork = (id: number) =>
  request.delete(`/competitor/works/${id}`);

// ===== 数字人口播 =====
export const uploadDigitalHumanAvatar = (file: File, name?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  if (name) fd.append('name', name);
  return request.post('/digital-human/avatars', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
};
export const getDigitalHumanAvatars = () => request.get('/digital-human/avatars');
export const deleteDigitalHumanAvatar = (id: number) =>
  request.delete(`/digital-human/avatars/${id}`);
export const createDigitalHumanTask = (data: any) => request.post('/digital-human/tasks', data);
export const getDigitalHumanTasks = () => request.get('/digital-human/tasks');
export const getDigitalHumanTask = (id: number) => request.get(`/digital-human/tasks/${id}`);
export const deleteDigitalHumanTask = (id: number) =>
  request.delete(`/digital-human/tasks/${id}`);
/** 拉取数字人形象/成片（blob），url 形如 /digital-human/files/{type}/{name} */
export const fetchDigitalHumanFile = (url: string) =>
  request.get(url, { responseType: 'blob', timeout: 300000 });

// ===== 多平台发布 =====
export const getPublishPlatforms = () => request.get('/publish/platforms');
export const getPublishStats = () => request.get('/publish/stats');
export const getPublishAccounts = () => request.get('/publish/accounts');
export const createPublishAccount = (data: any) => request.post('/publish/accounts', data);
export const updatePublishAccount = (id: number, data: any) =>
  request.put(`/publish/accounts/${id}`, data);
export const deletePublishAccount = (id: number) =>
  request.delete(`/publish/accounts/${id}`);
export const getPublishTasks = (params?: any) => request.get('/publish/tasks', { params });
export const createPublishTask = (data: any) => request.post('/publish/tasks', data);
export const cancelPublishTask = (id: number) => request.post(`/publish/tasks/${id}/cancel`);
export const deletePublishTask = (id: number) => request.delete(`/publish/tasks/${id}`);

// ===== 第三方服务整合 =====
export const getIntegrationServices = () => request.get('/integrations');
export const getIntegrationStatus = () => request.get('/integrations/status');
