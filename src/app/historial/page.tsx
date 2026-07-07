'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase'; // Ajusta la ruta según tu estructura
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
export const dynamic = 'force-dynamic';

export default function HistorialObrasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const fetchArchivedProjects = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'finalizada')
        .order('end_date', { ascending: false });

      if (error) {
        console.error('Error trayendo proyectos archivados:', error.message);
      }
      if (!error && data) {
        setArchivedProjects(data);
      }
      setLoading(false);
    };

    fetchArchivedProjects();
  }, [router]);

  // --- 📥 FUNCIÓN MAESTRA: GENERA EL PDF REPLICADO DIRECTAMENTE DESDE LA LISTA ---
  const handleExportDetailedPDFDirect = async (proyecto: any) => {
    setGeneratingId(proyecto.id);

    try {
      // 1. Descargar todos los rubros de esta obra al vuelo
      const [
        { data: gastos },
        { data: caja },
        { data: payroll },
        { data: inventory },
        { data: maquinaria },
        { data: workers }
      ] = await Promise.all([
        supabase.from('gastos_generales').select('*').eq('project_id', proyecto.id).eq('is_active', true),
        supabase.from('caja_chica').select('*').eq('project_id', proyecto.id),
        supabase.from('payroll_records').select('*').eq('project_id', proyecto.id),
        supabase.from('inventory').select('*').eq('project_id', proyecto.id),
        supabase.from('gastos_maquinaria').select('*').eq('project_id', proyecto.id),
        supabase.from('workers').select('*').eq('project_id', proyecto.id)
      ]);

      const gastosGeneralesRecords = gastos || [];
      const cajaChicaRecords = caja || [];
      const payrollRecords = payroll || [];
      const inventoryRecords = inventory || [];
      const maquinariaRecords = maquinaria || [];
      const workersRecords = workers || [];

      // 2. Calcular Totales para el Concentrado Financiero
      const totals = { 'Materiales e Insumos': 0, 'Mano de Obra': 0, 'Caja Chica': 0, 'Maquinaria': 0, 'Destajos': 0 };
      gastosGeneralesRecords.forEach(r => { totals['Materiales e Insumos'] += Number(r.monto) || 0; });
      cajaChicaRecords.forEach(r => { totals['Caja Chica'] += Number(r.monto) || 0; });
      payrollRecords.forEach(r => { totals['Mano de Obra'] += Number(r.final_salary || 0); });
      maquinariaRecords.forEach(r => { totals['Maquinaria'] += Number(r.monto) || 0; });
      inventoryRecords.forEach(r => { totals['Destajos'] += (Number(r.quantity || 1) * Number(r.unit_price || 0)); });

      const chartData = Object.entries(totals).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);
      const totalConsolidated = chartData.reduce((sum, item) => sum + item.value, 0);

      // 3. Agrupación por semanas de destajo
      const semanas: Record<string, any> = {};
      inventoryRecords.forEach((r) => {
        const fechaBase = new Date(r.created_at || r.fecha);
        if (isNaN(fechaBase.getTime())) return;
        const diaSemana = fechaBase.getDay();
        const diferenciaLunes = fechaBase.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
        const lunesSemana = new Date(fechaBase);
        lunesSemana.setDate(diferenciaLunes);
        lunesSemana.setHours(0, 0, 0, 0);

        const claveSemana = `Semana del ${lunesSemana.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
        if (!semanas[claveSemana]) {
          semanas[claveSemana] = { claveSemana, fechaRepresentativa: lunesSemana, registros: [], subtotalSemana: 0 };
        }
        semanas[claveSemana].registros.push(r);
        semanas[claveSemana].subtotalSemana += (Number(r.quantity || 0) * Number(r.unit_price || 0));
      });
      const destajosAgrupadosPorSemana = Object.values(semanas).sort((a: any, b: any) => b.fechaRepresentativa.getTime() - a.fechaRepresentativa.getTime());

      // 4. Construcción del motor jsPDF
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

      // Banner Resumen de Costo Directo
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

      // 2. Gastos Generales por Categoría (Subrubros sin Emojis)
      if (gastosGeneralesRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('2. Desglose de Gastos Generales por Clasificación Contable', 14, nextY);
        nextY += 6;

        const subrubros = ['Burócrata', 'Admin', 'Asesoría', 'Material'];
        subrubros.forEach(sub => {
          const registrosFiltrados = gastosGeneralesRecords.filter(r => r.categoria === sub);
          let pagado = 0; let credito = 0;
          registrosFiltrados.forEach(r => {
            if (r.estado_pago === 'Liquidado') pagado += Number(r.monto || 0);
            else if (r.estado_pago === 'Por Pagar') credito += Number(r.monto || 0);
            else if (r.estado_pago === 'Abono') { pagado += Number(r.monto || 0) * 0.5; credito += Number(r.monto || 0) * 0.5; }
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
                formatDate(r.fecha), r.concepto || 'Insumo', r.proveedor || 'S/P',
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

      // 3. Caja Chica
      if (cajaChicaRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('3. Rendimiento de Caja Chica (Ingresos, Gastos y Deudas)', 14, nextY);

        let totalIngresosCaja = 0; let totalGastosCaja = 0;
        cajaChicaRecords.forEach(r => {
          if (r.concepto?.toLowerCase().includes('inversión') || r.concepto?.toLowerCase().includes('ingreso')) totalIngresosCaja += Number(r.monto || 0);
          else totalGastosCaja += Number(r.monto || 0);
        });

        autoTable(doc, {
          startY: nextY + 5,
          head: [['Total Fondo (Ingresos)', 'Egresos (Gastos Ejecutados)', 'Balance de Caja']],
          body: [[formatCurrency(totalIngresosCaja), formatCurrency(totalGastosCaja), formatCurrency(totalIngresosCaja - totalGastosCaja)]],
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], halign: 'center' },
          styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 }
        });

        nextY = (doc as any).lastAutoTable.finalY + 6;

        autoTable(doc, {
          startY: nextY,
          head: [['Fecha', 'No. Nota', 'Responsable', 'Articulo / Concepto', 'Monto']],
          body: cajaChicaRecords.map(r => [formatDate(r.fecha), r.numero_nota || '-', r.encargado || 'Oficina', r.concepto || 'Gasto', formatCurrency(r.monto || 0)]),
          theme: 'striped',
          styles: { fontSize: 8.5 },
          columnStyles: { 4: { halign: 'right' } },
          pageBreak: 'avoid'
        });
        nextY = (doc as any).lastAutoTable.finalY + 12;
      }

      // 4. Maquinaria
      if (maquinariaRecords.length > 0) {
        if (nextY > 240) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('4. Estado Cuenta de Maquinaria Rallada (Abonos y Saldos)', 14, nextY);

        let totalAbonadoMaq = 0; let deudaAcumuladaMaq = 0;
        maquinariaRecords.forEach(r => {
          if (r.categoria === 'liquidado') totalAbonadoMaq += Number(r.monto || 0);
          else deudaAcumuladaMaq += Number(r.monto || 0);
        });

        autoTable(doc, {
          startY: nextY + 5,
          head: [['Monto Abonado', 'Deuda Acumulada', 'Saldo Total']],
          body: [[formatCurrency(totalAbonadoMaq), formatCurrency(deudaAcumuladaMaq), formatCurrency(totalAbonadoMaq + deudaAcumuladaMaq)]],
          theme: 'grid',
          headStyles: { fillColor: [120, 113, 108], halign: 'center' },
          styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 }
        });

        nextY = (doc as any).lastAutoTable.finalY + 6;

        autoTable(doc, {
          startY: nextY,
          head: [['Fecha', 'Equipo Contratado', 'Proveedor', 'Rendimiento', 'Importe']],
          body: maquinariaRecords.map(r => [formatDate(r.fecha), r.equipo || 'Maquinaria', r.proveedor || 'S/P', r.asistencia_dias ? `${r.asistencia_dias} hrs` : 'Corte Semanal', formatCurrency(r.monto || 0)]),
          theme: 'striped',
          styles: { fontSize: 8.5 },
          columnStyles: { 4: { halign: 'right' } },
          pageBreak: 'avoid'
        });
        nextY = (doc as any).lastAutoTable.finalY + 12;
      }

      // 5. Destajos + Raya Semanales Integrados
      if (destajosAgrupadosPorSemana.length > 0) {
        if (nextY > 230) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont('Helvetica', 'bold');
        doc.text('5. Rendimiento Semanal Integrado de Raya y Destajos', 14, nextY);
        nextY += 8;

        destajosAgrupadosPorSemana.forEach((bloque: any) => {
          if (nextY > 230) { doc.addPage(); nextY = 20; }

          const rayaDeLaSemana = payrollRecords.filter(p => {
            const dateP = new Date(p.week_start);
            return dateP.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) === 
                   new Date(bloque.fechaRepresentativa).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
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
          bloque.registros.forEach((dest: any) => {
            filasTabla.push(['DESTAJO', dest.name || 'Insumo', `Recibe: ${dest.in_charge || '-'}`, `${dest.quantity || 1} pz`, formatCurrency(Number(dest.quantity || 0) * Number(dest.unit_price || 0))]);
          });
          rayaDeLaSemana.forEach(ray => {
            const worker = workersRecords.find(w => w.id === ray.worker_id);
            filasTabla.push(['MANO DE OBRA', worker?.name_worker || worker?.name || 'Personal', ray.role || 'Obrero', ray.deduction_reason ? `Deducción: ${ray.deduction_reason}` : 'Asistencia Completa', formatCurrency(ray.final_salary || 0)]);
          });

          autoTable(doc, {
            startY: nextY + 8,
            head: [['Rubro', 'Concepto / Colaborador', 'Detalle / Puesto', 'Vol / Asistencia', 'Costo Neto']],
            body: filasTabla,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], fontSize: 8.5 },
            styles: { fontSize: 8 },
            columnStyles: { 4: { halign: 'right' } },
            pageBreak: 'avoid'
          });

          nextY = (doc as any).lastAutoTable.finalY + 14;
        });
      }

      doc.save(`Reporte_Maestro_Auditorado_${projectName.replace(/\s+/g, '_')}.pdf`);
    } catch (err: any) {
      alert("Error imprimiendo reporte: " + err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando archivo...</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* BARRA LATERAL */}
      <div className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-8">
          <img src="/logo-completo.png" alt="Logo Rocal" className="w-full h-auto mb-1 brightness-200" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Archivo Muerto</p>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors">
            ⬅️ Volver a Obras Activas
          </Link>
          <div className="w-full h-px bg-slate-800 my-4"></div>
          <span className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Obras Finalizadas</span>
          {archivedProjects.map(proj => (
            <Link
              key={proj.id}
              href={`/historial/${proj.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors"
            >
              <span className="truncate">{proj.name}</span>
              <span className="text-emerald-400 text-[10px] shrink-0">●</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 shadow-sm shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Historial y Archivo de Obras</h2>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            
            <div className="mb-8">
              <h1 className="text-2xl font-black text-slate-900">Obras Finalizadas</h1>
              <p className="text-slate-500 mt-1">Consulta los reportes, totales financieros y bitácoras de proyectos concluidos.</p>
            </div>

            {archivedProjects.length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl border-dashed">
                <span className="text-4xl mb-4 block">📂</span>
                <h3 className="text-lg font-bold text-slate-700">El archivo está vacío</h3>
                <p className="text-sm text-slate-500">Aún no has marcado ninguna obra como finalizada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {archivedProjects.map(proj => (
                  <div key={proj.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block">Concluida</span>
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">{proj.name}</h3>
                      </div>
                      <div className="bg-slate-100 text-slate-500 p-2 rounded-lg">🔒</div>
                    </div>
                    
                    <div className="space-y-2 mb-6 flex-1">
                      <p className="text-sm text-slate-600"><span className="font-semibold">Cliente:</span> {proj.client_name || 'N/A'}</p>
                      <p className="text-sm text-slate-600"><span className="font-semibold">Contrato:</span> {proj.contract_number || 'N/A'}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Finalizada el: {proj.end_date ? formatDate(proj.end_date) : 'Fecha no registrada'}
                      </p>
                    </div>

                    {/* SECCIÓN DE BOTONES TOTALMENTE REPLICADA Y VIVA */}
                    <div className="flex gap-3">
                      <Link 
                        href={`/historial/${proj.id}`} 
                        className="flex-1 flex items-center justify-center bg-white border-2 border-slate-900 text-slate-900 text-sm font-bold py-2.5 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Ver Resumen 📊
                      </Link>

                      <button 
                        onClick={() => handleExportDetailedPDFDirect(proj)}
                        disabled={generatingId === proj.id}
                        className="flex-1 flex items-center justify-center bg-slate-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-65"
                      >
                        {generatingId === proj.id ? 'Generando...' : 'PDF Maestro 📄'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}