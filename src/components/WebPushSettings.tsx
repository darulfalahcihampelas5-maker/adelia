import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, ShieldCheck, Send, Clock, Calendar, AlertCircle, HelpCircle, AppWindow } from 'lucide-react';
import { getNotificationPermission, requestPermission, triggerWebPushNotification, registerSW } from '../lib/notifications';
import { db, collection, getDocs, query, orderBy } from '../lib/firebase';

interface Jadwal {
  id: string;
  day: string;
  time: string;
  subject: string;
  kelas: string;
}

export default function WebPushSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [swStatus, setSwStatus] = useState<'active' | 'fallback' | 'unsupported' | 'connecting'>('connecting');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [customTitle, setCustomTitle] = useState('Notifikasi SACIL SMART');
  const [customBody, setCustomBody] = useState('Semangat mengajar hari ini! Jangan lupa lengkapi data presensi kelas.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [jadwalToday, setJadwalToday] = useState<Jadwal[]>([]);
  const [activeDay, setActiveDay] = useState('');

  // Get current day name in Indonesian
  const getIndonesianDay = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date().getDay()];
  };

  useEffect(() => {
    // Check permission status on mount
    setPermission(getNotificationPermission());
    setActiveDay(getIndonesianDay());

    // Register SW on mount and check status
    const initSW = async () => {
      if (!('serviceWorker' in navigator)) {
        setSwStatus('unsupported');
        return;
      }
      try {
        const reg = await registerSW();
        if (reg) {
          setSwStatus('active');
        } else {
          setSwStatus('fallback');
        }
      } catch (e) {
        console.warn("Service worker registration blocked/failed, using fallback:", e);
        setSwStatus('fallback');
      }
    };
    initSW();
    fetchTodaySchedule();
  }, []);

  const fetchTodaySchedule = async () => {
    try {
      const todayName = getIndonesianDay();
      const q = query(collection(db, 'jadwal_mengajar'), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jadwal));
      // Filter for today
      const filtered = data.filter(j => j.day === todayName);
      setJadwalToday(filtered);
    } catch (e) {
      console.error("Error fetching schedule for notification panel:", e);
    }
  };

  const handleRequestPermission = async () => {
    const status = await requestPermission();
    setPermission(status);
    
    if (status === 'granted') {
      // Send a welcoming out-of-app notification
      triggerWebPushNotification(
        '🔔 Notifikasi Berhasil Diaktifkan!',
        'Anda akan menerima pemberitahuan jadwal dan agenda mengajar langsung di perangkat Anda.'
      );
    }
  };

  const handleSimulateNotification = async () => {
    if (permission !== 'granted') {
      alert('Mohon izinkan notifikasi terlebih dahulu.');
      return;
    }

    if (delaySeconds > 0) {
      setIsSimulating(true);
      setCountdown(delaySeconds);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev !== null && prev <= 1) {
            clearInterval(interval);
            setIsSimulating(false);
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);

      // Trigger actual notification with delay
      await triggerWebPushNotification(customTitle, customBody, delaySeconds);
    } else {
      await triggerWebPushNotification(customTitle, customBody, 0);
    }
  };

  const handleSendScheduleNotification = async () => {
    if (permission !== 'granted') {
      alert('Mohon izinkan notifikasi terlebih dahulu.');
      return;
    }

    if (jadwalToday.length === 0) {
      await triggerWebPushNotification(
        '📅 Agenda Mengajar Hari Ini',
        `Hari ini (${activeDay}) tidak ada jadwal mengajar terdaftar di sistem. Selamat beristirahat!`
      );
    } else {
      const scheduleText = jadwalToday
        .map(j => `- ${j.time}: ${j.subject} (${j.kelas})`)
        .join('\n');

      await triggerWebPushNotification(
        `📅 Jadwal Mengajar Hari Ini (${activeDay})`,
        `Anda memiliki ${jadwalToday.length} kelas hari ini:\n${scheduleText}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#F06C84]/10 text-[#F06C84] rounded-2xl">
            <Bell className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">Notifikasi Luar Aplikasi (Web Push)</h2>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              Hubungkan aplikasi dengan fitur notifikasi sistem smartphone atau desktop Anda.
            </p>
          </div>
        </div>
      </div>

      {/* Main Configurations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status & Permission Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-full min-h-[350px]">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F06C84]" />
                Status Koneksi Perangkat
              </h3>
              
              <div className="space-y-4">
                {/* Notification Permission Indicator */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Izin Notifikasi</p>
                    <p className="text-sm font-black text-gray-800 mt-0.5">
                      {permission === 'granted' ? 'Dizinkan (Aktif)' : permission === 'denied' ? 'Ditolak (Non-Aktif)' : 'Belum Dikonfigurasi'}
                    </p>
                  </div>
                  {permission === 'granted' ? (
                    <span className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                  ) : (
                    <span className="p-2 bg-rose-50 text-rose-500 rounded-xl border border-rose-100">
                      <BellOff className="w-5 h-5" />
                    </span>
                  )}
                </div>

                {/* Service Worker Indicator */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Service Worker Engine</p>
                    <p className="text-sm font-black text-gray-800 mt-0.5">
                      {swStatus === 'active' && 'Terdaftar & Aktif'}
                      {swStatus === 'fallback' && 'Aktif (Direct Browser)'}
                      {swStatus === 'unsupported' && 'Tidak Didukung'}
                      {swStatus === 'connecting' && 'Menghubungkan...'}
                    </p>
                  </div>
                  <span className={`p-2 rounded-xl border ${
                    swStatus === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    swStatus === 'fallback' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    swStatus === 'unsupported' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    <AppWindow className="w-5 h-5" />
                  </span>
                </div>
              </div>

              {permission !== 'granted' && (
                <div className="mt-5 p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#F06C84] shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Browser memblokir pengiriman notifikasi secara default. Anda harus mengizinkannya secara manual untuk mengaktifkan Web Push.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              {permission === 'granted' ? (
                <div className="w-full text-center py-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-bold flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Notifikasi Perangkat Aktif!
                </div>
              ) : (
                <button
                  onClick={handleRequestPermission}
                  className="w-full py-3.5 bg-[#F06C84] hover:bg-[#d8556d] text-white text-sm font-bold rounded-xl shadow-md shadow-[#F06C84]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Bell className="w-4 h-4 animate-bounce" /> Aktifkan Notifikasi Sekarang
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Simulator Panel (Delayed Web Push Simulator) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#F06C84]" />
              Simulator Web Push (Uji Coba Latar Belakang)
            </h3>
            <p className="text-xs text-gray-500 font-medium mb-6">
              Kirimkan notifikasi simulasi ke HP atau laptop Anda. Gunakan opsi penundaan waktu, klik tombol simulasi, lalu segera kunci layar HP atau sembunyikan aplikasi untuk melihat keajaiban Web Push berjalan di luar aplikasi!
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Judul Notifikasi</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Masukkan judul notifikasi..."
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Tunda Pengiriman</label>
                  <select
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20"
                  >
                    <option value={0}>Kirim Instan (Langsung)</option>
                    <option value={5}>Tunda 5 Detik</option>
                    <option value={10}>Tunda 10 Detik</option>
                    <option value={30}>Tunda 30 Detik</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Isi Pesan Notifikasi</label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Ketik isi pesan di sini..."
                  rows={2}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSimulateNotification}
                  disabled={isSimulating || permission !== 'granted'}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    permission !== 'granted'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : 'bg-[#F06C84] hover:bg-[#d8556d] text-white'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Maju Mundur ({countdown}s)... Kunci HP Anda Sekarang!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {delaySeconds > 0 ? `Simulasikan Push (Tunda ${delaySeconds}s)` : 'Kirim Notifikasi Instan'}
                    </>
                  )}
                </button>

                <button
                  onClick={handleSendScheduleNotification}
                  disabled={permission !== 'granted'}
                  className={`py-3.5 px-5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    permission !== 'granted'
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-[#F06C84] text-[#F06C84] hover:bg-rose-50'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Kirim Agenda Hari Ini ({activeDay})
                </button>

                <button
                  onClick={() => {
                    if ((window as any).__simulateScheduleReminder) {
                      (window as any).__simulateScheduleReminder();
                    } else {
                      alert('Sistem pengingat belum siap. Silakan refresh halaman.');
                    }
                  }}
                  className="py-3.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-blue-200"
                >
                  <Bell className="w-4 h-4" />
                  Simulasi Banner Layar & Bel
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Info & Guides Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#F06C84]" />
          Petunjuk Aktivasi Notifikasi di Smartphone Anda
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600 leading-relaxed">
          {/* Android Guide */}
          <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100/30 space-y-3">
            <h4 className="font-extrabold text-blue-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">1</span>
              Untuk Pengguna Android (Chrome / Firefox / Edge)
            </h4>
            <ul className="list-disc list-inside space-y-2 text-xs font-medium">
              <li>Buka website aplikasi ini menggunakan browser Google Chrome atau sejenisnya di HP Anda.</li>
              <li>Klik tombol <span className="font-bold">"Aktifkan Notifikasi Sekarang"</span> di atas atau lihat ikon gembok di sebelah kiri alamat website di browser.</li>
              <li>Klik <span className="font-bold">"Izin Situs"</span> atau <span className="font-bold">"Izin Notifikasi"</span> dan pilih <span className="font-bold">"Izinkan (Allow)"</span>.</li>
              <li>Agar lebih mudah, klik menu titik tiga di Chrome dan pilih <span className="font-bold">"Tambahkan ke Layar Utama (Add to Home Screen)"</span> untuk menginstall aplikasi sebagai Aplikasi Pintar (PWA).</li>
            </ul>
          </div>

          {/* iOS Guide */}
          <div className="p-5 bg-amber-50/20 rounded-2xl border border-amber-100/30 space-y-3">
            <h4 className="font-extrabold text-amber-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">2</span>
              Untuk Pengguna iPhone / iOS (Safari)
            </h4>
            <ul className="list-disc list-inside space-y-2 text-xs font-medium">
              <li>Buka website aplikasi ini menggunakan browser bawaan <span className="font-bold">Safari</span> di iPhone Anda (iOS 16.4 ke atas).</li>
              <li>Klik tombol <span className="font-bold">Bagikan (Share Button)</span> di bagian bawah Safari (ikon kotak dengan panah atas).</li>
              <li>Scroll ke bawah dan pilih <span className="font-bold">"Tambahkan ke Layar Utama (Add to Home Screen)"</span>.</li>
              <li>Buka aplikasi SACIL SMART yang baru muncul di layar utama iPhone Anda.</li>
              <li>Masuk ke menu <span className="font-bold">Notifikasi Web Push</span> ini dan klik <span className="font-bold">"Aktifkan Notifikasi Sekarang"</span> untuk mengaktifkan izin Web Push.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
