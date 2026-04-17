// ============================================
// Geração de relatório PDF para métricas de chat
// jsPDF + autoTable. Sem html2canvas para manter leve.
// ============================================
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChatPdfKpi {
  label: string;
  value: string | number;
}

export interface ChatPdfAgentRow {
  agent: string;
  total: number;
  resolved: number;
  resolutionRate: number;
  avgFirst: number;
  avgRes: number;
  csatAvg: number;
  csatCount: number;
}

export interface ChatPdfReportData {
  title: string;
  periodLabel: string;
  filters: { label: string; value: string }[];
  kpis: ChatPdfKpi[];
  channelDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
  hourlyVolume: { hour: string; count: number }[];
  dailyVolume: { label: string; opened: number; resolved: number }[];
  agentRanking: ChatPdfAgentRow[];
  csat?: { avg: number; count: number; sent: number };
}

const formatMin = (m: number) => {
  if (!m) return '0min';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
};

export function generateChatMetricsPdf(data: ChatPdfReportData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // ── Header ─────────────────────────────────────────────────────
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(data.title, margin, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.periodLabel, margin, 55);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth - margin,
    55,
    { align: 'right' }
  );
  y = 90;

  // ── Filters ────────────────────────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  if (data.filters.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Filtros aplicados:', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 14;
    data.filters.forEach((f) => {
      doc.text(`• ${f.label}: ${f.value}`, margin + 10, y);
      y += 12;
    });
    y += 6;
  }

  // ── KPIs grid (4 cols) ─────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('Indicadores principais', margin, y);
  y += 14;

  const cardW = (pageWidth - margin * 2 - 18) / 4;
  const cardH = 50;
  data.kpis.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = margin + col * (cardW + 6);
    const cy = y + row * (cardH + 6);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cy, cardW, cardH, 4, 4, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + 8, cy + 16, { maxWidth: cardW - 16 });
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(String(kpi.value), x + 8, cy + 38);
  });
  const kpiRows = Math.ceil(data.kpis.length / 4);
  y += kpiRows * (cardH + 6) + 14;

  // ── CSAT ──────────────────────────────────────────────────────
  if (data.csat && data.csat.sent > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('Satisfação (CSAT)', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const respRate = data.csat.sent > 0 ? Math.round((data.csat.count / data.csat.sent) * 100) : 0;
    doc.text(
      `Nota média: ${data.csat.avg.toFixed(1)} / 5    •    Respostas: ${data.csat.count} de ${data.csat.sent} (${respRate}%)`,
      margin,
      y
    );
    y += 18;
  }

  // ── Channel distribution table ─────────────────────────────────
  if (data.channelDistribution.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Canal', 'Conversas', '%']],
      body: (() => {
        const total = data.channelDistribution.reduce((s, c) => s + c.value, 0);
        return data.channelDistribution.map((c) => [
          c.name,
          String(c.value),
          total > 0 ? `${Math.round((c.value / total) * 100)}%` : '0%',
        ]);
      })(),
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: margin, right: pageWidth / 2 + 5 },
      tableWidth: pageWidth / 2 - margin - 5,
    });

    autoTable(doc, {
      startY: y,
      head: [['Status', 'Conversas']],
      body: data.statusDistribution.map((s) => [s.name, String(s.value)]),
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: pageWidth / 2 + 5, right: margin },
      tableWidth: pageWidth / 2 - margin - 5,
    });

    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ── Daily volume table ─────────────────────────────────────────
  if (data.dailyVolume.length > 0) {
    if (y > 700) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('Volume diário', margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Abertas', 'Resolvidas']],
      body: data.dailyVolume.map((d) => [d.label, String(d.opened), String(d.resolved)]),
      headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ── Hourly peak ────────────────────────────────────────────────
  if (data.hourlyVolume.length > 0) {
    if (y > 680) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('Distribuição por hora do dia', margin, y);
    y += 10;

    const maxC = Math.max(...data.hourlyVolume.map((h) => h.count), 1);
    const barW = (pageWidth - margin * 2) / 24;
    const barMaxH = 60;
    data.hourlyVolume.forEach((h, i) => {
      const bh = (h.count / maxC) * barMaxH;
      const bx = margin + i * barW;
      const by = y + (barMaxH - bh);
      doc.setFillColor(139, 92, 246);
      doc.rect(bx + 1, by, barW - 2, bh, 'F');
    });
    y += barMaxH + 4;
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    [0, 6, 12, 18, 23].forEach((hr) => {
      doc.text(`${String(hr).padStart(2, '0')}h`, margin + hr * barW + 2, y + 8);
    });
    y += 24;
  }

  // ── Agent ranking ──────────────────────────────────────────────
  if (data.agentRanking.length > 0) {
    if (y > 600) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text('Ranking de atendentes', margin, y);
    autoTable(doc, {
      startY: y + 6,
      head: [['#', 'Atendente', 'Total', 'Resolv.', 'Tx.', 'TME', 'TMA', 'CSAT']],
      body: data.agentRanking.map((r, i) => [
        String(i + 1),
        r.agent,
        String(r.total),
        String(r.resolved),
        `${r.resolutionRate}%`,
        formatMin(r.avgFirst),
        formatMin(r.avgRes),
        r.csatCount > 0 ? `${r.csatAvg.toFixed(1)}` : '—',
      ]),
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 24 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ── Footer with page numbers ───────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 16,
      { align: 'right' }
    );
    doc.text(
      'Lovable Chat • Relatório de métricas',
      margin,
      doc.internal.pageSize.getHeight() - 16
    );
  }

  return doc;
}
