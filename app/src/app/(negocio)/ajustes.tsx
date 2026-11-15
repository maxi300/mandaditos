import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Foto, Notice } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useNegocio } from '@/data/hooks';
import { formatCents } from '@/shared';
import { useSession } from '@/state/session';
import { color, font } from '@/theme';

export default function Ajustes() {
  const { usuario, setModo } = useSession();
  const { data, recargar } = useNegocio(usuario?.negocioId);
  const n = data?.negocio;
  const [abierto, setAbierto] = useState<boolean | undefined>();
  const [error, setError] = useState<string>();
  const on = abierto ?? n?.abierto ?? false;

  async function cambiar(v: boolean) {
    if (!n) return;
    setAbierto(v);
    try {
      await api.cambiarAbierto(n.id, v);
      recargar();
    } catch (e) {
      setAbierto(!v);
      setError(mensajeError(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={font.h1}>Mi negocio</Text>
        {n ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {n.fotoUrl ? <Foto src={n.fotoUrl} style={{ width: 60, height: 60, borderRadius: 14 }} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={font.h2}>{n.nombre}</Text>
                <Text style={font.small}>{n.categoria} · ★ {n.calificacion.promedio.toFixed(1)} ({n.calificacion.n})</Text>
              </View>
            </Card>
            <Card style={[s.fila, { borderColor: on ? color.success : color.border, borderWidth: 1.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={font.title}>{on ? 'Abierto: recibiendo pedidos' : 'Pausado: no recibís pedidos'}</Text>
                <Text style={font.small}>Pausalo si te saturás o vas a cerrar antes.</Text>
              </View>
              <Switch value={on} onValueChange={cambiar} trackColor={{ true: color.success, false: color.border }} thumbColor="#FFFFFF" accessibilityLabel="Negocio abierto" />
            </Card>
            {error ? <Notice tone="danger" text={error} /> : null}
            <Card style={{ gap: 6 }}>
              <Dato l="Pedido mínimo a domicilio" v={formatCents(n.pedidoMinimoCents)} />
              <Dato l="Tiempo de preparación" v={`${n.tiempoPrepMin.min}–${n.tiempoPrepMin.max} min`} />
              <Dato l="Recoger en el local" v={n.permiteRecoger ? 'Sí' : 'No'} />
              <Dato l="Acepta tarjeta" v={n.aceptaTarjeta ? 'Sí (coordina por WhatsApp)' : 'No'} />
              <Text style={[font.small, { paddingTop: 6 }]}>Envío por zona</Text>
              {Object.entries(n.envioPorZona).map(([z, c]) => (
                <Dato key={z} l={`  ${z}`} v={c ? formatCents(c) : 'Gratis'} />
              ))}
            </Card>
          </>
        ) : null}
        <Button
          variant="outline"
          label="Volver a modo cliente"
          onPress={() => {
            setModo('cliente');
            router.replace('/inicio');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Dato({ l, v }: { l: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={font.body}>{l}</Text>
      <Text style={[font.body, { color: color.ink, fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({ fila: { flexDirection: 'row', alignItems: 'center', gap: 12 } });
