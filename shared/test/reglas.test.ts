import { describe, expect, it } from 'vitest';
import {
  aplicarTransicion,
  calcularCambio,
  calcularResumen,
  debeExpirar,
  debeSeguirSinRespuesta,
  ErrorDePedido,
  formatCents,
  parseCents,
  puedeTransicionar,
  type Negocio,
  type Pedido,
  type Producto,
} from '../src';

const negocio: Negocio = {
  id: 'n1', nombre: 'Pupusería La Esquina', vertical: 'restaurante', categoria: 'Pupusería', estado: 'activo', abierto: true,
  direccion: 'Barrio El Centro', whatsapp: '+50370000000', aceptaTarjeta: true, permiteRecoger: true,
  pedidoMinimoCents: 300, envioPorZona: { centro: 50, calvario: 75 }, tiempoPrepMin: { min: 15, max: 25 }, calificacion: { promedio: 4.8, n: 10 },
};

const revuelta: Producto = {
  id: 'rev', negocioId: 'n1', nombre: 'Pupusa revuelta', seccion: 'Pupusas', disponible: true, venta: 'unidad', precioCents: 75,
  gruposOpciones: [
    { id: 'masa', nombre: 'Tipo de masa', min: 1, max: 1, opciones: [{ id: 'maiz', nombre: 'Maíz', precioExtraCents: 0 }, { id: 'arroz', nombre: 'Arroz', precioExtraCents: 10 }] },
    { id: 'extras', nombre: 'Extras', min: 0, max: 2, opciones: [{ id: 'curtido', nombre: 'Curtido extra', precioExtraCents: 25 }, { id: 'salsa', nombre: 'Salsa extra', precioExtraCents: 15 }, { id: 'queso', nombre: 'Queso extra', precioExtraCents: 25 }] },
  ],
};
const tomate: Producto = {
  id: 'tom', negocioId: 'n1', nombre: 'Tomate', seccion: 'Verduras', disponible: true, venta: 'dinero',
  dinero: { minimoCents: 50, pasoCents: 25, rindePorDolar: '1¼ lb' },
};
const productos = { rev: revuelta, tom: tomate };

describe('dinero', () => {
  it('formatea y lee centavos', () => {
    expect(formatCents(125)).toBe('$1.25');
    expect(formatCents(5)).toBe('$0.05');
    expect(parseCents('$1.5')).toBe(150);
    expect(parseCents('2')).toBe(200);
    expect(parseCents('abc')).toBeNull();
  });
  it('calcula el cambio o avisa si no alcanza', () => {
    expect(calcularCambio(325, 500)).toBe(175);
    expect(calcularCambio(325, 200)).toBeNull();
  });
});

describe('total del pedido', () => {
  it('suma opciones, cantidades y envío por zona', () => {
    const r = calcularResumen(negocio, productos, [
      { lineaId: 'a', productoId: 'rev', cantidad: 2, opciones: { masa: ['arroz'], extras: ['curtido'] } },
      { lineaId: 'b', productoId: 'tom', montoCents: 100 },
    ], 'domicilio', 'centro');
    expect(r.items[0].subtotalCents).toBe(2 * (75 + 10 + 25));
    expect(r.subtotalCents).toBe(220 + 100);
    expect(r.envioCents).toBe(50);
    expect(r.totalCents).toBe(370);
    expect(r.faltaParaMinimoCents).toBe(0);
  });
  it('avisa cuánto falta para el mínimo a domicilio, pero no al recoger', () => {
    const lineas = [{ lineaId: 'a', productoId: 'rev', cantidad: 2, opciones: { masa: ['maiz'] } }];
    expect(calcularResumen(negocio, productos, lineas, 'domicilio', 'centro').faltaParaMinimoCents).toBe(150);
    const recoger = calcularResumen(negocio, productos, lineas, 'recoger', 'centro');
    expect(recoger.faltaParaMinimoCents).toBe(0);
    expect(recoger.envioCents).toBe(0);
  });
  it('exige las opciones obligatorias y respeta el máximo', () => {
    expect(() => calcularResumen(negocio, productos, [{ lineaId: 'a', productoId: 'rev', cantidad: 1 }], 'recoger', 'centro')).toThrow(ErrorDePedido);
    expect(() => calcularResumen(negocio, productos, [{ lineaId: 'a', productoId: 'rev', cantidad: 1, opciones: { masa: ['maiz'], extras: ['curtido', 'salsa', 'queso'] } }], 'recoger', 'centro')).toThrow(/hasta 2/);
  });
  it('venta por dinero: respeta mínimo y pasos de 25 centavos', () => {
    expect(() => calcularResumen(negocio, productos, [{ lineaId: 'a', productoId: 'tom', montoCents: 25 }], 'recoger', 'centro')).toThrow(/mínimo/);
    expect(() => calcularResumen(negocio, productos, [{ lineaId: 'a', productoId: 'tom', montoCents: 110 }], 'recoger', 'centro')).toThrow(/inválido/);
  });
  it('no entrega fuera de zona ni vende agotados', () => {
    const lineas = [{ lineaId: 'a', productoId: 'tom', montoCents: 100 }];
    expect(() => calcularResumen(negocio, productos, lineas, 'domicilio', 'canton-x')).toThrow(/no entrega/);
    expect(() => calcularResumen(negocio, { tom: { ...tomate, disponible: false } }, lineas, 'recoger', 'centro')).toThrow(/disponible/);
  });
  it('no acepta productos de otro negocio (carrito de un solo negocio)', () => {
    expect(() => calcularResumen(negocio, { x: { ...tomate, id: 'x', negocioId: 'otro' } }, [{ lineaId: 'a', productoId: 'x', montoCents: 100 }], 'recoger', 'centro')).toThrow(/ya no existe/);
  });
});

describe('estados del pedido', () => {
  const base: Pedido = {
    id: 'p1', codigo: 'A-0001', clienteId: 'c1', clienteNombre: 'María', clienteTelefono: '+503', negocioId: 'n1', negocioNombre: 'X', zonaId: 'centro',
    modo: 'domicilio', items: [], subtotalCents: 0, envioCents: 0, totalCents: 0, pago: { metodo: 'efectivo' }, estado: 'pendiente',
    creadoEn: 0, expiraEn: 5 * 60_000, historial: [{ estado: 'pendiente', en: 0, rol: 'cliente' }],
  };
  it('el negocio acepta con hora estimada', () => {
    const p = aplicarTransicion(base, 'preparando', 'negocio', 1000, { etaMin: 25 });
    expect(p.estado).toBe('preparando');
    expect(p.etaMin).toBe(25);
    expect(p.historial).toHaveLength(2);
  });
  it('no se acepta sin hora estimada ni se rechaza sin motivo', () => {
    expect(() => aplicarTransicion(base, 'preparando', 'negocio', 1000)).toThrow(/cuánto/);
    expect(() => aplicarTransicion(base, 'rechazado', 'negocio', 1000)).toThrow(/motivo/);
  });
  it('el cliente solo cancela mientras está pendiente', () => {
    expect(puedeTransicionar('pendiente', 'cancelado_cliente', 'cliente')).toBe(true);
    expect(puedeTransicionar('preparando', 'cancelado_cliente', 'cliente')).toBe(false);
    expect(puedeTransicionar('pendiente', 'preparando', 'cliente')).toBe(false);
  });
  it('expira a los 5 minutos y ya no se puede aceptar', () => {
    expect(debeExpirar(base, 4 * 60_000)).toBe(false);
    expect(debeExpirar(base, 6 * 60_000)).toBe(true);
    expect(() => aplicarTransicion(base, 'preparando', 'negocio', 6 * 60_000, { etaMin: 15 })).toThrow(/expiró/);
    expect(aplicarTransicion(base, 'expirado', 'sistema', 6 * 60_000).estado).toBe('expirado');
  });
  it('el negocio consulta al cliente y el cliente responde', () => {
    const preparando = aplicarTransicion(base, 'preparando', 'negocio', 1000, { etaMin: 20 });
    expect(() => aplicarTransicion(preparando, 'esperando_cliente', 'negocio', 2000)).toThrow(/consultar/);
    const consulta = aplicarTransicion(preparando, 'esperando_cliente', 'negocio', 2000, { motivo: '  Se acabó la de queso, ¿revuelta?  ' });
    expect(consulta.consulta).toBe('Se acabó la de queso, ¿revuelta?');
    expect(consulta.expiraEn).toBe(2000 + 10 * 60_000);
    // El cliente puede seguir o cancelar; el negocio no puede contestarse solo.
    expect(aplicarTransicion(consulta, 'preparando', 'cliente', 3000, { motivo: 'Sí, revuelta' }).estado).toBe('preparando');
    expect(aplicarTransicion(consulta, 'cancelado_cliente', 'cliente', 3000).estado).toBe('cancelado_cliente');
    expect(puedeTransicionar('esperando_cliente', 'preparando', 'negocio')).toBe(false);
  });
  it('si el cliente no responde en 10 minutos, el pedido sigue', () => {
    const consulta = aplicarTransicion(aplicarTransicion(base, 'preparando', 'negocio', 1000, { etaMin: 20 }), 'esperando_cliente', 'negocio', 2000, { motivo: '¿Cambio?' });
    expect(debeSeguirSinRespuesta(consulta, 2000 + 9 * 60_000)).toBe(false);
    expect(debeSeguirSinRespuesta(consulta, 2000 + 11 * 60_000)).toBe(true);
    expect(debeSeguirSinRespuesta(base, 99 * 60_000)).toBe(false);
    expect(aplicarTransicion(consulta, 'preparando', 'sistema', 2000 + 11 * 60_000).estado).toBe('preparando');
  });
  it('los estados finales no se mueven', () => {
    const entregado = { ...base, estado: 'entregado' as const };
    expect(() => aplicarTransicion(entregado, 'en_camino', 'negocio', 1)).toThrow();
  });
});
