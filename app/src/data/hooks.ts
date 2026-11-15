import { useCallback, useEffect, useState } from 'react';

import type { Negocio, Pedido, Producto } from '@/shared';

import { api } from './index';

/**
 * Carga algo asíncrono y expone { data, error, cargando, recargar }.
 *
 * `cargando` se deriva comparando la clave pedida (deps + nº de recarga) con la última que
 * respondió, así no hay que hacer setState síncrono dentro del effect. Mientras recarga se
 * siguen mostrando los datos anteriores, y una respuesta vieja nunca pisa a una nueva.
 */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [version, setVersion] = useState(0);
  const clave = `${JSON.stringify(deps)}#${version}`;
  const [estado, setEstado] = useState<{ clave?: string; data?: T; error?: string }>({});

  useEffect(() => {
    let vigente = true;
    fn().then(
      (data) => {
        if (vigente) setEstado({ clave, data });
      },
      (e: unknown) => {
        if (vigente) setEstado((prev) => ({ clave, data: prev.data, error: mensajeError(e) }));
      },
    );
    return () => {
      vigente = false;
    };
    // `fn` es una función nueva en cada render; `clave` ya resume sus deps y las recargas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const listo = estado.clave === clave;
  return { data: estado.data, error: listo ? estado.error : undefined, cargando: !listo, recargar };
}

export function useNegocio(id?: string) {
  return useCarga<{ negocio: Negocio | null; productos: Producto[] }>(async () => {
    if (!id) return { negocio: null, productos: [] };
    const [negocio, productos] = await Promise.all([api.negocio(id), api.productos(id)]);
    return { negocio, productos };
  }, [id]);
}

export function usePedido(id?: string) {
  const [pedido, setPedido] = useState<Pedido | null | undefined>(undefined);
  useEffect(() => (id ? api.observarPedido(id, setPedido) : undefined), [id]);
  return pedido;
}

/** Re-renderiza cada `ms` para cuentas regresivas. */
export function useAhora(ms = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}

export function mensajeError(e: unknown) {
  return e instanceof Error ? e.message : 'Algo salió mal. Probá de nuevo.';
}
