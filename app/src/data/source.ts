import type {
  DatosTransicion,
  EstadoPedido,
  LineaCarrito,
  MetodoPago,
  ModoEntrega,
  Negocio,
  Pedido,
  Producto,
  Usuario,
  Zona,
} from '@/shared';

export type Cancelar = () => void;

export interface NuevoPedido {
  negocioId: string;
  lineas: LineaCarrito[];
  modo: ModoEntrega;
  zonaId: string;
  referencia: string;
  pago: { metodo: MetodoPago; pagaConCents?: number };
}

/**
 * Todo lo que la app necesita del servidor.
 * Hay dos implementaciones: `mock` (demo sin internet) y `firebase` (producción).
 */
export interface DataSource {
  readonly modo: 'demo' | 'firebase';

  // Sesión
  enviarCodigo(telefono: string, canal: 'whatsapp' | 'sms'): Promise<void>;
  verificarCodigo(telefono: string, codigo: string): Promise<Usuario>;
  usuarioActual(): Promise<Usuario | null>;
  guardarPerfil(datos: Pick<Usuario, 'nombre' | 'direccion'>): Promise<Usuario>;
  cerrarSesion(): Promise<void>;
  /** Guarda el token de notificaciones de este celular en la cuenta actual. */
  registrarTokenPush(token: string): Promise<void>;
  /** Borra la cuenta y sus datos personales (lo exigen las tiendas). */
  eliminarCuenta(): Promise<void>;

  // Catálogo
  zonas(): Promise<Zona[]>;
  negocios(): Promise<Negocio[]>;
  negocio(id: string): Promise<Negocio | null>;
  productos(negocioId: string): Promise<Producto[]>;
  masPedidosHoy(): Promise<{ producto: Producto; negocio: Negocio }[]>;

  // Pedidos (cliente)
  crearPedido(datos: NuevoPedido): Promise<Pedido>;
  observarPedido(id: string, cb: (p: Pedido | null) => void): Cancelar;
  observarMisPedidos(cb: (p: Pedido[]) => void): Cancelar;
  cancelarPedido(id: string): Promise<void>;
  calificarPedido(id: string, estrellas: number, etiquetas: string[]): Promise<void>;

  // Pedidos (negocio)
  observarPedidosNegocio(negocioId: string, cb: (p: Pedido[]) => void): Cancelar;
  cambiarEstado(id: string, hacia: EstadoPedido, datos?: DatosTransicion): Promise<void>;
  cambiarDisponible(productoId: string, disponible: boolean): Promise<void>;
  cambiarAbierto(negocioId: string, abierto: boolean): Promise<void>;
}
