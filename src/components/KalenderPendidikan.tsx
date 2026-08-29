import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Search,
  CalendarRange,
  Info,
} from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import { motion, AnimatePresence } from "framer-motion";

interface Activity {
  id: string;
  date: string; // YYYY-MM-DD
  activity: string;
  type: "Libur" | "Ujian" | "Event" | "Lainnya";
  createdAt: Timestamp;
}

const TYPE_COLORS = {
  Libur: "bg-red-100 text-red-800 border-red-200",
  Ujian: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Event: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Lainnya: "bg-gray-100 text-gray-800 border-gray-200",
};

const DOT_COLORS = {
  Libur: "bg-[#F06C84]",
  Ujian: "bg-[#F06C84]",
  Event: "bg-[#F06C84]",
  Lainnya: "bg-gray-500",
};

export default function KalenderPendidikan() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal & Form state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState("");
  const [activityType, setActivityType] = useState<Activity["type"]>("Lainnya");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Search filter for the bottom events table
  const [searchTerm, setSearchTerm] = useState("");

  // Toast / Alert State
  const [alert, setAlert] = useState<{ message: string; type: "success" | "danger" } | null>(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "kalender_pendidikan"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Activity,
      );
      setActivities(data);
    } catch (e) {
      console.error("Error fetching activities:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dayNames = ["M", "S", "S", "R", "K", "J", "S"];

  const getNationalHolidays = (year: number): Activity[] => {
    return [
      {
        id: `nh-1-${year}`,
        date: `${year}-01-01`,
        activity: "Tahun Baru Masehi",
        type: "Libur",
        createdAt: null as any,
      },
      {
        id: `nh-2-${year}`,
        date: `${year}-05-01`,
        activity: "Hari Buruh Internasional",
        type: "Libur",
        createdAt: null as any,
      },
      {
        id: `nh-3-${year}`,
        date: `${year}-06-01`,
        activity: "Hari Lahir Pancasila",
        type: "Libur",
        createdAt: null as any,
      },
      {
        id: `nh-4-${year}`,
        date: `${year}-08-17`,
        activity: "Hari Kemerdekaan RI",
        type: "Libur",
        createdAt: null as any,
      },
      {
        id: `nh-5-${year}`,
        date: `${year}-12-25`,
        activity: "Hari Raya Natal",
        type: "Libur",
        createdAt: null as any,
      },
    ];
  };

  const allActivities = [...activities, ...getNationalHolidays(currentYear)];

  // Filter activities to show only custom events created for currentYear
  const filteredCustomActivities = activities.filter((act) => {
    const actYear = new Date(act.date).getFullYear();
    const matchesSearch = act.activity.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          act.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          act.date.includes(searchTerm);
    return actYear === currentYear && matchesSearch;
  });

  const handleSubmit = async () => {
    if (!newActivity.trim() || !selectedDate) return;
    setIsSaving(true);
    setAlert(null);
    try {
      if (editingId) {
        await updateDoc(doc(db, "kalender_pendidikan", editingId), {
          date: selectedDate,
          activity: newActivity,
          type: activityType,
        });
        setEditingId(null);
        setAlert({ message: "Data Berhasil Diperbarui", type: "success" });
      } else {
        await addDoc(collection(db, "kalender_pendidikan"), {
          date: selectedDate,
          activity: newActivity,
          type: activityType,
          createdAt: Timestamp.now(),
        });
        setAlert({ message: "Data Berhasil Ditambahkan", type: "success" });
      }
      setNewActivity("");
      setActivityType("Lainnya");
      await fetchActivities();
      
      // Auto-clear alert banner after 3.5 seconds
      setTimeout(() => {
        setAlert(null);
      }, 3500);
    } catch (e) {
      console.error("Error saving activity:", e);
      setAlert({ message: "Gagal menyimpan data ke database.", type: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (activity: Activity) => {
    setSelectedDate(activity.date);
    setEditingId(activity.id);
    setActivityType(activity.type);
    setNewActivity(activity.activity);
  };

  const handleDelete = async () => {
    if (deleteId) {
      setIsSaving(true);
      try {
        await deleteDoc(doc(db, "kalender_pendidikan", deleteId));
        setAlert({ message: "Data Berhasil Dihapus", type: "success" });
        setDeleteId(null);
        await fetchActivities();
        
        // Auto-clear alert banner
        setTimeout(() => {
          setAlert(null);
        }, 3500);
      } catch (e) {
        console.error("Error deleting activity:", e);
        setAlert({ message: "Gagal menghapus data dari database.", type: "danger" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const closeDateModal = () => {
    setSelectedDate(null);
    setEditingId(null);
    setNewActivity("");
    setActivityType("Lainnya");
    setAlert(null);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-md border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-50 rounded-full blur-3xl opacity-60 -translate-y-1/3 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-gray-900 leading-tight">
              <CalendarIcon className="text-[#F06C84] w-8 h-8" />
              Kalender Pendidikan
            </h2>
            <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1.5 leading-relaxed">
              Kelola jadwal kegiatan belajar mengajar, agenda ujian, masa libur sekolah, dan seluruh event penting lainnya secara real-time.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-gray-50 hover:bg-gray-100/80 px-4.5 py-2.5 rounded-2xl border border-gray-200 shadow-sm transition-all self-stretch sm:self-auto justify-between">
            <button
              onClick={() => setCurrentYear((y) => y - 1)}
              className="p-1.5 hover:bg-white rounded-xl transition-all text-gray-500 hover:text-gray-900 shadow-sm hover:shadow cursor-pointer"
              title="Tahun Sebelumnya"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-lg font-black text-gray-800 w-16 text-center select-none font-mono tracking-wide">
              {currentYear}
            </span>
            <button
              onClick={() => setCurrentYear((y) => y + 1)}
              className="p-1.5 hover:bg-white rounded-xl transition-all text-gray-500 hover:text-gray-900 shadow-sm hover:shadow cursor-pointer"
              title="Tahun Berikutnya"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Legend / Petunjuk Warna */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t border-gray-100 mt-6 pt-5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Petunjuk Agenda:</span>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <span className="w-3 h-3 rounded-full bg-[#F06C84] animate-pulse" />
            <span>Agenda Sekolah (Libur / Ujian / Event)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Agenda Lainnya</span>
          </div>
        </div>
      </div>

      {/* Grid Bulanan */}
      {isLoading && activities.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 border border-gray-100 shadow-md flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-[#F06C84] animate-spin" />
          <p className="text-sm font-bold text-gray-500">Memuat data kalender akademik...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {months.map((monthName, monthIndex) => (
            <div
              key={monthIndex}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col"
            >
              <h3 className="font-extrabold text-gray-900 mb-4 text-center text-sm border-b border-gray-50 pb-2">
                {monthName}
              </h3>
              <div className="grid grid-cols-7 gap-1.5 text-center mb-2.5">
                {dayNames.map((day, i) => (
                  <div
                    key={i}
                    className={`text-xs font-bold ${i === 0 ? "text-[#F06C84]" : "text-gray-400"}`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center mt-1">
                {Array.from({
                  length: getFirstDayOfMonth(currentYear, monthIndex),
                }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {Array.from({
                  length: getDaysInMonth(currentYear, monthIndex),
                }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayActivities = allActivities.filter(
                    (a) => a.date === dateStr,
                  );
                  const isToday =
                    dateStr === new Date().toISOString().split("T")[0];
                  const isSunday =
                    new Date(currentYear, monthIndex, day).getDay() === 0;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        aspect-square flex flex-col items-center justify-center p-1 rounded-xl cursor-pointer transition-all relative group/cell select-none
                        ${isToday ? "bg-rose-50 border border-[#F06C84]/40 font-black text-[#F06C84]" : "hover:bg-gray-50"}
                        ${dayActivities.length > 0 ? "bg-[#F06C84]/5 font-black text-[#F06C84] ring-1 ring-[#F06C84]/20" : ""}
                        ${isSunday && !isToday ? "text-[#F06C84] font-black" : dayActivities.length > 0 ? "text-gray-900" : "text-gray-700"}
                      `}
                    >
                      <span className="text-xs z-10 relative">{day}</span>

                      {dayActivities.length > 0 && (
                        <>
                          <div className="flex flex-wrap justify-center gap-0.5 mt-1 z-10 relative">
                            {dayActivities.slice(0, 3).map((a, idx) => (
                              <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[a.type] || "bg-gray-400"}`}
                              />
                            ))}
                            {dayActivities.length > 3 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            )}
                          </div>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 w-52 p-3 bg-gray-900 text-white text-[11px] rounded-xl opacity-0 invisible group-hover/cell:opacity-100 group-hover/cell:visible transition-all duration-200 z-50 pointer-events-none shadow-xl border border-gray-850">
                            <div className="flex flex-col gap-2">
                              <p className="font-bold border-b border-gray-800 pb-1 text-gray-400">Agenda Hari Ini:</p>
                              {dayActivities.map((a, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${DOT_COLORS[a.type] || "bg-gray-400"}`} />
                                  <span className="leading-relaxed break-words font-medium">{a.activity} ({a.type})</span>
                                </div>
                              ))}
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EXTRA SECTION: Daftar Kegiatan Custom */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-[#F06C84] rounded-2xl">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">Daftar Agenda Kegiatan Custom ({currentYear})</h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Seluruh agenda khusus sekolah yang telah didaftarkan</p>
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari agenda atau jenis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all outline-none font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {filteredCustomActivities.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50/50 rounded-2xl border border-gray-100 border-dashed">
            <Info className="w-8 h-8 text-gray-300 mb-2.5" />
            <h4 className="text-xs font-bold text-gray-700">Tidak ada Agenda Kegiatan Custom ditemukan</h4>
            <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
              {searchTerm ? "Coba ganti kata kunci pencarian Anda." : `Silakan klik pada salah satu tanggal di kalender atas untuk menambahkan agenda baru untuk tahun ${currentYear}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
                  <th className="py-3 px-5">Tanggal</th>
                  <th className="py-3 px-5">Agenda Kegiatan</th>
                  <th className="py-3 px-5">Jenis</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium text-gray-750">
                {filteredCustomActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-5 font-bold font-mono text-gray-900 whitespace-nowrap">
                      {new Date(act.date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-5 font-semibold text-gray-800 break-words max-w-xs">{act.activity}</td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${TYPE_COLORS[act.type] || TYPE_COLORS.Lainnya}`}>
                        {act.type}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(act)}
                          className="p-1.5 text-gray-500 hover:text-[#F06C84] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Kegiatan"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(act.id)}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Kegiatan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  Agenda Kegiatan
                </h3>
                <p className="text-xs font-bold text-[#F06C84] mt-1">
                  {new Date(selectedDate).toLocaleDateString("id-ID", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={closeDateModal}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dynamic Success Alert Banner */}
            <AnimatePresence>
              {alert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-5 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 border bg-emerald-50 text-emerald-800 border-emerald-100"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>{alert.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add / Edit Form */}
            <div className="mb-8">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F06C84]" />
                {editingId ? "Edit Kegiatan" : "Tambah Kegiatan Baru"}
              </h4>
              <div className="flex flex-col gap-3.5">
                <input
                  type="text"
                  placeholder="Nama Kegiatan (contoh: Ujian Akhir Semester)..."
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  disabled={isSaving}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all outline-none disabled:cursor-not-allowed disabled:opacity-70"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={activityType}
                    onChange={(e) =>
                      setActivityType(e.target.value as Activity["type"])
                    }
                    disabled={isSaving}
                    className="flex-1 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#F06C84]/20 focus:border-[#F06C84] transition-all outline-none disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {Object.keys(TYPE_COLORS).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving || !newActivity.trim()}
                    className={`px-6 py-3.5 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
                      isSaving || !newActivity.trim()
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none"
                        : "bg-[#F06C84] hover:bg-[#d8556d]"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingId ? (
                      <Edit size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {isSaving ? "Menyimpan..." : editingId ? "Update" : "Simpan"}
                  </button>
                </div>
                {editingId && (
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setNewActivity("");
                      setActivityType("Lainnya");
                    }}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 text-xs font-bold transition-all disabled:cursor-not-allowed cursor-pointer"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </div>

            {/* List of Events for the Day */}
            <div>
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Daftar Kegiatan ({allActivities.filter((a) => a.date === selectedDate).length})
              </h4>
              <div className="space-y-3">
                {allActivities.filter((a) => a.date === selectedDate).length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-xs font-medium bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                    Tidak ada kegiatan pada tanggal ini.
                  </p>
                ) : (
                  allActivities
                    .filter((a) => a.date === selectedDate)
                    .map((activity) => (
                      <div
                        key={activity.id}
                        className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${TYPE_COLORS[activity.type] || TYPE_COLORS.Lainnya}`}
                          >
                            {activity.type}
                          </span>
                          <p className="font-semibold text-gray-800 mt-2 leading-relaxed text-xs break-words">
                            {activity.activity}
                          </p>
                        </div>
                        {!activity.id.startsWith("nh-") && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleEdit(activity)}
                              disabled={isSaving}
                              className="p-2 text-gray-400 hover:text-[#F06C84] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-55"
                              title="Edit Kegiatan"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteId(activity.id)}
                              disabled={isSaving}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-55"
                              title="Hapus Kegiatan"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation delete dialog */}
      <ConfirmationDialog
        isOpen={!!deleteId}
        title="Hapus Kegiatan"
        message="Apakah anda yakin ingin Menghapus?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
