import { ErrorDePedido } from './pricing';
import type { EstadoPedido, Pedido, Rol } from './types';

/** Minutos que tiene el negocio para aceptar antes de que expire. */
export const MINUTOS_PARA_ACEPTAR = 5;
/** Minutos que tiene el cliente para decidir una sustitución. */
export const MINUTOS_DECISION_CLIENTE = 10;

export const ESTADOS_FINALES: EstadoPedido[] = [
  'entregado',
  'rechazado',
  'cancelado_cliente',
  'expirado',
  'no_entregado',
];

/** Quién puede mover el pedido de un estado a otro. */
const TRANSICIONES: Record<EstadoPedido, Partial<Record<EstadoPedido, Rol[]>>> = {
  pendiente: {
    preparando: ['negocio'],
    rechazado: ['negocio'],
    cancelado_cliente: ['cliente'],
    expirado: ['sistema'],
  },
  preparando: {
    esperando_cliente: ['negocio'],
    listo: ['negocio'],
    en_camino: ['negocio'],
  },
  esperando_cliente: {
    preparando: ['cliente', 'sistema'],
    cancelado_cliente: ['cliente'],
  },
  listo: {
    en_camino: ['negocio'],
    entregado: ['negocio'],
  },
  en_camino: {
    entregado: ['negocio'],
    no_entregado: ['negocio'],
  },
  entregado: {},
  rechazado: {},
  cancelado_cliente: {},
  expirado: {},
  no_entregado: {},
};

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido, rol: Rol): boolean {
  if (rol === 'admin') return !ESTADOS_FINALES.includes(desde) && hacia in TRANSICIONES[desde];
  return TRANSICIONES[desde][hacia]?.includes(rol) ?? false;
}

export interface DatosTransicion {
  etaMin?: number;
  motivo?: string;
}

/** Aplica una transición y devuelve el pedido nuevo (no modifica el original). */
export function aplicarTransicion(
  pedido: Pedido,
  hacia: EstadoPedido,
  rol: Rol,
  ahora: number,
  datos: DatosTransicion = {},
): Pedido {
  if (!puedeTransicionar(pedido.estado, hacia, rol)) {
    throw new ErrorDePedido('transicion_invalida', `No se puede pasar de “${pedido.estado}” a “${hacia}”.`);
  }
  if (pedido.estado === 'pendiente' && hacia !== 'expirado' && ahora > pedido.expiraEn) {
    throw new ErrorDePedido('expirado', 'Este pedido ya expiró.');
  }
  const nuevo: Pedido = { ...pedido, estado: hacia, historial: [...pedido.historial, { estado: hacia, en: ahora, rol, nota: datos.motivo }] };

  if (hacia === 'preparando' && pedido.estado === 'pendiente') {
    const eta = datos.etaMin ?? 0;
    if (!Number.isInteger(eta) || eta < 5 || eta > 120) {
      throw new ErrorDePedido('eta_invalida', 'Elegí en cuánto estará listo (5 a 120 minutos).');
    }
    nuevo.etaMin = eta;
  }
  if (hacia === 'rechazado') {
    if (!datos.motivo?.trim()) throw new ErrorDePedido('motivo_requerido', 'Elegí un motivo para rechazar.');
    nuevo.motivoRechazo = datos.motivo.trim();
  }
  if (hacia === 'esperando_cliente') {
    if (!datos.motivo?.trim()) throw new ErrorDePedido('consulta_requerida', 'Escribí qué le querés consultar al cliente.');
    nuevo.consulta = datos.motivo.trim();
    nuevo.expiraEn = ahora + MINUTOS_DECISION_CLIENTE * 60_000;
  }
  return nuevo;
}

/** ¿Este pedido ya pasó su tiempo límite? (lo usa el proceso que expira pedidos) */
export function debeExpirar(pedido: Pedido, ahora: number): boolean {
  return pedido.estado === 'pendiente' && ahora > pedido.expiraEn;
}

/** Si el cliente no respondió la consulta a tiempo, el pedido sigue (vuelve a `preparando`). */
export function debeSeguirSinRespuesta(pedido: Pedido, ahora: number): boolean {
  return pedido.estado === 'esperando_cliente' && ahora > pedido.expiraEn;
}

export const TEXTO_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'Esperando al negocio',
  preparando: 'Preparando tu pedido',
  esperando_cliente: 'El negocio necesita tu respuesta',
  listo: 'Listo',
  en_camino: 'Va en camino',
  entregado: 'Entregado',
  rechazado: 'El negocio no pudo aceptarlo',
  cancelado_cliente: 'Cancelaste el pedido',
  expirado: 'El negocio no respondió a tiempo',
  no_entregado: 'No se pudo entregar',
};

/** Paso de la barra de progreso (0–4) para mostrar al cliente. */
export function pasoProgreso(estado: EstadoPedido): number {
  switch (estado) {
    case 'pendiente':
      return 1;
    case 'preparando':
    case 'esperando_cliente':
    case 'listo':
      return 2;
    case 'en_camino':
      return 3;
    case 'entregado':
      return 4;
    default:
      return 0;
  }
}
