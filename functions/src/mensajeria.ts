import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

/**
 * Envío del código por WhatsApp (Cloud API de Meta) o SMS.
 * Mientras no configures los secretos, el código solo se escribe en los logs
 * (útil con el emulador). Para producción:
 *   firebase functions:secrets:set WHATSAPP_TOKEN
 *   firebase functions:secrets:set WHATSAPP_PHONE_ID
 * y aprobá una plantilla de autenticación llamada "codigo_mandadito" en Meta.
 */
export const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
export const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');

export async function enviarMensajeCodigo(telefono: string, codigo: string, canal: 'whatsapp' | 'sms') {
  let token = '';
  let phoneId = '';
  try {
    token = WHATSAPP_TOKEN.value();
    phoneId = WHATSAPP_PHONE_ID.value();
  } catch {
    /* secretos sin configurar */
  }
  if (!token || !phoneId || canal === 'sms') {
    // TODO(SMS): conectar un proveedor (Twilio, Vonage o un agregador local) aquí.
    logger.warn(`[DEV] Código para ${telefono} por ${canal}: ${codigo}`);
    return;
  }
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono.replace('+', ''),
      type: 'template',
      template: {
        name: 'codigo_mandadito',
        language: { code: 'es' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: codigo }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: codigo }] },
        ],
      },
    }),
  });
  if (!r.ok) {
    logger.error('WhatsApp falló', r.status, await r.text());
    throw new Error('No se pudo enviar el código por WhatsApp.');
  }
}
