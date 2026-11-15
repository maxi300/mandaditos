import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Chip, ConTeclado, Empty, Foto, Icon, Radio } from '@/components/ui';
import { useNegocio } from '@/data/hooks';
import { construirItem, formatCents, formatCentsCorto, type GrupoOpciones, type LineaCarrito, type Producto, type SiNoHay } from '@/shared';
import { useCart } from '@/state/cart';
import { color, font, radius } from '@/theme';

const SI_NO_HAY: { v: SiNoHay; t: string }[] = [
  { v: 'parecido', t: 'Que escojan algo parecido' },
  { v: 'avisar', t: 'Que me escriban antes' },
  { v: 'quitar', t: 'Quitarlo del pedido' },
];

export default function DetalleProducto() {
  const { id, negocioId } = useLocalSearchParams<{ id: string; negocioId: string }>();
  const { data } = useNegocio(negocioId);
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const producto = data?.productos.find((p) => p.id === id);
  const esMercado = data?.negocio?.vertical === 'mercado';
  const yaEnPedido = cart.lineas.filter((l) => l.productoId === id);

  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [cantidad, setCantidad] = useState(1);
  const [monto, setMonto] = useState(100);
  const [nota, setNota] = useState('');
  const [siNoHay, setSiNoHay] = useState<SiNoHay>('parecido');

  const calculo = useMemo(() => {
    if (!producto) return null;
    try {
      const item = construirItem(producto, { lineaId: 'x', productoId: producto.id, cantidad, montoCents: monto, opciones: elegidas });
      return { total: item.subtotalCents, error: undefined };
    } catch (e) {
      return { total: undefined, error: (e as Error).message };
    }
  }, [producto, cantidad, monto, elegidas]);

  if (!producto) return <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>{data ? <Empty title="Producto no disponible" /> : null}</SafeAreaView>;

  function tocar(g: GrupoOpciones, opcionId: string) {
    setElegidas((prev) => {
      const actual = prev[g.id] ?? [];
      if (g.max === 1) return { ...prev, [g.id]: [opcionId] };
      if (actual.includes(opcionId)) return { ...prev, [g.id]: actual.filter((x) => x !== opcionId) };
      if (actual.length >= g.max) return prev;
      return { ...prev, [g.id]: [...actual, opcionId] };
    });
  }

  function agregar() {
    if (!producto || calculo?.error) return;
    const ok = cart.agregarLinea(producto, {
      cantidad: producto.venta === 'unidad' ? cantidad : undefined,
      montoCents: producto.venta === 'dinero' ? monto : undefined,
      opciones: Object.keys(elegidas).length ? elegidas : undefined,
      nota: nota.trim() || undefined,
      siNoHay,
    });
    if (ok) router.back();
  }

  const reglas = producto.dinero;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: color.surface }}>
      <ConTeclado>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {producto.fotoUrl ? <Foto src={producto.fotoUrl} style={{ width: '100%', height: 220 }} alt={producto.nombre} /> : <View style={{ height: Platform.OS === 'ios' ? 64 : insets.top + 60 }} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={[s.cerrar, Platform.OS !== 'ios' && { top: insets.top + 8 }]}>
          <Icon name="close" size={20} />
        </Pressable>
        <View style={{ padding: 20, gap: 20 }}>
          <View style={{ gap: 6 }}>
            <Text style={font.h1}>{producto.nombre}</Text>
            {producto.descripcion ? <Text style={[font.body, { lineHeight: 21 }]}>{producto.descripcion}</Text> : null}
            <Text style={{ fontSize: 18, fontWeight: '800', color: color.ink }}>
              {producto.venta === 'dinero' ? `Hoy: $1 ≈ ${reglas?.rindePorDolar}` : formatCents(producto.precioCents ?? 0)}
            </Text>
          </View>

          {yaEnPedido.length > 0 ? <YaEnTuPedido producto={producto} lineas={yaEnPedido} /> : null}

          {producto.venta === 'dinero' && reglas ? (
            <View style={{ gap: 12 }}>
              <Text style={font.h2}>¿Cuánto querés de {producto.nombre.toLowerCase()}?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[50, 100, 200, 300].filter((v) => v >= reglas.minimoCents).map((v) => (
                  <Chip key={v} label={formatCentsCorto(v)} selected={monto === v} onPress={() => setMonto(v)} />
                ))}
              </View>
              <Contador
                valor={`${formatCents(monto)} de ${producto.nombre.toLowerCase()}`}
                onMenos={() => setMonto((m) => Math.max(reglas.minimoCents, m - reglas.pasoCents))}
                onMas={() => setMonto((m) => Math.min(2000, m + reglas.pasoCents))}
              />
              <Text style={[font.small, { textAlign: 'center' }]}>Pagás exactamente esto y la tienda te da lo que alcance.</Text>
            </View>
          ) : null}

          {(producto.gruposOpciones ?? []).map((g) => {
            const sel = elegidas[g.id] ?? [];
            const obligatorio = g.min > 0;
            return (
              <View key={g.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 }}>
                  <View>
                    <Text style={font.h2}>{g.nombre}</Text>
                    <Text style={font.small}>{g.max === 1 ? 'Elegí 1' : `Hasta ${g.max}`}</Text>
                  </View>
                  <Badge label={obligatorio ? (sel.length >= g.min ? 'Listo' : 'Obligatorio') : 'Opcional'} tone={obligatorio ? (sel.length >= g.min ? 'success' : 'brand') : 'neutral'} />
                </View>
                {g.opciones.map((o) => {
                  const on = sel.includes(o.id);
                  const bloqueado = !on && g.max > 1 && sel.length >= g.max;
                  return (
                    <Pressable key={o.id} accessibilityRole={g.max === 1 ? 'radio' : 'checkbox'} accessibilityState={{ checked: on, disabled: bloqueado }} onPress={() => tocar(g, o.id)} style={[s.opcion, bloqueado && { opacity: 0.4 }]}>
                      {g.max === 1 ? <Radio selected={on} /> : <View style={[s.check, on && s.checkOn]}>{on ? <Icon name="checkmark" size={14} tint="#FFFFFF" /> : null}</View>}
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: color.ink }}>{o.nombre}</Text>
                      <Text style={font.small}>{o.precioExtraCents ? `+${formatCents(o.precioExtraCents)}` : 'Incluido'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          {esMercado ? (
            <View>
              <Text style={[font.h2, { paddingBottom: 4 }]}>Si no hay, ¿qué hacemos?</Text>
              {SI_NO_HAY.map((o) => (
                <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ checked: siNoHay === o.v }} onPress={() => setSiNoHay(o.v)} style={s.opcion}>
                  <Radio selected={siNoHay === o.v} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: color.ink }}>{o.t}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={font.h2}>Indicaciones <Text style={font.small}>(opcional)</Text></Text>
            <TextInput value={nota} onChangeText={setNota} placeholder={esMercado ? 'Ej. maduros para hoy' : 'Ej. bien doraditas, sin chile'} placeholderTextColor={color.faint} maxLength={120} returnKeyType="done" style={s.nota} />
          </View>
        </View>
      </ScrollView>
      <View style={s.pie}>
        {calculo?.error ? <Text style={{ color: color.brandDark, fontWeight: '600', textAlign: 'center' }}>{calculo.error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {producto.venta === 'unidad' ? (
            <View style={s.cant}>
              <Pressable accessibilityLabel="Uno menos" onPress={() => setCantidad((c) => Math.max(1, c - 1))} style={s.cantBtn}><Text style={s.cantSign}>−</Text></Pressable>
              <Text style={{ fontSize: 17, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>{cantidad}</Text>
              <Pressable accessibilityLabel="Uno más" onPress={() => setCantidad((c) => Math.min(30, c + 1))} style={s.cantBtn}><Text style={s.cantSign}>+</Text></Pressable>
            </View>
          ) : null}
          <Button style={{ flex: 1 }} label={yaEnPedido.length ? 'Agregar otra' : 'Agregar'} right={calculo?.total != null ? formatCents(calculo.total) : undefined} disabled={!!calculo?.error} onPress={agregar} />
        </View>
      </View>
      </ConTeclado>
    </SafeAreaView>
  );
}

/** Lo que ya lleva de este producto: puede sumar o quitar una igual sin volver a elegir opciones. */
function YaEnTuPedido({ producto, lineas }: { producto: Producto; lineas: LineaCarrito[] }) {
  const cart = useCart();
  return (
    <View style={s.ya}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="checkmark-circle" size={18} tint={color.success} />
        <Text style={font.title}>Ya en tu pedido</Text>
      </View>
      {lineas.map((l) => {
        let texto = '';
        let subtotal = 0;
        try {
          const it = construirItem(producto, l);
          texto = it.opcionesTexto.join(' · ');
          subtotal = it.subtotalCents;
        } catch {
          // Si el producto cambió y la línea ya no es válida, igual dejamos quitarla.
        }
        const esDinero = producto.venta === 'dinero';
        const cant = l.cantidad ?? 1;
        return (
          <View key={l.lineaId} style={s.yaFila}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: color.ink }} numberOfLines={2}>
                {esDinero ? formatCents(l.montoCents ?? 0) : texto || producto.nombre}
              </Text>
              {l.nota ? <Text style={font.small} numberOfLines={1}>“{l.nota}”</Text> : null}
              {subtotal ? <Text style={font.small}>{formatCents(subtotal)}</Text> : null}
            </View>
            {esDinero ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Quitar" hitSlop={8} onPress={() => cart.quitarLinea(l.lineaId)} style={s.yaBtn}>
                <Icon name="trash-outline" size={18} />
              </Pressable>
            ) : (
              <View style={s.yaStep}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cant <= 1 ? 'Quitar' : 'Una menos'}
                  onPress={() => (cant <= 1 ? cart.quitarLinea(l.lineaId) : cart.cambiarLinea(l.lineaId, { cantidad: cant - 1 }))}
                  style={s.yaBtn}>
                  <Icon name={cant <= 1 ? 'trash-outline' : 'remove'} size={18} />
                </Pressable>
                <Text style={{ fontSize: 15, fontWeight: '800', minWidth: 20, textAlign: 'center', color: color.ink }}>{cant}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Una más igual" onPress={() => cart.cambiarLinea(l.lineaId, { cantidad: Math.min(30, cant + 1) })} style={s.yaBtn}>
                  <Icon name="add" size={18} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
      <Text style={font.tiny}>¿Querés otra diferente? Elegí abajo y tocá “Agregar otra”.</Text>
    </View>
  );
}

function Contador({ valor, onMenos, onMas }: { valor: string; onMenos: () => void; onMas: () => void }) {
  return (
    <View style={s.contador}>
      <Pressable accessibilityLabel="Menos" onPress={onMenos} style={s.contBtn}><Text style={s.cantSign}>−</Text></Pressable>
      <Text style={{ fontSize: 18, fontWeight: '800', color: color.ink, flexShrink: 1, textAlign: 'center' }}>{valor}</Text>
      <Pressable accessibilityLabel="Más" onPress={onMas} style={s.contBtn}><Text style={s.cantSign}>+</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cerrar: { position: 'absolute', top: 14, right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: color.line },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: color.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.brand, borderColor: color.brand },
  nota: { minHeight: 50, borderWidth: 1.5, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: 16, fontSize: 15, color: color.ink },
  pie: { padding: 16, paddingBottom: 20, gap: 8, borderTopWidth: 1, borderTopColor: '#EFEAE4' },
  cant: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: color.border, borderRadius: 16 },
  cantBtn: { width: 48, height: 54, alignItems: 'center', justifyContent: 'center' },
  cantSign: { fontSize: 22, fontWeight: '700', color: color.ink },
  contador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: color.bg, borderRadius: 16, padding: 8 },
  ya: { backgroundColor: color.successTint + '66', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: radius.lg, padding: 14, gap: 10 },
  yaFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yaStep: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: color.border, borderRadius: 12, backgroundColor: color.surface },
  yaBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  contBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
