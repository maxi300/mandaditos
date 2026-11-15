import type {
  Cents,
  ItemPedido,
  LineaCarrito,
  ModoEntrega,
  Negocio,
  Producto,
} from './types';

export class ErrorDePedido extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDePedido';
  }
}

/** Revisa que las opciones elegidas cumplan mínimo/máximo de cada grupo. */
export function validarOpciones(producto: Producto, elegidas: Record<string, string[]> = {}): void {
  for (const grupo of producto.gruposOpciones ?? []) {
    const ids = elegidas[grupo.id] ?? [];
    const validas = ids.filter((id) => grupo.opciones.some((o) => o.id === id));
    if (validas.length !== ids.length) {
      throw new ErrorDePedido('opcion_invalida', `Opción inválida en “${grupo.nombre}”.`);
    }
    if (new Set(ids).size !== ids.length) {
      throw new ErrorDePedido('opcion_repetida', `Opción repetida en “${grupo.nombre}”.`);
    }
    if (ids.length < grupo.min) {
      throw new ErrorDePedido('opcion_obligatoria', `Elegí ${grupo.nombre.toLowerCase()}.`);
    }
    if (ids.length > grupo.max) {
      throw new ErrorDePedido('opcion_maximo', `En “${grupo.nombre}” podés elegir hasta ${grupo.max}.`);
    }
  }
  for (const grupoId of Object.keys(elegidas)) {
    if (!(producto.gruposOpciones ?? []).some((g) => g.id === grupoId)) {
      throw new ErrorDePedido('grupo_invalido', 'Ese producto no tiene esas opciones.');
    }
  }
}

function extrasCents(producto: Producto, elegidas: Record<string, string[]> = {}): Cents {
  let total = 0;
  for (const grupo of producto.gruposOpciones ?? []) {
    for (const id of elegidas[grupo.id] ?? []) {
      total += grupo.opciones.find((o) => o.id === id)?.precioExtraCents ?? 0;
    }
  }
  return total;
}

function opcionesTexto(producto: Producto, elegidas: Record<string, string[]> = {}): string[] {
  const out: string[] = [];
  for (const grupo of producto.gruposOpciones ?? []) {
    for (const id of elegidas[grupo.id] ?? []) {
      const op = grupo.opciones.find((o) => o.id === id);
      if (op) out.push(op.nombre);
    }
  }
  return out;
}

/** Convierte una línea del carrito en un ítem de pedido con precio congelado. Lanza error si algo no cuadra. */
export function construirItem(producto: Producto, linea: LineaCarrito): ItemPedido {
  if (!producto.disponible) {
    throw new ErrorDePedido('agotado', `${producto.nombre} ya no está disponible.`);
  }
  validarOpciones(producto, linea.opciones);
  const base = {
    productoId: producto.id,
    nombre: producto.nombre,
    venta: producto.venta,
    opcionesTexto: opcionesTexto(producto, linea.opciones),
    nota: linea.nota?.trim() || undefined,
    siNoHay: linea.siNoHay ?? 'parecido',
    estadoItem: 'ok' as const,
  };

  if (producto.venta === 'unidad') {
    const cantidad = linea.cantidad ?? 0;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      throw new ErrorDePedido('cantidad_invalida', `Cantidad inválida para ${producto.nombre}.`);
    }
    if (producto.precioCents == null) {
      throw new ErrorDePedido('sin_precio', `${producto.nombre} no tiene precio.`);
    }
    const unitario = producto.precioCents + extrasCents(producto, linea.opciones);
    return { ...base, cantidad, precioUnitarioCents: unitario, subtotalCents: unitario * cantidad };
  }

  const reglas = producto.dinero;
  const monto = linea.montoCents ?? 0;
  if (!reglas) throw new ErrorDePedido('sin_precio', `${producto.nombre} no tiene reglas de venta.`);
  if (monto < reglas.minimoCents) {
    throw new ErrorDePedido('monto_minimo', `Lo mínimo de ${producto.nombre} es $${(reglas.minimoCents / 100).toFixed(2)}.`);
  }
  if (monto > 5000 || monto % reglas.pasoCents !== 0) {
    throw new ErrorDePedido('monto_invalido', `Monto inválido para ${producto.nombre}.`);
  }
  return { ...base, montoCents: monto, subtotalCents: monto + extrasCents(producto, linea.opciones) };
}

export interface ResumenCarrito {
  items: ItemPedido[];
  subtotalCents: Cents;
  envioCents: Cents;
  totalCents: Cents;
  /** Cuánto falta para el pedido mínimo (0 si ya se cumple o si recoge). */
  faltaParaMinimoCents: Cents;
}

/**
 * Calcula el total del pedido. Es la MISMA función que usa el servidor:
 * el teléfono la usa para mostrar, el servidor para cobrar.
 */
export function calcularResumen(
  negocio: Negocio,
  productos: Map<string, Producto> | Record<string, Producto>,
  lineas: LineaCarrito[],
  modo: ModoEntrega,
  zonaId: string,
): ResumenCarrito {
  const get = (id: string) => (productos instanceof Map ? productos.get(id) : productos[id]);
  if (lineas.length === 0) throw new ErrorDePedido('carrito_vacio', 'Tu pedido está vacío.');
  const items = lineas.map((l) => {
    const p = get(l.productoId);
    if (!p || p.negocioId !== negocio.id) {
      throw new ErrorDePedido('producto_invalido', 'Un producto ya no existe en este negocio.');
    }
    return construirItem(p, l);
  });
  const subtotalCents = items.reduce((a, i) => a + i.subtotalCents, 0);

  let envioCents = 0;
  let faltaParaMinimoCents = 0;
  if (modo === 'domicilio') {
    const costo = negocio.envioPorZona[zonaId];
    if (costo == null) throw new ErrorDePedido('fuera_de_zona', `${negocio.nombre} no entrega en tu zona.`);
    envioCents = costo;
    faltaParaMinimoCents = Math.max(0, negocio.pedidoMinimoCents - subtotalCents);
  } else if (!negocio.permiteRecoger) {
    throw new ErrorDePedido('sin_recoger', `${negocio.nombre} no tiene opción de recoger.`);
  }
  return { items, subtotalCents, envioCents, totalCents: subtotalCents + envioCents, faltaParaMinimoCents };
}

/** Cambio para pago en efectivo. Devuelve null si el billete no alcanza. */
export function calcularCambio(totalCents: Cents, pagaConCents?: Cents): Cents | null {
  if (pagaConCents == null) return 0;
  return pagaConCents >= totalCents ? pagaConCents - totalCents : null;
}

/** Texto de referencia para venta por dinero: “$1 ≈ 1¼ lb”. */
export function textoRinde(producto: Producto): string | undefined {
  if (producto.venta !== 'dinero' || !producto.dinero) return undefined;
  return `$1 ≈ ${producto.dinero.rindePorDolar}`;
}
