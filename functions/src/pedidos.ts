import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { conErrores, db, uidDe, usuarioDe } from './comun';
import {
  ErrorDePedido,
  MINUTOS_PARA_ACEPTAR,
  aplicarTransicion,
  calcularCambio,
  calcularResumen,
  debeExpirar,
  debeSeguirSinRespuesta,
  type EstadoPedido,
  type LineaCarrito,
  type Negocio,
  type Pedido,
  type Producto,
  type Rol,
  type Zona,
} from './shared';

const MAX_PENDIENTES = 2;
const MAX_LINEAS = 40;

export const crearPedido = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const u = await usuarioDe(uid);
    const d = req.data ?? {};
    const lineas = d.lineas as LineaCarrito[];
    if (!Array.isArray(lineas) || lineas.length === 0 || lineas.length > MAX_LINEAS) throw new ErrorDePedido('lineas', 'Revisá tu pedido.');
    const modo = d.modo === 'recoger' ? 'recoger' : 'domicilio';
    const metodo = d.pago?.metodo === 'tarjeta' ? 'tarjeta' : 'efectivo';
    const pagaConCents = typeof d.pago?.pagaConCents === 'number' ? Math.round(d.pago.pagaConCents) : undefined;
    const referencia = String(d.referencia ?? '').slice(0, 200);

    const nSnap = await db().doc(`negocios/${String(d.negocioId)}`).get();
    if (!nSnap.exists) throw new ErrorDePedido('negocio', 'Este negocio no existe.');
    const negocio = { id: nSnap.id, ...nSnap.data() } as Negocio;
    if (negocio.estado !== 'activo') throw new ErrorDePedido('negocio', 'Este negocio no está disponible.');
    if (!negocio.abierto) throw new ErrorDePedido('cerrado', `${negocio.nombre} está cerrado ahora.`);

    // Precios SIEMPRE del servidor: el teléfono solo manda qué y cuánto.
    const ids = [...new Set(lineas.map((l) => String(l.productoId)))];
    const prodSnaps = await db().getAll(...ids.map((id) => db().doc(`negocios/${negocio.id}/productos/${id}`)));
    const productos = new Map<string, Producto>();
    for (const s of prodSnaps) {
      if (!s.exists) continue;
      const p = { id: s.id, negocioId: negocio.id, ...s.data() } as Producto;
      if (!p.disponible) throw new ErrorDePedido('agotado', `${p.nombre} se acabó. Quitalo de tu pedido.`);
      productos.set(p.id, p);
    }
    const zonaId = String(d.zonaId ?? '');
    const r = calcularResumen(negocio, productos, lineas, modo, zonaId);
    if (r.faltaParaMinimoCents > 0) throw new ErrorDePedido('minimo', 'No llega al pedido mínimo.');

    let cambioCents: number | undefined;
    if (metodo === 'efectivo') {
      const c = calcularCambio(r.totalCents, pagaConCents);
      if (c == null) throw new ErrorDePedido('billete', 'Ese billete no alcanza para el total.');
      cambioCents = c;
    } else if (!negocio.aceptaTarjeta) {
      throw new ErrorDePedido('tarjeta', `${negocio.nombre} no acepta tarjeta.`);
    }

    const zona = (await db().doc(`zonas/${zonaId}`).get()).data() as Zona | undefined;
    const ahora = Date.now();
    const ref = db().collection('pedidos').doc();
    const contador = db().doc('contadores/pedidos');

    await db().runTransaction(async (tx) => {
      const pendientes = await tx.get(db().collection('pedidos').where('clienteId', '==', uid).where('estado', '==', 'pendiente'));
      if (pendientes.size >= MAX_PENDIENTES) throw new ErrorDePedido('limite', 'Ya tenés 2 pedidos esperando respuesta.');
      const n = ((await tx.get(contador)).data()?.n ?? 0) + 1;
      const pedido: Omit<Pedido, 'id'> = {
        codigo: 'A-' + String(n % 10000).padStart(4, '0'),
        clienteId: uid,
        clienteNombre: u.nombre ?? 'Cliente',
        clienteTelefono: u.telefono,
        negocioId: negocio.id,
        negocioNombre: negocio.nombre,
        zonaId,
        modo,
        direccion: modo === 'domicilio' ? { referencia, zonaNombre: zona?.nombre ?? '' } : undefined,
        items: r.items,
        subtotalCents: r.subtotalCents,
        envioCents: r.envioCents,
        totalCents: r.totalCents,
        pago: { metodo, pagaConCents: metodo === 'efectivo' ? pagaConCents : undefined, cambioCents },
        estado: 'pendiente',
        creadoEn: ahora,
        expiraEn: ahora + MINUTOS_PARA_ACEPTAR * 60_000,
        historial: [{ estado: 'pendiente', en: ahora, rol: 'cliente' }],
      };
      tx.set(contador, { n }, { merge: true });
      tx.set(ref, pedido);
    });
    // TODO(notificaciones): avisar al negocio por push / WhatsApp.
    return { id: ref.id };
  }),
);

export const cambiarEstadoPedido = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const u = await usuarioDe(uid);
    const id = String(req.data?.id ?? '');
    const hacia = String(req.data?.hacia ?? '') as EstadoPedido;
    const ref = db().doc(`pedidos/${id}`);

    await db().runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists) throw new ErrorDePedido('no_existe', 'El pedido no existe.');
      const p = { id: s.id, ...s.data() } as Pedido;
      let rol: Rol;
      if (p.clienteId === uid) rol = 'cliente';
      else if (u.negocioId && u.negocioId === p.negocioId && u.roles.includes('negocio')) rol = 'negocio';
      else throw new HttpsError('permission-denied', 'Este pedido no es tuyo.');

      const etaMin = typeof req.data?.etaMin === 'number' ? req.data.etaMin : undefined;
      const motivo = typeof req.data?.motivo === 'string' ? req.data.motivo.slice(0, 120) : undefined;
      const nuevo = aplicarTransicion(p, hacia, rol, Date.now(), { etaMin, motivo });
      const { id: _id, ...datos } = nuevo;
      void _id;
      tx.set(ref, datos);
    });
    // TODO(notificaciones): avisar al cliente del cambio de estado.
    return { ok: true };
  }),
);

export const calificarPedido = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const id = String(req.data?.id ?? '');
    const estrellas = Number(req.data?.estrellas);
    const etiquetas = (Array.isArray(req.data?.etiquetas) ? req.data.etiquetas : []).map(String).slice(0, 6);
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) throw new ErrorDePedido('estrellas', 'Elegí de 1 a 5 estrellas.');

    await db().runTransaction(async (tx) => {
      const ref = db().doc(`pedidos/${id}`);
      const s = await tx.get(ref);
      const p = s.data() as Pedido | undefined;
      if (!p || p.clienteId !== uid) throw new HttpsError('permission-denied', 'Este pedido no es tuyo.');
      if (p.estado !== 'entregado' || p.calificacion) throw new ErrorDePedido('calificar', 'Este pedido no se puede calificar.');
      const nref = db().doc(`negocios/${p.negocioId}`);
      const n = (await tx.get(nref)).data() as Negocio;
      const total = n.calificacion.promedio * n.calificacion.n + estrellas;
      const cantidad = n.calificacion.n + 1;
      tx.update(ref, { calificacion: { estrellas, etiquetas } });
      tx.update(nref, { calificacion: { promedio: Math.round((total / cantidad) * 10) / 10, n: cantidad } });
    });
    return { ok: true };
  }),
);

/**
 * Cada minuto:
 *  - los pedidos que el negocio no aceptó a tiempo pasan a “expirado”;
 *  - las consultas que el cliente no respondió en 10 min vuelven a “preparando” (el pedido sigue).
 */
export const expirarPedidos = onSchedule('every 1 minutes', async () => {
  const ahora = Date.now();
  const [pendientes, consultas] = await Promise.all([
    db().collection('pedidos').where('estado', '==', 'pendiente').where('expiraEn', '<', ahora).limit(200).get(),
    db().collection('pedidos').where('estado', '==', 'esperando_cliente').where('expiraEn', '<', ahora).limit(200).get(),
  ]);
  const lote = db().batch();
  for (const doc of pendientes.docs) {
    const p = { id: doc.id, ...doc.data() } as Pedido;
    if (!debeExpirar(p, ahora)) continue;
    const hacia: EstadoPedido = 'expirado';
    lote.update(doc.ref, { estado: hacia, historial: FieldValue.arrayUnion({ estado: hacia, en: ahora, rol: 'sistema' }) });
  }
  for (const doc of consultas.docs) {
    const p = { id: doc.id, ...doc.data() } as Pedido;
    if (!debeSeguirSinRespuesta(p, ahora)) continue;
    const hacia: EstadoPedido = 'preparando';
    lote.update(doc.ref, { estado: hacia, historial: FieldValue.arrayUnion({ estado: hacia, en: ahora, rol: 'sistema', nota: 'El cliente no respondió a tiempo' }) });
  }
  await lote.commit();
});

/** Cada hora: recalcula “Lo más pedido hoy” con los pedidos del día. */
export const actualizarMasPedidos = onSchedule({ schedule: 'every 60 minutes', timeZone: 'America/El_Salvador' }, async () => {
  const inicioDia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/El_Salvador' }));
  inicioDia.setHours(0, 0, 0, 0);
  const desde = Date.now() - (Date.now() - inicioDia.getTime());
  const s = await db().collection('pedidos').where('creadoEn', '>=', desde).where('estado', 'in', ['preparando', 'listo', 'en_camino', 'entregado']).get();
  const cuenta = new Map<string, { negocioId: string; productoId: string; n: number }>();
  for (const d of s.docs) {
    const p = d.data() as Pedido;
    for (const it of p.items) {
      const k = `${p.negocioId}/${it.productoId}`;
      const c = cuenta.get(k) ?? { negocioId: p.negocioId, productoId: it.productoId, n: 0 };
      c.n += it.cantidad ?? 1;
      cuenta.set(k, c);
    }
  }
  const items = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  await db().doc('estadisticas/masPedidosHoy').set({ items, actualizado: Date.now() });
});
