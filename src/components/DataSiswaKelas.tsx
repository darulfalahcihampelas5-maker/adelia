import React, { useState, useEffect } from 'react';
import { Upload, Plus, Save, FileSpreadsheet, Trash2, Check, AlertCircle, X, Users, Pencil, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, db, updateDoc } from '../lib/firebase';
import * as XLSX from 'xlsx';

interface Kelas {
  id: string;
  namaKelas: string;
}

interface Siswa {
  id: string;
  namaSiswa: string;
  nisn: string;
  kelas: string;
}

export default function DataSiswaKelas() {
  const [namaSiswa, setNamaSiswa] = useState('');
  const [nisn, setNisn] = useState('');
  const [kelas, setKelas] = useState('');
  const [inputKelas, setInputKelas] = useState('');
  const [isKelasDropdownOpen, setIsKelasDropdownOpen] = useState(false);
  const [isEditKelasDropdownOpen, setIsEditKelasDropdownOpen] = useState(false);
  
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [editedNamaKelas, setEditedNamaKelas] = useState('');

  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null);
  const [editedNamaSiswa, setEditedNamaSiswa] = useState('');
  const [editedNisnSiswa, setEditedNisnSiswa] = useState('');
  const [editedKelasSiswa, setEditedKelasSiswa] = useState('');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const kelasQuery = query(collection(db, 'kelas'), orderBy('createdAt', 'asc'));
      const kelasSnapshot = await getDocs(kelasQuery);
      setKelasList(kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas)).sort((a, b) => {
        const namaA = a.namaKelas || "";
        const namaB = b.namaKelas || "";
        return namaA.localeCompare(namaB, undefined, { numeric: true, sensitivity: 'base' });
      }));

      const siswaQuery = query(collection(db, 'siswa'), orderBy('createdAt', 'asc'));
      const siswaSnapshot = await getDocs(siswaQuery);
      setSiswaList(siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa)));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setExcelFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);
        
        if (data.length === 0) {
          showNotification("File Excel kosong atau tidak terbaca", "error");
          return;
        }

        const formattedData = data.map((row) => {
          const keys = Object.keys(row);
          const namaKey = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '').includes('nama') || k.toLowerCase() === 'siswa');
          const nisnKey = keys.find(k => k.toLowerCase().includes('nisn') || k.toLowerCase().includes('nis'));
          const kelasKey = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '').includes('kelas'));
          
          return {
            namaSiswa: namaKey ? String(row[namaKey]).trim() : '',
            nisn: nisnKey ? String(row[nisnKey]).trim() : '',
            kelas: kelasKey ? String(row[kelasKey]).trim() : '',
          };
        }).filter(item => item.namaSiswa !== '');

        if (formattedData.length === 0) {
          showNotification("Kolom nama tidak ditemukan atau data kosong. Pastikan ada kolom berisi kata 'nama' atau 'namaSiswa'.", "error");
          return;
        }

        setExcelPreview(formattedData);
        setShowExcelModal(true);
        e.target.value = '';
      } catch (err) {
        console.error("Error reading excel:", err);
        showNotification("Gagal membaca file Excel. Silakan periksa kembali format file.", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveExcelData = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (excelPreview.length === 0) return;
    setImportingExcel(true);
    setLoading(true);
    try {
      const uniqueExcelKelas = Array.from(new Set(
        excelPreview
          .map(item => item.kelas)
          .filter(k => k !== '')
      )) as string[];

      const kelasQuery = query(collection(db, 'kelas'));
      const kelasSnapshot = await getDocs(kelasQuery);
      const existingKelasNames = kelasSnapshot.docs.map(doc => String(doc.data().namaKelas || '').trim().toLowerCase());

      for (const kelasName of uniqueExcelKelas) {
        if (!existingKelasNames.includes(kelasName.toLowerCase())) {
          await addDoc(collection(db, 'kelas'), {
            namaKelas: kelasName,
            createdAt: serverTimestamp()
          });
          existingKelasNames.push(kelasName.toLowerCase());
        }
      }

      const promises = excelPreview.map(async (siswa) => {
        const sKelas = siswa.kelas || kelas || (kelasList[0]?.namaKelas || 'Umum');
        
        return addDoc(collection(db, 'siswa'), {
          namaSiswa: siswa.namaSiswa,
          nisn: siswa.nisn || '-',
          kelas: sKelas,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(promises);
      
      showNotification(`Berhasil mengimport ${excelPreview.length} data siswa dari Excel!`, 'success');
      setShowExcelModal(false);
      setExcelPreview([]);
      fetchData();
    } catch (error) {
      console.error("Error importing excel data:", error);
      showNotification("Gagal menyimpan data siswa dari Excel.", 'error');
    } finally {
      setImportingExcel(false);
      setLoading(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'kelas' | 'siswa';
    title: string;
    message: string;
  } | null>(null);

  const handleSimpanKelas = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inputKelas.trim()) return;
    
    // Duplication check (case-insensitive)
    const isDuplicate = kelasList.some(
      (k) => k.namaKelas.trim().toLowerCase() === inputKelas.trim().toLowerCase()
    );

    if (isDuplicate) {
      showNotification(`Gagal: Kelas "${inputKelas}" sudah ada!`, 'error');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'kelas'), {
        namaKelas: inputKelas,
        createdAt: serverTimestamp()
      });
      const savedKelas = inputKelas;
      setInputKelas('');
      showNotification(`Kelas "${savedKelas}" berhasil disimpan!`, 'success');
      fetchData();
    } catch (error) {
      console.error("Error saving kelas:", error);
      showNotification("Gagal menyimpan kelas. Pastikan anda sudah login.", 'error');
    }
    setLoading(false);
  };

  const handleSimpanSiswa = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!namaSiswa.trim() || !nisn.trim() || !kelas.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'siswa'), {
        namaSiswa,
        nisn,
        kelas,
        createdAt: serverTimestamp()
      });
      const savedSiswa = namaSiswa;
      setNamaSiswa('');
      setNisn('');
      setKelas('');
      showNotification(`Data siswa "${savedSiswa}" berhasil disimpan!`, 'success');
      fetchData();
    } catch (error) {
      console.error("Error saving siswa:", error);
      showNotification("Gagal menyimpan siswa. Pastikan anda sudah login.", 'error');
    }
    setLoading(false);
  };

  const initiateDeleteSiswa = (id: string, nama: string) => {
    setDeleteConfirm({
      id,
      type: 'siswa',
      title: 'Hapus Data Siswa',
      message: `Apakah Anda yakin ingin menghapus data siswa "${nama}" secara permanen? Tindakan ini tidak dapat dibatalkan.`
    });
  };

  const initiateDeleteKelas = (id: string, nama: string) => {
    // Check if there are students in this class
    const studentCount = siswaList.filter(s => s.kelas === nama).length;
    let message = `Apakah Anda yakin ingin menghapus kelas "${nama}" secara permanen?`;
    if (studentCount > 0) {
      message += ` Peringatan: Ada ${studentCount} siswa di kelas ini yang akan kehilangan referensi kelas mereka.`;
    }
    setDeleteConfirm({
      id,
      type: 'kelas',
      title: 'Hapus Kelas',
      message
    });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    setLoading(true);
    try {
      if (type === 'siswa') {
        const siswaObj = siswaList.find(s => s.id === id);
        const nama = siswaObj ? siswaObj.namaSiswa : '';
        await deleteDoc(doc(db, 'siswa', id));
        showNotification(`Siswa "${nama}" berhasil dihapus.`, 'success');
      } else {
        const kelasObj = kelasList.find(k => k.id === id);
        const nama = kelasObj ? kelasObj.namaKelas : '';
        await deleteDoc(doc(db, 'kelas', id));
        showNotification(`Kelas "${nama}" berhasil dihapus.`, 'success');
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting document:", error);
      showNotification("Gagal menghapus data. Pastikan Anda memiliki akses.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditKelas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKelas || !editedNamaKelas.trim()) return;
    
    const originalNama = editingKelas.namaKelas;
    const newNama = editedNamaKelas.trim();

    if (originalNama.toLowerCase() === newNama.toLowerCase()) {
      setEditingKelas(null);
      return;
    }

    const isDuplicate = kelasList.some(
      (k) => k.id !== editingKelas.id && k.namaKelas.trim().toLowerCase() === newNama.toLowerCase()
    );

    if (isDuplicate) {
      showNotification(`Gagal: Kelas "${newNama}" sudah ada!`, 'error');
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'kelas', editingKelas.id), {
        namaKelas: newNama,
        updatedAt: serverTimestamp()
      });

      const affectedStudents = siswaList.filter(s => s.kelas === originalNama);
      const updatePromises = affectedStudents.map(s => 
        updateDoc(doc(db, 'siswa', s.id), {
          kelas: newNama,
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(updatePromises);

      showNotification(`Kelas "${originalNama}" berhasil diubah menjadi "${newNama}"!`, 'success');
      setEditingKelas(null);
      fetchData();
    } catch (error) {
      console.error("Error updating kelas:", error);
      showNotification("Gagal mengubah kelas.", 'error');
    }
    setLoading(false);
  };

  const handleSaveEditSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSiswa || !editedNamaSiswa.trim() || !editedNisnSiswa.trim() || !editedKelasSiswa.trim()) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'siswa', editingSiswa.id), {
        namaSiswa: editedNamaSiswa.trim(),
        nisn: editedNisnSiswa.trim(),
        kelas: editedKelasSiswa.trim(),
        updatedAt: serverTimestamp()
      });

      showNotification(`Data siswa "${editedNamaSiswa}" berhasil diperbarui!`, 'success');
      setEditingSiswa(null);
      fetchData();
    } catch (error) {
      console.error("Error updating siswa:", error);
      showNotification("Gagal memperbarui data siswa.", 'error');
    }
    setLoading(false);
  };

  return (
    <>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-md max-w-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-[#F06C84]/10'
                : 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-500/10'
            }`}
          >
            {notification.type === 'success' ? (
              <div className="bg-emerald-100 p-1.5 rounded-full text-[#F06C84]">
                <Check className="w-5 h-5 shrink-0" />
              </div>
            ) : (
              <div className="bg-rose-100 p-1.5 rounded-full text-rose-600">
                <AlertCircle className="w-5 h-5 shrink-0" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {notification.type === 'success' ? 'Berhasil' : 'Kesalahan'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 font-medium leading-relaxed">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Data Siswa & Kelas</h2>
          <p className="text-sm text-gray-500 mt-1">Kelola data master siswa dan kelas untuk absensi.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Input Kelas */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1 h-fit">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
            <div className="bg-blue-50 p-2 rounded-lg text-[#F06C84]">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900">Input Kelas</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Kelas</label>
              <input 
                type="text" 
                value={inputKelas}
                onChange={(e) => setInputKelas(e.target.value)}
                placeholder="Misal: VII-A" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
              />
            </div>
            <button 
              type="button"
              onClick={handleSimpanKelas}
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-[#F06C84] hover:bg-[#F06C84] text-white py-3 rounded-xl font-semibold transition-colors shadow-md shadow-[#F06C84]/30 disabled:opacity-50">
              <Save className="w-4 h-4" />
              Simpan Kelas
            </button>
          </div>
        </div>

        {/* Form Input Siswa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
            <div className="bg-green-50 p-2 rounded-lg text-[#F06C84]">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900">Input Siswa Baru</h3>
          </div>

          <div className="mb-6">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleExcelUpload} 
              className="hidden" 
              id="excel-file-input" 
            />
            <div 
              onClick={() => document.getElementById('excel-file-input')?.click()}
              className="w-full flex justify-center items-center gap-2 bg-[#F06C84] hover:bg-[#F06C84] text-white py-3 rounded-xl font-semibold transition-all shadow-md shadow-[#F06C84]/20 cursor-pointer text-center text-sm"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Import Excel (.xlsx, .xls, .csv)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Siswa</label>
              <input 
                type="text" 
                value={namaSiswa}
                onChange={(e) => setNamaSiswa(e.target.value)}
                placeholder="Masukkan nama lengkap siswa" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">NIS</label>
              <input 
                type="text" 
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder="Nomor Induk Siswa" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kelas</label>
              <button
                type="button"
                onClick={() => setIsKelasDropdownOpen(!isKelasDropdownOpen)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
              >
                <span className={kelas ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                  {kelas || '-- Pilih Kelas --'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isKelasDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isKelasDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsKelasDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 max-h-60 overflow-y-auto"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setKelas("");
                          setIsKelasDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          kelas === "" 
                            ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>-- Pilih Kelas --</span>
                        {kelas === "" && <Check className="w-4 h-4 text-[#F06C84]" />}
                      </button>
                      
                      {kelasList.map((k) => {
                        const isSelected = kelas === k.namaKelas;
                        return (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => {
                              setKelas(k.namaKelas);
                              setIsKelasDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected 
                                ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full transition-transform ${
                                isSelected ? 'bg-[#F06C84] scale-125' : 'bg-gray-300'
                              }`} />
                              <span>{k.namaKelas}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="sm:col-span-2 mt-4 pt-4 border-t border-gray-100">
              <button 
                type="button"
                onClick={handleSimpanSiswa}
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 bg-[#F06C84] hover:bg-[#F06C84] text-white py-3 rounded-xl font-semibold transition-colors shadow-md shadow-[#F06C84]/30 disabled:opacity-50">
                <Save className="w-5 h-5" />
                Simpan Data Siswa
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Daftar Kelas - 4-Column Responsive Layout */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">Daftar Kelas</h3>
        {kelasList.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">Belum ada kelas</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {kelasList.map((k) => {
              const count = siswaList.filter(s => s.kelas === k.namaKelas).length;
              return (
                <div key={k.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100/50 hover:shadow-xs transition-all duration-200">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm">{k.namaKelas}</span>
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1.5">
                      <Users className="w-3.5 h-3.5 text-[#F06C84]" />
                      {count} siswa
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingKelas(k);
                        setEditedNamaKelas(k.namaKelas);
                      }} 
                      className="text-gray-400 hover:text-[#F06C84] hover:bg-rose-50 p-2 rounded-xl transition-all"
                      title="Edit Kelas"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => initiateDeleteKelas(k.id, k.namaKelas)} 
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daftar Siswa - Full-Width Layout */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="font-bold text-gray-900 mb-4">Daftar Siswa</h3>
        <div className="overflow-auto max-h-[450px] border border-gray-100 rounded-xl relative scrollbar-thin">
          <table className="w-full text-left text-sm text-gray-500 border-collapse">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr>
                <th className="px-4 py-3 bg-gray-50">Nama</th>
                <th className="px-4 py-3 bg-gray-50">NIS</th>
                <th className="px-4 py-3 bg-gray-50">Kelas</th>
                <th className="px-4 py-3 bg-gray-50 w-16">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {siswaList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Belum ada data siswa</td>
                </tr>
              ) : (
                siswaList.map((s) => (
                  <tr key={s.id} className="bg-white border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.namaSiswa}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.nisn}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">{s.kelas}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingSiswa(s);
                            setEditedNamaSiswa(s.namaSiswa);
                            setEditedNisnSiswa(s.nisn);
                            setEditedKelasSiswa(s.kelas);
                          }} 
                          className="text-gray-400 hover:text-[#F06C84] p-1 transition-colors"
                          title="Edit Siswa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => initiateDeleteSiswa(s.id, s.namaSiswa)} 
                          className="text-red-500 hover:text-red-600 p-1 transition-colors"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>

    {/* Custom Confirmation Modal */}
    <AnimatePresence>
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteConfirm(null)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-gray-100 z-10 overflow-hidden"
          >
            {/* Elegant warning icon header background effect */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-rose-50 rounded-full shrink-0 -z-10" />
            
            <div className="flex gap-4">
              <div className="bg-rose-100 text-rose-600 p-3 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">{deleteConfirm.title}</h3>
                <p className="text-sm text-gray-500 mt-2 font-medium leading-relaxed">{deleteConfirm.message}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-sm text-gray-600 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={executeDelete}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? 'Menghapus...' : 'Hapus Sekarang'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExcelModal(false)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-2xl p-6 rounded-3xl shadow-2xl border border-gray-100 z-10 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-emerald-50 rounded-full shrink-0 -z-10" />
            
            <div className="flex gap-4 items-start pb-4 border-b border-gray-100">
              <div className="bg-emerald-100 text-[#F06C84] p-3 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">Preview Import Excel</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium truncate">File: {excelFileName}</p>
              </div>
              <button 
                onClick={() => setShowExcelModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {/* Kotak Pesan Informasi Keberhasilan Mengambil Data dari Excel */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
                <div className="p-2 bg-emerald-100 rounded-xl text-[#F06C84]">
                  <Check className="w-5 h-5 shrink-0 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-950">
                    Siswa Berhasil Diekstrak!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 font-medium">
                    Sistem berhasil memproses file Excel <strong className="font-semibold">{excelFileName}</strong>.
                  </p>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-900 bg-white/60 p-3 rounded-xl border border-emerald-100/80">
                    <div>
                      <p className="text-gray-500 uppercase font-bold tracking-wider text-[9px]">Total Siswa</p>
                      <p className="font-bold text-sm text-emerald-950 mt-0.5">{excelPreview.length} Siswa</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase font-bold tracking-wider text-[9px]">Kelas Terdeteksi</p>
                      <p className="font-bold text-sm text-emerald-950 mt-0.5 truncate">
                        {Array.from(new Set(excelPreview.map(item => item.kelas).filter(Boolean))).length || 1} Kelas
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Preview */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tabel Preview Data ({excelPreview.length} baris)</p>
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-gray-500 border-collapse">
                    <thead className="bg-gray-50 text-gray-700 uppercase sticky top-0 font-bold">
                      <tr>
                        <th className="px-3 py-2 bg-gray-50 w-10">No</th>
                        <th className="px-3 py-2 bg-gray-50">Nama Siswa</th>
                        <th className="px-3 py-2 bg-gray-50">NIS</th>
                        <th className="px-3 py-2 bg-gray-50">Kelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {excelPreview.map((item, idx) => (
                        <tr key={idx} className="bg-white hover:bg-gray-50/50">
                          <td className="px-3 py-2 text-gray-400 font-mono text-center">{idx + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{item.namaSiswa}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{item.nisn || '-'}</td>
                          <td className="px-3 py-2 font-medium">
                            <span className="bg-blue-50 text-[#F06C84] px-2 py-0.5 rounded border border-blue-100">
                              {item.kelas || 'Otomatis'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowExcelModal(false)}
                disabled={importingExcel}
                className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-sm text-gray-600 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveExcelData}
                disabled={importingExcel}
                className="px-5 py-2.5 rounded-xl bg-[#F06C84] hover:bg-[#F06C84] text-white font-semibold text-sm shadow-lg shadow-[#F06C84]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {importingExcel ? 'Mengimport...' : 'Simpan Semua Ke Database'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Kelas Modal */}
      {editingKelas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingKelas(null)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-gray-100 z-10 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-rose-50/50 rounded-full shrink-0 -z-10" />
            
            <div className="flex gap-4">
              <div className="bg-rose-50 text-[#F06C84] p-3 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0">
                <Pencil className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">Edit Nama Kelas</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Mengubah nama kelas juga akan memperbarui informasi kelas pada seluruh siswa yang terdaftar di kelas ini.
                </p>
                
                <form onSubmit={handleSaveEditKelas} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Kelas Baru</label>
                    <input 
                      type="text" 
                      required
                      value={editedNamaKelas}
                      onChange={(e) => setEditedNamaKelas(e.target.value)}
                      placeholder="Misal: VII-A" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingKelas(null)}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-sm text-gray-600 transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !editedNamaKelas.trim() || editedNamaKelas.trim() === editingKelas.namaKelas}
                      className="px-5 py-2.5 rounded-xl bg-[#F06C84] hover:bg-[#F06C84]/95 text-white font-semibold text-sm shadow-lg shadow-[#F06C84]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Siswa Modal */}
      {editingSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingSiswa(null)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-gray-100 z-10 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-green-50/50 rounded-full shrink-0 -z-10" />
            
            <div className="flex gap-4">
              <div className="bg-green-50 text-[#F06C84] p-3 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0">
                <Pencil className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">Edit Data Siswa</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Perbarui informasi profil atau kelas untuk siswa ini.
                </p>
                
                <form onSubmit={handleSaveEditSiswa} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Siswa</label>
                    <input 
                      type="text" 
                      required
                      value={editedNamaSiswa}
                      onChange={(e) => setEditedNamaSiswa(e.target.value)}
                      placeholder="Nama lengkap siswa" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">NIS</label>
                    <input 
                      type="text" 
                      required
                      value={editedNisnSiswa}
                      onChange={(e) => setEditedNisnSiswa(e.target.value)}
                      placeholder="NIS" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kelas</label>
                    <button
                      type="button"
                      onClick={() => setIsEditKelasDropdownOpen(!isEditKelasDropdownOpen)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
                    >
                      <span className={editedKelasSiswa ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                        {editedKelasSiswa || '-- Pilih Kelas --'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isEditKelasDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isEditKelasDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsEditKelasDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 max-h-60 overflow-y-auto"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setEditedKelasSiswa("");
                                setIsEditKelasDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                editedKelasSiswa === "" 
                                  ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span>-- Pilih Kelas --</span>
                              {editedKelasSiswa === "" && <Check className="w-4 h-4 text-[#F06C84]" />}
                            </button>
                            
                            {kelasList.map((k) => {
                              const isSelected = editedKelasSiswa === k.namaKelas;
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => {
                                    setEditedKelasSiswa(k.namaKelas);
                                    setIsEditKelasDropdownOpen(false);
                                  }}
                                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected 
                                      ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`w-2 h-2 rounded-full transition-transform ${
                                      isSelected ? 'bg-[#F06C84] scale-125' : 'bg-gray-300'
                                    }`} />
                                    <span>{k.namaKelas}</span>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                                </button>
                              );
                            })}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSiswa(null)}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold text-sm text-gray-600 transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !editedNamaSiswa.trim() || !editedNisnSiswa.trim() || !editedKelasSiswa}
                      className="px-5 py-2.5 rounded-xl bg-[#F06C84] hover:bg-[#F06C84]/95 text-white font-semibold text-sm shadow-lg shadow-[#F06C84]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
