import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Icon, Notice, type IconName } from '@/components/ui';
import { api } from '@/data';
import { mensajeError } from '@/data/hooks';
import { useSession } from '@/state/session';
import { color, font } from '@/theme';

export default function Cuenta() {
  const { usuario, setModo, setUsuario, salir } = useSession();

  function confirmarBorrado() {
    Alert.alert(
      '¿Eliminar tu cuenta?',
      'Se borran tu nombre, teléfono y dirección. Tus pedidos anteriores quedan sin datos personales. Esto no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: () =>
            api
              .eliminarCuenta()
              .then(() => {
                setModo('cliente');
                setUsuario(null);
                router.replace('/bienvenida');
              })
              .catch((e) => Alert.alert('No se pudo eliminar', mensajeError(e))),
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 4 }}>
          <View style={s.avatar}>
            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800' }}>{(usuario?.nombre ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={font.h2}>{usuario?.nombre ?? 'Sin nombre'}</Text>
            <Text style={font.small}>{usuario?.telefono}</Text>
          </View>
        </View>

        {usuario?.negocioId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setModo('negocio');
              router.replace('/pedidos');
            }}
            style={s.negocio}>
            <Icon name="storefront" size={24} tint="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Cambiar a mi negocio</Text>
              <Text style={{ color: '#FFFFFFCC', fontSize: 13 }}>Recibir pedidos y manejar el catálogo</Text>
            </View>
            <Icon name="chevron-forward" size={20} tint="#FFFFFF" />
          </Pressable>
        ) : (
          <Card>
            <Text style={font.title}>¿Tenés un negocio en Sociedad?</Text>
            <Text style={[font.small, { paddingTop: 4 }]}>Registralo gratis y recibí pedidos. Escribinos y te ayudamos a subir tu catálogo.</Text>
          </Card>
        )}

        <Card style={{ paddingVertical: 4 }}>
          <Opcion icon="location-outline" label="Mi dirección" detalle={usuario?.direccion ? `${usuario.direccion.zonaNombre} · ${usuario.direccion.referencia}` : 'Sin configurar'} onPress={() => router.push('/perfil')} />
          <Opcion icon="logo-whatsapp" label="Ayuda por WhatsApp" onPress={() => Alert.alert('Ayuda', 'Aquí va el WhatsApp de soporte de Mandadito.')} />
          <Opcion icon="log-out-outline" label="Cerrar sesión" peligro onPress={() => salir().then(() => router.replace('/bienvenida'))} />
        </Card>

        <Pressable accessibilityRole="button" onPress={confirmarBorrado} style={{ alignSelf: 'center', padding: 12 }}>
          <Text style={{ color: color.danger, fontWeight: '600', fontSize: 14 }}>Eliminar mi cuenta</Text>
        </Pressable>

        {api.modo === 'demo' ? <Notice tone="info" title="Modo demo" text="Los datos son de prueba y se borran al cerrar la app. Configurá Firebase en .env para usar datos reales." /> : null}
        <Text style={[font.tiny, { textAlign: 'center' }]}>Mandadito · Sociedad, Morazán</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Opcion({ icon, label, detalle, onPress, peligro }: { icon: IconName; label: string; detalle?: string; onPress: () => void; peligro?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.opcion}>
      <Icon name={icon} size={22} tint={peligro ? color.danger : color.ink2} />
      <View style={{ flex: 1 }}>
        <Text style={[font.title, peligro && { color: color.danger }]}>{label}</Text>
        {detalle ? <Text style={font.small} numberOfLines={1}>{detalle}</Text> : null}
      </View>
      {!peligro ? <Icon name="chevron-forward" size={18} tint={color.faint} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  negocio: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: color.ink, borderRadius: 18, padding: 18 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, borderBottomWidth: 1, borderBottomColor: color.line },
});
