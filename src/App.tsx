import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import RefreshLoadingScreen from './components/RefreshLoadingScreen';
import { registerSW } from './lib/notifications';
import { initVoiceAssistant, speakWelcome, speakGoodbye } from './lib/audioVoice';

export default function App() {
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [screen, setScreen] = useState<'splash' | 'login' | 'dashboard'>(() => {
    // If we were already in dashboard, stay there
    return localStorage.getItem('appState') === 'dashboard' ? 'dashboard' : 'splash';
  });

  useEffect(() => {
    const refreshTimer = setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
    return () => clearTimeout(refreshTimer);
  }, []);

  useEffect(() => {
    // Register service worker to make the application PWA installable in the browser
    registerSW();
    // Initialize voice assistant for welcome audio
    initVoiceAssistant();
  }, []);

  useEffect(() => {
    if (!isRefreshing && screen === 'splash') {
      const timer = setTimeout(() => {
        setScreen('login');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, screen]);

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



