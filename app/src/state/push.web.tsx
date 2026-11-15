/**
 * Versión web de <Push />: en el navegador no hay notificaciones push de Expo
 * (`expo-notifications` no funciona en web y su hook tira error). Metro usa este
 * archivo automáticamente en web en lugar de push.tsx, así ni siquiera se carga el módulo.
 */
export function Push() {
  return null;
}
