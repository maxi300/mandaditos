import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Foto, Notice } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useNegocio } from '@/data/hooks';
import { formatCents, textoRinde, type Producto } from '@/shared';
import { useSession } from '@/state/session';
import { color, font, radius } from '@/theme';

export default function Catalogo() {
  const { usuario } = useSession();
  const { data, recargar } = useNegocio(usuario?.negocioId);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string>();
  const [local, setLocal] = useState<Record<string, boolean>>({});

  const secciones = useMemo(() => {
    const m = new Map<string, Producto[]>();
    for (const p of data?.productos ?? []) {
      if (q && !p.nombre.toLowerCase().includes(q.toLowerCase())) continue;
      m.set(p.seccion, [...(m.get(p.seccion) ?? []), p]);
    }
    return [...m.entries()];
  }, [data, q]);
  const agotados = (data?.productos ?? []).filter((p) => !(local[p.id] ?? p.disponible)).length;

  async function cambiar(p: Producto, v: boolean) {
    setLocal((x) => ({ ...x, [p.id]: v }));
    try {
      await api.cambiarDisponible(p.id, v);
    } catch (e) {
      setLocal((x) => ({ ...x, [p.id]: !v }));
      setError(mensajeError(e));
    }
    recargar();
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={font.h1}>Catálogo</Text>
        <Text style={font.small}>{data?.productos.length ?? 0} productos · {agotados} agotados. Apagá lo que se te acabó y deja de aparecer al instante.</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar producto" placeholderTextColor={color.faint} style={s.buscar} />
        {error ? <Notice tone="danger" text={error} /> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}>
        {secciones.map(([sec, ps]) => (
          <View key={sec} style={{ gap: 8 }}>
            <Text style={[font.tiny, { textTransform: 'uppercase', letterSpacing: 0.6 }]}>{sec}</Text>
            <View style={s.grupo}>
              {ps.map((p, i) => {
                const on = local[p.id] ?? p.disponible;
                return (
                  <View key={p.id} style={[s.fila, i > 0 && { borderTopWidth: 1, borderTopColor: color.line }]}>
                    {p.fotoUrl ? <Foto src={p.fotoUrl} style={s.foto} /> : <View style={[s.foto, { backgroundColor: color.bg }]} />}
                    <View style={{ flex: 1, opacity: on ? 1 : 0.5 }}>
                      <Text style={font.title} numberOfLines={1}>{p.nombre}</Text>
                      <Text style={font.small}>{p.venta === 'dinero' ? `Por dinero · ${textoRinde(p)}` : formatCents(p.precioCents ?? 0)}</Text>
                    </View>
                    <Switch value={on} onValueChange={(v) => cambiar(p, v)} trackColor={{ true: color.success, false: color.border }} thumbColor="#FFFFFF" accessibilityLabel={`${p.nombre} disponible`} />
                  </View>
                );
              })}
            </View>
          </View>
        ))}
        <Notice tone="info" title="¿Muchos productos?" text="Pronto: subir el catálogo desde Excel o conectarlo con tu sistema de inventario (ver API para negocios)." />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  buscar: { height: 48, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, paddingHorizontal: 16, fontSize: 15, color: color.ink },
  grupo: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#EFEAE4', paddingHorizontal: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  foto: { width: 44, height: 44, borderRadius: 10 },
});
