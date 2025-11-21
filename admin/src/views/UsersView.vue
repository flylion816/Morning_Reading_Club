<template>
  <AdminLayout>
    <div class="users-container">
      <el-card>
        <template #header>
          <span class="card-title">用户管理</span>
        </template>

        <el-empty description="功能开发中，敬请期待..." />
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import AdminLayout from '../components/AdminLayout.vue'
</script>

<style scoped>
.users-container {
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}
</style>
