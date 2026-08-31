import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { 
  Home, Users, CheckSquare, PieChart, FileText, UserCog, LogOut, 
  Database, ShieldCheck, BarChart2, Wifi, Activity, Clock, Settings, Edit, User,
  AlertCircle, RefreshCw, BookOpen, Book, Calendar, CalendarDays, CalendarRange, GraduationCap, CalendarClock,
  ChevronLeft, ChevronRight, BellRing, ChevronDown, Check
} from 'lucide-react';
import { 
  collection, getDocs, doc, getDoc, db, 
  getUsage, QUOTA_READS, QUOTA_WRITES, clearCache 
} from '../lib/firebase';

import { DigitalClock } from './DigitalClock';
import DataSiswaKelas from './DataSiswaKelas';
import AbsensiSiswa from './AbsensiSiswa';
import KalenderPendidikan from './KalenderPendidikan';
import JadwalMengajar from './JadwalMengajar';
import BukuAgendaGuru from './BukuAgendaGuru';
// import LaporanPDF from './LaporanPDF';
import ModulAjar from './ModulAjar';
import UserProfile from './UserProfile';
import NilaiSiswa from './NilaiSiswa';
import WebPushSettings from './WebPushSettings';
import ScheduleReminderListener from './ScheduleReminderListener';
import LiterasiGuru from './LiterasiGuru';

export default function Dashboard({ onLogout }: { onLogout: () => void, key?: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [usage, setUsage] = useState(getUsage());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    const handleUsageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setUsage(customEvent.detail);
      }
    };
    window.addEventListener('firebase-usage-updated', handleUsageUpdate);
    return () => window.removeEventListener('firebase-usage-updated', handleUsageUpdate);
  }, []);

  // Automatic daily reset of Firebase usage counter and cache invalidation when day changes
  useEffect(() => {
    const checkDateChange = () => {
      const currentUsage = getUsage();
      setUsage(currentUsage);
    };

    // Check periodically every 15 seconds
    const interval = setInterval(checkDateChange, 15000);

    // Also check when tab becomes active / visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check on window focus
    window.addEventListener('focus', checkDateChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkDateChange);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [preselectKelas, setPreselectKelas] = useState<string | null>(null);
  const [headerProfilePic, setHeaderProfilePic] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('firebase-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('firebase-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchHeaderProfile = async () => {
      try {
        const docRef = doc(db, "user_profile", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setHeaderProfilePic(docSnap.data().profilePic || null);
        }
      } catch (e) {
        console.error("Error fetching header profile:", e);
      }
    };
    fetchHeaderProfile();
  }, [activeTab]);

  interface StudentAbsensiStats {
    siswaId: string;
    namaSiswa: string;
    kelas: string;
    sakit: number;
    izin: number;
    alpa: number;
    sakitDates: string[];
    izinDates: string[];
    alpaDates: string[];
  }

  const [allStats, setAllStats] = useState<StudentAbsensiStats[]>([]);
  const [topSakit, setTopSakit] = useState<StudentAbsensiStats[]>([]);
  const [topIzin, setTopIzin] = useState<StudentAbsensiStats[]>([]);
  const [topAlpa, setTopAlpa] = useState<StudentAbsensiStats[]>([]);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [kelasFilter, setKelasFilter] = useState<string>('Semua');
  const [isKelasDropdownOpen, setIsKelasDropdownOpen] = useState<boolean>(false);
  const [allKelasList, setAllKelasList] = useState<string[]>([]);

  interface KelasTaskStats {
    kelas: string;
    totalSiswa: number;
    siswaBelumTugas: number;
    percentage: number;
  }
  const [taskStats, setTaskStats] = useState<KelasTaskStats[]>([]);
  const [loadingTaskStats, setLoadingTaskStats] = useState(false);

  const formatIndonesianDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[0];
    return `${day} ${months[monthIndex]} ${year}`;
  };

  const fetchAbsensiReport = async () => {
    setLoadingReport(true);
    try {
      const absensiSnapshot = await getDocs(collection(db, 'absensi'));
      const statsMap: Record<string, StudentAbsensiStats> = {};
      const uniqueClasses = new Set<string>();

      absensiSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const siswaId = data.siswaId;
        const namaSiswa = data.namaSiswa || 'Siswa Tanpa Nama';
        const kelas = data.kelas || 'Umum';
        const status = data.status;
        const tanggal = data.tanggal;

        if (kelas) uniqueClasses.add(kelas);

        if (!siswaId) return;

        if (!statsMap[siswaId]) {
          statsMap[siswaId] = {
            siswaId,
            namaSiswa,
            kelas,
            sakit: 0,
            izin: 0,
            alpa: 0,
            sakitDates: [],
            izinDates: [],
            alpaDates: []
          };
        }

        if (status === 'Sakit') {
          statsMap[siswaId].sakit += 1;
          if (tanggal && !statsMap[siswaId].sakitDates.includes(tanggal)) {
            statsMap[siswaId].sakitDates.push(tanggal);
          }
        } else if (status === 'Izin') {
          statsMap[siswaId].izin += 1;
          if (tanggal && !statsMap[siswaId].izinDates.includes(tanggal)) {
            statsMap[siswaId].izinDates.push(tanggal);
          }
        } else if (status === 'Alpa') {
          statsMap[siswaId].alpa += 1;
          if (tanggal && !statsMap[siswaId].alpaDates.includes(tanggal)) {
            statsMap[siswaId].alpaDates.push(tanggal);
          }
        }
      });

      // Sort dates descending (newest first)
      Object.values(statsMap).forEach(student => {
        student.sakitDates.sort((a, b) => b.localeCompare(a));
        student.izinDates.sort((a, b) => b.localeCompare(a));
        student.alpaDates.sort((a, b) => b.localeCompare(a));
      });

      setAllKelasList(Array.from(uniqueClasses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
      setAllStats(Object.values(statsMap));
    } catch (error) {
      console.error("Error fetching absensi report:", error);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Dashboard') {
      fetchAbsensiReport();
    }
  }, [activeTab]);

  useEffect(() => {
    let filtered = allStats;
    if (kelasFilter !== 'Semua') {
      filtered = allStats.filter(item => item.kelas === kelasFilter);
    }

    const sortedSakit = [...filtered]
      .filter(item => item.sakit > 0)
      .sort((a, b) => b.sakit - a.sakit || a.namaSiswa.localeCompare(b.namaSiswa));

    const sortedIzin = [...filtered]
      .filter(item => item.izin > 0)
      .sort((a, b) => b.izin - a.izin || a.namaSiswa.localeCompare(b.namaSiswa));

    const sortedAlpa = [...filtered]
      .filter(item => item.alpa > 0)
      .sort((a, b) => b.alpa - a.alpa || a.namaSiswa.localeCompare(b.namaSiswa));

    setTopSakit(sortedSakit);
    setTopIzin(sortedIzin);
    setTopAlpa(sortedAlpa);
  }, [allStats, kelasFilter]);

  const fetchTaskStats = async () => {
    setLoadingTaskStats(true);
    try {
      const siswaSnapshot = await getDocs(collection(db, 'siswa'));
      const nilaiSnapshot = await getDocs(collection(db, 'nilai'));
      
      // Group students by kelas
      const studentsByKelas: Record<string, string[]> = {};
      siswaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.kelas) {
          if (!studentsByKelas[data.kelas]) studentsByKelas[data.kelas] = [];
          studentsByKelas[data.kelas].push(doc.id);
        }
      });

      // Group tasks by kelas
      const tasksByKelas: Record<string, any[]> = {};
      nilaiSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.kelas) {
          if (!tasksByKelas[data.kelas]) tasksByKelas[data.kelas] = [];
          tasksByKelas[data.kelas].push(data);
        }
      });

      const stats: KelasTaskStats[] = [];
      for (const kelas in studentsByKelas) {
        const students = studentsByKelas[kelas];
        const tasks = tasksByKelas[kelas] || [];
        let missingCount = 0;

        if (tasks.length > 0) {
          students.forEach(studentId => {
            // check if student has any missing task
            let hasMissing = false;
            tasks.forEach(task => {
              const score = task.nilai?.[studentId];
              if (!score || score.trim() === '' || score.trim() === '-') {
                hasMissing = true;
              }
            });
            if (hasMissing) missingCount++;
          });
        }

        stats.push({
          kelas,
          totalSiswa: students.length,
          siswaBelumTugas: missingCount,
          percentage: tasks.length === 0 ? 0 : Math.round((missingCount / students.length) * 100)
        });
      }
      
      setTaskStats(stats.sort((a, b) => b.percentage - a.percentage));
    } catch (e) {
      console.error("Error fetching task stats:", e);
    } finally {
      setLoadingTaskStats(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      clearCache();
      await Promise.all([
        fetchAbsensiReport(),
        fetchTaskStats()
      ]);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error("Error force syncing database:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Rekapitulasi') {
      fetchTaskStats();
    }
  }, [activeTab]);

  const navItems = [
    { name: 'Dashboard', icon: Home, active: true },
    { name: 'Data Siswa & Kelas', icon: Users, active: false },
    { name: 'Presensi Siswa', icon: CheckSquare, active: false },
    { name: 'Buku Agenda Guru', icon: BookOpen, active: false },
    { name: 'Modul Ajar', icon: Book, active: false },
    { name: 'Literasi Guru', icon: FileText, active: false },
    { name: 'Kalender Pendidikan', icon: Calendar, active: false },
    { name: 'Nilai Siswa', icon: GraduationCap, active: false },
    { name: 'Jadwal Mengajar', icon: CalendarClock, active: false },
    { name: 'Rekapitulasi', icon: PieChart, active: false },
    { name: 'Notifikasi Web Push', icon: BellRing, active: false },
    { name: 'Pengguna', icon: UserCog, active: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden font-sans">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Floating Toggle Button (Pull Tab) */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`
          fixed top-1/2 -translate-y-1/2 z-[60]
          bg-[#F06C84] text-white p-1.5 shadow-lg cursor-pointer
          transition-all duration-300 ease-in-out
          flex items-center justify-center rounded-r-xl border border-l-0 border-[#d05c74]
          ${isSidebarOpen ? 'left-72' : 'left-0'}
        `}
        title={isSidebarOpen ? "Sembunyikan Menu" : "Tampilkan Menu"}
      >
        {isSidebarOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 shrink-0
        w-72 bg-[#eff6ff] text-gray-800 flex flex-col
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0 lg:ml-0' : '-translate-x-full lg:-ml-72'}
      `}>
        {/* Sidebar Header */}
        <div className="h-20 flex items-center px-5 border-b border-gray-100 bg-white">
          <img 
            src="https://lh3.googleusercontent.com/d/10qu230Y8LS0lESyDVo0MzG2QQhfIHs3S" 
            alt="Logo" 
            className="w-16 h-16 object-contain mr-4 mix-blend-multiply"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="font-extrabold text-[#F06C84] text-lg leading-tight tracking-tight">SACIL SMART App</h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">SMP Negeri 1 Cililin</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveTab(item.name);
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
                setPreselectKelas(null);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.name 
                  ? 'bg-[#F06C84] text-white font-medium shadow-md shadow-blue-900/20' 
                  : 'hover:bg-blue-100 hover:text-blue-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.name ? 'text-white' : 'text-gray-500 group-hover:text-blue-700'}`} />
              {item.name}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-blue-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f4f7f6]">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-10 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-3 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'lg:max-w-0 lg:opacity-0' : 'max-w-xs opacity-100'}`}>
              <div className="whitespace-nowrap">
                <h2 className="font-extrabold text-[#F06C84] text-lg leading-none tracking-tight">SACIL SMART App</h2>
                <p className="text-[11px] sm:text-xs text-gray-500 font-bold mt-1 uppercase tracking-wide">SMP Negeri 1 Cililin</p>
              </div>
            </div>
          </div>

          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full shadow-sm animate-pulse">
              <Wifi className="w-3.5 h-3.5 text-amber-500" />
              <span>Mode Offline (Data Terkini Di-cache)</span>
            </div>
          )}

          <div className="flex items-center gap-4 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900">Dashboard</p>
              <p className="text-xs text-gray-500">Selamat datang, <span className="text-[#F06C84] font-semibold">Adeliasari Kusuma Wardani, S.Pd.</span></p>
            </div>
            <button 
              onClick={() => setActiveTab('Pengguna')}
              className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-[#F06C84] text-[#F06C84] shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-[#F06C84]/40"
              title="Ke Profil Pengguna"
            >
              {headerProfilePic ? (
                <img src={headerProfilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </button>
          </div>
        </header>

        {quotaExceeded && (
          <div className="bg-amber-500 text-white px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md z-20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              Google Cloud Firestore Quota Exceeded (Limit Gratis Harian Tercapai). Data tidak dapat dimuat untuk sementara. Siklus kuota akan direset otomatis pada <strong>pukul 14:00 WIB</strong>.
            </span>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {activeTab === 'Dashboard' && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    y: { duration: 0.3 }
                  }}
                  className="bg-white rounded-3xl p-6 lg:p-10 text-[#F06C84] shadow-xl shadow-[#F06C84]/20 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#F06C84]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative z-10">
                    <h1 className="text-4xl lg:text-5xl font-black text-[#F06C84] mb-2 tracking-tight drop-shadow-sm">SACIL SMART App</h1>
                    <p className="text-[10px] lg:text-xs font-bold tracking-wider text-[#F06C84]/80 mb-6 max-w-2xl leading-relaxed">
                      Sistem Akademik Cerdas dan Integritas Lokal untuk Siswa Mandiri, Aktif, Responsif, dan Terpuji
                    </p>

                    <h2 className="text-2xl lg:text-3xl font-bold mb-3 text-[#F06C84]">Halo, Adeliasari Kusuma Wardani, S.Pd.!</h2>
                    <p className="text-sm lg:text-base text-[#F06C84]/90 leading-relaxed max-w-2xl mb-8">
                      Selamat datang kembali di <span className="font-semibold">Portal Manajemen Kehadiran Siswa</span><br/>
                      SMP Negeri 1 Cililin. Pekerjaan Anda sedang dalam sinkronisasi cloud yang aman.
                    </p>

                    <div className="flex flex-col items-center justify-center mt-8 mb-4">
                      <div className="bg-[#F06C84]/10 backdrop-blur-md border border-[#F06C84]/20 rounded-3xl px-10 py-8 shadow-xl">
                        <DigitalClock />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card Rekapitulasi Penggunaan Firebase Cloud */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-md relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl opacity-70 -translate-y-1/3 translate-x-1/3" />
                  
                  <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#F06C84]/10 text-[#F06C84] rounded-2xl">
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900 leading-tight">Rekapitulasi Penggunaan Firebase Cloud</h3>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">Statistik sinkronisasi data pembacaan & penulisan hari ini</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleForceSync}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 self-start sm:self-center cursor-pointer ${
                          isSyncing 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-[#F06C84] hover:bg-[#d8556d] text-white hover:shadow'
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Ulang'}
                      </button>
                    </div>

                    {syncSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-emerald-100 flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                        Cache berhasil dibersihkan! Seluruh data terbaru telah dimuat ulang langsung dari server Cloud Firestore.
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Card Pembacaan (Reads) */}
                      <div className="bg-blue-50/30 border border-blue-100/50 p-5 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">PEMBACAAN DATA (READS)</p>
                            <h4 className="text-2xl font-black text-gray-900 mt-1">{usage.reads.toLocaleString('id-ID')} <span className="text-xs text-gray-400 font-bold">dari {QUOTA_READS.toLocaleString('id-ID')}</span></h4>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-extrabold uppercase">
                            FREE QUOTA
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-blue-100/50 rounded-full h-3 mb-4 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (usage.reads / QUOTA_READS) * 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-xs font-semibold mt-1">
                          <span className="text-gray-500">Sisa Kuota Hari Ini:</span>
                          <span className="text-blue-600 font-extrabold">{(Math.max(0, QUOTA_READS - usage.reads)).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      {/* Card Penulisan (Writes) */}
                      <div className="bg-rose-50/30 border border-rose-100/50 p-5 rounded-2xl flex flex-col justify-between hover:shadow-sm transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] text-[#F06C84] font-bold uppercase tracking-wider">PENULISAN DATA (WRITES)</p>
                            <h4 className="text-2xl font-black text-gray-900 mt-1">{usage.writes.toLocaleString('id-ID')} <span className="text-xs text-gray-400 font-bold">dari {QUOTA_WRITES.toLocaleString('id-ID')}</span></h4>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-50 text-[#F06C84] border border-rose-100 rounded-lg text-[10px] font-extrabold uppercase">
                            FREE QUOTA
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-rose-100/50 rounded-full h-3 mb-4 overflow-hidden">
                          <div 
                            className="bg-[#F06C84] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (usage.writes / QUOTA_WRITES) * 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-xs font-semibold mt-1">
                          <span className="text-gray-500">Sisa Kuota Hari Ini:</span>
                          <span className="text-[#F06C84] font-extrabold">{(Math.max(0, QUOTA_WRITES - usage.writes)).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2">
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-[#F06C84] mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                          Sistem mencatat aktivitas database di aplikasi secara real-time dan secara otomatis akan mereset hitungan penggunaan ke 0 <span className="font-bold text-[#F06C84]">setiap pukul 14:00 WIB</span> (Siklus 24 Jam). Sisa kuota mengacu pada kapasitas gratis harian dari <span className="font-semibold text-gray-800">Google Cloud Firebase Spark Plan</span>.
                        </p>
                      </div>
                      {usage.cycleStart && (
                        <span className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[10px] font-bold shrink-0 self-start sm:self-center">
                          Siklus: {usage.cycleStart.split(' ')[0]} (14:00) s/d {usage.cycleEnd?.split(' ')[0]} (14:00)
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}

            {activeTab === 'Rekapitulasi' && (
              <div className="max-w-7xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-[#F06C84]" />
                        Laporan Akumulasi Ketidakhadiran Terbanyak
                      </h3>
                      <p className="text-sm text-gray-500 font-medium mt-1">
                        Daftar peringkat siswa dengan jumlah ketidakhadiran tertinggi
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {/* Filter Kelas Custom Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsKelasDropdownOpen(!isKelasDropdownOpen)}
                          className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 cursor-pointer transition-colors shadow-2xs"
                        >
                          <span>Kelas:</span>
                          <span className="font-bold text-[#F06C84]">{kelasFilter}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isKelasDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {isKelasDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsKelasDropdownOpen(false)} />
                              <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-gray-150 rounded-2xl shadow-xl z-50 py-1.5 max-h-60 overflow-y-auto"
                              >
                                <button
                                  type="button"
                                  onClick={() => { setKelasFilter("Semua"); setIsKelasDropdownOpen(false); }}
                                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                                    kelasFilter === 'Semua' ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>Semua Kelas</span>
                                  {kelasFilter === 'Semua' && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                </button>
                                {allKelasList.map(k => (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => { setKelasFilter(k); setIsKelasDropdownOpen(false); }}
                                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                                      kelasFilter === k ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <span>Kelas {k}</span>
                                    {kelasFilter === k && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                  </button>
                                ))}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Refresh Button */}
                      <button 
                        onClick={fetchAbsensiReport}
                        disabled={loadingReport}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-[#F06C84] rounded-xl transition-all border border-blue-100 cursor-pointer disabled:opacity-50"
                        title="Segarkan Data"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                    {/* Column 1: Sakit */}
                    <div className="bg-amber-50/20 border border-amber-100/70 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-amber-100 text-[#F06C84] rounded-xl">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">Sakit Terbanyak</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kategori Sakit</p>
                        </div>
                      </div>
                      
                      {loadingReport ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
                          <div className="w-6 h-6 border-2 border-[#F06C84] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-500 font-medium">Memuat data...</span>
                        </div>
                      ) : topSakit.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center py-10 bg-white/50 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-xs text-gray-500 italic">Tidak ada siswa Sakit</p>
                        </div>
                      ) : (
                        <div className="space-y-4 flex-1">
                          {topSakit.map((item, index) => (
                            <div key={item.siswaId} className="bg-white p-3.5 rounded-2xl border border-gray-100/80 shadow-xs flex flex-col gap-2.5 hover:shadow-sm hover:border-gray-200 transition-all duration-200">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border shrink-0 mt-0.5 ${
                                    index === 0 ? 'bg-amber-100 border-amber-200 text-amber-800 font-extrabold' :
                                    index === 1 ? 'bg-slate-100 border-slate-200 text-slate-800' :
                                    index === 2 ? 'bg-orange-100 border-orange-200 text-orange-800' :
                                    'bg-gray-50 border-gray-100 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 text-xs break-words leading-tight">{item.namaSiswa}</p>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">Kelas {item.kelas}</p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-amber-50 text-[#F06C84] border border-amber-100 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ml-1">
                                  {item.sakit} Hari
                                </span>
                              </div>
                              
                              {/* Date History Tags */}
                              {item.sakitDates && item.sakitDates.length > 0 && (
                                <div className="pt-2 border-t border-gray-100/60 flex flex-col gap-1.5">
                                  <span className="text-[9px] font-bold text-[#F06C84]/90 uppercase tracking-wider flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#F06C84]" /> Riwayat Tanggal Sakit:
                                  </span>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin pr-1">
                                    {item.sakitDates.map((d, dIdx) => (
                                      <button key={dIdx} onClick={() => { setActiveTab('Presensi Siswa'); setPreselectKelas(item.kelas); }} className="bg-amber-50/70 text-amber-800 border border-amber-200/40 px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-amber-100 transition-colors">
                                        {formatIndonesianDate(d)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Izin */}
                    <div className="bg-blue-50/20 border border-blue-100/70 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-blue-100 text-[#F06C84] rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">Izin Terbanyak</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kategori Izin</p>
                        </div>
                      </div>
                      
                      {loadingReport ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
                          <div className="w-6 h-6 border-2 border-[#F06C84] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-500 font-medium">Memuat data...</span>
                        </div>
                      ) : topIzin.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center py-10 bg-white/50 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-xs text-gray-500 italic">Tidak ada siswa Izin</p>
                        </div>
                      ) : (
                        <div className="space-y-4 flex-1">
                          {topIzin.map((item, index) => (
                            <div key={item.siswaId} className="bg-white p-3.5 rounded-2xl border border-gray-100/80 shadow-xs flex flex-col gap-2.5 hover:shadow-sm hover:border-gray-200 transition-all duration-200">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border shrink-0 mt-0.5 ${
                                    index === 0 ? 'bg-amber-100 border-amber-200 text-amber-800 font-extrabold' :
                                    index === 1 ? 'bg-slate-100 border-slate-200 text-slate-800' :
                                    index === 2 ? 'bg-orange-100 border-orange-200 text-orange-800' :
                                    'bg-gray-50 border-gray-100 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 text-xs break-words leading-tight">{item.namaSiswa}</p>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">Kelas {item.kelas}</p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-blue-50 text-[#F06C84] border border-blue-100 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ml-1">
                                  {item.izin} Hari
                                </span>
                              </div>
                              
                              {/* Date History Tags */}
                              {item.izinDates && item.izinDates.length > 0 && (
                                <div className="pt-2 border-t border-gray-100/60 flex flex-col gap-1.5">
                                  <span className="text-[9px] font-bold text-[#F06C84]/90 uppercase tracking-wider flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#F06C84]" /> Riwayat Tanggal Izin:
                                  </span>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin pr-1">
                                    {item.izinDates.map((d, dIdx) => (
                                      <button key={dIdx} onClick={() => { setActiveTab('Presensi Siswa'); setPreselectKelas(item.kelas); }} className="bg-blue-50/70 text-blue-800 border border-blue-200/40 px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-blue-100 transition-colors">
                                        {formatIndonesianDate(d)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Alpa */}
                    <div className="bg-red-50/20 border border-red-100/70 p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-red-100 text-[#F06C84] rounded-xl">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">Alpa Terbanyak</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kategori Alpa</p>
                        </div>
                      </div>
                      
                      {loadingReport ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
                          <div className="w-6 h-6 border-2 border-[#F06C84] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-500 font-medium">Memuat data...</span>
                        </div>
                      ) : topAlpa.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center py-10 bg-white/50 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-xs text-gray-500 italic">Tidak ada siswa Alpa</p>
                        </div>
                      ) : (
                        <div className="space-y-4 flex-1">
                          {topAlpa.map((item, index) => (
                            <div key={item.siswaId} className="bg-white p-3.5 rounded-2xl border border-gray-100/80 shadow-xs flex flex-col gap-2.5 hover:shadow-sm hover:border-gray-200 transition-all duration-200">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center border shrink-0 mt-0.5 ${
                                    index === 0 ? 'bg-amber-100 border-amber-200 text-amber-800 font-extrabold' :
                                    index === 1 ? 'bg-slate-100 border-slate-200 text-slate-800' :
                                    index === 2 ? 'bg-orange-100 border-orange-200 text-orange-800' :
                                    'bg-gray-50 border-gray-100 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-gray-900 text-xs break-words leading-tight">{item.namaSiswa}</p>
                                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">Kelas {item.kelas}</p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-red-50 text-[#F06C84] border border-red-100 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ml-1">
                                  {item.alpa} Hari
                                </span>
                              </div>
                              
                              {/* Date History Tags */}
                              {item.alpaDates && item.alpaDates.length > 0 && (
                                <div className="pt-2 border-t border-gray-100/60 flex flex-col gap-1.5">
                                  <span className="text-[9px] font-bold text-[#F06C84]/90 uppercase tracking-wider flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#F06C84]" /> Riwayat Tanggal Alpa:
                                  </span>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin pr-1">
                                    {item.alpaDates.map((d, dIdx) => (
                                      <button key={dIdx} onClick={() => { setActiveTab('Presensi Siswa'); setPreselectKelas(item.kelas); }} className="bg-red-50/70 text-red-800 border border-red-200/40 px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors">
                                        {formatIndonesianDate(d)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Frame Rekapitulasi Kelas (Tugas) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-6">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <GraduationCap className="w-6 h-6 text-[#F06C84]" />
                        Laporan Pengerjaan Tugas Per Kelas
                      </h3>
                      <p className="text-sm text-gray-500 font-medium mt-1">
                        Persentase siswa yang belum memiliki nilai / belum mengumpulkan tugas
                      </p>
                    </div>
                  </div>

                  {loadingTaskStats ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-8 h-8 border-4 border-[#F06C84] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500 font-bold">Memuat data tugas...</span>
                    </div>
                  ) : taskStats.length === 0 ? (
                    <div className="flex items-center justify-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                      <p className="text-sm text-gray-500 font-medium">Belum ada data tugas untuk ditampilkan.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {taskStats.map((stat, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-4 hover:shadow-md hover:border-gray-200 transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-lg">Kelas {stat.kelas}</h4>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                              stat.percentage > 50 ? 'bg-red-50 text-[#F06C84] border border-red-100' :
                              stat.percentage > 20 ? 'bg-amber-50 text-[#F06C84] border border-amber-100' :
                              'bg-green-50 text-[#F06C84] border border-green-100'
                            }`}>
                              {stat.percentage}% Kosong
                            </span>
                          </div>
                          
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-500 ${
                                stat.percentage > 50 ? 'bg-[#F06C84]' :
                                stat.percentage > 20 ? 'bg-[#F06C84]' :
                                'bg-[#F06C84]'
                              }`}
                              style={{ width: `${stat.percentage}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500 font-medium mt-1">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> Total Siswa: {stat.totalSiswa}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" /> Belum Tugas: {stat.siswaBelumTugas}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {activeTab === 'Data Siswa & Kelas' && (
              <DataSiswaKelas />
            )}

            {activeTab === 'Presensi Siswa' && (
              <AbsensiSiswa initialKelas={preselectKelas || undefined} />
            )}

            {activeTab === 'Kalender Pendidikan' && (
              <KalenderPendidikan />
            )}

            {activeTab === 'Nilai Siswa' && (
              <NilaiSiswa />
            )}

            {activeTab === 'Jadwal Mengajar' && (
              <JadwalMengajar />
            )}

            {activeTab === 'Buku Agenda Guru' && (
              <BukuAgendaGuru />
            )}

            {activeTab === 'Modul Ajar' && (
              <ModulAjar />
            )}

            {activeTab === 'Literasi Guru' && (
              <LiterasiGuru />
            )}

            {activeTab === 'Notifikasi Web Push' && (
              <WebPushSettings />
            )}

            {activeTab === 'Pengguna' && (
              <UserProfile />
            )}


            {/* Branding Footer */}
            <footer className="py-6 border-t border-gray-200 text-gray-500">
              <div className="text-center text-xs space-y-1">
                <p className="font-semibold text-gray-800">App Development by <span className="text-[#F06C84]">Adeliasari Kusuma Wardani</span></p>
                <p className="italic text-[10px] text-gray-600">Kreativitas Tanpa Batas • Inovasi Tiada Henti</p>
                <p className="text-[9px] leading-tight italic text-gray-600">"Transformasi Digital Pendidikan Untuk Generasi Emas yang Cerdas dan Berakhlak"</p>
                <div className="flex justify-center gap-1.5 text-[8px] font-mono mt-2 text-gray-500">
                  <span>V2.1.0</span>
                  <span>•</span>
                  <span>ENTERPRISE</span>
                  <span>•</span>
                  <span>STABLE</span>
                </div>
              </div>
            </footer>

          </div>
        </div>
      </main>
      <ScheduleReminderListener />
    </div>
  );
}

