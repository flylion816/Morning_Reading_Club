<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getUserAvatarDisplay, type AvatarUserLike } from '../utils/avatar';

type AvatarShape = 'circle' | 'square' | 'rounded';

const props = withDefaults(
  defineProps<{
    user?: AvatarUserLike | null;
    imageUrl?: string | null;
    name?: string | null;
    userId?: string | null;
    size?: number | string;
    shape?: AvatarShape;
    fallbackText?: string;
    class?: string;
  }>(),
  {
    user: null,
    imageUrl: '',
    name: '',
    userId: '',
    size: 36,
    shape: 'circle',
    fallbackText: '用',
    class: ''
  }
);

const imageFailed = ref(false);
const display = computed(() =>
  getUserAvatarDisplay(props.user, {
    imageUrl: props.imageUrl,
    name: props.name,
    userId: props.userId,
    fallbackText: props.fallbackText
  })
);
const imageSource = computed(() => (imageFailed.value ? '' : display.value.imageUrl));

watch(
  () => display.value.imageUrl,
  () => {
    imageFailed.value = false;
  }
);

function handleImageError() {
  imageFailed.value = true;
}
</script>

<template>
  <el-avatar
    :src="imageSource || undefined"
    :size="size"
    :shape="shape === 'rounded' ? 'square' : shape"
    :class="['user-avatar', `user-avatar-${shape}`, props.class]"
    :style="{ backgroundColor: display.color }"
    @error="handleImageError"
  >
    {{ display.text }}
  </el-avatar>
</template>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  color: #fffdf8;
  font-weight: 650;
  overflow: hidden;
}

.user-avatar-rounded {
  border-radius: 10px !important;
}

.user-avatar-square {
  border-radius: 8px !important;
}
</style>
