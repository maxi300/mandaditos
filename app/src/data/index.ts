import { firebaseSource } from './firebase';
import { mockSource } from './mock';
import type { DataSource } from './source';

/**
 * Elegí el modo en el archivo .env:
 *   EXPO_PUBLIC_DATA_SOURCE=demo      → funciona sin internet ni Firebase (para probar)
 *   EXPO_PUBLIC_DATA_SOURCE=firebase  → usa tu proyecto de Firebase
 */
export const api: DataSource = process.env.EXPO_PUBLIC_DATA_SOURCE === 'firebase' ? firebaseSource : mockSource;

export type { DataSource, NuevoPedido } from './source';
