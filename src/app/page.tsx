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
    client_name: '', // 🟢 CORRECCIÓN: usamos client_name
    contract_number: '',
    start_date: '',
    end_date: ''
  });



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
      const { data: gastos } = await supabase.from('gastos_generales').select('*').eq('project_id', projectId).eq('status', true).order('fecha', { ascending: false });
      setGastosGeneralesRecords(gastos || []);

      const { data: workers } = await supabase.from('workers').select('*').eq('project_id', projectId).eq('status', true);
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

      const { data: maquinaria } = await supabase.from('gastos_maquinaria').select('*').eq('project_id', projectId).eq('status', true).order('fecha', { ascending: false });
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
    if (payrollRecords) payrollRecords.forEach(record => { totals['Mano de Obra'] += Number(record.finally_salary || record.final_salary || 0); });
    if (inventoryRecords) inventoryRecords.forEach(record => {
        const cantidad = Number(record.cantidad || record.quantity || record.stock || 1);
        const precioUnitario = Number(record.unit_price || 0);
        totals['Destajos y Materiales'] += (cantidad * precioUnitario);
    });

    return Object.entries(totals).map(([name, value]) => ({ name, value: Number(value) })).sort((a, b) => b.value - a.value);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords]);

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
    payrollRecords.forEach(r => processRecord(r, r.fecha ? 'fecha' : 'created_at', Number(r.finally_salary || r.final_salary || 0), 'nomina'));
    inventoryRecords.forEach(r => processRecord(r, 'created_at', Number(r.cantidad || r.quantity || 1) * Number(r.unit_price || 0), 'destajos'));

    return Object.entries(weeks)
      .sort(([keyA], [keyB]) => new Date(keyB).getTime() - new Date(keyA).getTime())
      .map(([_, data]) => data);
  }, [gastosGeneralesRecords, cajaChicaRecords, payrollRecords, inventoryRecords]);

  const totalConsolidated = chartData.reduce((sum, item) => sum + item.value, 0);
  const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'];

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoadingExpenseForm(true); setExpenseFormError(null);
    try {
      const { error } = await supabase.from('gastos_generales').insert([{ project_id: selectedProject.id, concepto: conceptoGasto, unidad: unidadGasto || null, cantidad: cantidadGasto ? parseFloat(cantidadGasto) : null, precio_unitario: precioUnitarioGasto ? parseFloat(precioUnitarioGasto) : null, monto: parseFloat(montoGasto), tipo: tipoGasto, proveedor: proveedorGasto || null, fecha: fechaGasto, status: true }]);
      if (error) throw error;
      setConceptoGasto(''); setUnidadGasto(''); setCantidadGasto(''); setPrecioUnitarioGasto(''); setMontoGasto(''); setTipoGasto('Destajos y Materiales'); setProveedorGasto(''); setFechaGasto(new Date().toISOString().split('T')[0]); setIsExpenseModalOpen(false);
      await fetchMetricsAndRecords(selectedProject.id);
    } catch (error: any) { setExpenseFormError(error.message); } finally { setLoadingExpenseForm(false); }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || userRole !== 'admin') return; 
    setLoadingWorkerForm(true); setWorkerFormError(null);
    try {
      const { error } = await supabase.from('workers').insert([{ project_id: selectedProject.id, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone || null, status: true }]);
      if (error) throw error;
      setNewWorkerName(''); setNewWorkerRole('Peón'); setNewWorkerPhone(''); setIsWorkerModalOpen(false);
      await fetchMetricsAndRecords(selectedProject.id);
    } catch (error: any) { setWorkerFormError(error.message); } finally { setLoadingWorkerForm(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProjectForm(true); setProjectFormError(null);
    try {
      // 🟢 CORRECCIÓN: Guardamos 'client_name' en lugar de 'cliente'
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
      return `"${w.name}","${w.role}",${weekly_salary.toFixed(2)},${daysPresent},${daysAbsent},${totalDeductions.toFixed(2)},"${notaLimpia}",${finalSalary.toFixed(2)}`;
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
      return `<tr class="${index % 2 === 0 ? 'bg-gray' : ''}"><td><strong>${worker.name}</strong><br><span style="font-size:10px;color:#666;">${worker.role}</span></td><td style="text-align:center;">$${(Number(worker.weekly_salary) || 0).toFixed(2)}</td><td style="text-align:center;color:#DC2626;">${daysAbsent > 0 ? daysAbsent : '-'}</td><td style="text-align:center;color:#DC2626;">${totalDeductions > 0 ? '-$' + totalDeductions.toFixed(2) : '-'}${reasonText}</td><td style="text-align:right;font-weight:bold;color:#059669;">$${finalSalary.toFixed(2)}</td><td style="text-align:center;"><div style="border-bottom:1px solid #999;width:80px;margin:auto;"></div></td></tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:40px;}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:20px;}th{background:#1E293B;color:#fff;padding:8px;text-align:left;}td{padding:8px;border-bottom:1px solid #eee;}.bg-gray{background:#F8FAFC;}</style></head><body><h2>Constructora Rocal S.A.</h2><h3>Reporte de Raya: ${projectName}</h3><table><thead><tr><th>Trabajador</th><th style="text-align:center;">Sueldo Base</th><th style="text-align:center;">Faltas</th><th style="text-align:center;">Descuentos</th><th style="text-align:right;">Pagar</th><th style="text-align:center;">Firma</th></tr></thead><tbody>${rowsHtml}</tbody></table><div style="float:right;margin-top:20px;border:1px solid #ccc;padding:15px;"><strong>Total a Pagar: $${totalFinal.toFixed(2)}</strong></div><script>setTimeout(()=>{window.print();},500);</script></body></html>`;
    const iframe = document.createElement('iframe'); iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe); const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) { iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close(); }
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
  };

  // ✏️ FUNCIONES PARA EDITAR PROYECTO
  const startEditingProject = () => {
    setEditProjectForm({
      name: selectedProject?.name || '',
      client_name: selectedProject?.client_name || '', // 🟢 CORRECCIÓN: leemos client_name
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
          client_name: editProjectForm.client_name, // 🟢 CORRECCIÓN: enviamos client_name
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
// 🏁 FUNCIÓN: GENERAR REPORTE MAESTRO Y SUBIRLO A SUPABASE (Versión Web Optimizada)
const generarReporteMaestroPDF = async (montoTotal: number): Promise<string | null> => {
  try {
    const projectName = selectedProject?.name || 'Obra sin nombre';
    const fechaCierre = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    const doc = new jsPDF();

    // Diseño del PDF
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
    doc.text(formatCurrency(montoTotal), 14, y); // Pasamos el monto por parámetro seguro
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

    // 🟢 CORRECCIÓN DEL BLOB PARA NAVEGADOR
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    
    const fileName = `${selectedProject?.id}_${Date.now()}.pdf`;
    const filePath = `actas_cierre/${fileName}`;

    // Subida al Storage
    const { error: uploadError } = await supabase.storage
      .from('reportes_cierre')
      .upload(filePath, pdfBlob, { 
        cacheControl: '3600',
        upsert: true 
      });

    if (uploadError) {
      throw new Error(`Error en Storage: ${uploadError.message}`);
    }

    // Obtener y retornar la URL pública
    const { data: publicUrlData } = supabase.storage.from('reportes_cierre').getPublicUrl(filePath);
    return publicUrlData.publicUrl;

  } catch (err: any) {
    console.error('Error dentro de generarReporteMaestroPDF:', err);
    alert('Falló la creación del PDF: ' + err.message);
    return null;
  }
};

/// 🏁 FUNCIÓN: EJECUTAR EL CIERRE
const handleFinalizarObra = async () => {
  if (!selectedProject) return;
  setFinishingProject(true);

  try {
    // 🟢 Enviamos el totalConsolidated explícitamente para evitar desfases de scope
    const pdfUrl = await generarReporteMaestroPDF(totalConsolidated);
    
    if (!pdfUrl) {
      throw new Error('El Storage de Supabase no devolvió una URL válida.');
    }

    // Actualizar la tabla si el PDF fue exitoso
    const { error } = await supabase
      .from('projects')
      .update({
        status: 'finalizada',
        end_date: new Date().toISOString().split('T')[0],
        reporte_cierre_url: pdfUrl
      })
      .eq('id', selectedProject.id);

    if (error) throw new Error(`Error actualizando tabla: ${error.message}`);

    // Actualizar la lista en pantalla
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
        
        {/* --- CABECERA ESTÁTICA --- */}
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

        {/* --- 🟢 ZONA SCROLLABLE (LISTA DE OBRAS) --- */}
        {/* flex-1 toma el espacio sobrante, overflow-y-auto permite el scroll */}
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

        {/* --- PIE ESTÁTICO (BOTONES INFERIORES) --- */}
        {/* shrink-0 evita que esta sección se aplaste cuando hay muchas obras */}
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
        
        {/* 🟢 HEADER PRINCIPAL CON BOTÓN DE SINCRONIZACIÓN */}
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
                title="Forzar descarga de datos desde campo"
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
              
              {/* TARJETA DE INFO DEL PROYECTO (CON MODO EDICIÓN) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative transition-all">
                {userRole === 'admin' && !isEditingProject && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setIsFinishModalOpen(true); 
                      }} 
                      className="flex items-center gap-1.5 text-red-500 hover:text-white transition-colors bg-red-50 px-2 py-1.5 rounded-lg hover:bg-red-500 text-xs font-bold cursor-pointer" 
                      title="Finalizar Obra y Mover a Historial"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Cerrar Obra
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.preventDefault(); 
                        startEditingProject(); 
                      }} 
                      className="text-slate-400 hover:text-blue-600 transition-colors bg-slate-50 p-1.5 rounded-lg hover:bg-blue-50 cursor-pointer" 
                      title="Editar detalles de la obra"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                )}

                {isEditingProject ? (
                  <div className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Proyecto / Obra</label><input type="text" value={editProjectForm.name} onChange={(e) => setEditProjectForm({...editProjectForm, name: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      {/* 🟢 CORRECCIÓN DE VISUALIZACIÓN DEL INPUT AQUÍ TAMBIÉN */}
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Cliente de Obra</label><input type="text" value={editProjectForm.client_name} onChange={(e) => setEditProjectForm({...editProjectForm, client_name: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">No. de Contrato</label><input type="text" value={editProjectForm.contract_number} onChange={(e) => setEditProjectForm({...editProjectForm, contract_number: e.target.value})} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium" /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Inicio</label><input type="date" value={editProjectForm.start_date} onChange={(e) => setEditProjectForm({...editProjectForm, start_date: e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-[11px]" /></div>
                        <div><label className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Fin</label><input type="date" value={editProjectForm.end_date} onChange={(e) => setEditProjectForm({...editProjectForm, end_date: e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-slate-900 focus:outline-none focus:border-blue-500 font-medium text-[11px]" /></div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                      <button onClick={() => setIsEditingProject(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                      <button onClick={handleUpdateProject} disabled={updatingProject} className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
                        {updatingProject ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pr-10">
                    <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Proyecto / Obra:</span> <span className="font-bold text-slate-800 text-base block">{selectedProject.name}</span></div>
                    {/* 🟢 CORRECCIÓN DE VISUALIZACIÓN TEXTO */}
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
                  
                  {/* 📊 PESTAÑA FUSIONADA: ANÁLISIS SEMANAL */}
                  {!loadingMetrics && activeTab === 'analisis' && (
                    <div className="flex flex-col space-y-8 p-8">
                      
                      {/* HEADER Y EXPORTS */}
                      <div className="flex justify-between items-center bg-white">
                        <p className="text-sm text-slate-500">Monitoreo analítico global consolidado y resumen semanal.</p>
                        <div className="flex gap-2">
                          <button onClick={handleExportGastosCSV} disabled={gastosGeneralesRecords.length === 0} className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold px-4 py-2 rounded-xl transition-colors border border-slate-200 disabled:opacity-50 shadow-sm">Exportar Excel</button>
                          <button onClick={handleExportGastosPDF} disabled={totalConsolidated === 0} className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-3a2 2 0 00-2-2H5a2 2 0 00-2 2v3a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Imprimir PDF</button>
                        </div>
                      </div>

                      {/* SECCIÓN 1: DONA Y TOTALES */}
                      {totalConsolidated > 0 ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center p-8">
                          <div>
                            <div className="mb-6">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Costo Directo Total Acumulado</span>
                              <span className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalConsolidated)}</span>
                            </div>

                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15 V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                              Distribución por Macro Rubro
                            </h3>
                            
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
                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm text-slate-400 font-medium">No hay suficientes datos registrados para la gráfica.</div>
                      )}

                      {/* SECCIÓN 2: TABLA RESUMEN SEMANAL */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                          <h3 className="text-sm font-bold text-slate-800">Corte Financiero Semanal (Lunes a Domingo)</h3>
                        </div>
                        <table className="w-full text-left text-sm">
                          <thead className="bg-white border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="px-6 py-4">Semana Laboral</th>
                              <th className="px-6 py-4 text-right">Mano de Obra (Nómina)</th>
                              <th className="px-6 py-4 text-right">Destajos / Materiales</th>
                              <th className="px-6 py-4 text-right">Caja Chica y Oficina</th>
                              <th className="px-6 py-4 text-right text-slate-900 font-bold">Salida Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {weeklySummaryData.length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No hay registros financieros para agrupar.</td></tr>
                            ) : (
                              weeklySummaryData.map((week, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="px-6 py-4 font-medium text-slate-900">Semana del {week.startString}</td>
                                  <td className="px-6 py-4 text-right text-blue-600 font-medium">{formatCurrency(week.nomina)}</td>
                                  <td className="px-6 py-4 text-right text-amber-600 font-medium">{formatCurrency(week.destajos)}</td>
                                  <td className="px-6 py-4 text-right text-slate-600 font-medium">{formatCurrency(week.gastos + week.caja)}</td>
                                  <td className="px-6 py-4 text-right font-bold text-red-600">-{formatCurrency(week.total)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}

                  {/* 💰 PESTAÑA CON SUBMENÚ DE GASTOS */}
                  {!loadingMetrics && activeTab === 'caja' && (
                    <div className="flex flex-col">
                      
                      {/* 📑 SUBMENÚ TIPO PÍLDORAS */}
                      <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex gap-3 overflow-x-auto items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Categoría:</span>
                        
                        <button 
                          onClick={() => setExpenseSubTab('generales')} 
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${expenseSubTab === 'generales' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                        >
                          🧱 Materiales y Generales
                        </button>
                        
                        <button 
                          onClick={() => setExpenseSubTab('caja_chica')} 
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${expenseSubTab === 'caja_chica' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                        >
                          💵 Caja Chica
                        </button>
                        
                        <button 
                          onClick={() => setExpenseSubTab('maquinaria')} 
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${expenseSubTab === 'maquinaria' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                        >
                          🚜 Maquinaria y Equipo
                        </button>

                        <button 
                          onClick={() => setExpenseSubTab('destajos')} 
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${expenseSubTab === 'destajos' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                        >
                          🛠️ Destajos e Inventario
                        </button>
                      </div>

                      {/* CONTENIDO 1: GASTOS GENERALES Y MATERIALES */}
                      {expenseSubTab === 'generales' && (
                        <>
                          <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <p className="text-sm text-slate-500">Registro detallado de salidas, compras y gastos directos.</p>
                            <div className="flex gap-2 items-center">
                              {(userRole === 'admin' || userRole === 'oficina') && (
                                <button onClick={() => setIsExpenseModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                  Registrar Gasto
                                </button>
                              )}
                            </div>
                          </div>

                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Concepto Detallado</th><th className="px-6 py-4">Clasificación</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4 text-right">Cant.</th><th className="px-6 py-4 text-right">P. Unitario</th><th className="px-6 py-4 text-right">Importe</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {gastosGeneralesRecords.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Aún no hay gastos registrados.</td></tr>
                              ) : (
                                gastosGeneralesRecords.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50/80">
                                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatDate(r.fecha).split(',')[0]}</td>
                                    <td className="px-6 py-4 text-slate-900 font-medium">{r.concepto}</td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase"><span className="bg-slate-100 px-2 py-1 rounded">{r.tipo || 'Gastos Generales'}</span></td>
                                    <td className="px-6 py-4 text-slate-700">{r.proveedor || 'S/P'}</td>
                                    <td className="px-6 py-4 text-right text-slate-600">{r.cantidad ? `${r.cantidad} ${r.unidad || ''}` : '-'}</td>
                                    <td className="px-6 py-4 text-right text-slate-600">{r.precio_unitario ? formatCurrency(r.precio_unitario) : '-'}</td>
                                    <td className="px-6 py-4 text-red-600 font-bold text-right">-{formatCurrency(r.monto)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* CONTENIDO 2: CAJA CHICA */}
                      {expenseSubTab === 'caja_chica' && (
                        <>
                          <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <p className="text-sm text-slate-500">Historial de tickets y control de viáticos generados desde campo.</p>
                          </div>
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Encargado / Responsable</th><th className="px-6 py-4">Concepto</th><th className="px-6 py-4 text-right">Monto Declarado</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {cajaChicaRecords.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No hay registros de caja chica.</td></tr>
                              ) : (
                                cajaChicaRecords.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50/80">
                                    <td className="px-6 py-4 text-slate-600">{formatDate(r.fecha).split(',')[0]}</td>
                                    <td className="px-6 py-4 text-slate-900 font-medium">{r.encargado || 'N/A'}</td>
                                    <td className="px-6 py-4 text-slate-600">{r.concepto || r.justificacion || 'Gastos menores'}</td>
                                    <td className="px-6 py-4 text-red-600 font-bold text-right">-{formatCurrency(r.monto)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </>
                      )}

                      {/* CONTENIDO 3: MAQUINARIA */}
                      {expenseSubTab === 'maquinaria' && (
                        <>
                          <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <p className="text-sm text-slate-500">Bitácora de rentas, anticipos y horas de uso de equipos.</p>
                          </div>
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Equipo / Máquina</th><th className="px-6 py-4">Categoría</th><th className="px-6 py-4">Proveedor</th><th className="px-6 py-4 text-right">Importe</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {maquinariaRecords.filter(r => r.categoria !== 'config').length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Aún no hay horas reportadas ni anticipos.</td></tr>
                              ) : (
                                maquinariaRecords.filter(r => r.categoria !== 'config').map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50/80">
                                    <td className="px-6 py-4 text-slate-600">{formatDate(r.fecha).split(',')[0]}</td>
                                    <td className="px-6 py-4 text-slate-900 font-medium">
                                      {r.equipo}
                                      {r.asistencia_dias && <span className="block text-xs text-slate-500 mt-1">Uso: {r.asistencia_dias} hrs</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${r.categoria === 'anticipo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {r.categoria === 'anticipo' ? 'Anticipo / Abono' : 'Costo por Uso'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700">{r.proveedor || 'S/P'}</td>
                                    <td className={`px-6 py-4 font-bold text-right ${r.categoria === 'anticipo' ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {r.categoria === 'anticipo' ? '+' : '-'}{formatCurrency(r.monto)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </>
                      )}
                      {/* CONTENIDO 4: DESTAJOS E INVENTARIO */}
                      {expenseSubTab === 'destajos' && (
                        <>
                          <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <p className="text-sm text-slate-500">Registro de destajos, materiales en almacén y avances de obra.</p>
                          </div>
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Concepto / Material</th>
                                <th className="px-6 py-4 text-right">Cantidad</th>
                                <th className="px-6 py-4 text-right">P. Unitario</th>
                                <th className="px-6 py-4 text-right">Total Acumulado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {inventoryRecords.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Aún no hay destajos o inventario registrado.</td></tr>
                              ) : (
                                inventoryRecords.map((r, idx) => {
                                  const cantidad = Number(r.cantidad || r.quantity || r.stock || 0);
                                  const precioUnitario = Number(r.unit_price || r.precio || 0);
                                  return (
                                    <tr key={r.id || idx} className="hover:bg-slate-50/80">
                                      <td className="px-6 py-4 text-slate-600">{formatDate(r.created_at || r.fecha).split(',')[0]}</td>
                                      <td className="px-6 py-4 text-slate-900 font-medium">{r.item_name || r.concepto || r.nombre || 'Sin nombre'}</td>
                                      <td className="px-6 py-4 text-slate-600 text-right">{cantidad}</td>
                                      <td className="px-6 py-4 text-slate-600 text-right">{formatCurrency(precioUnitario)}</td>
                                      <td className="px-6 py-4 font-bold text-red-600 text-right">-{formatCurrency(cantidad * precioUnitario)}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                    
                  )}

                  {/* 👷‍♂️ PESTAÑA DE PERSONAL Y NÓMINAS */}
                  {!loadingMetrics && activeTab === 'personal' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 bg-slate-50/40">
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">Plantilla Activa en Obra</h3>
                            <p className="text-xs text-slate-500">Directorio oficial de fuerza de trabajo asignada a este proyecto.</p>
                          </div>
                          
                          <div className="flex gap-2 items-center">
                            <button onClick={handleExportWorkersCSV} disabled={workersRecords.length === 0} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">Excel</button>
                            <button onClick={handleExportWorkersPDF} disabled={workersRecords.length === 0} className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">Imprimir Lista</button>
                            
                            {userRole === 'admin' && (
                              <button onClick={() => setIsWorkerModalOpen(true)} className="ml-2 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-blue-700 shadow-sm transition-colors">
                                + Contratar
                              </button>
                            )}
                          </div>
                        </div>

                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-3">Nombre Completo</th>
                              <th className="px-6 py-3">Categoría / Puesto</th>
                              <th className="px-6 py-3 text-right">Sueldo Base Semanal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {workersRecords.length === 0 ? (
                              <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-xs">No hay personal registrado en esta obra.</td></tr>
                            ) : (
                              workersRecords.map(w => (
                                <tr key={w.id} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-3.5 text-slate-900 font-medium">{w.name}</td>
                                  <td className="px-6 py-3.5"><span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded uppercase">{w.role}</span></td>
                                  <td className="px-6 py-3.5 text-slate-900 font-bold text-right">{formatCurrency(w.weekly_salary || 0)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 bg-white">
                          <h3 className="text-sm font-bold text-slate-800">Auditoría de Listas de Raya</h3>
                          <p className="text-xs text-slate-500">Historial de nóminas y control de asistencia diario.</p>
                        </div>
                        
                        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                          {payrollRecords.length === 0 ? (
                            <div className="px-6 py-8 text-center text-slate-400 text-xs">Aún no hay reportes de nómina firmados en campo.</div>
                          ) : (
                            payrollRecords.map((p, idx) => {
                              const trabajadorObj = workersRecords.find(w => w.id === p.worker_id);
                              const nombreTrabajador = p.worker_name || p.nombre || trabajadorObj?.name || 'Trabajador no activo / Eliminado';
                              const residenteObj = residents.find(r => r.id === p.residente_id);
                              const nombreResidente = residenteObj?.full_name || 'Prueba anterior / No especificado';

                              return (
                                <div key={p.id || idx} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start text-xs">
                                  <div className="flex-1 mr-2">
                                    <span className="font-bold text-slate-800 block text-sm">{formatCurrency(p.finally_salary || p.final_salary || 0)}</span>
                                    <span className="text-slate-500 block mt-0.5">Fecha de Raya: {formatDate(p.created_at || p.fecha).split(',')[0]}</span>
                                    {p.week_number && <span className="text-blue-600 font-semibold block mt-0.5">Semana No. {p.week_number}</span>}
                                    
                                    <div className="mt-2 mb-2">
                                      {renderAttendanceDots(p.attendance)}
                                      {(p.reason || p.motivo) && (
                                        <div className="mt-1.5 bg-red-50 p-1.5 rounded border border-red-100">
                                          <span className="text-red-700 font-bold text-[9px] block">Motivo Descuento:</span>
                                          <span className="text-red-600 text-[10px] italic">{p.reason || p.motivo}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="mt-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 space-y-1">
                                      <span className="text-slate-700 block text-[11px]">👷‍♂️ <strong>Recibe:</strong> {nombreTrabajador}</span>
                                      <span className="text-slate-600 block text-[11px]">👤 <strong>Reporta:</strong> {nombreResidente}</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-lg border border-emerald-100 block uppercase tracking-wider text-[10px]">
                                      Reportado
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📖 TABLA DE BITÁCORA */}
                  {!loadingMetrics && activeTab === 'bitacora' && (
                    <div className="flex flex-col">
                      <div className="print-hide px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                        <p className="text-sm text-slate-500">Historial operativo de la obra reportado desde campo.</p>
                        <div className="flex gap-2">
                          <button onClick={handleExportBitacoraCSV} disabled={bitacoraRecords.length === 0} className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold px-4 py-2 rounded-xl transition-colors border border-slate-200 disabled:opacity-50 shadow-sm">Exportar Excel</button>
                          <button onClick={handleExportBitacoraPDF} disabled={bitacoraRecords.length === 0} className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-3a2 2 0 00-2-2H5a2 2 0 00-2 2v3a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Imprimir PDF</button>
                        </div>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold"><tr><th className="px-8 py-4 w-48">Fecha y Hora</th><th className="px-8 py-4 w-40">Categoría</th><th className="px-8 py-4">Descripción de Actividad</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {bitacoraRecords.length === 0 ? (<tr><td colSpan={3} className="px-8 py-8 text-center text-slate-400">Aún no hay reportes en la bitácora.</td></tr>) : (
                            bitacoraRecords.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50/80">
                                <td className="px-8 py-4 text-slate-500 font-medium whitespace-nowrap align-top">{formatDate(r.created_at)}</td>
                                <td className="px-8 py-4 align-top"><span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md border border-blue-100">{r.category || 'General'}</span></td>
                                <td className="px-8 py-4 text-slate-800 leading-relaxed align-top">
                                  <p className="mb-2">{r.description}</p>
                                  {parsePhotos(r.photo_url).length > 0 && (
                                    <div className="flex gap-2 flex-wrap mt-2">
                                      {parsePhotos(r.photo_url).map((url: string, index: number) => (
                                        <a key={index} href={url} target="_blank" rel="noreferrer" title="Ver imagen"><img src={url} alt="Evidencia" className="h-20 w-32 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-105" /></a>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 📐 PESTAÑA DE DOCUMENTOS */}
                  {!loadingMetrics && activeTab === 'planos' && (
                    <div className="flex flex-col">
                      <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                        <p className="text-sm text-slate-500">Gestor documental de planos, permisos y archivos de ingeniería.</p>
                        {userRole === 'admin' && (
                          <button onClick={() => setIsPlanosModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Subir Documento
                          </button>
                        )}
                      </div>

                      {/* 📑 SUBMENÚ TIPO PÍLDORAS PARA FILTRAR */}
                      <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex gap-3 overflow-x-auto items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filtro:</span>
                        {['Todos', 'Planos', 'Permisos', 'Contratos', 'Otros'].map(cat => (
                          <button 
                            key={cat}
                            onClick={() => setPlanoFilter(cat as any)} 
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${planoFilter === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr><th className="px-8 py-4">Nombre del Documento</th><th className="px-8 py-4 w-32">Categoría</th><th className="px-8 py-4 w-32">Versión</th><th className="px-8 py-4 w-48">Fecha de Subida</th><th className="px-8 py-4 w-32 text-center">Acción</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {planosRecords.filter(p => planoFilter === 'Todos' || p.categoria === planoFilter).length === 0 ? (
                            <tr><td colSpan={5} className="px-8 py-8 text-center text-slate-400">No hay documentos en esta categoría.</td></tr>
                          ) : (
                            planosRecords.filter(p => planoFilter === 'Todos' || p.categoria === planoFilter).map(p => (
                              <tr key={p.id} className="hover:bg-slate-50/80">
                                <td className="px-8 py-4 text-slate-900 font-medium">{p.name}</td>
                                <td className="px-8 py-4">
                                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wider">{p.categoria || 'Planos'}</span>
                                </td>
                                <td className="px-8 py-4"><span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-indigo-100 uppercase tracking-wider">{p.version}</span></td>
                                <td className="px-8 py-4 text-slate-500">{formatDate(p.created_at).split(',')[0]}</td>
                                <td className="px-8 py-4 text-center">
                                  <a href={p.file_url} target="_blank" rel="noreferrer" className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">Ver Archivo</a>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              </div>

            </div>
          ) : (
            <div className="text-center mt-20 text-slate-500">Selecciona una obra en el menú.</div>
          )}
        </main>
      </div>

      {/* 🧾 MODAL DE GASTOS */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Registrar Salida / Gasto Directo</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleSaveGasto} className="p-6 space-y-4">
              {expenseFormError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{expenseFormError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Concepto Detallado</label><input type="text" required placeholder="Ej. Cemento Tolteca..." value={conceptoGasto} onChange={(e) => setConceptoGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Proveedor</label><input type="text" placeholder="Ej. Materiales El Fuerte" value={proveedorGasto} onChange={(e) => setProveedorGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Cantidad</label><input type="number" step="any" placeholder="0" value={cantidadGasto} onChange={(e) => setCantidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Unidad</label><input type="text" placeholder="Ej. TON" value={unidadGasto} onChange={(e) => setUnidadGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Precio Unitario</label><input type="number" step="0.01" placeholder="0.00" value={precioUnitarioGasto} onChange={(e) => setPrecioUnitarioGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Clasificación Financiera</label>
                  <select value={tipoGasto} onChange={(e) => setTipoGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 bg-white font-medium">
                    <option value="Destajos y Materiales">Destajos y Materiales</option>
                    <option value="Mano de Obra">Mano de Obra</option>
                    <option value="Caja Chica">Caja Chica</option>
                    <option value="Gastos Generales">Gastos Generales</option>
                  </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Fecha de Registro</label><input type="date" required value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mt-2">
                <div className="flex justify-between items-center"><span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Importe Total Calculado:</span><span className="text-xl font-black text-blue-900">{montoGasto ? formatCurrency(parseFloat(montoGasto)) : '$0.00'}</span></div>
              </div>
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-6"><button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button><button type="submit" disabled={loadingExpenseForm || !montoGasto} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl disabled:opacity-50 shadow-sm">{loadingExpenseForm ? 'Guardando...' : 'Confirmar Gasto'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* 👷‍♂️ MODAL DE ALTA DE TRABAJADOR */}
      {isWorkerModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Dar de Alta Trabajador</h3>
              <button onClick={() => setIsWorkerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleCreateWorker} className="p-6 space-y-4">
              {workerFormError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{workerFormError}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input type="text" required placeholder="Ej. Juan Pérez López" value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Categoría / Puesto</label>
                <select value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium bg-white focus:outline-none focus:border-blue-500">
                  <option value="Peón">Peón</option>
                  <option value="Albañil">Albañil</option>
                  <option value="Cabo de Oficios">Cabo de Oficios</option>
                  <option value="Fierrero">Fierrero</option>
                  <option value="Carpintero">Fierrero/Carpintero</option>
                  <option value="Maestro de Obra">Maestro de Obra</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Teléfono de Contacto</label>
                <input type="tel" maxLength={10} placeholder="Ej. 2221234567" value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsWorkerModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" disabled={loadingWorkerForm} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50">{loadingWorkerForm ? 'Guardando...' : 'Contratar Personal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📐 MODAL DE SUBIR PLANO */}
      {isPlanosModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Subir Plano / Archivo</h3>
              <button onClick={() => setIsPlanosModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <form onSubmit={handleUploadPlano} className="p-6 space-y-4">
              {planoError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl">{planoError}</div>}
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre del Plano</label>
                <input type="text" required placeholder="Ej. Arquitectónico Planta Baja" value={planoName} onChange={(e) => setPlanoName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Versión</label>
                <input type="text" required placeholder="Ej. v1.2" value={planoVersion} onChange={(e) => setPlanoVersion(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Archivo (PDF, JPG, PNG)</label>
                <input type="file" required accept=".pdf,image/*" onChange={(e) => setPlanoFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsPlanosModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button>
                <button type="submit" disabled={loadingPlano || !planoFile} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50">{loadingPlano ? 'Subiendo...' : 'Subir Archivo'}</button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Categoría</label>
                <select value={planoCategory} onChange={(e) => setPlanoCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-500 bg-white">
                  <option value="Planos">Planos Arquitectónicos / Ingeniería</option>
                  <option value="Permisos">Permisos y Licencias</option>
                  <option value="Contratos">Contratos y Presupuestos</option>
                  <option value="Otros">Otros Documentos</option>
                </select>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NUEVA OBRA */}
      {isProjectModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Alta de Nueva Obra</h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              {projectFormError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">{projectFormError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre de la Obra</label><input type="text" required placeholder="Ej. Torre Alpha, Bodega Norte" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                {/* 🟢 CORRECCIÓN INPUT DE CREACIÓN */}
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nombre del Cliente</label><input type="text" required placeholder="Ej. Constructora Rocal S.A." value={newProjectCliente} onChange={(e) => setNewProjectCliente(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">No. de Contrato</label><input type="text" required placeholder="Ej. CTR-2026-009" value={newProjectNumContrato} onChange={(e) => setNewProjectNumContrato(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                <div><label className="block text-xs font-bold text-slate-600 tracking-wider mb-1 uppercase text-slate-600">Asignar Residente</label><select value={selectedResidentId} onChange={(e) => setSelectedResidentId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 bg-white font-medium"><option value="">-- Seleccionar Residente --</option>{residents.map((res) => (<option key={res.id} value={res.id}>{res.full_name}</option>))}</select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Fecha de Inicio</label><input type="date" value={newProjectFechaInicio} onChange={(e) => setNewProjectFechaInicio(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
                <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Fecha de Término</label><input type="date" value={newProjectFechaFin} onChange={(e) => setNewProjectFechaFin(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-medium" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6"><button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl">Cancelar</button><button type="submit" disabled={loadingProjectForm} className="bg-slate-900 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-slate-800 shadow-sm disabled:opacity-50">{loadingProjectForm ? 'Creando...' : 'Confirmar e Instalar Obra'}</button></div>
            </form>
          </div>
        </div>
      )}
      {/* 🏁 MODAL DE CONFIRMACIÓN DE CIERRE DE OBRA */}
      {isFinishModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-red-700 text-center">¿Finalizar esta Obra?</h3>
            </div>
            
            <div className="p-6 text-center text-slate-600 text-sm">
              <p className="mb-4">
                Estás a punto de dar por concluido el proyecto <strong>"{selectedProject?.name}"</strong>.
              </p>
              <ul className="text-left bg-slate-50 p-4 rounded-lg space-y-2 text-xs mb-4 border border-slate-100">
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Se generará un Acta de Cierre en PDF.</li>
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> Desaparecerá del panel de Obras Activas.</li>
                <li className="flex items-center gap-2"><svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg> Su información se respaldará en el "Historial".</li>
              </ul>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button"
                onClick={(e) => { e.preventDefault(); setIsFinishModalOpen(false); }} 
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                disabled={finishingProject}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={(e) => { 
                  e.preventDefault(); 
                  handleFinalizarObra(); 
                }} 
                disabled={finishingProject} 
                className="bg-red-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {finishingProject ? 'Procesando...' : 'Sí, Finalizar Obra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}