'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext'; 
import { supabase } from '../../lib/supabase'; // Ajusta la ruta a tu cliente de Supabase
export const dynamic = 'force-dynamic';

export default function PerfilUsuarioWeb() {
  const router = useRouter();
  const { profile, isLoadingUser } = useUser(); 

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // 🔑 Estado para la eliminación
  const [formData, setFormData] = useState({
    full_name: '',
    telefono: '',
    edad: '',
    direccion: ''
  });

  // Cargar la información del perfil al formulario cuando los datos estén listos
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        telefono: profile.telefono || '',
        edad: profile.edad ? String(profile.edad) : '',
        direccion: profile.direccion || ''
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    if (!profile?.id) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles') 
        .update({
          full_name: formData.full_name,
          telefono: formData.telefono,
          edad: formData.edad ? parseInt(formData.edad, 10) : null,
          direccion: formData.direccion
        })
        .eq('id', profile.id);

      if (error) throw error;

      router.refresh(); 
      setIsEditing(false);
    } catch (err: any) {
      alert('Error al actualizar el perfil: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 🔑 FUNCIÓN MAESTRA DE ELIMINACIÓN REAL
  const handleEliminarCuenta = async () => {
    if (!profile?.id) return;

    const primeraConfirmacion = window.confirm(
      '¿Estás completamente seguro de que deseas eliminar este usuario del sistema? Esta acción borrará permanentemente sus accesos y su expediente corporativo.'
    );

    if (!primeraConfirmacion) return;

    const segundaConfirmacion = window.confirm(
      '⚠️ ADVERTENCIA CRÍTICA: Al confirmar este paso, el usuario perderá el acceso inmediato y no se podrá recuperar la información. ¿Continuar?'
    );

    if (!segundaConfirmacion) return;

    setIsDeleting(true);

    try {
      // Llamamos a la función RPC que limpia auth.users y profiles simultáneamente
      const { error } = await supabase.rpc('eliminar_usuario_completo', {
        p_user_id: profile.id
      });

      if (error) throw error;

      alert('El usuario ha sido removido exitosamente del sistema.');
      
      // Si el usuario se está borrando a sí mismo, cerramos sesión y mandamos a login
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err: any) {
      alert('Error al eliminar la cuenta: ' + err.message);
      setIsDeleting(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 font-medium animate-pulse">Cargando expediente personal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto w-full">
        
        {/* Botón para regresar al Dashboard */}
        <button onClick={() => router.back()} className="mb-8 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver al Tablero
        </button>

        {/* Encabezado del Perfil */}
        <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Mi Perfil Profesional</h1>
            <p className="text-slate-500 mt-1">Expediente digital verificado por Constructora ROCAL</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            
            {/* 🛑 BOTÓN DE ELIMINAR CUENTA COMPLETA */}
            {!isEditing && (
              <button
                onClick={handleEliminarCuenta}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isDeleting ? 'Eliminando...' : '🗑️ Eliminar Cuenta'}
              </button>
            )}

            <button
              onClick={() => {
                if (isEditing) handleSaveChanges();
                else setIsEditing(true);
              }}
              disabled={isSaving || isDeleting}
              className={`px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer ${
                isEditing 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isSaving ? 'Guardando...' : isEditing ? '💾 Guardar Cambios' : '✏️ Editar Perfil'}
            </button>
            
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Cancelar
              </button>
            )}
            
            <div className="bg-blue-100 text-blue-800 px-5 py-2 rounded-xl text-sm font-black uppercase tracking-widest border border-blue-200 shadow-sm">
              {profile?.role || 'Usuario'}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Foto e Info Básica */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-32 h-32 bg-slate-100 rounded-full mx-auto mb-5 overflow-hidden border-4 border-white shadow-md flex items-center justify-center">
                {profile?.foto_ine_url ? (
                  <img src={profile.foto_ine_url} className="w-full h-full object-cover" alt="Foto de Perfil" />
                ) : (
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{isEditing ? formData.full_name || 'Escribiendo...' : profile?.full_name || 'Sin nombre'}</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">{profile?.carrera_especialidad || 'Especialidad no definida'}</p>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-md">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Estatus de Cuenta</h3>
              <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="font-bold text-sm">Usuario Verificado</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Detalles del Expediente */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                Información de Contacto y Legal
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <DetailEditable 
                  label="Nombre Completo" 
                  name="full_name"
                  value={formData.full_name} 
                  isEditing={isEditing} 
                  onChange={handleChange} 
                />
                <DetailEditable 
                  label="Teléfono / Celular" 
                  name="telefono"
                  value={formData.telefono} 
                  isEditing={isEditing} 
                  onChange={handleChange} 
                />
                <DetailEditable 
                  label="Edad Registrada" 
                  name="edad"
                  value={formData.edad} 
                  isEditing={isEditing} 
                  onChange={handleChange} 
                  type="number"
                />
                <DetailEditable 
                  label="Dirección Particular" 
                  name="direccion"
                  value={formData.direccion} 
                  isEditing={isEditing} 
                  onChange={handleChange} 
                  isFullWidth
                />
                <div className="sm:col-span-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 opacity-75">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Correo de Acceso (No editable)</p>
                    <p className="text-slate-800 font-bold text-sm">{profile?.email || 'No disponible'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Identificación Oficial (INE)
                </h3>
                {profile?.foto_ine_url ? (
                  <div className="relative group overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-50">
                    <img 
                      src={profile.foto_ine_url} 
                      className="w-full h-auto object-contain max-h-[400px] transition-transform duration-300 group-hover:scale-[1.02]" 
                      alt="Identificación Oficial" 
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400">
                    <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="font-medium text-sm">Archivo INE no adjuntado a este perfil.</span>
                    <span className="text-xs mt-1 text-slate-400">Contacta a Recursos Humanos si necesitas actualizarlo.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

interface DetailEditableProps {
  label: string;
  name: string;
  value: string;
  isEditing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  isFullWidth?: boolean;
}

// Subcomponente dinámico
function DetailEditable({ label, name, value, isEditing, onChange, type = 'text', isFullWidth = false }: DetailEditableProps) {
  return (
    <div className={`bg-slate-50 p-4 rounded-xl border border-slate-100 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      {isEditing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-sm"
        />
      ) : (
        <p className="text-slate-800 font-bold text-sm">
          {type === 'number' && value ? `${value} años` : value || 'No registrado'}
        </p>
      )}
    </div>
  );
}