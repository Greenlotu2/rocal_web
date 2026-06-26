'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

// 🟢 Aquí definimos el "molde" exacto de lo que trae la base de datos
export interface UserProfile {
  id: string;
  full_name?: string;
  role?: string;
  carrera_especialidad?: string | null;
  edad?: number | null;
  direccion?: string | null;
  telefono?: string | null;
  foto_ine_url?: string | null;
  email?: string;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoadingUser: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Función para descargar los datos de la tabla "profiles"
  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (data) {
        setProfile({ ...data, email });
      }
    } catch (error) {
      console.error("Error cargando el perfil:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email);
  };

  useEffect(() => {
    let mounted = true;

    // 1. Revisar si ya hay una sesión activa al cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, session.user.email).then(() => setIsLoadingUser(false));
        } else {
          setIsLoadingUser(false);
        }
      }
    });

    // 2. Escuchar si el usuario inicia o cierra sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, session.user.email);
        } else {
          setUser(null);
          setProfile(null);
        }
        setIsLoadingUser(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, isLoadingUser, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

// Custom hook para usar el contexto fácilmente en cualquier página
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser debe usarse dentro de un UserProvider');
  }
  return context;
}