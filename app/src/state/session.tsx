import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/data';
import type { Usuario } from '@/shared';

type Modo = 'cliente' | 'negocio';

interface Sesion {
  cargando: boolean;
  usuario: Usuario | null;
  /** Qué app está viendo: la del cliente o la del negocio (si tiene uno). */
  modo: Modo;
  setModo: (m: Modo) => void;
  setUsuario: (u: Usuario | null) => void;
  salir: () => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<Modo>('cliente');

  useEffect(() => {
    api
      .usuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const salir = useCallback(async () => {
    await api.cerrarSesion();
    setUsuario(null);
    setModo('cliente');
  }, []);

  const value = useMemo(() => ({ cargando, usuario, modo, setModo, setUsuario, salir }), [cargando, usuario, modo, salir]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession fuera de SessionProvider');
  return s;
}
