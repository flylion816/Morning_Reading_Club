/**
 * User Store - 管理用户列表和用户相关操作
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { userApi } from '../services/api';

interface User {
  id: string;
  _id: string;
  email: string;
  nickname: string;
  role?: string;
  status?: string;
  createdAt?: string;
}

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([]);
  const selectedUserIds = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);

  // Getters
  const userCount = computed(() => users.value.length);
  const selectedCount = computed(() => selectedUserIds.value.length);
  const isLoading = computed(() => loading.value);
  const hasError = computed(() => error.value !== null);
  const selectedUsers = computed(() =>
    users.value.filter(user => selectedUserIds.value.includes(user.id || user._id))
  );

  // Actions
  async function fetchUsers(page = 1, pageSize = 20) {
    loading.value = true;
    error.value = null;

    try {
      const response = await userApi.getUsers(page, pageSize);
      users.value = response.list || [];
      totalCount.value = response.total || 0;
      return users.value;
    } catch (err: any) {
      error.value = err.message || '获取用户列表失败';
      users.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  function setUsers(newUsers: User[]) {
    users.value = newUsers;
  }

  function addUser(user: User) {
    users.value.push(user);
  }

  function removeUser(userId: string) {
    users.value = users.value.filter(u => u.id !== userId && u._id !== userId);
  }

  function updateUser(userId: string, updates: Partial<User>) {
    const index = users.value.findIndex(u => u.id === userId || u._id === userId);
    if (index > -1) {
      users.value[index] = { ...users.value[index], ...updates };
    }
  }

  function selectUser(userId: string) {
    if (!selectedUserIds.value.includes(userId)) {
      selectedUserIds.value.push(userId);
    }
  }

  function deselectUser(userId: string) {
    selectedUserIds.value = selectedUserIds.value.filter(id => id !== userId);
  }

  function selectAll() {
    selectedUserIds.value = users.value.map(u => u.id || u._id);
  }

  function deselectAll() {
    selectedUserIds.value = [];
  }

  function clearError() {
    error.value = null;
  }

  function reset() {
    users.value = [];
    selectedUserIds.value = [];
    loading.value = false;
    error.value = null;
    totalCount.value = 0;
  }

  return {
    users,
    selectedUserIds,
    loading,
    error,
    totalCount,
    userCount,
    selectedCount,
    isLoading,
    hasError,
    selectedUsers,
    fetchUsers,
    setUsers,
    addUser,
    removeUser,
    updateUser,
    selectUser,
    deselectUser,
    selectAll,
    deselectAll,
    clearError,
    reset
  };
});
