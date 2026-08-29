/**
 * Audio Voice Assistant utility for SACIL SMART App.
 * Provides elegant female voice greetings in Indonesian for Welcome and Goodbye events.
 */

const WELCOME_MESSAGE = "Selamat datang Adeliasari Kusuma Wardani, Es Pede di aplikasi Sacil Smart";
const GOODBYE_MESSAGE = "Anda telah keluar dari aplikasi";

let hasSpokenWelcomeInSession = false;
let isVoiceInitialized = false;

/**
 * Finds the best Indonesian female or elegant voice available in the system
 */
function getBestIndonesianFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. First priority: Indonesian female voice specifically (e.g. Gadis, Damayanti, Google Bahasa Indonesia, etc.)
  const idFemaleVoice = voices.find(v => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    const isId = lang.includes('id') || lang.includes('indonesia') || name.includes('indonesia');
    const isFemale = name.includes('gadis') || name.includes('damayanti') || name.includes('female') || 
                     name.includes('wanita') || name.includes('natural') || name.includes('google');
    return isId && isFemale;
  });

  if (idFemaleVoice) return idFemaleVoice;

  // 2. Second priority: Any Indonesian voice
  const idVoice = voices.find(v => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    return lang.includes('id') || lang.includes('indonesia') || name.includes('indonesia');
  });

  if (idVoice) return idVoice;

  // 3. Fallback: Any female voice
  const anyFemaleVoice = voices.find(v => {
    const name = v.name.toLowerCase();
    return name.includes('female') || name.includes('zira') || name.includes('samantha') || 
           name.includes('victoria') || name.includes('karen') || name.includes('natural');
  });

  return anyFemaleVoice || voices[0] || null;
}

/**
 * Initializes and warms up the speech synthesis engine
 */
export function initVoiceAssistant(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (isVoiceInitialized) return;

  isVoiceInitialized = true;

  // Force populate voices list
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      // Voices loaded
    };
  }
  window.speechSynthesis.getVoices();
}

/**
 * Speaks a custom text with an elegant female voice tone
 */
export function speakText(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    // Cancel any ongoing speech to avoid overlapping
    window.speechSynthesis.cancel();

    // Smooth pronunciation for titles without long pauses
    const cleanText = text
      .replace(/S\.Pd\./gi, 'Es Pede')
      .replace(/S,PD/gi, 'Es Pede')
      .replace(/S\.Pd/gi, 'Es Pede')
      .replace(/SPd/gi, 'Es Pede');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID';
    
    // Set pitch & rate for a calm, graceful, and elegant feminine tone
    utterance.pitch = 1.1;
    utterance.rate = 0.98; // Natural, non-staccato pace
    utterance.volume = 1.0;

    const voice = getBestIndonesianFemaleVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'id-ID';
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    // Chrome bug workaround: sometimes speech synthesis pauses unexpectedly
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Voice speech error:', err);
    if (onEnd) onEnd();
  }
}

/**
 * Plays the elegant welcome greeting for Adeliasari Kusuma Wardani, S.Pd.
 */
export function speakWelcome(force = false): void {
  if (!force && hasSpokenWelcomeInSession) return;
  hasSpokenWelcomeInSession = true;

  // Let voices load if not ready yet
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      setTimeout(() => {
        speakText(WELCOME_MESSAGE);
      }, 300);
      return;
    }
  }

  speakText(WELCOME_MESSAGE);
}

/**
 * Plays the elegant farewell notification when logging out
 */
export function speakGoodbye(onComplete?: () => void): void {
  hasSpokenWelcomeInSession = false; // Reset so next login can play welcome again
  speakText(GOODBYE_MESSAGE, onComplete);
}
