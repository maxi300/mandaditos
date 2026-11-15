import type { Negocio, Producto, Zona } from './types';

/** Datos de ejemplo de Sociedad, Morazán. Se usan en el modo demo de la app y se suben a Firebase con functions/scripts/seed.ts. */

export const ZONAS: Zona[] = [
  { id: 'centro', nombre: 'Barrio El Centro', municipio: 'Sociedad' },
  { id: 'calvario', nombre: 'Barrio El Calvario', municipio: 'Sociedad' },
  { id: 'cantones', nombre: 'Cantones cercanos', municipio: 'Sociedad' },
];

const base = { estado: 'activo' as const, whatsapp: '+50370000000', aceptaTarjeta: true, permiteRecoger: true };

export const NEGOCIOS: Negocio[] = [
  { ...base, id: 'esquina', nombre: 'Pupusería La Esquina', vertical: 'restaurante', categoria: 'Pupusería', fotoUrl: 'demo:pupusas', abierto: true, direccion: 'Barrio El Centro, media cuadra al norte del parque', pedidoMinimoCents: 300, envioPorZona: { centro: 50, calvario: 75, cantones: 150 }, tiempoPrepMin: { min: 20, max: 30 }, calificacion: { promedio: 4.8, n: 126 }, promo: '2×1 en limonada hoy' },
  { ...base, id: 'rosa', nombre: 'Comedor Doña Rosa', vertical: 'restaurante', categoria: 'Comedor', fotoUrl: 'demo:comedor', abierto: true, aceptaTarjeta: false, direccion: 'Barrio El Calvario', pedidoMinimoCents: 350, envioPorZona: { centro: 75, calvario: 50 }, tiempoPrepMin: { min: 25, max: 35 }, calificacion: { promedio: 4.6, n: 58 } },
  { ...base, id: 'trigal', nombre: 'Panadería El Trigal', vertical: 'restaurante', categoria: 'Panadería', fotoUrl: 'demo:pan', abierto: false, aceptaTarjeta: false, direccion: 'Barrio El Centro', pedidoMinimoCents: 200, envioPorZona: { centro: 50 }, tiempoPrepMin: { min: 15, max: 20 }, calificacion: { promedio: 4.5, n: 41 } },
  { ...base, id: 'chepe', nombre: 'Tienda Don Chepe', vertical: 'mercado', categoria: 'Tienda', fotoUrl: 'demo:tienda', abierto: true, aceptaTarjeta: false, direccion: 'Barrio El Centro', pedidoMinimoCents: 200, envioPorZona: { centro: 50, calvario: 50, cantones: 100 }, tiempoPrepMin: { min: 15, max: 25 }, calificacion: { promedio: 4.7, n: 88 } },
  { ...base, id: 'constructor', nombre: 'Ferretería El Constructor', vertical: 'mercado', categoria: 'Ferretería', fotoUrl: 'demo:ferreteria', abierto: true, direccion: 'Salida a San Francisco Gotera', pedidoMinimoCents: 500, envioPorZona: { centro: 100, calvario: 100, cantones: 200 }, tiempoPrepMin: { min: 30, max: 60 }, calificacion: { promedio: 4.6, n: 33 } },
  { ...base, id: 'rafael', nombre: 'Farmacia San Rafael', vertical: 'farmacia', categoria: 'Farmacia', fotoUrl: 'demo:farmacia', abierto: true, direccion: 'Barrio El Centro, frente al parque', pedidoMinimoCents: 100, envioPorZona: { centro: 75, calvario: 75, cantones: 150 }, tiempoPrepMin: { min: 20, max: 35 }, calificacion: { promedio: 4.9, n: 102 } },
];

const masa = {
  id: 'masa', nombre: 'Tipo de masa', min: 1, max: 1,
  opciones: [
    { id: 'maiz', nombre: 'Maíz', precioExtraCents: 0 },
    { id: 'arroz', nombre: 'Arroz', precioExtraCents: 10 },
  ],
};
const extras = {
  id: 'extras', nombre: 'Extras', min: 0, max: 2,
  opciones: [
    { id: 'curtido', nombre: 'Curtido extra', precioExtraCents: 25 },
    { id: 'salsa', nombre: 'Salsa extra', precioExtraCents: 15 },
    { id: 'queso', nombre: 'Queso extra', precioExtraCents: 25 },
  ],
};

function u(id: string, negocioId: string, nombre: string, precioCents: number, seccion: string, extra: Partial<Producto> = {}): Producto {
  return { id, negocioId, nombre, precioCents, seccion, disponible: true, venta: 'unidad', ...extra };
}
function d(id: string, negocioId: string, nombre: string, rindePorDolar: string, seccion: string, fotoUrl?: string): Producto {
  return { id, negocioId, nombre, seccion, disponible: true, venta: 'dinero', fotoUrl, dinero: { minimoCents: 50, pasoCents: 25, rindePorDolar } };
}

export const PRODUCTOS: Producto[] = [
  u('esq-rev', 'esquina', 'Pupusa revuelta', 75, 'Pupusas', { descripcion: 'Chicharrón, frijol y queso.', fotoUrl: 'demo:pp_rev', destacado: true, gruposOpciones: [masa, extras] }),
  u('esq-lor', 'esquina', 'Queso con loroco', 75, 'Pupusas', { descripcion: 'Queso fresco con flor de loroco.', fotoUrl: 'demo:pp_lor', destacado: true, gruposOpciones: [masa, extras] }),
  u('esq-fri', 'esquina', 'Frijol con queso', 60, 'Pupusas', { descripcion: 'La clásica de siempre.', fotoUrl: 'demo:pp_fri', gruposOpciones: [masa, extras] }),
  u('esq-ayo', 'esquina', 'Queso con ayote', 75, 'Pupusas', { descripcion: 'Queso con ayote tierno.', gruposOpciones: [masa, extras] }),
  u('esq-lim', 'esquina', 'Limonada', 75, 'Bebidas', { descripcion: 'Vaso de 16 oz.', fotoUrl: 'demo:pp_lim' }),
  u('esq-caf', 'esquina', 'Café de olla', 50, 'Bebidas', { descripcion: 'Con canela y panela.' }),
  u('esq-cur', 'esquina', 'Curtido extra', 25, 'Extras', { fotoUrl: 'demo:pp_cur' }),

  u('rosa-dia', 'rosa', 'Plato del día', 350, 'Almuerzos', { descripcion: 'Carne, arroz, ensalada y tortillas.', fotoUrl: 'demo:comedor', destacado: true }),
  u('rosa-sopa', 'rosa', 'Sopa de res', 400, 'Almuerzos', { descripcion: 'Con verduras y tortillas.' }),

  u('tri-dulce', 'trigal', 'Pan dulce', 25, 'Pan', { fotoUrl: 'demo:pan' }),

  d('che-tom', 'chepe', 'Tomate', '1¼ lb · 5 a 6 tomates', 'Verduras', 'demo:tomate'),
  u('che-chi', 'chepe', 'Chile morrón', 35, 'Verduras', { fotoUrl: 'demo:chile' }),
  u('che-pep', 'chepe', 'Pepino', 25, 'Verduras', { fotoUrl: 'demo:pepino' }),
  u('che-rep', 'chepe', 'Repollo', 100, 'Verduras', { fotoUrl: 'demo:repollo' }),
  u('che-ajo', 'chepe', 'Ajo', 30, 'Verduras', { fotoUrl: 'demo:ajo' }),
  d('che-bro', 'chepe', 'Brócoli', '¾ lb', 'Verduras', 'demo:brocoli'),
  u('che-lec', 'chepe', 'Lechuga', 75, 'Verduras', { fotoUrl: 'demo:lechuga' }),
  d('che-fri', 'chepe', 'Frijol rojo', '1 lb', 'Granos básicos'),
  d('che-arr', 'chepe', 'Arroz blanco', '1¾ lb', 'Granos básicos'),
  d('che-maz', 'chepe', 'Maíz blanco', '2½ lb', 'Granos básicos'),

  d('con-cla', 'constructor', 'Clavos 2½"', '1 lb', 'Construcción', 'demo:ferreteria'),
  u('con-tub', 'constructor', 'Tubo PVC ½" (6 m)', 450, 'Fontanería'),
  u('con-cem', 'constructor', 'Cemento (bolsa 42.5 kg)', 950, 'Construcción'),

  u('raf-ace', 'rafael', 'Acetaminofén 500 mg', 125, 'Lo que más piden', { descripcion: 'Blíster de 10 tabletas', destacado: true }),
  u('raf-ibu', 'rafael', 'Ibuprofeno 400 mg', 160, 'Lo que más piden', { descripcion: 'Blíster de 10 tabletas' }),
  u('raf-sue', 'rafael', 'Suero oral', 90, 'Lo que más piden', { descripcion: 'Sobre para 1 litro' }),
  u('raf-alc', 'rafael', 'Alcohol 70 %', 110, 'Lo que más piden', { descripcion: 'Frasco de 250 ml' }),
  u('raf-amo', 'rafael', 'Amoxicilina 500 mg', 450, 'Con receta', { descripcion: 'Caja de 21 cápsulas', requiereReceta: true }),
];
