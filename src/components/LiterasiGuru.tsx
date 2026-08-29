import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from '../lib/firebase';
import { BookOpen, Plus, Trash2, Edit, ExternalLink, Save, CheckCircle, Clock, AlertCircle, X, Search, GraduationCap, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Literasi {
  id: string;
  babMateri: string;
  namaMateri: string;
  linkDrive: string;
  status: 'Selesai Dipelajari' | 'Sedang Dipelajari' | 'Belum Dipelajari';
}

export default function LiterasiGuru() {
  const [literasiList, setLiterasiList] = useState<Literasi[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

  // Form State
  const [babMateri, setBabMateri] = useState('');
  const [namaMateri, setNamaMateri] = useState('');
  const [linkDrive, setLinkDrive] = useState('');
  const [status, setStatus] = useState<'Selesai Dipelajari' | 'Sedang Dipelajari' | 'Belum Dipelajari'>('Belum Dipelajari');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLiterasi = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'literasi_guru'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Literasi));
      setLiterasiList(list);
    } catch (error) {
      console.error("Error fetching literasi:", error);
      setErrorMsg("Gagal memuat data literasi guru.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiterasi();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babMateri.trim() || !namaMateri.trim() || !linkDrive.trim()) {
      setErrorMsg("Semua kolom harus diisi!");
      return;
    }

    // Basic URL validation
    let formattedLink = linkDrive.trim();
    if (!/^https?:\/\//i.test(formattedLink)) {
      formattedLink = 'https://' + formattedLink;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update
        const docRef = doc(db, 'literasi_guru', editingId);
        await updateDoc(docRef, {
          babMateri: babMateri.trim(),
          namaMateri: namaMateri.trim(),
          linkDrive: formattedLink,
          status,
          updatedAt: serverTimestamp()
        });
        setSuccessMsg("Materi literasi berhasil diperbarui!");
        setEditingId(null);
      } else {
        // Create
        await addDoc(collection(db, 'literasi_guru'), {
          babMateri: babMateri.trim(),
          namaMateri: namaMateri.trim(),
          linkDrive: formattedLink,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setSuccessMsg("Materi literasi baru berhasil ditambahkan!");
      }

      // Reset Form
      setBabMateri('');
      setNamaMateri('');
      setLinkDrive('');
      setStatus('Belum Dipelajari');
      setErrorMsg('');

      // Refresh
      fetchLiterasi();

      // Clear success message
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error saving literasi:", error);
      setErrorMsg("Gagal menyimpan data literasi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Literasi) => {
    setEditingId(item.id);
    setBabMateri(item.babMateri);
    setNamaMateri(item.namaMateri);
    setLinkDrive(item.linkDrive);
    setStatus(item.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setBabMateri('');
    setNamaMateri('');
    setLinkDrive('');
    setStatus('Belum Dipelajari');
  };

  const initiateDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'literasi_guru', deleteId));
      setSuccessMsg("Materi literasi berhasil dihapus!");
      setDeleteId(null);
      setDeleteName('');
      fetchLiterasi();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error deleting literasi:", error);
      setErrorMsg("Gagal menghapus materi literasi.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Status Toggle directly in the table
  const handleToggleStatus = async (item: Literasi) => {
    const nextStatusMap: Record<string, 'Belum Dipelajari' | 'Sedang Dipelajari' | 'Selesai Dipelajari'> = {
      'Belum Dipelajari': 'Sedang Dipelajari',
      'Sedang Dipelajari': 'Selesai Dipelajari',
      'Selesai Dipelajari': 'Belum Dipelajari'
    };
    const nextStatus = nextStatusMap[item.status] || 'Belum Dipelajari';
    
    try {
      await updateDoc(doc(db, 'literasi_guru', item.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      fetchLiterasi();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filteredList = literasiList.filter(item => {
    const matchesSearch = 
      item.babMateri.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaMateri.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Semua' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6">
      {/* Alert Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Form on left/top, Table list on right/bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Card */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-4"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2.5 bg-rose-50 text-[#F06C84] rounded-xl">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">
                  {editingId ? "Edit Literasi Guru" : "Tambah Literasi Baru"}
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {editingId ? "Perbarui materi referensi Anda" : "Unggah link bab pembelajaran pendukung"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Bab Materi</label>
                <input
                  type="text"
                  required
                  value={babMateri}
                  onChange={(e) => setBabMateri(e.target.value)}
                  placeholder="Misal: Bab 1: Bentuk Aljabar"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Nama Materi</label>
                <input
                  type="text"
                  required
                  value={namaMateri}
                  onChange={(e) => setNamaMateri(e.target.value)}
                  placeholder="Misal: Penjumlahan & Pengurangan Aljabar"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Link Google Drive Materi</label>
                <input
                  type="text"
                  required
                  value={linkDrive}
                  onChange={(e) => setLinkDrive(e.target.value)}
                  placeholder="drive.google.com/... atau link referensi"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-sm text-blue-600 font-medium"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Status Pembelajaran</label>
                <button
                  type="button"
                  onClick={() => setIsStatusOpen(!isStatusOpen)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-sm font-semibold text-gray-800 flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/50 transition-colors"
                >
                  <span>{status}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isStatusOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isStatusOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsStatusOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1 overflow-hidden"
                      >
                        {[
                          'Belum Dipelajari',
                          'Sedang Dipelajari',
                          'Selesai Dipelajari'
                        ].map((s) => {
                          const isSelected = status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setStatus(s as any);
                                setIsStatusOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                isSelected 
                                  ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <span>{s}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all text-xs"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-3 py-3 px-4 bg-[#F06C84] hover:bg-[#F06C84]/95 text-white font-bold rounded-xl shadow-lg shadow-[#F06C84]/15 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? "Simpan Perubahan" : "Simpan Materi"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Table & List Card */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
          >
            {/* Table Header Filter & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                  <GraduationCap className="text-[#F06C84]" />
                  Daftar Literasi Referensi Guru
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Kumpulan materi ajar, e-book, dan literatur pendukung guru untuk proses KBM.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari materi..."
                    className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F06C84]/10 focus:border-[#F06C84] bg-gray-50/50 w-full sm:w-48"
                  />
                </div>

                {/* Status filter Custom Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none bg-gray-50 font-semibold text-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-100/60 transition-colors"
                  >
                    <span>{statusFilter === 'Semua' ? 'Semua Status' : statusFilter}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isStatusFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isStatusFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsStatusFilterOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 z-50 overflow-hidden"
                        >
                          {[
                            { value: 'Semua', label: 'Semua Status' },
                            { value: 'Belum Dipelajari', label: 'Belum Dipelajari' },
                            { value: 'Sedang Dipelajari', label: 'Sedang Dipelajari' },
                            { value: 'Selesai Dipelajari', label: 'Selesai Dipelajari' }
                          ].map((item) => {
                            const isSelected = statusFilter === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                  setStatusFilter(item.value);
                                  setIsStatusFilterOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                                  isSelected ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span>{item.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto mt-6">
              {loading && literasiList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-4 border-[#F06C84] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500 font-bold">Memuat data literasi...</span>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-gray-50 border border-dashed border-gray-200 rounded-3xl text-center p-6">
                  <BookOpen className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-700">Materi Literasi Tidak Ditemukan</p>
                  <p className="text-xs text-gray-500 max-w-sm mt-1">
                    Belum ada materi literasi yang sesuai dengan pencarian Anda. Silakan tambahkan materi literasi baru menggunakan form di samping.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-4 px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-12 text-center whitespace-nowrap">No</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Bab Materi</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nama Materi</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Aksi</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                      <th className="py-4 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center whitespace-nowrap">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredList.map((item, index) => {
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-3 text-center text-xs font-bold text-gray-400 whitespace-nowrap">{index + 1}</td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-gray-800 block leading-normal">{item.babMateri}</span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-600 block leading-normal">{item.namaMateri}</span>
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <a
                              href={item.linkDrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 transition-colors cursor-pointer"
                              title="Buka Referensi Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Lihat Materi</span>
                            </a>
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all inline-flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                                item.status === 'Selesai Dipelajari'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : item.status === 'Sedang Dipelajari'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-gray-50 text-gray-500 border-gray-100'
                              }`}
                              title="Klik untuk mengubah status cepat"
                            >
                              {item.status === 'Selesai Dipelajari' && <CheckCircle className="w-3 h-3 shrink-0" />}
                              {item.status === 'Sedang Dipelajari' && <Clock className="w-3 h-3 shrink-0" />}
                              {item.status === 'Belum Dipelajari' && <AlertCircle className="w-3 h-3 shrink-0" />}
                              <span>{item.status}</span>
                            </button>
                          </td>
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Materi"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => initiateDelete(item.id, item.namaMateri)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Materi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteId(null)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full z-10 text-center space-y-4"
          >
            <div className="mx-auto bg-red-50 text-[#F06C84] p-3 rounded-full w-12 h-12 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-gray-900 text-base">Konfirmasi Hapus</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus materi <span className="font-bold text-gray-800">"{deleteName}"</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-500/15"
              >
                Hapus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
