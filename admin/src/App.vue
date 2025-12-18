<script setup lang="ts">
import { RouterView } from 'vue-router';
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();

// 在应用加载时初始化token（从localStorage恢复）
onMounted(() => {
  authStore.initToken();
});
</script>

<template>
  <RouterView />
</template>

<style scoped></style>
