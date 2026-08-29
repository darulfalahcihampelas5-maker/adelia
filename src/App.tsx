import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import { registerSW } from './lib/notifications';
import { initVoiceAssistant, speakWelcome, speakGoodbye } from './lib/audioVoice';

export default function App() {
  const [screen, setScreen] = useState<'splash' | 'login' | 'dashboard'>(() => {
    // If we were already in dashboard, stay there
    return localStorage.getItem('appState') === 'dashboard' ? 'dashboard' : 'splash';
  });

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
      <AnimatePresence mode="wait">
        {screen === 'splash' && <SplashScreen key="splash" />}
        {screen === 'login' && <LoginScreen key="login" onLogin={handleLogin} />}
        {screen === 'dashboard' && <Dashboard key="dashboard" onLogout={handleLogout} />}
      </AnimatePresence>
    </div>
  );
}



