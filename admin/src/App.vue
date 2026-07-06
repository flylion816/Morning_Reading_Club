<script setup lang="ts">
import { RouterView } from 'vue-router';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();
const routeRefreshKey = ref(0);

const refreshCurrentRoute = () => {
  routeRefreshKey.value += 1;
};

// 在应用加载时初始化token（从localStorage恢复）
onMounted(() => {
  authStore.initToken();
  window.addEventListener('admin:tenant-changed', refreshCurrentRoute);
});

onBeforeUnmount(() => {
  window.removeEventListener('admin:tenant-changed', refreshCurrentRoute);
});
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" :key="`${route.fullPath}:${routeRefreshKey}`" />
  </RouterView>
</template>

<style scoped></style>
