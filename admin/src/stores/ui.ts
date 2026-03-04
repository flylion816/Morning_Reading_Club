/**
 * UI Store - 管理管理后台的 UI 状态
 * 包括侧边栏、模态框、主题等状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUIStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false);
  const notificationCount = ref(0);
  const theme = ref<'light' | 'dark'>('light');
  const modalStack = ref<string[]>([]);

  // 侧边栏状态 getters
  const isSidebarVisible = computed(() => !sidebarCollapsed.value);

  // 是否有 modal 打开
  const isModalOpen = computed(() => modalStack.value.length > 0);

  // 获取最上层的 modal
  const topModal = computed(() =>
    modalStack.value.length > 0 ? modalStack.value[modalStack.value.length - 1] : null
  );

  // Actions
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed;
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme;
  }

  function incrementNotification() {
    notificationCount.value++;
  }

  function decrementNotification() {
    if (notificationCount.value > 0) {
      notificationCount.value--;
    }
  }

  function clearNotifications() {
    notificationCount.value = 0;
  }

  function openModal(modalName: string) {
    if (!modalStack.value.includes(modalName)) {
      modalStack.value.push(modalName);
    }
  }

  function closeModal(modalName: string) {
    const index = modalStack.value.indexOf(modalName);
    if (index > -1) {
      modalStack.value.splice(index, 1);
    }
  }

  function closeTopModal() {
    if (modalStack.value.length > 0) {
      modalStack.value.pop();
    }
  }

  function clearAllModals() {
    modalStack.value = [];
  }

  return {
    sidebarCollapsed,
    notificationCount,
    theme,
    modalStack,
    isSidebarVisible,
    isModalOpen,
    topModal,
    toggleSidebar,
    setSidebarCollapsed,
    setTheme,
    incrementNotification,
    decrementNotification,
    clearNotifications,
    openModal,
    closeModal,
    closeTopModal,
    clearAllModals
  };
});
