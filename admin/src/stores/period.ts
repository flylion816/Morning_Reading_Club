/**
 * Period Store - 管理期次（晨读营期次）的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { periodApi } from '../services/api';

interface Period {
  id: string;
  _id: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  enrollmentCount?: number;
}

export const usePeriodStore = defineStore('period', () => {
  const periods = ref<Period[]>([]);
  const currentPeriod = ref<Period | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const periodCount = computed(() => periods.value.length);
  const activePeriods = computed(() =>
    periods.value.filter(p => p.status === 'active')
  );
  const archivedPeriods = computed(() =>
    periods.value.filter(p => p.status === 'archived')
  );
  const hasActivePeriod = computed(() => activePeriods.value.length > 0);

  // Actions
  async function fetchPeriods() {
    loading.value = true;
    error.value = null;

    try {
      const response = await periodApi.getPeriods();
      periods.value = response.list || response || [];
      return periods.value;
    } catch (err: any) {
      error.value = err.message || '获取期次列表失败';
      periods.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchPeriodById(periodId: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await periodApi.getPeriodById(periodId);
      currentPeriod.value = response;
      return response;
    } catch (err: any) {
      error.value = err.message || '获取期次详情失败';
      currentPeriod.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function setCurrentPeriod(period: Period | null) {
    currentPeriod.value = period;
  }

  function setPeriods(newPeriods: Period[]) {
    periods.value = newPeriods;
  }

  function addPeriod(period: Period) {
    periods.value.push(period);
  }

  function updatePeriod(periodId: string, updates: Partial<Period>) {
    const index = periods.value.findIndex(p => p.id === periodId || p._id === periodId);
    if (index > -1) {
      periods.value[index] = { ...periods.value[index], ...updates };

      // 同时更新 currentPeriod
      if (currentPeriod.value?.id === periodId || currentPeriod.value?._id === periodId) {
        currentPeriod.value = periods.value[index];
      }
    }
  }

  function removePeriod(periodId: string) {
    periods.value = periods.value.filter(p => p.id !== periodId && p._id !== periodId);

    // 如果删除的是当前期次，清除它
    if (currentPeriod.value?.id === periodId || currentPeriod.value?._id === periodId) {
      currentPeriod.value = null;
    }
  }

  function clearError() {
    error.value = null;
  }

  function reset() {
    periods.value = [];
    currentPeriod.value = null;
    loading.value = false;
    error.value = null;
  }

  return {
    periods,
    currentPeriod,
    loading,
    error,
    periodCount,
    activePeriods,
    archivedPeriods,
    hasActivePeriod,
    fetchPeriods,
    fetchPeriodById,
    setCurrentPeriod,
    setPeriods,
    addPeriod,
    updatePeriod,
    removePeriod,
    clearError,
    reset
  };
});
