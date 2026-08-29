import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, User, Eye, EyeOff, X, Mail, CheckCircle2, AlertCircle, Send, ArrowRight, Lock, Unlock, Copy, Sparkles, ShieldCheck, Rocket, Bell, Info } from 'lucide-react';
import { useState, FormEvent } from 'react';

const CREDENTIALS_DB = [
  { username: 'admin', password: 'password123', email: 'admin@sacilsmart.sch.id', role: 'Administrator Utama' },
  { username: 'adelia', password: '123adelia#', email: 'adelia@sacilsmart.sch.id', role: 'Guru Kelas (Adelia)' },
  { username: 'adeliasari', password: 'guruCerdas2026', email: 'adeliasari@sacilsmart.sch.id', role: 'Guru Kelas (Adeliasari)' },
  { username: 'guru', password: 'guru123', email: 'guru@sacilsmart.sch.id', role: 'Guru Pengajar' },
  { username: 'siswa', password: 'siswa123', email: 'siswa@sacilsmart.sch.id', role: 'Siswa Kelas' }
];

export default function LoginScreen({ onLogin }: { onLogin: () => void, key?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [isNotifyLoading, setIsNotifyLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryType, setRecoveryType] = useState<'password' | 'username'>('password');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveredAccount, setRecoveredAccount] = useState<any | null>(null);
  const [showRecoveredPassword, setShowRecoveredPassword] = useState(false);
  const [showInputPassword, setShowInputPassword] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Instant login trigger to guarantee audio autoplay permission in Chrome/Opera/Huawei
    onLogin();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-white flex flex-col relative overflow-y-auto"
    >
      <div className="flex-1 flex flex-col md:flex-row items-center justify-between px-6 md:px-16 lg:px-24 py-12 gap-12 lg:gap-24 w-full max-w-7xl mx-auto">
        {/* Left Content (Text) */}
        <div className="md:w-1/2 lg:w-3/5 flex flex-col justify-center items-center md:items-start text-center md:text-left relative z-10 w-full pt-8 md:pt-0">
          <div className="flex flex-col items-center md:items-start justify-center w-full mb-6 overflow-visible">
              <h1 className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-[#F06C84] tracking-tight text-center md:text-left w-full mb-3 whitespace-nowrap">SACIL SMART App</h1>
              <h2 className="text-xs md:text-xs lg:text-sm font-bold text-gray-800 leading-tight text-center md:text-justify w-full max-w-lg mt-1">
                Sistem Akademik Cerdas dan Integritas Lokal untuk Siswa Mandiri, Aktif, Responsif, dan Terpuji.
              </h2>
          </div>
          
          <p className="text-gray-600 text-xs md:text-xs lg:text-sm leading-relaxed text-center md:text-justify max-w-xl">
            <span className="font-bold text-[#F06C84]">SACIL SMART App</span> adalah platform digital terintegrasi untuk ekosistem pendidikan. Satu aplikasi untuk manajemen absensi, akses materi pembelajaran, pengumpulan tugas, dan pemantauan perkembangan akademik. Dirancang untuk mewujudkan siswa yang Mandiri, Aktif, Responsif, dan Terpuji dalam ruang belajar yang transparan dan interaktif.
          </p>
        </div>

        {/* Right Content (Form Card) */}
        <div className="md:w-1/2 lg:w-2/5 flex flex-col items-center md:items-end w-full relative z-10">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 sm:p-8 border border-gray-100 relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#F06C84] rounded-t-2xl"></div>
              
              <div className="text-center mb-8 mt-2">
                  <h3 className="text-2xl font-bold text-gray-900">Selamat Datang</h3>
                  <p className="text-sm text-gray-500 mt-2">Silakan masuk ke akun Anda</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                          Username
                      </label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <User className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                              type="text"
                              name="username"
                              autoComplete="username"
                              required
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              className="block w-full pl-10 pr-3 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#F06C84] focus:bg-white transition-all outline-none"
                              placeholder="Masukkan username"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                          Kata Sandi
                      </label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <KeyRound className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                              type={showPassword ? "text" : "password"}
                              name="password"
                              autoComplete="current-password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="block w-full pl-10 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#F06C84] focus:bg-white transition-all outline-none"
                              placeholder="••••••••"
                          />
                          <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                      </div>
                  </div>

                  <div className="pt-4">
                      <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-[#F06C84] hover:bg-[#F06C84] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F06C84] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                          {isLoading ? 'Memproses...' : 'Masuk Ke Sistem'}
                      </button>
                  </div>
                  
                  <div className="text-center mt-4">
                      <button
                          type="button"
                          onClick={() => {
                              setRecoveryType('password');
                              setRecoveryInput('');
                              setRecoveryResult(null);
                              setRecoveryError(null);
                              setIsRecoveryOpen(true);
                          }}
                          className="text-sm font-bold text-[#F06C84] hover:underline cursor-pointer bg-transparent border-none outline-none"
                      >
                          Lupa username / password?
                      </button>
                  </div>

                  <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Atau
                          </span>
                      </div>
                  </div>

                  <div>
                      <button
                          type="button"
                          onClick={() => setIsComingSoonOpen(true)}
                          className="w-full flex justify-center py-3.5 px-4 border border-[#F06C84] rounded-xl text-sm font-bold text-[#F06C84] bg-white hover:bg-rose-50/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F06C84] transition-all cursor-pointer"
                      >
                          Buat Akun Baru
                      </button>
                  </div>
              </form>
          </div>
        </div>
      </div>
      
      {/* Footer Text */}
      <div className="w-full py-6 mt-auto text-center text-gray-500 bg-white">
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
      </div>

      {/* Elegant & Luxurious Password/Username Recovery Modal */}
      <AnimatePresence>
        {isRecoveryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRecoveryOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_60px_-15px_rgba(240,108,132,0.25)] border border-rose-100/50 relative flex flex-col z-10"
            >
              {/* Top Rose-Gold/Champagne Gradient Accent */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#F06C84] via-[#f7889e] to-[#ffb3c1]"></div>

              {/* Luxurious Header */}
              <div className="bg-gradient-to-b from-[#F06C84]/5 to-transparent px-6 pt-8 pb-4 text-center relative">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-all outline-none"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-[#F06C84] to-[#f47f96] rounded-2xl flex items-center justify-center mb-4 shadow-md shadow-[#F06C84]/20 border border-white/25">
                  {recoveryType === 'password' ? (
                    <KeyRound className="w-6 h-6 text-white animate-pulse" />
                  ) : (
                    <User className="w-6 h-6 text-white animate-pulse" />
                  )}
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Pemulihan Kredensial</h3>
                <p className="text-xs text-gray-500 font-semibold mt-1">Dapatkan akses kembali ke akun SACIL SMART Anda</p>
              </div>

              {/* Tab Selector */}
              <div className="flex p-1 bg-gray-50 border border-gray-100 rounded-2xl mx-6 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryType('password');
                    setRecoveryInput('');
                    setRecoveryResult(null);
                    setRecoveryError(null);
                    setRecoveredAccount(null);
                    setShowRecoveredPassword(false);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    recoveryType === 'password'
                      ? 'bg-gradient-to-r from-[#F06C84] to-[#f47f96] text-white shadow-md shadow-[#F06C84]/20'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Lupa Kata Sandi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryType('username');
                    setRecoveryInput('');
                    setRecoveryResult(null);
                    setRecoveryError(null);
                    setRecoveredAccount(null);
                    setShowRecoveredPassword(false);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    recoveryType === 'username'
                      ? 'bg-gradient-to-r from-[#F06C84] to-[#f47f96] text-white shadow-md shadow-[#F06C84]/20'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Lupa Username
                </button>
              </div>

              {/* Main Content Area */}
              <div className="p-6">
                {!recoveryResult ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!recoveryInput.trim()) {
                      setRecoveryError('Kolom input tidak boleh kosong.');
                      return;
                    }

                    setRecoveryError(null);
                    setIsRecoveryLoading(true);

                    setTimeout(() => {
                      setIsRecoveryLoading(false);
                      const inputLower = recoveryInput.trim().toLowerCase();
                      
                      if (recoveryType === 'password') {
                        const found = CREDENTIALS_DB.find(acc => acc.username.toLowerCase() === inputLower);
                        if (found) {
                          setRecoveredAccount(found);
                          setRecoveryResult('success');
                        } else {
                          setRecoveryError(`Username "${recoveryInput}" tidak ditemukan. Silakan gunakan username guru/admin resmi (contoh: "admin" atau "adeliasari").`);
                        }
                      } else {
                        const found = CREDENTIALS_DB.find(acc => acc.password === recoveryInput.trim());
                        if (found) {
                          setRecoveredAccount(found);
                          setRecoveryResult('success');
                        } else {
                          setRecoveryError(`Kata Sandi tidak cocok dengan akun mana pun. Silakan gunakan password guru/admin resmi (contoh: "password123" atau "guruCerdas2026").`);
                        }
                      }
                    }, 1200);
                  }} className="space-y-5">
                    <p className="text-xs text-gray-500 font-semibold leading-relaxed text-center px-2">
                      {recoveryType === 'password'
                        ? 'Harap masukkan Username Anda di bawah ini untuk melihat kata sandi Anda secara langsung.'
                        : 'Harap masukkan Kata Sandi Anda di bawah ini untuk melihat username Anda secara langsung.'}
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {recoveryType === 'password' ? 'Username Terdaftar' : 'Kata Sandi Terdaftar'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          {recoveryType === 'password' ? (
                            <User className="h-5 w-5 text-gray-400" />
                          ) : (
                            <Lock className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <input
                          type={recoveryType === 'password' ? 'text' : (showInputPassword ? 'text' : 'password')}
                          required
                          value={recoveryInput}
                          onChange={(e) => {
                            setRecoveryInput(e.target.value);
                            if (recoveryError) setRecoveryError(null);
                          }}
                          className="block w-full pl-11 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 placeholder:text-gray-400 placeholder:font-medium focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] focus:bg-white transition-all outline-none"
                          placeholder={
                            recoveryType === 'password'
                              ? 'Masukkan username Anda (e.g., adeliasari)'
                              : 'Masukkan kata sandi Anda (e.g., guruCerdas2026)'
                          }
                        />
                        {recoveryType === 'username' && (
                          <button
                            type="button"
                            onClick={() => setShowInputPassword(!showInputPassword)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                          >
                            {showInputPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {recoveryError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 text-xs text-red-500 font-bold bg-red-50 p-3.5 rounded-xl border border-red-100/50"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{recoveryError}</span>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={isRecoveryLoading}
                      className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-[#F06C84] to-[#f47f96] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-[#F06C84]/15 cursor-pointer"
                    >
                      {isRecoveryLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Mencari Data...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Temukan Akun Saya</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Elegant success results screen */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-2"
                  >
                    <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/80 shadow-md">
                      <ShieldCheck className="w-9 h-9 text-emerald-500" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-gray-900 tracking-tight">Data Berhasil Ditemukan!</h4>
                      <p className="text-xs text-gray-500 font-semibold leading-relaxed px-4">
                        Data kecocokan kredensial Anda telah berhasil diidentifikasi.
                      </p>
                    </div>

                    {/* Highly stylized Document-Ticket layout */}
                    <div className="relative border border-dashed border-[#F06C84]/30 bg-gradient-to-b from-rose-50/10 to-rose-50/40 p-5 rounded-2xl text-left overflow-hidden shadow-sm">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-[#F06C84]/5 rounded-full -mr-6 -mt-6 blur-md" />
                      <div className="absolute bottom-0 left-0 w-12 h-12 bg-[#F06C84]/5 rounded-full -ml-4 -mb-4 blur-md" />
                      
                      <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 text-[9px] font-black tracking-widest text-gray-400 uppercase">
                          <span>Detail Akun</span>
                          <span className="text-[#F06C84] bg-[#F06C84]/5 border border-[#F06C84]/10 px-2 py-0.5 rounded-lg font-black tracking-normal uppercase">
                            {recoveredAccount?.role}
                          </span>
                        </div>

                        {/* Username Field */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Username</span>
                          <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-sm font-bold text-gray-800 font-mono">{recoveredAccount?.username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(recoveredAccount?.username || '')}
                              className="text-gray-400 hover:text-[#F06C84] transition-all p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                              title="Salin Username"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Kata Sandi</span>
                          <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-sm font-bold text-gray-800 font-mono">
                              {showRecoveredPassword ? recoveredAccount?.password : '••••••••'}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setShowRecoveredPassword(!showRecoveredPassword)}
                                className="text-gray-400 hover:text-gray-600 transition-all p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                              >
                                {showRecoveredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(recoveredAccount?.password || '')}
                                className="text-gray-400 hover:text-[#F06C84] transition-all p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                                title="Salin Kata Sandi"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Email Details */}
                        {recoveredAccount?.email && (
                          <div className="pt-2.5 border-t border-gray-100/60 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>Email: <span className="font-bold text-gray-700">{recoveredAccount.email}</span></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isCopied && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100/50 inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil disalin ke clipboard!
                      </motion.div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryOpen(false);
                        // Populate login fields for ease of use
                        if (recoveredAccount) {
                          setUsername(recoveredAccount.username);
                          setPassword(recoveredAccount.password);
                        }
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Gunakan & Masuk</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant, Modern & Luxurious Coming Soon Modal */}
      <AnimatePresence>
        {isComingSoonOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsComingSoonOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_60px_-15px_rgba(240,108,132,0.3)] border border-rose-100/50 relative flex flex-col z-10"
            >
              {/* Top Rose-Gold/Champagne Gradient Accent */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#F06C84] via-[#f7889e] to-[#ffb3c1]"></div>

              {/* Luxurious Header & Content */}
              <div className="bg-gradient-to-b from-[#F06C84]/5 to-transparent px-6 pt-10 pb-8 text-center relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setIsComingSoonOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-all outline-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="w-16 h-16 bg-gradient-to-br from-[#F06C84] to-[#f47f96] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-[#F06C84]/25 border border-white/30 relative">
                  <Rocket className="w-8 h-8 text-white animate-bounce" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-400 rounded-full animate-ping" />
                </div>

                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Akan Segera Rilis</h3>
                <p className="text-[#F06C84] text-xs font-extrabold tracking-widest uppercase mt-1">Registrasi Akun Mandiri</p>
                
                <p className="text-xs text-gray-500 font-semibold leading-relaxed mt-4 px-2">
                  Fitur pendaftaran mandiri saat ini sedang dalam pengembangan demi menjamin keamanan data. Sementara waktu, pembuatan akun baru dilayani terpusat oleh <span className="text-gray-800 font-bold">Operator Sekolah</span>.
                </p>

                <div className="w-full mt-6 pt-5 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsComingSoonOpen(false)}
                    className="w-full py-3 px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Baik, Saya Mengerti</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
