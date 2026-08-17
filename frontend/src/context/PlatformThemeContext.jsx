import React, { createContext, useContext, useState, useEffect } from 'react';

const PlatformThemeContext = createContext(null);

export const PlatformThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('platform_theme');
    return saved !== null ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    localStorage.setItem('platform_theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-platform-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <PlatformThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </PlatformThemeContext.Provider>
  );
};

export const usePlatformTheme = () => {
  const ctx = useContext(PlatformThemeContext);
  if (!ctx) throw new Error('usePlatformTheme must be used inside <PlatformThemeProvider>');
  return ctx;
};
