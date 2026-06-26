'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useUser } from '../../context/UserContext';

export default function GestionUsuariosWeb() {
  const router = useRouter();
  const { profile, isLoadingUser } = useUser();

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Campos del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('residente');
  const [carrera, setCarrera] = useState('');
  const [edad, setEdad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fileIne, setFileIne] = useState<File | null>(null);
  const [filePerfil, setFilePerfil] = useState<File | null>(null); // 🟢 Estado para foto perfil

  useEffect(() => {
    if (!isLoadingUser) {
      if (profile?.role !== 'admin') {
        router.replace('/');
      } else {
        cargarUsuarios();
      }
    }
  }, [profile, isLoadingUser, router]);

  const cargarUsuarios = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (data) setUsuarios(data);
    setLoading(false);
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) { alert('Llena los campos obligatorios.'); return; }
    setIsSaving(true);

    try {
      let fotoIneUrl = null;
      let fotoPerfilUrl = null; // 🟢 Nueva variable

      // Subir INE
      if (fileIne) {
        const fileExt = fileIne.name.split('.').pop();
        const fileName = `ine_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('identificaciones').upload(`ines/${fileName}`, fileIne);
        if (!uploadError) {
          const { data } = supabase.storage.from('identificaciones').getPublicUrl(`ines/${fileName}`);
          fotoIneUrl = data.publicUrl;
        }
      }

      // 🟢 Subir Foto de Perfil
      if (filePerfil) {
        const fileExt = filePerfil.name.split('.').pop();
        const fileName = `perfil_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('identificaciones').upload(`perfiles/${fileName}`, filePerfil);
        if (!uploadError) {
          const { data } = supabase.storage.from('identificaciones').getPublicUrl(`perfiles/${fileName}`);
          fotoPerfilUrl = data.publicUrl;
        }
      }

      // Llamar al RPC (Asegúrate de haber actualizado el SQL para incluir p_foto_perfil)
      const { error: rpcError } = await supabase.rpc('crear_usuario_desde_admin', {
        p_email: email.trim(),
        p_password: password,
        p_full_name: fullName.trim(),
        p_role: role,
        p_carrera: carrera.trim(),
        p_edad: edad ? parseInt(edad) : null,
        p_direccion: direccion.trim(),
        p_telefono: telefono.trim(),
        p_foto_ine: fotoIneUrl,
        p_foto_perfil: fotoPerfilUrl // 🟢 Nuevo parámetro
      });

      if (rpcError) throw rpcError;

      alert('Usuario creado con éxito en el sistema.');
      limpiarFormulario();
      cargarUsuarios();
    } catch (err: any) {
      alert('Error al crear usuario: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const limpiarFormulario = () => {
    setEmail(''); setPassword(''); setFullName(''); setCarrera('');
    setEdad(''); setDireccion(''); setTelefono(''); setFileIne(null); setFilePerfil(null);
  };

  if (isLoadingUser || profile?.role !== 'admin') {
    return <div className="p-10 text-center text-slate-500 mt-20 font-medium animate-pulse">Verificando accesos de seguridad...</div>;
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Volver al Tablero
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Control de Personal</h1>
        <p className="text-slate-500 mt-1">Alta de personal, control de oficina y administración de expedientes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-slate-900 mb-5">Registrar Nuevo Elemento</h3>
          <form onSubmit={handleCrearUsuario} className="space-y-4 text-sm">
            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nombre Completo *</label><input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Correo *</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Contraseña *</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Rol Operativo</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full border rounded-xl p-2.5 bg-white font-bold text-slate-700"><option value="residente">Residente de Obra</option><option value="oficina">Control de Oficina</option><option value="admin">Administrador</option></select></div>
              <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Teléfono</label><input type="tel" maxLength={10} value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Especialidad</label><input type="text" value={carrera} onChange={e => setCarrera(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Edad</label><input type="number" value={edad} onChange={e => setEdad(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
            </div>
            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Identificación Oficial (INE)</label><input type="file" accept="image/*,.pdf" onChange={e => setFileIne(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Foto de Perfil</label><input type="file" accept="image/*" onChange={e => setFilePerfil(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" /></div>
            <div><label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Dirección Particular</label><input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-blue-500 font-medium" /></div>
            <button type="submit" disabled={isSaving} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 mt-4 shadow-sm flex items-center justify-center gap-2">
              {isSaving ? 'Guardando expediente...' : 'Crear Cuenta en Plataforma'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Directorio Corporativo</h3>
          {loading ? <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium animate-pulse">Cargando directorio...</div> : (
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr><th className="px-5 py-4">Avatar</th><th className="px-5 py-4">Personal / Elemento</th><th className="px-5 py-4">Rol Operativo</th><th className="px-5 py-4">Contacto</th><th className="px-5 py-4 text-center">Expediente INE</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
          {u.foto_perfil_url ? (
            <img 
              src={u.foto_perfil_url} 
              alt={u.full_name} 
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 font-bold text-[10px]">
              {u.full_name?.charAt(0).toUpperCase()}
            </div>
          )}
        </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{u.full_name}</p>
                        <p className="text-[11px] text-slate-500">{u.carrera_especialidad || 'Especialidad N/A'}</p>
                      </td>
                      <td className="px-5 py-4"><span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : u.role === 'oficina' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{u.role}</span></td>
                      <td className="px-5 py-4 text-slate-600 font-medium">{u.telefono || <span className="text-slate-400 italic">No registrado</span>}</td>
                      <td className="px-5 py-4 text-center">{u.foto_ine_url ? <a href={u.foto_ine_url} target="_blank" rel="noreferrer" className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">Ver Imagen</a> : <span className="text-slate-300 text-xs italic">Sin Archivo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}