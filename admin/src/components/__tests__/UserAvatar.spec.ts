import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import UserAvatar from '../UserAvatar.vue';

const ElAvatarStub = defineComponent({
  props: {
    src: String,
    size: [Number, String],
    shape: String,
    style: [String, Object]
  },
  emits: ['error'],
  template: '<div class="el-avatar-stub" @click="$emit(\'error\')"><slot /></div>'
});

describe('UserAvatar', () => {
  it('renders the explicit user image URL and preserves fallback content', () => {
    const wrapper = mount(UserAvatar, {
      props: {
        user: { _id: 'user-1', nickname: '喜娟', avatar: '🦁' },
        imageUrl: 'https://example.com/avatar.jpg',
        size: 36
      },
      global: { stubs: { ElAvatar: ElAvatarStub } }
    });

    expect(wrapper.findComponent(ElAvatarStub).props('src')).toBe('https://example.com/avatar.jpg');
    expect(wrapper.text()).toContain('喜娟');
  });

  it('switches to fallback mode after an image error', async () => {
    const wrapper = mount(UserAvatar, {
      props: {
        user: { _id: 'user-2', nickname: '喜娟', avatar: '🌿' },
        imageUrl: 'https://example.com/broken.jpg'
      },
      global: { stubs: { ElAvatar: ElAvatarStub } }
    });

    await wrapper.find('.el-avatar-stub').trigger('click');
    expect(wrapper.findComponent(ElAvatarStub).props('src')).toBeUndefined();
    expect(wrapper.text()).toContain('喜娟');
  });
});
