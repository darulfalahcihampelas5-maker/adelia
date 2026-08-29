import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, addDoc, getDocs, query, where, Timestamp, orderBy, updateDoc, deleteDoc, doc, setDoc, getDoc } from '../lib/firebase';
import { BookOpen, Users, Save, CheckCircle2, UserX, Edit, Trash2, X, Download, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationDialog from './ConfirmationDialog';
import { generatePDF } from '../lib/pdfUtils';

interface Kelas {
  id: string;
  namaKelas: string;
}

interface Absensi {
  siswaId: string;
  namaSiswa: string;
  status: string;
  kelas: string;
}

interface Agenda {
  id: string;
  tanggal: string;
  kelas: string;
  materi: string;
  tugasType: string;
  tugasDetail: string;
  linkDrive?: string;
  siswaTidakMasuk?: string[];
}

export default function BukuAgendaGuru() {
  const [kelas, setKelas] = useState('');
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [materi, setMateri] = useState('');
  const [tugasType, setTugasType] = useState('Individu');
  const [tugasDetail, setTugasDetail] = useState('');
  const [linkDrive, setLinkDrive] = useState('');
  const [absentStudents, setAbsentStudents] = useState<Absensi[]>([]);
  const [loading, setLoading] = useState(false);
  const [agendaList, setAgendaList] = useState<Agenda[]>([]);

  const [isKelasOpen, setIsKelasOpen] = useState(false);
  const [isTugasTypeOpen, setIsTugasTypeOpen] = useState(false);
  const [isFilterKelasOpen, setIsFilterKelasOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);

  const isDuplicateEntry = useMemo(() => {
    if (!editingId && tanggal && kelas) {
      return agendaList.some(a => a.tanggal === tanggal && a.kelas === kelas);
    }
    return false;
  }, [tanggal, kelas, agendaList, editingId]);

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, 'kelas'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));
      setKelasList(list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true, sensitivity: 'base' })));
      fetchAgenda();
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (kelas && tanggal) {
      fetchAbsentStudents();
    }
  }, [kelas, tanggal]);

  const fetchAgenda = async () => {
    const q = query(collection(db, 'buku_agenda'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agenda));
    
    // Fetch absent students for all these agendas
    // To avoid too many queries, we could query all absensi for the dates present in the agenda
    const tanggals = [...new Set(data.map(a => a.tanggal))];
    
    // Firestore 'in' query allows max 10 elements, so we'll chunk it or just do individual queries
    // Let's do individual queries per unique date since it might be < 10 dates usually, or we can just fetch all absensi if it's small, but individual queries by date is safer
    
    const absensiMap: Record<string, string[]> = {};
    
    await Promise.all(tanggals.map(async (tgl) => {
      const absQuery = query(collection(db, 'absensi'), where('tanggal', '==', tgl));
      const absSnap = await getDocs(absQuery);
      absSnap.forEach(doc => {
        const absData = doc.data();
        if (absData.status !== 'Hadir') {
          const key = `${tgl}_${absData.kelas}`;
          if (!absensiMap[key]) absensiMap[key] = [];
          absensiMap[key].push(`${absData.namaSiswa} (${absData.status})`);
        }
      });
    }));

    const enrichedData = data.map(agenda => ({
      ...agenda,
      siswaTidakMasuk: absensiMap[`${agenda.tanggal}_${agenda.kelas}`] || []
    }));

    setAgendaList(enrichedData);
  };

  const fetchAbsentStudents = async () => {
    const q = query(collection(db, 'absensi'), where('tanggal', '==', tanggal));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data() as Absensi);
    const absent = records.filter(r => r.kelas === kelas && r.status !== 'Hadir');
    setAbsentStudents(absent);
  };

  const handleSave = async () => {
    if (!kelas || !materi) return;

    if (!editingId) {
      const isDuplicate = agendaList.some(a => a.tanggal === tanggal && a.kelas === kelas);
      if (isDuplicate) {
        setShowDuplicateAlert(true);
        setTimeout(() => setShowDuplicateAlert(false), 3000);
        return;
      }
    }

    setLoading(true);
    if (editingId) {
      await setDoc(doc(db, 'buku_agenda', editingId), {
        tanggal, kelas, materi, tugasType, tugasDetail, linkDrive
      }, { merge: true });
      setSuccessMsg('Agenda berhasil diupdate');
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'buku_agenda'), {
        tanggal, kelas, materi, tugasType, tugasDetail, linkDrive,
        createdAt: Timestamp.now()
      });
      setSuccessMsg('Buku Agenda Guru Berhasil disimpan');
    }
    setMateri('');
    setTugasDetail('');
    setLinkDrive('');
    setLoading(false);
    fetchAgenda();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleEdit = (agenda: Agenda) => {
    setEditingId(agenda.id);
    setTanggal(agenda.tanggal);
    setKelas(agenda.kelas);
    setMateri(agenda.materi);
    setTugasType(agenda.tugasType);
    setTugasDetail(agenda.tugasDetail);
    setLinkDrive(agenda.linkDrive || '');
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'buku_agenda', deleteId));
      setDeleteId(null);
      fetchAgenda();
      setSuccessMsg('Agenda berhasil dihapus');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const [filterKelas, setFilterKelas] = useState('Semua');

  // ... rest of the code

  const handleGeneratePDF = async () => {
    setLoading(true);
    const filteredAgenda = filterKelas === 'Semua' ? agendaList : agendaList.filter(a => a.kelas === filterKelas);
    
    if (filteredAgenda.length === 0) {
        setErrorMsg('Maaf, untuk kelas tersebut belum ada data.');
        setLoading(false);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
    }

    const columns = ['No.', 'Tanggal', 'Materi', 'Jenis Tugas', 'Kelas', 'Detail Tugas', 'Link Drive', 'Siswa Tidak Hadir'];
    const data = await Promise.all(filteredAgenda.map(async (a, index) => {
        const q = query(collection(db, 'absensi'), where('tanggal', '==', a.tanggal));
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => doc.data() as Absensi);
        const absent = records.filter(r => r.kelas === a.kelas && r.status !== 'Hadir');
        const statusMap: Record<string, string> = {
            'Sakit': 'S',
            'Izin': 'I',
            'Alpa': 'A',
            'Dispen': 'D'
        };
        const absentText = absent.length > 0 
            ? absent.map((s, idx) => `${idx + 1}. ${s.namaSiswa} (${statusMap[s.status] || s.status})`).join('\n')
            : 'Hadir Semua';
        return [
            String(index + 1),
            a.tanggal,
            a.materi,
            a.tugasType,
            a.kelas,
            a.tugasDetail,
            a.linkDrive || '-',
            absentText
        ];
    }));

    const profileDoc = await getDoc(doc(db, 'user_profile', 'main'));
    const profileData = profileDoc.exists() ? profileDoc.data() : {};

    await generatePDF('Buku Agenda Guru', columns, data, {
        columnStyles: {
            0: { halign: 'center' }, // No.
            1: { halign: 'center' }, // Tanggal
            2: { halign: 'center' }, // Materi
            3: { halign: 'center' }, // Jenis Tugas
            4: { halign: 'center' }, // Kelas
        }
    }, {
        namaKepala: profileData.namaKepala,
        nipKepala: profileData.nipKepala,
        namaGuru: profileData.nama,
        nipGuru: profileData.nipGuru,
        jabatan: profileData.jabatan,
        namaSekolah: profileData.namaSekolah,
        location: 'Cililin'
    });
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 flex items-center justify-between gap-2 text-gray-800">
        <div className="flex items-center gap-2">
          <BookOpen className="text-[#F06C84]" />
          Buku Agenda Guru
        </div>
      </h2>
      {successMsg && <div className="mb-4 p-4 bg-green-100 text-[#F06C84] rounded-lg">{successMsg}</div>}
      {errorMsg && <div className="mb-4 p-4 bg-red-100 text-[#F06C84] rounded-lg">{errorMsg}</div>}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full p-2 border rounded-lg" />
          {/* Pilih Kelas Custom Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsKelasOpen(!isKelasOpen)}
              className="w-full p-2.5 border border-gray-200 rounded-xl bg-white text-gray-700 text-sm font-medium flex items-center justify-between cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84]"
            >
              <span className={kelas ? 'text-gray-800 font-semibold' : 'text-gray-400'}>
                {kelas || 'Pilih Kelas'}
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
                      className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        kelas === "" ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>Pilih Kelas</span>
                      {kelas === "" && <Check className="w-4 h-4 text-[#F06C84]" />}
                    </button>
                    {kelasList.map(k => {
                      const isSelected = kelas === k.namaKelas;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => { setKelas(k.namaKelas); setIsKelasOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
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

          {isDuplicateEntry && (
            <p className="text-red-500 text-sm font-medium">
              Maaf, untuk tanggal tersebut di kelas ini sudah dicatat di buku agenda.
            </p>
          )}
          <textarea placeholder="Materi" value={materi} onChange={e => setMateri(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl h-24 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] text-sm" />

          {/* Jenis Tugas Custom Dropdown */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Jenis Tugas</label>
            <button
              type="button"
              onClick={() => setIsTugasTypeOpen(!isTugasTypeOpen)}
              className="w-full p-2.5 border border-gray-200 rounded-xl bg-white text-gray-800 text-sm font-semibold flex items-center justify-between cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84]"
            >
              <span>{tugasType}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isTugasTypeOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isTugasTypeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTugasTypeOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-150 py-1 overflow-hidden"
                  >
                    {['Individu', 'Kelompok'].map((type) => {
                      const isSelected = tugasType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => { setTugasType(type); setIsTugasTypeOpen(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected ? 'bg-rose-50/70 text-[#F06C84] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Tugas {type}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#F06C84]" />}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <textarea placeholder="Detail Tugas" value={tugasDetail} onChange={e => setTugasDetail(e.target.value)} className="w-full p-2 border rounded-lg h-24" />
          <input type="url" placeholder="Link Drive Kegiatan Pembelajaran" value={linkDrive} onChange={e => setLinkDrive(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
        </div>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl border">
            <h3 className="font-bold flex items-center gap-2 mb-4"><UserX /> Siswa Tidak Masuk</h3>
            {absentStudents.length > 0 ? (
              <ul className="list-disc pl-5">
                {absentStudents.map((s, i) => <li key={i}>{s.namaSiswa} ({s.status})</li>)}
              </ul>
            ) : <p className="text-gray-500 italic">Semua siswa hadir atau belum ada data presensi.</p>}
          </div>
          <button onClick={handleSave} disabled={loading || isDuplicateEntry} className={`w-full p-2 text-white rounded-lg ${loading || isDuplicateEntry ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#F06C84] hover:bg-[#d85e75]'}`}>
            {loading ? 'Menyimpan...' : editingId ? 'Update Agenda' : 'Simpan Agenda'}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setMateri(''); setTugasDetail(''); setLinkDrive(''); }} className="w-full p-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
              Batal Edit
            </button>
          )}
        </div>
      </div>


      <div className="mt-8 space-y-4">
        <h3 className="text-xl font-bold">Riwayat Agenda</h3>
        <div className="max-h-[500px] overflow-auto pr-2">
          <div className="space-y-4">
            {agendaList.map(a => (
              <div key={a.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50 min-w-[600px]">
                <div>
                  <p className="font-bold">{a.tanggal} - {a.kelas}</p>
                  <p className="text-sm text-gray-600">{a.materi}</p>
                  <p className="text-xs text-gray-500">{a.tugasType}: {a.tugasDetail}</p>
                  {a.linkDrive && (
                    <a 
                      href={a.linkDrive} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-blue-600 hover:underline inline-block mt-1"
                    >
                      Drive: {a.linkDrive}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(a)} className="text-[#F06C84] hover:text-[#F06C84]"><Edit size={18}/></button>
                  <button onClick={() => setDeleteId(a.id)} className="text-red-500 hover:text-red-600"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800 pb-1">
            <BookOpen className="text-blue-600 w-6 h-6" /> 
            Preview PDF
          </h3>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Filter Kelas</label>
            <div className="flex items-center gap-3">
              <div className="relative w-44">
                <button
                  type="button"
                  onClick={() => setIsFilterKelasOpen(!isFilterKelasOpen)}
                  className="w-full p-2 border border-gray-300 rounded-xl bg-white text-xs font-semibold text-gray-700 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20"
                >
                  <span className="truncate">{filterKelas === 'Semua' ? 'Semua Kelas' : filterKelas}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isFilterKelasOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isFilterKelasOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsFilterKelasOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 z-50 max-h-56 overflow-y-auto"
                      >
                        <button
                          type="button"
                          onClick={() => { setFilterKelas("Semua"); setIsFilterKelasOpen(false); }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                            filterKelas === 'Semua' ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>Semua Kelas</span>
                          {filterKelas === 'Semua' && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                        </button>
                        {kelasList.map(k => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => { setFilterKelas(k.namaKelas); setIsFilterKelasOpen(false); }}
                            className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                              filterKelas === k.namaKelas ? 'bg-rose-50 text-[#F06C84]' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>{k.namaKelas}</span>
                            {filterKelas === k.namaKelas && <Check className="w-3.5 h-3.5 text-[#F06C84]" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={handleGeneratePDF} disabled={loading} className="flex items-center justify-center gap-2 px-4 py-2 bg-[#F06C84] text-white rounded-lg hover:bg-[#d85e75] text-sm shadow-sm transition-colors h-[38px]">
                <Download size={16} /> {loading ? 'Memproses...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="bg-[#eff6ff] text-blue-900 font-semibold border-b border-black">
                <tr>
                  <th className="px-4 py-3 border-r border-black text-center w-10 whitespace-nowrap">No</th>
                  <th className="px-4 py-3 border-r border-black text-center whitespace-nowrap">Tanggal</th>
                  <th className="px-4 py-3 border-r border-black text-center whitespace-nowrap">Kelas</th>
                  <th className="px-4 py-3 border-r border-black text-center">Materi</th>
                  <th className="px-4 py-3 border-r border-black text-center whitespace-nowrap">Jenis Tugas</th>
                  <th className="px-4 py-3 border-r border-black text-center">Detail Tugas</th>
                  <th className="px-4 py-3 border-r border-black text-center">Link Drive</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Siswa Tidak Hadir</th>
                </tr>
              </thead>
              <tbody>
                {(filterKelas === 'Semua' ? agendaList : agendaList.filter(a => a.kelas === filterKelas)).map((item, index) => (
                  <tr key={item.id} className="border-b border-black hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 border-r border-black text-center text-gray-800 bg-gray-50/50">{index + 1}</td>
                    <td className="px-4 py-3 border-r border-black whitespace-nowrap font-medium text-gray-800">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 border-r border-black whitespace-nowrap">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">{item.kelas}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-black min-w-[200px] leading-relaxed">{item.materi}</td>
                    <td className="px-4 py-3 border-r border-black whitespace-nowrap text-gray-800">
                      {item.tugasType}
                    </td>
                    <td className="px-4 py-3 border-r border-black min-w-[200px] leading-relaxed">{item.tugasDetail}</td>
                    <td className="px-4 py-3 border-r border-black min-w-[150px] text-center">
                      {item.linkDrive ? (
                        <a 
                          href={item.linkDrive} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-colors text-xs font-semibold rounded-lg"
                        >
                          Buka Drive
                        </a>
                      ) : (
                        <span className="text-gray-400 italic text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-800">
                      {item.siswaTidakMasuk && item.siswaTidakMasuk.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {item.siswaTidakMasuk.map((siswa, idx) => (
                            <span key={idx}>{idx + 1}. {siswa}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-800">Siswa Hadir Semua</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(filterKelas === 'Semua' ? agendaList : agendaList.filter(a => a.kelas === filterKelas)).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500 bg-gray-50">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-8 h-8 text-gray-300" />
                        <p>Tidak ada data agenda untuk ditampilkan.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmationDialog 
        isOpen={!!deleteId}
        title="Hapus Agenda"
        message="Apakah Anda yakin ingin menghapus agenda ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {showDuplicateAlert && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
            <UserX className="w-6 h-6" />
            <div>
              <p className="font-bold text-lg">Gagal Menyimpan</p>
              <p className="text-sm opacity-90">Hari Tersebut Sudah digunakan di Kelas {kelas}!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
