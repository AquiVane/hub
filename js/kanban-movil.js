// Tableros Kanban (tareas, sitio web, leads) en el celular -- pedido de Vaneh (26/10):
//  1) UNA columna por vez, elegida con una barra fija de estados (Sin empezar / En progreso / Listo, con su
//     cantidad): sin arrastrar de costado y sin scrollear kilómetros para llegar a otra columna.
//  2) Botones claros en cada tarjeta para pasarla de estado con un toque.
//  3) Mantener apretada una tarjeta y soltarla sobre un estado de la barra (como arrastrar en la compu).
// No cambia la lógica de cada tablero: simula los mismos eventos de arrastrar/soltar (dragstart/drop) que ya
// escuchan, así sirve para todos (admin: Gestión COSMART, Mis tareas, CRM; panel de cliente: Tareas, Sitio Web).
// Solo se activa en pantallas angostas; en la compu no se toca nada.

if (!window.__kanbanMovil) {
  window.__kanbanMovil = true;
  const MQ = window.matchMedia('(max-width: 768px)');
  const activa = {}; // columna elegida por tablero (sobrevive a los re-pintados)
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const claveDe = b => b.id || b.parentElement?.id || 'tablero';
  const columnasDe = b => [...b.children].filter(c => c.classList.contains('kanban-col'));
  const zonaDe = c => c.querySelector('.kanban-cards');
  const keyDe = c => (c && (c.dataset.col || zonaDe(c)?.dataset.col)) || '';

  // DataTransfer de mentira: alcanza para los handlers existentes (guardan el id en su propia variable).
  const falsoDT = () => ({ effectAllowed: 'move', dropEffect: 'move', types: [], _d: {}, setData(t, v) { this._d[t] = v; }, getData(t) { return this._d[t] || ''; }, setDragImage() {} });
  const disparar = (el, tipo, dt) => {
    const ev = new Event(tipo, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: dt });
    el.dispatchEvent(ev);
  };

  function aviso(txt) {
    let n = document.getElementById('kb-toast');
    if (!n) { n = document.createElement('div'); n.id = 'kb-toast'; n.className = 'kb-toast'; document.body.appendChild(n); }
    n.textContent = txt; n.classList.add('visible');
    clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('visible'), 1800);
  }

  function mover(card, board, colKey, rotulo) {
    const zona = [...board.querySelectorAll('.kanban-cards')].find(z => z.dataset.col === colKey);
    if (!zona) return;
    const dt = falsoDT();
    disparar(card, 'dragstart', dt);
    disparar(zona, 'dragover', dt);
    disparar(zona, 'drop', dt);
    disparar(card, 'dragend', dt);
    aviso('Pasó a ' + (rotulo || colKey));
  }

  let observador = null;
  function observar() { observador?.observe(document.body, { childList: true, subtree: true }); }
  function conObservadorPausado(fn) { observador?.disconnect(); try { fn(); } finally { observar(); } }

  function desmontar(board) {
    board.classList.remove('kb-movil');
    columnasDe(board).forEach(c => c.classList.remove('kb-activa'));
    board.querySelectorAll('.kb-mover').forEach(n => n.remove());
    board.querySelectorAll('.kanban-card[data-kb-draggable]').forEach(c => { c.setAttribute('draggable', 'true'); c.removeAttribute('data-kb-draggable'); });
    const prev = board.previousElementSibling;
    if (prev && prev.classList.contains('kb-tabs')) prev.remove();
  }

  function mejorar(board) {
    if (!MQ.matches) { desmontar(board); return; }
    const cols = columnasDe(board).filter(c => zonaDe(c));
    if (cols.length < 2) return;
    board.classList.add('kb-movil');
    const key = claveDe(board);
    let act = activa[key];
    if (!cols.some(c => keyDe(c) === act)) act = keyDe(cols[0]);
    activa[key] = act;

    let barra = board.previousElementSibling;
    if (!barra || !barra.classList.contains('kb-tabs')) {
      barra = document.createElement('div'); barra.className = 'kb-tabs';
      board.parentNode.insertBefore(barra, board);
    }
    barra.innerHTML = cols.map(c => {
      const k = keyDe(c);
      const titulo = c.querySelector('.col-title')?.textContent.trim() || k;
      const n = c.querySelector('.col-count')?.textContent.trim() || '0';
      const color = c.querySelector('.kanban-col-dot')?.style.background || 'var(--text-muted)';
      return `<button type="button" class="kb-tab${k === act ? ' activa' : ''}" data-col="${esc(k)}"><span class="kb-dot" style="background:${esc(color)}"></span><span class="kb-tab-txt">${esc(titulo)}</span><b>${esc(n)}</b></button>`;
    }).join('');
    cols.forEach(c => c.classList.toggle('kb-activa', keyDe(c) === act));

    // Botones de pasar de estado en cada tarjeta que se puede arrastrar
    board.querySelectorAll('.kanban-card[draggable]').forEach(card => {
      card.setAttribute('data-kb-draggable', '1');
      card.setAttribute('draggable', 'false'); // evita el "levantar" nativo de iOS; el arrastre lo hace este módulo
      if (card.querySelector('.kb-mover')) return;
      const miCol = keyDe(card.closest('.kanban-col'));
      const div = document.createElement('div'); div.className = 'kb-mover';
      cols.filter(c => keyDe(c) !== miCol).forEach(c => {
        const k = keyDe(c);
        const titulo = c.querySelector('.col-title')?.textContent.trim() || k;
        const b = document.createElement('button'); b.type = 'button';
        const listo = /listo|final|complet|ganad|cerrad/i.test(k);
        b.className = 'kb-mover-btn' + (listo ? ' kb-listo' : '');
        b.textContent = (listo ? '✓ ' : '→ ') + titulo;
        b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); mover(card, board, k, titulo); });
        div.appendChild(b);
      });
      card.appendChild(div);
    });
  }

  function mejorarTodos() { conObservadorPausado(() => document.querySelectorAll('.kanban-board').forEach(mejorar)); }
  let pendiente = false;
  function programar() { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; mejorarTodos(); }); }

  // Elegir columna con la barra
  document.addEventListener('click', e => {
    const tab = e.target.closest?.('.kb-tab');
    if (!tab) return;
    const board = tab.parentElement.nextElementSibling;
    if (!board || !board.classList.contains('kanban-board')) return;
    activa[claveDe(board)] = tab.dataset.col;
    mejorarTodos();
  });

  // Mantener apretada una tarjeta y soltarla sobre un estado de la barra
  let t = null; // { card, board, x0, y0, timer, ghost, dragging, hover }
  const limpiar = () => {
    if (!t) return;
    clearTimeout(t.timer); t.ghost?.remove();
    document.body.classList.remove('kb-arrastrando');
    document.querySelectorAll('.kb-tab.kb-hover').forEach(n => n.classList.remove('kb-hover'));
    t.card?.classList.remove('kb-levantada'); t = null;
  };
  function posicionar(x, y) {
    if (!t?.ghost) return;
    t.ghost.style.left = Math.max(8, x - t.ghost.offsetWidth / 2) + 'px';
    t.ghost.style.top = (y - 28) + 'px';
    const bajo = document.elementFromPoint(x, y);
    const tab = bajo?.closest?.('.kb-tab');
    document.querySelectorAll('.kb-tab.kb-hover').forEach(n => n.classList.remove('kb-hover'));
    if (tab && tab.parentElement.nextElementSibling === t.board) { tab.classList.add('kb-hover'); t.hover = tab; } else t.hover = null;
    // Auto-scroll vertical al acercarse a los bordes
    const sc = t.board.closest('.content');
    if (sc) { const r = sc.getBoundingClientRect(); if (y > r.bottom - 60) sc.scrollTop += 12; else if (y < r.top + 60) sc.scrollTop -= 12; }
  }
  document.addEventListener('touchstart', e => {
    if (!MQ.matches || e.touches.length !== 1) return;
    const card = e.target.closest?.('.kanban-card[data-kb-draggable]');
    if (!card || e.target.closest('button, a, input, select, textarea')) return;
    const board = card.closest('.kanban-board');
    if (!board || !board.classList.contains('kb-movil')) return;
    const p = e.touches[0];
    t = { card, board, x0: p.clientX, y0: p.clientY, dragging: false, hover: null, ghost: null, timer: null };
    t.timer = setTimeout(() => {
      if (!t) return;
      t.dragging = true;
      document.body.classList.add('kb-arrastrando');
      card.classList.add('kb-levantada');
      const r = card.getBoundingClientRect();
      const g = card.cloneNode(true); g.className = 'kb-ghost'; g.removeAttribute('onclick');
      g.querySelectorAll('.kb-mover').forEach(n => n.remove());
      g.style.width = Math.min(r.width, window.innerWidth - 40) + 'px';
      document.body.appendChild(g); t.ghost = g;
      posicionar(t.x0, t.y0);
      navigator.vibrate?.(15);
    }, 420);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!t) return;
    const p = e.touches[0];
    if (!t.dragging) { if (Math.abs(p.clientX - t.x0) > 10 || Math.abs(p.clientY - t.y0) > 10) limpiar(); return; }
    e.preventDefault();
    posicionar(p.clientX, p.clientY);
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!t) return;
    if (t.dragging && t.hover) {
      const { card, board, hover } = t;
      const k = hover.dataset.col, rot = hover.querySelector('.kb-tab-txt')?.textContent;
      limpiar();
      if (k !== keyDe(card.closest('.kanban-col'))) mover(card, board, k, rot);
    } else limpiar();
  }, { passive: true });
  document.addEventListener('touchcancel', limpiar, { passive: true });
  // (evita el menú contextual al mantener apretado)
  document.addEventListener('contextmenu', e => { if (MQ.matches && e.target.closest?.('.kanban-card')) e.preventDefault(); });

  observador = new MutationObserver(programar);
  observar();
  MQ.addEventListener?.('change', mejorarTodos);
  programar();
}
