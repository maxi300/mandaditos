import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Empty } from '@/components/ui';
import { api } from '@/data';
import { ESTADOS_FINALES, TEXTO_ESTADO, formatCents, type Pedido } from '@/shared';
import { color, font, radius } from '@/theme';

export default function Actividad() {
  const [pedidos, setPedidos] = useState<Pedido[] | undefined>();
  useEffect(() => api.observarMisPedidos(setPedidos), []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <Text style={[font.h1, { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }]}>Mis pedidos</Text>
      <FlatList
        data={pedidos ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        ListEmptyComponent={pedidos ? <Empty title="Todavía no has pedido nada" text="Cuando hagás un pedido lo vas a ver aquí." /> : undefined}
        renderItem={({ item: p }) => {
          const activo = !ESTADOS_FINALES.includes(p.estado);
          const tono = activo ? 'brand' : p.estado === 'entregado' ? 'success' : 'danger';
          return (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: p.id } })} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={font.title}>{p.negocioNombre}</Text>
                <Badge label={activo ? 'En curso' : p.estado === 'entregado' ? 'Entregado' : 'No completado'} tone={tono} />
              </View>
              <Text style={font.small} numberOfLines={1}>
                {p.items.map((i) => (i.venta === 'dinero' ? i.nombre : `${i.cantidad}× ${i.nombre}`)).join(', ')}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={font.small}>{new Date(p.creadoEn).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })} · {p.codigo}{activo ? ` · ${TEXTO_ESTADO[p.estado]}` : ''}</Text>
                <Text style={[font.title, { fontSize: 15 }]}>{formatCents(p.totalCents)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: 16, gap: 6, borderWidth: 1, borderColor: '#EFEAE4' },
});
