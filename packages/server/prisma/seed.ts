/**
 * 数据库种子数据
 * 初始化管理员账号、默认部门、API Key 配置占位
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据...');

  // 1. 创建默认部门
  const rootDept = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '总公司', parentId: 0, sort: 0 },
  });

  const techDept = await prisma.department.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: '技术部', parentId: 1, sort: 1 },
  });

  const salesDept = await prisma.department.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: '销售部', parentId: 1, sort: 2 },
  });

  console.log('✓ 部门创建完成');

  // 2. 创建管理员账号
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      nickname: '超级管理员',
      role: 'admin',
      departmentId: 1,
    },
  });

  // 普通演示账号
  const userPassword = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      password: userPassword,
      nickname: '演示用户',
      role: 'user',
      departmentId: 2,
    },
  });

  console.log('✓ 用户创建完成 (admin/admin123, demo/123456)');

  // 3. 初始化算力配额
  for (const userId of [admin.id]) {
    await prisma.computeQuota.upsert({
      where: { userId },
      update: {},
      create: { userId, total: 100000 },
    });
  }
  console.log('✓ 算力配额初始化完成');

  // 4. API Key 配置占位（14个平台）
  const platforms = [
    { platform: 'deepseek', name: 'DeepSeek' },
    { platform: 'coze', name: 'Coze 扣子' },
    { platform: 'openai', name: 'OpenAI Sora2' },
    { platform: 'google_veo', name: 'Google Veo' },
    { platform: 'seedance', name: '字节 Seedance' },
    { platform: 'aliyun_tts', name: '阿里云 TTS' },
    { platform: 'dashscope', name: '通义千问' },
    { platform: 'wecom', name: '企业微信' },
    { platform: 'douyin', name: '抖音开放平台' },
    { platform: 'xiaohongshu', name: '小红书开放平台' },
    { platform: 'kuaishou', name: '快手开放平台' },
    { platform: 'wechat_channels', name: '视频号' },
    { platform: 'boss', name: 'Boss直聘' },
    { platform: 'zhilian', name: '智联招聘' },
  ];

  for (const p of platforms) {
    await prisma.apiKeyConfig.upsert({
      where: { platform: p.platform },
      update: {},
      create: { platform: p.platform, name: p.name, apiKey: '', status: 0 },
    });
  }
  console.log('✓ API Key 配置占位创建完成 (14个平台)');

  // 5. 默认智能体
  await prisma.aiAgent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: '通用AI助手',
      description: '默认的AI对话助手，可以回答各类问题',
      model: 'deepseek-chat',
      systemPrompt: '你是AI超级员工，一个专业的企业AI助手。你的职责是帮助企业员工高效完成工作，包括但不限于文案创作、客户沟通、数据分析、问题解答。请用简洁、专业、友好的语气回答。',
      temperature: 0.7,
    },
  });

  await prisma.aiAgent.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: '销售话术专家',
      description: '专注于销售场景的AI话术生成',
      model: 'deepseek-chat',
      systemPrompt: '你是一位资深的销售专家，擅长各种销售场景的话术撰写，包括开场白、产品介绍、异议处理、促单成交等。你生成的话术要自然、有说服力、符合微信聊天场景。',
      temperature: 0.8,
    },
  });
  console.log('✓ 默认智能体创建完成');

  // 6. 默认关键词回复
  await prisma.wecomKeyword.createMany({
    data: [
      { keyword: '你好', replyType: 'text', replyContent: '你好！很高兴为您服务，请问有什么可以帮您？', matchType: 'exact', priority: 10 },
      { keyword: '价格', replyType: 'text', replyContent: '感谢您的咨询！关于产品价格，我稍后为您详细介绍，请问您方便留个联系方式吗？', matchType: 'contains', priority: 8 },
      { keyword: '怎么买', replyType: 'text', replyContent: '您可以直接点击下方链接下单，或者添加我们的客服微信一对一服务~', matchType: 'contains', priority: 8 },
    ],
  });
  console.log('✓ 默认关键词回复创建完成');

  // 7. 默认标签
  await prisma.wecomLabel.createMany({
    data: [
      { name: '意向客户', color: '#F56C6C' },
      { name: '已成交', color: '#67C23A' },
      { name: '待跟进', color: '#E6A23C' },
      { name: '高净值', color: '#409EFF' },
    ],
  });
  console.log('✓ 默认标签创建完成');

  console.log('\n====================================');
  console.log('种子数据初始化完成！');
  console.log('管理员账号: admin / admin123');
  console.log('演示账号: demo / 123456');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
