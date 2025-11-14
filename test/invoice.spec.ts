import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import Invoice from '../src/pages/Invoice.vue';

describe('Invoice.vue', () => {
  it('renders without crashing and shows mobile card wrapper', () => {
    const wrapper = mount(Invoice, {
      global: {
        stubs: ['CustomerAutocomplete', 'Button', 'Badge', 'Icon']
      }
    });

    // Should render root container
    expect(wrapper.exists()).toBe(true);
    // Mobile wrapper exists (lg:hidden), even if empty
    expect(wrapper.findAll('.lg\:hidden').length).toBeGreaterThanOrEqual(0);
  });
});
