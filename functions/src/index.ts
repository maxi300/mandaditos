import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
// Firestore no acepta `undefined`; así los campos opcionales simplemente no se guardan.
getFirestore().settings({ ignoreUndefinedProperties: true });
// Debe coincidir con REGION en app/src/data/firebase.ts
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { enviarCodigo, verificarCodigo } from './auth';
export { avisarPedido, eliminarCuenta, guardarTokenPush, quitarTokenPush } from './notificaciones';
export { actualizarMasPedidos, calificarPedido, cambiarEstadoPedido, crearPedido, expirarPedidos } from './pedidos';
