import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Empty, Header, Icon, Notice, Radio, Segmented } from '@/components/ui';
import { api } from '@/data';
import { mensajeError, useNegocio } from '@/data/hooks';
import { calcularCambio, calcularResumen, formatCents, type MetodoPago, type ModoEntrega, type Producto } from '@/shared';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { color, font } from '@/theme';

/** Billetes con los que se suele pagar. */
const BILLETES = [500, 1000, 2000];

export default function Carrito() {
  const cart = useCart();
  const { usuario } = useSession();
  const { data } = useNegocio(cart.negocioId ?? undefined);
  const negocio = data?.negocio ?? null;
  const productos = useMemo(() => new Map<string, Producto>((data?.productos ?? []).map((p) => [p.id, p])), [data]);

  const [modo, setModo] = useState<ModoEntrega>('domicilio');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [pagaCon, setPagaCon] = useState<number | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();

  const zonaId = usuario?.direccion?.zonaId ?? 'centro';
  const resumen = useMemo(() => {
    if (!negocio || cart.lineas.length === 0) return null;
    try {
      return { ok: calcularResumen(negocio, productos, cart.lineas, modo, zonaId) };
    } catch (e) {
      return { error: mensajeError(e) };
    }
  }, [negocio, productos, cart.lineas, modo, zonaId]);

  if (cart.lineas.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <Header title="Tu pedido" />
        <Empty title="Tu pedido está vacío" text="Agregá productos desde un negocio." />
        <View style={{ padding: 20 }}>
          <Button label="Ver negocios" variant="dark" onPress={() => router.replace('/inicio')} />
        </View>
      </SafeAreaView>
    );
  }

  const r = resumen?.ok;
  const total = r?.totalCents ?? 0;
  const cambio = metodo === 'efectivo' ? calcularCambio(total, pagaCon) : 0;
  const faltaMinimo = r?.faltaParaMinimoCents ?? 0;
  const puedeEnviar = !!r && faltaMinimo === 0 && cambio !== null && !enviando;

  async function enviar() {
    if (!negocio || !puedeEnviar) return;
    setEnviando(true);
    setError(undefined);
    try {
      const pedido = await api.crearPedido({
        negocioId: negocio.id,
        lineas: cart.lineas,
        modo,
        zonaId,
        referencia: usuario?.direccion?.referencia ?? '',
        pago: { metodo, pagaConCents: metodo === 'efectivo' ? pagaCon : undefined },
      });
      cart.vaciar();
      router.replace({ pathname: '/pedido/[id]', params: { id: pedido.id } });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: color.bg }}>
      <Header title="Tu pedido" subtitle={negocio?.nombre} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Segmented
          value={modo}
          onChange={setModo}
          options={[
            { value: 'domicilio', label: 'A domicilio' },
            ...(negocio?.permiteRecoger ? [{ value: 'recoger' as const, label: 'Lo recojo' }] : []),
          ]}
        />

        <Card>
          {modo === 'domicilio' ? (
            <Pressable onPress={() => router.push('/perfil')} style={s.fila} accessibilityRole="button" accessibilityLabel="Cambiar dirección">
              <Icon name="location-outline" size={22} tint={color.brand} />
              <View style={{ flex: 1 }}>
                <Text style={font.title}>{usuario?.direccion?.zonaNombre ?? 'Elegí tu zona'}</Text>
                <Text style={font.small} numberOfLines={2}>{usuario?.direccion?.referencia || 'Agregá una referencia para que te encuentren'}</Text>
              </View>
              <Text style={s.link}>Cambiar</Text>
            </Pressable>
          ) : (
            <View style={s.fila}>
              <Icon name="storefront-outline" size={22} tint={color.brand} />
              <View style={{ flex: 1 }}>
                <Text style={font.title}>Recogés en el negocio</Text>
                <Text style={font.small}>{negocio?.direccion}</Text>
              </View>
            </View>
          )}
        </Card>

        <Card>
          {(r?.items ?? []).map((it, i) => {
            const linea = cart.lineas[i];
            const p = productos.get(it.productoId);
            const esDinero = it.venta === 'dinero';
            return (
              <View key={linea.lineaId} style={[s.item, i > 0 && { borderTopWidth: 1, borderTopColor: color.line }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={font.title}>{esDinero ? `${formatCents(it.montoCents ?? 0)} de ${it.nombre.toLowerCase()}` : it.nombre}</Text>
                  {it.opcionesTexto.length ? <Text style={font.small}>{it.opcionesTexto.join(' · ')}</Text> : null}
                  {it.nota ? <Text style={font.small}>“{it.nota}”</Text> : null}
                  <Text style={{ fontWeight: '700', color: color.ink2, paddingTop: 2 }}>{formatCents(it.subtotalCents)}</Text>
                </View>
                <View style={s.step}>
                  <Pressable
                    accessibilityLabel="Menos"
                    style={s.stepBtn}
                    onPress={() => {
                      if (esDinero) {
                        const paso = p?.dinero?.pasoCents ?? 25;
                        const min = p?.dinero?.minimoCents ?? 50;
                        const nuevo = (linea.montoCents ?? 0) - paso * 2;
                        if (nuevo < min) cart.quitarLinea(linea.lineaId);
                        else cart.cambiarLinea(linea.lineaId, { montoCents: nuevo });
                      } else if ((linea.cantidad ?? 1) <= 1) cart.quitarLinea(linea.lineaId);
                      else cart.cambiarLinea(linea.lineaId, { cantidad: (linea.cantidad ?? 1) - 1 });
                    }}>
                    <Icon name={(esDinero ? (linea.montoCents ?? 0) - (p?.dinero?.pasoCents ?? 25) * 2 < (p?.dinero?.minimoCents ?? 50) : (linea.cantidad ?? 1) <= 1) ? 'trash-outline' : 'remove'} size={18} />
                  </Pressable>
                  <Text style={{ fontWeight: '800', minWidth: 34, textAlign: 'center' }}>{esDinero ? `$${((linea.montoCents ?? 0) / 100).toFixed((linea.montoCents ?? 0) % 100 ? 2 : 0)}` : linea.cantidad}</Text>
                  <Pressable
                    accessibilityLabel="Más"
                    style={s.stepBtn}
                    onPress={() =>
                      esDinero
                        ? cart.cambiarLinea(linea.lineaId, { montoCents: Math.min(2000, (linea.montoCents ?? 0) + (p?.dinero?.pasoCents ?? 25) * 2) })
                        : cart.cambiarLinea(linea.lineaId, { cantidad: Math.min(30, (linea.cantidad ?? 1) + 1) })
                    }>
                    <Icon name="add" size={18} />
                  </Pressable>
                </View>
              </View>
            );
          })}
          <Pressable onPress={() => router.back()} style={[s.fila, { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12, marginTop: 4 }]}>
            <Icon name="add-circle-outline" size={20} tint={color.brand} />
            <Text style={s.link}>Agregar más productos</Text>
          </Pressable>
        </Card>

        {resumen?.error ? <Notice tone="danger" text={resumen.error} /> : null}
        {faltaMinimo > 0 ? (
          <Notice tone="warn" title={`Te faltan ${formatCents(faltaMinimo)}`} text={`El pedido mínimo a domicilio es ${formatCents(negocio?.pedidoMinimoCents ?? 0)}. También podés recogerlo.`} />
        ) : null}

        <Card>
          <Text style={[font.h2, { paddingBottom: 6 }]}>¿Cómo pagás?</Text>
          <Pressable style={s.opcion} accessibilityRole="radio" accessibilityState={{ checked: metodo === 'efectivo' }} onPress={() => setMetodo('efectivo')}>
            <Radio selected={metodo === 'efectivo'} />
            <Icon name="cash-outline" size={22} tint={color.success} />
            <Text style={[font.title, { flex: 1 }]}>Efectivo al recibir</Text>
          </Pressable>
          {metodo === 'efectivo' ? (
            <View style={{ paddingLeft: 34, paddingVertical: 8, gap: 8 }}>
              <Text style={font.small}>¿Con cuánto pagás? Así llevan cambio.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Exacto" selected={pagaCon === undefined} onPress={() => setPagaCon(undefined)} />
                {BILLETES.filter((b) => b > total).map((b) => (
                  <Chip key={b} label={formatCents(b).replace('.00', '')} selected={pagaCon === b} onPress={() => setPagaCon(b)} />
                ))}
              </View>
              {pagaCon !== undefined && cambio !== null ? <Text style={{ fontWeight: '700', color: color.success }}>Te llevan {formatCents(cambio)} de cambio</Text> : null}
            </View>
          ) : null}
          {negocio?.aceptaTarjeta ? (
            <>
              <Pressable style={s.opcion} accessibilityRole="radio" accessibilityState={{ checked: metodo === 'tarjeta' }} onPress={() => setMetodo('tarjeta')}>
                <Radio selected={metodo === 'tarjeta'} />
                <Icon name="card-outline" size={22} tint={color.info} />
                <Text style={[font.title, { flex: 1 }]}>Tarjeta</Text>
              </Pressable>
              {metodo === 'tarjeta' ? (
                <View style={{ paddingLeft: 34, paddingVertical: 8, gap: 8 }}>
                  <Text style={font.small}>El negocio te escribe por WhatsApp para coordinar el cobro (POS al entregar o link de pago). Mandadito no guarda datos de tarjeta.</Text>
                  {negocio.whatsapp ? (
                    <Pressable onPress={() => Linking.openURL(`https://wa.me/${negocio.whatsapp}`)}>
                      <Text style={s.link}>Escribirle ahora por WhatsApp</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </Card>

        {r ? (
          <Card>
            <Linea label="Productos" valor={formatCents(r.subtotalCents)} />
            {modo === 'domicilio' ? <Linea label="Envío" valor={r.envioCents ? formatCents(r.envioCents) : 'Gratis'} /> : null}
            <View style={{ height: 1, backgroundColor: color.line, marginVertical: 8 }} />
            <Linea label="Total" valor={formatCents(r.totalCents)} fuerte />
          </Card>
        ) : null}
        {error ? <Notice tone="danger" text={error} /> : null}
      </ScrollView>
      <View style={s.pie}>
        <Button label={enviando ? 'Enviando…' : 'Hacer pedido'} right={r ? formatCents(total) : undefined} loading={enviando} disabled={!puedeEnviar} onPress={enviar} />
        <Text style={[font.tiny, { textAlign: 'center' }]}>El negocio tiene 5 minutos para aceptarlo.</Text>
      </View>
    </SafeAreaView>
  );
}

function Linea({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={fuerte ? font.h2 : font.body}>{label}</Text>
      <Text style={fuerte ? font.h2 : [font.body, { color: color.ink }]}>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { color: color.brand, fontWeight: '700', fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  step: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: color.border, borderRadius: 12 },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  pie: { padding: 16, gap: 6, backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: '#EFEAE4' },
});
