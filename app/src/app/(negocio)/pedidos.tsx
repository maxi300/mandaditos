import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Chip, Empty, Icon, Segmented } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useAhora } from '@/data/hooks';
import { ESTADOS_FINALES, formatCents, type EstadoPedido, type Pedido } from '@/shared';
import { useSession } from '@/state/session';
import { color, font, radius } from '@/theme';

const ETAS = [10, 15, 25, 40];
const MOTIVOS = ['Se nos acabó un producto', 'Ya vamos a cerrar', 'No llegamos a esa zona', 'Mucha demanda ahorita'];
const CONSULTAS = ['Se acabó un producto, ¿te lo cambio por otro parecido?', 'Subió el precio de un producto, ¿seguimos?', '¿Me confirmás la dirección?'];
const SONIDO_NUEVO = require('../../../assets/sounds/nuevo-pedido.wav');

type Vista = 'nuevos' | 'curso' | 'hoy';

export default function PedidosNegocio() {
  const { usuario } = useSession();
  const negocioId = usuario?.negocioId;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vista, setVista] = useState<Vista>('nuevos');
  const [rechazando, setRechazando] = useState<Pedido | null>(null);
  const [consultando, setConsultando] = useState<Pedido | null>(null);
  const sonido = useAudioPlayer(SONIDO_NUEVO);

  // Que suene aunque el iPhone esté en silencio: es un aviso de trabajo, no música.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  const ahora = useAhora();

  useEffect(() => (negocioId ? api.observarPedidosNegocio(negocioId, setPedidos) : undefined), [negocioId]);

  const grupos = useMemo(() => {
    // Nuevos: el que está por expirar primero. En curso: el más viejo primero. Terminados: el más reciente primero.
    const nuevos = pedidos.filter((p) => p.estado === 'pendiente').sort((a, b) => a.expiraEn - b.expiraEn);
    const curso = pedidos.filter((p) => !ESTADOS_FINALES.includes(p.estado) && p.estado !== 'pendiente').sort((a, b) => a.creadoEn - b.creadoEn);
    const hoy = pedidos.filter((p) => ESTADOS_FINALES.includes(p.estado)).sort((a, b) => b.creadoEn - a.creadoEn);
    return { nuevos, curso, hoy };
  }, [pedidos]);
  // Aviso cuando entra un pedido nuevo: vibra y salta a la pestaña “Nuevos”.
  const vistos = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = grupos.nuevos.map((p) => p.id);
    if (vistos.current === null) {
      vistos.current = new Set(ids); // primera carga: no avisar por los que ya estaban
      return;
    }
    const hayNuevo = ids.some((id) => !vistos.current!.has(id));
    ids.forEach((id) => vistos.current!.add(id));
    if (hayNuevo) {
      Vibration.vibrate([0, 400, 200, 400]);
      sonido.seekTo(0).then(() => sonido.play()).catch(() => {});
      setVista('nuevos');
    }
  }, [grupos.nuevos, sonido]);

  const vendidoHoy = grupos.hoy.filter((p) => p.estado === 'entregado').reduce((a, p) => a + p.totalCents, 0);

  async function mover(p: Pedido, hacia: EstadoPedido, datos?: { etaMin?: number; motivo?: string }) {
    try {
      await api.cambiarEstado(p.id, hacia, datos);
    } catch (e) {
      Alert.alert('No se pudo actualizar', mensajeError(e));
    }
  }

  const lista = grupos[vista];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={font.h1}>Pedidos</Text>
          <Text style={font.small}>Entregado hoy: <Text style={{ fontWeight: '800', color: color.ink }}>{formatCents(vendidoHoy)}</Text></Text>
        </View>
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: 'nuevos', label: `Nuevos${grupos.nuevos.length ? ` (${grupos.nuevos.length})` : ''}` },
            { value: 'curso', label: `En curso${grupos.curso.length ? ` (${grupos.curso.length})` : ''}` },
            { value: 'hoy', label: 'Terminados' },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12, flexGrow: 1 }}>
        {lista.length === 0 ? (
          <Empty title={vista === 'nuevos' ? 'Sin pedidos nuevos' : vista === 'curso' ? 'Nada en preparación' : 'Aún no hay pedidos terminados'} text={vista === 'nuevos' ? 'Cuando entre uno, suena, vibra y aparece aquí. Tenés 5 minutos para aceptarlo.' : undefined} />
        ) : null}
        {lista.map((p) => (
          <TarjetaPedido key={p.id} p={p} ahora={ahora} onMover={mover} onRechazar={() => setRechazando(p)} onConsultar={() => setConsultando(p)} />
        ))}
      </ScrollView>
      <MotivoModal
        key={`r-${rechazando?.id ?? 'cerrado'}`} // se reinicia (motivo y texto) para cada pedido
        visible={!!rechazando}
        titulo="¿Por qué no podés aceptarlo?"
        ayuda="El cliente ve este motivo."
        opciones={MOTIVOS}
        placeholder="Otro motivo…"
        boton="Rechazar pedido"
        variante="danger"
        onClose={() => setRechazando(null)}
        onConfirm={(motivo) => {
          if (rechazando) mover(rechazando, 'rechazado', { motivo });
          setRechazando(null);
        }}
      />
      <MotivoModal
        key={`c-${consultando?.id ?? 'cerrado'}`}
        visible={!!consultando}
        titulo="¿Qué le querés consultar?"
        ayuda="Le aparece al cliente en la app. Tiene 10 minutos para responder; si no responde, el pedido sigue igual."
        opciones={CONSULTAS}
        placeholder="Escribí tu pregunta…"
        boton="Enviar consulta"
        variante="dark"
        onClose={() => setConsultando(null)}
        onConfirm={(motivo) => {
          if (consultando) mover(consultando, 'esperando_cliente', { motivo });
          setConsultando(null);
        }}
      />
    </SafeAreaView>
  );
}

function TarjetaPedido({
  p,
  ahora,
  onMover,
  onRechazar,
  onConsultar,
}: {
  p: Pedido;
  ahora: number;
  onMover: (p: Pedido, h: EstadoPedido, d?: { etaMin?: number }) => Promise<void>;
  onRechazar: () => void;
  onConsultar: () => void;
}) {
  const [eta, setEta] = useState(15);
  const [ocupado, setOcupado] = useState(false);
  const restan = Math.max(0, Math.round((p.expiraEn - ahora) / 1000));
  const urgente = restan < 90;
  const recoger = p.modo === 'recoger';
  const haceMin = Math.max(0, Math.floor((ahora - p.creadoEn) / 60_000));
  const tel = p.clienteTelefono.replace(/\D/g, '');
  // Cómo terminó la última consulta (respuesta del cliente o que no contestó).
  const ultimo = p.historial[p.historial.length - 1];
  const respuesta = p.consulta && p.estado === 'preparando' && ultimo?.estado === 'preparando' && ultimo.rol !== 'negocio' ? ultimo : undefined;

  // Evita doble toque mientras se guarda el cambio.
  async function mover(hacia: EstadoPedido, datos?: { etaMin?: number }) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await onMover(p, hacia, datos);
    } finally {
      setOcupado(false);
    }
  }

  function confirmar(titulo: string, texto: string, hacia: EstadoPedido) {
    Alert.alert(titulo, texto, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: hacia === 'no_entregado' ? 'destructive' : 'default', onPress: () => mover(hacia) },
    ]);
  }

  return (
    <View style={[s.card, p.estado === 'pendiente' && { borderColor: color.brand, borderWidth: 2 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={font.h2} numberOfLines={1}>{p.codigo} · {p.clienteNombre}</Text>
          <Text style={font.tiny}>{haceMin === 0 ? 'Recién entró' : `Hace ${haceMin} min`}</Text>
          <Text style={font.small}>{recoger ? 'Recoge en el local' : `${p.direccion?.zonaNombre} · ${p.direccion?.referencia}`}</Text>
        </View>
        {p.estado === 'pendiente' ? (
          <Badge label={`${Math.floor(restan / 60)}:${String(restan % 60).padStart(2, '0')}`} tone={urgente ? 'danger' : 'warn'} />
        ) : (
          <Badge label={etiquetaEstado(p.estado, recoger)} tone={p.estado === 'entregado' ? 'success' : ESTADOS_FINALES.includes(p.estado) ? 'danger' : 'info'} />
        )}
      </View>

      <View style={{ gap: 4, paddingVertical: 4 }}>
        {p.items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ fontWeight: '800', color: color.brand, minWidth: 44 }}>{it.venta === 'dinero' ? formatCents(it.montoCents ?? 0) : `${it.cantidad}×`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={font.title}>{it.nombre}</Text>
              {it.opcionesTexto.length ? <Text style={font.small}>{it.opcionesTexto.join(' · ')}</Text> : null}
              {it.nota ? <Text style={[font.small, { color: color.warn }]}>Nota: {it.nota}</Text> : null}
              {it.venta === 'dinero' || it.siNoHay !== 'parecido' ? <Text style={font.tiny}>Si no hay: {it.siNoHay === 'avisar' ? 'avisarle' : it.siNoHay === 'quitar' ? 'quitarlo' : 'algo parecido'}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <View style={s.totales}>
        <Text style={font.title}>Cobrar {formatCents(p.totalCents)}</Text>
        <Text style={font.small}>
          {p.pago.metodo === 'tarjeta' ? 'Tarjeta: coordinar por WhatsApp' : p.pago.pagaConCents ? `Paga con ${formatCents(p.pago.pagaConCents)} → cambio ${formatCents(p.pago.cambioCents ?? 0)}` : 'Efectivo exacto'}
        </Text>
      </View>

      {p.estado === 'pendiente' ? (
        <View style={{ gap: 10 }}>
          <Text style={font.small}>¿En cuánto está {recoger ? 'listo' : 'entregado'}?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ETAS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={eta === m} onPress={() => setEta(m)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} variant="outline" label="Rechazar" disabled={ocupado} onPress={onRechazar} />
            <Button style={{ flex: 2 }} label={`Aceptar · ${eta} min`} loading={ocupado} onPress={() => mover('preparando', { etaMin: eta })} />
          </View>
        </View>
      ) : null}

      {!ESTADOS_FINALES.includes(p.estado) && p.estado !== 'pendiente' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable accessibilityLabel="Escribirle al cliente por WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${tel.length === 8 ? `503${tel}` : tel}`)} style={s.wa}>
            <Icon name="logo-whatsapp" size={22} tint={color.success} />
          </Pressable>
          <Pressable accessibilityLabel="Llamar al cliente" onPress={() => Linking.openURL(`tel:${tel}`)} style={s.wa}>
            <Icon name="call-outline" size={22} tint={color.ink} />
          </Pressable>
          {p.estado === 'preparando' ? (
            recoger ? (
              <Button style={{ flex: 1 }} variant="dark" label="Listo para recoger" loading={ocupado} onPress={() => mover('listo')} />
            ) : (
              <Button style={{ flex: 1 }} variant="dark" label="Salió a entregar" loading={ocupado} onPress={() => mover('en_camino')} />
            )
          ) : null}
          {p.estado === 'esperando_cliente' ? <Text style={[font.small, { flex: 1, alignSelf: 'center' }]}>Esperando respuesta… {Math.floor(restan / 60)}:{String(restan % 60).padStart(2, '0')}</Text> : null}
        </View>
      ) : null}
      {p.estado === 'esperando_cliente' && p.consulta ? (
        <View style={s.consulta}>
          <Text style={font.tiny}>Le preguntaste</Text>
          <Text style={font.body}>“{p.consulta}”</Text>
        </View>
      ) : null}
      {respuesta ? (
        <View style={[s.consulta, { backgroundColor: respuesta.rol === 'cliente' ? color.successTint : color.warnTint }]}>
          <Text style={font.tiny}>{respuesta.rol === 'cliente' ? 'El cliente respondió' : 'Sin respuesta'}</Text>
          <Text style={font.body}>{respuesta.nota ?? 'Que siga el pedido'}</Text>
        </View>
      ) : null}
      {p.estado === 'preparando' ? <Button variant="ghost" icon="help-circle-outline" label="Consultarle algo al cliente" disabled={ocupado} onPress={onConsultar} /> : null}
      {p.estado === 'listo' || p.estado === 'en_camino' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Solo se puede marcar “no entregado” cuando ya salió (regla de orderState). */}
          {p.estado === 'en_camino' ? (
            <Button style={{ flex: 1 }} variant="danger" label="No se entregó" disabled={ocupado} onPress={() => confirmar('¿No se pudo entregar?', 'El pedido se cierra como no entregado.', 'no_entregado')} />
          ) : null}
          <Button
            style={{ flex: 2 }}
            label={recoger ? 'Ya lo recogió' : 'Entregado y cobrado'}
            loading={ocupado}
            onPress={() => confirmar(recoger ? '¿Ya lo recogió?' : '¿Entregado y cobrado?', `Confirmá que recibiste ${formatCents(p.totalCents)}.`, 'entregado')}
          />
        </View>
      ) : null}
      {p.estado === 'rechazado' && p.motivoRechazo ? <Text style={font.small}>Motivo: {p.motivoRechazo}</Text> : null}
    </View>
  );
}

function etiquetaEstado(e: EstadoPedido, recoger: boolean) {
  const t: Partial<Record<EstadoPedido, string>> = {
    preparando: 'Preparando',
    esperando_cliente: 'Consultando',
    listo: recoger ? 'Listo' : 'Listo',
    en_camino: 'En camino',
    entregado: 'Entregado',
    rechazado: 'Rechazado',
    cancelado_cliente: 'Cancelado',
    expirado: 'Expiró',
    no_entregado: 'No entregado',
  };
  return t[e] ?? e;
}

function MotivoModal({
  visible,
  titulo,
  ayuda,
  opciones,
  placeholder,
  boton,
  variante,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  titulo: string;
  ayuda: string;
  opciones: string[];
  placeholder: string;
  boton: string;
  variante: 'danger' | 'dark';
  onClose: () => void;
  onConfirm: (m: string) => void;
}) {
  const [motivo, setMotivo] = useState(opciones[0]);
  const [otro, setOtro] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={s.fondo} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[s.hoja, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={font.h2}>{titulo}</Text>
          <Text style={font.small}>{ayuda}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {opciones.map((m) => (
              <Chip key={m} label={m} selected={motivo === m && !otro} onPress={() => { setMotivo(m); setOtro(''); }} />
            ))}
          </View>
          <TextInput value={otro} onChangeText={setOtro} placeholder={placeholder} placeholderTextColor={color.faint} maxLength={110} returnKeyType="done" style={s.input} />
          <Button variant={variante} label={boton} onPress={() => onConfirm(otro.trim() || motivo)} />
          <Button variant="ghost" label="Volver" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: '#EFEAE4' },
  totales: { backgroundColor: color.bg, borderRadius: radius.md, padding: 12, gap: 2 },
  wa: { width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  fondo: { flex: 1, backgroundColor: '#0006' },
  hoja: { backgroundColor: color.surface, padding: 20, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  consulta: { backgroundColor: color.infoTint, borderRadius: radius.md, padding: 12, gap: 2 },
  input: { minHeight: 50, borderWidth: 1.5, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 15, color: color.ink },
});
