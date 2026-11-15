import {
  aplicarTransicion,
  calcularCambio,
  calcularResumen,
  debeExpirar,
  ESTADOS_FINALES,
  debeSeguirSinRespuesta,
  ErrorDePedido,
  MINUTOS_PARA_ACEPTAR,
  type DatosTransicion,
  type EstadoPedido,
  type Negocio,
  type Pedido,
  type Producto,
  type Rol,
  type Usuario,
} from '@/shared';

import { NEGOCIOS, PRODUCTOS, ZONAS } from '@/shared/demo';
import type { DataSource, NuevoPedido } from './source';

/** Código de verificación en modo demo. */
export const CODIGO_DEMO = '123456';

const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/**
 * Servidor de mentira que vive en el teléfono. Usa las MISMAS reglas que el servidor real
 * (shared/), así lo que probás en demo se comporta igual en producción.
 */
class MockSource implements DataSource {
  readonly modo = 'demo' as const;
  private dbNegocios = NEGOCIOS.map((n) => ({ ...n }));
  private dbProductos = PRODUCTOS.map((p) => ({ ...p }));
  private pedidos: Pedido[] = [];
  private usuario: Usuario | null = null;
  private listeners = new Set<() => void>();
  private contador = 41;

  constructor() {
    setInterval(() => this.expirarPedidos(), 5_000);
  }

  private emitir() {
    this.listeners.forEach((l) => l());
  }
  private suscribir(fn: () => void) {
    this.listeners.add(fn);
    fn();
    return () => {
      this.listeners.delete(fn);
    };
  }
  private expirarPedidos() {
    const ahora = Date.now();
    let cambio = false;
    this.pedidos = this.pedidos.map((p) => {
      if (debeExpirar(p, ahora)) {
        cambio = true;
        return aplicarTransicion(p, 'expirado', 'sistema', ahora);
      }
      if (debeSeguirSinRespuesta(p, ahora)) {
        cambio = true;
        return aplicarTransicion(p, 'preparando', 'sistema', ahora, { motivo: 'El cliente no respondió a tiempo' });
      }
      return p;
    });
    if (cambio) this.emitir();
  }
  private rolActual(pedido: Pedido): Rol {
    if (!this.usuario) throw new ErrorDePedido('sin_sesion', 'Iniciá sesión.');
    if (this.usuario.negocioId === pedido.negocioId && this.usuario.roles.includes('negocio')) return 'negocio';
    if (pedido.clienteId === this.usuario.id) return 'cliente';
    throw new ErrorDePedido('sin_permiso', 'No tenés permiso para este pedido.');
  }

  async enviarCodigo(telefono: string) {
    await espera();
    if (telefono.replace(/\D/g, '').length !== 8) throw new ErrorDePedido('telefono', 'Escribí los 8 dígitos de tu número.');
  }
  async verificarCodigo(telefono: string, codigo: string) {
    await espera();
    if (codigo !== CODIGO_DEMO) throw new ErrorDePedido('codigo', 'Código incorrecto. En modo demo es 123456.');
    this.usuario = { id: 'demo-' + telefono.replace(/\D/g, ''), telefono: '+503' + telefono.replace(/\D/g, ''), roles: ['cliente', 'negocio'], negocioId: 'esquina' };
    return this.usuario;
  }
  async usuarioActual() {
    return this.usuario;
  }
  async guardarPerfil(datos: Pick<Usuario, 'nombre' | 'direccion'>) {
    if (!this.usuario) throw new ErrorDePedido('sin_sesion', 'Iniciá sesión.');
    this.usuario = { ...this.usuario, ...datos };
    return this.usuario;
  }
  async cerrarSesion() {
    this.usuario = null;
  }
  async registrarTokenPush() {
    // En demo no hay servidor que mande notificaciones.
  }
  async eliminarCuenta() {
    await espera();
    const yo = this.usuario;
    if (!yo) return;
    if (yo.negocioId) throw new ErrorDePedido('negocio', 'Tu cuenta maneja un negocio. Escribinos por WhatsApp para darlo de baja primero.');
    if (this.pedidos.some((p) => p.clienteId === yo.id && !ESTADOS_FINALES.includes(p.estado))) {
      throw new ErrorDePedido('pedido_activo', 'Tenés un pedido en curso. Esperá a que termine para borrar tu cuenta.');
    }
    this.pedidos = this.pedidos.map((p) => (p.clienteId === yo.id ? { ...p, clienteNombre: 'Cuenta eliminada', clienteTelefono: '', direccion: undefined } : p));
    this.usuario = null;
    this.emitir();
  }

  async zonas() {
    return ZONAS;
  }
  async negocios() {
    return this.dbNegocios.filter((n) => n.estado === 'activo');
  }
  async negocio(id: string) {
    return this.dbNegocios.find((n) => n.id === id) ?? null;
  }
  async productos(negocioId: string) {
    return this.dbProductos.filter((p) => p.negocioId === negocioId);
  }
  async masPedidosHoy() {
    const ids = ['esq-rev', 'che-tom', 'rosa-dia', 'raf-ace', 'esq-lor'];
    return ids
      .map((id) => this.dbProductos.find((p) => p.id === id))
      .filter((p): p is Producto => !!p)
      .map((producto) => ({ producto, negocio: this.dbNegocios.find((n) => n.id === producto.negocioId) as Negocio }))
      .filter((x) => x.negocio.abierto);
  }

  async crearPedido(datos: NuevoPedido) {
    await espera(400);
    const u = this.usuario;
    if (!u) throw new ErrorDePedido('sin_sesion', 'Iniciá sesión.');
    const negocio = this.dbNegocios.find((n) => n.id === datos.negocioId);
    if (!negocio || negocio.estado !== 'activo') throw new ErrorDePedido('negocio', 'Este negocio no está disponible.');
    if (!negocio.abierto) throw new ErrorDePedido('cerrado', `${negocio.nombre} está cerrado ahora.`);
    if (this.pedidos.filter((p) => p.clienteId === u.id && p.estado === 'pendiente').length >= 2) {
      throw new ErrorDePedido('limite', 'Ya tenés 2 pedidos esperando respuesta.');
    }
    const mapa = new Map(this.dbProductos.map((p) => [p.id, p]));
    const r = calcularResumen(negocio, mapa, datos.lineas, datos.modo, datos.zonaId);
    if (r.faltaParaMinimoCents > 0) throw new ErrorDePedido('minimo', 'No llega al pedido mínimo.');
    let cambioCents: number | undefined;
    if (datos.pago.metodo === 'efectivo') {
      const c = calcularCambio(r.totalCents, datos.pago.pagaConCents);
      if (c == null) throw new ErrorDePedido('billete', 'Ese billete no alcanza para el total.');
      cambioCents = c;
    } else if (!negocio.aceptaTarjeta) {
      throw new ErrorDePedido('tarjeta', `${negocio.nombre} no acepta tarjeta.`);
    }
    const ahora = Date.now();
    const zona = ZONAS.find((z) => z.id === datos.zonaId);
    const pedido: Pedido = {
      id: 'p' + ahora,
      codigo: 'A-' + String(++this.contador).padStart(4, '0'),
      clienteId: u.id,
      clienteNombre: u.nombre ?? 'Cliente',
      clienteTelefono: u.telefono,
      negocioId: negocio.id,
      negocioNombre: negocio.nombre,
      zonaId: datos.zonaId,
      modo: datos.modo,
      direccion: datos.modo === 'domicilio' ? { referencia: datos.referencia, zonaNombre: zona?.nombre ?? '' } : undefined,
      items: r.items,
      subtotalCents: r.subtotalCents,
      envioCents: r.envioCents,
      totalCents: r.totalCents,
      pago: { metodo: datos.pago.metodo, pagaConCents: datos.pago.pagaConCents, cambioCents },
      estado: 'pendiente',
      creadoEn: ahora,
      expiraEn: ahora + MINUTOS_PARA_ACEPTAR * 60_000,
      historial: [{ estado: 'pendiente', en: ahora, rol: 'cliente' }],
    };
    this.pedidos = [pedido, ...this.pedidos];
    this.emitir();
    return pedido;
  }
  observarPedido(id: string, cb: (p: Pedido | null) => void) {
    return this.suscribir(() => cb(this.pedidos.find((p) => p.id === id) ?? null));
  }
  observarMisPedidos(cb: (p: Pedido[]) => void) {
    return this.suscribir(() => cb(this.pedidos.filter((p) => p.clienteId === this.usuario?.id)));
  }
  async cancelarPedido(id: string) {
    await this.cambiarEstado(id, 'cancelado_cliente');
  }
  async calificarPedido(id: string, estrellas: number, etiquetas: string[]) {
    const p = this.pedidos.find((x) => x.id === id);
    if (!p || p.estado !== 'entregado' || p.calificacion) throw new ErrorDePedido('calificar', 'Este pedido no se puede calificar.');
    if (estrellas < 1 || estrellas > 5) throw new ErrorDePedido('estrellas', 'Elegí de 1 a 5 estrellas.');
    this.pedidos = this.pedidos.map((x) => (x.id === id ? { ...x, calificacion: { estrellas, etiquetas } } : x));
    this.emitir();
  }

  observarPedidosNegocio(negocioId: string, cb: (p: Pedido[]) => void) {
    return this.suscribir(() => cb(this.pedidos.filter((p) => p.negocioId === negocioId)));
  }
  async cambiarEstado(id: string, hacia: EstadoPedido, datos?: DatosTransicion) {
    await espera(200);
    const p = this.pedidos.find((x) => x.id === id);
    if (!p) throw new ErrorDePedido('no_existe', 'El pedido no existe.');
    const nuevo = aplicarTransicion(p, hacia, this.rolActual(p), Date.now(), datos);
    this.pedidos = this.pedidos.map((x) => (x.id === id ? nuevo : x));
    this.emitir();
  }
  async cambiarDisponible(productoId: string, disponible: boolean) {
    this.dbProductos = this.dbProductos.map((p) => (p.id === productoId ? { ...p, disponible } : p));
    this.emitir();
  }
  async cambiarAbierto(negocioId: string, abierto: boolean) {
    this.dbNegocios = this.dbNegocios.map((n) => (n.id === negocioId ? { ...n, abierto } : n));
    this.emitir();
  }
}

export const mockSource = new MockSource();
