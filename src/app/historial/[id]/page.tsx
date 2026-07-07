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

  // --- LÓGICA DE AGRUPACIÓN POR SEMANAS ---
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

  // --- 📝 GENERACIÓN DE REPORTE AUDITADO ÚNICO ---
  const handleExportDetailedPDF = async () => {
    if (!proyecto) return;
    setExportingPDF(true);

    try {
      const doc = new jsPDF();
      const projectName = proyecto.name || 'Obra';
      
      // Encabezado Principal
      doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
      doc.text('AUDITORÍA FINANCIERA MAESTRA DE OBRA', 14, 22);
      doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.75); doc.line(14, 26, 196, 26);

      doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'normal');
      doc.text(`Cliente: ${proyecto.client_name || 'N/A'}`, 14, 33);
      doc.text(`No. de Contrato: ${proyecto.contract_number || 'N/A'}`, 14, 38);
      doc.text(`Periodo Operativo: ${formatDate(proyecto.start_date)} al ${formatDate(proyecto.end_date)}`, 14, 43);

      // Banner Resumen de Salidas
      doc.setFillColor(15, 23, 42); doc.roundedRect(14, 49, 182, 14, 2, 2, 'F');
      doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont('Helvetica', 'bold');
      doc.text('COSTO DIRECTO TOTAL ACUMULADO AUDITADO:', 20, 58);
      doc.setFontSize(12); doc.setTextColor(52, 211, 153);
      doc.text(formatCurrency(totalConsolidated), 145, 58);

      // 1. Resumen Macro Rubros
      doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text('1. Concentrado General Financiero por Rubro', 14, 76);
      autoTable(doc, {
        startY: 81,
        head: [['Macro Rubro de Obra', 'Inversión Acumulada', 'Porcentaje']],
        body: chartData.map(item => [
          item.name,
          formatCurrency(item.value),
          `${totalConsolidated > 0 ? ((item.value / totalConsolidated) * 100).toFixed(1) : 0}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontStyle: 'bold' }
      });

      let nextY = (doc as any).lastAutoTable.finalY + 12;

      // 2. AUDITORÍA DETALLADA: GASTOS GENERALES POR SUBRUBROS
      if (gastosGeneralesRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('2. Desglose de Gastos Generales por Clasificación Contable', 14, nextY);
        nextY += 6;

        const subrubros = ['Burócrata', 'Admin', 'Asesoría', 'Material'];
        
        subrubros.forEach(sub => {
          const registrosFiltrados = gastosGeneralesRecords.filter(r => r.categoria === sub);
          
          let pagado = 0;
          let credito = 0;
          
          registrosFiltrados.forEach(r => {
            if (r.estado_pago === 'Liquidado') pagado += Number(r.monto || 0);
            else if (r.estado_pago === 'Por Pagar') credito += Number(r.monto || 0);
            else if (r.estado_pago === 'Abono') {
              pagado += Number(r.monto || 0) * 0.5;
              credito += Number(r.monto || 0) * 0.5;
            }
          });

          const saldoTotalRubro = pagado + credito;

          if (registrosFiltrados.length > 0) {
            if (nextY > 240) { doc.addPage(); nextY = 20; }
            
            const nombreMostrar = sub === 'Material' ? 'Materiales' : sub === 'Admin' ? 'Administrativos' : sub === 'Burócrata' ? 'Burocratas' : 'Asesorias';

            doc.setFontSize(10); doc.setTextColor(30, 41, 59); doc.setFont('Helvetica', 'bold');
            doc.text(`Subrubro: ${nombreMostrar}  |  Total: ${formatCurrency(saldoTotalRubro)}`, 14, nextY);

            autoTable(doc, {
              startY: nextY + 3,
              head: [['Fecha', 'Concepto', 'Proveedor', 'Pagado', 'Crédito', 'Saldo']],
              body: registrosFiltrados.map(r => [
                formatDate(r.fecha),
                r.concepto || 'Insumo',
                r.proveedor || 'S/P',
                r.estado_pago === 'Liquidado' ? formatCurrency(r.monto) : r.estado_pago === 'Abono' ? formatCurrency(r.monto * 0.5) : '$0.00',
                r.estado_pago === 'Por Pagar' ? formatCurrency(r.monto) : r.estado_pago === 'Abono' ? formatCurrency(r.monto * 0.5) : '$0.00',
                formatCurrency(r.monto)
              ]),
              theme: 'grid',
              headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
              styles: { fontSize: 8 },
              columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
              pageBreak: 'avoid'
            });
            
            nextY = (doc as any).lastAutoTable.finalY + 12;
          }
        });
      }

      // 3. AUDITORÍA DETALLADA: CAJA CHICA (INGRESO, GASTO Y DEUDA)
      if (cajaChicaRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('3. Rendimiento de Caja Chica (Ingresos, Gastos y Deudas)', 14, nextY);

        let totalIngresosCaja = 0;
        let totalGastosCaja = 0;

        cajaChicaRecords.forEach(r => {
          if (r.concepto?.toLowerCase().includes('inversión') || r.concepto?.toLowerCase().includes('ingreso')) {
            totalIngresosCaja += Number(r.monto || 0);
          } else {
            totalGastosCaja += Number(r.monto || 0);
          }
        });

        const saldoDeudaCaja = totalIngresosCaja - totalGastosCaja;

        autoTable(doc, {
          startY: nextY + 5,
          head: [['Total Fondo (Ingresos)', 'Egresos (Gastos Ejecutados)', 'Balance de Caja (Deuda/Saldo)']],
          body: [[formatCurrency(totalIngresosCaja), formatCurrency(totalGastosCaja), formatCurrency(saldoDeudaCaja)]],
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], halign: 'center' },
          styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 }
        });

        nextY = (doc as any).lastAutoTable.finalY + 6;

        autoTable(doc, {
          startY: nextY,
          head: [['Fecha', 'No. Nota', 'Responsable', 'Artículo comprado / Concepto', 'Monto']],
          body: cajaChicaRecords.map(r => [
            formatDate(r.fecha),
            r.numero_nota || '-',
            r.encargado || 'Oficina',
            r.concepto || 'Gasto menor',
            formatCurrency(r.monto || 0)
          ]),
          theme: 'striped',
          styles: { fontSize: 8.5 },
          columnStyles: { 4: { halign: 'right' } },
          pageBreak: 'avoid'
        });
        nextY = (doc as any).lastAutoTable.finalY + 12;
      }

      // 4. AUDITORÍA DETALLADA: MAQUINARIA (ABONADO, DEUDA ACUMULADA Y SALDO)
      if (maquinariaRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('4. Estado Cuenta de Maquinaria Rentada (Abonos y Saldos)', 14, nextY);

        let totalAbonadoMaq = 0;
        let deudaAcumuladaMaq = 0;

        maquinariaRecords.forEach(r => {
          if (r.categoria === 'liquidado') totalAbonadoMaq += Number(r.monto || 0);
          else deudaAcumuladaMaq += Number(r.monto || 0);
        });

        const saldoFinalMaq = totalAbonadoMaq + deudaAcumuladaMaq;

        autoTable(doc, {
          startY: nextY + 5,
          head: [['Monto Abonado', 'Deuda Acumulada', 'Saldo Total']],
          body: [[formatCurrency(totalAbonadoMaq), formatCurrency(deudaAcumuladaMaq), formatCurrency(saldoFinalMaq)]],
          theme: 'grid',
          headStyles: { fillColor: [120, 113, 108], halign: 'center' },
          styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 }
        });

        nextY = (doc as any).lastAutoTable.finalY + 6;

        autoTable(doc, {
          startY: nextY,
          head: [['Fecha', 'Equipo Contratado', 'Proveedor', 'Rendimiento', 'Importe']],
          body: maquinariaRecords.map(r => [
            formatDate(r.fecha),
            r.equipo || 'Maquinaria',
            r.proveedor || 'S/P',
            r.asistencia_dias ? `${r.asistencia_dias} hrs` : 'Corte Semanal',
            formatCurrency(r.monto || 0)
          ]),
          theme: 'striped',
          styles: { fontSize: 8.5 },
          columnStyles: { 4: { halign: 'right' } },
          pageBreak: 'avoid'
        });
        nextY = (doc as any).lastAutoTable.finalY + 12;
      }

      // 5. Destajos Semanales (Mano de obra + Destajos integrados de forma limpia)
      if (destajosAgrupadosPorSemana.length > 0) {
        if (nextY > 230) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('5. Rendimiento Semanal Integrado de Raya y Destajos', 14, nextY);
        nextY += 8;

        destajosAgrupadosPorSemana.forEach((bloque) => {
          if (nextY > 230) { doc.addPage(); nextY = 20; }

          const rayaDeLaSemana = payrollRecords.filter(p => {
            const dateP = new Date(p.week_start);
            return dateP.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) === 
                   bloque.fechaRepresentativa.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
          });

          const totalRayaSemana = rayaDeLaSemana.reduce((sum, p) => sum + Number(p.final_salary || 0), 0);
          const balanceGlobalSemanal = bloque.subtotalSemana + totalRayaSemana;

          doc.setFontSize(10); doc.setTextColor(30, 41, 59); doc.setFont('Helvetica', 'bold');
          doc.text(`${bloque.claveSemana}`, 14, nextY);
          
          doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.setFont('Helvetica', 'normal');
          doc.text(`Destajos: ${formatCurrency(bloque.subtotalSemana)}  |  Nomina: ${formatCurrency(totalRayaSemana)}`, 14, nextY + 5);
          
          doc.setFontSize(10); doc.setTextColor(185, 28, 28); doc.setFont('Helvetica', 'bold');
          doc.text(`Total Salida: -${formatCurrency(balanceGlobalSemanal)}`, 145, nextY + 5);

          const filasTabla: any[] = [];
          
          bloque.registros.forEach(dest => {
            filasTabla.push([
              'DESTAJO', 
              dest.name || 'Insumo',
              `Recibe: ${dest.in_charge || '-'}`,
              `${dest.quantity || 1} pz`,
              formatCurrency(Number(dest.quantity || 0) * Number(dest.unit_price || 0))
            ]);
          });

          rayaDeLaSemana.forEach(ray => {
            const worker = workersRecords.find(w => w.id === ray.worker_id);
            filasTabla.push([
              'MANO DE OBRA', 
              worker?.name_worker || worker?.name || 'Personal',
              ray.role || 'Obrero',
              ray.deduction_reason ? `Deducción: ${ray.deduction_reason}` : 'Asistencia Completa',
              formatCurrency(ray.final_salary || 0)
            ]);
          });

          autoTable(doc, {
            startY: nextY + 8, 
            head: [['Rubro', 'Concepto / Colaborador', 'Detalle / Puesto', 'Vol / Asistencia', 'Costo Neto']],
            body: filasTabla,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], fontSize: 8.5, fontStyle: 'bold' },
            styles: { fontSize: 8 },
            columnStyles: { 4: { halign: 'right' } },
            pageBreak: 'avoid'
          });

          nextY = (doc as any).lastAutoTable.finalY + 14;
        });
      }

      doc.save(`Reporte_Maestro_Auditorado_${projectName.replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert("Error al estructurar el reporte extendido: " + err.message);
    } final_metrics: {
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

              {/* 🔑 MODIFICADO: Unificamos a un solo botón borrando el enlace al PDF original del Storage */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={handleExportDetailedPDF}
                  disabled={exportingPDF}
                  className="flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  📥 {exportingPDF ? 'Procesando Auditoría...' : 'Imprimir Reporte Detallado'}
                </button>
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
                  <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-700 font-bold border-b"><tr><th className="p-4">Fecha</th><th className="p-4">No. Nota</th><th className="p-4">Responsable</th><th className="p-4">Concepto</th><th className="p-4 text-right">Monto</th></tr></thead><tbody className="divide-y text-slate-900">{cajaChicaRecords.map(r => (<tr key={r.id}><td className="p-4 text-slate-600">{formatDate(r.fecha)}</td><td className="p-4 font-mono font-bold text-blue-600">{r.numero_nota || '-'}</td><td className="p-4 font-semibold text-slate-900">{r.encargado}</td><td className="p-4 font-medium text-slate-700">{r.concepto}</td><td className="p-4 text-right text-red-600 font-bold">-{formatCurrency(r.monto)}</td></tr>))}</tbody></table>
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