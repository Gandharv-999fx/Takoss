import { useEffect } from 'react';
import { useStore } from '../lib/store';

/**
 * useTheme Hook - Theme management utilities
 */
export function useTheme() {
  const { theme, toggleTheme } = useStore();

  // Apply theme class to document on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Detect system theme preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // Set theme to system preference
  const useSystemTheme = () => {
    const systemTheme = getSystemTheme();
    if (theme !== systemTheme) {
      toggleTheme();
    }
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    getSystemTheme,
    useSystemTheme,
  };
}
