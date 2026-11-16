import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import RefreshLoadingScreen from './components/RefreshLoadingScreen';
import { registerSW } from './lib/notifications';
import { initVoiceAssistant, speakWelcome, speakGoodbye } from './lib/audioVoice';

export default function App() {
  const [screen, setScreen] = useState<'splash' | 'login' | 'dashboard'>(() => {
    if (localStorage.getItem('appState') === 'dashboard') return 'dashboard';
    if (localStorage.getItem('sacil_splash_shown') === 'true') return 'login';
    return 'splash';
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(() => {
    // Pertama kali dibuka (langsung masuk splash) jangan tampilkan RefreshLoadingScreen
    const isDashboard = localStorage.getItem('appState') === 'dashboard';
    const splashAlreadyShown = localStorage.getItem('sacil_splash_shown') === 'true';
    return isDashboard || splashAlreadyShown;
  });

  useEffect(() => {
    if (screen === 'splash') {
      localStorage.setItem('sacil_splash_shown', 'true');
    }
  }, [screen]);

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
        localStorage.setItem('sacil_splash_shown', 'true');
        setScreen('login');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const handleLogin = () => {
    localStorage.setItem('sacil_splash_shown', 'true');
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



