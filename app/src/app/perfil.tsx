import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Button, Chip, ConTeclado, Field } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useCarga } from '@/data/hooks';
import { useSession } from '@/state/session';
import { color, font } from '@/theme';

export default function Perfil() {
  const { usuario, setUsuario } = useSession();
  const zonas = useCarga(() => api.zonas(), []);
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [zonaId, setZonaId] = useState(usuario?.direccion?.zonaId ?? '');
  const [referencia, setReferencia] = useState(usuario?.direccion?.referencia ?? '');
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  const refReferencia = useRef<ComponentRef<typeof TextInput>>(null);
  // Si ya tiene perfil, viene a editar su dirección (desde el carrito o inicio).
  const editando = !!usuario?.direccion;

  async function guardar() {
    setError(undefined);
    if (nombre.trim().length < 2) return setError('Escribí tu nombre.');
    const zona = zonas.data?.find((z) => z.id === zonaId);
    if (!zona) return setError('Elegí tu barrio o cantón.');
    if (referencia.trim().length < 8) return setError('Contanos cómo encontrar tu casa (punto de referencia).');
    setGuardando(true);
    try {
      const u = await api.guardarPerfil({ nombre: nombre.trim(), direccion: { zonaId: zona.id, zonaNombre: zona.nombre, referencia: referencia.trim() } });
      setUsuario(u);
      if (editando && router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
      <ConTeclado>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {editando ? <BackButton /> : <Text style={font.tiny}>Paso 2 de 2</Text>}
        <Text style={font.h1}>{editando ? 'Tu dirección de entrega' : '¿A dónde te llevamos tus pedidos?'}</Text>
        <Field
          label="Tu nombre"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Como te conocen"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => refReferencia.current?.focus()}
        />
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: color.ink2 }}>Barrio o cantón (Sociedad)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(zonas.data ?? []).map((z) => (
              <Chip key={z.id} label={z.nombre} selected={z.id === zonaId} onPress={() => setZonaId(z.id)} />
            ))}
          </View>
          <Text style={font.tiny}>Pronto: Jocoro y más municipios.</Text>
        </View>
        <Field ref={refReferencia} label="Cómo encontrar tu casa" maxLength={160} value={referencia} onChangeText={setReferencia} placeholder="Casa verde frente a la iglesia, portón negro" multiline style={{ minHeight: 84, paddingVertical: 14, fontSize: 15, textAlignVertical: 'top' }} />
        {error ? <Text style={{ color: color.danger, fontWeight: '600' }}>{error}</Text> : null}
        <View style={{ flex: 1 }} />
        <Button label={editando ? 'Guardar' : 'Empezar a pedir'} loading={guardando} onPress={guardar} />
      </ScrollView>
      </ConTeclado>
    </SafeAreaView>
  );
}
