/**
 * Sube las zonas, negocios y productos de ejemplo a Firestore.
 *   Emulador:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed
 *   Producción: GOOGLE_APPLICATION_CREDENTIALS=clave.json npm run seed
 * Opcional: DUENO_TELEFONO=+50371234567 asigna "Pupusería La Esquina" a ese número.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { NEGOCIOS, PRODUCTOS, ZONAS } from '../src/shared/demo';

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'mandadito-dev' });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
  const lote = db.batch();
  for (const { id, ...z } of ZONAS) lote.set(db.doc(`zonas/${id}`), z);
  for (const { id, ...n } of NEGOCIOS) lote.set(db.doc(`negocios/${id}`), n);
  for (const { id, negocioId, ...p } of PRODUCTOS) lote.set(db.doc(`negocios/${negocioId}/productos/${id}`), p);
  lote.set(db.doc('estadisticas/masPedidosHoy'), {
    items: PRODUCTOS.filter((p) => p.destacado).slice(0, 5).map((p) => ({ negocioId: p.negocioId, productoId: p.id, n: 0 })),
  });
  const tel = process.env.DUENO_TELEFONO;
  if (tel) {
    const uid = 'tel' + tel.replace(/\D/g, '');
    lote.set(db.doc(`usuarios/${uid}`), { telefono: tel, roles: ['cliente', 'negocio'], negocioId: 'esquina' }, { merge: true });
  }
  await lote.commit();
  console.log(`✔ ${ZONAS.length} zonas, ${NEGOCIOS.length} negocios, ${PRODUCTOS.length} productos`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
