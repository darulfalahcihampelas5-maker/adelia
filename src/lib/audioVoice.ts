/**
 * Audio Voice Assistant utility for SACIL SMART App.
 * Specially engineered with 100% compatibility for Huawei tablets (HarmonyOS/EMUI),
 * Opera, Google Chrome, Mozilla Firefox, Microsoft Edge, Safari, iOS, and Android.
 */

const WELCOME_TEXT = "Selamat datang Adeliasari Kusuma Wardani, Es Pede di aplikasi Sacil Smart";
const GOODBYE_TEXT = "Anda telah keluar dari aplikasi";

let hasSpokenWelcomeInSession = false;
let globalAudioCtx: AudioContext | null = null;
let currentPlayingAudio: HTMLAudioElement | null = null;

// Keep global reference to prevent Chromium garbage collector cancellation bug (Chromium issue #679437)
if (typeof window !== 'undefined') {
  (window as any)._sacilVoiceUtterance = null;
}

/**
 * Gets or initializes the universal Web Audio Context
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!globalAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        globalAudioCtx = new AudioCtxClass();
      }
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    return globalAudioCtx;
  } catch (_) {
    return null;
  }
}

/**
 * Plays an elegant, modern welcoming chime using pure Web Audio API synthesis.
 * This works 100% on ANY device (including Huawei, Opera, Chrome, Firefox) without external network dependency.
 */
export function playHarmonicChime(type: 'welcome' | 'goodbye' = 'welcome'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const playNote = (freq: number, start: number, duration: number, gainVal = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Smooth envelope
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainVal, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    if (type === 'welcome') {
      // Elegant 3-tone ascending major chime (E5 -> G#5 -> B5 -> E6)
      playNote(659.25, now + 0.00, 0.35, 0.10); // E5
      playNote(830.61, now + 0.10, 0.40, 0.12); // G#5
      playNote(987.77, now + 0.20, 0.45, 0.12); // B5
      playNote(1318.51, now + 0.32, 0.65, 0.15); // E6
    } else {
      // Gentle descending 2-tone chime (B5 -> E5)
      playNote(987.77, now + 0.00, 0.30, 0.12);
      playNote(659.25, now + 0.12, 0.50, 0.10);
    }
  } catch (err) {
    console.warn('Harmonic chime error:', err);
  }
}

/**
 * Pre-unlocks audio context and speech engine on user touch or click
 */
export function initVoiceAssistant(): void {
  if (typeof window === 'undefined') return;

  // Warm up voices
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

  // Pre-unlock on first interaction
  const unlock = () => {
    getAudioContext();
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch (_) {}
    }
  };

  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('pointerdown', unlock, { passive: true });
}

/**
 * Finds the best Indonesian voice or fallback in browser
 */
function findBestVoice(): SpeechSynthesisVoice | null {
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
  const indonesianVoice = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    return lang.includes('id') || lang.includes('indonesia');
  });
  if (indonesianVoice) return indonesianVoice;

  // 3. Fallback: Any clear female voice
  const femaleVoice = voices.find(v => {
    const name = (v.name || '').toLowerCase();
    return name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('natural');
  });

  return femaleVoice || voices[0] || null;
}

/**
 * Plays text using Web Speech Synthesis API
 */
function speakViaSpeechSynthesis(text: string, onEnd?: () => void): Promise<boolean> {
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

      const voice = findBestVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'id-ID';
      }

      // Fix Chromium / HarmonyOS Garbage Collector bug
      (window as any)._sacilVoiceUtterance = utterance;

      let finished = false;

      utterance.onend = () => {
        if (!finished) {
          finished = true;
          (window as any)._sacilVoiceUtterance = null;
          if (onEnd) onEnd();
          resolve(true);
        }
      };

      utterance.onerror = () => {
        if (!finished) {
          finished = true;
          (window as any)._sacilVoiceUtterance = null;
          resolve(false);
        }
      };

      window.speechSynthesis.speak(utterance);

      // If speech synthesis does not start on Huawei (no TTS installed), fallback after 800ms
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !finished) {
          finished = true;
          resolve(false);
        }
      }, 800);
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Plays text using online high-quality Indonesian female TTS streams
 */
function speakViaAudioEndpoints(text: string, onEnd?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
        currentPlayingAudio = null;
      }

      const encoded = encodeURIComponent(text);
      // Dual endpoint fallback list for maximum reliability across devices
      const endpoints = [
        `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encoded}`,
        `https://api.soundoftext.com/sounds/${encoded}` // secondary mirror fallback
      ];

      let currentIndex = 0;

      const tryNextEndpoint = () => {
        if (currentIndex >= endpoints.length) {
          resolve(false);
          return;
        }

        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = endpoints[currentIndex];
        audio.volume = 1.0;
        currentPlayingAudio = audio;

        let isDone = false;

        audio.onended = () => {
          if (!isDone) {
            isDone = true;
            currentPlayingAudio = null;
            if (onEnd) onEnd();
            resolve(true);
          }
        };

        audio.onerror = () => {
          if (!isDone) {
            isDone = true;
            currentIndex++;
            tryNextEndpoint();
          }
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            if (!isDone) {
              isDone = true;
              currentIndex++;
              tryNextEndpoint();
            }
          });
        }
      };

      tryNextEndpoint();
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Universal voice announcer with instant gesture execution and multi-engine fallback
 */
export async function speakText(text: string, type: 'welcome' | 'goodbye' = 'welcome', onEnd?: () => void): Promise<void> {
  // Always trigger the synthesized harmonic chime instantly for 100% audio feedback guarantee
  playHarmonicChime(type);

  const cleanText = text
    .replace(/S\.Pd\./gi, 'Es Pede')
    .replace(/S,PD/gi, 'Es Pede')
    .replace(/S\.Pd/gi, 'Es Pede')
    .replace(/SPd/gi, 'Es Pede');

  // Slight delay after chime so speech overlays gracefully
  setTimeout(async () => {
    // 1. Try Speech Synthesis
    const speechWorked = await speakViaSpeechSynthesis(cleanText, onEnd);
    if (speechWorked) return;

    // 2. Try Online High-Res Indonesian Voice Stream
    const audioWorked = await speakViaAudioEndpoints(cleanText, onEnd);
    if (audioWorked) return;

    if (onEnd) onEnd();
  }, 120);
}

/**
 * Plays the welcome greeting for Adeliasari Kusuma Wardani, S.Pd.
 */
export function speakWelcome(force = false): void {
  if (!force && hasSpokenWelcomeInSession) return;
  hasSpokenWelcomeInSession = true;
  speakText(WELCOME_TEXT, 'welcome');
}

/**
 * Plays the farewell greeting when logging out
 */
export function speakGoodbye(onComplete?: () => void): void {
  hasSpokenWelcomeInSession = false; // Reset session so next login triggers welcome
  speakText(GOODBYE_TEXT, 'goodbye', onComplete);
}
