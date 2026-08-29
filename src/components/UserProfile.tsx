import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { User, Camera, Trash2, RefreshCw, Sparkles, Layers, Fingerprint, Zap } from "lucide-react";
import { db, collection, getDocs, deleteDoc, doc, getDoc, setDoc } from "../lib/firebase";

const VALID_RESET_PASSWORDS = [
  "123adelia#",
  "123adelia",
  "123adeliasari#",
  "123adeliasari",
  "password123",
  "guruCerdas2026",
  "guru123"
];

export default function UserProfile() {
  const [nama, setNama] = useState("Adeliasari Kusuma Wardani, S.Pd.");
  const [jabatan, setJabatan] = useState("Guru Kelas");
  const [tentang, setTentang] = useState(
    "Guru yang berdedikasi dalam meningkatkan kualitas pendidikan dan inovasi pembelajaran di SMP Negeri 1 Cililin.",
  );
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [nipGuru, setNipGuru] = useState("");
  const [namaKepala, setNamaKepala] = useState("");
  const [nipKepala, setNipKepala] = useState("");
  const [namaSekolah, setNamaSekolah] = useState("");
  const [semester, setSemester] = useState("");
  const [tahunPelajaran, setTahunPelajaran] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // 4D Interactive Avatar States & Handlers
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [effectMode, setEffectMode] = useState<'4d' | 'classic'>('4d');
  const [hologramColor, setHologramColor] = useState<'pink' | 'emerald' | 'gold' | 'neon'>('pink');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (effectMode !== '4d') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    
    setTilt({
      x: mouseX * 28, // Max tilt angle on Y-axis (rotates horizontally)
      y: -mouseY * 28 // Max tilt angle on X-axis (rotates vertically)
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (effectMode !== '4d') return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const touchX = (touch.clientX - rect.left) / rect.width - 0.5;
      const touchY = (touch.clientY - rect.top) / rect.height - 0.5;
      
      const clampedX = Math.max(-0.5, Math.min(0.5, touchX));
      const clampedY = Math.max(-0.5, Math.min(0.5, touchY));
      
      setTilt({
        x: clampedX * 30,
        y: -clampedY * 30
      });
    }
  };

  const resetTilt = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const getHoloStyle = () => {
    if (effectMode !== '4d') return {};
    const shineX = tilt.x * 2.5;
    const shineY = -tilt.y * 2.5;
    let gradient = '';
    
    if (hologramColor === 'pink') {
      gradient = `linear-gradient(${135 + tilt.x * 1.5}deg, rgba(240, 108, 132, 0.45) 0%, rgba(255, 255, 255, 0) 50%, rgba(139, 92, 246, 0.45) 100%)`;
    } else if (hologramColor === 'emerald') {
      gradient = `linear-gradient(${135 + tilt.x * 1.5}deg, rgba(52, 211, 153, 0.45) 0%, rgba(255, 255, 255, 0) 50%, rgba(59, 130, 246, 0.45) 100%)`;
    } else if (hologramColor === 'gold') {
      gradient = `linear-gradient(${135 + tilt.x * 1.5}deg, rgba(251, 191, 36, 0.45) 0%, rgba(255, 255, 255, 0) 50%, rgba(239, 68, 68, 0.45) 100%)`;
    } else {
      gradient = `linear-gradient(${135 + tilt.x * 1.5}deg, rgba(6, 182, 212, 0.45) 0%, rgba(255, 255, 255, 0) 50%, rgba(236, 72, 153, 0.45) 100%)`;
    }

    return {
      backgroundImage: gradient,
      transform: `translate3d(${shineX}px, ${shineY}px, 40px)`,
      mixBlendMode: 'color-dodge' as const,
    };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, "user_profile", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNama(data.nama || "");
          setJabatan(data.jabatan || "");
          setTentang(data.tentang || "");
          setProfilePic(data.profilePic || null);
          setNipGuru(data.nipGuru || "");
          setNamaKepala(data.namaKepala || "");
          setNipKepala(data.nipKepala || "");
          setNamaSekolah(data.namaSekolah || "");
          setSemester(data.semester || "");
          setTahunPelajaran(data.tahunPelajaran || "");
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "user_profile", "main"), {
        nama,
        jabatan,
        tentang,
        profilePic,
        nipGuru,
        namaKepala,
        nipKepala,
        namaSekolah,
        semester,
        tahunPelajaran,
      });
      setIsEditing(false);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (e) {
      console.error("Error saving profile:", e);
      alert("Gagal menyimpan profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const [showResetSemua, setShowResetSemua] = useState(false);
  const [showResetTahun, setShowResetTahun] = useState(false);
  const [showResetSemester, setShowResetSemester] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetMessage, setResetMessage] = useState("");
  const [resetTahunConfirmWord, setResetTahunConfirmWord] = useState("");
  const [resetTahunPassword, setResetTahunPassword] = useState("");
  const [resetSemuaConfirmWord, setResetSemuaConfirmWord] = useState("");
  const [resetSemuaPassword, setResetSemuaPassword] = useState("");
  const [resetSemesterConfirmWord, setResetSemesterConfirmWord] = useState("");
  const [resetSemesterPassword, setResetSemesterPassword] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 400;
          const maxHeight = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          setProfilePic(canvas.toDataURL("image/jpeg", 0.7));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const executeReset = async (
    collections: string[],
    successMessage: string,
  ) => {
    setIsResetting(true);
    setResetProgress(0);
    setResetMessage("Menghitung data...");
    try {
      let totalDocs = 0;
      const collectionSnapshots = await Promise.all(
        collections.map((col) => getDocs(collection(db, col))),
      );

      collectionSnapshots.forEach((snap) => {
        totalDocs += snap.size;
      });

      if (totalDocs === 0) {
        setResetProgress(100);
        setResetMessage(successMessage);
        setTimeout(() => {
          alert(successMessage);
          setIsResetting(false);
          setShowResetSemua(false);
          setShowResetTahun(false);
          setShowResetSemester(false);
          setResetSemuaConfirmWord("");
          setResetSemuaPassword("");
          setResetTahunConfirmWord("");
          setResetTahunPassword("");
          setResetSemesterConfirmWord("");
          setResetSemesterPassword("");
        }, 500);
        return;
      }

      let deletedDocs = 0;
      setResetMessage("Menghapus data...");

      const deletePromises: Promise<void>[] = [];
      for (const snap of collectionSnapshots) {
        for (const docSnap of snap.docs) {
          deletePromises.push(
            deleteDoc(docSnap.ref).then(() => {
              deletedDocs++;
              setResetProgress(Math.round((deletedDocs / totalDocs) * 100));
            }),
          );
        }
      }
      await Promise.all(deletePromises);

      setResetProgress(100);
      setResetMessage(successMessage);
      setTimeout(() => {
        alert(successMessage);
        setIsResetting(false);
        setShowResetSemua(false);
        setShowResetTahun(false);
        setResetSemuaConfirmWord("");
        setResetSemuaPassword("");
        setResetTahunConfirmWord("");
        setResetTahunPassword("");
      }, 500);
    } catch (error) {
      console.error("Error resetting data:", error);
      alert("Gagal mereset data.");
      setIsResetting(false);
      setShowResetSemua(false);
      setShowResetTahun(false);
      setShowResetSemester(false);
      setResetSemuaConfirmWord("");
      setResetSemuaPassword("");
      setResetTahunConfirmWord("");
      setResetTahunPassword("");
      setResetSemesterConfirmWord("");
      setResetSemesterPassword("");
    }
  };

  const handleResetSemua = async () => {
    const collections = [
      "modul_ajar",
      "absensi",
      "kelas",
      "siswa",
      "program_semester",
      "program_tahunan",
      "jadwal_mengajar",
      "buku_agenda",
      "kalender_pendidikan",
      "nilai",
    ];
    await executeReset(collections, "Hapus Berhasil!");
  };

  const handleResetTahunAjaran = async () => {
    const collections = [
      "absensi",
      "kelas",
      "siswa",
      "jadwal_mengajar",
      "buku_agenda",
      "nilai",
    ];
    await executeReset(collections, "Reset Berhasil!");
  };

  const handleResetSemesterBaru = async () => {
    const collections = [
      "absensi",
      "buku_agenda",
      "nilai",
    ];
    await executeReset(collections, "Reset Berhasil!");
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-gray-800">Profil Pengguna</h2>

       <div className="flex flex-col items-center gap-6">
        {/* Upgraded 3D Interactive Avatar Container */}
        <div className="flex flex-col items-center gap-4 w-full">
          <div 
            className="relative cursor-pointer select-none py-4"
            style={{ perspective: '1200px' }}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={resetTilt}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={resetTilt}
          >
            {/* 3D Moving Container */}
            <motion.div
              style={{
                transformStyle: 'preserve-3d',
                rotateX: effectMode === '4d' ? tilt.y : 0,
                rotateY: effectMode === '4d' ? tilt.x : 0,
                scale: isHovered ? 1.12 : 1,
              }}
              animate={{
                rotateX: effectMode === '4d' ? tilt.y : 0,
                rotateY: effectMode === '4d' ? tilt.x : 0,
                scale: isHovered ? 1.12 : 1,
                boxShadow: isHovered 
                  ? hologramColor === 'pink' ? "0 45px 60px -15px rgba(240, 108, 132, 0.35), 0 25px 35px -20px rgba(0, 0, 0, 0.2)" :
                    hologramColor === 'emerald' ? "0 45px 60px -15px rgba(16, 185, 129, 0.35), 0 25px 35px -20px rgba(0, 0, 0, 0.2)" :
                    hologramColor === 'gold' ? "0 45px 60px -15px rgba(245, 158, 11, 0.35), 0 25px 35px -20px rgba(0, 0, 0, 0.2)" :
                    "0 45px 60px -15px rgba(6, 182, 212, 0.35), 0 25px 35px -20px rgba(0, 0, 0, 0.2)"
                  : "0 15px 25px -10px rgba(0, 0, 0, 0.1), 0 5px 10px -5px rgba(0, 0, 0, 0.05)",
              }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 18,
                mass: 0.4
              }}
              className="relative w-48 h-48 rounded-[32px] bg-gradient-to-tr from-gray-100 to-white p-3 border border-gray-200/60 flex items-center justify-center overflow-visible"
            >
              {/* Layer 1: True Depth Shadow (moves in opposite direction to reinforce 3D parallax) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute inset-2 rounded-3xl opacity-40 blur-xl pointer-events-none transition-all duration-300"
                  style={{
                    background: hologramColor === 'pink' ? '#F06C84' :
                                hologramColor === 'emerald' ? '#10B981' :
                                hologramColor === 'gold' ? '#F59E0B' :
                                '#06B6D4',
                    transform: isHovered 
                      ? `translate3d(${-tilt.x * 1.2}px, ${-tilt.y * 1.2}px, -50px) scale(1.05)` 
                      : `translate3d(${-tilt.x * 0.8}px, ${-tilt.y * 0.8}px, -40px) scale(0.95)`,
                    filter: isHovered ? 'blur(28px)' : 'blur(20px)',
                  }}
                />
              )}

              {/* Layer 2: Deep Background Holographic Grid (-25px) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute inset-3 rounded-2xl opacity-20 pointer-events-none overflow-hidden"
                  style={{
                    transform: 'translateZ(-25px)',
                    backgroundImage: `radial-gradient(circle, ${
                      hologramColor === 'pink' ? '#F06C84' :
                      hologramColor === 'emerald' ? '#10B981' :
                      hologramColor === 'gold' ? '#F59E0B' :
                      '#06B6D4'
                    } 1.5px, transparent 1.5px)`,
                    backgroundSize: '12px 12px'
                  }}
                />
              )}

              {/* Layer 3: Rotating Outer Cyberpunk Ring (-10px) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute inset-0 rounded-[32px] opacity-60 pointer-events-none animate-[spin_12s_linear_infinite]"
                  style={{
                    border: hologramColor === 'pink' ? '2.5px dashed rgba(240, 108, 132, 0.7)' :
                            hologramColor === 'emerald' ? '2.5px dashed rgba(16, 185, 129, 0.7)' :
                            hologramColor === 'gold' ? '2.5px dashed rgba(245, 158, 11, 0.7)' :
                            '2.5px dashed rgba(6, 182, 212, 0.7)',
                    transform: isHovered ? 'translateZ(-10px) scale(1.10)' : 'translateZ(-10px) scale(1.06)',
                    transition: 'transform 0.3s ease',
                  }}
                />
              )}

              {/* Layer 4: Deep Aura Glow Background (-5px) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute inset-2 rounded-2xl opacity-40 blur-lg pointer-events-none transition-all duration-300"
                  style={{
                    background: hologramColor === 'pink' ? 'radial-gradient(circle, rgba(240, 108, 132, 0.6) 0%, transparent 80%)' :
                                hologramColor === 'emerald' ? 'radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, transparent 80%)' :
                                hologramColor === 'gold' ? 'radial-gradient(circle, rgba(245, 158, 11, 0.6) 0%, transparent 80%)' :
                                'radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 80%)',
                    transform: isHovered ? 'translateZ(-5px) scale(1.08)' : 'translateZ(-5px)',
                  }}
                />
              )}

              {/* Layer 5: Inner Profile Picture Frame (Elevated with elastic pop-out to +60px) */}
              <div 
                className="w-full h-full rounded-[24px] bg-white overflow-hidden flex items-center justify-center relative border-2 border-white transition-all duration-300 ease-out"
                style={{ 
                  transform: effectMode === '4d' ? (isHovered ? 'translateZ(60px) scale(1.05)' : 'translateZ(35px)') : 'none',
                  transformStyle: 'preserve-3d',
                  boxShadow: isHovered 
                    ? hologramColor === 'pink' ? '0 25px 35px -10px rgba(240, 108, 132, 0.4), 0 15px 20px -12px rgba(0, 0, 0, 0.2)' :
                      hologramColor === 'emerald' ? '0 25px 35px -10px rgba(16, 185, 129, 0.4), 0 15px 20px -12px rgba(0, 0, 0, 0.2)' :
                      hologramColor === 'gold' ? '0 25px 35px -10px rgba(245, 158, 11, 0.4), 0 15px 20px -12px rgba(0, 0, 0, 0.2)' :
                      '0 25px 35px -10px rgba(6, 182, 212, 0.4), 0 15px 20px -12px rgba(0, 0, 0, 0.2)'
                    : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                }}
              >
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-300 scale-105"
                  />
                ) : (
                  <User className="w-20 h-20 text-gray-300" />
                )}

                {/* Layer 6: Dynamic Glass Glare Reflection Overlay (+80px) */}
                {effectMode === '4d' && (
                  <div 
                    className="absolute inset-0 transition-opacity duration-200 pointer-events-none"
                    style={{
                      ...getHoloStyle(),
                      transform: isHovered ? 'translateZ(80px) scale(1.04)' : 'translateZ(60px) scale(1.02)',
                    }}
                  />
                )}
              </div>

              {/* Layer 7: Stereoscopic Translucent Glass Badge (+100px - floats high with pop-out shadow) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute -bottom-3 -right-3 px-3.5 py-2 bg-white/95 backdrop-blur-xl rounded-2xl border border-white/60 flex items-center gap-1.5 select-none text-[11px] font-black tracking-wider uppercase transition-all duration-300 ease-out"
                  style={{ 
                    transform: isHovered ? 'translateZ(105px) scale(1.05)' : 'translateZ(90px)',
                    color: hologramColor === 'pink' ? '#F06C84' :
                           hologramColor === 'emerald' ? '#10B981' :
                           hologramColor === 'gold' ? '#D97706' :
                           '#0891B2',
                    boxShadow: isHovered 
                      ? '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.15)' 
                      : '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
                  }}
                >
                  <Sparkles className="w-4 h-4 animate-spin-slow text-amber-400" />
                  GURU 3D
                </div>
              )}

              {/* Layer 8: Floating Frontmost Tech Accent Icon (+125px) */}
              {effectMode === '4d' && (
                <div 
                  className="absolute -top-3 -left-3 p-2 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl flex items-center justify-center transition-all duration-300 ease-out border border-gray-700/50"
                  style={{ 
                    transform: isHovered ? 'translateZ(125px) scale(1.15) rotate(12deg)' : 'translateZ(110px)',
                    boxShadow: isHovered 
                      ? '0 25px 30px -5px rgba(0,0,0,0.45)' 
                      : '0 20px 25px -5px rgba(0,0,0,0.25)'
                  }}
                >
                  <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
              )}
            </motion.div>

            {/* Upload Button */}
            <label className={`absolute -bottom-4 left-1/2 -translate-x-1/2 p-2.5 bg-[#F06C84] hover:bg-[#d8556d] text-white rounded-full cursor-pointer shadow-xl transition-all z-20 hover:scale-110 active:scale-95 ${!isEditing ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
              <Camera className="w-5 h-5" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                disabled={!isEditing}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* 3D Interaction Guide */}
          <div className="text-center mt-3">
            <p className="text-xs font-bold text-gray-400 flex items-center justify-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-[#F06C84]" />
              {effectMode === '4d' 
                ? 'Gerakkan mouse / sentuh & geser foto untuk melihat efek 3D nyata!'
                : 'Mode Klasik Aktif'}
            </p>
          </div>

          {/* Interactive 3D Settings Panel */}
          <div className="w-full max-w-sm mt-1 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3.5">
            {/* Toggle Mode */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#F06C84]" />
                Tipe Tampilan
              </span>
              <div className="flex bg-white rounded-lg p-0.5 border border-gray-200">
                <button
                  onClick={() => setEffectMode('4d')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    effectMode === '4d' 
                      ? 'bg-[#F06C84] text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Hologram 3D
                </button>
                <button
                  onClick={() => setEffectMode('classic')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    effectMode === 'classic' 
                      ? 'bg-gray-600 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Klasik 2D
                </button>
              </div>
            </div>

            {/* Aura Picker if 3D is Active */}
            {effectMode === '4d' && (
              <div className="space-y-1.5 pt-1.5 border-t border-gray-200/60">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">
                  Pilih Aura & Pantulan Kaca 3D
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setHologramColor('pink')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      hologramColor === 'pink' 
                        ? 'bg-rose-50 text-[#F06C84] border-[#F06C84]' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Pink Nebula
                  </button>
                  <button
                    onClick={() => setHologramColor('emerald')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      hologramColor === 'emerald' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-500' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Emerald Cyber
                  </button>
                  <button
                    onClick={() => setHologramColor('gold')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      hologramColor === 'gold' 
                        ? 'bg-amber-50 text-amber-600 border-amber-500' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Gold Cyber
                  </button>
                  <button
                    onClick={() => setHologramColor('neon')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      hologramColor === 'neon' 
                        ? 'bg-cyan-50 text-cyan-600 border-cyan-500' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Cosmic Cyan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Sekolah
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={namaSekolah}
              onChange={(e) => setNamaSekolah(e.target.value)}
              placeholder="Masukkan Nama Sekolah (contoh: SMP Negeri 1 Cililin)"
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NIP Guru Mapel
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={nipGuru}
              onChange={(e) => setNipGuru(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Guru Mata Pelajaran
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Kepala Sekolah
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={namaKepala}
              onChange={(e) => setNamaKepala(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NIP Kepala Sekolah
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={nipKepala}
              onChange={(e) => setNipKepala(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester
              </label>
              <select
                disabled={!isEditing}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Pilih Semester</option>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tahun Pelajaran
              </label>
              <input
                type="text"
                disabled={!isEditing}
                value={tahunPelajaran}
                onChange={(e) => setTahunPelajaran(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="2026/2027"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tentang Pengguna
            </label>
            <textarea
              disabled={!isEditing}
              value={tentang}
              onChange={(e) => setTentang(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84] outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        <div className="w-full mb-8">
          {isEditing ? (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-[#F06C84] text-white py-3 rounded-xl font-bold hover:bg-[#F06C84] transition-all shadow-md shadow-blue-200 disabled:bg-gray-400"
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </motion.button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-gray-600 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition-all shadow-md"
            >
              Edit Data
            </button>
          )}
        </div>

        {/* Danger Zone */}
        <div className="w-full pt-8 border-t border-gray-200">
          <h3 className="text-lg font-bold text-[#F06C84] mb-4">
            Pengaturan Lanjutan (Zona Berbahaya)
          </h3>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowResetTahun(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-100 text-[#F06C84] py-3 rounded-xl font-bold hover:bg-amber-200 transition-all border border-amber-200"
            >
              <RefreshCw size={18} />
              Reset Tahun Ajaran Baru
            </button>
            <p className="text-xs text-gray-500 text-center mb-2">
              Menghapus data Siswa, Kelas, Absensi, Jadwal, dan Buku Agenda.
              (Modul, Program, & Kalender dipertahankan)
            </p>

            <button
              onClick={() => setShowResetSemester(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-100 text-[#F06C84] py-3 rounded-xl font-bold hover:bg-blue-200 transition-all border border-blue-200"
            >
              <RefreshCw size={18} />
              Reset Semester Baru
            </button>
            <p className="text-xs text-gray-500 text-center mb-2">
              Menghapus data Absensi, Buku Agenda, dan Nilai.
              (Siswa, Kelas, Jadwal, Modul, Program, & Kalender dipertahankan)
            </p>

            <button
              onClick={() => setShowResetSemua(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-100 text-[#F06C84] py-3 rounded-xl font-bold hover:bg-red-200 transition-all border border-red-200"
            >
              <Trash2 size={18} />
              Reset Semua Data
            </button>
            <p className="text-xs text-gray-500 text-center">
              Menghapus <b>semua</b> data aplikasi secara permanen tanpa
              terkecuali.
            </p>
          </div>
        </div>
      </div>

      {showResetTahun && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Reset Tahun Ajaran Baru
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin mereset data tahun ajaran baru? Data
              Siswa, Kelas, Absensi, Jadwal, dan Buku Agenda akan dihapus
              permanen. Modul Ajar, Program (Tahunan/Semester), dan Kalender
              Pendidikan akan tetap ada.
            </p>

            <div className="space-y-4 mb-6">
              {isResetting ? (
                <div className="py-4">
                  <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                    <span>{resetMessage}</span>
                    <span>{resetProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-[#F06C84] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${resetProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Ketik "reset" untuk konfirmasi
                    </label>
                    <input
                      type="text"
                      value={resetTahunConfirmWord}
                      onChange={(e) => setResetTahunConfirmWord(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="reset"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Password Anda
                    </label>
                    <input
                      type="password"
                      value={resetTahunPassword}
                      onChange={(e) => setResetTahunPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="Masukkan password admin"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetTahun(false);
                  setResetTahunConfirmWord("");
                  setResetTahunPassword("");
                }}
                disabled={isResetting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleResetTahunAjaran}
                disabled={
                  resetTahunConfirmWord.trim().toLowerCase() !== "reset" ||
                  !VALID_RESET_PASSWORDS.includes(resetTahunPassword.trim()) ||
                  isResetting
                }
                className="flex-1 py-3 bg-[#F06C84] text-white font-bold rounded-xl hover:bg-[#F06C84] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? "Memproses..." : "Reset Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetSemester && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Reset Semester Baru
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin mereset data semester baru? Data
              Absensi, Buku Agenda, dan Nilai akan dihapus.
            </p>

            <div className="space-y-4 mb-6">
              {isResetting ? (
                <div className="py-4">
                  <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                    <span>{resetMessage}</span>
                    <span>{resetProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-[#F06C84] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${resetProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Ketik "reset" untuk konfirmasi
                    </label>
                    <input
                      type="text"
                      value={resetSemesterConfirmWord}
                      onChange={(e) => setResetSemesterConfirmWord(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="reset"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Password Anda
                    </label>
                    <input
                      type="password"
                      value={resetSemesterPassword}
                      onChange={(e) => setResetSemesterPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="Masukkan password admin"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetSemester(false);
                  setResetSemesterConfirmWord("");
                  setResetSemesterPassword("");
                }}
                disabled={isResetting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleResetSemesterBaru}
                disabled={
                  resetSemesterConfirmWord.trim().toLowerCase() !== "reset" ||
                  !VALID_RESET_PASSWORDS.includes(resetSemesterPassword.trim()) ||
                  isResetting
                }
                className="flex-1 py-3 bg-[#F06C84] text-white font-bold rounded-xl hover:bg-[#F06C84] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? "Memproses..." : "Reset Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetSemua && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-[#F06C84] mb-2">
              PERINGATAN: Reset Semua Data
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin MENGHAPUS SEMUA DATA? Tindakan ini tidak
              dapat dibatalkan dan semua data (termasuk modul, program, dan
              kalender) akan hilang secara permanen.
            </p>

            <div className="space-y-4 mb-6">
              {isResetting ? (
                <div className="py-4">
                  <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                    <span>{resetMessage}</span>
                    <span>{resetProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-[#F06C84] h-3 rounded-full transition-all duration-300"
                      style={{ width: `${resetProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Ketik "hapus" untuk konfirmasi
                    </label>
                    <input
                      type="text"
                      value={resetSemuaConfirmWord}
                      onChange={(e) => setResetSemuaConfirmWord(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="hapus"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Password Anda
                    </label>
                    <input
                      type="password"
                      value={resetSemuaPassword}
                      onChange={(e) => setResetSemuaPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] outline-none transition-all"
                      placeholder="Masukkan password admin"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetSemua(false);
                  setResetSemuaConfirmWord("");
                  setResetSemuaPassword("");
                }}
                disabled={isResetting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleResetSemua}
                disabled={
                  resetSemuaConfirmWord.trim().toLowerCase() !== "hapus" ||
                  !VALID_RESET_PASSWORDS.includes(resetSemuaPassword.trim()) ||
                  isResetting
                }
                className="flex-1 py-3 bg-[#F06C84] text-white font-bold rounded-xl hover:bg-[#F06C84] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? "Memproses..." : "Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessMessage && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-green-100 text-[#F06C84] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Berhasil</h3>
            <p className="text-gray-600">Data Berhasil Disimpan</p>
          </div>
        </div>
      )}
    </div>
  );
}
