'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
export const dynamic = 'force-dynamic';

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);

interface HerramientaAlmacen {
  id: string;
  codigo: string;
  nombre: string;
  marca_modelo: string;
  ubicacion: 'bodega' | 'obra';
  asignado_a?: string | null;
  notas?: string | null;
  token_firma?: string | null;
  fecha_firma?: string | null;
  ine_url?: string | null;
  firma_entrega_url?: string | null;
  firma_recibe_url?: string | null;
  fecha_entrega?: string | null;
  fecha_devolucion?: string | null;
}

interface BloqueSemanaDestajo {
  claveSemana: string;
  fechaRepresentativa: Date;
  registros: any[];
  subtotalSemana: number;
}

export default function ReporteFinalObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [proyecto, setProyecto] = useState<any | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  // --- REGISTROS DE RUBROS ---
  const [gastosGeneralesRecords, setGastosGeneralesRecords] = useState<any[]>([]);
  const [cajaChicaRecords, setCajaChicaRecords] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
  const [maquinariaRecords, setMaquinariaRecords] = useState<any[]>([]);
  const [workersRecords, setWorkersRecords] = useState<any[]>([]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const fetchReporte = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: proyectoData, error: proyectoError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (proyectoError || !proyectoData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProyecto(proyectoData);

      const [
        { data: gastos },
        { data: caja },
        { data: payroll },
        { data: inventory },
        { data: maquinaria },
        { data: workers }
      ] = await Promise.all([
        supabase.from('gastos_generales').select('*').eq('project_id', projectId).eq('is_active', true),
        supabase.from('caja_chica').select('*').eq('project_id', projectId),
        supabase.from('payroll_records').select('*').eq('project_id', projectId),
        supabase.from('inventory').select('*').eq('project_id', projectId),
        supabase.from('gastos_maquinaria').select('*').eq('project_id', projectId),
        supabase.from('workers').select('*').eq('project_id', projectId)
      ]);

      setGastosGeneralesRecords(gastos || []);
      setCajaChicaRecords(caja || []);
      setPayrollRecords(payroll || []);
      setInventoryRecords(inventory || []);
      setMaquinariaRecords(maquinaria || []);
      setWorkersRecords(workers || []);

      setLoading(false);
    };

    fetchReporte();
  }, [projectId, router]);

  const chartData = useMemo<{ name: string; value: number }[]>(() => {
    const totals = { 'Materiales e Insumos': 0, 'Mano de Obra': 0, 'Caja Chica': 0, 'Maquinaria': 0, 'Destajos': 0 };

    gastosGeneralesRecords.forEach(record => {
      totals['Materiales e Insumos'] += Number(record.monto) || 0;
    });

    cajaChicaRecords.forEach(record => { 
      totals['Caja Chica'] += Number(record.monto) || 0; 
    });
    
    payrollRecords.forEach(record => { 
      totals['Mano de Obra'] += Number(record.final_salary || 0); 
    });

    maquinariaRecords.forEach(record => {
      totals['Maquinaria'] += Number(record.monto) || 0;
    });

    inventoryRecords.forEach(record => {
      const cantidad = Number(record.quantity || 1);
      const precioUnitario = Number(record.unit_price || 0);
      totals['Destajos'] += (cantidad * precioUnitario);
    });

    return Object.entries(totals).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords, maquinariaRecords]);

  const totalConsolidated = chartData.reduce((sum, item) => sum + item.value, 0);
  const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];

  const resumenCajaChica = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;

    cajaChicaRecords.forEach(r => {
      const monto = Number(r.monto) || 0;
      if (r.tipo === 'ingreso') {
        ingresos += monto;
      } else {
        gastos += monto;
      }
    });

    return { ingresos, gastos, saldo: ingresos - gastos };
  }, [cajaChicaRecords]);

  // --- 🛠️ LÓGICA DE AGRUPACIÓN DE DESTAJOS POR SEMANA LABORAL CON TIPADO ESTRICTO ---
  const destajosAgrupadosPorSemana = useMemo<BloqueSemanaDestajo[]>(() => {
    const semanas: Record<string, BloqueSemanaDestajo> = {};

    inventoryRecords.forEach((r) => {
      const fechaBase = new Date(r.created_at || r.fecha);
      if (isNaN(fechaBase.getTime())) return;

      const diaSemana = fechaBase.getDay();
      const diferenciaLunes = fechaBase.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      const lunesSemana = new Date(fechaBase);
      lunesSemana.setDate(diferenciaLunes);
      lunesSemana.setHours(0, 0, 0, 0);

      const claveSemana = `Semana del ${lunesSemana.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      const costoRegistro = Number(r.quantity || 0) * Number(r.unit_price || 0);

      if (!semanas[claveSemana]) {
        semanas[claveSemana] = {
          claveSemana,
          fechaRepresentativa: lunesSemana,
          registros: [],
          subtotalSemana: 0
        };
      }

      semanas[claveSemana].registros.push(r);
      semanas[claveSemana].subtotalSemana += costoRegistro;
    });

    return Object.values(semanas).sort((a, b) => b.fechaRepresentativa.getTime() - a.fechaRepresentativa.getTime());
  }, [inventoryRecords]);

  // --- 📝 EXPORTACIÓN OPTIMIZADA: FLUIDA Y SIN SEPARACIONES INNECESARIAS ---
  const handleExportDetailedPDF = async () => {
    if (!proyecto) return;
    setExportingPDF(true);

    try {
      const doc = new jsPDF();
      const projectName = proyecto.name || 'Obra';
      const PAGE_HEIGHT = 297;
      const BOTTOM_MARGIN = 20;

      // Helper: verifica si hay espacio, si no, agrega página nueva
      const ensureSpace = (currentY: number, neededHeight: number) => {
        if (currentY + neededHeight > PAGE_HEIGHT - BOTTOM_MARGIN) {
          doc.addPage();
          return 20; // Y inicial en la nueva página
        }
        return currentY;
      };

      // --- PORTADA / RESUMEN ---
      doc.setFontSize(20); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
      doc.text('ESTADO ANALÍTICO Y MAESTRO DE OBRA', 14, 25);
      doc.setDrawColor(37, 99, 235); doc.setLineWidth(1); doc.line(14, 29, 196, 29);

      doc.setFontSize(10); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'normal');
      doc.text(`Cliente: ${proyecto.client_name || 'N/A'}`, 14, 37);
      doc.text(`No. de Contrato: ${proyecto.contract_number || 'N/A'}`, 14, 43);
      doc.text(`Periodo Operativo: ${formatDate(proyecto.start_date)} al ${formatDate(proyecto.end_date)}`, 14, 49);

      doc.setFillColor(15, 23, 42); doc.roundedRect(14, 55, 182, 18, 2, 2, 'F');
      doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.setFont('Helvetica', 'bold');
      doc.text('COSTO DIRECTO TOTAL ACUMULADO AUDITADO:', 20, 66);
      doc.setFontSize(14); doc.setTextColor(52, 211, 153);
      doc.text(formatCurrency(totalConsolidated), 140, 66);

      doc.setFontSize(12); doc.setTextColor(15, 23, 42);
      doc.text('1. Concentrado General Financiero por Rubro', 14, 86);
      autoTable(doc, {
        startY: 91,
        head: [['Macro Rubro de Obra', 'Inversión Acumulada', 'Porcentaje de Participación']],
        body: chartData.map(item => [
          item.name,
          formatCurrency(item.value),
          `${totalConsolidated > 0 ? ((item.value / totalConsolidated) * 100).toFixed(1) : 0}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontStyle: 'bold' }
      });

      // A partir de aquí, currentY sigue el flujo real del documento
      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // --- SECCIÓN 2: MATERIALES ---
      if (gastosGeneralesRecords.length > 0) {
        currentY = ensureSpace(currentY, 30);
        doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('2. Libro Detallado de Materiales e Insumos Adquiridos', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Fecha', 'Concepto / Material', 'Rubro', 'Proveedor', 'Importe']],
          body: gastosGeneralesRecords.map(r => [
            formatDate(r.fecha),
            r.concepto || 'S/D',
            r.clasificacion_rubro || 'Material',
            r.proveedor || 'S/P',
            formatCurrency(r.monto || 0)
          ]),
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59] },
          columnStyles: { 4: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // --- SECCIÓN 3: CAJA CHICA ---
      if (cajaChicaRecords.length > 0) {
        currentY = ensureSpace(currentY, 30);
        doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('3. Desglose de Gastos Menores (Libro de Caja Chica)', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Fecha', 'No. Nota', 'Responsable', 'Artículo / Concepto', 'Monto']],
          body: cajaChicaRecords.map(r => [
            formatDate(r.fecha),
            r.numero_nota || '-',
            r.encargado || 'Oficina',
            r.concepto || 'Gastos menores',
            formatCurrency(r.monto || 0)
          ]),
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105] },
          columnStyles: { 4: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // --- SECCIÓN 4: MAQUINARIA ---
      if (maquinariaRecords.length > 0) {
        currentY = ensureSpace(currentY, 30);
        doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('4. Desglose de Renta y Servicios de Maquinaria', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Fecha', 'Equipo', 'Proveedor', 'Rendimiento / Horas', 'Importe']],
          body: maquinariaRecords.map(r => [
            formatDate(r.fecha),
            r.equipo || 'Maquinaria',
            r.proveedor || 'S/P',
            r.asistencia_dias ? `${r.asistencia_dias} hrs` : 'Corte Semanal',
            formatCurrency(r.monto || 0)
          ]),
          theme: 'grid',
          headStyles: { fillColor: [120, 113, 108] },
          columnStyles: { 4: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // --- SECCIÓN 5: DESTAJOS AGRUPADOS POR SEMANA ---
      if (inventoryRecords.length > 0) {
        currentY = ensureSpace(currentY, 30);
        doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('5. Rendimiento Contable de Destajos y Suministros (por Semana)', 14, currentY);
        currentY += 8;

        destajosAgrupadosPorSemana.forEach((bloque: BloqueSemanaDestajo) => {
          currentY = ensureSpace(currentY, 20);

          doc.setFillColor(241, 245, 249);
          doc.rect(14, currentY - 5, 182, 8, 'F');
          doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
          doc.text(bloque.claveSemana, 17, currentY);
          doc.text(`-${formatCurrency(bloque.subtotalSemana)}`, 175, currentY, { align: 'right' });
          currentY += 6;

          autoTable(doc, {
            startY: currentY,
            head: [['Actividad / Destajo', 'Recibe', 'Solicitado', 'Cant.', 'P.U.', 'Total']],
            body: bloque.registros.map((r: any) => [
              r.name || 'Sin nombre',
              r.in_charge || '-',
              r.requested_by || '-',
              `${r.quantity || 1} ${r.unit || ''}`.trim(),
              formatCurrency(r.unit_price || 0),
              formatCurrency((r.quantity || 1) * (r.unit_price || 0))
            ]),
            theme: 'grid',
            headStyles: { fillColor: [217, 119, 6], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
            margin: { left: 14, right: 14 }
          });

          currentY = (doc as any).lastAutoTable.finalY + 10;
        });

        currentY += 5;
      }

      // --- SECCIÓN 6: NÓMINAS ---
      if (payrollRecords.length > 0) {
        currentY = ensureSpace(currentY, 30);
        doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('6. Reporte Consolidado de Nóminas y Listas de Raya', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Semana', 'Nombre del Trabajador', 'Puesto / Rol', 'Estatus Faltas', 'Neto Pagado']],
          body: payrollRecords.map(p => {
            const tr = workersRecords.find(w => w.id === p.worker_id);
            return [
              formatDate(p.week_start).split(',')[0],
              tr?.name_worker || tr?.name || 'Personal',
              p.role || tr?.role || 'Peón',
              p.deduction_reason ? `Deducción: ${p.deduction_reason}` : 'Asistencia Completa',
              formatCurrency(p.final_salary || p.finally_salary || 0)
            ];
          }),
          theme: 'grid',
          headStyles: { fillColor: [5, 150, 105] },
          columnStyles: { 4: { halign: 'right' } }
        });
      }

      doc.save(`Reporte_Maestro_Continuo_${projectName.replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert("Error al estructurar el reporte: " + err.message);
    } finally {
      setExportingPDF(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando reporte...</div>;
  }

  if (notFound || !proyecto) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 gap-4">
        <span className="text-4xl">🚫</span>
        <p>No se encontró esta obra en el historial.</p>
        <Link href="/historial" className="text-blue-600 font-bold hover:underline">Volver al historial</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* 🌑 BARRA LATERAL */}
      <div className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-8">
          <img src="/logo-completo.png" alt="Logo Rocal" className="w-full h-auto mb-1 brightness-200" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Archivo Muerto</p>
        </div>
        <nav className="flex-1 px-3 space-y-2 mt-4">
          <Link href="/historial" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors">
            ⬅️ Volver al Historial
          </Link>
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors">
            🏠 Obras Activas
          </Link>
        </nav>
      </div>

      {/* ☀️ CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Reporte Final: {proyecto.name}</h2>
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
            Obra Concluida
          </span>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* TARJETA DE INFO DEL PROYECTO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Proyecto / Obra</span>
                  <span className="font-bold text-slate-800 text-base block">{proyecto.name}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Cliente de Obra</span>
                  <span className="font-semibold text-slate-800 block">{proyecto.client_name || 'No registrado'}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">No. de Contrato</span>
                  <span className="font-mono text-slate-800 font-bold block">{proyecto.contract_number || 'No registrado'}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Periodo de Obra</span>
                  <span className="font-semibold text-slate-800 block">
                    {formatDate(proyecto.start_date)} al {formatDate(proyecto.end_date)}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={handleExportDetailedPDF}
                  disabled={exportingPDF}
                  className="flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  📥 {exportingPDF ? 'Procesando Auditoría...' : 'Imprimir Reporte Detallado (Maestro)'}
                </button>
                {proyecto.reporte_cierre_url && (
                  <a
                    href={proyecto.reporte_cierre_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    📝 Ver Acta de Cierre (PDF original)
                  </a>
                )}
              </div>
            </div>

            {/* RESUMEN FINANCIERO GRÁFICO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">Resumen Financiero Final</h3>
              </div>

              {totalConsolidated > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8">
                  <div>
                    <div className="mb-6">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Costo Directo Total Acumulado</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalConsolidated)}</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Distribución por Macro Rubro</h4>
                    <div className="space-y-4">
                      {chartData.map((item, idx) => {
                        const percentage = totalConsolidated > 0 ? ((item.value / totalConsolidated) * 100).toFixed(1) : '0';
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                              <span className="font-medium text-slate-700">{item.name}</span>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                              <span className="text-xs font-bold text-slate-500 w-12 text-right">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={75} outerRadius={110} paddingAngle={4} dataKey="value" stroke="none">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Monto']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-400 font-medium">No hay datos financieros registrados para esta obra.</div>
              )}
            </div>

            {/* TABLAS WEB COMPLEMENTARIAS */}
            <div className="grid grid-cols-1 gap-6">
              {gastosGeneralesRecords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-100 border-b text-slate-800 font-black text-sm">🪵 Desglose de Materiales e Insumos</div>
                  <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-700 font-bold border-b"><tr><th className="p-4">Fecha</th><th className="p-4">Concepto</th><th className="p-4">Proveedor</th><th className="p-4 text-right">Importe</th></tr></thead><tbody className="divide-y text-slate-900">{gastosGeneralesRecords.map(r => (<tr key={r.id} className="hover:bg-slate-50"><td className="p-4 text-slate-600">{formatDate(r.fecha)}</td><td className="p-4 font-semibold">{r.concepto}</td><td className="p-4 font-medium">{r.proveedor || 'S/P'}</td><td className="p-4 text-right text-red-600 font-bold">-{formatCurrency(r.monto)}</td></tr>))}</tbody></table>
                </div>
              )}

              {cajaChicaRecords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-100 border-b text-slate-800 font-black text-sm">💵 Movimientos de Caja Chica</div>
                  <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-700 font-bold border-b"><tr><th className="p-4">Fecha</th><th className="p-4">No. Nota</th><th className="p-4">Responsable</th><th className="p-4">Concepto</th><th className="p-4 text-right">Monto</th></tr></thead><tbody className="divide-y text-slate-900">{cajaChicaRecords.map(r => (<tr key={r.id} className="hover:bg-slate-50"><td className="p-4 text-slate-600">{formatDate(r.fecha)}</td><td className="p-4 font-mono font-bold text-blue-600">{r.numero_nota || '-'}</td><td className="p-4 font-semibold text-slate-900">{r.encargado}</td><td className="p-4 font-medium text-slate-700">{r.concepto}</td><td className="p-4 text-right text-red-600 font-bold">-{formatCurrency(r.monto)}</td></tr>))}</tbody></table>
                </div>
              )}

              {maquinariaRecords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-100 border-b text-slate-800 font-black text-sm">🚜 Control de Maquinaria</div>
                  <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-700 font-bold border-b"><tr><th className="p-4">Fecha</th><th className="p-4">Equipo</th><th className="p-4">Proveedor</th><th className="p-4 text-right">Importe</th></tr></thead><tbody className="divide-y text-slate-900">{maquinariaRecords.map(r => (<tr key={r.id}><td className="p-4 text-slate-600">{formatDate(r.fecha)}</td><td className="p-4 font-semibold">{r.equipo} {r.asistencia_dias && `(${r.asistencia_dias} hrs)`}</td><td className="p-4 font-medium">{r.proveedor || 'S/P'}</td><td className="p-4 text-right text-red-600 font-bold">-{formatCurrency(r.monto)}</td></tr>))}</tbody></table>
                </div>
              )}

              {/* 🛠️ ACORDEONES INTERACTIVOS DE DESTAJOS POR SEMANA */}
              {inventoryRecords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
                  <h3 className="text-sm font-black text-slate-800 mb-2">🛠️ Registro Maestro de Destajos por Semana</h3>
                  {destajosAgrupadosPorSemana.map((bloque: BloqueSemanaDestajo, idx: number) => (
                    <details key={idx} className="group border border-slate-200 rounded-xl bg-white shadow-sm open:shadow-md transition-all duration-200">
                      <summary className="list-none flex items-center justify-between p-4 font-semibold text-sm text-slate-800 cursor-pointer hover:bg-slate-50 select-none">
                        <div className="flex items-center gap-3">
                          <span className="transition-transform duration-200 group-open:rotate-90 text-slate-400 text-xs">▶</span>
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="font-bold text-slate-900">{bloque.claveSemana}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-md">{bloque.registros.length} conceptos</span>
                          <span className="text-sm font-mono font-black text-red-600">-{formatCurrency(bloque.subtotalSemana)}</span>
                        </div>
                      </summary>

                      <div className="border-t border-slate-100 bg-slate-50/40 overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="px-4 py-2.5">Concepto / Actividad</th>
                              <th className="px-4 py-2.5">Encargado / Recibe</th>
                              <th className="px-6 py-4">Solicitado por</th>
                              <th className="px-4 py-2.5 text-right">Cantidad</th>
                              <th className="px-4 py-2.5 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {bloque.registros.map((r: any, rIdx: number) => (
                              <tr key={r.id || rIdx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-semibold text-slate-900">{r.name || 'Sin nombre'}</td>
                                <td className="px-4 py-3">
                                  {r.in_charge ? <span className="bg-slate-100 text-slate-900 font-bold px-2 py-1 rounded text-xs">👤 {r.in_charge}</span> : <span className="text-slate-700 font-medium italic text-xs bg-slate-100/70 px-2 py-0.5 rounded">No asignado</span>}
                                </td>
                                <td className="px-4 py-3">
                                  {r.requested_by ? <span className="bg-blue-50 border border-blue-100 px-2 py-1 rounded text-xs font-semibold text-blue-700">✏️ {r.requested_by}</span> : <span className="text-slate-700 font-medium bg-slate-100/70 px-2 py-0.5 rounded italic text-xs">No especificado</span>}
                                </td>
                                <td className="px-4 py-3 text-right">{r.quantity} {r.unit || ''}</td>
                                <td className="px-4 py-3 font-mono font-bold text-red-600 text-right">-{formatCurrency(Number(r.quantity || 0) * Number(r.unit_price || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}