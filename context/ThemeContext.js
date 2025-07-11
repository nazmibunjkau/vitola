import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

const lightTheme = {
  background: '#fff',
  text: '#4b382a',
  primary: '#4b382a',
  accent: '#f5f5f5',
  placeholder: '#a0896f',
  iconOnPrimary: '#fff',
};

const darkTheme = {
  background: '#4b382a',
  text: '#fff',
  primary: '#fff',
  accent: '#a0896f',
  placeholder: '#f5f5f5',
  iconOnPrimary: '#4b382a',
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);