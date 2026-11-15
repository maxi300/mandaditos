import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push con Expo. Importante:
 *  - No funciona en Expo Go en Android (desde SDK 53): hace falta un build propio (EAS).
 *  - Necesita el projectId de EAS (lo escribe `eas init` en app.json → extra.eas.projectId).
 */

// Con la app abierta: el aviso de “pedido nuevo” ya suena desde la pantalla de Pedidos,
// así que no repetimos el sonido; lo demás se muestra normal.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const tipo = (n.request.content.data as { tipo?: string } | undefined)?.tipo;
    const silencio = tipo === 'nuevo_pedido';
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: !silencio, shouldSetBadge: false };
  },
});

let canalesListos = false;
async function crearCanales() {
  if (Platform.OS !== 'android' || canalesListos) return;
  // El sonido de un canal no se puede cambiar después de creado: si algún día cambia,
  // hay que usar un id de canal nuevo (ej. "pedidos2").
  await Notifications.setNotificationChannelAsync('pedidos', {
    name: 'Pedidos nuevos (negocio)',
    importance: AndroidImportance.MAX,
    sound: 'nuevo-pedido.wav',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    lightColor: '#C2410C',
  });
  await Notifications.setNotificationChannelAsync('estado', {
    name: 'Estado de mis pedidos',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
  });
  canalesListos = true;
}

/** Pide permiso y devuelve el token de Expo, o null si no se puede (web, emulador, sin permiso, sin projectId). */
export async function obtenerTokenPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  await crearCanales();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Falta el projectId de EAS. Ejecutá `eas init` dentro de /app.');
    return null;
  }
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn('[push] No se pudo obtener el token', e);
    return null;
  }
}

/** A qué pantalla ir al tocar una notificación. */
export function rutaDeNotificacion(r: Notifications.NotificationResponse | null | undefined): string | null {
  const url = (r?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
