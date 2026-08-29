import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc, getDoc } from '../lib/firebase';
import { Book, Plus, Trash2, Download, Bot, X, Check, Eye, FileText, FileDown, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ConfirmationDialog from './ConfirmationDialog';
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';

export default function ModulAjar() {
  const [modulList, setModulList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [formData, setFormData] = useState({
    mataPelajaran: '',
    kelas: '',
    semester: '',
    topik: '',
    alokasiWaktu: '',
    tujuanPembelajaran: '',
    profilPelajarPancasila: ''
  });

  const [generatedContent, setGeneratedContent] = useState('');
  const [viewingModul, setViewingModul] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>({});
  const [pdfFile, setPdfFile] = useState<{ name: string; data: string } | null>(null);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Hanya file PDF yang diperbolehkan.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("Ukuran file maksimal adalah 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPdfFile({
          name: file.name,
          data: reader.result
        });
      }
    };
    reader.onerror = () => {
      alert("Gagal membaca file.");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchData();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const profileDoc = await getDoc(doc(db, 'user_profile', 'main'));
    if (profileDoc.exists()) {
      setProfileData(profileDoc.data());
    }
  };

  const fetchData = async () => {
    const q = query(collection(db, 'modul_ajar'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setModulList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleGenerate = async () => {
    if (!formData.mataPelajaran || !formData.topik) return;
    
    setIsGenerating(true);
    try {
      const promptData = {
        ...formData,
        namaGuru: profileData.nama || 'Guru',
        namaSekolah: profileData.namaSekolah || 'Sekolah',
        kepalaSekolah: profileData.namaKepala || 'Kepala Sekolah'
      };

      const response = await fetch('/api/generate-modul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          promptData,
          pdfFile: pdfFile ? { name: pdfFile.name, data: pdfFile.data } : null
        })
      });
      
      let data: any;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // Jika response bukan JSON (misal 504 Gateway Timeout berupa HTML)
        if (response.status === 504 || response.status === 502) {
          throw new Error('Waktu pembuatan modul habis (Timeout). Coba kurangi ukuran file PDF referensi atau sederhanakan topik.');
        } else {
          throw new Error(`Respon server tidak valid (${response.status}): ${responseText.substring(0, 100)}...`);
        }
      }

      if (response.ok && data.result) {
        setGeneratedContent(data.result);
      } else {
        const errorMsg = data.error || 'Gagal menghasilkan modul dengan AI.';
        alert(`Gagal: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error(error);
      alert(`Terjadi kesalahan: ${error.message || error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedContent) return;
    const namaModul = `${formData.mataPelajaran} - ${formData.topik}`;
    await addDoc(collection(db, 'modul_ajar'), { 
      namaModul, 
      content: generatedContent, 
      createdAt: Timestamp.now() 
    });
    setGeneratedContent('');
    setShowForm(false);
    setFormData({
      mataPelajaran: '',
      kelas: '',
      semester: '',
      topik: '',
      alokasiWaktu: '',
      tujuanPembelajaran: '',
      profilPelajarPancasila: ''
    });
    setPdfFile(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDoc(doc(db, 'modul_ajar', deleteId));
      setDeleteId(null);
      fetchData();
    }
  };

  const handleExportWord = async (modul: any) => {
    const dateStr = `${profileData.location || 'Cililin'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    
    const signatureHtml = `
      <br><br>
      <table class="signature-table" style="width: 100%; border: none; margin-top: 30pt; page-break-inside: avoid; font-family: 'Times New Roman', Times, serif; font-size: 12pt; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; border: none; text-align: left; padding: 0 0 4pt 0;">Mengetahui,</td>
          <td style="width: 50%; border: none; text-align: left; padding: 0 0 4pt 0;">${dateStr}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none; text-align: left; padding: 0 0 100px 0;">Kepala Sekolah</td>
          <td style="width: 50%; border: none; text-align: left; padding: 0 0 100px 0;">Guru Mata Pelajaran ${profileData.jabatan || ''}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none; text-align: left; padding: 0; font-weight: bold; line-height: 1.1; margin: 0;">${profileData.namaKepala || '.......................'}</td>
          <td style="width: 50%; border: none; text-align: left; padding: 0; font-weight: bold; line-height: 1.1; margin: 0;">${profileData.nama || '.......................'}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none; text-align: left; padding: 4px 0 0 0; line-height: 1.1; margin: 0;">NIP. ${profileData.nipKepala || '.......................'}</td>
          <td style="width: 50%; border: none; text-align: left; padding: 4px 0 0 0; line-height: 1.1; margin: 0;">NIP. ${profileData.nipGuru || '.......................'}</td>
        </tr>
      </table>
    `;

    const cleanContent = (modul.content || '')
      .replace(/Mengetahui,[\s\S]*?(Kepala Sekolah|Guru Mata Pelajaran)[\s\S]*/gi, '')
      .replace(/Cililin\s*,\s*[a-zA-Z]+\s+\d{4}[\s\S]*/gi, '')
      .trim();
    const htmlContent = await marked(cleanContent);
    const htmlString = `
      <html xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns:m="http://schemas-microsoft.com/office/2004/12/omml"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset='utf-8'>
        <title>${modul.namaModul}</title>
        <style>
          @page WordSection1 {
            size: 21cm 29.7cm;
            margin: 2cm 2cm 2cm 2cm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.WordSection1 {
            page: WordSection1;
          }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 12pt; 
            line-height: 1.5; 
            color: black;
          }
          h1 { 
            font-size: 16pt; 
            font-weight: bold; 
            text-align: center; 
            margin-bottom: 24pt; 
            text-transform: uppercase; 
          }
          h2 { 
            font-size: 14pt; 
            font-weight: bold; 
            margin-top: 18pt; 
            margin-bottom: 12pt; 
            text-transform: uppercase;
          }
          h3 { 
            font-size: 12pt; 
            font-weight: bold; 
            margin-top: 12pt; 
            margin-bottom: 6pt; 
          }
          p { 
            margin-bottom: 10pt; 
            text-align: justify; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 12pt; 
          }
          th, td { 
            border: 1pt solid windowtext; 
            padding: 6pt; 
            text-align: left; 
          }
          ul, ol { 
            margin-left: 20pt; 
            margin-bottom: 10pt; 
          }
          li { 
            margin-bottom: 4pt; 
            text-align: justify; 
          }
          strong {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          ${htmlContent}
          ${signatureHtml}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlString], {
        type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${modul.namaModul}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async (modul: any) => {
    const dateStr = `${profileData.location || 'Cililin'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    
    const signatureHtml = `
      <br><br>
      <table class="signature-table" style="width: 100%; border: none !important; margin-top: 30pt; page-break-inside: avoid; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; font-size: 12pt;">
        <tr>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 0 4px 0 !important; line-height: 1.2 !important;">Mengetahui,</td>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 0 4px 0 !important; line-height: 1.2 !important;">${dateStr}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 0 100px 0 !important; line-height: 1.2 !important;">Kepala Sekolah</td>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 0 100px 0 !important; line-height: 1.2 !important;">Guru Mata Pelajaran ${profileData.jabatan || ''}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 !important; font-weight: bold; line-height: 1.1 !important; margin: 0 !important;">${profileData.namaKepala || '.......................'}</td>
          <td style="width: 50%; border: none !important; text-align: left; padding: 0 !important; font-weight: bold; line-height: 1.1 !important; margin: 0 !important;">${profileData.nama || '.......................'}</td>
        </tr>
        <tr>
          <td style="width: 50%; border: none !important; text-align: left; padding: 4px 0 0 0 !important; line-height: 1.1 !important; margin: 0 !important;">NIP. ${profileData.nipKepala || '.......................'}</td>
          <td style="width: 50%; border: none !important; text-align: left; padding: 4px 0 0 0 !important; line-height: 1.1 !important; margin: 0 !important;">NIP. ${profileData.nipGuru || '.......................'}</td>
        </tr>
      </table>
    `;

    const cleanContent = (modul.content || '')
      .replace(/Mengetahui,[\s\S]*?(Kepala Sekolah|Guru Mata Pelajaran)[\s\S]*/gi, '')
      .replace(/Cililin\s*,\s*[a-zA-Z]+\s+\d{4}[\s\S]*/gi, '')
      .trim();
    const htmlContent = await marked(cleanContent);
    
    const element = document.createElement('div');
    element.innerHTML = htmlContent + signatureHtml;
    element.style.fontFamily = "'Times New Roman', Times, serif";
    element.style.fontSize = "12pt";
    element.style.color = "black";
    element.style.padding = "10px"; // internal padding, html2pdf has margins
    
    element.className = 'pdf-export-container';
    
    const style = document.createElement('style');
    style.className = 'pdf-export-style';
    style.innerHTML = `
      .pdf-export-container h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 24pt; text-transform: uppercase; }
      .pdf-export-container h2 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 12pt; text-transform: uppercase; }
      .pdf-export-container h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
      .pdf-export-container p { margin-bottom: 10pt; text-align: justify; line-height: 1.5; }
      .pdf-export-container table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
      .pdf-export-container th, .pdf-export-container td { border: 1pt solid black; padding: 6pt; text-align: left; }
      .pdf-export-container table.signature-table td { border: none !important; }
      .pdf-export-container ul, .pdf-export-container ol { margin-left: 20pt; margin-bottom: 10pt; }
      .pdf-export-container li { margin-bottom: 4pt; text-align: justify; line-height: 1.5; }
      .pdf-export-container table td[style*="border: none"] { border: none !important; }
    `;
    element.appendChild(style);

    const opt = {
      margin:       [20, 20, 20, 20] as [number, number, number, number],
      filename:     `${modul.namaModul}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        onclone: (document) => {
          // Remove all stylesheets to prevent html2canvas from crashing on Tailwind v4 oklch colors
          const stylesheets = document.querySelectorAll('link[rel="stylesheet"], style:not(.pdf-export-style)');
          stylesheets.forEach(sheet => sheet.remove());
        }
      },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-screen">
      <div className="mb-6 space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Book className="text-[#F06C84]" />
          Modul Ajar (AI Generated)
        </h2>
        
        {!showForm && !viewingModul && (
          <button 
            onClick={() => setShowForm(true)} 
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[#eff6ff] text-blue-900 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 font-bold transition-all shadow-sm group"
          >
            <div className="bg-[#F06C84] p-1.5 rounded-lg text-white group-hover:bg-[#d05c74] transition-colors shadow-sm">
              <Plus size={20} />
            </div>
            Buat Modul Ajar Baru
          </button>
        )}
      </div>

      {viewingModul ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">{viewingModul.namaModul}</h3>
                <button onClick={() => setViewingModul(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-white rounded-full shadow-sm border border-gray-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <button onClick={() => handleExportWord(viewingModul)} className="flex items-center justify-center gap-2 px-4 py-3 bg-[#eff6ff] text-blue-900 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 font-bold transition-all shadow-sm group">
                  <div className="bg-[#F06C84] p-1.5 rounded-lg text-white group-hover:bg-[#d05c74] transition-colors shadow-sm">
                    <FileText size={20} />
                  </div>
                  Export Word
                </button>
                <button onClick={() => handleExportPDF(viewingModul)} className="flex items-center justify-center gap-2 px-4 py-3 bg-[#eff6ff] text-blue-900 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 font-bold transition-all shadow-sm group">
                  <div className="bg-blue-500 p-1.5 rounded-lg text-white group-hover:bg-blue-600 transition-colors shadow-sm">
                    <FileDown size={20} />
                  </div>
                  Export PDF
                </button>
              </div>
            </div>
          </div>
          <div className="prose prose-sm max-w-none prose-pink bg-white p-8 rounded-lg shadow-sm border border-gray-100">
             <ReactMarkdown>{(viewingModul.content || '*Tidak ada konten*').replace(/Mengetahui,[\s\S]*?(Kepala Sekolah|Guru Mata Pelajaran)[\s\S]*/gi, '').replace(/Cililin\s*,\s*[a-zA-Z]+\s+\d{4}[\s\S]*/gi, '').trim()}</ReactMarkdown>
             
             <div className="not-prose mt-16 flex justify-between text-center text-sm font-serif text-black" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt" }}>
               <div>
                 <p style={{ margin: '0 0 100px 0', padding: 0, lineHeight: '1.2' }}>Mengetahui,<br/>Kepala Sekolah</p>
                 <p className="font-bold underline" style={{ margin: 0, padding: 0, lineHeight: '1.1' }}>{profileData.namaKepala || '.......................'}</p>
                 <p style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.1' }}>NIP. {profileData.nipKepala || '.......................'}</p>
               </div>
               <div>
                 <p style={{ margin: '0 0 100px 0', padding: 0, lineHeight: '1.2' }}>{profileData.location || 'Cililin'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Guru Mata Pelajaran {profileData.jabatan || ''}</p>
                 <p className="font-bold underline" style={{ margin: 0, padding: 0, lineHeight: '1.1' }}>{profileData.nama || '.......................'}</p>
                 <p style={{ margin: '4px 0 0 0', padding: 0, lineHeight: '1.1' }}>NIP. {profileData.nipGuru || '.......................'}</p>
               </div>
             </div>
          </div>
        </div>
      ) : showForm ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Bot className="text-[#F06C84]" /> Generator Modul Ajar
            </h3>
            <button onClick={() => { setShowForm(false); setGeneratedContent(''); setPdfFile(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Mata Pelajaran</label>
              <input value={formData.mataPelajaran} onChange={e => setFormData({...formData, mataPelajaran: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Contoh: Matematika" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Kelas / Semester</label>
              <div className="flex gap-2">
                <input value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})} className="w-1/2 p-2 border rounded-lg" placeholder="Kelas (VII)" />
                <input value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} className="w-1/2 p-2 border rounded-lg" placeholder="Semester (Ganjil)" />
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Topik / Materi Pembelajaran</label>
              <input value={formData.topik} onChange={e => setFormData({...formData, topik: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Contoh: Aljabar Linier" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Tujuan Pembelajaran</label>
              <textarea value={formData.tujuanPembelajaran} onChange={e => setFormData({...formData, tujuanPembelajaran: e.target.value})} className="w-full p-2 border rounded-lg h-20" placeholder="Siswa dapat memahami..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Alokasi Waktu</label>
              <input value={formData.alokasiWaktu} onChange={e => setFormData({...formData, alokasiWaktu: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="2 x 45 Menit" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Profil Pelajar Pancasila</label>
              <input value={formData.profilPelajarPancasila} onChange={e => setFormData({...formData, profilPelajarPancasila: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Bernalar Kritis, Gotong Royong" />
            </div>

            {/* Referensi PDF Uploader */}
            <div className="space-y-2 md:col-span-2 pt-2">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileText size={14} className="text-[#F06C84]" />
                Referensi Materi PDF (Opsional)
              </label>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Unggah buku pelajaran, modul, atau materi PDF sebagai acuan utama agar materi pembelajaran dalam modul ajar yang dihasilkan AI 100% selaras dengan dokumen Anda.
              </p>
              
              {!pdfFile ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-[#F06C84]/60 hover:bg-rose-50/10 transition-all cursor-pointer relative">
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Pilih atau Seret File PDF di Sini</span>
                    <span className="text-[10px] text-gray-400">Hanya format PDF, ukuran maks 15MB</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-blue-50/40 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="bg-rose-50 text-[#F06C84] p-2 rounded-lg shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-gray-800 truncate">{pdfFile.name}</p>
                      <p className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        <Check size={10} /> PDF Berhasil Terunggah (Akan digunakan sebagai acuan AI)
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPdfFile(null)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end">
             <button 
                onClick={handleGenerate} 
                disabled={isGenerating || !formData.mataPelajaran || !formData.topik}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#F06C84] text-white rounded-lg hover:bg-[#F06C84]/90 font-bold transition-colors disabled:opacity-50"
             >
               {isGenerating ? (
                 <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</>
               ) : (
                 <><Bot size={18} /> Generate Modul dengan AI</>
               )}
             </button>
          </div>

          {generatedContent && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-800">Hasil Generate (Review):</h4>
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-bold">
                  <Check size={16} /> Simpan Modul
                </button>
              </div>
              <div className="prose prose-sm max-w-none prose-pink bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-h-[500px] overflow-y-auto">
                <ReactMarkdown>{generatedContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {modulList.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Belum ada modul ajar yang dibuat.</div>
          ) : (
            modulList.map(m => (
              <div key={m.id} onClick={() => setViewingModul(m)} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between group hover:border-[#F06C84]/30 hover:bg-[#F06C84]/5 cursor-pointer transition-all">
                <div>
                  <h4 className="font-bold text-gray-800">{m.namaModul}</h4>
                  <p className="text-xs text-gray-500 mt-1">Dibuat: {m.createdAt?.toDate().toLocaleDateString('id-ID')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(m.id); }} className="p-2 bg-white text-red-500 hover:bg-red-600 hover:text-white rounded-lg shadow-sm border border-gray-200 transition-colors" title="Hapus Modul">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmationDialog
          isOpen={!!deleteId}
          title="Hapus Modul Ajar"
          message="Apakah Anda yakin ingin menghapus modul ajar ini?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
