import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Error handler for body-parsing errors (prevents returning raw HTML 400 pages)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error("Body Parser Error:", err);
      res.status(400).json({
        error: `Gagal membaca data: ${err.message || "Permintaan tidak valid"}. Silakan periksa kembali file yang diunggah.`
      });
      return;
    }
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy endpoint to resolve CORS when downloading files from Google Drive or other URLs
  app.get("/api/proxy-image", async (req, res) => {
    const urlParam = req.query.url as string;
    if (!urlParam) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }

    try {
      let targetUrl = urlParam;
      if (urlParam.includes('drive.google.com')) {
        const match = urlParam.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          targetUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
        }
      }

      console.log(`Proxying image from: ${targetUrl}`);
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/png";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // cache for 1 day
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Error proxying image:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate-modul", async (req, res) => {
    const fs = await import("fs");
    const logFile = path.join(process.cwd(), "server-debug.log");
    const log = (msg: string) => {
      const time = new Date().toISOString();
      fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
      console.log(`[${time}] ${msg}`);
    };

    try {
      log("Received /api/generate-modul request");
      const { promptData, pdfFile } = req.body;
      log(`promptData: ${JSON.stringify(promptData ? { ...promptData, data: undefined } : null)}`);
      log(`pdfFile: ${pdfFile ? pdfFile.name : "none"}`);
      
      let contents: any[] = [];
      let extraInstructions = "";
      
      if (pdfFile && pdfFile.data) {
        log("Processing attached PDF file...");
        // Ambil data base64 murni tanpa prefix skema data URL
        let base64Data = pdfFile.data;
        if (base64Data.includes(";base64,")) {
          base64Data = base64Data.split(";base64,").pop();
        }
        
        if (base64Data) {
          base64Data = base64Data.trim();
        }
        
        contents.push({
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data
          }
        });
        
        extraInstructions = `\n\nSANGAT PENTING: Gunakan dokumen PDF yang dilampirkan sebagai referensi utama materi pembelajaran untuk pembuatan Modul Ajar ini. Seluruh sub-materi, pembahasan, langkah-langkah kegiatan pembelajaran, dan lembar kerja (LKPD) harus didasarkan dan diselaraskan secara detail dengan isi materi yang ada di dalam dokumen PDF tersebut agar relevan.`;
        log("PDF attached successfully to Gemini contents.");
      }
      
      const prompt = `Buatkan Modul Ajar kurikulum merdeka yang rapi dan terstruktur berdasarkan data berikut:
      ${JSON.stringify(promptData, null, 2)}${extraInstructions}
      
      Berikan dalam format Markdown murni (tanpa membungkus dalam \`\`\`markdown).
      Gunakan hierarki heading (H1 untuk Judul Utama, H2, H3) secara tepat agar saat diekspor menjadi rapi.
      
      Pastikan Modul Ajar memiliki struktur berikut:
      # <center>MODUL AJAR</center>
      
      ## A. INFORMASI UMUM
      - **Nama Penyusun**: ${promptData.namaGuru || '...'}
      - **Institusi**: ${promptData.namaSekolah || '...'}
      - **Mata Pelajaran**: ${promptData.mataPelajaran || '...'}
      - **Topik/Materi Pembelajaran**: ${promptData.topik || '...'}
      - **Kelas/Semester**: ${promptData.kelas || '...'} / ${promptData.semester || '...'}
      - **Alokasi Waktu**: ${promptData.alokasiWaktu || '...'}
      - **Profil Pelajar Pancasila**: ${promptData.profilPelajarPancasila || '...'}
      
      ## B. KOMPONEN INTI
      1. **Tujuan Pembelajaran**
      2. **Pemahaman Bermakna**
      3. **Pertanyaan Pemantik**
      4. **Kegiatan Pembelajaran** (Pendahuluan, Inti, Penutup)
      5. **Asesmen**
      
      ## C. LAMPIRAN
      - Lembar Kerja Peserta Didik (LKPD)
      - Bahan Bacaan Guru dan Peserta Didik
      - Glosarium
      - Daftar Pustaka
      
      PEDOMAN PENULISAN AGAR CEPAT DAN TEPAT (HEMAT WAKTU GENERATE):
      - Tuliskan isinya secara komprehensif, padat, jelas, dan langsung ke inti materi pembelajaran tanpa penjelasan bertele-tele yang tidak perlu.
      - Bagian langkah kegiatan pembelajaran dan LKPD dirancang secara praktis, terstruktur, langsung aplikatif, namun tetap edukatif dan mendalam. Hal ini agar proses pengiriman data AI lebih cepat dan terhindar dari pemutusan koneksi/timeout.
      
      PENTING: JANGAN menyertakan bagian tanda tangan (seperti "Mengetahui", "Kepala Sekolah", "Guru Mata Pelajaran") di bagian bawah atau akhir modul ajar. Bagian tersebut akan ditambahkan secara otomatis oleh sistem.
      `;
      
      contents.push({ text: prompt });
      log("Calling ai.models.generateContent with gemini-3.5-flash...");
 
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents.length === 1 ? prompt : contents,
      });

      log("Gemini API returned content successfully.");
      res.json({ result: response.text });
    } catch (error: any) {
      log(`ERROR: ${error.message || error}`);
      if (error.stack) {
        log(`Stack: ${error.stack}`);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
