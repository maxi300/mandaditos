import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Foto, Icon } from '@/components/ui';
import { color, font, radius } from '@/theme';

export default function Bienvenida() {
  const { height } = useWindowDimensions();
  // El mosaico ocupa como mucho ~45% de la pantalla para que el botón nunca quede cortado.
  const altoMosaico = Math.min(380, Math.max(200, height * 0.45));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: color.surface }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={[s.mosaico, { height: altoMosaico }]}>
          <View style={{ flex: 1 }}>
            <Foto src="demo:pupusas" style={s.foto} alt="Pupusas" />
            <View style={s.pill}><View style={s.dot} /><Text style={s.pillText}>Pupusas · 20 min</Text></View>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <Foto src="demo:farmacia" style={[s.foto, { flex: 1 }]} alt="Medicinas" />
            <Foto src="demo:tienda" style={[s.foto, { flex: 1 }]} alt="Verduras" />
          </View>
        </View>
        <View style={s.body}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.logo}><Icon name="bag-handle" size={17} tint="#FFFFFF" /></View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: color.ink }}>Mandadito</Text>
            <Text style={[font.tiny, { marginLeft: 'auto' }]}>Sociedad, Morazán</Text>
          </View>
          <Text style={s.titulo}>Lo de tu pueblo,{'\n'}a un toque.</Text>
          <Text style={[font.body, { lineHeight: 22 }]}>Pedí comida, medicinas o el mandado y pagá al recibir.</Text>
          <View style={{ flex: 1, minHeight: 16 }} />
          <Button label="Continuar con mi número" onPress={() => router.push('/login')} />
          <Text style={[font.tiny, { textAlign: 'center' }]}>Al continuar aceptás los Términos y la Política de privacidad.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  mosaico: { flexDirection: 'row', gap: 10, padding: 12 },
  foto: { width: '100%', height: '100%', borderRadius: 24 },
  pill: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  pillText: { fontSize: 12, fontWeight: '700', color: color.ink },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 12 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -1, color: color.ink, marginTop: 6 },
});
