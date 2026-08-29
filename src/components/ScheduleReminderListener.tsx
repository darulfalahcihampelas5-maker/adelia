import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy } from '../lib/firebase';
import { Bell, Clock, X, Volume2 } from 'lucide-react';
import { triggerWebPushNotification } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';

interface Jadwal {
  id: string;
  day: string;
  time: string;
  subject: string;
  kelas: string;
}

export default function ScheduleReminderListener() {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [activeReminder, setActiveReminder] = useState<Jadwal | null>(null);

  // Get Indonesian day name
  const getIndonesianDay = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date().getDay()];
  };

  const fetchJadwal = async () => {
    try {
      const q = query(collection(db, 'jadwal_mengajar'), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jadwal));
      setJadwal(data);
    } catch (error) {
      console.error("Error fetching schedules for listener:", error);
    }
  };

  useEffect(() => {
    fetchJadwal();
    
    // Refresh schedule list every 5 minutes to stay updated
    const listInterval = setInterval(fetchJadwal, 5 * 60 * 1000);
    return () => clearInterval(listInterval);
  }, []);

  const normalizeTime = (timeStr: string): string => {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return '';
    const hour = parts[0].padStart(2, '0');
    const minute = parts[1].padStart(2, '0');
    return `${hour}:${minute}`;
  };

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = audioCtx.currentTime;
      playTone(587.33, now, 0.15); // D5
      playTone(880, now + 0.12, 0.3); // A5
    } catch (err) {
      console.warn("Audio Context blocked or unsupported:", err);
    }
  };

  const triggerNotification = (j: Jadwal) => {
    setActiveReminder(j);
    playChime();
    
    // Trigger system push notification (PWA / Web Push)
    triggerWebPushNotification(
      '⏰ Pengingat Jadwal Mengajar!',
      `Saatnya mengajar kelas ${j.kelas} - Mata Pelajaran: ${j.subject} (${j.time})`
    );
  };

  // Check schedules every 30 seconds
  useEffect(() => {
    const checkSchedule = () => {
      const today = getIndonesianDay();
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMin}`;
      const todayDateStr = now.toDateString();

      const todaySchedules = jadwal.filter(j => j.day === today);

      todaySchedules.forEach(j => {
        // Extract start time
        let startTimeRaw = '';
        const cleaned = j.time.trim();
        const separators = ['-', 's/d', 'sampai dengan', 'sampai'];
        let found = false;
        for (const sep of separators) {
          if (cleaned.includes(sep)) {
            startTimeRaw = cleaned.split(sep)[0].trim();
            found = true;
            break;
          }
        }
        if (!found) {
          startTimeRaw = cleaned;
        }

        const startNormalized = normalizeTime(startTimeRaw);
        if (!startNormalized) return;

        if (startNormalized === currentTimeStr) {
          const storageKey = `notified_schedule_${j.id}_${todayDateStr}_${currentTimeStr}`;
          if (!localStorage.getItem(storageKey)) {
            localStorage.setItem(storageKey, 'true');
            triggerNotification(j);
          }
        }
      });
    };

    // Run check immediately on schedule load, then every 30s
    if (jadwal.length > 0) {
      checkSchedule();
    }
    const interval = setInterval(checkSchedule, 30 * 1000);
    return () => clearInterval(interval);
  }, [jadwal]);

  // Test feature listener in window to allow easy testing from developer dashboard or console
  useEffect(() => {
    (window as any).__simulateScheduleReminder = () => {
      const mockJadwal: Jadwal = {
        id: 'mock_test',
        day: getIndonesianDay(),
        time: '08:00 - 09:30',
        subject: 'Mata Pelajaran Simulasi (Uji Coba)',
        kelas: 'Kelas Contoh'
      };
      triggerNotification(mockJadwal);
    };
    return () => {
      delete (window as any).__simulateScheduleReminder;
    };
  }, []);

  return (
    <AnimatePresence>
      {activeReminder && (
        <motion.div 
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-md px-4"
        >
          <div className="bg-gradient-to-r from-[#F06C84] to-[#f2889c] text-white p-5 rounded-3xl shadow-xl shadow-rose-200 border border-white/20 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-10 -mb-10" />
            
            <div className="flex gap-4 items-start relative z-10">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl shrink-0 mt-0.5 animate-pulse">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase text-white/80">
                  <Clock className="w-3.5 h-3.5" /> Jadwal Mengajar Dimulai
                </div>
                <h4 className="font-extrabold text-lg leading-snug">{activeReminder.subject}</h4>
                <p className="text-sm font-medium text-white/90">
                  Saatnya mengajar di <span className="underline decoration-2 underline-offset-2 font-bold">{activeReminder.kelas}</span>
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-md rounded-lg text-xs font-bold mt-2">
                  <Clock className="w-3 h-3" /> Jam: {activeReminder.time}
                </div>
              </div>
              <button 
                onClick={() => setActiveReminder(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10 text-[10px] text-white/70 font-semibold">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 animate-bounce" /> Audio chime diputar
              </span>
              <span>SACIL SMART Reminder</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
