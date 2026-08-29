import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc, updateDoc } from '../lib/firebase';
import { Plus, Trash2, CalendarClock, Edit, X, Clock } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';

interface Kelas {
  id: string;
  namaKelas: string;
}

interface Jadwal {
  id: string;
  day: string;
  time: string;
  subject: string;
  kelas: string;
  createdAt: Timestamp;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function JadwalMengajar() {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [day, setDay] = useState(DAYS[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [subject, setSubject] = useState('');
  const [kelas, setKelas] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const calculateDuration = (timeStr: string): string => {
    if (!timeStr) return '';
    const cleaned = timeStr.trim();
    const separators = [' - ', ' s/d ', ' sampai dengan ', ' sampai '];
    let parts: string[] = [];
    for (const sep of separators) {
      if (cleaned.includes(sep)) {
        parts = cleaned.split(sep);
        break;
      }
    }
    if (parts.length < 2 && cleaned.includes('-')) {
      parts = cleaned.split('-');
    }
    if (parts.length < 2) return '';

    const start = parts[0].trim();
    const end = parts[1].trim();

    const parseMinutes = (t: string): number | null => {
      const p = t.split(':');
      if (p.length < 2) return null;
      const h = parseInt(p[0], 10);
      const m = parseInt(p[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const startMin = parseMinutes(start);
    const endMin = parseMinutes(end);

    if (startMin === null || endMin === null) return '';

    let diff = endMin - startMin;
    if (diff < 0) {
      diff += 24 * 60;
    }

    const hours = Math.floor(diff / 60);
    const mins = diff % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
    }
    return `${mins} menit`;
  };

  useEffect(() => {
    fetchJadwal();
    fetchKelas();
  }, []);

  const fetchJadwal = async () => {
    const q = query(collection(db, 'jadwal_mengajar'), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jadwal));
    setJadwal(data);
  };

  const fetchKelas = async () => {
    try {
      const q = query(collection(db, 'kelas'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));
      setKelasList(list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true, sensitivity: 'base' })));
    } catch (error) {
      console.error("Error fetching kelas:", error);
    }
  };

  const handleSubmit = async () => {
    if (!startTime || !endTime || !subject || !kelas) return;
    const timeString = `${startTime} - ${endTime}`;
    if (editingId) {
      await updateDoc(doc(db, 'jadwal_mengajar', editingId), {
        day, time: timeString, subject, kelas
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'jadwal_mengajar'), {
        day, time: timeString, subject, kelas,
        createdAt: Timestamp.now()
      });
    }
    setStartTime('');
    setEndTime('');
    setSubject('');
    setKelas('');
    fetchJadwal();
  };

  const handleEdit = (j: Jadwal) => {
    setEditingId(j.id);
    setDay(j.day);
    setSubject(j.subject);
    setKelas(j.kelas);
    
    // Parse time string e.g., "08:00 - 09:30" or "08:00 sampai dengan 09:30"
    if (j.time && j.time.includes(' - ')) {
      const parts = j.time.split(' - ');
      setStartTime(parts[0] || '');
      setEndTime(parts[1] || '');
    } else if (j.time && j.time.includes(' s/d ')) {
      const parts = j.time.split(' s/d ');
      setStartTime(parts[0] || '');
      setEndTime(parts[1] || '');
    } else if (j.time && j.time.includes(' sampai dengan ')) {
      const parts = j.time.split(' sampai dengan ');
      setStartTime(parts[0] || '');
      setEndTime(parts[1] || '');
    } else {
      setStartTime(j.time || '');
      setEndTime('');
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'jadwal_mengajar', deleteId));
      setDeleteId(null);
      fetchJadwal();
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
        <CalendarClock className="text-[#F06C84]" />
        Jadwal Mengajar
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-5 bg-gray-50 rounded-2xl border border-gray-100/80">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Hari Mengajar</label>
          <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all">
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1.5 justify-center">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Durasi Jam Mengajar</label>
          <div className="flex flex-row items-center gap-2.5 h-full pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 shrink-0">Dari Jam</span>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="w-[110px] p-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all text-center" 
              />
            </div>
            <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider shrink-0">s.d</span>
            <div className="flex items-center gap-2">
              <input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                className="w-[110px] p-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all text-center" 
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mata Pelajaran</label>
          <input 
            type="text" 
            placeholder="e.g., Matematika" 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)} 
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all" 
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Kelas</label>
          <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all">
            <option value="">Pilih Kelas</option>
            {kelasList.map(k => (
              <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
            ))}
            {kelasList.length === 0 && (
              <option value="" disabled>Belum ada kelas</option>
            )}
          </select>
        </div>

        <div className="col-span-1 sm:col-span-2 md:col-span-4 flex flex-wrap gap-2 pt-2">
          <button 
            onClick={handleSubmit} 
            className="flex-1 min-w-[140px] py-3 px-5 bg-[#F06C84] hover:bg-[#d85e75] text-white rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> {editingId ? 'Update' : 'Tambah'} Jadwal
          </button>
          {editingId && (
            <button 
              onClick={() => { setEditingId(null); setStartTime(''); setEndTime(''); setSubject(''); setKelas(''); }} 
              className="flex-1 min-w-[140px] py-3 px-5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold transition-all"
            >
              <X size={18} /> Batal
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {DAYS.map(d => {
          const dayJadwal = jadwal.filter(j => j.day === d);
          if (dayJadwal.length === 0) return null;
          return (
            <div key={d}>
              <h3 className="font-bold text-gray-700 mb-2">{d}</h3>
              <div className="space-y-2">
                {dayJadwal.map(j => (
                  <div key={j.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50/60 shadow-sm gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-extrabold text-[#F06C84] bg-[#F06C84]/5 px-3 py-1 rounded-xl text-sm border border-[#F06C84]/10">{j.time}</span>
                      {calculateDuration(j.time) && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-xl text-xs font-extrabold border border-blue-100/50">
                          <Clock className="w-3.5 h-3.5" /> {calculateDuration(j.time)}
                        </span>
                      )}
                      <span className="text-gray-400 font-bold">•</span>
                      <span className="font-semibold text-gray-800">{j.subject}</span>
                      <span className="text-xs text-[#F06C84] font-extrabold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100/50">
                        Kelas {j.kelas}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <button onClick={() => handleEdit(j)} className="text-gray-400 hover:text-[#F06C84]">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => setDeleteId(j.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmationDialog 
        isOpen={!!deleteId}
        title="Hapus Jadwal"
        message="Apakah Anda yakin ingin menghapus jadwal ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
