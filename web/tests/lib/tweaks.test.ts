import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTweaks } from '@/lib/tweaks';
import { THEME_STORAGE_KEY, DENSITY_STORAGE_KEY } from '@/lib/theme';

describe('useTweaks', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
  });

  it('returns the persisted theme + density on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    const { result } = renderHook(() => useTweaks());
    expect(result.current.theme).toBe('dark');
    expect(result.current.density).toBe('compact');
  });

  it('setTheme updates state, document attribute, and storage', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('setDensity updates state, document attribute, and storage', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setDensity('compact'));
    expect(result.current.density).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });
});
