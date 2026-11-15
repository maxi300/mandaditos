import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useSession } from '@/state/session';
import { color } from '@/theme';

/** Decide a dónde va la persona al abrir la app. */
export default function Entrada() {
  const { cargando, usuario, modo } = useSession();
  if (cargando) {
    // Mismo fondo naranja que el splash para que el paso splash → app no se vea como un “corte”.
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.brand, gap: 14 }}>
        <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bag-handle" size={40} tint="#FFFFFF" />
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>Mandadito</Text>
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} />
      </SafeAreaView>
    );
  }
  if (!usuario) return <Redirect href="/bienvenida" />;
  if (!usuario.nombre || !usuario.direccion) return <Redirect href="/perfil" />;
  if (modo === 'negocio' && usuario.negocioId) return <Redirect href="/pedidos" />;
  return <Redirect href="/inicio" />;
}
