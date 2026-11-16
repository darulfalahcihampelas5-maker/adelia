import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import RefreshLoadingScreen from './components/RefreshLoadingScreen';
import { registerSW } from './lib/notifications';
import { initVoiceAssistant, speakWelcome, speakGoodbye } from './lib/audioVoice';

export default function App() {
  const [initialFlags] = useState(() => {
    const isManualRefresh = sessionStorage.getItem('sacil_manual_refresh') === 'true';
    sessionStorage.removeItem('sacil_manual_refresh');

    const navEntry =
      typeof performance !== 'undefined'
        ? (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)
        : undefined;
    const isBrowserReload = navEntry?.type === 'reload';
    const isSessionStarted = sessionStorage.getItem('sacil_session_started') === 'true';
    const isLoggedIn = localStorage.getItem('appState') === 'dashboard';

    // Show "Memuat Halaman" ONLY when user actually refreshes (manual refresh button or browser reload after session started)
    const shouldShowRefreshLoading = isManualRefresh || (isSessionStarted && isBrowserReload);

    let startScreen: 'splash' | 'login' | 'dashboard';
    if (isLoggedIn) {
      startScreen = 'dashboard';
    } else if (shouldShowRefreshLoading || isSessionStarted) {
      // On refresh from Login (or already past splash in this session), never show splash again
      startScreen = 'login';
    } else {
      startScreen = 'splash';
    }

    sessionStorage.setItem('sacil_session_started', 'true');
    return { shouldShowRefreshLoading, startScreen };
  });

  const [screen, setScreen] = useState<'splash' | 'login' | 'dashboard'>(initialFlags.startScreen);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(initialFlags.shouldShowRefreshLoading);

  useEffect(() => {
    if (!isRefreshing) return;
    const refreshTimer = setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
    return () => clearTimeout(refreshTimer);
  }, [isRefreshing]);

  useEffect(() => {
    // Register service worker to make the application PWA installable in the browser
    registerSW();
    // Initialize voice assistant for welcome audio
    initVoiceAssistant();
  }, []);

  useEffect(() => {
    if (screen === 'splash') {
      const timer = setTimeout(() => {
        setScreen('login');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const handleLogin = () => {
    localStorage.setItem('appState', 'dashboard');
    setScreen('dashboard');
    speakWelcome(true);
  };

  const handleLogout = () => {
    speakGoodbye();
    localStorage.removeItem('appState');
    setScreen('login');
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 transition-all duration-300">
      <AnimatePresence>
        {isRefreshing && <RefreshLoadingScreen key="refresh-loading" />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {!isRefreshing && screen === 'splash' && <SplashScreen key="splash" />}
        {!isRefreshing && screen === 'login' && <LoginScreen key="login" onLogin={handleLogin} />}
        {!isRefreshing && screen === 'dashboard' && <Dashboard key="dashboard" onLogout={handleLogout} />}
      </AnimatePresence>
    </div>
  );
}



