<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="table-toolbar">
        <el-input v-model="keyword" placeholder="搜索用户名/昵称/手机号" style="width: 260px" clearable @keyup.enter="loadData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :icon="Plus" @click="openDialog()">新增员工</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="员工" width="220">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 10px">
              <el-avatar :size="34" :src="row.avatar">{{ row.nickname?.[0] || row.username[0] }}</el-avatar>
              <div>
                <div>{{ row.nickname || row.username }}</div>
                <div style="font-size: 12px; color: #909399">{{ row.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="department?.name" label="部门" width="140" />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'manager' ? 'warning' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : row.role === 'manager' ? '经理' : '员工' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.status" :active-value="1" :inactive-value="0" @change="handleToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ row.lastLoginAt ? formatTime(row.lastLoginAt) : '从未' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)" :disabled="row.role === 'admin'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑员工' : '新增员工'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="!!editing" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="密码" :required="!editing">
          <el-input v-model="form.password" type="password" show-password :placeholder="editing ? '留空则不修改' : '登录密码'" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="部门">
          <el-tree-select
            v-model="form.departmentId"
            :data="deptTree"
            :props="{ label: 'name', value: 'id' }"
            check-strictly
            clearable
            placeholder="选择部门"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="员工" value="user" />
            <el-option label="经理" value="manager" />
            <el-option label="管理员" value="admin" />
          </el-select>
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
import { getUsers, createUser, updateUser, deleteUser, getDepartmentTree } from '@/api';
import dayjs from 'dayjs';

const list = ref<any[]>([]);
const deptTree = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(1);
const total = ref(0);
const dialogVisible = ref(false);
const editing = ref<any>(null);
const form = reactive<any>({
  username: '', nickname: '', password: '', phone: '', departmentId: null, role: 'user',
});

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await getUsers({ page: page.value, pageSize: 20, keyword: keyword.value });
    list.value = res.list || [];
    total.value = res.total || 0;
  } finally {
    loading.value = false;
  }
};

const loadDepts = async () => {
  deptTree.value = ((await getDepartmentTree()) as any[]) || [];
};

const openDialog = (row?: any) => {
  editing.value = row || null;
  Object.assign(form, {
    username: row?.username || '',
    nickname: row?.nickname || '',
    password: '',
    phone: row?.phone || '',
    departmentId: row?.departmentId || null,
    role: row?.role || 'user',
  });
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!form.username) return ElMessage.warning('请输入用户名');
  if (!editing.value && !form.password) return ElMessage.warning('请输入密码');
  const data = { ...form };
  if (!data.password) delete data.password;

  if (editing.value) {
    await updateUser(editing.value.id, data);
  } else {
    await createUser(data);
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  await loadData();
};

const handleToggle = async (row: any) => {
  await updateUser(row.id, { status: row.status });
};

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除员工「${row.nickname || row.username}」吗？`, '提示', { type: 'warning' });
  await deleteUser(row.id);
  ElMessage.success('已删除');
  await loadData();
};

const formatTime = (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm');

onMounted(() => { loadData(); loadDepts(); });
</script>
