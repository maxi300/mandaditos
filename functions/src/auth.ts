import { createHash, randomInt } from 'node:crypto';

import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { conErrores, db, normalizarTelefono } from './comun';
import { enviarMensajeCodigo, WHATSAPP_PHONE_ID, WHATSAPP_TOKEN } from './mensajeria';

const VIGENCIA_MIN = 10;
const MAX_ENVIOS_POR_HORA = 4;
const MAX_INTENTOS = 5;

/**
 * Cuenta para los revisores de Google Play / App Store (no pueden recibir tu WhatsApp).
 * Se configura en functions/.env (no se sube a git):
 *   TELEFONO_REVISION=+50370000000
 *   CODIGO_REVISION=<6 dígitos que solo vos sepás>
 * Si están vacías, no existe ninguna cuenta de revisión.
 */
const TELEFONO_REVISION = defineString('TELEFONO_REVISION', { default: '' });
const CODIGO_REVISION = defineString('CODIGO_REVISION', { default: '' });
function codigoDeRevision(telefono: string): string | null {
  const tel = TELEFONO_REVISION.value();
  const cod = CODIGO_REVISION.value();
  return tel && tel === telefono && /^\d{6}$/.test(cod) ? cod : null;
}

const hash = (telefono: string, codigo: string) => createHash('sha256').update(`${telefono}:${codigo}`).digest('hex');
/** uid estable por número, así el mismo teléfono siempre es la misma cuenta. */
const uidDeTelefono = (telefono: string) => 'tel' + telefono.replace(/\D/g, '');

export const enviarCodigo = onCall({ secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID] }, (req) =>
  conErrores(async () => {
    const telefono = normalizarTelefono(req.data?.telefono);
    const canal = req.data?.canal === 'sms' ? 'sms' : 'whatsapp';
    const ref = db().doc(`codigos/${telefono}`);
    const ahora = Date.now();
    const revision = codigoDeRevision(telefono);
    const codigo = revision ?? String(randomInt(0, 1_000_000)).padStart(6, '0');

    await db().runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const envios = ((s.data()?.envios as number[]) ?? []).filter((t) => ahora - t < 3_600_000);
      if (envios.length >= MAX_ENVIOS_POR_HORA) {
        throw new HttpsError('resource-exhausted', 'Pediste muchos códigos. Esperá un rato e intentá de nuevo.');
      }
      tx.set(ref, { hash: hash(telefono, codigo), expira: ahora + VIGENCIA_MIN * 60_000, intentos: 0, envios: [...envios, ahora] });
    });
    if (!revision) await enviarMensajeCodigo(telefono, codigo, canal);
    return { ok: true };
  }),
);

export const verificarCodigo = onCall((req) =>
  conErrores(async () => {
    const telefono = normalizarTelefono(req.data?.telefono);
    const codigo = String(req.data?.codigo ?? '').trim();
    const ref = db().doc(`codigos/${telefono}`);

    const valido = await db().runTransaction(async (tx) => {
      const s = await tx.get(ref);
      const d = s.data();
      if (!d || d.expira < Date.now()) throw new HttpsError('deadline-exceeded', 'El código venció. Pedí uno nuevo.');
      if (d.intentos >= MAX_INTENTOS) throw new HttpsError('resource-exhausted', 'Demasiados intentos. Pedí un código nuevo.');
      const ok = d.hash === hash(telefono, codigo);
      tx.update(ref, ok ? { expira: 0 } : { intentos: FieldValue.increment(1) });
      return ok;
    });
    if (!valido) throw new HttpsError('permission-denied', 'Código incorrecto.');

    const uid = uidDeTelefono(telefono);
    const uref = db().doc(`usuarios/${uid}`);
    if (!(await uref.get()).exists) {
      await uref.set({ telefono, roles: ['cliente'], creadoEn: Date.now() });
    }
    return { token: await getAuth().createCustomToken(uid) };
  }),
);
