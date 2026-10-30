// Conector de Claude con el Hub (29/10/2026). Se monta en un contenedor y sirve para
// los dos paneles: cada persona conecta SU Claude con SU usuario (usa su propia
// cuota de Claude y ve/hace en el Hub solo lo que su rol permite). Si es la dueña
// (admin de COSMART), además decide qué personas tienen Claude habilitado.
import { getClaudeEstado, revocarConexionClaude, getClaudeAcceso, setClaudeAcceso } from './data.js?v=10';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLES = { admin: 'Administradora', colaborador: 'Colaborador/a', client: 'Cliente' };

async function copiar(texto, btn) {
  try { await navigator.clipboard.writeText(texto); }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
  const original = btn.textContent;
  btn.textContent = '¡Copiado!';
  setTimeout(() => { btn.textContent = original; }, 1500);
}

function filaCopiable(etiqueta, valor) {
  return `<div style="margin:10px 0;">
    <label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">${esc(etiqueta)}</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input type="text" class="form-control cc-copiable" readonly value="${esc(valor)}" style="flex:1 1 220px;min-width:0;font-family:monospace;font-size:12px;" onclick="this.select()">
      <button type="button" class="btn btn-secondary btn-sm cc-copiar">Copiar</button>
    </div></div>`;
}

export async function montarConectorClaude(el, { admin = false } = {}) {
  if (!el) return false;
  el.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">Cargando…</p>';
  let estado;
  try { estado = await getClaudeEstado(); }
  catch (e) { el.innerHTML = ''; return false; } // backend sin desplegar o sin conexión: no mostrar nada roto

  const conexiones = (estado.conexiones || []).map(c => `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
      <div style="min-width:0;flex:1 1 180px;font-size:13px;">
        <strong>${esc(c.nombre || 'Claude')}</strong>
        <div style="font-size:11px;color:var(--text-muted);">Conectado ${new Date(c.creada).toLocaleDateString('es-AR')}${c.ultimoUso ? ' · Último uso ' + new Date(c.ultimoUso).toLocaleString('es-AR') : ' · Sin uso todavía'}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm cc-revocar" data-id="${esc(c.id)}">Desconectar</button>
    </div>`).join('');

  const cuerpoConexion = estado.habilitado ? `
    <p style="font-size:13px;color:var(--text-muted);margin:0 0 6px;">Conectá <strong>tu</strong> Claude con <strong>tu</strong> usuario del Hub. Claude va a poder hacer en el Hub lo mismo que vos, nada más, y usa tu propia cuenta de Claude. Podés desconectarlo cuando quieras.</p>
    ${filaCopiable('Dirección del conector (pegala en Claude)', estado.mcpUrl)}
    <ol style="font-size:13px;line-height:1.7;margin:8px 0 12px;padding-left:20px;color:var(--text);">
      <li><strong>claude.ai o app:</strong> Ajustes → Conectores → Agregar conector personalizado → pegá la dirección → Conectar → entrá con tu email y contraseña del Hub.</li>
      <li><strong>Claude Code:</strong> corré el comando de abajo y después <code>/mcp</code> para iniciar sesión.</li>
    </ol>
    ${filaCopiable('Comando para Claude Code', `claude mcp add --transport http cosmart-hub ${estado.mcpUrl}`)}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">${conexiones || '<p style="font-size:12px;color:var(--text-muted);margin:0;">Todavía no conectaste ningún Claude.</p>'}</div>`
    : `<p style="font-size:13px;color:var(--text-muted);margin:0;">Tu usuario todavía no tiene Claude habilitado en el Hub. Pedile el permiso a Vaneh.</p>`;

  el.innerHTML = `${cuerpoConexion}${admin ? '<div id="cc-permisos" style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px;"></div>' : ''}<p id="cc-msg" style="font-size:12px;margin:10px 0 0;color:var(--text-muted);"></p>`;
  const msg = t => { const m = el.querySelector('#cc-msg'); if (m) m.textContent = t; };

  el.querySelectorAll('.cc-copiar').forEach(b => b.addEventListener('click', () => copiar(b.parentElement.querySelector('.cc-copiable').value, b)));
  el.querySelectorAll('.cc-revocar').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('¿Desconectar este Claude? Va a dejar de poder ver y modificar el Hub hasta que lo vuelvas a conectar.')) return;
    try { await revocarConexionClaude(b.dataset.id); await montarConectorClaude(el, { admin }); }
    catch (e) { msg('No se pudo desconectar: ' + (e.message || 'intentá de nuevo.')); }
  }));

  if (admin) await montarPermisos(el.querySelector('#cc-permisos'), msg);
  return true;
}

async function montarPermisos(cont, msg) {
  if (!cont) return;
  let personas;
  try { personas = (await getClaudeAcceso()).personas || []; }
  catch (e) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <h3 style="font-size:14px;margin:0 0 4px;">Quién puede usar Claude en el Hub</h3>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 10px;">Cada persona usa su propia cuenta de Claude. Si apagás a alguien, se desconecta al instante.</p>
    <div style="display:flex;flex-direction:column;gap:6px;">${personas.map(p => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;">
        <label style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;${p.implicito ? 'opacity:.75;' : 'cursor:pointer;'}">
          <input type="checkbox" class="cc-perm" data-email="${esc(p.email)}" ${p.habilitado ? 'checked' : ''} ${p.implicito ? 'disabled' : ''} style="width:18px;height:18px;flex:none;">
          <span style="flex:1 1 180px;min-width:0;font-size:13px;word-break:break-word;"><strong>${esc(p.nombre)}</strong> <small style="color:var(--text-muted);">${esc(ROLES[p.role] || p.role)}${p.implicito ? ' · siempre habilitada' : ''}</small><br><small style="color:var(--text-muted);">${esc(p.email)}</small></span>
        </label>
        ${p.role === 'colaborador' ? `<label style="display:flex;gap:10px;align-items:center;margin:8px 0 0 28px;font-size:12px;cursor:pointer;" title="Usa la cuenta de Claude que conectaste en Configuración. Tiene un tope de 80 mensajes por día."><input type="checkbox" class="cc-cuota" data-email="${esc(p.email)}" ${p.cuotaCompartida ? 'checked' : ''} style="width:16px;height:16px;flex:none;"> Le presto mi cuota de Claude (asistente dentro del Hub)</label>` : ''}
      </div>`).join('') || '<p style="font-size:12px;color:var(--text-muted);margin:0;">No hay personas para habilitar.</p>'}</div>`;
  cont.querySelectorAll('.cc-cuota').forEach(chk => chk.addEventListener('change', async () => {
    chk.disabled = true;
    try {
      await setClaudeAcceso(chk.dataset.email, { cuotaCompartida: chk.checked });
      msg(chk.checked ? 'Listo: ahora usa tu cuota de Claude en el asistente del Hub.' : 'Listo: ya no usa tu cuota.');
    } catch (e) { chk.checked = !chk.checked; msg('No se pudo guardar: ' + (e.message || 'intentá de nuevo.')); }
    chk.disabled = false;
  }));
  cont.querySelectorAll('.cc-perm').forEach(chk => chk.addEventListener('change', async () => {
    chk.disabled = true;
    try {
      await setClaudeAcceso(chk.dataset.email, chk.checked);
      msg(chk.checked ? 'Habilitado: ya puede conectar su Claude.' : 'Deshabilitado: se desconectó su Claude.');
    } catch (e) { chk.checked = !chk.checked; msg('No se pudo guardar: ' + (e.message || 'intentá de nuevo.')); }
    chk.disabled = false;
  }));
}
