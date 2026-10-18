/* Checkout de Verano en Juego: Payment Brick de Mercado Pago (los datos de tarjeta nunca pasan por nuestro servidor) + botones del SDK de PayPal */
(function () {
  var C = VEJ.cfg, $ = function (i) { return document.getElementById(i); };
  var tab = 'mp', brick = null, brickBusy = false, rehacer = false, pagando = false, ppCargado = false, ppMontado = false, deb;

  function nombre() { return $('nombre').value.trim(); }
  function email() { return $('email').value.trim().toLowerCase(); }
  function datosOk() { return nombre().length > 1 && VEJ.emailOk(email()); }
  function aceptoOk() { return $('acepto').checked; }
  function estado(txt, tipo) {
    var e = $('estado'); e.innerHTML = '';
    if (!txt) return;
    var d = document.createElement('div'); d.className = 'msg ' + (tipo || 'info'); d.textContent = txt; e.appendChild(d);
  }
  function meta() {
    return { fbp: VEJ.cookie('_fbp'), fbc: VEJ.cookie('_fbc'), client_user_agent: navigator.userAgent, event_source_url: location.href, lead_email: email(), lead_nombre: nombre() };
  }
  function irGracias(extra) { location.href = C.BASE + 'gracias/?email=' + encodeURIComponent(email()) + (extra || ''); }
  function validar(mostrar) {
    var d = datosOk(), a = aceptoOk();
    if (mostrar) { $('err-datos').hidden = d; $('err-acepto').hidden = a; if (!d) ($('nombre').value.trim().length > 1 ? $('email') : $('nombre')).focus(); }
    return d && a;
  }

  // ── pestañas accesibles ──
  var tabs = [$('tab-mp'), $('tab-pp')], panels = [$('p-mp'), $('p-pp')];
  function elegir(i, foco) {
    tab = i === 0 ? 'mp' : 'pp';
    tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.tabIndex = j === i ? 0 : -1; panels[j].hidden = j !== i; });
    $('pagar').hidden = tab === 'pp';
    if (foco) tabs[i].focus();
    if (tab === 'pp') montarPayPal(); else montarBrick();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { elegir(i); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); elegir((i + 1) % 2, true); }
    });
  });

  // ── Mercado Pago ──
  function fallo() {
    $('mp-alt').hidden = false;
  }
  async function montarBrick() {
    if (tab !== 'mp') return;
    if (!datosOk()) { $('mp-espera').hidden = false; return; }
    if (brickBusy) { rehacer = true; return; }
    if (typeof MercadoPago === 'undefined') { fallo(); return; }
    brickBusy = true; $('mp-alt').hidden = true; $('mp-espera').hidden = true;
    var timer = setTimeout(fallo, 9000);
    try {
      if (brick) { try { await brick.unmount(); } catch (e) {} brick = null; }
      $('brick').innerHTML = '';
      var r = await fetch(C.MP_WORKER + '/preference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ producto: C.PRODUCTO, amount: C.PRECIO_ARS }, meta()))
      });
      var j = await r.json();
      if (!j.preference_id) throw new Error('sin preference_id');
      var mp = new MercadoPago(C.MP_PUBLIC_KEY, { locale: 'es-AR' });
      brick = await mp.bricks().create('payment', 'brick', {
        initialization: { amount: C.PRECIO_ARS, preferenceId: j.preference_id, payer: { email: email() } },
        customization: { visual: { hideFormTitle: true, hidePaymentButton: true, style: { theme: 'default' } }, paymentMethods: { creditCard: 'all', debitCard: 'all' } },
        callbacks: { onReady: function () { clearTimeout(timer); }, onError: function (e) { console.error(e); } }
      });
    } catch (e) { clearTimeout(timer); fallo(); }
    brickBusy = false;
    if (rehacer) { rehacer = false; montarBrick(); }
  }
  async function pagarMP() {
    if (pagando) return;
    if (!validar(true)) return;
    if (!brick) { estado('El formulario de pago todavía no cargó. Esperá un momento o tocá “Reintentar”.', 'mal'); return; }
    pagando = true; var b = $('pagar'); b.disabled = true; b.textContent = 'Procesando…'; estado('');
    VEJ.evento('compra_iniciada');
    try {
      var data = await brick.getFormData();
      if (!data || !data.formData) throw new Error('form');
      var pr = await fetch(C.MP_WORKER + '/pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, data.formData, { producto: C.PRODUCTO }, meta()))
      });
      var d = await pr.json();
      if (d.status === 'approved') { estado('Pago aprobado. Te llevamos a tu confirmación…', 'ok'); setTimeout(function () { irGracias(''); }, 1200); return; }
      if (d.status === 'in_process' || d.status === 'pending') { irGracias('&estado=pendiente'); return; }
      estado('No se pudo procesar el pago. Revisá los datos de la tarjeta e intentá de nuevo.', 'mal');
    } catch (e) {
      estado('Completá todos los datos de la tarjeta para continuar.', 'mal');
    }
    pagando = false; b.disabled = false; b.textContent = 'Pagar ' + VEJ.ars(C.PRECIO_ARS);
  }
  $('form').addEventListener('submit', function (e) { e.preventDefault(); if (tab === 'mp') pagarMP(); });
  $('reintentar').addEventListener('click', function () { $('mp-alt').hidden = true; montarBrick(); });

  // ── PayPal (USD) ──
  function cargarPayPal(cb) {
    if (typeof paypal !== 'undefined') return cb(true);
    if (ppCargado) return cb(false);
    ppCargado = true;
    var s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(C.PAYPAL_CLIENT_ID) + '&currency=USD&intent=capture';
    s.onload = function () { cb(true); }; s.onerror = function () { ppCargado = false; cb(false); };
    document.head.appendChild(s);
  }
  function montarPayPal() {
    if (ppMontado) return;
    cargarPayPal(function (ok) {
      if (!ok) { estado('No se pudo cargar PayPal. Revisá tu conexión e intentá de nuevo.', 'mal'); return; }
      ppMontado = true;
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 },
        onClick: function (d, actions) { if (!validar(true)) return actions.reject(); VEJ.evento('compra_iniciada'); return actions.resolve(); },
        createOrder: function (d, actions) {
          return actions.order.create({ purchase_units: [{ description: 'Verano en Juego', amount: { value: C.PRECIO_USD.toFixed(2), currency_code: 'USD' } }] });
        },
        onApprove: function (d, actions) {
          estado('Procesando tu pago…', 'info');
          return actions.order.capture().then(function () {
            return VEJ.api('/api/pago/paypal', { orderID: d.orderID, email: email(), nombre: nombre() }, { timeout: 20000 });
          }).then(function (res) {
            if (res.ok) { irGracias(''); }
            else estado(res.error || 'Tu pago se acreditó pero no pudimos terminar la activación. Escribinos a hola@vamatienda.com.ar con tu email y lo resolvemos.', 'mal');
          });
        },
        onError: function () { estado('Error al procesar el pago con PayPal. Intentá de nuevo.', 'mal'); }
      }).render('#pp-btn');
    });
  }

  // ── eventos de datos ──
  function alCambiar() { clearTimeout(deb); deb = setTimeout(function () { $('err-datos').hidden = true; if (datosOk()) { if (tab === 'mp') montarBrick(); } }, 700); }
  $('nombre').addEventListener('input', alCambiar); $('email').addEventListener('input', alCambiar);
  $('acepto').addEventListener('change', function () { if (aceptoOk()) $('err-acepto').hidden = true; });
  VEJ.evento('pagina_vista');
})();
