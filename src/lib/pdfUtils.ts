import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KOP_SURAT_BASE64 } from './kopSuratBase64';

interface PDFOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'legal' | 'letter' | 'f4';
  columnStyles?: any;
  styles?: any;
}

const getKopSuratImage = (): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    
    // Set a fallback timer in case image fails to load
    const timer = setTimeout(() => {
      console.warn("Kop surat image loading timed out. Proceeding with fallback header.");
      resolve(null);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = (err) => {
      clearTimeout(timer);
      console.error("Failed to load Base64 Kop Surat image:", err);
      resolve(null);
    };
    img.src = KOP_SURAT_BASE64;
  });
};

export const generatePDF = async (
  title: string, 
  head: string[] | any[][], 
  data: any[][], 
  options?: PDFOptions,
  profileData?: {
    namaKepala?: string;
    nipKepala?: string;
    namaGuru?: string;
    nipGuru?: string;
    jabatan?: string;
    location?: string;
    namaSekolah?: string;
    kelas?: string;
    semester?: string;
    tahunPelajaran?: string;
    periode?: string;
    showMetadataTable?: boolean;
  }
) => {
  console.log('Generating PDF for:', title, head, data);
  if (data.length === 0) {
    alert('Data kosong');
    return;
  }
  
  const orientation = options?.orientation || 'portrait';
  let format: any = options?.format || 'f4';
  
  // Support standard Indonesian F4 size (215mm x 330mm)
  if (format === 'f4') {
    format = [215, 330];
  } else if (format === 'legal') {
    format = [215.9, 355.6];
  }

  const doc = new jsPDF(orientation, 'mm', format);
  doc.setTextColor(0, 0, 0);

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;

  // 1. Group data by 'Kelas' if column exists
  const groups: { [className: string]: any[][] } = {};
  let classColIndex = -1;
  const headArray = Array.isArray(head[0]) ? (head[0] as string[]) : (head as string[]);
  
  if (headArray) {
    classColIndex = headArray.findIndex(h => h && h.toLowerCase() === 'kelas');
  }

  if (classColIndex !== -1) {
    data.forEach(row => {
      const className = row[classColIndex] || 'Lainnya';
      if (!groups[className]) {
        groups[className] = [];
      }
      groups[className].push(row);
    });
  } else {
    groups['All'] = data;
  }

  const sortedClassNames = Object.keys(groups).sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Load the Kop Surat image once
  const img = await getKopSuratImage();

  // Dynamic style calculation function to guarantee 1 page per class
  const getOptimalStyles = (count: number, pHeight: number) => {
    // If Legal paper (355.6mm), we have more space than F4 (330mm)
    const ratio = pHeight / 330;
    const adjustedCount = count / ratio;
    
    if (adjustedCount <= 22) {
      return { fontSize: 9.5, cellPadding: 2.2 };
    } else if (adjustedCount <= 28) {
      return { fontSize: 9, cellPadding: 1.8 };
    } else if (adjustedCount <= 35) {
      return { fontSize: 8.5, cellPadding: 1.3 };
    } else if (adjustedCount <= 42) {
      return { fontSize: 8, cellPadding: 0.9 };
    } else {
      return { fontSize: 7.5, cellPadding: 0.6 };
    }
  };

  // Render each class group as its own page
  for (let gIndex = 0; gIndex < sortedClassNames.length; gIndex++) {
    const className = sortedClassNames[gIndex];
    const rawClassRows = groups[className];
    
    // Reset sequential 'No' column for this class group to keep it clean and professional
    const classRows = rawClassRows.map((row, idx) => {
      const newRow = [...row];
      newRow[0] = String(idx + 1);
      return newRow;
    });

    if (gIndex > 0) {
      doc.addPage();
    }

    let currentY = 15;

    // 1. Draw Kop Surat
    if (img) {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const ratio = imgHeight / imgWidth;
      
      const drawWidth = pageWidth - (margin * 2);
      const drawHeight = drawWidth * ratio;
      
      doc.addImage(img, 'JPEG', margin, 8, drawWidth, drawHeight);
      currentY = 8 + drawHeight + 5;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(profileData?.namaSekolah || "SEKOLAH SACIL SMART", pageWidth / 2, currentY, { align: 'center' });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      currentY += 5;
      doc.text("Laporan Administrasi Sekolah & Rekapitulasi Presensi", pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 1.0, pageWidth - margin, currentY + 1.0);
      
      currentY += 8;
    }

    // 2. Draw Document Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    // 3. Draw Symmetric Aligned Metadata Block
    if (profileData?.showMetadataTable) {
      doc.setFontSize(9.5);

      const leftColX = margin;
      const tpText = profileData.tahunPelajaran || "-";
      const pText = profileData.periode || "-";

      // Calculate Left Column Positions
      doc.setFont("helvetica", "bold");
      const maxLabelWidthLeft = Math.max(
        doc.getTextWidth("Kelas"),
        doc.getTextWidth("Semester"),
        doc.getTextWidth("Mata Pelajaran")
      );
      const leftColonX = leftColX + maxLabelWidthLeft + 3;
      const leftValX = leftColonX + 4.5;

      // Calculate Right Column Positions (for perfect symmetry with table right edge)
      const maxLabelWidthRight = Math.max(
        doc.getTextWidth("Tahun Pelajaran"),
        doc.getTextWidth("Periode")
      );
      doc.setFont("helvetica", "normal");
      const maxValueWidthRight = Math.max(
        doc.getTextWidth(tpText),
        doc.getTextWidth(pText)
      );

      const totalRightBlockWidth = maxLabelWidthRight + 3 + 1.5 + 3 + maxValueWidthRight;
      const rightColX = pageWidth - margin - totalRightBlockWidth;
      const rightColonX = rightColX + maxLabelWidthRight + 3;
      const rightValX = rightColonX + 4.5;

      // Line 1: Kelas vs Tahun Pelajaran
      doc.setFont("helvetica", "bold");
      doc.text("Kelas", leftColX, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(":", leftColonX, currentY);
      doc.text(className !== 'All' ? className : (profileData.kelas || "-"), leftValX, currentY);

      doc.setFont("helvetica", "bold");
      doc.text("Tahun Pelajaran", rightColX, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(":", rightColonX, currentY);
      doc.text(tpText, rightValX, currentY);

      // Line 2: Semester vs Periode
      doc.setFont("helvetica", "bold");
      doc.text("Semester", leftColX, currentY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(":", leftColonX, currentY + 6);
      doc.text(profileData.semester || "-", leftValX, currentY + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Periode", rightColX, currentY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(":", rightColonX, currentY + 6);
      doc.text(pText, rightValX, currentY + 6);

      // Line 3: Mata Pelajaran
      doc.setFont("helvetica", "bold");
      doc.text("Mata Pelajaran", leftColX, currentY + 12);
      doc.setFont("helvetica", "normal");
      doc.text(":", leftColonX, currentY + 12);
      doc.text(profileData.jabatan || "Guru Kelas", leftValX, currentY + 12);

      currentY += 18;
    }

    // 4. Calculate optimal styles for this group size
    const optimalStyles = getOptimalStyles(classRows.length, pageHeight);

    // 5. Render Student Table
    autoTable(doc, {
      head: (Array.isArray(head[0]) ? head : [head]) as any,
      body: classRows,
      startY: currentY,
      theme: 'grid',
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.3,
      styles: {
        fontSize: optimalStyles.fontSize,
        cellPadding: optimalStyles.cellPadding,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
        ...(options?.styles || {})
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        fontSize: Math.min(10, optimalStyles.fontSize + 1.5),
      },
      columnStyles: options?.columnStyles || {
        0: { halign: 'center' }, // No.
        2: { halign: 'center' }, // Kelas
      },
      didParseCell: (cellData) => {
        if (cellData.section === 'head' && cellData.row.index === 1) { // Second row is the date row if nested
          cellData.cell.styles.fontSize = Math.min(8.5, optimalStyles.fontSize + 0.5);
        }
      }
    });

    // 6. Add Signature Block on the same page
    if (profileData) {
      let finalY = (doc as any).lastAutoTable.finalY + 6;
      
      // Safety check: if somehow it overflows, start a new page
      if (finalY + 36 > pageHeight - 8) {
        doc.addPage();
        finalY = 15;
      }

      const dateStr = `${profileData.location || 'Cililin'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      
      const leftColX = 20;
      const rightColX = (pageWidth / 2) + 30;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.min(9.5, optimalStyles.fontSize + 1));
      
      // Row 1: Mengetahui & Date
      doc.text(`Mengetahui,`, leftColX, finalY + 4, { align: 'left' });
      doc.text(dateStr, rightColX, finalY + 4, { align: 'left' });
      
      // Row 2: Kepala Sekolah & Guru Mata Pelajaran
      doc.text(`Kepala Sekolah`, leftColX, finalY + 8, { align: 'left' });
      doc.text(`Guru Mata Pelajaran ${profileData.jabatan || ''}`, rightColX, finalY + 8, { align: 'left' });
      
      // Row 3: Names
      doc.setFont("helvetica", "bold");
      doc.text(`${profileData.namaKepala || ''}`, leftColX, finalY + 28, { align: 'left' });
      doc.text(`${profileData.namaGuru || ''}`, rightColX, finalY + 28, { align: 'left' });
      
      // Row 4: NIPs
      doc.setFont("helvetica", "normal");
      doc.text(`NIP. ${profileData.nipKepala || ''}`, leftColX, finalY + 32, { align: 'left' });
      doc.text(`NIP. ${profileData.nipGuru || ''}`, rightColX, finalY + 32, { align: 'left' });
    }
  }

  doc.save(`Laporan_${title.replace(/\s+/g, '_')}.pdf`);
};
