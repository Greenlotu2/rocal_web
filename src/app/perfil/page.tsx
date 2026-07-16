'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext'; 
import { supabase } from '../../lib/supabase'; // Ajusta la ruta a tu cliente de Supabase
export const dynamic = 'force-dynamic';

export default function PerfilUsuarioWeb() {
  const router = useRouter();
  const { profile, isLoadingUser } = useUser(); 
  const fileInputRef = useRef<HTMLInputElement>(null); // 🟢 Referencia para abrir el selector de archivos

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [isUploading, setIsUploading] = useState(false); // 🟢 Estado de carga de la foto
  const [imageUrl, setImageUrl] = useState<string | null>(null); 
  const [formData, setFormData] = useState({
    full_name: '',
    telefono: '',
    edad: '',
    direccion: ''
  });

  // Cargar la información del perfil y resolver la foto de perfil desde el bucket
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        telefono: profile.telefono || '',
        edad: profile.edad ? String(profile.edad) : '',
        direccion: profile.direccion || ''
      });

      // Obtener la URL de la foto de perfil desde el bucket
      const campoFoto = (profile as any).avatar_url || (profile as any).foto_perfil_url;

      if (campoFoto) {
        if (campoFoto.startsWith('http')) {
          setImageUrl(campoFoto);
        } else {
          const { data } = supabase.storage
            .from('avatars') // ⚠️ Ajusta al nombre exacto de tu bucket si es diferente
            .getPublicUrl(campoFoto);
          
          if (data?.publicUrl) {
            setImageUrl(data.publicUrl);
          }
        }
      }
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 🟢 FUNCIÓN PARA CARGAR Y CAMBIAR LA FOTO DE PERFIL EN EL BUCKET
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      // Creamos un path único usando el ID del usuario y un timestamp para evitar problemas de caché
      const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

      // 1. Subir el archivo físico al storage de Supabase
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. Obtener la nueva URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const nuevaUrl = urlData?.publicUrl;
      if (!nuevaUrl) throw new Error('No se pudo generar la URL pública del archivo.');

      // 3. Determinar qué columna usa tu base de datos y actualizar el registro en la tabla profiles
      const columnasActualizar: any = {};
      if ('avatar_url' in profile) columnasActualizar.avatar_url = filePath;
      if ('foto_perfil_url' in profile) columnasActualizar.foto_perfil_url = filePath;
      
      // Por seguridad si no detecta ninguna en el tipo, intentamos actualizar ambas por si acaso
      if (Object.keys(columnasActualizar).length === 0) {
        columnasActualizar.avatar_url = filePath;
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .update(columnasActualizar)
        .eq('id', profile.id);

      if (dbError) throw dbError;

      // 4. Actualizar el estado visual del componente y refrescar la sesión
      setImageUrl(nuevaUrl);
      alert('¡Fotografía de perfil actualizada con éxito!');
      router.refresh();
    } catch (err: any) {
      alert('Error al subir la imagen: ' + err.message);
    } finally {
      setIsUploading(false);
    }
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

  // FUNCIÓN MAESTRA DE ELIMINACIÓN
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
      const { error } = await supabase.rpc('eliminar_usuario_completo', {
        p_user_id: profile.id
      });

      if (error) throw error;

      alert('El usuario ha sido removido exitosamente del sistema.');
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
            
            {/* BOTÓN DE ELIMINAR CUENTA COMPLETA */}
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
              disabled={isSaving || isDeleting || isUploading}
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
          
          {/* Columna Izquierda: Foto de perfil desde el Bucket con función de Edición */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              
              {/* Contenedor del Avatar con Input oculto y hover interactivo */}
              <div className="relative w-32 h-32 mx-auto mb-5 group rounded-full overflow-hidden border-4 border-white shadow-md bg-slate-100 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} className="w-full h-full object-cover" alt="Foto de Perfil" />
                ) : (
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}

                {/* 🟢 Capa sobrepuesta para cambiar foto al hacer Hover */}
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer duration-200 disabled:opacity-50"
                >
                  {isUploading ? (
                    <span className="animate-pulse">Subiendo...</span>
                  ) : (
                    <>
                      <span>📷</span>
                      <span className="mt-1">Cambiar Foto</span>
                    </>
                  )}
                </button>

                {/* Input HTML oculto controlado por la referencia */}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
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
                <p className="text-xs text-slate-400 italic">
                  * Al actualizar tu fotografía desde el panel web, los cambios se verán reflejados inmediatamente en tu expediente digital sincronizado con el APK móvil de los residentes en campo.
                </p>
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