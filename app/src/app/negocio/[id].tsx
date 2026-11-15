import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddStepper, Badge, BackButton, Button, Empty, Foto, Icon } from '@/components/ui';
import { useNegocio } from '@/data/hooks';
import { calcularResumen, formatCents, formatCentsCorto, type Producto } from '@/shared';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { color, font, radius } from '@/theme';

export default function MenuNegocio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, cargando, error } = useNegocio(id);
  const cart = useCart();
  const { usuario } = useSession();
  const insets = useSafeAreaInsets();
  const [buscar, setBuscar] = useState('');

  const negocio = data?.negocio;
  const productos = useMemo(() => data?.productos ?? [], [data]);
  const secciones = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const map = new Map<string, Producto[]>();
    const lista = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;
    const destacados = q ? [] : lista.filter((p) => p.destacado);
    if (destacados.length) map.set('Lo más pedido', destacados);
    for (const p of lista) {
      if (!q && p.destacado) continue;
      map.set(p.seccion, [...(map.get(p.seccion) ?? []), p]);
    }
    return [...map.entries()];
  }, [productos, buscar]);

  const resumen = useMemo(() => {
    if (!negocio || cart.negocioId !== negocio.id || cart.lineas.length === 0) return null;
    try {
      return calcularResumen(negocio, Object.fromEntries(productos.map((p) => [p.id, p])), cart.lineas, 'recoger', '');
    } catch {
      return null;
    }
  }, [negocio, productos, cart.lineas, cart.negocioId]);

  if (cargando) return <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }} />;
  if (error || !negocio) return <SafeAreaView style={{ flex: 1 }}><Empty title="No encontramos este negocio" text={error} /></SafeAreaView>;

  function conCarritoDeEsteNegocio(accion: () => void) {
    if (!cart.pideCambiarNegocio(negocio!.id)) return accion();
    Alert.alert('¿Empezar un pedido nuevo?', 'Tu pedido actual es de otro negocio. Solo se puede pedir a un negocio a la vez.', [
      { text: 'Seguir con el anterior', style: 'cancel' },
      { text: 'Empezar nuevo', style: 'destructive', onPress: () => { cart.vaciar(); setTimeout(accion, 0); } },
    ]);
  }

  function abrirProducto(p: Producto) {
    conCarritoDeEsteNegocio(() => router.push({ pathname: '/producto/[id]', params: { id: p.id, negocioId: negocio!.id } }));
  }

  const envio = negocio.envioPorZona[usuario?.direccion?.zonaId ?? ''];

  return (
    <View style={{ flex: 1, backgroundColor: color.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" stickyHeaderIndices={[2]}>
        <View style={{ height: 200 }}>
          <Foto src={negocio.fotoUrl} style={StyleSheet.absoluteFill} alt={negocio.nombre} />
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: 16, paddingTop: 8 }}><BackButton /></SafeAreaView>
        </View>
        <View style={s.info}>
          <Text style={font.h1}>{negocio.nombre}</Text>
          <Text style={font.small}>
            ★ {negocio.calificacion.promedio.toFixed(1)} ({negocio.calificacion.n}) · {negocio.abierto ? <Text style={{ color: color.success, fontWeight: '700' }}>Abierto</Text> : <Text style={{ color: color.danger, fontWeight: '700' }}>Cerrado</Text>} · {negocio.direccion}
          </Text>
          <View style={s.datos}>
            <Dato valor={`${negocio.tiempoPrepMin.min}–${negocio.tiempoPrepMin.max}`} etiqueta="minutos" />
            <Dato valor={envio != null ? formatCents(envio) : '—'} etiqueta="envío" />
            <Dato valor={formatCents(negocio.pedidoMinimoCents)} etiqueta="mínimo" ultimo />
          </View>
          <Text style={font.tiny}>Efectivo al recibir{negocio.aceptaTarjeta ? ' · Tarjeta coordinada con el negocio' : ''}{negocio.permiteRecoger ? ' · Podés recoger' : ''}</Text>
          {negocio.promo ? <Badge label={negocio.promo} tone="brand" /> : null}
          {!negocio.abierto ? <Text style={{ color: color.danger, fontWeight: '600' }}>Está cerrado ahora. Podés ver el menú pero no pedir.</Text> : null}
        </View>
        <View style={{ backgroundColor: color.surface, paddingVertical: 8 }}><View style={s.buscar}>
          <Icon name="search" size={18} tint={color.ink2} />
          <TextInput value={buscar} onChangeText={setBuscar} placeholder={`Buscá en ${negocio.nombre}`} placeholderTextColor={color.faint} style={{ flex: 1, fontSize: 15, minHeight: 46, color: color.ink }} accessibilityLabel="Buscar producto" returnKeyType="search" clearButtonMode="while-editing" />
          {buscar ? (
            <Pressable accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => setBuscar('')}><Icon name="close-circle" size={18} tint={color.faint} /></Pressable>
          ) : null}
        </View></View>
        {secciones.map(([titulo, lista]) => (
          <View key={titulo}>
            <Text style={[font.h2, { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 }]}>{titulo}</Text>
            {lista.map((p) => (
              <FilaProducto key={titulo + p.id} p={p} habilitado={negocio.abierto} onAbrir={() => abrirProducto(p)} onAgregar={() => conCarritoDeEsteNegocio(() => cart.sumar(p))} />
            ))}
          </View>
        ))}
        {secciones.length === 0 ? <Empty title="No lo encontramos" text="Probá con otra palabra." /> : null}
      </ScrollView>
      {resumen ? (
        <View style={[s.barra, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Button variant="dark" label={`Ver mi pedido (${cart.totalItems})`} right={formatCents(resumen.subtotalCents)} onPress={() => router.push('/carrito')} />
        </View>
      ) : null}
    </View>
  );
}

function FilaProducto({ p, habilitado, onAbrir, onAgregar }: { p: Producto; habilitado: boolean; onAbrir: () => void; onAgregar: () => void }) {
  const cart = useCart();
  const tieneOpciones = (p.gruposOpciones?.length ?? 0) > 0;
  const lineas = cart.lineas.filter((l) => l.productoId === p.id);
  const enCarrito = lineas.reduce((a, l) => a + (l.cantidad ?? 1), 0);
  const simple = cart.cantidadSimple(p.id);
  const precio = p.venta === 'dinero' ? `$1 ≈ ${p.dinero?.rindePorDolar}` : formatCents(p.precioCents ?? 0);

  return (
    <View style={[s.fila, !p.disponible && { opacity: 0.5 }]}>
      {p.fotoUrl ? (
        <Pressable onPress={onAbrir} accessibilityLabel={`Ver ${p.nombre}`}>
          <Foto src={p.fotoUrl} style={s.thumb} alt={p.nombre} />
        </Pressable>
      ) : null}
      <Pressable onPress={onAbrir} style={{ flex: 1, gap: 3 }} accessibilityRole="button">
        <Text style={{ fontSize: 15, fontWeight: '700', color: color.ink }}>{p.nombre}</Text>
        {p.descripcion ? <Text style={font.small} numberOfLines={2}>{p.descripcion}</Text> : null}
        <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink }}>{precio}</Text>
        {p.requiereReceta ? <Badge label="Requiere receta" tone="brand" /> : null}
        {!p.disponible ? <Badge label="Agotado" tone="danger" /> : null}
      </Pressable>
      {habilitado && p.disponible && !p.requiereReceta ? (
        tieneOpciones ? (
          // Mismo control “− n +” que los productos simples.
          // Con una sola variedad en el pedido, − y + la cambian directo;
          // con varias (ej. maíz y arroz) abren el detalle para elegir cuál.
          <AddStepper
            value={enCarrito}
            onAdd={() => {
              if (lineas.length !== 1) return onAbrir();
              const l = lineas[0];
              cart.cambiarLinea(l.lineaId, { cantidad: Math.min(30, (l.cantidad ?? 1) + 1) });
            }}
            onRemove={() => {
              if (lineas.length !== 1) return onAbrir();
              const l = lineas[0];
              if ((l.cantidad ?? 1) <= 1) cart.quitarLinea(l.lineaId);
              else cart.cambiarLinea(l.lineaId, { cantidad: (l.cantidad ?? 1) - 1 });
            }}
          />
        ) : (
          <AddStepper value={simple} label={p.venta === 'dinero' ? formatCentsCorto(simple) : undefined} addLabel={p.venta === 'dinero' ? '+ $1' : '+ Agregar'} onAdd={onAgregar} onRemove={() => cart.restar(p)} />
        )
      ) : null}
    </View>
  );
}

function Dato({ valor, etiqueta, ultimo }: { valor: string; etiqueta: string; ultimo?: boolean }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', paddingVertical: 10 }, !ultimo && { borderRightWidth: 1, borderRightColor: '#EFEAE4' }]}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: color.ink }}>{valor}</Text>
      <Text style={font.tiny}>{etiqueta}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  info: { marginTop: -24, backgroundColor: color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  datos: { flexDirection: 'row', borderWidth: 1, borderColor: '#EFEAE4', borderRadius: 16 },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: color.bg },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: color.line },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: '#EFEAE4' },
});
