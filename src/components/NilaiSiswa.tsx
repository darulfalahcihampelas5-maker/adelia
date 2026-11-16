import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc, where, db, isQuotaError } from '../lib/firebase';
import { Save, FileSpreadsheet, Table, FileText, Edit2, CheckCircle, XCircle, Trash2, X, ChevronDown, Check, Sliders, Award } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';
import * as XLSX from 'xlsx-js-style';
import { generatePDF } from '../lib/pdfUtils';

interface Siswa {
  id: string;
  namaSiswa: string;
  nisn: string;
  kelas: string;
}

type KategoriPenilaian = 'Tugas' | 'Ulangan' | 'Tugas Harian' | 'Ulangan Harian' | 'PTS' | 'ASAS';

interface BobotNilai {
  kehadiran: number | '';
  tugas: number | '';
  ulangan: number | '';
  pts: number | '';
  asas: number | '';
}

const EMPTY_BOBOT: BobotNilai = {
  kehadiran: '',
  tugas: '',
  ulangan: '',
  pts: '',
  asas: '',
};

const KATEGORI_OPTIONS: { value: 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS'; label: string }[] = [
  { value: 'Tugas', label: 'Tugas' },
  { value: 'Ulangan', label: 'Ulangan' },
  { value: 'PTS', label: 'PTS/STS' },
  { value: 'ASAS', label: 'ASAS/PSAS' },
];

function formatKategoriLabel(kat: 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS'): string {
  if (kat === 'PTS') return 'PTS/STS';
  if (kat === 'ASAS') return 'ASAS/PSAS';
  return kat;
}

const KATEGORI_BADGE_COLORS: Record<string, string> = {
  'Tugas': 'bg-blue-50 text-blue-700 border-blue-200',
  'Tugas Harian': 'bg-blue-50 text-blue-700 border-blue-200',
  'Ulangan': 'bg-purple-50 text-purple-700 border-purple-200',
  'Ulangan Harian': 'bg-purple-50 text-purple-700 border-purple-200',
  'PTS': 'bg-amber-50 text-amber-700 border-amber-200',
  'ASAS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function normalizeKategori(k: string | undefined): 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS' {
  if (!k) return 'Tugas';
  const lower = k.toLowerCase();
  if (lower.includes('pts') || lower.includes('sts') || lower.includes('tengah')) return 'PTS';
  if (lower.includes('asas') || lower.includes('psas') || lower.includes('akhir')) return 'ASAS';
  if (lower.includes('ulangan') || lower.includes('uh') || lower.includes('kuis') || lower.includes('sumatif')) return 'Ulangan';
  return 'Tugas';
}

function inferKategoriFromTitle(title: string): 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS' {
  const lower = (title || '').toLowerCase();
  if (/\b(pts|uts)\b|tengah\s*semester/.test(lower)) return 'PTS';
  if (/\b(asas|pas|uas)\b|akhir\s*semester/.test(lower)) return 'ASAS';
  if (/\b(uh)\b|ulangan|sumatif|kuis/.test(lower)) return 'Ulangan';
  return 'Tugas';
}

export default function NilaiSiswa() {
  const [viewMode, setViewMode] = useState<'input' | 'preview'>('input');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [kelas, setKelas] = useState('');
  const [judulTugas, setJudulTugas] = useState('');
  const [tempNewTaskTitle, setTempNewTaskTitle] = useState('');
  const [tempNewTaskKategori, setTempNewTaskKategori] = useState<'Tugas' | 'Ulangan' | 'PTS' | 'ASAS'>('Tugas');
  const [tugasList, setTugasList] = useState<string[]>([]);
  const [taskCategories, setTaskCategories] = useState<Record<string, string>>({});
  const [kelasList, setKelasList] = useState<{ id: string; namaKelas: string }[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);

  // Bobot Nilai State: empty by default, stored in Firebase
  const [bobotNilai, setBobotNilai] = useState<BobotNilai>(EMPTY_BOBOT);
  const [isBobotEditing, setIsBobotEditing] = useState<boolean>(true);
  const [isSavingBobot, setIsSavingBobot] = useState(false);

  // Attendance percentage per student for selected class
  const [classPresentCounts, setClassPresentCounts] = useState<Record<string, number>>({});
  const [jumlahHariEfektif, setJumlahHariEfektif] = useState(0);

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
  const [editingTaskOriginalTitle, setEditingTaskOriginalTitle] = useState('');
  const [editedTaskTitle, setEditedTaskTitle] = useState('');
  const [editedTaskKategori, setEditedTaskKategori] = useState<'Tugas' | 'Ulangan' | 'PTS' | 'ASAS'>('Tugas');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [previewNilaiEditState, setPreviewNilaiEditState] = useState<Record<string, Record<string, string>>>({});

  const totalBobot =
    (Number(bobotNilai.kehadiran) || 0) +
    (Number(bobotNilai.tugas) || 0) +
    (Number(bobotNilai.ulangan) || 0) +
    (Number(bobotNilai.pts) || 0) +
    (Number(bobotNilai.asas) || 0);

  const getTaskCategory = (taskTitle: string): string => {
    return taskCategories[taskTitle] || inferKategoriFromTitle(taskTitle);
  };

  const handleSaveBobot = async () => {
    if (totalBobot !== 100) {
      setNotification({
        message: `Total bobot nilai saat ini ${totalBobot}%. Pastikan total seluruh bobot berjumlah 100%.`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }
    setIsSavingBobot(true);
    try {
      const payload = {
        kehadiran: Number(bobotNilai.kehadiran) || 0,
        tugas: Number(bobotNilai.tugas) || 0,
        tugasHarian: Number(bobotNilai.tugas) || 0,
        ulangan: Number(bobotNilai.ulangan) || 0,
        ulanganHarian: Number(bobotNilai.ulangan) || 0,
        pts: Number(bobotNilai.pts) || 0,
        asas: Number(bobotNilai.asas) || 0,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'bobot_nilai', 'main'), payload);
      setIsBobotEditing(false); // Disables inputs after saving
      setNotification({ message: "Bobot Nilai berhasil disimpan ke database Firebase!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.warn("Error saving bobot nilai to Firebase:", error);
      setNotification({
        message: isQuotaError(error)
          ? "Kuota database harian tercapai. Silakan coba beberapa saat lagi."
          : "Gagal menyimpan bobot nilai ke database Firebase.",
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsSavingBobot(false);
    }
  };

  const handleEditBobot = () => {
    setIsBobotEditing(true);
  };

  const handleChangeSelectedTaskKategori = async (newKategori: 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS') => {
    if (!judulTugas) return;
    setTaskCategories(prev => ({ ...prev, [judulTugas]: newKategori }));
    try {
      await setDoc(doc(db, 'daftar_tugas', judulTugas), {
        judulTugas,
        kategori: newKategori,
        createdAt: new Date().toISOString()
      }, { merge: true });

      if (kelas && allTasksData[judulTugas] !== undefined) {
        await setDoc(doc(db, 'nilai', `${judulTugas}_${kelas}`), {
          judulTugas,
          kelas,
          date: allTasksDates[judulTugas] || date,
          kategori: newKategori,
          nilai: allTasksData[judulTugas]
        }, { merge: true });
      }
      setNotification({ message: `Kategori "${judulTugas}" diubah ke ${formatKategoriLabel(newKategori)} di database!`, type: 'success' });
      setTimeout(() => setNotification(null), 2500);
    } catch (error) {
      console.warn("Failed updating task category:", error);
      setNotification({ message: "Gagal menyimpan perubahan kategori ke database.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleEditTask = async (newTitle: string, newKategori: 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS') => {
    if (!newTitle.trim()) {
      setNotification({ message: "Nama tugas tidak boleh kosong.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const oldTitle = editingTaskOriginalTitle || judulTugas;
    if (!oldTitle) {
      setIsEditingTask(false);
      return;
    }
    if (newTitle === oldTitle && newKategori === normalizeKategori(getTaskCategory(oldTitle))) {
      setIsEditingTask(false);
      setEditingTaskOriginalTitle('');
      return;
    }
    if (newTitle !== oldTitle && tugasList.includes(newTitle)) {
      setNotification({ message: "Nama tugas sudah digunakan.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      const newTaskRef = doc(db, 'daftar_tugas', newTitle);
      await setDoc(newTaskRef, {
        judulTugas: newTitle,
        kategori: newKategori,
        createdAt: new Date().toISOString()
      });

      if (newTitle !== oldTitle) {
        const oldTaskRef = doc(db, 'daftar_tugas', oldTitle);
        await deleteDoc(oldTaskRef);
      }

      const q = query(collection(db, 'nilai'), where('judulTugas', '==', oldTitle));
      const querySnapshot = await getDocs(q);

      for (const d of querySnapshot.docs) {
        const data = d.data();
        const kelasName = data.kelas;
        const newNilaiRef = doc(db, 'nilai', `${newTitle}_${kelasName}`);
        await setDoc(newNilaiRef, {
          ...data,
          judulTugas: newTitle,
          kategori: newKategori
        });
        if (newTitle !== oldTitle) {
          await deleteDoc(doc(db, 'nilai', d.id));
        }
      }

      setTugasList(prev => prev.map(t => t === oldTitle ? newTitle : t));
      setTaskCategories(prev => {
        const next = { ...prev };
        if (newTitle !== oldTitle) delete next[oldTitle];
        next[newTitle] = newKategori;
        return next;
      });
      
      if (newTitle !== oldTitle) {
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
      }

      if (judulTugas === oldTitle) {
        setJudulTugas(newTitle);
      }
      setIsEditingTask(false);
      setEditingTaskOriginalTitle('');
      setNotification({ message: "Tugas & keterangan berhasil diperbarui di Firebase!", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.warn("Error editing task title:", error);
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
    const fetchTugasListForKelas = async () => {
      if (!kelas) {
        setAllTasksData({});
        setAllTasksDates({});
        return;
      }
      try {
        // Only query nilai documents for the selected class instead of scanning all classes
        const q = query(collection(db, 'nilai'), where('kelas', '==', kelas));
        const snapshot = await getDocs(q);
        const tasksDataForKelas: Record<string, Record<string, string>> = {};
        const tasksDatesForKelas: Record<string, string> = {};
        const discoveredTasks: string[] = [];
        const categoriesMap: Record<string, string> = {};

        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.judulTugas) {
            discoveredTasks.push(data.judulTugas);
            if (data.kategori) {
              categoriesMap[data.judulTugas] = normalizeKategori(data.kategori);
            }
            tasksDataForKelas[data.judulTugas] = data.nilai || {};
            tasksDatesForKelas[data.judulTugas] = data.date || '';
          }
        });

        if (discoveredTasks.length > 0) {
          setTugasList(prev => Array.from(new Set([...prev, ...discoveredTasks])));
          setTaskCategories(prev => ({ ...prev, ...categoriesMap }));
        }
        setAllTasksData(tasksDataForKelas);
        setAllTasksDates(tasksDatesForKelas);
      } catch (error) {
        if (!isQuotaError(error)) {
          console.warn("Error fetching class nilai data:", error);
        }
      }
    };
    fetchTugasListForKelas();
  }, [kelas]);

  // Fetch attendance summary only when kelas changes (never re-query on siswaList reference changes)
  useEffect(() => {
    const fetchAttendanceForClass = async () => {
      if (!kelas) {
        setClassPresentCounts({});
        setJumlahHariEfektif(0);
        return;
      }
      try {
        const qAbsensi = query(collection(db, 'absensi'), where('kelas', '==', kelas));
        const absSnapshot = await getDocs(qAbsensi);
        const uniqueDates = new Set<string>();
        const presentCounts: Record<string, number> = {};

        absSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.tanggal) uniqueDates.add(data.tanggal);
          if (data.siswaId && (data.status === 'Hadir' || data.status === 'Dispen')) {
            presentCounts[data.siswaId] = (presentCounts[data.siswaId] || 0) + 1;
          }
        });

        setJumlahHariEfektif(uniqueDates.size);
        setClassPresentCounts(presentCounts);
      } catch (error) {
        if (!isQuotaError(error)) {
          console.warn("Error fetching attendance for class:", error);
        }
      }
    };
    fetchAttendanceForClass();
  }, [kelas]);

  const attendancePctMap = useMemo(() => {
    const pctMap: Record<string, number | null> = {};
    if (!kelas) return pctMap;
    siswaList
      .filter(s => s.kelas === kelas)
      .forEach(s => {
        if (jumlahHariEfektif > 0) {
          const hadir = classPresentCounts[s.id] || 0;
          pctMap[s.id] = (hadir / jumlahHariEfektif) * 100;
        } else {
          pctMap[s.id] = null;
        }
      });
    return pctMap;
  }, [kelas, siswaList, classPresentCounts, jumlahHariEfektif]);

  const fetchData = async () => {
    try {
      const kelasQuery = query(collection(db, 'kelas'), orderBy('createdAt', 'asc'));
      const kelasSnapshot = await getDocs(kelasQuery);
      const kList = kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      kList.sort((a, b) => (a.namaKelas || '').localeCompare(b.namaKelas || '', undefined, { numeric: true, sensitivity: 'base' }));
      setKelasList(kList);

      const siswaQuery = query(collection(db, 'siswa'), orderBy('namaSiswa', 'asc'));
      const siswaSnapshot = await getDocs(siswaQuery);
      const sList = siswaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
      sList.sort((a, b) => (a.namaSiswa || '').localeCompare(b.namaSiswa || '', undefined, { numeric: true, sensitivity: 'base' }));
      setSiswaList(sList);

      // Load daftar_tugas once on mount instead of every time kelas changes
      const snapshotDaftarTugas = await getDocs(query(collection(db, 'daftar_tugas')));
      const masterTasks: string[] = [];
      const categoriesMap: Record<string, string> = {};
      snapshotDaftarTugas.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.judulTugas) {
          masterTasks.push(data.judulTugas);
          if (data.kategori) {
            categoriesMap[data.judulTugas] = normalizeKategori(data.kategori);
          }
        }
      });
      if (masterTasks.length > 0) {
        setTugasList(prev => Array.from(new Set([...masterTasks, ...prev])));
        setTaskCategories(prev => ({ ...categoriesMap, ...prev }));
      }

      // Load saved Bobot Nilai directly from Firestore
      const bobotSnap = await getDoc(doc(db, 'bobot_nilai', 'main'));
      if (bobotSnap.exists()) {
        const bData = bobotSnap.data() as any;
        const loaded: BobotNilai = {
          kehadiran: typeof bData.kehadiran === 'number' ? bData.kehadiran : '',
          tugas: typeof bData.tugas === 'number' ? bData.tugas : (typeof bData.tugasHarian === 'number' ? bData.tugasHarian : ''),
          ulangan: typeof bData.ulangan === 'number' ? bData.ulangan : (typeof bData.ulanganHarian === 'number' ? bData.ulanganHarian : ''),
          pts: typeof bData.pts === 'number' ? bData.pts : '',
          asas: typeof bData.asas === 'number' ? bData.asas : '',
        };
        setBobotNilai(loaded);
        const sumLoaded = (Number(loaded.kehadiran) || 0) + (Number(loaded.tugas) || 0) + (Number(loaded.ulangan) || 0) + (Number(loaded.pts) || 0) + (Number(loaded.asas) || 0);
        if (sumLoaded === 100) {
          setIsBobotEditing(false); // Saved in DB -> disabled by default
        } else {
          setIsBobotEditing(true); // Empty or incomplete -> enabled
        }
      } else {
        setBobotNilai(EMPTY_BOBOT);
        setIsBobotEditing(true);
      }
    } catch (error) {
      if (!isQuotaError(error)) {
        console.warn("Error fetching data:", error);
      }
    }
  };

  const filteredSiswa = useMemo(() => {
    if (kelas === '') return [];
    return siswaList.filter(s => s.kelas === kelas);
  }, [kelas, siswaList]);

  const handleSave = async () => {
    try {
        if (!judulTugas || !kelas) {
            setNotification({message: "Mohon isi Judul Tugas dan Kelas.", type: 'error'});
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        const kategori = normalizeKategori(getTaskCategory(judulTugas));
        const nilaiDocRef = doc(db, 'nilai', `${judulTugas}_${kelas}`);
        await setDoc(nilaiDocRef, {
            judulTugas,
            kelas,
            date,
            kategori,
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
        console.warn("Error saving data:", error);
        setNotification({message: "Gagal menyimpan nilai.", type: 'error'});
        setTimeout(() => setNotification(null), 3000);
    }
  };

  useEffect(() => {
    if (!judulTugas || !kelas) {
      setNilai({});
      setIsSaved(false);
      return;
    }
    if (allTasksData[judulTugas] !== undefined) {
      setNilai(allTasksData[judulTugas]);
      setIsSaved(true);
    } else {
      setNilai({});
      setIsSaved(false);
    }
  }, [judulTugas, kelas, allTasksData]);

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

  const computeNilaiRapor = (studentId: string, sourceData: Record<string, Record<string, string>> = allTasksData) => {
    const kehadiranPct = attendancePctMap[studentId];
    const kehadiranScore = kehadiranPct !== null && kehadiranPct !== undefined ? kehadiranPct : 0;

    const categoryScores: Record<'Tugas' | 'Ulangan' | 'PTS' | 'ASAS', number[]> = {
      'Tugas': [],
      'Ulangan': [],
      'PTS': [],
      'ASAS': [],
    };

    Object.keys(sourceData).forEach((taskName) => {
      const rawVal = sourceData[taskName]?.[studentId];
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '' && String(rawVal).trim() !== '-') {
        const num = Number(rawVal);
        if (!isNaN(num)) {
          const kat = normalizeKategori(getTaskCategory(taskName));
          categoryScores[kat].push(num);
        }
      }
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const avgTugas = avg(categoryScores['Tugas']);
    const avgUlangan = avg(categoryScores['Ulangan']);
    const avgPTS = avg(categoryScores['PTS']);
    const avgASAS = avg(categoryScores['ASAS']);

    const wTotal =
      (Number(bobotNilai.kehadiran) || 0) +
      (Number(bobotNilai.tugas) || 0) +
      (Number(bobotNilai.ulangan) || 0) +
      (Number(bobotNilai.pts) || 0) +
      (Number(bobotNilai.asas) || 0);

    if (wTotal <= 0) return 0;

    const weighted =
      kehadiranScore * (Number(bobotNilai.kehadiran) || 0) +
      avgTugas * (Number(bobotNilai.tugas) || 0) +
      avgUlangan * (Number(bobotNilai.ulangan) || 0) +
      avgPTS * (Number(bobotNilai.pts) || 0) +
      avgASAS * (Number(bobotNilai.asas) || 0);

    return weighted / wTotal;
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
                kategori: normalizeKategori(getTaskCategory(tugas)),
                nilai: currentNilai
            });

            setAllTasksData(prev => ({
                ...prev,
                [tugas]: currentNilai
            }));
        }

        setIsEditingPreview(false);
        setNotification({message: "Perubahan nilai berhasil disimpan ke Firebase!", type: 'success'});
        setTimeout(() => setNotification(null), 3000);
    } catch (error) {
        console.warn("Error saving preview changes:", error);
        setNotification({message: "Gagal menyimpan perubahan nilai ke database.", type: 'error'});
        setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleExportExcel = () => {
    const exportTasks = getPreviewTasks();

    const headers = [
      'No',
      'Nama Lengkap',
      'NIS',
      'Kelas',
      `Nilai Kehadiran (${Number(bobotNilai.kehadiran) || 0}%)`,
      ...exportTasks.map(tugas => {
        const dateStr = allTasksDates[tugas]
          ? ` (${new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })})`
          : '';
        return `${tugas} [${formatKategoriLabel(normalizeKategori(getTaskCategory(tugas)))}]${dateStr}`;
      }),
      'Nilai Rapor'
    ];

    const rows = filteredSiswa.map((s, idx) => {
      const pct = attendancePctMap[s.id];
      const kehadiranVal = pct !== null && pct !== undefined ? Math.round(pct) : '-';
      const taskVals = exportTasks.map(tugas => {
        const raw = allTasksData[tugas]?.[s.id];
        if (raw === undefined || raw === null || String(raw).trim() === '') return '-';
        const num = Number(raw);
        return !isNaN(num) ? num : raw;
      });
      return [
        idx + 1,
        s.namaSiswa,
        s.nisn,
        kelas,
        kehadiranVal,
        ...taskVals,
        Math.round(computeNilaiRapor(s.id))
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const thinBorder = {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) continue;

        if (r === 0) {
          // Header row: centered horizontally & vertically with wrapText
          ws[cellAddr].s = {
            font: { bold: true, color: { rgb: '111827' }, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'F3F4F6' } },
            border: thinBorder
          };
        } else {
          // Body rows: Nama Lengkap (col 1) left-aligned; No, NIS, Kelas, and ALL scores centered
          const isNamaCol = c === 1;
          const isRaporCol = c === range.e.c;
          ws[cellAddr].s = {
            font: {
              bold: isRaporCol,
              color: { rgb: isRaporCol ? 'D84863' : '1F2937' },
              sz: 10
            },
            alignment: {
              horizontal: isNamaCol ? 'left' : 'center',
              vertical: 'center'
            },
            border: thinBorder
          };
        }
      }
    }

    // Set taller header row height so wrapped column titles have room
    ws['!rows'] = [{ hpt: 40 }];

    const colWidths = [
      { wch: 6 },
      { wch: 32 },
      { wch: 16 },
      { wch: 11 },
      { wch: 18 },
      ...exportTasks.map(() => ({ wch: 18 })),
      { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nilai Siswa');
    XLSX.writeFile(wb, `Nilai_Siswa_${kelas || 'Semua'}${judulTugas ? `_${judulTugas}` : ''}.xlsx`);
  };

  const handleExportPDF = async () => {
    const exportTasks = getPreviewTasks();

    const headerRow1 = ['No', 'Nama Siswa', 'NIS', 'Kelas', 'Nilai Kehadiran', ...exportTasks.map(tugas => tugas), 'Nilai Rapor'];
    const headerRow2 = [
      '', '', '', '', `(Bobot ${Number(bobotNilai.kehadiran) || 0}%)`,
      ...exportTasks.map(tugas => {
        const dateText = allTasksDates[tugas] ? new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        return `${formatKategoriLabel(normalizeKategori(getTaskCategory(tugas)))}${dateText ? ` (${dateText})` : ''}`;
      }),
      `(Bobot ${totalBobot}%)`
    ];

    const head = [headerRow1, headerRow2];
    
    const data = filteredSiswa.map((s, idx) => {
        const pct = attendancePctMap[s.id];
        return [
          String(idx + 1),
          s.namaSiswa,
          s.nisn,
          kelas,
          pct !== null && pct !== undefined ? String(Math.round(pct)) : '-',
          ...exportTasks.map(tugas => allTasksData[tugas]?.[s.id] || '-'),
          String(Math.round(computeNilaiRapor(s.id)))
        ];
    });
    
    const profileDoc = await getDoc(doc(db, 'user_profile', 'main'));
    const profileData = profileDoc.exists() ? profileDoc.data() : {};
    
    const columnStyles: any = {};
    headerRow1.forEach((_, idx) => {
        if (idx > 3) {
            columnStyles[idx] = { halign: 'center', cellWidth: 20 };
        } else {
            columnStyles[idx] = { halign: 'left' };
        }
    });
    columnStyles[0] = { halign: 'center', cellWidth: 10 };
    columnStyles[2] = { halign: 'center', cellWidth: 20 };
    columnStyles[3] = { halign: 'center', cellWidth: 15 };
    
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
                {/* Pengaturan Bobot Nilai */}
                <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-rose-50/60 via-white to-slate-50 border border-rose-100/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-rose-100/60">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#F06C84]/10 text-[#F06C84] rounded-xl">
                                <Sliders className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Bobot Nilai Rapor (%)</h3>
                                <p className="text-[11px] text-gray-500 font-medium">Atur persentase bobot penilaian untuk kalkulasi otomatis Nilai Rapor</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                                totalBobot === 100 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                Total: {totalBobot}% {totalBobot !== 100 && '(Harus 100%)'}
                            </span>
                            <button
                                type="button"
                                onClick={handleEditBobot}
                                disabled={isBobotEditing}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    !isBobotEditing
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer shadow-xs'
                                        : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveBobot}
                                disabled={!isBobotEditing || isSavingBobot}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
                                    isBobotEditing && !isSavingBobot
                                        ? 'bg-[#F06C84] hover:bg-[#d85e75] text-white cursor-pointer'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                }`}
                            >
                                <Save className="w-3.5 h-3.5" /> {isSavingBobot ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {[
                            { key: 'kehadiran' as keyof BobotNilai, label: 'Kehadiran' },
                            { key: 'tugas' as keyof BobotNilai, label: 'Tugas' },
                            { key: 'ulangan' as keyof BobotNilai, label: 'Ulangan' },
                            { key: 'pts' as keyof BobotNilai, label: 'PTS/STS' },
                            { key: 'asas' as keyof BobotNilai, label: 'ASAS/PSAS' },
                        ].map((item) => (
                            <div key={item.key} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                                    {item.label}
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        disabled={!isBobotEditing}
                                        placeholder="0"
                                        value={bobotNilai[item.key]}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === '') {
                                                setBobotNilai(prev => ({ ...prev, [item.key]: '' }));
                                            } else {
                                                const val = Math.max(0, Math.min(100, Number(raw) || 0));
                                                setBobotNilai(prev => ({ ...prev, [item.key]: val }));
                                            }
                                        }}
                                        className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-sm font-bold text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    />
                                    <span className="absolute right-3 text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    {/* Baris 1: Tanggal & Kelas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="min-w-0">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tanggal</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full h-[46px] px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm font-medium text-gray-800"
                            />
                        </div>
                        <div className="relative min-w-0">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kelas</label>
                            <button
                                type="button"
                                onClick={() => setIsKelasOpen(!isKelasOpen)}
                                className="w-full h-[46px] px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm text-gray-800 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
                            >
                                <span className={`truncate ${kelas ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                                    {kelas || '-- Pilih Kelas --'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isKelasOpen ? 'rotate-180' : ''}`} />
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
                    </div>

                    {/* Baris 2: Input Judul Tugas Baru & Pilih Tugas (Simetris & Sejajar) */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <div className="min-w-0">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Input Judul Tugas / Penilaian Baru</label>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                                <input 
                                    type="text" 
                                    value={tempNewTaskTitle}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setTempNewTaskTitle(val);
                                        if (val.trim()) {
                                            setTempNewTaskKategori(inferKategoriFromTitle(val));
                                        }
                                    }}
                                    placeholder="Contoh: Tugas 1, UH 1, PTS, ASAS"
                                    className="min-w-0 flex-1 h-[46px] px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm"
                                />
                                <select
                                    value={tempNewTaskKategori}
                                    onChange={(e) => setTempNewTaskKategori(e.target.value as 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS')}
                                    className="h-[46px] px-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-gray-50/50 text-xs font-bold text-gray-700 shrink-0 sm:w-36"
                                >
                                    {KATEGORI_OPTIONS.map(kat => (
                                        <option key={kat.value} value={kat.value}>{kat.label}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (tempNewTaskTitle && !tugasList.includes(tempNewTaskTitle)) {
                                            try {
                                                const taskRef = doc(db, 'daftar_tugas', tempNewTaskTitle);
                                                await setDoc(taskRef, {
                                                    judulTugas: tempNewTaskTitle,
                                                    kategori: tempNewTaskKategori,
                                                    createdAt: new Date().toISOString()
                                                });
                                                setTugasList([...tugasList, tempNewTaskTitle]);
                                                setTaskCategories(prev => ({ ...prev, [tempNewTaskTitle]: tempNewTaskKategori }));
                                                setJudulTugas(tempNewTaskTitle);
                                                setTempNewTaskTitle('');
                                                setNotification({message: "Tugas Baru Berhasil Ditambahkan ke Cloud", type: 'success'});
                                                setTimeout(() => setNotification(null), 3000);
                                            } catch (e) {
                                                console.warn("Error saving new task to cloud:", e);
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
                                    className="h-[46px] px-5 bg-[#F06C84] hover:bg-[#d85e75] text-white rounded-xl font-semibold text-sm transition-all cursor-pointer shrink-0 flex items-center justify-center"
                                >
                                    Simpan
                                </button>
                            </div>
                        </div>

                        <div className="min-w-0">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Tugas & Kategori</label>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                                <div className="relative min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsJudulTugasOpen(!isJudulTugasOpen)}
                                        className="w-full h-[46px] px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm text-gray-800 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
                                    >
                                        <span className={`truncate ${judulTugas ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                                            {judulTugas || '-- Pilih Tugas --'}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform duration-200 ${isJudulTugasOpen ? 'rotate-180' : ''}`} />
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
                                                        const kat = normalizeKategori(getTaskCategory(t));
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
                                                                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                                                    isSelected ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <span className="truncate">{t}</span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${KATEGORI_BADGE_COLORS[kat]}`}>
                                                                        {formatKategoriLabel(kat)}
                                                                    </span>
                                                                    {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {judulTugas && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <select
                                            value={normalizeKategori(getTaskCategory(judulTugas))}
                                            onChange={(e) => handleChangeSelectedTaskKategori(e.target.value as 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS')}
                                            className="h-[46px] px-3 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] flex-1 sm:flex-none sm:w-36"
                                            title="Kategori Penilaian Tugas"
                                        >
                                            {KATEGORI_OPTIONS.map(kat => (
                                                <option key={kat.value} value={kat.value}>{kat.label}</option>
                                            ))}
                                        </select>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setEditingTaskOriginalTitle(judulTugas);
                                                setEditedTaskTitle(judulTugas);
                                                setEditedTaskKategori(normalizeKategori(getTaskCategory(judulTugas)));
                                                setIsEditingTask(true);
                                            }}
                                            className="h-[46px] w-[46px] flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shrink-0 cursor-pointer"
                                            title="Edit Nama & Kategori Tugas"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            className="h-[46px] w-[46px] flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shrink-0 cursor-pointer"
                                            title="Hapus Tugas"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
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
                 {/* Active Bobot Info Bar */}
                 {kelas && (
                     <div className="mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                         <div className="flex items-center gap-2 font-semibold text-gray-700">
                             <Award className="w-4 h-4 text-[#F06C84] shrink-0" />
                             <span>Bobot Nilai Rapor:</span>
                             <span className="text-gray-700">
                                 Kehadiran <strong>{Number(bobotNilai.kehadiran) || 0}%</strong> • Tugas <strong>{Number(bobotNilai.tugas) || 0}%</strong> • Ulangan <strong>{Number(bobotNilai.ulangan) || 0}%</strong> • PTS/STS <strong>{Number(bobotNilai.pts) || 0}%</strong> • ASAS/PSAS <strong>{Number(bobotNilai.asas) || 0}%</strong>
                             </span>
                         </div>
                         <span className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 font-bold text-[11px]">
                             Hari Efektif Presensi: {jumlahHariEfektif} Pertemuan
                         </span>
                     </div>
                 )}

                 <div className="overflow-auto border border-gray-300 rounded-xl bg-white shadow-xs">
                     <table className="w-full text-left text-sm text-gray-800 border-collapse">
                         <thead className="text-xs text-gray-900 uppercase bg-gray-100">
                             <tr className="bg-rose-50/40 text-gray-800 normal-case">
                                 <th
                                     colSpan={4 + getPreviewTasks().length}
                                     className="px-4 py-2.5 text-left text-xs font-bold border border-gray-300"
                                 >
                                     Update Nilai : {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                 </th>
                                 <th className="px-4 py-2.5 text-center text-xs font-bold text-[#d84863] bg-rose-50/70 border border-gray-300 whitespace-nowrap">
                                     Kelas : {kelas || '-'}
                                 </th>
                             </tr>
                             <tr>
                                 <th className="px-4 py-3 text-center font-bold border border-gray-300" style={{ minWidth: '70px' }}>No</th>
                                 <th className="px-4 py-3 font-bold border border-gray-300 whitespace-nowrap" style={{ minWidth: '220px' }}>Nama Lengkap</th>
                                 <th className="px-4 py-3 font-bold border border-gray-300 whitespace-nowrap" style={{ minWidth: '120px' }}>NIS</th>
                                 <th className="px-4 py-3 text-center font-bold bg-blue-50/80 text-blue-950 border border-gray-300" style={{ minWidth: '130px' }}>
                                     <div>Nilai Kehadiran</div>
                                     <div className="text-[10px] text-blue-700 font-semibold normal-case mt-0.5">
                                         Bobot {Number(bobotNilai.kehadiran) || 0}%
                                     </div>
                                 </th>
                                 {getPreviewTasks().map(tugas => {
                                     const kat = normalizeKategori(getTaskCategory(tugas));
                                     return (
                                         <th key={tugas} className="px-4 py-3 text-center font-bold border border-gray-300" style={{ minWidth: '150px' }}>
                                             <div>{tugas}</div>
                                             <div className="mt-1 flex flex-col items-center gap-1">
                                                 <div className="inline-flex items-center gap-1">
                                                     <span className={`px-2 py-0.5 rounded text-[9px] font-bold border normal-case ${KATEGORI_BADGE_COLORS[kat]}`}>
                                                         {formatKategoriLabel(kat)}
                                                     </span>
                                                     <button
                                                         type="button"
                                                         onClick={() => {
                                                             setEditingTaskOriginalTitle(tugas);
                                                             setEditedTaskTitle(tugas);
                                                             setEditedTaskKategori(kat);
                                                             setIsEditingTask(true);
                                                         }}
                                                         className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-200/70 transition-colors cursor-pointer"
                                                         title={`Edit Keterangan & Nama "${tugas}"`}
                                                         aria-label={`Edit keterangan ${tugas}`}
                                                     >
                                                         <Edit2 className="w-3 h-3" />
                                                     </button>
                                                 </div>
                                                 <span className="text-[10px] text-gray-500 font-medium normal-case">
                                                     {allTasksDates[tugas] ? new Date(allTasksDates[tugas]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                 </span>
                                             </div>
                                         </th>
                                     );
                                 })}
                                 <th className="px-4 py-3 text-center font-bold bg-rose-50 text-[#d84863] border border-gray-300" style={{ minWidth: '130px' }}>
                                     <div>Nilai Rapor</div>
                                     <div className="text-[10px] text-[#d84863] font-semibold normal-case mt-0.5">
                                         Bobot {totalBobot}%
                                     </div>
                                 </th>
                             </tr>
                         </thead>
                         <tbody>
                             {!kelas ? (
                                 <tr>
                                     <td colSpan={5 + getPreviewTasks().length} className="px-4 py-12 text-center text-gray-500 font-medium bg-white border border-gray-300">
                                         Silakan pilih kelas terlebih dahulu untuk melihat daftar nilai.
                                     </td>
                                 </tr>
                             ) : filteredSiswa.length === 0 ? (
                                 <tr>
                                     <td colSpan={5 + getPreviewTasks().length} className="px-4 py-12 text-center text-gray-500 font-medium bg-white border border-gray-300">
                                         Tidak ada data siswa untuk kelas ini.
                                     </td>
                                 </tr>
                             ) : (
                                 filteredSiswa.map((s, idx) => {
                                     const pct = attendancePctMap[s.id];
                                     const raporScore = Math.round(computeNilaiRapor(s.id, isEditingPreview ? previewNilaiEditState : allTasksData));
                                     return (
                                         <tr key={s.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                                             <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-center border border-gray-300">{idx + 1}</td>
                                             <td className="px-4 py-3 font-semibold text-gray-900 border border-gray-300 whitespace-nowrap">{s.namaSiswa}</td>
                                             <td className="px-4 py-3 font-medium text-gray-800 border border-gray-300 whitespace-nowrap">{s.nisn}</td>
                                             <td className="px-4 py-3 text-center font-extrabold text-sm text-blue-900 bg-blue-50/25 border border-gray-300">
                                                 {pct !== null && pct !== undefined ? Math.round(pct) : '-'}
                                             </td>
                                             {getPreviewTasks().map(tugas => {
                                                 if (isEditingPreview) {
                                                     const currentVal = previewNilaiEditState[tugas]?.[s.id] || '';
                                                     return (
                                                         <td key={tugas} className="px-4 py-2 text-center border border-gray-300">
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
                                                                 className="w-20 px-2 py-1.5 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] bg-white text-sm font-bold text-gray-900"
                                                                 placeholder="-"
                                                             />
                                                         </td>
                                                     );
                                                 }
                                                 return (
                                                     <td key={tugas} className="px-4 py-3 text-center font-bold text-sm text-gray-900 break-words border border-gray-300">{allTasksData[tugas]?.[s.id] || '-'}</td>
                                                 );
                                             })}
                                             <td className="px-4 py-3 text-center font-black text-base text-[#d84863] bg-rose-50/40 border border-gray-300">
                                                 {raporScore}
                                             </td>
                                         </tr>
                                     );
                                 })
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
                <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Nama & Kategori Tugas</h3>
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
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategori Penilaian</label>
                    <select
                      value={editedTaskKategori}
                      onChange={(e) => setEditedTaskKategori(e.target.value as 'Tugas' | 'Ulangan' | 'PTS' | 'ASAS')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-sm font-medium"
                    >
                      {KATEGORI_OPTIONS.map(kat => (
                        <option key={kat.value} value={kat.value}>{kat.label}</option>
                      ))}
                    </select>
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
                      onClick={() => handleEditTask(editedTaskTitle, editedTaskKategori)}
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
