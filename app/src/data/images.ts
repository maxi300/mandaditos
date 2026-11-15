import type { ImageSource } from 'expo-image';

/** Fotos de ejemplo incluidas en la app (modo demo). En producción las fotos vienen de Firebase Storage. */
const demo: Record<string, number> = {
  pupusas: require('@/assets/images/demo/pupusas.jpg'),
  tienda: require('@/assets/images/demo/tienda.jpg'),
  farmacia: require('@/assets/images/demo/farmacia.jpg'),
  ferreteria: require('@/assets/images/demo/ferreteria.jpg'),
  barber: require('@/assets/images/demo/barber.jpg'),
  taller: require('@/assets/images/demo/taller.jpg'),
  pan: require('@/assets/images/demo/pan.jpg'),
  comedor: require('@/assets/images/demo/comedor.jpg'),
  tomate: require('@/assets/images/demo/tomate.jpg'),
  chile: require('@/assets/images/demo/chile.jpg'),
  pepino: require('@/assets/images/demo/pepino.jpg'),
  repollo: require('@/assets/images/demo/repollo.jpg'),
  ajo: require('@/assets/images/demo/ajo.jpg'),
  lechuga: require('@/assets/images/demo/lechuga.jpg'),
  brocoli: require('@/assets/images/demo/brocoli.jpg'),
  pp_rev: require('@/assets/images/demo/pp_rev.jpg'),
  pp_lor: require('@/assets/images/demo/pp_lor.jpg'),
  pp_fri: require('@/assets/images/demo/pp_fri.jpg'),
  pp_cur: require('@/assets/images/demo/pp_cur.jpg'),
  pp_lim: require('@/assets/images/demo/pp_lim.jpg'),
};

/** “demo:tomate” → foto incluida; “https://…” → foto remota. */
export function fuenteFoto(src?: string): ImageSource | number | undefined {
  if (!src) return undefined;
  if (src.startsWith('demo:')) return demo[src.slice(5)];
  return { uri: src };
}
