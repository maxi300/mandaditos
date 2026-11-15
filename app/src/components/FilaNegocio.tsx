import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Foto } from '@/components/ui';
import { formatCents, type Negocio } from '@/shared';
import { color, font, radius } from '@/theme';

export function FilaNegocio({ negocio, zonaId }: { negocio: Negocio; zonaId: string }) {
  const envio = negocio.envioPorZona[zonaId];
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/negocio/[id]', params: { id: negocio.id } })} style={s.fila}>
      <Foto src={negocio.fotoUrl} style={[s.foto, !negocio.abierto && { opacity: 0.45 }]} alt="" />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={s.nombre} numberOfLines={1}>{negocio.nombre}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: color.ink }}>★ {negocio.calificacion.promedio.toFixed(1)}</Text>
        </View>
        <Text style={font.tiny} numberOfLines={1}>
          {negocio.abierto
            ? `${negocio.categoria} · ${negocio.tiempoPrepMin.min}–${negocio.tiempoPrepMin.max} min · Envío ${envio != null ? formatCents(envio) : 'no llega a tu zona'}`
            : 'Cerrado ahora'}
        </Text>
        {negocio.promo && negocio.abierto ? <Text style={{ fontSize: 12, fontWeight: '700', color: color.brandDark }}>{negocio.promo}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surface, borderRadius: radius.lg, padding: 10 },
  foto: { width: 64, height: 64, borderRadius: 14 },
  nombre: { fontSize: 15, fontWeight: '800', color: color.ink, flexShrink: 1 },
});
