import { useLastNotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { api } from '@/data';
import { obtenerTokenPush, rutaDeNotificacion } from '@/data/notificaciones';
import { useSession } from '@/state/session';

/**
 * - Cuando hay sesión, registra este celular para recibir notificaciones.
 * - Al tocar una notificación (también con la app cerrada), abre la pantalla del pedido.
 */
export function Push() {
  const { usuario, cargando, setModo } = useSession();
  const registradoPara = useRef<string | null>(null);
  const respuesta = useLastNotificationResponse();
  const atendida = useRef<string | null>(null);

  useEffect(() => {
    if (!usuario || registradoPara.current === usuario.id) return;
    registradoPara.current = usuario.id;
    obtenerTokenPush()
      .then((token) => (token ? api.registrarTokenPush(token) : undefined))
      .catch((e) => console.warn('[push] No se pudo registrar', e));
  }, [usuario]);

  useEffect(() => {
    if (cargando || !usuario || !respuesta) return;
    const id = respuesta.notification.request.identifier;
    if (atendida.current === id) return;
    const ruta = rutaDeNotificacion(respuesta);
    if (!ruta) return;
    atendida.current = id;
    if (ruta === '/pedidos' && usuario.negocioId) setModo('negocio');
    router.push(ruta as never);
  }, [respuesta, cargando, usuario, setModo]);

  // Al cerrar sesión, la próxima cuenta vuelve a registrar el token.
  useEffect(() => {
    if (!usuario) registradoPara.current = null;
  }, [usuario]);

  return null;
}
