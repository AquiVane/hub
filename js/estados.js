// ══════════════════════════════════════════════════════════════
//  Estados de contenido (27/11, pedido de Vaneh): un solo lugar para TODOS los módulos de contenido
//  (Hub cliente, admin/Contenidos propios, app Calendario). Hay dos recorridos según el tipo de pieza:
//   · Video / Reel  → ESTADOS_VIDEO
//   · Imagen / Carrusel / GIF / Documento → ESTADOS_IMAGEN
//  Los estados se habilitan o deshabilitan según plataforma, ubicación y formato elegidos.
//  Reel es solo UBICACIÓN (tildarlo tilda el formato Video); Carrusel es solo FORMATO; Story es solo UBICACIÓN.
// ══════════════════════════════════════════════════════════════
export const ESTADOS_VIDEO = ['Sin empezar', 'Guión en revisión', 'Guión aprobado', 'Grabado', 'Editado', 'En revisión', 'Aprobado', 'Programado', 'Publicado'];
export const ESTADOS_IMAGEN = ['Sin empezar', 'Copy en revisión', 'Textos aprobados', 'En proceso', 'En revisión', 'Aprobado', 'Programado', 'Publicado'];
// Unión ordenada (filtros, Kanban, Excel): todos los estados posibles.
export const ESTADOS_CONT = ['Sin empezar', 'Guión en revisión', 'Guión aprobado', 'Grabado', 'Editado', 'Copy en revisión', 'Textos aprobados', 'En proceso', 'En revisión', 'Aprobado', 'Programado', 'Publicado'];

export const FORMATOS_VIDEO = ['Video'];
export const FORMATOS_IMAGEN = ['Imagen', 'Carrusel', 'GIF', 'Documento'];
export const UBIC_VIDEO = ['Reel', 'Shorts'];

const arr = v => [].concat(v == null || v === '' ? [] : v).map(x => String(x).trim()).filter(Boolean);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Qué tipo de pieza es, a partir de formato(s) y ubicación(es): 'video' | 'imagen' | 'ambos' (sin definir o mezcla).
export function tipoPieza(formato, ubicacion) {
  const f = arr(formato).map(norm), u = arr(ubicacion).map(norm);
  const video = f.includes('video') || f.includes('reel') || u.includes('reel') || u.includes('shorts');
  const imagen = f.some(x => ['imagen', 'carrusel', 'gif', 'documento'].includes(x));
  if (video && !imagen) return 'video';
  if (imagen && !video) return 'imagen';
  return 'ambos';
}
export const tipoDe = c => tipoPieza(c && c.formato, c && c.ubicacion);
export const estadosPara = tipo => tipo === 'video' ? ESTADOS_VIDEO : tipo === 'imagen' ? ESTADOS_IMAGEN : ESTADOS_CONT;

// Estados de antes -> estados nuevos (no se toca lo guardado en el servidor: se traduce al leer y queda grabado al guardar).
const LEGACY = { 'Idea': 'Sin empezar', 'Sin grabar': 'Sin empezar', 'Guión grabado': 'Grabado', 'Guion grabado': 'Grabado', 'Revisión': 'En revisión', 'Pendiente': 'Sin empezar' };
// Equivalencias al pasar de un recorrido al otro (ej. cambiar de Reel a Imagen).
const A_IMAGEN = { 'Guión en revisión': 'Copy en revisión', 'Guión aprobado': 'Textos aprobados', 'Grabado': 'En proceso', 'Editado': 'En proceso' };
const A_VIDEO = { 'Copy en revisión': 'Guión en revisión', 'Textos aprobados': 'Guión aprobado', 'En proceso': 'Grabado' };

export function convertirEstado(estado, tipo) {
  if (tipo === 'imagen') return A_IMAGEN[estado] || estado;
  if (tipo === 'video') return A_VIDEO[estado] || estado;
  return estado;
}
export function normEstado(c) {
  let e = LEGACY[c && c.estado] || (c && c.estado) || 'Sin empezar';
  return convertirEstado(e, tipoDe(c));
}
// Traduce en memoria los estados viejos de una lista de contenidos (devuelve la misma lista).
export function normContenidos(lista) {
  (Array.isArray(lista) ? lista : []).forEach(c => { if (c && typeof c === 'object') { const n = normEstado(c); if (n !== c.estado) c.estado = n; } });
  return lista;
}

const CLASES = { 'Sin empezar': 's-idea', 'Guión en revisión': 's-revision', 'Copy en revisión': 's-revision', 'Guión aprobado': 's-textos', 'Textos aprobados': 's-textos', 'Grabado': 's-grabado', 'Editado': 's-editado', 'En proceso': 's-proceso', 'En revisión': 's-revision', 'Aprobado': 's-aprobado', 'Programado': 's-programado', 'Publicado': 's-publicado' };
const COLORES = { 'Sin empezar': '#94a3b8', 'Guión en revisión': '#f472b6', 'Copy en revisión': '#f472b6', 'Guión aprobado': '#06b6d4', 'Textos aprobados': '#06b6d4', 'Grabado': '#8b5cf6', 'Editado': '#6366f1', 'En proceso': '#f59e0b', 'En revisión': '#ec4899', 'Aprobado': '#10b981', 'Programado': '#3b82f6', 'Publicado': '#22c55e' };
export const estadoClase = e => CLASES[LEGACY[e] || e] || 's-idea';
export const estadoColor = e => COLORES[LEGACY[e] || e] || '#94a3b8';

// <option>s de un <select> de estado: los que no corresponden al tipo de pieza quedan deshabilitados.
export function opcionesEstado(tipo, actual, esc = s => s) {
  const ok = estadosPara(tipo);
  return ESTADOS_CONT.map(s => `<option value="${esc(s)}"${s === actual ? ' selected' : ''}${ok.includes(s) ? '' : ' disabled'}>${esc(s)}</option>`).join('');
}
// Habilita/deshabilita las opciones de un <select> existente; si el estado elegido ya no corresponde, lo traduce.
export function aplicarEstadosSelect(sel, tipo) {
  if (!sel) return;
  const ok = estadosPara(tipo);
  Array.from(sel.options).forEach(o => { o.disabled = !ok.includes(o.value); o.hidden = !ok.includes(o.value); });
  if (!ok.includes(sel.value)) {
    const n = convertirEstado(sel.value, tipo);
    sel.value = ok.includes(n) ? n : 'Sin empezar';
  }
}

// Agrupaciones para contadores del dashboard / pestaña "En proceso y revisión".
export const ESTADOS_EN_CURSO = ESTADOS_CONT.filter(e => !['Sin empezar', 'Aprobado', 'Programado', 'Publicado'].includes(e));

// Acomoda ubicación/formato según las reglas: Reel y Story son ubicaciones, Carrusel es formato,
// y si la ubicación es Reel (o Shorts) el formato incluye Video.
export function acomodarUbicFormato(ubicacion, formato) {
  let u = arr(ubicacion), f = arr(formato);
  const has = (a, x) => a.some(y => norm(y) === norm(x));
  const quitar = (a, x) => a.filter(y => norm(y) !== norm(x));
  if (has(f, 'Reel')) { f = quitar(f, 'Reel'); if (!has(f, 'Video')) f.push('Video'); if (!has(u, 'Reel')) u.push('Reel'); }
  if (has(f, 'Story')) { f = quitar(f, 'Story'); if (!has(u, 'Story')) u.push('Story'); }
  if (has(u, 'Carrusel')) { u = quitar(u, 'Carrusel'); if (!has(f, 'Carrusel')) f.push('Carrusel'); }
  if ((has(u, 'Reel') || has(u, 'Shorts')) && !has(f, 'Video')) f.push('Video');
  return { ubicacion: u, formato: f };
}
