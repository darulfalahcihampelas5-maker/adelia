import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Users, Save, Check, AlertCircle, X, 
  ChevronRight, Smile, Frown, Coffee, ShieldAlert, Award, Pencil, Download, Trash2, ChevronDown
} from 'lucide-react';
import { generatePDF } from '../lib/pdfUtils';
import { collection, getDocs, setDoc, doc, serverTimestamp, query, where, getDoc, db, auth, deleteDoc, clearCache } from '../lib/firebase';
import { getDocs as getDocsFromServer } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

interface StudentPreviewStats {
  siswaId: string;
  namaSiswa: string;
  nisn: string;
  kelas?: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  dispen: number;
}

type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa' | 'Dispen';

interface AttendanceRecord {
  siswaId: string;
  status: AttendanceStatus;
}

export default function AbsensiSiswa({ initialKelas }: { initialKelas?: string }) {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>(initialKelas || '');
  const [tanggal, setTanggal] = useState<string>(() => {
    const today = new Date();
    // Format YYYY-MM-DD in local timezone
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [fetchingSiswa, setFetchingSiswa] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ tanggal: string; kelas: string } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(true);
  const [jumlahHariEfektif, setJumlahHariEfektif] = useState<number>(0);
  const [absensiDates, setAbsensiDates] = useState<string[]>([]);
  const [fetchingAttendance, setFetchingAttendance] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'input' | 'preview'>('input');
  const [previewStats, setPreviewStats] = useState<StudentPreviewStats[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [downloadType, setDownloadType] = useState<'total' | 'total_semua' | 'bulanan' | 'harian'>('total');
  const [downloadMonth, setDownloadMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [downloadDate, setDownloadDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [hasSavedData, setHasSavedData] = useState<boolean>(false);
  const [meetingsByClass, setMeetingsByClass] = useState<Record<string, number>>({});
  const [isKelasDropdownOpen, setIsKelasDropdownOpen] = useState<boolean>(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    targetDate: string;
  }>({
    isOpen: false,
    targetDate: ''
  });

  useEffect(() => {
    if (initialKelas) setSelectedKelas(initialKelas);
  }, [initialKelas]);

  const loadClassData = async (kelasName: string, targetDate: string) => {
    if (!kelasName) {
      setSiswaList([]);
      setAttendance({});
      setAbsensiDates([]);
      setJumlahHariEfektif(0);
      setPreviewStats([]);
      setHasSavedData(false);
      setSavedInfo(null);
      return;
    }

    setFetchingSiswa(true);
    setFetchingAttendance(true);
    try {
      // 1. Fetch Students of the selected class
      const qSiswa = query(collection(db, 'siswa'), where('kelas', '==', kelasName));
      const querySnapshotSiswa = await getDocs(qSiswa);
      const sList: Siswa[] = [];
      querySnapshotSiswa.forEach((doc) => {
        sList.push({ id: doc.id, ...doc.data() } as Siswa);
      });
      // Sort students alphabetically
      sList.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, undefined, { numeric: true, sensitivity: 'base' }));
      setSiswaList(sList);

      // 2. Fetch ALL attendance records of this class to:
      //    a) Get all unique dates (for absensiDates and jumlahHariEfektif of this class)
      //    b) Calculate preview statistics for each student
      //    c) Find if there is saved data for the targetDate
      const qAbsensiAll = query(collection(db, 'absensi'), where('kelas', '==', kelasName));
      const querySnapshotAbsensi = await getDocs(qAbsensiAll);
      
      const uniqueDates = new Set<string>();
      const statsMap: Record<string, StudentPreviewStats> = {};
      
      // Initialize statsMap for each student
      sList.forEach(s => {
        statsMap[s.id] = {
          siswaId: s.id,
          namaSiswa: s.namaSiswa,
          nisn: s.nisn,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
          dispen: 0
        };
      });

      // Initialize attendance state for targetDate (default to 'Hadir')
      const targetAttendance: Record<string, AttendanceStatus> = {};
      sList.forEach(s => {
        targetAttendance[s.id] = 'Hadir';
      });

      let dataExistsForTargetDate = false;

      querySnapshotAbsensi.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.tanggal) {
          uniqueDates.add(data.tanggal);
        }

        // Aggregate stats for students
        if (data.siswaId && statsMap[data.siswaId]) {
          const status = data.status;
          if (status === 'Hadir') statsMap[data.siswaId].hadir++;
          else if (status === 'Sakit') statsMap[data.siswaId].sakit++;
          else if (status === 'Izin') statsMap[data.siswaId].izin++;
          else if (status === 'Alpa') statsMap[data.siswaId].alpa++;
          else if (status === 'Dispen') statsMap[data.siswaId].dispen++;
        }

        // Check if there's a record for the targetDate
        if (data.tanggal === targetDate && data.siswaId) {
          targetAttendance[data.siswaId] = (data.status || 'Hadir') as AttendanceStatus;
          dataExistsForTargetDate = true;
        }
      });

      const sortedDates = Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
      setAbsensiDates(sortedDates);
      setJumlahHariEfektif(sortedDates.length);

      const sortedStats = Object.values(statsMap).sort((a, b) => 
        a.namaSiswa.localeCompare(b.namaSiswa, undefined, { numeric: true, sensitivity: 'base' })
      );
      setPreviewStats(sortedStats);

      setAttendance(targetAttendance);
      setIsEditing(!dataExistsForTargetDate);
      setHasSavedData(dataExistsForTargetDate);
      if (dataExistsForTargetDate) {
        setSavedInfo({ tanggal: targetDate, kelas: kelasName });
      } else {
        setSavedInfo(null);
      }
    } catch (error) {
      console.error("Error loading class data:", error);
      showNotification("Gagal memuat data kelas", "error");
    } finally {
      setFetchingSiswa(false);
      setFetchingAttendance(false);
    }
  };

  const fetchMeetingsCountPerClass = async () => {
    try {
      const q = query(collection(db, 'absensi'));
      const querySnapshot = await getDocs(q);
      const classDates: Record<string, Set<string>> = {};
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.kelas && data.tanggal) {
          if (!classDates[data.kelas]) {
            classDates[data.kelas] = new Set<string>();
          }
          classDates[data.kelas].add(data.tanggal);
        }
      });
      
      const counts: Record<string, number> = {};
      Object.keys(classDates).forEach(className => {
        counts[className] = classDates[className].size;
      });
      
      setMeetingsByClass(counts);
    } catch (error) {
      console.error("Error fetching meetings count per class:", error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  // Fetch classes list on mount
  useEffect(() => {
    const fetchKelas = async () => {
      try {
        const q = query(collection(db, 'kelas'));
        const querySnapshot = await getDocs(q);
        const list: Kelas[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Kelas);
        });
        // Sort by name
        list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true, sensitivity: 'base' }));
        setKelasList(list);
        await fetchMeetingsCountPerClass();
      } catch (error) {
        console.error("Error fetching kelas:", error);
        showNotification("Gagal mengambil data kelas", "error");
        try {
          handleFirestoreError(error, OperationType.LIST, 'kelas');
        } catch (e) {
          // Keep original flow in case we want to swallow or propagate
        }
      }
    };
    fetchKelas();
  }, []);

  // Load students, attendance, and completed dates for the selected class and date
  useEffect(() => {
    loadClassData(selectedKelas, tanggal);
  }, [selectedKelas, tanggal]);

  const handleStatusChange = (siswaId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({
      ...prev,
      [siswaId]: status
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedKelas) {
      showNotification("Silakan pilih kelas terlebih dahulu!", "error");
      return;
    }
    if (siswaList.length === 0) {
      showNotification("Tidak ada siswa di kelas ini untuk diabsen", "error");
      return;
    }

    setLoading(true);
    try {
      // Save each student's attendance as a separate document with a deterministic ID: YYYY-MM-DD_siswaId
      const promises = siswaList.map(async (siswa) => {
        const status = attendance[siswa.id] || 'Hadir';
        const docId = `${tanggal}_${siswa.id}`;
        const ref = doc(db, 'absensi', docId);
        
        try {
          await setDoc(ref, {
            siswaId: siswa.id,
            namaSiswa: siswa.namaSiswa,
            nisn: siswa.nisn,
            kelas: selectedKelas,
            tanggal: tanggal,
            status: status,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `absensi/${docId}`);
        }
      });

      await Promise.all(promises);
      
      // Clear cache so that loadClassData fetches fresh data from Firestore
      clearCache();

      setSavedInfo({ tanggal, kelas: selectedKelas });
      setIsEditing(false);
      setHasSavedData(true);
      await loadClassData(selectedKelas, tanggal);
      await fetchMeetingsCountPerClass();
      showNotification(`Absensi Kelas ${selectedKelas} tanggal ${formatIndonesianDate(tanggal)} berhasil disimpan!`, "success");
    } catch (error) {
      console.error("Error saving attendance:", error);
      showNotification("Gagal menyimpan absensi. Pastikan Anda sudah login.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttendanceForDate = (targetDate: string) => {
    if (!selectedKelas) {
      showNotification("Silakan pilih kelas terlebih dahulu!", "error");
      return;
    }

    setDeleteConfirmation({
      isOpen: true,
      targetDate
    });
  };

  const confirmDeleteAttendance = async () => {
    const targetDate = deleteConfirmation.targetDate;
    if (!targetDate || !selectedKelas) return;

    setDeleteConfirmation({ isOpen: false, targetDate: '' });
    setLoading(true);
    try {
      // Collect all doc IDs to delete to ensure no orphans are left
      const docIdsToDelete = new Set<string>();

      // 1. Add deterministic IDs based on student list if available
      if (siswaList && siswaList.length > 0) {
        siswaList.forEach(siswa => {
          docIdsToDelete.add(`${targetDate}_${siswa.id}`);
        });
      }

      // 2. Query and add actual doc IDs matching the class and date
      try {
        const q = query(
          collection(db, 'absensi'),
          where('kelas', '==', selectedKelas),
          where('tanggal', '==', targetDate)
        );
        const querySnapshot = await getDocsFromServer(q);
        querySnapshot.forEach((docSnap) => {
          if (docSnap.id) {
            docIdsToDelete.add(docSnap.id);
          }
        });
      } catch (err) {
        console.warn("Failed to query documents to delete, relying on deterministic IDs:", err);
      }

      // 3. Perform batch deletion
      const promises = Array.from(docIdsToDelete).map(async (docId) => {
        const ref = doc(db, 'absensi', docId);
        await deleteDoc(ref);
      });

      await Promise.all(promises);
      
      // Clear cache so that loadClassData fetches fresh data from Firestore
      clearCache();
      
      // If the targetDate is the currently selected date, reset active attendance state
      if (tanggal === targetDate) {
        const initialAttendance: Record<string, AttendanceStatus> = {};
        siswaList.forEach(s => {
          initialAttendance[s.id] = 'Hadir';
        });
        setAttendance(initialAttendance);
        setIsEditing(true);
        setHasSavedData(false);
        setSavedInfo(null);
      }
      
      await loadClassData(selectedKelas, tanggal);
      await fetchMeetingsCountPerClass();
      showNotification(`Data presensi Kelas ${selectedKelas} tanggal ${formatIndonesianDate(targetDate)} berhasil dihapus.`, "success");
    } catch (error) {
      console.error("Error deleting attendance for date:", error);
      showNotification("Gagal menghapus data presensi.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttendance = async () => {
    await handleDeleteAttendanceForDate(tanggal);
  };

  const handleDownloadPreviewPdf = async () => {
    setDownloadingPdf(true);
    try {
      const isSemuaKelas = downloadType === 'total_semua';
      
      let absensiQuery;
      let siswaListToUse = siswaList;
      
      if (isSemuaKelas) {
        absensiQuery = query(collection(db, 'absensi'));
        const qSiswa = query(collection(db, 'siswa'));
        const querySnapshotSiswa = await getDocs(qSiswa);
        const allSiswa: Siswa[] = [];
        querySnapshotSiswa.forEach(doc => {
           allSiswa.push({ id: doc.id, ...doc.data() } as Siswa);
        });
        siswaListToUse = allSiswa;
      } else {
        absensiQuery = query(collection(db, 'absensi'), where('kelas', '==', selectedKelas));
      }
      
      const querySnapshot = await getDocs(absensiQuery);
      
      const statsMap: Record<string, StudentPreviewStats> = {};
      siswaListToUse.forEach(s => {
        statsMap[s.id] = {
          siswaId: s.id,
          namaSiswa: s.namaSiswa,
          nisn: s.nisn,
          kelas: s.kelas,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpa: 0,
          dispen: 0
        };
      });

      const uniqueDatesPerKelas: Record<string, Set<string>> = {};
      const allUniqueDates = new Set<string>();

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        if (data.tanggal) {
          let includeDate = false;
          if (downloadType === 'total' || downloadType === 'total_semua') {
            includeDate = true;
          } else if (downloadType === 'bulanan') {
            if (data.tanggal.startsWith(downloadMonth)) {
              includeDate = true;
            }
          } else if (downloadType === 'harian') {
            if (data.tanggal === downloadDate) {
              includeDate = true;
            }
          }

          if (includeDate) {
            allUniqueDates.add(data.tanggal);
            const dataKelas = data.kelas || selectedKelas;
            if (!uniqueDatesPerKelas[dataKelas]) {
              uniqueDatesPerKelas[dataKelas] = new Set();
            }
            uniqueDatesPerKelas[dataKelas].add(data.tanggal);

            if (data.siswaId && statsMap[data.siswaId]) {
              const status = data.status;
              if (status === 'Hadir') statsMap[data.siswaId].hadir++;
              else if (status === 'Sakit') statsMap[data.siswaId].sakit++;
              else if (status === 'Izin') statsMap[data.siswaId].izin++;
              else if (status === 'Alpa') statsMap[data.siswaId].alpa++;
              else if (status === 'Dispen') statsMap[data.siswaId].dispen++;
            }
          }
        }
      });

      // Sort by class then name
      const sortedStats = Object.values(statsMap).sort((a, b) => {
        const kelasA = a.kelas || '';
        const kelasB = b.kelas || '';
        if (kelasA !== kelasB) {
          return kelasA.localeCompare(kelasB, undefined, { numeric: true, sensitivity: 'base' });
        }
        return a.namaSiswa.localeCompare(b.namaSiswa, undefined, { numeric: true, sensitivity: 'base' });
      });

      let titleDate = '';
      if (downloadType === 'bulanan') {
        const [year, month] = downloadMonth.split('-');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        titleDate = `Bulan ${months[parseInt(month) - 1]} ${year}`;
      } else if (downloadType === 'harian') {
        titleDate = `Tanggal ${formatIndonesianDate(downloadDate)}`;
      } else if (downloadType === 'total_semua') {
        titleDate = `Total Keseluruhan Semua Kelas`;
      } else {
        titleDate = `Total Keseluruhan`;
      }

      let columns: string[];
      let data: any[][];
      let columnStyles: any;

      if (downloadType === 'harian') {
        columns = ['No', 'Nama Siswa', 'Kelas', 'Keterangan'];
        data = sortedStats.map((s, index) => {
          let keterangan = '-';
          if (s.hadir > 0) keterangan = 'Hadir';
          else if (s.sakit > 0) keterangan = 'Sakit';
          else if (s.izin > 0) keterangan = 'Izin';
          else if (s.alpa > 0) keterangan = 'Alpa';
          else if (s.dispen > 0) keterangan = 'Dispen';
          
          return [
            String(index + 1),
            s.namaSiswa,
            s.kelas || '-',
            keterangan
          ];
        });
        columnStyles = {
          0: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          1: { cellWidth: 'auto', overflow: 'linebreak' },
          2: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          3: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
        };
      } else if (isSemuaKelas) {
        columns = ['No', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Dispen', 'Persentase'];
        data = sortedStats.map((s, index) => {
          const sKelas = s.kelas || '';
          const totalHari = uniqueDatesPerKelas[sKelas] ? uniqueDatesPerKelas[sKelas].size : 0;
          const totalAttendance = s.hadir + s.dispen;
          const persentase = totalHari > 0 ? ((totalAttendance / totalHari) * 100).toFixed(1) + '%' : '0.0%';
          return [
            String(index + 1),
            s.namaSiswa,
            sKelas,
            String(s.hadir),
            String(s.sakit),
            String(s.izin),
            String(s.alpa),
            String(s.dispen),
            persentase
          ];
        });
        columnStyles = {
          0: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          1: { cellWidth: 'auto', overflow: 'linebreak' },
          2: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          3: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          4: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          5: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          6: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          7: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          8: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
        };
      } else {
        columns = ['No', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Dispen', 'Persentase'];
        data = sortedStats.map((s, index) => {
          const sKelas = s.kelas || selectedKelas;
          const totalHari = uniqueDatesPerKelas[sKelas] ? uniqueDatesPerKelas[sKelas].size : 0;
          const totalAttendance = s.hadir + s.dispen;
          const persentase = totalHari > 0 ? ((totalAttendance / totalHari) * 100).toFixed(1) + '%' : '0.0%';
          return [
            String(index + 1),
            s.namaSiswa,
            sKelas,
            String(s.hadir),
            String(s.sakit),
            String(s.izin),
            String(s.alpa),
            String(s.dispen),
            persentase
          ];
        });
        columnStyles = {
          0: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          1: { cellWidth: 'auto', overflow: 'linebreak' },
          2: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          3: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          4: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          5: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          6: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          7: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
          8: { halign: 'center', cellWidth: 'wrap', overflow: 'visible' },
        };
      }

      const pdfTitle = "REKAPITULASI KEHADIRAN SISWA";
      
      const profileDoc = await getDoc(doc(db, 'user_profile', 'main'));
      const profileData = profileDoc.exists() ? profileDoc.data() : {};
      
      let periodeStr = '';
      if (downloadType === 'harian') {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        // Parse downloadDate correctly avoiding timezone shift
        const [yr, mn, dy] = downloadDate.split('-').map(Number);
        const dateObj = new Date(yr, mn - 1, dy);
        const dayName = days[dateObj.getDay()];
        periodeStr = `${dayName}, ${formatIndonesianDate(downloadDate)}`;
      } else if (downloadType === 'bulanan') {
        const [year, month] = downloadMonth.split('-');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        periodeStr = `${months[parseInt(month) - 1]} ${year}`;
      } else {
        const sortedAllDates = Array.from(allUniqueDates).sort();
        if (sortedAllDates.length > 0) {
          const earliestDate = sortedAllDates[0];
          const latestDate = sortedAllDates[sortedAllDates.length - 1];
          if (earliestDate === latestDate) {
            periodeStr = formatFullDayAndDate(earliestDate);
          } else {
            periodeStr = `${formatFullDayAndDate(earliestDate)} sd ${formatFullDayAndDate(latestDate)}`;
          }
        } else {
          periodeStr = 'Semua Periode';
        }
      }

      await generatePDF(pdfTitle, columns, data, {
        orientation: 'portrait',
        format: 'f4',
        columnStyles,
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5
        }
      }, {
        namaKepala: profileData.namaKepala,
        nipKepala: profileData.nipKepala,
        namaGuru: profileData.nama,
        nipGuru: profileData.nipGuru,
        jabatan: profileData.jabatan,
        namaSekolah: profileData.namaSekolah,
        location: 'Cililin',
        kelas: isSemuaKelas ? 'Semua Kelas' : selectedKelas,
        semester: profileData.semester || '1 (Ganjil)',
        tahunPelajaran: profileData.tahunPelajaran || '2025/2026',
        periode: periodeStr,
        showMetadataTable: true
      });
      setShowDownloadModal(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      showNotification("Gagal menghasilkan PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

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

  const formatFullDayAndDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'Nopember', 'Desember'
    ];
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[0], 10);
    
    const dateObj = new Date(year, monthIndex, day);
    const dayName = days[dateObj.getDay()];
    return `${dayName} ${day} ${months[monthIndex]} ${year}`;
  };

  // Quick stats calculations for current attendance sheet
  const getStats = () => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    let dispen = 0;

    siswaList.forEach(s => {
      const status = attendance[s.id] || 'Hadir';
      if (status === 'Hadir') hadir++;
      else if (status === 'Sakit') sakit++;
      else if (status === 'Izin') izin++;
      else if (status === 'Alpa') alpa++;
      else if (status === 'Dispen') dispen++;
    });

    return { total: siswaList.length, hadir, sakit, izin, alpa, dispen };
  };

  const stats = getStats();

  const statusOptions: { value: AttendanceStatus; label: string; activeClass: string; bgClass: string; icon: any }[] = [
    { value: 'Hadir', label: 'Hadir', activeClass: 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20', bgClass: 'bg-emerald-50 text-[#F06C84] hover:bg-emerald-100/70', icon: Smile },
    { value: 'Sakit', label: 'Sakit', activeClass: 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20', bgClass: 'bg-amber-50 text-[#F06C84] hover:bg-amber-100/70', icon: Coffee },
    { value: 'Izin', label: 'Izin', activeClass: 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20', bgClass: 'bg-blue-50 text-[#F06C84] hover:bg-blue-100/70', icon: ChevronRight },
    { value: 'Alpa', label: 'Alpa', activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20', bgClass: 'bg-rose-50 text-rose-700 hover:bg-rose-100/70', icon: Frown },
    { value: 'Dispen', label: 'Dispen', activeClass: 'bg-[#F06C84] text-white shadow-lg shadow-[#F06C84]/20', bgClass: 'bg-purple-50 text-[#F06C84] hover:bg-purple-100/70', icon: Award },
  ];

  return (
    <>
      {/* Toast Notification */}
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
        {/* Header Block */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Absensi Siswa</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Atur dan kelola kehadiran siswa harian dengan praktis dan instan
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-blue-50 text-[#F06C84] text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl">
            <Users className="w-4 h-4" />
            SMPN 1 CILILIN
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" /> Tanggal Absensi
            </label>
            <input 
              type="date" 
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium"
            />
          </div>
          <div className="flex-1 w-full relative">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-gray-400" /> Pilih Kelas
            </label>
            
            <button
              type="button"
              onClick={() => setIsKelasDropdownOpen(!isKelasDropdownOpen)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/40"
            >
              <span className={selectedKelas ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                {selectedKelas || '-- Pilih Kelas --'}
              </span>
              <motion.div
                animate={{ rotate: isKelasDropdownOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-gray-400"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isKelasDropdownOpen && (
                <>
                  {/* Backdrop to close dropdown on click outside */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsKelasDropdownOpen(false)} />
                  
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 max-h-60 overflow-y-auto"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKelas("");
                        setIsKelasDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                        selectedKelas === "" 
                          ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>-- Pilih Kelas --</span>
                      {selectedKelas === "" && <Check className="w-4 h-4 text-[#F06C84]" />}
                    </button>
                    
                    {kelasList.map((k) => {
                      const isSelected = selectedKelas === k.namaKelas;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => {
                            setSelectedKelas(k.namaKelas);
                            setIsKelasDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                            isSelected 
                              ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full transition-transform duration-150 ${
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
          {selectedKelas && (
            <div className="w-full md:w-auto mt-4 md:mt-0">
              <button onClick={() => {
                setShowDownloadModal(true);
              }} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#F06C84] text-white rounded-xl hover:bg-[#F06C84] text-sm font-bold transition-all shadow-sm">
                <Download size={18} /> Download PDF
              </button>
            </div>
          )}
        </div>

        {/* Attendance Sheet or Instruction Placeholder */}
        {!selectedKelas ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
            <div className="bg-blue-50 p-4 rounded-3xl text-[#F06C84] mb-4">
              <Calendar className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Silakan Pilih Kelas</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm font-medium leading-relaxed">
              Pilih salah satu kelas dari menu pilihan di atas untuk memuat lembar absensi siswa pada tanggal yang ditentukan.
            </p>
          </div>
        ) : fetchingSiswa ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F06C84] border-t-transparent mb-4"></div>
            <p className="text-sm text-gray-500 font-medium">Memuat data siswa & status absensi...</p>
          </div>
        ) : siswaList.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
            <div className="bg-rose-50 p-4 rounded-3xl text-rose-500 mb-4">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Siswa Tidak Ditemukan</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm font-medium leading-relaxed">
              Belum ada data siswa yang terdaftar di kelas "{selectedKelas}". Silakan isi data siswa terlebih dahulu di tab "Data Siswa & Kelas".
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Attendance Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-50">
                <div>
                  <h3 className="font-bold text-gray-900">Lembar Absensi: Kelas {selectedKelas}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Tanggal: {formatIndonesianDate(tanggal)} • Total: {stats.total} siswa</span>
                    {fetchingAttendance && (
                      <span className="inline-flex items-center gap-1.5 text-[#F06C84] font-bold animate-pulse text-[11px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F06C84] animate-ping" />
                        Memuat absensi...
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('input')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                      viewMode === 'input' 
                        ? 'bg-white text-[#F06C84] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Lembar Absensi
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                      viewMode === 'preview' 
                        ? 'bg-white text-[#F06C84] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Preview Absensi
                  </button>
                </div>
              </div>

              {viewMode === 'input' ? (
                <>
                  {/* Table wrapper with custom scrollbars and stickiness */}
                  <div className="overflow-auto max-h-[500px] border border-gray-100 rounded-xl relative scrollbar-thin">
                    <table className="w-full text-left text-sm text-gray-500 border-collapse">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <tr>
                          <th className="px-4 py-3 bg-gray-50 w-12 text-center">No</th>
                          <th className="px-4 py-3 bg-gray-50">Nama Siswa</th>
                          <th className="px-4 py-3 bg-gray-50">NIS</th>
                          <th className="px-4 py-3 bg-gray-50 text-center w-[360px]">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className={`transition-opacity duration-200 ${fetchingAttendance ? 'opacity-45 pointer-events-none' : 'opacity-100'}`}>
                        {siswaList.map((s, idx) => {
                          const currentStatus = attendance[s.id] || 'Hadir';
                          return (
                            <tr key={s.id} className="bg-white border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{s.namaSiswa}</td>
                              <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">{s.nisn}</td>
                              <td className="px-4 py-2">
                                {/* Pill-based selector for status */}
                                <div className="flex items-center justify-center gap-1">
                                  {statusOptions.map((opt) => {
                                    const isSelected = currentStatus === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        disabled={!isEditing}
                                        onClick={() => handleStatusChange(s.id, opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 shrink-0 ${
                                          isSelected ? opt.activeClass : opt.bgClass
                                        } ${
                                          !isEditing ? 'opacity-40 cursor-not-allowed scale-95' : 'cursor-pointer hover:scale-105 active:scale-95'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
     
                  {/* Save & Edit Button Actions - aligned horizontally side-by-side */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100 w-full">
                    <button
                      onClick={handleDeleteAttendance}
                      disabled={!hasSavedData || loading}
                      className={`px-4 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-150 w-full sm:w-auto ${
                        hasSavedData && !loading
                          ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100/70 hover:text-rose-700 cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                          : 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus Presensi
                    </button>

                    <div className="flex gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setIsEditing(true)}
                        disabled={isEditing || loading}
                        className={`px-4 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-150 flex-1 sm:flex-none ${
                          !isEditing && !loading
                            ? 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
                        }`}
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Presensi
                      </button>
      
                      <button
                        onClick={handleSaveAttendance}
                        disabled={!isEditing || loading}
                        className={`px-4 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-150 flex-1 sm:flex-none ${
                          isEditing && !loading
                            ? 'bg-[#F06C84] hover:bg-[#F06C84]/90 text-white shadow-md shadow-[#F06C84]/15 cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
                        }`}
                      >
                        <Save className="w-4 h-4" />
                        {loading ? 'Menyimpan...' : 'Simpan Presensi'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="overflow-auto max-h-[500px] border border-gray-100 rounded-xl relative scrollbar-thin">
                  <table className="w-full text-left text-sm text-gray-500 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                      <tr>
                        <th className="px-4 py-3 bg-gray-50 w-12 text-center">No</th>
                        <th className="px-4 py-3 bg-gray-50">Nama Siswa</th>
                        <th className="px-4 py-3 bg-gray-50">NIS</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Hadir</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Sakit</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Izin</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Alpa</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Dispen</th>
                        <th className="px-4 py-3 bg-gray-50 text-center">Persentase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewStats.map((s, idx) => {
                        const totalAttendance = s.hadir + s.dispen;
                        const persentase = jumlahHariEfektif > 0 ? ((totalAttendance / jumlahHariEfektif) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={s.siswaId} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{s.namaSiswa}</td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">{s.nisn || '-'}</td>
                            <td className="px-4 py-3 text-center font-mono text-[#F06C84] font-bold">{s.hadir}</td>
                            <td className="px-4 py-3 text-center font-mono text-[#F06C84]">{s.sakit}</td>
                            <td className="px-4 py-3 text-center font-mono text-[#F06C84]">{s.izin}</td>
                            <td className="px-4 py-3 text-center font-mono text-[#F06C84]">{s.alpa}</td>
                            <td className="px-4 py-3 text-center font-mono text-[#F06C84]">{s.dispen}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800">{persentase}%</td>
                          </tr>
                        );
                      })}
                      {previewStats.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            Belum ada data absensi untuk kelas ini
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Persisted Info Frame: Keterangan Hari Efektif and 4-Column Completed Dates */}
              <div className="w-full mt-6 p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-100 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F06C84] animate-pulse shrink-0" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Keterangan Hari Efektif & Riwayat Presensi
                  </h4>
                </div>
                
                <div className="w-full">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-lg text-[#F06C84]">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jumlah Hari Efektif</p>
                      <p className="text-sm font-black text-slate-950 mt-0.5 flex items-center justify-between gap-2 flex-wrap">
                        <span>{jumlahHariEfektif} Pertemuan Efektif</span>
                        <span className="text-[10px] font-bold text-[#F06C84] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          + Bertambah Otomatis
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4-Column Layout for Completed Dates */}
                <div className="mt-5 pt-4 border-t border-blue-100/60">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Daftar Tanggal yang Sudah Melakukan Absensi ({absensiDates.length}) - Klik untuk Edit/Detail atau Hapus
                  </p>
                  {absensiDates.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Belum ada riwayat absensi untuk kelas ini.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {absensiDates.map((dateStr) => (
                        <div 
                          key={dateStr}
                          className={`flex items-center gap-1 rounded-xl border p-1 transition-all duration-150 shadow-2xs ${
                            dateStr === tanggal 
                              ? 'bg-blue-50/90 border-blue-300 ring-1 ring-[#F06C84]/10' 
                              : 'bg-white border-gray-100 hover:border-blue-100'
                          }`}
                        >
                          <button 
                            onClick={() => {
                              setTanggal(dateStr);
                              showNotification(`Memuat absensi tanggal ${formatIndonesianDate(dateStr)}`, "success");
                            }}
                            className={`flex-1 text-left px-2.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 overflow-hidden text-ellipsis ${
                              dateStr === tanggal 
                                ? 'text-blue-950 font-bold' 
                                : 'text-gray-700 hover:text-blue-950'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dateStr === tanggal ? 'bg-[#F06C84] animate-pulse' : 'bg-[#F06C84]'}`} />
                            <span className="truncate">{formatIndonesianDate(dateStr)}</span>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttendanceForDate(dateStr);
                            }}
                            disabled={loading}
                            title="Hapus presensi tanggal ini"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ringkasan Jumlah Pertemuan Berdasarkan Kelas */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-50">
                  <div className="p-2 bg-rose-50 rounded-lg text-[#F06C84]">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Jumlah Pertemuan Berdasarkan Kelas
                    </h4>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Total pertemuan (tanggal unik) yang telah terdaftar untuk masing-masing kelas
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {kelasList.map((k) => {
                    const count = meetingsByClass[k.namaKelas] || 0;
                    const isSelected = k.namaKelas === selectedKelas;
                    return (
                      <div 
                        key={k.id} 
                        className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                            : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Kelas {k.namaKelas}
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-2 flex items-baseline gap-1">
                          {count}
                          <span className="text-xs font-semibold text-gray-500">Pertemuan</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-md"
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Download Preview Absensi</h3>
              <button 
                onClick={() => setShowDownloadModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Jenis Laporan
                </label>
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/50"
                >
                  <span className="font-semibold text-gray-800">
                    {downloadType === 'total' && 'Rekap Total Keseluruhan (Kelas Saat Ini)'}
                    {downloadType === 'total_semua' && 'Rekap Total Keseluruhan (Semua Kelas)'}
                    {downloadType === 'bulanan' && 'Rekap Bulanan'}
                    {downloadType === 'harian' && 'Harian (Berdasarkan Tanggal)'}
                  </span>
                  <motion.div
                    animate={{ rotate: isTypeDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-400"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isTypeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsTypeDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1 overflow-hidden"
                      >
                        {[
                          { id: 'total', label: 'Rekap Total Keseluruhan (Kelas Saat Ini)' },
                          { id: 'total_semua', label: 'Rekap Total Keseluruhan (Semua Kelas)' },
                          { id: 'bulanan', label: 'Rekap Bulanan' },
                          { id: 'harian', label: 'Harian (Berdasarkan Tanggal)' }
                        ].map((opt) => {
                          const isSelected = downloadType === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setDownloadType(opt.id as any);
                                setIsTypeDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                                isSelected 
                                  ? 'bg-rose-50/70 text-[#F06C84] font-semibold' 
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {downloadType === 'bulanan' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Pilih Bulan
                  </label>
                  <input
                    type="month"
                    value={downloadMonth}
                    onChange={(e) => setDownloadMonth(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium"
                  />
                </div>
              )}

              {downloadType === 'harian' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Pilih Tanggal
                  </label>
                  <input
                    type="date"
                    value={downloadDate}
                    onChange={(e) => setDownloadDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all bg-gray-50/50 text-gray-700 font-medium"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDownloadPreviewPdf}
                disabled={downloadingPdf}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#F06C84] hover:bg-[#F06C84] rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {downloadingPdf ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Memproses...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 w-full max-w-md relative overflow-hidden"
            >
              {/* Decorative Accent Background */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
              
              {/* Warn Icon Header with Ripple Ring */}
              <div className="flex flex-col items-center text-center mt-2 mb-4">
                <div className="p-4 bg-rose-50 rounded-2xl text-rose-500 mb-4 ring-8 ring-rose-50/50">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Hapus Data Presensi</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Konfirmasi tindakan penghapusan permanen
                </p>
              </div>

              {/* Informative Body Card */}
              <div className="bg-gray-50/80 rounded-2xl p-4.5 mb-6 border border-gray-100 text-left space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus seluruh data presensi untuk kelas dan tanggal berikut?
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-3">
                  <div>
                    <span className="block text-gray-400 font-bold uppercase tracking-wider mb-0.5">Kelas</span>
                    <span className="font-bold text-gray-800 text-sm">{selectedKelas}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-bold uppercase tracking-wider mb-0.5">Tanggal</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {deleteConfirmation.targetDate ? formatIndonesianDate(deleteConfirmation.targetDate) : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Caution Warning Box */}
              <div className="flex gap-2.5 items-start bg-rose-50/50 border border-rose-100/70 p-3.5 rounded-xl mb-6">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 leading-normal font-medium">
                  <strong>Peringatan:</strong> Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Seluruh catatan absensi siswa pada kelas dan tanggal ini akan terhapus secara permanen.
                </p>
              </div>

              {/* Elegant Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation({ isOpen: false, targetDate: '' })}
                  className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200/80 rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAttendance}
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-200 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Permanen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
