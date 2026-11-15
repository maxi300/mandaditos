import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, ConTeclado, Empty, Icon, Notice } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useAhora, useNegocio, usePedido } from '@/data/hooks';
import { ESTADOS_FINALES, TEXTO_ESTADO, formatCents, pasoProgreso, type Pedido } from '@/shared';
import { color, font, radius } from '@/theme';

const PASOS = ['Enviado', 'Aceptado', 'En camino', 'Entregado'];
const ETIQUETAS = ['Rápido', 'Bien empacado', 'Buen trato', 'Todo completo'];

export default function SeguimientoPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedido = usePedido(id);
  const ahora = useAhora();
  const { data } = useNegocio(pedido?.negocioId);

  if (pedido === undefined) return <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} />;
  if (pedido === null)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <Empty title="No encontramos este pedido" />
        <View style={{ padding: 20 }}><Button label="Ir al inicio" onPress={() => router.replace('/inicio')} /></View>
      </SafeAreaView>
    );

  const final = ESTADOS_FINALES.includes(pedido.estado);
  const fallo = final && pedido.estado !== 'entregado';
  const paso = pasoProgreso(pedido.estado);
  const recoger = pedido.modo === 'recoger';
  const pasos = recoger ? ['Enviado', 'Aceptado', 'Listo', 'Recogido'] : PASOS;
  const restanSeg = Math.max(0, Math.round((pedido.expiraEn - ahora) / 1000));
  const aceptado = pedido.historial.find((h) => h.estado === 'preparando');
  const llegaA = aceptado && pedido.etaMin ? new Date(aceptado.en + pedido.etaMin * 60_000) : undefined;

  let titulo = TEXTO_ESTADO[pedido.estado];
  if (pedido.estado === 'listo' && recoger) titulo = 'Ya podés pasar a recogerlo';
  if (pedido.estado === 'entregado' && recoger) titulo = 'Recogido';

  async function cancelar() {
    Alert.alert(
      '¿Cancelar el pedido?',
      pedido!.estado === 'esperando_cliente' ? 'El negocio ya no lo va a preparar.' : 'El negocio todavía no lo ha aceptado.',
      [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => api.cancelarPedido(pedido!.id).catch((e) => Alert.alert('No se pudo cancelar', mensajeError(e))),
      },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={s.top}>
        <Pressable accessibilityLabel="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/inicio'))} style={s.cerrar}>
          <Icon name="close" size={22} />
        </Pressable>
        <Text style={font.small}>Pedido {pedido.codigo}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ConTeclado>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <Text style={[font.h1, fallo && { color: color.danger }]}>{titulo}</Text>
          {pedido.estado === 'pendiente' ? (
            <Text style={font.body}>
              {pedido.negocioNombre} tiene {Math.floor(restanSeg / 60)}:{String(restanSeg % 60).padStart(2, '0')} para aceptarlo.
            </Text>
          ) : null}
          {llegaA && !final ? (
            <Text style={font.body}>
              {recoger ? 'Listo' : 'Llega'} aprox. a las <Text style={{ fontWeight: '800', color: color.ink }}>{llegaA.toLocaleTimeString('es-SV', { hour: 'numeric', minute: '2-digit' })}</Text>
            </Text>
          ) : null}
        </View>

        {!fallo ? (
          <Card>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {pasos.map((_, i) => (
                <View key={i} style={[s.barra, i < paso && { backgroundColor: color.brand }]} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 }}>
              {pasos.map((t, i) => (
                <Text key={t} style={[font.tiny, i < paso && { color: color.ink }]}>{t}</Text>
              ))}
            </View>
          </Card>
        ) : (
          <Notice
            tone="danger"
            title={pedido.estado === 'rechazado' ? 'Motivo' : undefined}
            text={pedido.estado === 'rechazado' ? (pedido.motivoRechazo ?? 'Sin motivo') : pedido.estado === 'expirado' ? 'No se te cobró nada. Podés probar con otro negocio.' : TEXTO_ESTADO[pedido.estado]}
          />
        )}

        {pedido.estado === 'esperando_cliente' ? <ResponderConsulta pedido={pedido} restanSeg={restanSeg} onCancelar={cancelar} /> : null}

        {pedido.estado === 'entregado' && !pedido.calificacion ? <Calificar pedido={pedido} /> : null}
        {pedido.calificacion ? <Notice tone="success" text={`Calificaste con ${pedido.calificacion.estrellas} ★. ¡Gracias!`} /> : null}

        <Card>
          <Text style={[font.h2, { paddingBottom: 8 }]}>{pedido.negocioNombre}</Text>
          {pedido.items.map((it, i) => (
            <View key={i} style={s.item}>
              <Text style={[font.body, { flex: 1 }]}>
                {it.venta === 'dinero' ? `${formatCents(it.montoCents ?? 0)} de ${it.nombre.toLowerCase()}` : `${it.cantidad} × ${it.nombre}`}
                {it.opcionesTexto.length ? <Text style={font.small}>{`\n${it.opcionesTexto.join(' · ')}`}</Text> : null}
              </Text>
              <Text style={[font.body, { color: color.ink }]}>{formatCents(it.subtotalCents)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: color.line, marginVertical: 8 }} />
          {pedido.envioCents ? <Fila l="Envío" v={formatCents(pedido.envioCents)} /> : null}
          <Fila l="Total" v={formatCents(pedido.totalCents)} fuerte />
          <Fila
            l="Pago"
            v={pedido.pago.metodo === 'tarjeta' ? 'Tarjeta (coordinás por WhatsApp)' : pedido.pago.pagaConCents ? `Efectivo, con ${formatCents(pedido.pago.pagaConCents)} · cambio ${formatCents(pedido.pago.cambioCents ?? 0)}` : 'Efectivo exacto'}
          />
          {pedido.direccion ? <Fila l="Entrega" v={`${pedido.direccion.zonaNombre} · ${pedido.direccion.referencia}`} /> : null}
        </Card>

        {data?.negocio?.whatsapp && !final ? (
          <Button label="Escribir al negocio" icon="logo-whatsapp" variant="outline" onPress={() => Linking.openURL(`https://wa.me/${data.negocio!.whatsapp}?text=${encodeURIComponent(`Hola, sobre mi pedido ${pedido.codigo}`)}`)} />
        ) : null}
        {pedido.estado === 'pendiente' ? <Button label="Cancelar pedido" variant="ghost" onPress={cancelar} /> : null}
        {final ? <Button label="Volver al inicio" variant="dark" onPress={() => router.replace('/inicio')} /> : null}
      </ScrollView>
      </ConTeclado>
    </SafeAreaView>
  );
}

/** El negocio preguntó algo: el cliente responde y el pedido sigue, o lo cancela. */
function ResponderConsulta({ pedido, restanSeg, onCancelar }: { pedido: Pedido; restanSeg: number; onCancelar: () => void }) {
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function seguir() {
    setEnviando(true);
    try {
      await api.cambiarEstado(pedido.id, 'preparando', { motivo: respuesta.trim() || 'Sí, que siga el pedido' });
    } catch (e) {
      Alert.alert('No se pudo enviar', mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card style={{ gap: 12, borderWidth: 2, borderColor: color.info }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="chatbubble-ellipses-outline" size={20} tint={color.info} />
        <Text style={[font.h2, { flex: 1 }]}>{pedido.negocioNombre} te pregunta</Text>
      </View>
      <Text style={[font.body, { color: color.ink, fontSize: 16, lineHeight: 22 }]}>“{pedido.consulta ?? 'Necesitamos consultarte algo de tu pedido.'}”</Text>
      <TextInput
        value={respuesta}
        onChangeText={setRespuesta}
        placeholder="Tu respuesta (opcional). Ej. sí, cámbiala por revuelta"
        placeholderTextColor={color.faint}
        maxLength={110}
        multiline
        style={s.respuesta}
      />
      <Button label="Responder y seguir con el pedido" loading={enviando} onPress={seguir} />
      <Button label="Cancelar el pedido" variant="danger" disabled={enviando} onPress={onCancelar} />
      <Text style={[font.tiny, { textAlign: 'center' }]}>
        Si no respondés en {Math.floor(restanSeg / 60)}:{String(restanSeg % 60).padStart(2, '0')}, el negocio sigue con tu pedido.
      </Text>
    </Card>
  );
}

function Calificar({ pedido }: { pedido: Pedido }) {
  const [estrellas, setEstrellas] = useState(0);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  return (
    <Card style={{ gap: 12 }}>
      <Text style={font.h2}>¿Qué tal estuvo?</Text>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityLabel={`${n} estrellas`} onPress={() => setEstrellas(n)} hitSlop={6}>
            <Icon name={n <= estrellas ? 'star' : 'star-outline'} size={36} tint={n <= estrellas ? '#F59E0B' : color.faint} />
          </Pressable>
        ))}
      </View>
      {estrellas > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ETIQUETAS.map((e) => (
            <Chip key={e} label={e} selected={etiquetas.includes(e)} onPress={() => setEtiquetas((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]))} />
          ))}
        </View>
      ) : null}
      <Button
        label="Enviar calificación"
        disabled={estrellas === 0}
        loading={enviando}
        onPress={async () => {
          setEnviando(true);
          try {
            await api.calificarPedido(pedido.id, estrellas, etiquetas);
          } catch (e) {
            Alert.alert('Error', mensajeError(e));
          } finally {
            setEnviando(false);
          }
        }}
      />
    </Card>
  );
}

function Fila({ l, v, fuerte }: { l: string; v: string; fuerte?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 3 }}>
      <Text style={fuerte ? font.title : font.small}>{l}</Text>
      <Text style={[fuerte ? font.title : font.small, { flexShrink: 1, textAlign: 'right', color: color.ink }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  cerrar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  barra: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: color.border },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 5 },
  respuesta: { minHeight: 64, borderWidth: 1.5, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: color.ink, textAlignVertical: 'top' },
});
