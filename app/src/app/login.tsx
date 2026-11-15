import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/data';
import { mensajeError } from '@/data/hooks';
import { CODIGO_DEMO } from '@/data/mock';
import { BackButton, Button, ConTeclado, Notice } from '@/components/ui';
import { useSession } from '@/state/session';
import { color, font, radius } from '@/theme';

export default function Login() {
  const { setUsuario } = useSession();
  const [paso, setPaso] = useState<'telefono' | 'codigo'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [canal, setCanal] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [error, setError] = useState<string>();
  const [cargando, setCargando] = useState(false);
  const digitos = telefono.replace(/\D/g, '');
  const telValido = digitos.length === 8 && /^[67]/.test(digitos);

  async function enviar(c: 'whatsapp' | 'sms') {
    setError(undefined);
    if (!telValido) return setError('Escribí un número de celular de 8 dígitos que empiece con 6 o 7.');
    setCargando(true);
    try {
      setCanal(c);
      await api.enviarCodigo(digitos, c);
      setPaso('codigo');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  async function verificar() {
    setError(undefined);
    if (codigo.length !== 6) return setError('El código tiene 6 dígitos.');
    setCargando(true);
    try {
      const u = await api.verificarCodigo(digitos, codigo);
      setUsuario(u);
      router.replace('/');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
      <ConTeclado>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {paso === 'telefono' ? (
            <BackButton />
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Cambiar número" onPress={() => setPaso('telefono')} style={s.round}>
              <Text style={{ fontSize: 18 }}>‹</Text>
            </Pressable>
          )}
          <Text style={font.tiny}>Paso 1 de 2</Text>
        </View>

        {paso === 'telefono' ? (
          <>
            <Text style={[font.h1, { marginTop: 28 }]}>¿Cuál es tu número?</Text>
            <Text style={[font.body, { marginTop: 8, lineHeight: 22 }]}>Te mandamos un código para confirmar que sos vos. Sin contraseñas.</Text>
            <View style={s.phone}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: color.ink }}>+503</Text>
              <View style={{ width: 1, height: 24, backgroundColor: color.border }} />
              <TextInput
                value={telefono}
                onChangeText={(t) => setTelefono(t.replace(/[^\d ]/g, '').slice(0, 9))}
                placeholder="7000 0000"
                placeholderTextColor={color.faint}
                keyboardType="phone-pad"
                autoFocus
                accessibilityLabel="Número de celular"
                style={s.phoneInput}
              />
            </View>
            <View style={{ marginTop: 16 }}>
              <Notice tone="success" text="Verificamos cada número para que los negocios reciban solo pedidos reales. Solo lo ve el negocio al que le pedís." />
            </View>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button label="Recibir código por WhatsApp" icon="logo-whatsapp" loading={cargando} onPress={() => enviar('whatsapp')} />
            <Button label="Prefiero recibirlo por SMS" variant="ghost" onPress={() => enviar('sms')} style={{ marginTop: 6 }} />
          </>
        ) : (
          <>
            <Text style={[font.h1, { marginTop: 28 }]}>Escribí el código</Text>
            <Text style={[font.body, { marginTop: 8, lineHeight: 22 }]}>
              Lo enviamos por {canal === 'whatsapp' ? 'WhatsApp' : 'SMS'} al +503 {digitos.slice(0, 4)} {digitos.slice(4)}.
            </Text>
            <TextInput
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor={color.faint}
              accessibilityLabel="Código de 6 dígitos"
              style={s.code}
            />
            {api.modo === 'demo' ? <Text style={[font.small, { marginTop: 10 }]}>Modo demo: el código es {CODIGO_DEMO}.</Text> : null}
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button label="Verificar" loading={cargando} onPress={verificar} />
            <Button label="Reenviar código" variant="ghost" onPress={() => enviar(canal)} style={{ marginTop: 6 }} />
          </>
        )}
      </ScrollView>
      </ConTeclado>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: color.ink, borderRadius: radius.md, paddingHorizontal: 16, minHeight: 58, marginTop: 28 },
  phoneInput: { flex: 1, fontSize: 18, fontWeight: '600', letterSpacing: 1, color: color.ink, minHeight: 54 },
  code: { marginTop: 28, borderWidth: 2, borderColor: color.ink, borderRadius: radius.md, minHeight: 64, fontSize: 28, fontWeight: '800', letterSpacing: 12, textAlign: 'center', color: color.ink },
  error: { color: color.danger, fontSize: 14, fontWeight: '600', marginTop: 12 },
});
