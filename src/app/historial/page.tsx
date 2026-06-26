'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase'; // Asegúrate de que la ruta sea correcta
export const dynamic = 'force-dynamic';

export default function HistorialObrasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);

  useEffect(() => {
    const fetchArchivedProjects = async () => {
      // Validar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Traer SOLO los proyectos con status 'finalizada'
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* 🌑 BARRA LATERAL SIMPLIFICADA (Igual que tu dashboard, pero apuntando a otros links) */}
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

      {/* ☀️ CONTENIDO PRINCIPAL */}
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

            {loading ? (
              <div className="text-center py-20 text-slate-400">Cargando archivo...</div>
            ) : archivedProjects.length === 0 ? (
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
                      <p className="text-sm text-slate-600"><span className="font-semibold">Cliente:</span> {proj.client_name}</p>
                      <p className="text-sm text-slate-600"><span className="font-semibold">Contrato:</span> {proj.contract_number}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Finalizada el: {proj.end_date ? new Date(proj.end_date).toLocaleDateString('es-MX') : 'Fecha no registrada'}
                      </p>
                    </div>

                    {/* 👇 NUEVA SECCIÓN DE BOTONES DIVIDIDA 👇 */}
                    <div className="flex gap-3">
                      {/* Opción A: Ir a la página dinámica con las gráficas de Recharts */}
                      <Link 
                        href={`/historial/${proj.id}`} 
                        className="flex-1 flex items-center justify-center bg-white border-2 border-slate-900 text-slate-900 text-sm font-bold py-2.5 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Ver Resumen 📊
                      </Link>

                      {/* Opción B: Abrir el PDF de Supabase directamente */}
                      {proj.reporte_cierre_url ? (
                        <a 
                          href={proj.reporte_cierre_url} 
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center bg-slate-900 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
                        >
                          PDF Directo 📄
                        </a>
                      ) : (
                        <button 
                          disabled 
                          className="flex-1 flex items-center justify-center bg-slate-200 text-slate-400 text-sm font-bold py-2.5 rounded-xl cursor-not-allowed"
                        >
                          Sin PDF
                        </button>
                      )}
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