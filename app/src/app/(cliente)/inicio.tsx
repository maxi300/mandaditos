import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilaNegocio } from '@/components/FilaNegocio';
import { Foto, Icon, SectionTitle } from '@/components/ui';
import { api } from '@/data';
import { useCarga } from '@/data/hooks';
import { formatCents, formatCentsCorto, ESTADOS_FINALES, TEXTO_ESTADO, type Pedido, type Vertical } from '@/shared';
import { useSession } from '@/state/session';
import { color, font, radius } from '@/theme';

const SECCIONES: { vertical: Vertical; titulo: string; sub: string; foto: string }[] = [
  { vertical: 'restaurante', titulo: 'Restaurantes', sub: 'Pupuserías, comedores', foto: 'demo:pupusas' },
  { vertical: 'mercado', titulo: 'Mercado', sub: 'Tiendas y ferretería', foto: 'demo:tienda' },
  { vertical: 'farmacia', titulo: 'Farmacia', sub: 'Con o sin receta', foto: 'demo:farmacia' },
];

export default function Inicio() {
  const { usuario } = useSession();
  const datos = useCarga(async () => {
    const [negocios, top] = await Promise.all([api.negocios(), api.masPedidosHoy()]);
    return { negocios, top };
  }, []);
  const [activo, setActivo] = useState<Pedido | null>(null);
  useEffect(() => api.observarMisPedidos((ps) => setActivo(ps.find((p) => !ESTADOS_FINALES.includes(p.estado)) ?? null)), []);

  const cerca = useMemo(() => {
    const zona = usuario?.direccion?.zonaId ?? '';
    return (datos.data?.negocios ?? []).filter((n) => n.envioPorZona[zona] != null).sort((a, b) => Number(b.abierto) - Number(a.abierto));
  }, [datos.data, usuario]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={datos.cargando} onRefresh={datos.recargar} />} contentContainerStyle={{ paddingBottom: activo ? 100 : 24 }}>
        <View style={s.top}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/perfil')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.pin}><Icon name="location" size={20} tint={color.brand} /></View>
            <View>
              <Text style={font.tiny}>Entregar en</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink }}>{usuario?.direccion?.zonaNombre ?? 'Elegí tu dirección'} ▾</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.grid}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/seccion/[vertical]', params: { vertical: 'restaurante' } })} style={[s.tile, { flex: 1, height: 234 }]}>
            <Foto src={SECCIONES[0].foto} style={StyleSheet.absoluteFill} alt="" />
            <View style={s.tileShade} />
            <Text style={s.tileTitle}>{SECCIONES[0].titulo}</Text>
            <Text style={s.tileSub}>{SECCIONES[0].sub}</Text>
          </Pressable>
          <View style={{ flex: 1, gap: 10 }}>
            {SECCIONES.slice(1).map((sec) => (
              <Pressable key={sec.vertical} accessibilityRole="button" onPress={() => router.push({ pathname: '/seccion/[vertical]', params: { vertical: sec.vertical } })} style={[s.tile, { height: 112 }]}>
                <Foto src={sec.foto} style={StyleSheet.absoluteFill} alt="" />
                <View style={s.tileShade} />
                <Text style={s.tileTitle}>{sec.titulo}</Text>
                <Text style={s.tileSub}>{sec.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {datos.data?.top.length ? <SectionTitle right={<Text style={font.tiny}>en Sociedad</Text>}>Lo más pedido hoy</SectionTitle> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
          {(datos.data?.top ?? []).map(({ producto, negocio }, i) => (
            <Pressable key={producto.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/negocio/[id]', params: { id: negocio.id } })} style={s.topCard}>
              <View>
                <Foto src={producto.fotoUrl ?? negocio.fotoUrl} style={{ width: '100%', height: 104 }} alt={producto.nombre} />
                <Text style={s.rank}>#{i + 1}</Text>
              </View>
              <View style={{ padding: 10, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: color.ink }} numberOfLines={1}>{producto.nombre}</Text>
                <Text style={font.tiny} numberOfLines={1}>{negocio.nombre}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: color.ink }}>
                  {producto.venta === 'dinero' ? `${formatCentsCorto(100)} ≈ ${producto.dinero?.rindePorDolar}` : formatCents(producto.precioCents ?? 0)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <SectionTitle>Cerca de vos</SectionTitle>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {datos.error ? <Text style={{ color: color.danger }}>{datos.error}</Text> : null}
          {cerca.map((n) => <FilaNegocio key={n.id} negocio={n} zonaId={usuario?.direccion?.zonaId ?? ''} />)}
          {!datos.cargando && cerca.length === 0 ? <Text style={font.small}>Todavía no hay negocios que entreguen en tu zona.</Text> : null}
        </View>
      </ScrollView>

      {activo ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: activo.id } })} style={s.activo}>
          <Icon name="time" size={22} tint="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{TEXTO_ESTADO[activo.estado]}</Text>
            <Text style={{ color: '#D6D3D1', fontSize: 12 }} numberOfLines={1}>{activo.negocioNombre} · {activo.codigo}</Text>
          </View>
          <Icon name="chevron-forward" size={18} tint="#FFFFFF" />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  top: { backgroundColor: color.surface, paddingHorizontal: 20, paddingVertical: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  pin: { width: 40, height: 40, borderRadius: 12, backgroundColor: color.brandTint, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  tile: { borderRadius: 22, overflow: 'hidden', padding: 14, backgroundColor: color.line },
  tileShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.28)' },
  tileTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  tileSub: { color: '#F5F5F4', fontSize: 12, fontWeight: '600' },
  topCard: { width: 150, backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden' },
  rank: { position: 'absolute', top: 8, left: 8, backgroundColor: color.ink, color: '#FFFFFF', fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  activo: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.ink, borderRadius: 18, padding: 14 },
});
