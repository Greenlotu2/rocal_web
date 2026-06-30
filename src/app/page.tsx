'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
export const dynamic = 'force-dynamic';
import autoTable from 'jspdf-autotable';

export default function DashboardPage() {
  // --- ESTADOS ADICIONALES PARA FORMULARIOS MÓVILES HOMOLOGADOS ---
  const [numNota, setNumNota] = useState('');
  const [responsableGasto, setResponsableGasto] = useState('');
  const [justificacionCaja, setJustificacionCaja] = useState('');
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [modalidadFacturacion, setModalidadFacturacion] = useState('Por Semana');
  const [tarifaHora, setTarifaHora] = useState('');
  const [rubroClasificacion, setRubroClasificacion] = useState('Material');
  const [estadoPago, setEstadoPago] = useState('Liquidado');
  const [numCotizacion, setNumCotizacion] = useState('');
  const [encargadoRecibeDestajo, setEncargadoRecibeDestajo] = useState('');
  const [solicitadoPorDestajo, setSolicitadoPorDestajo] = useState('');
  
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null); 
  
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [residents, setResidents] = useState<any[]>([]);
  
  const [metrics, setMetrics] = useState({ gastoDirecto: 0, cajaChica: 0, personalActivo: 0 });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); 

  const [cajaChicaRecords, setCajaChicaRecords] = useState<any[]>([]);
  const [gastosGeneralesRecords, setGastosGeneralesRecords] = useState<any[]>([]);
  const [workersRecords, setWorkersRecords] = useState<any[]>([]);
  const [bitacoraRecords, setBitacoraRecords] = useState<any[]>([]); 
  const [planosRecords, setPlanosRecords] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<any[]>([]);
  const [maquinariaRecords, setMaquinariaRecords] = useState<any[]>([]); 

  const [activeTab, setActiveTab] = useState<'analisis' | 'caja' | 'personal' | 'bitacora' | 'planos'>('analisis');
  const [expenseSubTab, setExpenseSubTab] = useState<'generales' | 'caja_chica' | 'maquinaria' | 'destajos'>('generales'); 

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('Peón');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [loadingWorkerForm, setLoadingWorkerForm] = useState(false);
  const [workerFormError, setWorkerFormError] = useState<string | null>(null);

  const [isPlanosModalOpen, setIsPlanosModalOpen] = useState(false);
  const [planoName, setPlanoName] = useState('');
  const [planoVersion, setPlanoVersion] = useState('v1.0');
  const [planoFile, setPlanoFile] = useState<File | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(false);
  const [planoError, setPlanoError] = useState<string | null>(null);
  const [planoCategory, setPlanoCategory] = useState('Planos'); 
  const [planoFilter, setPlanoFilter] = useState<'Todos' | 'Planos' | 'Permisos' | 'Contratos' | 'Otros'>('Todos'); 
  
  const [conceptoGasto, setConceptoGasto] = useState('');
  const [unidadGasto, setUnidadGasto] = useState('');
  const [cantidadGasto, setCantidadGasto] = useState('');
  const [precioUnitarioGasto, setPrecioUnitarioGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [tipoGasto, setTipoGasto] = useState('Destajos y Materiales');
  const [proveedorGasto, setProveedorGasto] = useState('');
  const [fechaGasto, setFechaGasto] = useState(new Date().toISOString().split('T')[0]);
  
  const [loadingExpenseForm, setLoadingExpenseForm] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCliente, setNewProjectCliente] = useState('');
  const [newProjectFechaInicio, setNewProjectFechaInicio] = useState('');
  const [newProjectFechaFin, setNewProjectFechaFin] = useState('');
  const [newProjectNumContrato, setNewProjectNumContrato] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [loadingProjectForm, setLoadingProjectForm] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);

  // 🏁 ESTADOS PARA FINALIZAR OBRA
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishingProject, setFinishingProject] = useState(false);

  // ✏️ ESTADOS PARA EDITAR EL PROYECTO
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    client_name: '', 
    contract_number: '',
    start_date: '',
    end_date: ''
  });

  const COLORS = useMemo(() => ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'], []);
  
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const parsePhotos = (photoStr: any) => {
    if (!photoStr) return [];
    try {
      if (typeof photoStr === 'string' && photoStr.startsWith('[')) { return JSON.parse(photoStr); }
      return [photoStr];
    } catch (e) { return []; }
  };

  const renderAttendanceDots = (attendanceData: any) => {
    let attArray: boolean[] = [];
    if (typeof attendanceData === 'string') {
      try { attArray = JSON.parse(attendanceData); } catch (e) { attArray = []; }
    } else if (Array.isArray(attendanceData)) {
      attArray = attendanceData;
    }

    if (!attArray || attArray.length === 0) {
      return <span className="text-[10px] text-slate-400 italic">No registrada</span>;
    }

    const days = ['L', 'M', 'M', 'J', 'V', 'S'];
    return (
      <div className="flex gap-1 mt-1">
        {attArray.slice(0, 6).map((isPresent, i) => (
          <div key={i} title={isPresent ? 'Asistió' : 'Faltó'} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            {days[i]}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const cant = parseFloat(cantidadGasto) || 0;
    const precio = parseFloat(precioUnitarioGasto) || 0;
    if (cant > 0 && precio > 0) {
      setMontoGasto((cant * precio).toFixed(2));
    } else {
      setMontoGasto('');
    }
  }, [cantidadGasto, precioUnitarioGasto]);

  const fetchMetricsAndRecords = async (projectId: string) => {
    setLoadingMetrics(true);
    try {
      const { data: gastos } = await supabase.from('gastos_generales').select('*').eq('project_id', projectId).eq('is_active', true).order('fecha', { ascending: false });
      setGastosGeneralesRecords(gastos || []);

      // 🟢 FILTRO DE ACTIVOS: is_active
      const { data: workers } = await supabase.from('workers').select('*').eq('project_id', projectId).eq('is_active', true);
      setWorkersRecords(workers || []);

      const { data: caja } = await supabase.from('caja_chica').select('*').eq('project_id', projectId).order('fecha', { ascending: false });
      setCajaChicaRecords(caja || []);

      const { data: logs } = await supabase.from('logs').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      setBitacoraRecords(logs || []);

      const { data: payroll } = await supabase.from('payroll_records').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      setPayrollRecords(payroll || []);

      const { data: inventory } = await supabase.from('inventory').select('*').eq('project_id', projectId);
      setInventoryRecords(inventory || []);

      const { data: planos } = await supabase.from('planos').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      setPlanosRecords(planos || []);

      const { data: maquinaria } = await supabase.from('gastos_maquinaria').select('*').eq('project_id', projectId).order('fecha', { ascending: false });
      setMaquinariaRecords(maquinaria || []);

      setMetrics({
        gastoDirecto: gastos?.reduce((sum, item) => sum + (Number(item.monto) || 0), 0) || 0,
        personalActivo: workers?.length || 0,
        cajaChica: caja?.reduce((sum, item) => sum + (Number(item.monto) || 0), 0) || 0
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error cargando el tablero:", error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profileData) setUserRole(profileData.role);
      
      const { data: myProjects } = await supabase.from('projects').select('*').neq('status', 'finalizada');
      if (myProjects) {
        setProjects(myProjects);
        if (myProjects.length > 0) setSelectedProject(myProjects[0]); 
      }

      const { data: usersList } = await supabase.from('profiles').select('id, full_name').eq('role', 'residente');
      if (usersList) setResidents(usersList);

      setLoadingAuth(false);
    };
    checkUserAndFetchData();
  }, [router]);

  useEffect(() => {
    if (selectedProject) fetchMetricsAndRecords(selectedProject.id);
  }, [selectedProject]);

  const chartData = useMemo<{ name: string; value: number }[]>(() => {
    const totals = { 'Destajos y Materiales': 0, 'Mano de Obra': 0, 'Caja Chica': 0, 'Gastos Generales': 0 };

    if (gastosGeneralesRecords) {
      gastosGeneralesRecords.forEach(record => {
        const tipo = record.tipo as keyof typeof totals || 'Gastos Generales';
        totals[tipo !== undefined ? tipo : 'Gastos Generales'] += Number(record.monto) || 0;
      });
    }

    if (cajaChicaRecords) cajaChicaRecords.forEach(record => { totals['Caja Chica'] += Number(record.monto) || 0; });
    if (payrollRecords) payrollRecords.forEach(record => { totals['Mano de Obra'] += Number(record.final_salary || 0); });
    if (inventoryRecords) inventoryRecords.forEach(record => {
        const cantidad = Number(record.cantidad || record.quantity || record.stock || 1);
        const precioUnitario = Number(record.unit_price || 0);
        totals['Destajos y Materiales'] += (cantidad * precioUnitario);
    });

    return Object.entries(totals).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords]);

  const totalConsolidated = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

const weeklySummaryData = useMemo(() => {
    const weeks: Record<string, { startString: string, gastos: number, caja: number, nomina: number, destajos: number, total: number }> = {};

    const getMondayObj = (dString: string) => {
      if (!dString) return null;
      const d = new Date(dString);
      if (isNaN(d.getTime())) return null;
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0,0,0,0);
      return monday;
    };

    const processRecord = (record: any, dateField: string, value: number, type: 'gastos' | 'caja' | 'nomina' | 'destajos') => {
      const mon = getMondayObj(record[dateField]);
      if (!mon) return;
      const key = mon.toISOString().split('T')[0]; 
      if (!weeks[key]) {
        weeks[key] = {
          startString: mon.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
          gastos: 0, caja: 0, nomina: 0, destajos: 0, total: 0
        };
      }
      weeks[key][type] += value;
      weeks[key].total += value;
    };

    gastosGeneralesRecords.forEach(r => processRecord(r, 'fecha', Number(r.monto || 0), 'gastos'));
    cajaChicaRecords.forEach(r => processRecord(r, 'fecha', Number(r.monto || 0), 'caja'));
    payrollRecords.forEach(r => processRecord(r, 'week_start', Number(r.final_salary || 0), 'nomina'));
    inventoryRecords.forEach(r => processRecord(r, 'created_at', Number(r.cantidad || r.quantity || 1) * Number(r.unit_price || 0), 'destajos'));

    return Object.entries(weeks)
      .sort(([keyA], [keyB]) => new Date(keyB).getTime() - new Date(keyA).getTime())
      .map(([_, data]) => data);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords]);

  // 🧮 AGREGACIÓN DINÁMICA POR SEMANAS (Basado en week_start de payroll_records)
  const registrosAgrupadosPorSemana = useMemo(() => {
    const semanas: Record<string, { numeroSemana: string; fechaRepresentativa: Date; registros: any[]; subtotalSemana: number }> = {};

    payrollRecords.forEach((p) => {
      const fecha = new Date(p.week_start || p.created_at);
      const claveSemana = `Semana del ${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      const salarioFila = Number(p.final_salary || 0);

      if (!semanas[claveSemana]) {
        semanas[claveSemana] = {
          numeroSemana: claveSemana,
          fechaRepresentativa: fecha,
          registros: [],
          subtotalSemana: 0
        };
      }

      semanas[claveSemana].registros.push(p);
      semanas[claveSemana].subtotalSemana += salarioFila;
    });

    return Object.values(semanas).sort((a, b) => b.fechaRepresentativa.getTime() - a.fechaRepresentativa.getTime());
  }, [payrollRecords]);

  // 💰 COSTO TOTAL ACUMULADO
  const totalHistoricoRaya = useMemo(() => {
    return payrollRecords.reduce((sum, p) => sum + Number(p.final_salary || 0), 0);
  }, [payrollRecords]);

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoadingExpenseForm(true); 
    setExpenseFormError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      let error: any = null;

      switch (expenseSubTab) {
        case 'generales':
          const payloadGenerales: any = {
            project_id: selectedProject.id,
            concepto: conceptoGasto,
            unidad: unidadGasto || null,
            cantidad: cantidadGasto ? parseFloat(cantidadGasto) : null,
            precio_unitario: precioUnitarioGasto ? parseFloat(precioUnitarioGasto) : null,
            monto: parseFloat(montoGasto),
            tipo: tipoGasto,
            proveedor: proveedorGasto || null,
            fecha: fechaGasto,
            is_active: true,
            id_residente: userId
          };
          if (rubroClasificacion) payloadGenerales.clasificacion_rubro = rubroClasificacion;
          if (estadoPago) payloadGenerales.estado_pago = estadoPago;
          if (numCotizacion) payloadGenerales.numero_cotizacion = numCotizacion;

          const resGen = await supabase.from('gastos_generales').insert([payloadGenerales]);
          error = resGen.error;
          break;

        case 'caja_chica':
          const resCaja = await supabase.from('caja_chica').insert([{
            project_id: selectedProject.id,
            fecha: fechaGasto,
            encargado: responsableGasto || 'Oficina',
            concepto: conceptoGasto,
            monto: parseFloat(montoGasto),
            justificacion: justificacionCaja || null,
            numero_nota: numNota || null
          }]);
          error = resCaja.error;
          break;

        case 'maquinaria':
          const resMaq = await supabase.from('gastos_maquinaria').insert([{
            project_id: selectedProject.id,
            equipo: nombreEquipo || conceptoGasto,
            proveedor: proveedorGasto || null,
            fecha: fechaGasto,
            monto: parseFloat(montoGasto),
            asistencia_dias: cantidadGasto ? parseFloat(cantidadGasto) : null,
            categoria: 'renta',
          }]); 
          error = resMaq.error;
          break;

        case 'destajos':
          const resInv = await supabase.from('inventory').insert([{
            project_id: selectedProject.id,
            item_name: conceptoGasto, 
            unidad: unidadGasto || null,
            cantidad: cantidadGasto ? parseFloat(cantidadGasto) : 1,
            unit_price: precioUnitarioGasto ? parseFloat(precioUnitarioGasto) : 0,
            encargado_recibe: encargadoRecibeDestajo || null, 
            solicitado_por: solicitadoPorDestajo || null,     
            created_at: new Date().toISOString()
          }]);
          error = resInv.error;
          break;
      }

      if (error) throw error;

      setConceptoGasto(''); setUnidadGasto(''); setCantidadGasto(''); setPrecioUnitarioGasto(''); 
      setMontoGasto(''); setProveedorGasto(''); setNumNota(''); setResponsableGasto(''); setJustificacionCaja('');
      setNombreEquipo(''); setNumCotizacion(''); setEncargadoRecibeDestajo(''); setSolicitadoPorDestajo('');
      
      setIsExpenseModalOpen(false);
      await fetchMetricsAndRecords(selectedProject.id);

    } catch (err: any) { 
      setExpenseFormError(err.message); 
    } finally { 
      setLoadingExpenseForm(false); 
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || userRole !== 'admin') return; 
    setLoadingWorkerForm(true); setWorkerFormError(null);
    try {
      const { error } = await supabase.from('workers').insert([{ project_id: selectedProject.id, name_worker: newWorkerName, role: newWorkerRole, phone: newWorkerPhone || null, is_active: true }]);
      if (error) throw error;
      setNewWorkerName(''); setNewWorkerRole('Peón'); setNewWorkerPhone(''); setIsWorkerModalOpen(false);
      await fetchMetricsAndRecords(selectedProject.id);
    } catch (error: any) { setWorkerFormError(error.message); } finally { setLoadingWorkerForm(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProjectForm(true); setProjectFormError(null);
    try {
      const { data, error } = await supabase.from('projects').insert([{ name: newProjectName, client_name: newProjectCliente, start_date: newProjectFechaInicio || null, end_date: newProjectFechaFin || null, contract_number: newProjectNumContrato }]).select();
      if (error) throw error;
      if (data && data.length > 0) {
        const createdProject = data[0];
        if (selectedResidentId) await supabase.from('project_members').insert([{ project_id: createdProject.id, user_id: selectedResidentId, role: 'residente' }]);
        setNewProjectName(''); setNewProjectCliente(''); setNewProjectFechaInicio(''); setNewProjectFechaFin(''); setNewProjectNumContrato(''); setSelectedResidentId(''); setIsProjectModalOpen(false);
        setProjects(prev => [createdProject, ...prev]); setSelectedProject(createdProject);
      }
    } catch (error: any) { setProjectFormError(error.message); } finally { setLoadingProjectForm(false); }
  };

  const handleUploadPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !planoFile) return;
    setLoadingPlano(true); setPlanoError(null);
    try {
      const fileExt = planoFile.name.split('.').pop();
      const fileName = `${selectedProject.id}_${Date.now()}.${fileExt}`;
      const filePath = `planos_obra/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('planos').upload(filePath, planoFile);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('planos').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('planos').insert([{ 
        project_id: selectedProject.id, 
        name: planoName, 
        version: planoVersion, 
        categoria: planoCategory, 
        file_url: publicUrlData.publicUrl 
      }]);
      
      if (dbError) throw dbError;
      
      setPlanoName(''); setPlanoVersion('v1.0'); setPlanoCategory('Planos'); setPlanoFile(null); setIsPlanosModalOpen(false);
      await fetchMetricsAndRecords(selectedProject.id);
    } catch (error: any) { setPlanoError("Error al subir plano: " + error.message); } finally { setLoadingPlano(false); }
  };

  const handleExportBitacoraCSV = () => {
    if (bitacoraRecords.length === 0) return;
    const headers = ['Fecha', 'Categoria', 'Descripcion'];
    const rows = bitacoraRecords.map(r => [formatDate(r.created_at), r.category || 'General', `"${(r.description || '').replace(/"/g, '""')}"`]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Bitacora_${selectedProject?.name?.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportBitacoraPDF = () => {
    if (bitacoraRecords.length === 0) return;
    let rowsHtml = ''; const projectName = selectedProject?.name || 'Obra sin nombre';
    for (const log of bitacoraRecords) {
      let photosHtml = ''; const urls = parsePhotos(log.photo_url);
      if (urls.length > 0) {
        let imagesGrid = ''; for (const url of urls) { imagesGrid += `<div class="image-wrapper"><img src="${url}" class="log-image-item" /></div>`; }
        photosHtml = `<div class="log-images-grid">${imagesGrid}</div>`;
      }
      const fechaFormat = new Date(log.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const horaFormat = new Date(log.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      rowsHtml += `<div class="log-entry"><div class="log-header"><span class="log-date">${fechaFormat} - ${horaFormat}</span><span class="log-author">Reporta: Residente</span></div><div class="log-tags"><span class="tag tag-primary">${log.category || 'General'}</span></div><p class="log-desc">${log.description}</p>${photosHtml}</div>`;
    }
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte - ${projectName}</title><style>*{box-sizing:border-box;}body{font-family:sans-serif;padding:40px;}.log-entry{border:1px solid #ddd;padding:15px;margin-bottom:15px;}.log-images-grid{display:flex;gap:10px;margin-top:10px;}.log-image-item{max-width:200px;border-radius:5px;}</style></head><body><h2>Bitácora de Obra: ${projectName}</h2>${rowsHtml}<script>setTimeout(()=>{window.print();},500);</script></body></html>`;
    const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe); const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) { iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close(); }
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
  };

  const handleExportGastosCSV = () => {
    if (gastosGeneralesRecords.length === 0) return;
    const headers = ['Fecha', 'Concepto', 'Clasificación', 'Proveedor', 'Cantidad', 'Unidad', 'P. Unitario', 'Importe ($MXN)'];
    const rows = gastosGeneralesRecords.map(r => [formatDate(r.fecha).split(',')[0], `"${(r.concepto || '').replace(/"/g, '""')}"`, r.tipo || 'Gastos Generales', `"${(r.proveedor || 'S/P').replace(/"/g, '""')}"`, r.cantidad || 0, r.unidad || 'N/A', r.precio_unitario || 0, r.monto]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Gastos_${selectedProject?.name?.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportGastosPDF = () => {
    if (totalConsolidated === 0) return;
    let breakdownHtml = ''; chartData.forEach((item, idx) => { const percentage = totalConsolidated > 0 ? ((item.value / totalConsolidated) * 100).toFixed(1) : '0'; breakdownHtml += `<tr><td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${COLORS[idx % COLORS.length]}; margin-right:8px;"></span>${item.name}</td><td style="text-align: right; font-weight: bold;">${formatCurrency(item.value)}</td><td style="text-align: right; color: #64748B;">${percentage}%</td></tr>`; });
    let rowsHtml = ''; gastosGeneralesRecords.forEach(r => { rowsHtml += `<tr><td>${formatDate(r.fecha).split(',')[0]}</td><td style="font-weight: 500;">${r.concepto}</td><td>${r.tipo || 'Gastos Generales'}</td><td>${r.proveedor || 'S/P'}</td><td style="text-align: right;">${r.cantidad || '-'} ${r.unidad || ''}</td><td style="text-align: right;">${r.precio_unitario ? formatCurrency(r.precio_unitario) : '-'}</td><td style="text-align: right; color: #EF4444; font-weight: bold;">-${formatCurrency(r.monto)}</td></tr>`; });
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Financiero</title><style>body{font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left;}</style></head><body><h2>Estado Analítico de Gastos</h2><h3>Total Directo: ${formatCurrency(totalConsolidated)}</h3><table><thead><tr><th>Clasificación</th><th style="text-align:right;">Monto</th><th style="text-align:right;">%</th></tr></thead><tbody>${breakdownHtml}</tbody></table><br><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Clasif.</th><th>Proveedor</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">P.U.</th><th style="text-align:right;">Importe</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>setTimeout(()=>{window.print();},500);</script></body></html>`;
    const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe); const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) { iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close(); }
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
  };

  const handleExportWorkersCSV = () => {
    if (workersRecords.length === 0) return;
    const headers = ['Trabajador', 'Puesto', 'Sueldo Base Semanal ($)', 'Dias Asistidos', 'Faltas', 'Descuento Aplicado ($)', 'Motivo/Nota', 'Total a Pagar ($)'];
    const rows = workersRecords.map(w => {
      const weekly_salary = Number(w.weekly_salary || 0);
      const attendanceArray = w.attendance || [true, true, true, true, true];
      const daysPresent = attendanceArray.filter(Boolean).length;
      const daysAbsent = 5 - daysPresent;
      const dailySalary = weekly_salary / 5;
      const absenceDeduction = daysAbsent * dailySalary;
      const extraDeduction = Number(w.extraDeduction || 0);
      const totalDeductions = absenceDeduction + extraDeduction;
      const finalSalary = Math.max(0, (dailySalary * daysPresent) - extraDeduction);
      const notaLimpia = (w.reason || '').replace(/,/g, ' '); 
      return `"${w.name_worker || w.name}","${w.role}",${weekly_salary.toFixed(2)},${daysPresent},${daysAbsent},${totalDeductions.toFixed(2)},"${notaLimpia}",${finalSalary.toFixed(2)}`;
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Raya_${selectedProject?.name?.replace(/\s+/g, '_') || 'Obra'}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportWorkersPDF = () => {
    if (workersRecords.length === 0) return;
    const projectName = selectedProject?.name || 'Obra sin nombre';
    const calculateFinalSalary = (w: any) => {
      const dailySalary = (Number(w.weekly_salary) || 0) / 5;
      const attendanceArray = w.attendance || [true, true, true, true, true];
      const daysPresent = attendanceArray.filter(Boolean).length;
      const extraDeduction = Number(w.extraDeduction || 0);
      return Math.max(0, (dailySalary * daysPresent) - extraDeduction);
    };
    const totalFinal = workersRecords.reduce((sum, w) => sum + calculateFinalSalary(w), 0);

    const rowsHtml = workersRecords.map((worker, index) => {
      const dailySalary = (Number(worker.weekly_salary) || 0) / 5;
      const attendanceArray = worker.attendance || [true, true, true, true, true];
      const daysPresent = attendanceArray.filter(Boolean).length;
      const daysAbsent = 5 - daysPresent;
      const totalDeductions = (daysAbsent * dailySalary) + Number(worker.extraDeduction || 0);
      const finalSalary = calculateFinalSalary(worker);
      const reasonText = worker.reason ? `<br><span style="font-size: 9px; color: #DC2626;">(${worker.reason})</span>` : '';
      return `<tr class="${index % 2 === 0 ? 'bg-gray' : ''}"><td><strong>${worker.name_worker || worker.name}</strong><br><span style="font-size:10px;color:#666;">${worker.role}</span></td><td style="text-align:center;">$${(Number(worker.weekly_salary) || 0).toFixed(2)}</td><td style="text-align:center;color:#DC2626;">${daysAbsent > 0 ? daysAbsent : '-'}</td><td style="text-align:center;color:#DC2626;">${totalDeductions > 0 ? '-$' + totalDeductions.toFixed(2) : '-'}${reasonText}</td><td style="text-align:right;font-weight:bold;color:#059669;">$${finalSalary.toFixed(2)}</td><td style="text-align:center;"><div style="border-bottom:1px solid #999;width:80px;margin:auto;"></div></td></tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px;}th{background:#1E293B;color:#fff;padding:8px;text-align:left;}td{padding:8px;border-bottom:1px solid #eee;}.bg-gray{background:#F8FAFC;}</style></head><body><h2>Constructora Rocal S.A.</h2><h3>Reporte de Raya: ${projectName}</h3><table><thead><tr><th>Trabajador</th><th style="text-align:center;">Sueldo Base</th><th style="text-align:center;">Faltas</th><th style="text-align:center;">Descuentos</th><th style="text-align:right;">Pagar</th><th style="text-align:center;">Firma</th></tr></thead><tbody>${rowsHtml}</tbody></table><div style="float:right;margin-top:20px;border:1px solid #ccc;padding:15px;"><strong>Total a Pagar: $${totalFinal.toFixed(2)}</strong></div><script>setTimeout(()=>{window.print();},500);</script></body></html>`;
    const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe); const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) { iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close(); }
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
  };

  const startEditingProject = () => {
    setEditProjectForm({
      name: selectedProject?.name || '',
      client_name: selectedProject?.client_name || '',
      contract_number: selectedProject?.contract_number || '',
      start_date: selectedProject?.start_date ? selectedProject.start_date.split('T')[0] : '',
      end_date: selectedProject?.end_date ? selectedProject.end_date.split('T')[0] : ''
    });
    setIsEditingProject(true);
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;
    setUpdatingProject(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: editProjectForm.name,
          client_name: editProjectForm.client_name, 
          contract_number: editProjectForm.contract_number,
          start_date: editProjectForm.start_date || null,
          end_date: editProjectForm.end_date || null,
        })
        .eq('id', selectedProject.id)
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        const updated = data[0];
        setSelectedProject(updated);
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
        setIsEditingProject(false);
      }
    } catch (error: any) {
      alert("Error al actualizar la obra: " + error.message);
    } finally {
      setUpdatingProject(false);
    }
  };

  const generarReporteMaestroPDF = async (montoTotal: number): Promise<string | null> => {
    try {
      const projectName = selectedProject?.name || 'Obra sin nombre';
      const fechaCierre = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      doc.text('ACTA DE CIERRE DE OBRA', 14, 20);

      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.line(14, 24, 196, 24);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Proyecto: ${projectName}  |  Cliente: ${selectedProject?.client_name || 'N/A'}`, 14, 32);
      doc.text(`Contrato: ${selectedProject?.contract_number || 'N/A'}  |  Fecha de Cierre: ${fechaCierre}`, 14, 38);

      let y = 50;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('COSTO DIRECTO TOTAL', 14, y);
      doc.text('PERSONAL CONTRATADO', 84, y);
      doc.text('REPORTES EN BITÁCORA', 154, y);

      y += 7;
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68);
      doc.text(formatCurrency(montoTotal), 14, y); 
      doc.setTextColor(15, 23, 42);
      doc.text(String(metrics.personalActivo), 84, y);
      doc.text(String(bitacoraRecords.length), 154, y);

      y += 12;
      autoTable(doc, {
        startY: y,
        head: [['Rubro Financiero', 'Monto Acumulado', 'Participación (%)']],
        body: chartData.map(item => {
          const percentage = montoTotal > 0 ? ((item.value / montoTotal) * 100).toFixed(1) : '0';
          return [item.name, formatCurrency(item.value), `${percentage}%`];
        }),
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || y + 40;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Documento generado automáticamente por el sistema de control de obra.', 105, finalY + 20, { align: 'center' });
      doc.text('Firmas de conformidad requeridas en anexo físico.', 105, finalY + 25, { align: 'center' });

      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      
      const fileName = `${selectedProject?.id}_${Date.now()}.pdf`;
      const filePath = `actas_cierre/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reportes_cierre')
        .upload(filePath, pdfBlob, { 
          cacheControl: '3600',
          upsert: true 
        });

      if (uploadError) {
        throw new Error(`Error en Storage: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from('reportes_cierre').getPublicUrl(filePath);
      return publicUrlData.publicUrl;

    } catch (err: any) {
      console.error('Error dentro de generarReporteMaestroPDF:', err);
      alert('Falló la creación del PDF: ' + err.message);
      return null;
    }
  };

  const handleFinalizarObra = async () => {
    if (!selectedProject) return;
    setFinishingProject(true);

    try {
      const pdfUrl = await generarReporteMaestroPDF(totalConsolidated);
      
      if (!pdfUrl) {
        throw new Error('El Storage de Supabase no devolvió una URL válida.');
      }

      const { error } = await supabase
        .from('projects')
        .update({
          status: 'finalizada',
          end_date: new Date().toISOString().split('T')[0],
          reporte_cierre_url: pdfUrl
        })
        .eq('id', selectedProject.id);

      if (error) throw new Error(`Error actualizando tabla: ${error.message}`);

      const obrasRestantes = projects.filter(p => p.id !== selectedProject.id);
      setProjects(obrasRestantes);
      setSelectedProject(obrasRestantes.length > 0 ? obrasRestantes[0] : null);
      setIsFinishModalOpen(false);

      alert('¡Obra finalizada exitosamente! El archivo se cargó en el Storage y la tabla se actualizó.');

    } catch (error: any) {
      console.error('Error en handleFinalizarObra:', error);
      alert('Error crítico al finalizar la obra: ' + error.message);
    } finally {
      setFinishingProject(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* 🌑 BARRA LATERAL ESTILIZADA */}
      <div className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0 border-r border-slate-800 h-screen relative overflow-hidden">
        <div className="shrink-0">
          <div className="p-8 pb-4">
            <img 
              src="/logo-completo.png" 
              alt="Logo Rocal" 
              className="w-full h-auto mb-1 brightness-200" 
            />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {userRole === 'admin' ? 'Panel de Administración' : 'Control de Oficina'}
            </p>
          </div>

          <div className="px-5 mb-4 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Obras Activas</span>
            {userRole === 'admin' && (
              <button onClick={() => setIsProjectModalOpen(true)} className="text-blue-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent p-3" style={{maxHeight: 'calc(100vh - 280px)'}}>
          {projects.map(proj => (
            <button 
              key={proj.id} 
              onClick={() => setSelectedProject(proj)} 
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 text-sm font-medium
                ${selectedProject?.id === proj.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-[#1E293B] hover:text-white'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${selectedProject?.id === proj.id ? 'bg-white' : 'bg-slate-600'}`}></div>
              {proj.name}
            </button>
          ))}
        </nav>

        <div className="shrink-0 bg-[#0F172A]">
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2 px-5 mb-4 mt-2">
            <Link href="/perfil" className="flex items-center gap-3 py-2 text-slate-400 hover:text-white text-sm font-semibold transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center">👤</div>
              Mi Perfil
            </Link>

            {userRole === 'admin' && (
              <Link href="/admin/usuarios" className="flex items-center gap-3 py-2 text-slate-400 hover:text-white text-sm font-semibold transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center">⚙️</div>
                Control de Personal
              </Link>
            )}
             <Link href="/historial" className="flex items-center gap-3 py-2 text-slate-400 hover:text-white text-sm font-semibold transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center">📁</div>
                Historial
              </Link>
          </div>

          <div className="p-6 pt-4 border-t border-slate-800">
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-full flex items-center gap-3 text-red-400/80 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* ☀️ CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{selectedProject ? `Tablero: ${selectedProject.name}` : 'Selección de Proyecto'}</h2>
          
          {selectedProject && (
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Última sincronización: {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <button 
                onClick={() => fetchMetricsAndRecords(selectedProject.id)} 
                disabled={loadingMetrics}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
              >
                <svg className={`w-4 h-4 ${loadingMetrics ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {loadingMetrics ? 'Actualizando...' : 'Actualizar App'}
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {selectedProject ? (
            <div className="max-w-7xl mx-auto space-y-8">
              
              {/* TARJETA DE INFO DEL PROYECTO */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative transition-all">
                {userRole === 'admin' && !isEditingProject && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFinishModalOpen(true); }} 
                      className="flex items-center gap-1.5 text-red-500 hover:text-white transition-colors bg-red-50 px-2 py-1.5 rounded-lg hover:bg-red-500 text-xs font-bold cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Cerrar Obra
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); startEditingProject(); }} 
                      className="text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 p-1.5 rounded-lg hover:bg-blue-50 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                )}

                {isEditingProject ? (
                  <div className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Proyecto / Obra</label><input type="text" value={editProjectForm.name} onChange={(e) => setEditProjectForm({...editProjectForm, name: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Cliente de Obra</label><input type="text" value={editProjectForm.client_name} onChange={(e) => setEditProjectForm({...editProjectForm, client_name: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">No. de Contrato</label><input type="text" value={editProjectForm.contract_number} onChange={(e) => setEditProjectForm({...editProjectForm, contract_number: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Inicio</label><input type="date" value={editProjectForm.start_date} onChange={(e) => setEditProjectForm({...editProjectForm, start_date: e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-[11px]" /></div>
                        <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Fin</label><input type="date" value={editProjectForm.end_date} onChange={(e) => setEditProjectForm({...editProjectForm, end_date: e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-[11px]" /></div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button onClick={() => setIsEditingProject(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                      <button onClick={handleUpdateProject} disabled={updatingProject} className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">Guardar Cambios</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pr-10">
                    <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Proyecto / Obra:</span> <span className="font-bold text-slate-800 text-base block">{selectedProject.name}</span></div>
                    <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Cliente de Obra:</span> <span className="font-semibold text-slate-800 block">{selectedProject.client_name || 'No registrado'}</span></div>
                    <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">No. de Contrato:</span> <span className="font-mono text-slate-800 font-bold block">{selectedProject.contract_number || 'No registrado'}</span></div>
                    <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Periodo de Obra:</span> <span className="font-semibold text-slate-800 block">{formatDate(selectedProject.start_date).split(',')[0]} al {formatDate(selectedProject.end_date).split(',')[0]}</span></div>
                  </div>
                )}
              </div>

              {/* CONTENEDOR DE PESTAÑAS */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/50 px-6 flex gap-2 overflow-x-auto">
                  <button onClick={() => setActiveTab('analisis')} className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === 'analisis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>📊 Análisis Semanal</button>
                  <button onClick={() => setActiveTab('caja')} className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === 'caja' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}> 💰 Gastos de Obra</button>
                  <button onClick={() => setActiveTab('personal')} className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === 'personal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>👷‍♂️ Asistencia ({workersRecords.length})</button>
                  <button onClick={() => setActiveTab('bitacora')} className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === 'bitacora' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>📖 Bitácora ({bitacoraRecords.length})</button>
                  <button onClick={() => setActiveTab('planos')} className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === 'planos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}> 📐 Documentos ({planosRecords.length})</button>
                </div>

                <div className="overflow-x-auto">
                  
                  {/* PESTAÑAS EXISTENTES: ANALISIS, CAJA (MATERIALES, CAJA CHICA, MAQUINARIA, DESTAJOS) */}
                  {activeTab === 'analisis' && (
                    <div className="flex flex-col space-y-8 p-8">
                      <div className="flex justify-between items-center bg-white">
                        <p className="text-sm text-slate-500">Monitoreo analítico global consolidado y resumen semanal.</p>
                        <div className="flex gap-2">
                          <button onClick={handleExportGastosCSV} disabled={gastosGeneralesRecords.length === 0} className="bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold">Exportar Excel</button>
                          <button onClick={handleExportGastosPDF} disabled={totalConsolidated === 0} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold">Imprimir PDF</button>
                        </div>
                      </div>

                      {totalConsolidated > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8">
                          <div>
                            <div className="mb-6">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Costo Directo Total Acumulado</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalConsolidated)}</span>
                            </div>
                            <div className="space-y-4">
                              {chartData.map((item, idx) => {
                                const percentage = totalConsolidated > 0 ? ((item.value / totalConsolidated) * 100).toFixed(1) : '0';
                                return (
                                  <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                      <span className="font-medium text-slate-700">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                                      <span className="text-xs text-slate-400 ml-2">{percentage}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={75} outerRadius={110} dataKey="value" stroke="none">
                                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: any) => [formatCurrency(Number(value))]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400">Aún no hay suficientes datos históricos.</div>
                      )}

                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr><th>Semana Laboral</th><th className="text-right">Mano de Obra</th><th className="text-right">Destajos / Mat.</th><th className="text-right">Caja Chica</th><th className="text-right">Salida Total</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {weeklySummaryData.map((week, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="px-6 py-4 font-medium text-slate-900">Semana del {week.startString}</td>
                                <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(week.nomina)}</td>
                                <td className="px-6 py-4 text-right text-amber-600">{formatCurrency(week.destajos)}</td>
                                <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(week.gastos + week.caja)}</td>
                                <td className="px-6 py-4 text-right font-bold text-red-600">-{formatCurrency(week.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'caja' && (
                    <div className="flex flex-col">
                      <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex gap-3 overflow-x-auto items-center justify-between">
                        <div className="flex gap-2">
                          <button onClick={() => setExpenseSubTab('generales')} className={`px-4 py-2 rounded-full text-xs font-bold border ${expenseSubTab === 'generales' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>🧱 Materiales</button>
                          <button onClick={() => setExpenseSubTab('caja_chica')} className={`px-4 py-2 rounded-full text-xs font-bold border ${expenseSubTab === 'caja_chica' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>💵 Caja Chica</button>
                          <button onClick={() => setExpenseSubTab('maquinaria')} className={`px-4 py-2 rounded-full text-xs font-bold border ${expenseSubTab === 'maquinaria' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600'}`}> Tractor Maquinaria</button>
                          <button onClick={() => setExpenseSubTab('destajos')} className={`px-4 py-2 rounded-full text-xs font-bold border ${expenseSubTab === 'destajos' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600'}`}>🛠️ Destajos</button>
                        </div>
                        {(userRole === 'admin' || userRole === 'oficina') && (
                          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm">+ Registrar</button>
                        )}
                      </div>

                      {/* RENDERS COMPACTOS DE SUBTABS GASTOS */}
                      {expenseSubTab === 'generales' && (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4 text-right">Importe</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {gastosGeneralesRecords.map(r => (
                              <tr key={r.id}>
                                <td className="px-6 py-4 text-slate-600">{formatDate(r.fecha)}</td>
                                <td className="px-6 py-4 text-slate-900 font-medium">{r.concepto}</td>
                                <td className="px-6 py-4 text-slate-700">{r.proveedor || 'S/P'}</td>
                                <td className="px-6 py-4 text-red-600 font-bold text-right">-{formatCurrency(r.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {expenseSubTab === 'caja_chica' && (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Responsable</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4 text-right">Monto</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {cajaChicaRecords.map(r => (
                              <tr key={r.id}>
                                <td className="px-6 py-4 text-slate-600">{formatDate(r.fecha)}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{r.encargado}</td>
                                <td className="px-6 py-4 text-slate-600">{r.concepto || 'Gastos menores'}</td>
                                <td className="px-6 py-4 text-red-600 font-bold text-right">-{formatCurrency(r.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {expenseSubTab === 'maquinaria' && (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Equipo</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4 text-right">Importe</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {maquinariaRecords.map(r => (
                              <tr key={r.id}>
                                <td className="px-6 py-4 text-slate-600">{formatDate(r.fecha)}</td>
                                <td className="px-6 py-4 text-slate-900 font-medium">{r.equipo} {r.asistencia_dias && `(${r.asistencia_dias} hrs)`}</td>
                                <td className="px-6 py-4 text-slate-700">{r.proveedor || 'S/P'}</td>
                                <td className="px-6 py-4 text-red-600 font-bold text-right">-{formatCurrency(r.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {expenseSubTab === 'destajos' && (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Concepto / Material</th><th className="px-6 py-4">Encargado / Recibe</th><th className="px-6 py-4">Solicitado Por</th><th className="px-6 py-4 text-right">Cantidad</th><th className="px-6 py-4 text-right">Total</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {inventoryRecords.map((r, idx) => (
                              <tr key={r.id || idx} className="hover:bg-slate-50/80">
                                <td className="px-6 py-4 text-slate-600">{formatDate(r.created_at || r.fecha).split(',')[0]}</td>
                                <td className="px-6 py-4 text-slate-900 font-medium">{r.item_name || 'Sin nombre'}</td>
                                <td className="px-6 py-4 text-slate-700">
                                  {r.encargado_recibe ? <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">👤 {r.encargado_recibe}</span> : <span className="text-slate-400 italic text-xs">No asignado</span>}
                                </td>
                                <td className="px-6 py-4 text-slate-700">
                                  {r.solicitado_por ? <span className="bg-blue-50 border border-blue-100 px-2 py-1 rounded text-xs font-semibold text-blue-700">✏️ {r.solicitado_por}</span> : <span className="text-slate-400 italic text-xs">No especificado</span>}
                                </td>
                                <td className="px-6 py-4 text-right">{r.cantidad} {r.unidad || ''}</td>
                                <td className="px-6 py-4 font-bold text-red-600 text-right">-{formatCurrency(Number(r.cantidad || 0) * Number(r.unit_price || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 🟢 RENDERING DE ASISTENCIA (PORT EN FRONTIER COMPACTADO) */}
                  {!loadingMetrics && activeTab === 'personal' && (
                    <div className="flex flex-col space-y-6 p-8 bg-slate-50/30 w-full">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gasto en Raya Acumulado (En Pantalla)</span>
                          <span className="text-3xl font-black text-emerald-400 tracking-tight mt-1 font-mono">{formatCurrency(totalHistoricoRaya)}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                          <div><h4 className="text-sm font-bold text-slate-800">Listas de Raya Emitidas</h4><p className="text-xs text-slate-500 mt-0.5">Semanas auditadas en campo.</p></div>
                          <div className="bg-blue-50 text-blue-600 rounded-xl px-4 py-2.5 font-mono font-black text-xl border border-blue-100">{registrosAgrupadosPorSemana.length} Sem.</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-4">
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                              <div><h3 className="text-sm font-bold text-slate-800">Historial Agrupado por Semanas</h3><p className="text-xs text-slate-500 mt-0.5">Haz clic en cualquier bloque para abrir el desglose.</p></div>
                              <div className="flex gap-2">
                                <button onClick={handleExportWorkersCSV} disabled={workersRecords.length === 0} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200">Exportar Raya</button>
                                <button onClick={handleExportWorkersPDF} disabled={workersRecords.length === 0} className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Imprimir PDF</button>
                              </div>
                            </div>

                            <div className="p-6 space-y-4">
                              {registrosAgrupadosPorSemana.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 italic text-sm font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">No hay reportes de nómina o asistencia registrados para esta obra.</div>
                              ) : (
                                registrosAgrupadosPorSemana.map((bloque, idx) => (
                                  <details key={idx} className="group border border-slate-200 rounded-xl bg-white shadow-sm open:shadow-md transition-all duration-200">
                                    <summary className="list-none flex items-center justify-between p-4 font-semibold text-sm text-slate-800 cursor-pointer hover:bg-slate-50 select-none">
                                      <div className="flex items-center gap-3">
                                        <span className="transition-transform duration-200 group-open:rotate-90 text-slate-400 text-xs">▶</span>
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="font-bold text-slate-900">{bloque.numeroSemana}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-md">{bloque.registros.length} trabajadores</span>
                                        <span className="text-sm font-mono font-black text-red-600">-{formatCurrency(bloque.subtotalSemana)}</span>
                                      </div>
                                    </summary>

                                    <div className="border-t border-slate-100 bg-slate-50/40 overflow-hidden">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                                          <tr><th className="px-4 py-2.5">Trabajador</th><th className="px-4 py-2.5 text-center">Asistencia Semanal</th><th className="px-4 py-2.5">Notas / Deducciones</th><th className="px-4 py-2.5 text-right">Importe Neto Pagado</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {bloque.registros.map((p, rIdx) => {
                                            const trabajadorObj = workersRecords.find(w => w.id === p.worker_id);
                                            const nombreTrabajador = trabajadorObj?.name_worker || trabajadorObj?.name || 'Personal Inactivo';
                                            const rolTrabajador = p.role || trabajadorObj?.role || 'Obrero';
                                            
                                            return (
                                              <tr key={rIdx} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 align-middle"><span className="font-bold text-slate-900 block">{nombreTrabajador}</span><span className="text-slate-400 text-[10px] block mt-0.5 uppercase font-medium">{rolTrabajador}</span></td>
                                                <td className="px-4 py-3 text-center align-middle flex justify-center">{renderAttendanceDots(p.attendance)}</td>
                                                <td className="px-4 py-3 align-middle text-slate-600 max-w-[200px] truncate">
                                                  {p.deduction_reason || p.reason ? <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 font-medium text-[10px]">⚠ {p.deduction_reason || p.reason}</span> : <span className="text-slate-400 italic text-[11px]">Ninguna</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right align-middle font-bold text-slate-800 font-mono">{formatCurrency(p.final_salary || 0)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </details>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                          <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                            <div><h3 className="text-sm font-bold text-slate-800">Plantilla Oficial</h3><p className="text-[11px] text-slate-400 mt-0.5">Personal activo asignado.</p></div>
                            {userRole === 'admin' && (<button onClick={() => setIsWorkerModalOpen(true)} className="bg-blue-600 text-white text-[11px] font-black px-3 py-1.5 rounded-xl hover:bg-blue-700 shadow-sm uppercase tracking-wider">+ Alta</button>)}
                          </div>
                          
                          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                            {workersRecords.map((w) => (
                              <div key={w.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center text-xs">
                                <div><span className="font-bold text-slate-800 block text-sm">{w.name_worker || w.name}</span><span className="text-slate-400 font-semibold uppercase text-[10px] block mt-0.5">{w.role}</span></div>
                                <div className="text-right"><span className="font-mono font-black text-slate-900 block">{formatCurrency(w.weekly_salary || 0)}</span><span className="text-[9px] text-slate-400 block mt-0.5 uppercase tracking-wide">Base Semanal</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RESTO DE RENDERS DE BITACORA Y PLANOS */}
                  {!loadingMetrics && activeTab === 'bitacora' && (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold"><tr><th className="px-8 py-4 w-48">Fecha y Hora</th><th className="px-8 py-4 w-40">Categoría</th><th className="px-8 py-4">Descripción de Actividad</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {bitacoraRecords.map(r => (
                          <tr key={r.id}>
                            <td className="px-8 py-4 text-slate-500 font-medium whitespace-nowrap align-top">{formatDate(r.created_at)}</td>
                            <td className="px-8 py-4 align-top"><span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md border border-blue-100">{r.category || 'General'}</span></td>
                            <td className="px-8 py-4 text-slate-800 leading-relaxed align-top">
                              <p className="mb-2">{r.description}</p>
                              {parsePhotos(r.photo_url).length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  {parsePhotos(r.photo_url).map((url: string, index: number) => (
                                    <a key={index} href={url} target="_blank" rel="noreferrer" title="Ver imagen"><img src={url} alt="Evidencia" className="h-20 w-32 object-cover rounded-lg border border-slate-200" /></a>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {!loadingMetrics && activeTab === 'planos' && (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr><th className="px-8 py-4">Nombre del Documento</th><th className="px-8 py-4 w-32">Categoría</th><th className="px-8 py-4 w-32">Versión</th><th className="px-8 py-4 w-48">Fecha de Subida</th><th className="px-8 py-4 w-32 text-center">Acción</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {planosRecords.filter(p => planoFilter === 'Todos' || p.categoria === planoFilter).map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/80">
                            <td className="px-8 py-4 text-slate-900 font-medium">{p.name}</td>
                            <td className="px-8 py-4"><span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wider">{p.categoria || 'Planos'}</span></td>
                            <td className="px-8 py-4"><span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-indigo-100 uppercase tracking-wider">{p.version}</span></td>
                            <td className="px-8 py-4 text-slate-500">{formatDate(p.created_at).split(',')[0]}</td>
                            <td className="px-8 py-4 text-center"><a href={p.file_url} target="_blank" rel="noreferrer" className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">Ver Archivo</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                </div>
              </div>
            </div>
          ) : (
            <div className="text-center mt-20 text-slate-500">Selecciona una obra en el menú.</div>
          )}
        </main>
      </div>

      {/* MODALS EXISTENTES DE TU CORE (GASTOS, ALTA DE TRABAJADOR, PLANO, NUEVA OBRA Y CIERRE) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {expenseSubTab === 'generales' && '🧱 Nuevo Registro - Gastos Estructurales'}
                {expenseSubTab === 'caja_chica' && '➕ Nuevo Movimiento - Libro Mayor de Caja'}
                {expenseSubTab === 'maquinaria' && '🚜 Alta e Importe de Maquinaria'}
                {expenseSubTab === 'destajos' && '🛠️ Registro de Destajo / Inventario'}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleSaveGasto} className="p-6 space-y-5 overflow-y-auto flex-1">
              {expenseFormError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">{expenseFormError}</div>}
              
              <div className="w-full">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Operación</label>
                <input type="date" required value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:border-blue-500 font-medium focus:outline-none" />
              </div>

              {expenseSubTab === 'generales' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Clasificación del Rubro</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['Material', 'Admin', 'Burócrata', 'Asesoría'].map((rubro) => (
                        <button type="button" key={rubro} onClick={() => setRubroClasificacion(rubro)} className={`py-2 text-xs font-bold rounded-xl border transition-all ${rubroClasificacion === rubro ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{rubro}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Estado de Pago</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Liquidado', 'Abono', 'Por Pagar'].map((estado) => (
                        <button type="button" key={estado} onClick={() => setEstadoPago(estado)} className={`py-2 text-xs font-bold rounded-xl border transition-all ${estadoPago === estado ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{estado}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Concepto o Descripción</label><input type="text" required placeholder="Ej. Varilla de 3/8..." value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Proveedor de Materiales</label><input type="text" placeholder="Nombre o Razón social..." value={proveedorGasto} onChange={(e) => setProveedorGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unidad de Medida</label><input type="text" placeholder="Ej. Pzas / Ton" value={unidadGasto} onChange={(e) => setUnidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cantidad</label><input type="number" step="any" placeholder="1" value={cantidadGasto} onChange={(e) => setCantidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Precio Unitario ($)</label><input type="number" step="0.01" placeholder="0.00" value={precioUnitarioGasto} onChange={(e) => setPrecioUnitarioGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  </div>
                  <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Número de Cotización (Opcional)</label><input type="text" placeholder="Ej. COT-OBRA-023" value={numCotizacion} onChange={(e) => setNumCotizacion(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                </div>
              )}

              {expenseSubTab === 'caja_chica' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">No. Nota / Ticket</label><input type="text" placeholder="Opcional" value={numNota} onChange={(e) => setNumNota(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Responsable</label><input type="text" placeholder="Nombre de quien gasta..." value={responsableGasto} onChange={(e) => setResponsableGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  </div>
                  <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Artículo Adquirido</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-2"><input type="text" required placeholder="Concepto" value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-medium" /></div>
                      <div><input type="number" required placeholder="P.U ($)" value={precioUnitarioGasto} onChange={(e) => setPrecioUnitarioGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 font-medium" /></div>
                    </div>
                    <input type="number" placeholder="Cantidad" value={cantidadGasto} onChange={(e) => setCantidadGasto(e.target.value)} className="w-32 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-900 font-medium" />
                  </div>
                  <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nota / Justificación Adicional</label><textarea rows={2} placeholder="Ej. Compra urgente..." value={justificacionCaja} onChange={(e) => setJustificacionCaja(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                </div>
              )}

              {expenseSubTab === 'maquinaria' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre del Equipo</label><input type="text" required placeholder="Ej. Retroexcavadora..." value={nombreEquipo} onChange={(e) => setNombreEquipo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Proveedor de Renta</label><input type="text" placeholder="Proveedor..." value={proveedorGasto} onChange={(e) => setProveedorGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tarifa por HORA ($)</label><input type="number" required placeholder="Ej. 1200" value={precioUnitarioGasto} onChange={(e) => setPrecioUnitarioGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Horas Utilizadas esta Semana</label><input type="number" required placeholder="Ej. 10" value={cantidadGasto} onChange={(e) => setCantidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  </div>
                </div>
              )}

              {expenseSubTab === 'destajos' && (
                <div className="space-y-4">
                  <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Concepto / Actividad</label><input type="text" required placeholder="Ej. Cemento..." value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unidad</label><input type="text" placeholder="Ej. Bulto" value={unidadGasto} onChange={(e) => setUnidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">P.U / Mano de Obra ($)</label><input type="number" required placeholder="Ej. 250" value={precioUnitarioGasto} onChange={(e) => setPrecioUnitarioGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></div>
                  </div>
                  <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vol. / Cant. (Para esta semana)</label><input type="number" required placeholder="Ej. 10" value={cantidadGasto} onChange={(e) => setCantidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Encargado / Recibe (Opcional)</label>
                    <input type="text" placeholder="Nombre..." value={encargadoRecibeDestajo} onChange={(e) => setEncargadoRecibeDestajo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 mb-2" />
                    <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg">
                      {workersRecords.map((worker) => (
                        <button type="button" key={`recibe-${worker.id}`} onClick={() => setEncargadoRecibeDestajo(worker.name_worker || worker.name)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${encargadoRecibeDestajo === (worker.name_worker || worker.name) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-600'}`}>{worker.name_worker || worker.name}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Solicitado por (Opcional)</label>
                    <input type="text" placeholder="Nombre..." value={solicitadoPorDestajo} onChange={(e) => setSolicitadoPorDestajo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 mb-2" />
                    <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg">
                      {workersRecords.map((worker) => (
                        <button type="button" key={`pide-${worker.id}`} onClick={() => setSolicitadoPorDestajo(worker.name_worker || worker.name)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${solicitadoPorDestajo === (worker.name_worker || worker.name) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-600'}`}>{worker.name_worker || worker.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 text-white rounded-xl p-4 mt-4 shrink-0 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Importe Total Calculado:</span>
                <span className="text-xl font-black text-emerald-400">{montoGasto ? formatCurrency(parseFloat(montoGasto)) : '$0.00'}</span>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6 shrink-0">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" disabled={loadingExpenseForm || !montoGasto} className="bg-blue-600 text-white text-sm font-bold px-6 py-2 rounded-xl shadow-sm hover:bg-blue-700">Confirmar e Insertar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isWorkerModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Dar de Alta Trabajador</h3>
              <button onClick={() => setIsWorkerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleCreateWorker} className="p-6 space-y-4">
              {workerFormError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{workerFormError}</div>}
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre Completo</label><input type="text" required placeholder="Ej. Juan Pérez..." value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:border-blue-500 font-medium focus:outline-none" /></div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Categoría / Puesto</label>
                <select value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none bg-white font-medium">
                  <option value="Peón">Peón</option><option value="Albañil">Albañil</option><option value="Cabo de Oficios">Cabo de Oficios</option><option value="Fierrero">Fierrero</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Teléfono de Contacto</label><input type="tel" maxLength={10} placeholder="Ej. 222..." value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:border-blue-500 font-medium focus:outline-none" /></div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsWorkerModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" disabled={loadingWorkerForm} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-sm hover:bg-blue-700">Contratar Personal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPlanosModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold text-slate-900">Subir Plano / Archivo</h3><button onClick={() => setIsPlanosModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleUploadPlano} className="p-6 space-y-4">
              {planoError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{planoError}</div>}
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre del Plano</label><input type="text" required placeholder="Nombre..." value={planoName} onChange={(e) => setPlanoName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm" /></div>
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Versión</label><input type="text" required placeholder="Ej. v1.0" value={planoVersion} onChange={(e) => setPlanoVersion(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm" /></div>
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Archivo</label><input type="file" required accept=".pdf,image/*" onChange={(e) => setPlanoFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-slate-500" /></div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6"><button type="button" onClick={() => setIsPlanosModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button><button type="submit" disabled={loadingPlano || !planoFile} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-sm">Subir Archivo</button></div>
            </form>
          </div>
        </div>
      )}

      {isProjectModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold text-slate-900">Alta de Nueva Obra</h3><button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre de la Obra</label><input type="text" required placeholder="Nombre..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre del Cliente</label><input type="text" required placeholder="Cliente..." value={newProjectCliente} onChange={(e) => setNewProjectCliente(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">No. de Contrato</label><input type="text" required placeholder="Contrato..." value={newProjectNumContrato} onChange={(e) => setNewProjectNumContrato(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Asignar Residente</label><select value={selectedResidentId} onChange={(e) => setSelectedResidentId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm bg-white"><option value="">-- Seleccionar --</option>{residents.map((res) => (<option key={res.id} value={res.id}>{res.full_name}</option>))}</select></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6"><button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button><button type="submit" disabled={loadingProjectForm} className="bg-slate-900 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-sm">Confirmar Obra</button></div>
            </form>
          </div>
        </div>
      )}

      {isFinishModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><h3 className="text-xl font-bold text-red-700 text-center">¿Finalizar esta Obra?</h3></div>
            <div className="p-6 text-center text-slate-600 text-sm"><p>Estás a punto de archivar el proyecto <strong>"{selectedProject?.name}"</strong>.</p></div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3"><button type="button" onClick={() => setIsFinishModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 rounded-xl">Cancelar</button><button type="button" onClick={handleFinalizarObra} disabled={finishingProject} className="bg-red-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md">{finishingProject ? 'Procesando...' : 'Sí, Finalizar Obra'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}