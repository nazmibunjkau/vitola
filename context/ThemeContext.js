import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();
const STORAGE_KEY = '@vitola_theme_mode'; 

const lightTheme = {
  background: '#fff',
  plusBackground: '#fff',
  text: '#4b382a',
  primary: '#4b382a',
  accent: '#f5f5f5',
  placeholder: '#a0896f',
  searchPlaceholder: '#a0896f',
  searchText: '#4b382a',
  plusPlaceholder: '#4b382a',
  iconOnPrimary: '#fff',
  inputBackground: '#eeeeee',
  card: '#f7f7f7',
  border: '#e5e0d8',
};

const darkTheme = {
  background: '#4b382a',
  text: '#fff',
  primary: '#fff',
  accent: '#4b382a',
  placeholder: '#f5f5f5',
  searchPlaceholder: '#4b382a',
  searchText: '#4b382a',
  iconOnPrimary: '#4b382a',
  inputBackground: '#fff',
  card: '#352a21',
  border: '#6f5d50',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

    // Load persisted preference
    useEffect(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved === 'dark') {
            setIsDarkMode(true);
          } else if (saved === 'light') {
            setIsDarkMode(false);
          }
        } catch (e) {
          // noop – if storage fails, fall back to default
          console.warn('Theme load failed', e);
        } finally {
          setHydrated(true);
        }
      })();
    }, []);

      const toggleTheme = async () => {
        setIsDarkMode((prev) => {
          const next = !prev;
          // Persist asynchronously; no need to await to keep UI snappy
          AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
          return next;
        });
      };

      const themeObject = useMemo(() => {
        const base = isDarkMode ? darkTheme : lightTheme;
        return {
          ...base,
          isDark: isDarkMode,
          mode: isDarkMode ? 'dark' : 'light',
        };
      }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ theme: themeObject, isDarkMode, toggleTheme, hydrated }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);