// ══════════════════════════════════════════════════════════════
//  COSMART Marketing Hub — Configuración del backend
//  Reemplazá WORKER_URL con la URL de tu Cloudflare Worker
//  Ejemplo: https://marketing-hub.TU-SUBDOMINIO.workers.dev
// ══════════════════════════════════════════════════════════════

export const WORKER_URL = 'https://marketing-hub.conglomeradocosmart.workers.dev';

// Modo demo: se activa automáticamente si el worker no está configurado
export const DEMO_MODE = WORKER_URL.includes('TU_SUBDOMINIO');
