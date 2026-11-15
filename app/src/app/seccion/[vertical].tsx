import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilaNegocio } from '@/components/FilaNegocio';
import { Chip, Header } from '@/components/ui';
import { api } from '@/data';
import { useCarga } from '@/data/hooks';
import type { Vertical } from '@/shared';
import { useSession } from '@/state/session';
import { color, font } from '@/theme';


const TITULOS: Record<Vertical, string> = { restaurante: 'Restaurantes', mercado: 'Mercado', farmacia: 'Farmacias', servicio: 'Servicios' };

export default function Seccion() {
  const { vertical } = useLocalSearchParams<{ vertical: Vertical }>();
  const { usuario } = useSession();
  const datos = useCarga(() => api.negocios(), []);
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [tarjeta, setTarjeta] = useState(false);

  const lista = useMemo(
    () =>
      (datos.data ?? [])
        .filter((n) => n.vertical === vertical)
        .filter((n) => !soloAbiertos || n.abierto)
        .filter((n) => !tarjeta || n.aceptaTarjeta)
        .sort((a, b) => Number(b.abierto) - Number(a.abierto)),
    [datos.data, vertical, soloAbiertos, tarjeta],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <Header title={TITULOS[vertical] ?? 'Negocios'} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: color.surface }}>
        <Chip label="Abierto ahora" selected={soloAbiertos} onPress={() => setSoloAbiertos((v) => !v)} />
        <Chip label="Acepta tarjeta" selected={tarjeta} onPress={() => setTarjeta((v) => !v)} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {lista.map((n) => <FilaNegocio key={n.id} negocio={n} zonaId={usuario?.direccion?.zonaId ?? ''} />)}
        {!datos.cargando && lista.length === 0 ? <Text style={[font.small, { textAlign: 'center', padding: 24 }]}>Nada con esos filtros. Probá quitar uno.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
