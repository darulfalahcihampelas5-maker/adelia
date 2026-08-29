import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc, where, db } from '../lib/firebase';
import { Save, FileSpreadsheet, Download, Table, FileText, Edit2, CheckCircle, XCircle, Trash2, X, ChevronDown, Check } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';
import * as XLSX from 'xlsx';
import { generatePDF } from '../lib/pdfUtils';

interface Siswa {
  id: string;
  namaSiswa: string;
  nisn: string;
  kelas: string;
}

export default function NilaiSiswa() {
  const [viewMode, setViewMode] = useState<'input' | 'preview'>('input');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [kelas, setKelas] = useState('');
  const [judulTugas, setJudulTugas] = useState('');
  const [tempNewTaskTitle, setTempNewTaskTitle] = useState('');
  const [isNewTask, setIsNewTask] = useState(false);
  const [tugasList, setTugasList] = useState<string[]>([]);
  const [kelasList, setKelasList] = useState<{ id: string; namaKelas: string }[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);

  const [isKelasOpen, setIsKelasOpen] = useState(false);
  const [isJudulTugasOpen, setIsJudulTugasOpen] = useState(false);
  const [isPreviewKelasOpen, setIsPreviewKelasOpen] = useState(false);
  const [isPreviewJudulTugasOpen, setIsPreviewJudulTugasOpen] = useState(false);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [allTasksData, setAllTasksData] = useState<Record<string, Record<string, string>>>({});
  const [allTasksDates, setAllTasksDates] = useState<Record<string, string>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editedTaskTitle, setEditedTaskTitle] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [previewNilaiEditState, setPreviewNilaiEditState] = useState<Record<string, Record<string, string>>>({});

  const handleEditTask = async (newTitle: string) => {
    if (!newTitle.trim()) {
      setNotification({ message: "Nama tugas tidak boleh kosong.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const oldTitle = judulTugas;
    if (newTitle === oldTitle) {
      setIsEditingTask(false);
      return;
    }
    if (tugasList.includes(newTitle)) {
      setNotification({ message: "Nama tugas sudah digunakan.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      const newTaskRef = doc(db, 'daftar_tugas', newTitle);
      await setDoc(newTaskRef, {
        judulTugas: newTitle,
        createdAt: new Date().toISOString()
      });

      const oldTaskRef = doc(db, 'daftar_tugas', oldTitle);
      await deleteDoc(oldTaskRef);

      const q = query(collection(db, 'nilai'), where('judulTugas', '==', oldTitle));
      const querySnapshot = await getDocs(q);

      for (const d of querySnapshot.docs) {
        const data = d.data();
        const kelasName = data.kelas;
        const newNilaiRef = doc(db, 'nilai', `${newTitle}_${kelasName}`);
        await setDoc(newNilaiRef, {
          ...data,
          judulTugas: newTitle
        });
        await deleteDoc(doc(db, 'nilai', d.id));
      }

      setTugasList(prev => prev.map(t => t === oldTitle ? newTitle : t));
      
      setAllTasksData(prev => {
        const next = { ...prev };
        if (next[oldTitle]) {
          next[newTitle] = next[oldTitle];
          delete next[oldTitle];
        }
        return next;
      });

      setAllTasksDates(prev => {
        const next = { ...prev };
        if (next[oldTitle]) {
          next[newTitle] = next[oldTitle];
          delete next[oldTitle];
        }
        return next;
      });

      setJudulTugas(newTitle);
      setIsEditingTask(false);
      setNotification({ message: "Nama tugas berhasil diperbarui.", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error editing task title:", error);
      setNotification({ message: "Gagal memperbarui nama tugas.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteTask = async () => {
    const oldTitle = judulTugas;
    try {
      const taskRef = doc(db, 'daftar_tugas', oldTitle);
      await deleteDoc(taskRef);

      const q = query(collection(db, 'nilai'), where('judulTugas', '==', oldTitle));
      const querySnapshot = await getDocs(q);

      for (const d of querySnapshot.docs) {
        await deleteDoc(doc(db, 'nilai', d.id));
      }

      setTugasList(prev => prev.filter(t => t !== oldTitle));
      
      setAllTasksData(prev => {
        const next = { ...prev };
        delete next[oldTitle];
        return next;
      });

      setAllTasksDates(prev => {
        const next = { ...prev };
        delete next[oldTitle];
        return next;
      });

      setJudulTugas('');
      setNilai({});
      setIsSaved(false);
      setIsDeleteConfirmOpen(false);
      setNotification({ message: "Tugas berhasil dihapus.", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error deleting task:", error);
      setNotification({ message: "Gagal menghapus tugas.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchTugasListAndData = async () => {
        try {
            const q = query(collection(db, 'nilai'));
            const snapshot = await getDocs(q);
            const allTasks = new Set<string>(); // Global tasks
            const tasksDataForKelas: Record<string, Record<string, string>> = {};
            const tasksDatesForKelas: Record<string, string> = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.judulTugas) {
                    allTasks.add(data.judulTugas); // Global
                }

                if (kelas && data.kelas === kelas) { // Class-specific
                    tasksDataForKelas[data.judulTugas] = data.nilai || {};
                    tasksDatesForKelas[data.judulTugas] = data.date || '';
                }
            });

            // Also fetch from central 'daftar_tugas' collection
            const qDaftarTugas = query(collection(db, 'daftar_tugas'));
            const snapshotDaftarTugas = await getDocs(qDaftarTugas);
            snapshotDaftarTugas.docs.forEach(doc => {
                const data = doc.data();
                if (data.judulTugas) {
                    allTasks.add(data.judulTugas);
                }
            });

            setTugasList(Array.from(allTasks)); // Set global
            if (kelas) {
                setAllTasksData(tasksDataForKelas);
                setAllTasksDates(tasksDatesForKelas);
            } else {
                setAllTasksData({});
                setAllTasksDates({});
            }
        } catch (error) {
            console.error("Error fetching tasks list and data:", error);
        }
    };
    fetchTugasListAndData();
  }, [kelas]);

  const fetchData = async () => {
    try {
      const kelasQuery = query(collection(db, 'kelas'), orderBy('createdAt', 'asc'));
      const kelasSnapshot = await getDocs(kelasQuery);
      setKelasList(kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      const siswaQuery = query(collection(db, 'siswa'), orderBy('namaSiswa', 'asc'));
      const siswaSnapshot = await getDocs(siswaQuery);
      setSiswaList(siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa)));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const filteredSiswa = kelas === '' ? [] : siswaList.filter(s => s.kelas === kelas);

  const formattedJudulTugas = `${judulTugas || 'Tugas'} - ${new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const handleSave = async () => {
    try {
        if (!judulTugas || !kelas) {
            setNotification({message: "Mohon isi Judul Tugas dan Kelas.", type: 'error'});
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        const nilaiDocRef = doc(db, 'nilai', `${judulTugas}_${kelas}`);
        await setDoc(nilaiDocRef, {
            judulTugas,
            kelas,
            date,
            nilai
        });
        setAllTasksData(prev => ({
            ...prev,
            [judulTugas]: nilai
        }));
        setAllTasksDates(prev => ({
            ...prev,
            [judulTugas]: date
        }));
        setIsSaved(true);
        setNotification({message: "Nilai Berhasil Disimpan!", type: 'success'});
        setTimeout(() => setNotification(null), 3000);
    } catch (error) {
        console.error("Error saving data:", error);
        setNotification({message: "Gagal menyimpan nilai.", type: 'error'});
        setTimeout(() => setNotification(null), 3000);
    }
  };

  useEffect(() => {
    const fetchNilai = async () => {
        if (judulTugas && kelas) {
            const docRef = doc(db, 'nilai', `${judulTugas}_${kelas}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setNilai(docSnap.data().nilai);
                setIsSaved(true);
            } else {
                setNilai({});
                setIsSaved(false);
            }
        }
    };
    fetchNilai();
  }, [judulTugas, kelas]);

  const getPreviewTasks = () => {
    const gradedTasks = tugasList
      .filter(t => allTasksData[t] !== undefined)
      .sort((a, b) => (allTasksDates[a] || '').localeCompare(allTasksDates[b] || ''));
      
    return judulTugas 
      ? (allTasksData[judulTugas] !== undefined ? [judulTugas] : []) 
      : gradedTasks;
  };

  const handleStartEditPreview = () => {
    const clone: Record<string, Record<string, string>> = {};
    getPreviewTasks().forEach(tugas => {
      clone[tugas] = { ...(allTasksData[tugas] || {}) };
    });
    setPreviewNilaiEditState(clone);
    setIsEditingPreview(true);
  };

  const handleSavePreviewChanges = async () => {
    try {
        const tasksToSave = getPreviewTasks();
        if (tasksToSave.length === 0 || !kelas) return;

        for (const tugas of tasksToSave) {
            const currentNilai = previewNilaiEditState[tugas] || {};
            const nilaiDocRef = doc(db, 'nilai', `${tugas}_${kelas}`);
            const existingDate = allTasksDates[tugas] || new Date().toISOString().split('T')[0];
            
            await setDoc(nilaiDocRef, {
                judulTugas: tugas,
                kelas,
                date: existingDate,
                nilai: currentNilai
            });

            setAllTasksData(prev => ({
                ...prev,
                [tugas]: currentNilai
            }));
        }

        setIsEditingPreview(false);
        setNotification({message: "Perubahan nilai berhasil disimpan!", type: 'success'});
        setTimeout(() => setNotification(null), 3000);
    } catch (error) {
        console.error("Error saving preview changes:", error);
        setNotification({message: "Gagal menyimpan perubahan nilai.", type: 'error'});
        setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleExportExcel = () => {
    // If a task is selected, use only that task (if graded), otherwise use the graded list
    const exportTasks = getPreviewTasks();
    
    const data = filteredSiswa.map((s, idx) => {
        const row: any = {
            'No': idx + 1,
            'Nama Siswa': s.namaSiswa,
            'NIS': s.nisn,
            'Kelas': kelas,
        };
        exportTasks.forEach(tugas => {
            const dateStr = allTasksDates[tugas] ? ` (${new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })})` : '';
            row[`${tugas}${dateStr}`] = allTasksData[tugas]?.[s.id] || '-';
        });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths to fit content roughly
    const colWidths = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, ...exportTasks.map(() => ({ wch: 10 }))];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nilai Siswa');
    XLSX.writeFile(wb, `Nilai_Siswa_${kelas || 'Semua'}${judulTugas ? `_${judulTugas}` : ''}.xlsx`);
  };

  const handleExportPDF = async () => {
    // If a task is selected, use only that task (if graded), otherwise use the graded list
    const exportTasks = getPreviewTasks();

    const headerRow1 = ['No', 'Nama Siswa', 'NIS', 'Kelas', ...exportTasks.map(tugas => tugas)];
    const headerRow2 = ['', '', '', '', ...exportTasks.map(tugas => {
        return allTasksDates[tugas] ? `(${new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})` : '';
    })];

    const head = [headerRow1, headerRow2];
    
    const data = filteredSiswa.map((s, idx) => [
        String(idx + 1),
        s.namaSiswa,
        s.nisn,
        kelas,
        ...exportTasks.map(tugas => allTasksData[tugas]?.[s.id] || '-')
    ]);
    
    const profileDoc = await getDoc(doc(db, 'user_profile', 'main'));
    const profileData = profileDoc.exists() ? profileDoc.data() : {};
    
    // Calculate column styles to make Nilai columns narrow
    const columnStyles: any = {};
    headerRow1.forEach((_, idx) => {
        if (idx > 3) {
            columnStyles[idx] = { halign: 'center', cellWidth: 20 }; // Narrow for Nilai
        } else {
            columnStyles[idx] = { halign: 'left' };
        }
    });
    // Override specific columns
    columnStyles[0] = { halign: 'center', cellWidth: 10 }; // No.
    columnStyles[2] = { halign: 'center', cellWidth: 20 }; // NIS
    columnStyles[3] = { halign: 'center', cellWidth: 15 }; // Kelas
    
    await generatePDF(`Nilai_Siswa_${kelas || 'Semua'}${judulTugas ? `_${judulTugas}` : ''}`, head, data, { columnStyles }, {
        namaKepala: profileData.namaKepala,
        nipKepala: profileData.nipKepala,
        namaGuru: profileData.nama,
        nipGuru: profileData.nipGuru,
        jabatan: profileData.jabatan,
        namaSekolah: profileData.namaSekolah,
        location: 'Cililin'
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <AnimatePresence>
      {notification && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4 backdrop-blur-[2px] bg-black/5">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`relative flex items-center gap-4 px-8 py-6 rounded-3xl border shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl pointer-events-auto
            ${notification.type === 'success'
              ? 'bg-white/95 text-slate-800 border-emerald-100 shadow-[#F06C84]/20'
              : 'bg-white/95 text-slate-800 border-rose-100 shadow-rose-500/20'
            }`}
          >
            <div className={`p-3 rounded-full flex-shrink-0
              ${notification.type === 'success' ? 'bg-emerald-100 text-[#F06C84]' : 'bg-rose-100 text-rose-600'}`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <XCircle className="w-8 h-8" />
              )}
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                {notification.type === 'success' ? 'Berhasil' : 'Pemberitahuan'}
              </h3>
              <p className="text-slate-600 font-medium">
                {notification.message}
              </p>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Nilai Siswa</h2>
        <div className="flex gap-2 mt-4">
            <button 
                onClick={() => setViewMode('input')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${viewMode === 'input' ? 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
                <Table className="w-4 h-4" /> Input Nilai
            </button>
            <button 
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${viewMode === 'preview' ? 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
                <FileText className="w-4 h-4" /> Preview Nilai
            </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <AnimatePresence mode="wait">
        {viewMode === 'input' ? (
            <motion.div 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tanggal</label>
                        <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kelas</label>
                        <button
                            type="button"
                            onClick={() => setIsKelasOpen(!isKelasOpen)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-800 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
                        >
                            <span className={kelas ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                                {kelas || '-- Pilih Kelas --'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isKelasOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isKelasOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsKelasOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 max-h-60 overflow-y-auto"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => { setKelas(""); setIsKelasOpen(false); }}
                                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                                kelas === "" ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
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
                                                    onClick={() => { setKelas(k.namaKelas); setIsKelasOpen(false); }}
                                                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                                        isSelected ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span>{k.namaKelas}</span>
                                                    {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Input Judul Tugas Baru</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={tempNewTaskTitle}
                                onChange={(e) => setTempNewTaskTitle(e.target.value)}
                                placeholder="Masukkan judul tugas"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50"
                            />
                             <button
                                onClick={async () => {
                                    if (tempNewTaskTitle && !tugasList.includes(tempNewTaskTitle)) {
                                        try {
                                            const taskRef = doc(db, 'daftar_tugas', tempNewTaskTitle);
                                            await setDoc(taskRef, {
                                                judulTugas: tempNewTaskTitle,
                                                createdAt: new Date().toISOString()
                                            });
                                            setTugasList([...tugasList, tempNewTaskTitle]);
                                            setJudulTugas(tempNewTaskTitle);
                                            setTempNewTaskTitle('');
                                            setNotification({message: "Tugas Baru Berhasil Ditambahkan ke Cloud", type: 'success'});
                                            setTimeout(() => setNotification(null), 3000);
                                        } catch (e) {
                                            console.error("Error saving new task to cloud:", e);
                                            setNotification({message: "Gagal menyimpan tugas baru ke Cloud.", type: 'error'});
                                            setTimeout(() => setNotification(null), 3000);
                                        }
                                    } else if (!tempNewTaskTitle) {
                                        setNotification({message: "Mohon isi judul tugas.", type: 'error'});
                                        setTimeout(() => setNotification(null), 3000);
                                    } else {
                                        setNotification({message: "Tugas sudah ada.", type: 'error'});
                                        setTimeout(() => setNotification(null), 3000);
                                    }
                                }}
                                className="px-4 py-3 bg-[#F06C84] hover:bg-[#d85e75] text-white rounded-xl font-semibold transition-all cursor-pointer"
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Tugas</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <button
                                    type="button"
                                    onClick={() => setIsJudulTugasOpen(!isJudulTugasOpen)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-800 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
                                >
                                    <span className={judulTugas ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                                        {judulTugas || '-- Pilih Tugas --'}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isJudulTugasOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {isJudulTugasOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsJudulTugasOpen(false)} />
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
                                                        setJudulTugas("");
                                                        setIsSaved(false);
                                                        setIsJudulTugasOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                                        judulTugas === "" ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span>-- Pilih Tugas --</span>
                                                    {judulTugas === "" && <Check className="w-4 h-4 text-[#F06C84]" />}
                                                </button>
                                                {tugasList.map((t) => {
                                                    const isSelected = judulTugas === t;
                                                    return (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => {
                                                                if (allTasksData[t]) {
                                                                    setNotification({message: "Judul tugas tersebut sudah digunakan di kelas ini.", type: 'error'});
                                                                    setTimeout(() => setNotification(null), 3000);
                                                                }
                                                                setJudulTugas(t);
                                                                setIsSaved(false);
                                                                setIsJudulTugasOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                                                isSelected ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <span>{t}</span>
                                                            {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                            {judulTugas && (
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setEditedTaskTitle(judulTugas);
                                            setIsEditingTask(true);
                                        }}
                                        className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
                                        title="Edit Nama Tugas"
                                    >
                                        <Edit2 className="w-5 h-5" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                        className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all"
                                        title="Hapus Tugas"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-sm text-gray-500 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-center" style={{ minWidth: '100px' }}>No</th>
                        <th className="px-4 py-3">Nama Siswa</th>
                        <th className="px-4 py-3">NIS</th>
                        <th className="px-4 py-3 text-center" style={{ minWidth: '100px' }}>Nilai</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredSiswa.map((s, idx) => (
                        <tr key={s.id} className="bg-white border-b border-gray-50">
                        <td className="px-4 py-3 font-mono text-center">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.namaSiswa}</td>
                        <td className="px-4 py-3">{s.nisn}</td>
                        <td className="px-4 py-3 text-center">
                            <input 
                            type="number"
                            disabled={isSaved}
                            placeholder="Nilai"
                            className="w-20 px-2 py-1 rounded border border-gray-200 text-center"
                            value={nilai[s.id] || ''}
                            onChange={(e) => setNilai({ ...nilai, [s.id]: e.target.value })}
                            />
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                
                <div className="mt-8 flex flex-col gap-4">
                    <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={handleSave}
                        disabled={isSaved}
                        className={`flex items-center justify-center gap-2 py-2 px-6 rounded-xl font-semibold transition-all duration-300 shadow-lg ${!isSaved ? 'bg-[#F06C84] hover:bg-[#F06C84] text-white shadow-[#F06C84]/30' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Save className="w-4 h-4" />
                        Simpan Nilai
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setIsSaved(false)}
                        className={`flex items-center justify-center gap-2 py-2 px-6 rounded-xl font-semibold transition-all duration-300 border ${isSaved ? 'bg-[#F06C84] hover:bg-[#F06C84] text-white border-[#F06C84] shadow-sm' : 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'}`}
                    >
                        <Edit2 className="w-4 h-4" />
                        Edit Nilai
                    </motion.button>
                </div>
            </motion.div>
        ) : (
            <motion.div 
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
                 <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="relative">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Kelas</label>
                             <button
                                 type="button"
                                 onClick={() => setIsPreviewKelasOpen(!isPreviewKelasOpen)}
                                 className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm font-medium text-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100/40"
                             >
                                 <span className={kelas ? 'font-semibold text-gray-800' : 'text-gray-400'}>
                                     {kelas || '-- Pilih Kelas --'}
                                 </span>
                                 <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isPreviewKelasOpen ? 'rotate-180' : ''}`} />
                             </button>

                             <AnimatePresence>
                                 {isPreviewKelasOpen && (
                                     <>
                                         <div className="fixed inset-0 z-40" onClick={() => setIsPreviewKelasOpen(false)} />
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
                                                     setIsEditingPreview(false);
                                                     setIsPreviewKelasOpen(false);
                                                 }}
                                                 className={`w-full px-4 py-2 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                                     kelas === "" ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                                 }`}
                                             >
                                                 <span>-- Pilih Kelas --</span>
                                                 {kelas === "" && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                             </button>
                                             {kelasList.map((k) => (
                                                 <button
                                                     key={k.id}
                                                     type="button"
                                                     onClick={() => {
                                                         setKelas(k.namaKelas);
                                                         setIsEditingPreview(false);
                                                         setIsPreviewKelasOpen(false);
                                                     }}
                                                     className={`w-full px-4 py-2 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                                         kelas === k.namaKelas ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                                     }`}
                                                 >
                                                     <span>{k.namaKelas}</span>
                                                     {kelas === k.namaKelas && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                                 </button>
                                             ))}
                                         </motion.div>
                                     </>
                                 )}
                             </AnimatePresence>
                         </div>
                         <div className="relative">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Tugas (Filter)</label>
                             <button
                                 type="button"
                                 disabled={!kelas}
                                 onClick={() => kelas && setIsPreviewJudulTugasOpen(!isPreviewJudulTugasOpen)}
                                 className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm font-medium text-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100/40 disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                                 <span className={judulTugas ? 'font-semibold text-gray-800' : 'text-gray-400'}>
                                     {judulTugas || '-- Semua Tugas --'}
                                 </span>
                                 <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isPreviewJudulTugasOpen ? 'rotate-180' : ''}`} />
                             </button>

                             <AnimatePresence>
                                 {isPreviewJudulTugasOpen && (
                                     <>
                                         <div className="fixed inset-0 z-40" onClick={() => setIsPreviewJudulTugasOpen(false)} />
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
                                                     setJudulTugas("");
                                                     setIsEditingPreview(false);
                                                     setIsPreviewJudulTugasOpen(false);
                                                 }}
                                                 className={`w-full px-4 py-2 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                                     judulTugas === "" ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                                 }`}
                                             >
                                                 <span>-- Semua Tugas --</span>
                                                 {judulTugas === "" && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                             </button>
                                             {tugasList.filter(t => allTasksData[t] !== undefined).map((t) => (
                                                 <button
                                                     key={t}
                                                     type="button"
                                                     onClick={() => {
                                                         setJudulTugas(t);
                                                         setIsEditingPreview(false);
                                                         setIsPreviewJudulTugasOpen(false);
                                                     }}
                                                     className={`w-full px-4 py-2 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                                         judulTugas === t ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                                                     }`}
                                                 >
                                                     <span>{t}</span>
                                                     {judulTugas === t && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                                                 </button>
                                             ))}
                                         </motion.div>
                                     </>
                                 )}
                             </AnimatePresence>
                         </div>
                     </div>
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-gray-50">
                         {/* Edit & Simpan Buttons (Left) */}
                         <div className="flex items-center gap-2">
                             {!isEditingPreview ? (
                                 <button 
                                     onClick={handleStartEditPreview}
                                     disabled={!kelas || filteredSiswa.length === 0 || getPreviewTasks().length === 0}
                                     className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed py-2.5 px-5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                                 >
                                     <Edit2 className="w-4 h-4" /> Edit Nilai
                                 </button>
                             ) : (
                                 <div className="flex items-center gap-2 w-full sm:w-auto">
                                     <button 
                                         onClick={() => setIsEditingPreview(false)}
                                         className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                                     >
                                         <X className="w-4 h-4" /> Batal
                                     </button>
                                     <button 
                                         onClick={handleSavePreviewChanges}
                                         className="flex items-center gap-2 bg-[#F06C84] hover:bg-[#d85e75] text-white py-2.5 px-5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-[#F06C84]/20"
                                     >
                                         <Save className="w-4 h-4" /> Simpan Perubahan
                                     </button>
                                 </div>
                             )}
                         </div>

                         {/* Export Buttons (Right) */}
                         <div className="flex items-center gap-2">
                             <button 
                                 onClick={handleExportExcel} 
                                 disabled={!kelas || filteredSiswa.length === 0 || isEditingPreview} 
                                 className="flex items-center gap-2 bg-[#F06C84] hover:bg-[#d85e75] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-2.5 px-5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                             >
                                 <FileSpreadsheet className="w-4 h-4" /> Ekspor Excel
                             </button>
                         </div>
                     </div>
                 </div>
                 <div className="overflow-auto border border-gray-100 rounded-xl bg-white">
                     <table className="w-full text-left text-sm text-gray-500 border-collapse">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                             <tr>
                                 <th className="px-4 py-3 text-center" style={{ minWidth: '100px' }}>No</th>
                                 <th className="px-4 py-3">Nama Lengkap</th>
                                 <th className="px-4 py-3">NIS</th>
                                 {getPreviewTasks().map(tugas => (
                                     <th key={tugas} className="px-4 py-3 text-center" style={{ minWidth: '150px' }}>
                                         <div>{tugas}</div>
                                         <div className="text-[10px] text-gray-400 font-normal">
                                             {allTasksDates[tugas] ? new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                         </div>
                                     </th>
                                 ))}
                             </tr>
                         </thead>
                         <tbody>
                             {!kelas ? (
                                 <tr>
                                     <td colSpan={3 + getPreviewTasks().length} className="px-4 py-12 text-center text-gray-400 font-medium bg-white">
                                         Silakan pilih kelas terlebih dahulu untuk melihat daftar nilai.
                                     </td>
                                 </tr>
                             ) : filteredSiswa.length === 0 ? (
                                 <tr>
                                     <td colSpan={3 + getPreviewTasks().length} className="px-4 py-12 text-center text-gray-400 font-medium bg-white">
                                         Tidak ada data siswa untuk kelas ini.
                                     </td>
                                 </tr>
                             ) : (
                                 filteredSiswa.map((s, idx) => (
                                     <tr key={s.id} className="bg-white border-b border-gray-50">
                                         <td className="px-4 py-3 font-mono text-center">{idx + 1}</td>
                                         <td className="px-4 py-3 font-medium text-gray-900">{s.namaSiswa}</td>
                                         <td className="px-4 py-3">{s.nisn}</td>
                                         {getPreviewTasks().map(tugas => {
                                             if (isEditingPreview) {
                                                 const currentVal = previewNilaiEditState[tugas]?.[s.id] || '';
                                                 return (
                                                     <td key={tugas} className="px-4 py-2 text-center">
                                                         <input 
                                                             type="number"
                                                             min="0"
                                                             max="100"
                                                             value={currentVal}
                                                             onChange={(e) => {
                                                                 const newVal = e.target.value;
                                                                 setPreviewNilaiEditState(prev => ({
                                                                     ...prev,
                                                                     [tugas]: {
                                                                         ...(prev[tugas] || {}),
                                                                         [s.id]: newVal
                                                                     }
                                                                 }));
                                                             }}
                                                             className="w-20 px-2 py-1.5 text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-white text-sm font-semibold text-gray-800"
                                                             placeholder="-"
                                                         />
                                                     </td>
                                                 );
                                             }
                                             return (
                                                 <td key={tugas} className="px-4 py-3 text-center break-words">{allTasksData[tugas]?.[s.id] || '-'}</td>
                                             );
                                         })}
                                     </tr>
                                 ))
                             )}
                         </tbody>
                     </table>
                </div>
            </motion.div>
        )}
        </AnimatePresence>
      </div>

      <ConfirmationDialog 
        isOpen={isDeleteConfirmOpen}
        title="Hapus Tugas"
        message={`Apakah Anda yakin ingin menghapus tugas "${judulTugas}" beserta seluruh data nilai yang terkait? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDeleteTask}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      <AnimatePresence>
        {isEditingTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setIsEditingTask(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10"
            >
              <div className="h-2 bg-[#F06C84] w-full"></div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Nama Tugas</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Tugas</label>
                    <input 
                      type="text" 
                      value={editedTaskTitle}
                      onChange={(e) => setEditedTaskTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm font-medium"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsEditingTask(false)}
                      className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleEditTask(editedTaskTitle)}
                      className="px-5 py-2.5 bg-[#F06C84] text-white text-sm font-semibold rounded-xl hover:bg-[#d85e75] shadow-sm shadow-[#F06C84]/30 transition-all"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
