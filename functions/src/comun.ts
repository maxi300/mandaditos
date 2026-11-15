import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import { ErrorDePedido, type Usuario } from './shared';

export const db = () => getFirestore();

/** Convierte errores de reglas de negocio en errores que la app muestra tal cual. */
export async function conErrores<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e instanceof ErrorDePedido) throw new HttpsError('failed-precondition', e.message, { codigo: e.codigo });
    console.error(e);
    throw new HttpsError('internal', 'Algo salió mal. Probá de nuevo.');
  }
}

export function uidDe(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Iniciá sesión.');
  return req.auth.uid;
}

export async function usuarioDe(uid: string): Promise<Usuario> {
  const s = await db().doc(`usuarios/${uid}`).get();
  if (!s.exists) throw new HttpsError('permission-denied', 'Completá tu perfil primero.');
  return { id: uid, ...(s.data() as Omit<Usuario, 'id'>) };
}

/** Normaliza un número de El Salvador a +503XXXXXXXX. */
export function normalizarTelefono(t: unknown): string {
  const dig = String(t ?? '').replace(/\D/g, '');
  const local = dig.length === 11 && dig.startsWith('503') ? dig.slice(3) : dig;
  if (!/^[267]\d{7}$/.test(local)) throw new HttpsError('invalid-argument', 'Escribí un número de 8 dígitos de El Salvador.');
  return '+503' + local;
}
