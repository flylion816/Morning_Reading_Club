<template>
  <AdminLayout>
    <div class="periods-container">
      <el-card>
        <template #header>
          <div class="card-header">
            <span class="card-title">期次管理</span>
            <el-button type="primary" @click="showCreateDialog">
              新建期次
            </el-button>
          </div>
        </template>

        <el-empty description="功能开发中，敬请期待..." />
      </el-card>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import AdminLayout from '../components/AdminLayout.vue'

const showCreateDialog = () => {
  // TODO: Implement period creation
}
</script>

<style scoped>
.periods-container {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}
</style>
