'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase'; // Ajusta la ruta si tu carpeta lib está en otro nivel
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
export const dynamic = 'force-dynamic';

export default function ReporteFinalObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();


  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [proyecto, setProyecto] = useState<any | null>(null);

  const [gastosGeneralesRecords, setGastosGeneralesRecords] = useState<any[]>([]);
  const [cajaChicaRecords, setCajaChicaRecords] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);

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
        { data: inventory }
      ] = await Promise.all([
        supabase.from('gastos_generales').select('*').eq('project_id', projectId).eq('status', true),
        supabase.from('caja_chica').select('*').eq('project_id', projectId),
        supabase.from('payroll_records').select('*').eq('project_id', projectId),
        supabase.from('inventory').select('*').eq('project_id', projectId),
      ]);

      setGastosGeneralesRecords(gastos || []);
      setCajaChicaRecords(caja || []);
      setPayrollRecords(payroll || []);
      setInventoryRecords(inventory || []);

      setLoading(false);
    };

    fetchReporte();
  }, [projectId, router]);

  const chartData = useMemo<{ name: string; value: number }[]>(() => {
    const totals = { 'Destajos y Materiales': 0, 'Mano de Obra': 0, 'Caja Chica': 0, 'Gastos Generales': 0 };

    gastosGeneralesRecords.forEach(record => {
      const tipo = record.tipo as keyof typeof totals || 'Gastos Generales';
      totals[tipo !== undefined ? tipo : 'Gastos Generales'] += Number(record.monto) || 0;
    });

    cajaChicaRecords.forEach(record => { totals['Caja Chica'] += Number(record.monto) || 0; });
    payrollRecords.forEach(record => { totals['Mano de Obra'] += Number(record.finally_salary || record.final_salary || 0); });
    inventoryRecords.forEach(record => {
      const cantidad = Number(record.cantidad || record.quantity || record.stock || 1);
      const precioUnitario = Number(record.unit_price || 0);
      totals['Destajos y Materiales'] += (cantidad * precioUnitario);
    });

    return Object.entries(totals).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords]);

  const totalConsolidated = chartData.reduce((sum, item) => sum + item.value, 0);
  const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'];

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

            {/* TARJETA DE INFO DEL PROYECTO (solo lectura) */}
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

              <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
  {proyecto.reporte_cierre_url ? (
    <a
      href={proyecto.reporte_cierre_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-3a2 2 0 00-2-2H5a2 2 0 00-2 2v3a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Ver Acta de Cierre (PDF)
    </a>
  ) : (
    <span className="text-xs text-slate-400 italic">No se generó un Acta de Cierre para esta obra.</span>
  )}
</div>
            </div>

            {/* RESUMEN FINANCIERO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">Resumen Financiero Final</h3>
              </div>

              {totalConsolidated > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8">
                  <div>
                    <div className="mb-6">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Costo Directo Total Acumulado
                      </span>
                      <span className="text-3xl font-black text-slate-900 tracking-tight">
                        {formatCurrency(totalConsolidated)}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Distribución por Macro Rubro
                    </h4>

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
                <div className="p-8 text-center text-sm text-slate-400 font-medium">
                  No hay datos financieros registrados para esta obra.
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}