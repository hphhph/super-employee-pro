import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user';

/**
 * 路由结构还原自原系统 menu_tree.json
 * 22个一级菜单、60+页面
 * roles: 'admin' 表示仅管理员可见
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      // ===== 工作台 =====
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '数据总览', icon: 'Odometer' },
      },
      // ===== AI 对话 =====
      {
        path: 'ai-chat',
        name: 'AiChat',
        component: () => import('@/views/ai-chat/index.vue'),
        meta: { title: 'AI对话', icon: 'ChatDotRound' },
      },
      // ===== AI 视频创作（MoneyPrinterTurbo）=====
      {
        path: 'ai-video',
        name: 'AiVideo',
        component: () => import('@/views/ai-video/index.vue'),
        meta: { title: 'AI视频', icon: 'VideoCamera' },
      },
      // ===== AI企微 =====
      {
        path: 'wecom',
        name: 'Wecom',
        redirect: '/wecom/fans',
        meta: { title: 'AI企微', icon: 'User' },
        children: [
          { path: 'sessions', name: 'WecomSessions', component: () => import('@/views/wecom/sessions.vue'), meta: { title: '聚合聊天' } },
          { path: 'fans', name: 'WecomFans', component: () => import('@/views/wecom/fans.vue'), meta: { title: '好友列表' } },
          { path: 'labels', name: 'WecomLabels', component: () => import('@/views/wecom/labels.vue'), meta: { title: '标签管理' } },
          { path: 'keywords', name: 'WecomKeywords', component: () => import('@/views/wecom/keywords.vue'), meta: { title: '关键词回复' } },
          { path: 'bulk-tasks', name: 'WecomBulkTasks', component: () => import('@/views/wecom/bulk-tasks.vue'), meta: { title: '精准群发' } },
        ],
      },
      // ===== 企业智库 =====
      {
        path: 'knowledge',
        name: 'Knowledge',
        redirect: '/knowledge/agents',
        meta: { title: '企业智库', icon: 'Collection' },
        children: [
          { path: 'agents', name: 'KnowledgeAgents', component: () => import('@/views/knowledge/agents.vue'), meta: { title: '智能体' } },
          { path: 'bases', name: 'KnowledgeBases', component: () => import('@/views/knowledge/bases.vue'), meta: { title: '智能体知识库' } },
        ],
      },
      // ===== 数据罗盘 =====
      {
        path: 'compute',
        name: 'Compute',
        component: () => import('@/views/system/compute.vue'),
        meta: { title: '算力消耗', icon: 'DataLine' },
      },
      // ===== 系统设置 =====
      {
        path: 'system',
        name: 'System',
        redirect: '/system/api-config',
        meta: { title: '系统设置', icon: 'Setting', roles: ['admin'] },
        children: [
          { path: 'api-config', name: 'ApiConfig', component: () => import('@/views/system/api-config.vue'), meta: { title: 'API密钥配置', roles: ['admin'] } },
          { path: 'users', name: 'Users', component: () => import('@/views/system/users.vue'), meta: { title: '员工管理', roles: ['admin'] } },
          { path: 'departments', name: 'Departments', component: () => import('@/views/system/departments.vue'), meta: { title: '部门管理', roles: ['admin'] } },
        ],
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  document.title = to.meta.title ? `${to.meta.title} - AI超级员工` : 'AI超级员工';

  if (to.path === '/login') {
    next();
    return;
  }

  if (!userStore.token) {
    next('/login');
    return;
  }

  // 角色权限检查
  const requiredRoles = to.meta.roles as string[] | undefined;
  if (requiredRoles && requiredRoles.length > 0) {
    if (userStore.role !== 'admin' && !requiredRoles.includes(userStore.role)) {
      next('/dashboard');
      return;
    }
  }

  next();
});

export default router;
