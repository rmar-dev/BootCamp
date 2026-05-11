import { describe, expect, it, beforeEach } from 'vitest';
import {
  THEME_STORAGE_KEY,
  DENSITY_STORAGE_KEY,
  applyTheme,
  applyDensity,
  readStoredMode,
  readStoredDensity,
} from '@/lib/theme';

describe('theme module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.classList.remove('dark');
  });

  it('applyTheme("dark") sets data-theme="dark", adds .dark class, persists', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('applyTheme("light") sets data-theme="light" and removes .dark class', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applyDensity sets data-density attribute and persists', () => {
    applyDensity('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });

  it('readStoredDensity returns "comfortable" by default', () => {
    expect(readStoredDensity()).toBe('comfortable');
  });

  it('readStoredDensity reads persisted value', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    expect(readStoredDensity()).toBe('compact');
  });

  it('readStoredMode returns "system" by default', () => {
    expect(readStoredMode()).toBe('system');
  });
});
