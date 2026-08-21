<template>
  <div class="page-container">
    <el-card shadow="never">
      <template #header><span>聚合聊天</span></template>
      <el-empty description="企微聚合聊天（需要先在系统设置中配置企业微信 API 并接入设备）">
        <el-button type="primary" @click="$router.push('/system/api-config')">去配置企业微信</el-button>
      </el-empty>
    </el-card>
  </div>
</template>

<script setup lang="ts">
</script>
