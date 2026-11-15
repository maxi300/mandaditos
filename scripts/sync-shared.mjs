// Copia las reglas de negocio de /shared/src a la app y a las funciones.
// Edita SIEMPRE /shared/src; las copias se regeneran con: node scripts/sync-shared.mjs
//
// Ojo: NO borramos la carpeta destino para recrearla. En Windows, borrar y recrear la carpeta
// hace que Metro (el servidor de Expo) pierda el rastro y siga sirviendo la versión vieja
// (“X is not a function”). Por eso escribimos cada archivo en su lugar y solo borramos los
// que ya no existen en /shared/src.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'shared', 'src');
const destinos = [join(raiz, 'app', 'src', 'shared'), join(raiz, 'functions', 'src', 'shared')];
const aviso = '// ⚠️ ARCHIVO GENERADO desde /shared/src — no lo edites aquí. Ejecutá: node scripts/sync-shared.mjs\n';

const archivos = readdirSync(origen).filter((a) => a.endsWith('.ts'));

for (const destino of destinos) {
  if (!existsSync(dirname(destino))) continue;
  mkdirSync(destino, { recursive: true });

  let cambiados = 0;
  for (const archivo of archivos) {
    const ruta = join(destino, archivo);
    const nuevo = aviso + readFileSync(join(origen, archivo), 'utf8');
    const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;
    if (actual !== nuevo) {
      writeFileSync(ruta, nuevo);
      cambiados++;
    }
  }
  for (const viejo of readdirSync(destino)) {
    if (!archivos.includes(viejo)) rmSync(join(destino, viejo), { recursive: true, force: true });
  }
  console.log(`✔ shared copiado a ${destino.replace(raiz, '.')} (${cambiados} archivo(s) actualizado(s))`);
}
