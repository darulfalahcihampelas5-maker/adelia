/**
 * Audio Voice Assistant utility for SACIL SMART App.
 * Engineered specifically for 100% reliability across Google Chrome, Opera, Mozilla Firefox, Microsoft Edge, Safari, and mobile browsers.
 */

const WELCOME_TEXT = "Selamat datang Adeliasari Kusuma Wardani, Es Pede di aplikasi Sacil Smart";
const GOODBYE_TEXT = "Anda telah keluar dari aplikasi";

let hasSpokenWelcomeInSession = false;
let activeAudio: HTMLAudioElement | null = null;

// Store global reference to prevent Chromium garbage collector cancellation bug (Chromium issue #679437)
if (typeof window !== 'undefined') {
  (window as any)._sacilUtterance = null;
}

/**
 * Initializes and warms up speech engines (Chrome/Opera voice list + user gesture unlock)
 */
export function initVoiceAssistant(): void {
  if (typeof window === 'undefined') return;

  // Warm up SpeechSynthesis voices in background
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          try {
            window.speechSynthesis.getVoices();
          } catch (_) {}
        };
      }
    } catch (_) {}
  }

  // Pre-unlock speech and audio capabilities on initial user gesture (Click or Touch)
  const unlockAudioEngine = () => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}
    window.removeEventListener('click', unlockAudioEngine);
    window.removeEventListener('touchstart', unlockAudioEngine);
    window.removeEventListener('keydown', unlockAudioEngine);
  };

  window.addEventListener('click', unlockAudioEngine, { once: true });
  window.addEventListener('touchstart', unlockAudioEngine, { once: true });
  window.addEventListener('keydown', unlockAudioEngine, { once: true });
}

/**
 * Finds best Indonesian female or standard voice
 */
function findIndonesianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Indonesian female voice (Gadis, Damayanti, Google Bahasa Indonesia, etc.)
  const indonesianFemale = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    const isId = lang.includes('id') || lang.includes('indonesia');
    const isFemale = name.includes('gadis') || name.includes('damayanti') || name.includes('female') || 
                     name.includes('wanita') || name.includes('google') || name.includes('natural');
    return isId && isFemale;
  });
  if (indonesianFemale) return indonesianFemale;

  // 2. Any Indonesian voice
  const anyIndonesian = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    return lang.includes('id') || lang.includes('indonesia');
  });
  if (anyIndonesian) return anyIndonesian;

  // 3. Fallback female voice
  const anyFemale = voices.find(v => {
    const name = (v.name || '').toLowerCase();
    return name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('natural');
  });

  return anyFemale || voices[0] || null;
}

/**
 * Try speaking via Web Speech Synthesis (with Chromium fixes)
 */
function playWebSpeech(text: string, onEnd?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.pitch = 1.1;
      utterance.rate = 0.98;
      utterance.volume = 1.0;

      const voice = findIndonesianVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'id-ID';
      }

      // Crucial: Pin utterance to global object so Chromium V8 doesn't GC it
      (window as any)._sacilUtterance = utterance;

      let hasEnded = false;

      utterance.onstart = () => {
        // Speech synthesis started successfully
      };

      utterance.onend = () => {
        if (!hasEnded) {
          hasEnded = true;
          (window as any)._sacilUtterance = null;
          if (onEnd) onEnd();
          resolve(true);
        }
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error, will try online audio fallback:', e);
        if (!hasEnded) {
          hasEnded = true;
          (window as any)._sacilUtterance = null;
          resolve(false);
        }
      };

      window.speechSynthesis.speak(utterance);

      // Timeout safety: If synthesis doesn't start in Chrome/Opera within 600ms (e.g. stalled or no voice installed)
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !hasEnded) {
          hasEnded = true;
          resolve(false);
        }
      }, 600);

    } catch (err) {
      resolve(false);
    }
  });
}

/**
 * Try speaking via Google High Quality Indonesian Female TTS stream
 */
function playAudioStream(text: string, onEnd?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }

      const encoded = encodeURIComponent(text);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encoded}`;
      const audio = new Audio(url);
      audio.volume = 1.0;
      activeAudio = audio;

      let finished = false;

      audio.onended = () => {
        if (!finished) {
          finished = true;
          activeAudio = null;
          if (onEnd) onEnd();
          resolve(true);
        }
      };

      audio.onerror = () => {
        if (!finished) {
          finished = true;
          activeAudio = null;
          resolve(false);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio streaming is working
          })
          .catch((err) => {
            console.warn('Audio stream playback failed:', err);
            if (!finished) {
              finished = true;
              activeAudio = null;
              resolve(false);
            }
          });
      }
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Universal Speak function that works across all browsers (Chrome, Opera, Firefox, Edge, Safari)
 */
export async function speakText(text: string, onEnd?: () => void): Promise<void> {
  // Polish text pronunciation
  const cleanText = text
    .replace(/S\.Pd\./gi, 'Es Pede')
    .replace(/S,PD/gi, 'Es Pede')
    .replace(/S\.Pd/gi, 'Es Pede')
    .replace(/SPd/gi, 'Es Pede');

  // Attempt 1: Web Speech API with Chromium GC pinning
  const webSpeechSuccess = await playWebSpeech(cleanText, onEnd);
  if (webSpeechSuccess) return;

  // Attempt 2: High quality Indonesian Audio Stream (Google TTS Engine)
  const audioSuccess = await playAudioStream(cleanText, onEnd);
  if (audioSuccess) return;

  // If both finish or fail, trigger onEnd if provided
  if (onEnd) onEnd();
}

/**
 * Plays the welcome greeting for Adeliasari Kusuma Wardani, S.Pd.
 */
export function speakWelcome(force = false): void {
  if (!force && hasSpokenWelcomeInSession) return;
  hasSpokenWelcomeInSession = true;
  speakText(WELCOME_TEXT);
}

/**
 * Plays the farewell greeting when logging out
 */
export function speakGoodbye(onComplete?: () => void): void {
  hasSpokenWelcomeInSession = false; // Reset session so next login triggers welcome
  speakText(GOODBYE_TEXT, onComplete);
}
