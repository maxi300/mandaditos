import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { conErrores, db, uidDe } from './comun';
import { ESTADOS_FINALES, formatCents, TEXTO_ESTADO, type Pedido } from './shared';

/**
 * Notificaciones push con el servicio gratuito de Expo (https://docs.expo.dev/push-notifications/sending-notifications/).
 * La app registra su "ExponentPushToken[...]" con `guardarTokenPush`; aquí los leemos de `usuarios/{uid}.pushTokens`.
 *
 * Canales de Android (los crea la app, ver app/src/data/notificaciones.ts):
 *   - "pedidos": pedidos nuevos para el negocio. Prioridad máxima + sonido propio.
 *   - "estado":  avisos al cliente sobre su pedido.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_VALIDO = /^Expo(nent)?PushToken\[[^\]]+\]$/;

interface Mensaje {
  to: string;
  title: string;
  body: string;
  data: { url: string; tipo: string; pedidoId: string };
  channelId: 'pedidos' | 'estado';
  sound: string;
  priority: 'high';
}

// ─── Tokens ────────────────────────────────────────────────────────────────

export const guardarTokenPush = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const token = String(req.data?.token ?? '');
    if (!TOKEN_VALIDO.test(token)) throw new HttpsError('invalid-argument', 'Token de notificaciones inválido.');
    // Un mismo celular puede cambiar de cuenta: el token queda solo en la cuenta actual.
    const otros = await db().collection('usuarios').where('pushTokens', 'array-contains', token).get();
    const lote = db().batch();
    for (const d of otros.docs) if (d.id !== uid) lote.update(d.ref, { pushTokens: FieldValue.arrayRemove(token) });
    lote.update(db().doc(`usuarios/${uid}`), { pushTokens: FieldValue.arrayUnion(token) });
    await lote.commit();
    return { ok: true };
  }),
);

export const quitarTokenPush = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const token = String(req.data?.token ?? '');
    if (token) await db().doc(`usuarios/${uid}`).update({ pushTokens: FieldValue.arrayRemove(token) });
    return { ok: true };
  }),
);

async function tokensDe(uids: string[]): Promise<{ uid: string; token: string }[]> {
  const docs = await Promise.all(uids.map((u) => db().doc(`usuarios/${u}`).get()));
  return docs.flatMap((d) => ((d.data()?.pushTokens as string[] | undefined) ?? []).map((token) => ({ uid: d.id, token })));
}

async function duenosDe(negocioId: string): Promise<string[]> {
  const s = await db().collection('usuarios').where('negocioId', '==', negocioId).get();
  return s.docs.filter((d) => ((d.data().roles as string[] | undefined) ?? []).includes('negocio')).map((d) => d.id);
}

async function enviar(destinos: { uid: string; token: string }[], base: Omit<Mensaje, 'to'>) {
  if (destinos.length === 0) return;
  const mensajes: Mensaje[] = destinos.map((d) => ({ ...base, to: d.token }));
  const r = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(mensajes),
  });
  if (!r.ok) {
    logger.error('Expo push respondió con error', r.status, await r.text());
    return;
  }
  // Los tokens de celulares que desinstalaron la app se borran para no seguir intentando.
  const { data } = (await r.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const lote = db().batch();
  let borrar = 0;
  (data ?? []).forEach((ticket, i) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      lote.update(db().doc(`usuarios/${destinos[i].uid}`), { pushTokens: FieldValue.arrayRemove(destinos[i].token) });
      borrar++;
    } else if (ticket.status === 'error') {
      logger.warn('Push no enviado', ticket);
    }
  });
  if (borrar) await lote.commit();
}

// ─── Avisos por cambios en pedidos ─────────────────────────────────────────

export const avisarPedido = onDocumentWritten('pedidos/{id}', async (event) => {
  const antes = event.data?.before.data() as Pedido | undefined;
  const despues = event.data?.after.data() as Pedido | undefined;
  if (!despues) return;
  const id = event.params.id;
  const p = { ...despues, id };

  // 1) Pedido nuevo → al negocio, con prioridad máxima y sonido propio.
  if (!antes) {
    const total = formatCents(p.totalCents);
    await enviar(await tokensDe(await duenosDe(p.negocioId)), {
      title: `🛎️ Pedido nuevo ${p.codigo}`,
      body: `${p.clienteNombre} · ${total} · ${p.modo === 'recoger' ? 'Recoge en el local' : p.direccion?.zonaNombre ?? 'A domicilio'}. Tenés 5 min para aceptarlo.`,
      data: { url: '/pedidos', tipo: 'nuevo_pedido', pedidoId: id },
      channelId: 'pedidos',
      sound: 'nuevo-pedido.wav',
      priority: 'high',
    });
    return;
  }

  if (antes.estado === p.estado) return;
  const quien = p.historial[p.historial.length - 1]?.rol;

  // 2) El cliente respondió una consulta o canceló → al negocio.
  if (quien === 'cliente') {
    const respondio = antes.estado === 'esperando_cliente' && p.estado === 'preparando';
    const nota = p.historial[p.historial.length - 1]?.nota;
    if (!respondio && p.estado !== 'cancelado_cliente') return;
    await enviar(await tokensDe(await duenosDe(p.negocioId)), {
      title: respondio ? `${p.clienteNombre} respondió (${p.codigo})` : `${p.clienteNombre} canceló ${p.codigo}`,
      body: respondio ? nota ?? 'Que siga el pedido.' : 'Ya no hace falta prepararlo.',
      data: { url: '/pedidos', tipo: respondio ? 'respuesta' : 'cancelado', pedidoId: id },
      channelId: 'pedidos',
      sound: 'default',
      priority: 'high',
    });
    return;
  }

  // 3) Cambió el estado (negocio o sistema) → al cliente.
  let body = TEXTO_ESTADO[p.estado];
  if (p.estado === 'preparando' && antes.estado === 'pendiente' && p.etaMin) body = `${p.negocioNombre} aceptó tu pedido. Está en unos ${p.etaMin} min.`;
  if (p.estado === 'preparando' && antes.estado === 'esperando_cliente') body = 'No respondiste a tiempo; el negocio siguió con tu pedido.';
  if (p.estado === 'esperando_cliente') body = `Te preguntan: “${p.consulta ?? 'necesitan consultarte algo'}”. Tenés 10 min para responder.`;
  if (p.estado === 'listo' && p.modo === 'recoger') body = 'Ya podés pasar a recogerlo.';
  if (p.estado === 'rechazado') body = `No pudieron aceptarlo: ${p.motivoRechazo ?? 'sin motivo'}.`;
  if (p.estado === 'expirado') body = 'El negocio no respondió a tiempo. No se te cobró nada.';

  await enviar(await tokensDe([p.clienteId]), {
    title: p.estado === 'esperando_cliente' ? `${p.negocioNombre} te pregunta algo` : `${p.negocioNombre} · ${p.codigo}`,
    body,
    data: { url: `/pedido/${id}`, tipo: ESTADOS_FINALES.includes(p.estado) ? 'final' : p.estado, pedidoId: id },
    channelId: 'estado',
    sound: 'default',
    priority: 'high',
  });
});

// ─── Borrar cuenta (lo exigen Google Play y la App Store) ──────────────────

const ACTIVOS = ['pendiente', 'preparando', 'esperando_cliente', 'listo', 'en_camino'];

export const eliminarCuenta = onCall((req) =>
  conErrores(async () => {
    const uid = uidDe(req);
    const uref = db().doc(`usuarios/${uid}`);
    const u = (await uref.get()).data();
    if (u?.negocioId) {
      throw new HttpsError('failed-precondition', 'Tu cuenta maneja un negocio. Escribinos por WhatsApp para darlo de baja primero.');
    }
    const pedidos = await db().collection('pedidos').where('clienteId', '==', uid).get();
    if (pedidos.docs.some((d) => ACTIVOS.includes(d.data().estado))) {
      throw new HttpsError('failed-precondition', 'Tenés un pedido en curso. Esperá a que termine para borrar tu cuenta.');
    }
    // Los pedidos viejos se quedan (son el registro de ventas del negocio) pero sin datos personales.
    const lote = db().batch();
    for (const d of pedidos.docs) {
      lote.update(d.ref, { clienteNombre: 'Cuenta eliminada', clienteTelefono: '', direccion: FieldValue.delete() });
    }
    lote.delete(uref);
    if (u?.telefono) lote.delete(db().doc(`codigos/${u.telefono}`));
    await lote.commit();
    await getAuth().deleteUser(uid).catch((e) => logger.warn('No se pudo borrar el usuario de Auth', e));
    return { ok: true };
  }),
);
