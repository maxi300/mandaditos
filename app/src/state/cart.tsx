import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { LineaCarrito, Producto } from '@/shared';

/**
 * Carrito de UN SOLO negocio. Si el cliente agrega de otro negocio,
 * la pantalla le pregunta antes (ver `pideCambiarNegocio`).
 */
interface Carrito {
  negocioId: string | null;
  lineas: LineaCarrito[];
  /** Cantidad (unidad) o centavos (dinero) de un producto SIN opciones. */
  cantidadSimple: (productoId: string) => number;
  /** Suma uno (unidad) o un paso (dinero). Devuelve false si el carrito es de otro negocio. */
  sumar: (p: Producto) => boolean;
  restar: (p: Producto) => void;
  /** Agrega una línea con opciones (desde el detalle del producto). */
  agregarLinea: (p: Producto, linea: Omit<LineaCarrito, 'lineaId' | 'productoId'>) => boolean;
  cambiarLinea: (lineaId: string, cambio: Partial<LineaCarrito>) => void;
  quitarLinea: (lineaId: string) => void;
  vaciar: () => void;
  pideCambiarNegocio: (negocioId: string) => boolean;
  /** Unidades en el carrito (una línea por dinero cuenta como 1). */
  totalItems: number;
}

const Ctx = createContext<Carrito | null>(null);
let seq = 0;
const nuevoId = () => `l${Date.now()}${seq++}`;
const esSimple = (l: LineaCarrito) => !l.opciones || Object.keys(l.opciones).length === 0;

/** Identifica “el mismo pedido”: producto + opciones elegidas + nota + qué hacer si no hay. */
function claveLinea(productoId: string, l: Pick<LineaCarrito, 'opciones' | 'nota' | 'siNoHay'>) {
  const ops = Object.entries(l.opciones ?? {})
    .filter(([, ids]) => ids.length > 0)
    .map(([g, ids]) => `${g}:${[...ids].sort().join(',')}`)
    .sort()
    .join('|');
  return `${productoId}#${ops}#${(l.nota ?? '').trim().toLowerCase()}#${l.siNoHay ?? ''}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);

  const pideCambiarNegocio = useCallback((id: string) => negocioId !== null && negocioId !== id && lineas.length > 0, [negocioId, lineas.length]);

  const cantidadSimple = useCallback(
    (productoId: string) => {
      const l = lineas.find((x) => x.productoId === productoId && esSimple(x));
      return l ? (l.cantidad ?? l.montoCents ?? 0) : 0;
    },
    [lineas],
  );

  const sumar = useCallback(
    (p: Producto) => {
      if (pideCambiarNegocio(p.negocioId)) return false;
      setNegocioId(p.negocioId);
      setLineas((prev) => {
        const i = prev.findIndex((x) => x.productoId === p.id && esSimple(x));
        if (p.venta === 'dinero') {
          const reglas = p.dinero!;
          if (i < 0) return [...prev, { lineaId: nuevoId(), productoId: p.id, montoCents: Math.max(100, reglas.minimoCents) }];
          const next = [...prev];
          next[i] = { ...next[i], montoCents: (next[i].montoCents ?? 0) + Math.max(reglas.pasoCents, 50) };
          return next;
        }
        if (i < 0) return [...prev, { lineaId: nuevoId(), productoId: p.id, cantidad: 1 }];
        const next = [...prev];
        next[i] = { ...next[i], cantidad: Math.min(99, (next[i].cantidad ?? 0) + 1) };
        return next;
      });
      return true;
    },
    [pideCambiarNegocio],
  );

  const restar = useCallback((p: Producto) => {
    setLineas((prev) => {
      const i = prev.findIndex((x) => x.productoId === p.id && esSimple(x));
      if (i < 0) return prev;
      const l = prev[i];
      let next: LineaCarrito | null;
      if (p.venta === 'dinero') {
        const paso = Math.max(p.dinero!.pasoCents, 50);
        const monto = (l.montoCents ?? 0) - paso;
        next = monto < p.dinero!.minimoCents ? null : { ...l, montoCents: monto };
      } else {
        const c = (l.cantidad ?? 0) - 1;
        next = c <= 0 ? null : { ...l, cantidad: c };
      }
      const out = [...prev];
      if (next) out[i] = next;
      else out.splice(i, 1);
      if (out.length === 0) setNegocioId(null);
      return out;
    });
  }, []);

  const agregarLinea = useCallback(
    (p: Producto, linea: Omit<LineaCarrito, 'lineaId' | 'productoId'>) => {
      if (pideCambiarNegocio(p.negocioId)) return false;
      setNegocioId(p.negocioId);
      setLineas((prev) => {
        // Si ya pidió exactamente lo mismo (mismas opciones y nota), sumamos en vez de duplicar la línea.
        if (p.venta === 'unidad') {
          const clave = claveLinea(p.id, linea);
          const i = prev.findIndex((x) => claveLinea(x.productoId, x) === clave);
          if (i >= 0) {
            const next = [...prev];
            next[i] = { ...next[i], cantidad: Math.min(99, (next[i].cantidad ?? 1) + (linea.cantidad ?? 1)) };
            return next;
          }
        }
        return [...prev, { ...linea, lineaId: nuevoId(), productoId: p.id }];
      });
      return true;
    },
    [pideCambiarNegocio],
  );

  const cambiarLinea = useCallback((lineaId: string, cambio: Partial<LineaCarrito>) => {
    setLineas((prev) => prev.map((l) => (l.lineaId === lineaId ? { ...l, ...cambio } : l)));
  }, []);

  const quitarLinea = useCallback((lineaId: string) => {
    setLineas((prev) => {
      const out = prev.filter((l) => l.lineaId !== lineaId);
      if (out.length === 0) setNegocioId(null);
      return out;
    });
  }, []);

  const vaciar = useCallback(() => {
    setLineas([]);
    setNegocioId(null);
  }, []);

  const value = useMemo<Carrito>(
    () => ({
      negocioId,
      lineas,
      cantidadSimple,
      sumar,
      restar,
      agregarLinea,
      cambiarLinea,
      quitarLinea,
      vaciar,
      pideCambiarNegocio,
      totalItems: lineas.reduce((a, l) => a + (l.montoCents != null && l.cantidad == null ? 1 : (l.cantidad ?? 1)), 0),
    }),
    [negocioId, lineas, cantidadSimple, sumar, restar, agregarLinea, cambiarLinea, quitarLinea, vaciar, pideCambiarNegocio],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart fuera de CartProvider');
  return c;
}
