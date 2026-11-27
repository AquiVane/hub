// Bloquea archivos internos del repo para que no se publiquen en la web (notas, reglas, handoffs, flujos de CI).
// Cloudflare Pages sirve TODO lo que está en el repo; este Worker solo corre para las rutas de _routes.json
// y responde 404. Cualquier otra ruta la sirve Pages normalmente (headers de _headers incluidos).
export default {
  async fetch(request, env) {
    const p = new URL(request.url).pathname.toLowerCase();
    if (p.endsWith('.md') || p.startsWith('/.claude/') || p.startsWith('/.github/')) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return env.ASSETS.fetch(request);
  },
};
