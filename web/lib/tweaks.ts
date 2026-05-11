'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  applyDensity,
  applyTheme,
  readStoredDensity,
  readStoredMode,
  type Density,
  type ThemeMode,
} from './theme';

export function useTweaks() {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    setThemeState(readStoredMode());
    setDensityState(readStoredDensity());
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);

  const setDensity = useCallback((d: Density) => {
    applyDensity(d);
    setDensityState(d);
  }, []);

  return { theme, density, setTheme, setDensity };
}
