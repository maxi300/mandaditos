// ⚠️ ARCHIVO GENERADO desde /shared/src — no lo edites aquí. Ejecutá: node scripts/sync-shared.mjs
/**
 * Tipos de dominio de Mandadito.
 * Todo el dinero se maneja en CENTAVOS (enteros) para evitar errores de redondeo.
 */

export type Cents = number;

export type Vertical = 'restaurante' | 'mercado' | 'farmacia' | 'servicio';
export type EstadoNegocio = 'revision' | 'activo' | 'pausado' | 'suspendido';
export type Rol = 'cliente' | 'negocio' | 'admin' | 'sistema';

export interface Negocio {
  id: string;
  nombre: string;
  vertical: Vertical;
  categoria: string;
  fotoUrl?: string;
  estado: EstadoNegocio;
  /** Abierto ahora según horario (lo calcula el servidor o el negocio lo marca). */
  abierto: boolean;
  direccion: string;
  whatsapp: string;
  aceptaTarjeta: boolean;
  permiteRecoger: boolean;
  pedidoMinimoCents: Cents;
  /** Costo de envío por zona (zonaId → centavos). Si la zona no está, no entrega ahí. */
  envioPorZona: Record<string, Cents>;
  tiempoPrepMin: { min: number; max: number };
  calificacion: { promedio: number; n: number };
  promo?: string;
}

export interface Opcion {
  id: string;
  nombre: string;
  precioExtraCents: Cents;
}

export interface GrupoOpciones {
  id: string;
  nombre: string;
  /** Cantidad mínima a elegir (1 = obligatorio). */
  min: number;
  /** Cantidad máxima a elegir. */
  max: number;
  opciones: Opcion[];
}

export type FormaVenta = 'unidad' | 'dinero';

export interface Producto {
  id: string;
  negocioId: string;
  nombre: string;
  descripcion?: string;
  fotoUrl?: string;
  seccion: string;
  disponible: boolean;
  destacado?: boolean;
  venta: FormaVenta;
  /** Solo venta por unidad. */
  precioCents?: Cents;
  /** Solo venta por dinero: “$1 de tomate”. */
  dinero?: { minimoCents: Cents; pasoCents: Cents; rindePorDolar: string };
  gruposOpciones?: GrupoOpciones[];
  requiereReceta?: boolean;
}

export type SiNoHay = 'parecido' | 'avisar' | 'quitar';

/** Lo que el cliente pone en el carrito. */
export interface LineaCarrito {
  lineaId: string;
  productoId: string;
  /** Venta por unidad. */
  cantidad?: number;
  /** Venta por dinero. */
  montoCents?: Cents;
  /** grupoId → ids de opciones elegidas. */
  opciones?: Record<string, string[]>;
  nota?: string;
  siNoHay?: SiNoHay;
}

export type ModoEntrega = 'domicilio' | 'recoger';
export type MetodoPago = 'efectivo' | 'tarjeta';

export interface ItemPedido {
  productoId: string;
  nombre: string;
  venta: FormaVenta;
  cantidad?: number;
  montoCents?: Cents;
  precioUnitarioCents?: Cents;
  opcionesTexto: string[];
  nota?: string;
  siNoHay: SiNoHay;
  subtotalCents: Cents;
  estadoItem: 'ok' | 'sustituido' | 'quitado';
  sustituto?: { nombre: string; subtotalCents: Cents };
}

export type EstadoPedido =
  | 'pendiente'
  | 'preparando'
  | 'esperando_cliente'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'rechazado'
  | 'cancelado_cliente'
  | 'expirado'
  | 'no_entregado';

export interface EventoPedido {
  estado: EstadoPedido;
  en: number;
  rol: Rol;
  nota?: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  negocioId: string;
  negocioNombre: string;
  zonaId: string;
  modo: ModoEntrega;
  direccion?: { referencia: string; zonaNombre: string };
  items: ItemPedido[];
  subtotalCents: Cents;
  envioCents: Cents;
  totalCents: Cents;
  pago: { metodo: MetodoPago; pagaConCents?: Cents; cambioCents?: Cents };
  estado: EstadoPedido;
  motivoRechazo?: string;
  /** Lo que el negocio le preguntó al cliente (al pasar a `esperando_cliente`). */
  consulta?: string;
  etaMin?: number;
  creadoEn: number;
  expiraEn: number;
  historial: EventoPedido[];
  calificacion?: { estrellas: number; etiquetas: string[] };
}

export interface Usuario {
  id: string;
  telefono: string;
  nombre?: string;
  roles: Rol[];
  negocioId?: string;
  direccion?: { zonaId: string; zonaNombre: string; referencia: string };
}

export interface Zona {
  id: string;
  nombre: string;
  municipio: string;
}
