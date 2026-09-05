import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from '../src/components/ui/Button.vue';
import { beginNavigation, finishNavigation, navigationPending } from '../src/composables/useNavigation';
import { notices, notify, dismissNotice, pauseNotice, resumeNotice } from '../src/composables/useNotifications';

afterEach(() => {
  for (const notice of [...notices.value]) dismissNotice(notice.id);
  finishNavigation('/new');
  vi.useRealTimers();
});
describe('navigation feedback', () => {
  it('does not flash for fast navigation', () => {
    vi.useFakeTimers();
    beginNavigation('/fast');
    vi.advanceTimersByTime(100);
    finishNavigation('/fast');
    vi.advanceTimersByTime(500);
    expect(navigationPending.value).toBe(false);
  });
  it('keeps feedback for the newest navigation when an older one finishes', () => {
    vi.useFakeTimers();
    beginNavigation('/old');
    beginNavigation('/new');
    finishNavigation('/old');
    vi.advanceTimersByTime(200);
    expect(navigationPending.value).toBe(true);
    finishNavigation('/new');
    expect(navigationPending.value).toBe(false);
  });
});
describe('save feedback', () => {
  it('keeps errors until dismissed and lets users pause success messages', () => {
    vi.useFakeTimers();
    const success = notify.success('Tersimpan');
    const error = notify.error('Gagal');
    pauseNotice(success);
    vi.advanceTimersByTime(10000);
    expect(notices.value.map(n => n.id)).toEqual([success, error]);
    resumeNotice(success);
    vi.advanceTimersByTime(6000);
    expect(notices.value.map(n => n.id)).toEqual([error]);
    dismissNotice(error);
    expect(notices.value).toHaveLength(0);
  });
  it('disables a busy submit button and preserves its accessible label', async () => {
    const click = vi.fn();
    const wrapper = mount(Button, { props: { loading: true, onClick: click }, slots: { default: 'Menyimpan...' } });
    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.element.disabled).toBe(true);
    await wrapper.trigger('click');
    expect(click).not.toHaveBeenCalled();
    expect(wrapper.text()).toBe('Menyimpan...');
    await wrapper.setProps({ loading: false });
    await wrapper.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
