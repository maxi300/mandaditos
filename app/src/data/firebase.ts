import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

import type {
  Rol, DatosTransicion, EstadoPedido, Negocio, Pedido, Producto, Usuario, Zona } from '@/shared';

import type { DataSource, NuevoPedido } from './source';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const REGION = 'us-central1';

function iniciar() {
  const app = getApps().length ? getApp() : initializeApp(config);
  // En el teléfono la sesión se guarda en AsyncStorage; en web, en el navegador.
  const getRNPersistence = (FirebaseAuth as unknown as { getReactNativePersistence?: (s: typeof AsyncStorage) => FirebaseAuth.Persistence }).getReactNativePersistence;
  const auth =
    Platform.OS !== 'web' && getRNPersistence
      ? FirebaseAuth.initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) })
      : FirebaseAuth.getAuth(app);
  return { app, auth, db: getFirestore(app), fns: getFunctions(app, REGION) };
}

class FirebaseSource implements DataSource {
  readonly modo = 'firebase' as const;
  private _f?: ReturnType<typeof iniciar>;
  private get f() {
    return (this._f ??= iniciar());
  }
  private llamar<I, O>(nombre: string) {
    return async (datos: I) => (await httpsCallable<I, O>(this.f.fns, nombre)(datos)).data;
  }
  private uid() {
    const u = this.f.auth.currentUser;
    if (!u) throw new Error('Iniciá sesión.');
    return u.uid;
  }

  async enviarCodigo(telefono: string, canal: 'whatsapp' | 'sms') {
    await this.llamar<{ telefono: string; canal: string }, { ok: true }>('enviarCodigo')({ telefono, canal });
  }
  async verificarCodigo(telefono: string, codigo: string) {
    const { token } = await this.llamar<{ telefono: string; codigo: string }, { token: string }>('verificarCodigo')({ telefono, codigo });
    await FirebaseAuth.signInWithCustomToken(this.f.auth, token);
    return (await this.usuarioActual()) as Usuario;
  }
  async usuarioActual(): Promise<Usuario | null> {
    await this.f.auth.authStateReady();
    const u = this.f.auth.currentUser;
    if (!u) return null;
    const snap = await getDoc(doc(this.f.db, 'usuarios', u.uid));
    return snap.exists() ? ({ id: u.uid, ...snap.data() } as Usuario) : { id: u.uid, telefono: u.phoneNumber ?? '', roles: ['cliente'] as Rol[] };
  }
  async guardarPerfil(datos: Pick<Usuario, 'nombre' | 'direccion'>) {
    const ref = doc(this.f.db, 'usuarios', this.uid());
    await setDoc(ref, datos, { merge: true });
    return (await this.usuarioActual()) as Usuario;
  }
  /** Token de este celular, para sacarlo de la cuenta al cerrar sesión. */
  private tokenPush?: string;

  async cerrarSesion() {
    // Si no, este celular seguiría recibiendo los avisos de la cuenta anterior.
    if (this.tokenPush) await this.llamar('quitarTokenPush')({ token: this.tokenPush }).catch(() => {});
    this.tokenPush = undefined;
    await FirebaseAuth.signOut(this.f.auth);
  }
  async registrarTokenPush(token: string) {
    await this.llamar('guardarTokenPush')({ token });
    this.tokenPush = token;
  }
  async eliminarCuenta() {
    await this.llamar('eliminarCuenta')({});
    this.tokenPush = undefined;
    await FirebaseAuth.signOut(this.f.auth);
  }

  async zonas() {
    const s = await getDocs(collection(this.f.db, 'zonas'));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }) as Zona);
  }
  async negocios() {
    const s = await getDocs(query(collection(this.f.db, 'negocios'), where('estado', '==', 'activo')));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }) as Negocio);
  }
  async negocio(id: string) {
    const s = await getDoc(doc(this.f.db, 'negocios', id));
    return s.exists() ? ({ id: s.id, ...s.data() } as Negocio) : null;
  }
  async productos(negocioId: string) {
    const s = await getDocs(collection(this.f.db, 'negocios', negocioId, 'productos'));
    return s.docs.map((d) => ({ id: d.id, negocioId, ...d.data() }) as Producto);
  }
  async masPedidosHoy() {
    const s = await getDoc(doc(this.f.db, 'estadisticas', 'masPedidosHoy'));
    const lista = (s.data()?.items ?? []) as { negocioId: string; productoId: string }[];
    const out: { producto: Producto; negocio: Negocio }[] = [];
    for (const it of lista.slice(0, 10)) {
      const [n, p] = await Promise.all([this.negocio(it.negocioId), getDoc(doc(this.f.db, 'negocios', it.negocioId, 'productos', it.productoId))]);
      if (n?.abierto && p.exists()) out.push({ negocio: n, producto: { id: p.id, negocioId: n.id, ...p.data() } as Producto });
    }
    return out;
  }

  async crearPedido(datos: NuevoPedido) {
    const { id } = await this.llamar<NuevoPedido, { id: string }>('crearPedido')(datos);
    const s = await getDoc(doc(this.f.db, 'pedidos', id));
    return { id, ...s.data() } as Pedido;
  }
  observarPedido(id: string, cb: (p: Pedido | null) => void) {
    return onSnapshot(doc(this.f.db, 'pedidos', id), (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Pedido) : null));
  }
  observarMisPedidos(cb: (p: Pedido[]) => void) {
    const q = query(collection(this.f.db, 'pedidos'), where('clienteId', '==', this.uid()), orderBy('creadoEn', 'desc'), limit(30));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pedido)));
  }
  async cancelarPedido(id: string) {
    await this.cambiarEstado(id, 'cancelado_cliente');
  }
  async calificarPedido(id: string, estrellas: number, etiquetas: string[]) {
    await this.llamar('calificarPedido')({ id, estrellas, etiquetas });
  }

  observarPedidosNegocio(negocioId: string, cb: (p: Pedido[]) => void) {
    const q = query(collection(this.f.db, 'pedidos'), where('negocioId', '==', negocioId), orderBy('creadoEn', 'desc'), limit(50));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pedido)));
  }
  async cambiarEstado(id: string, hacia: EstadoPedido, datos?: DatosTransicion) {
    await this.llamar('cambiarEstadoPedido')({ id, hacia, ...datos });
  }
  async cambiarDisponible(productoId: string, disponible: boolean) {
    const u = await this.usuarioActual();
    if (!u?.negocioId) throw new Error('Tu cuenta no tiene negocio.');
    await updateDoc(doc(this.f.db, 'negocios', u.negocioId, 'productos', productoId), { disponible });
  }
  async cambiarAbierto(negocioId: string, abierto: boolean) {
    await updateDoc(doc(this.f.db, 'negocios', negocioId), { abierto });
  }
}

export const firebaseSource = new FirebaseSource();
