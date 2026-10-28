// Aula virtual C6 · recorrido guiado: cada paso se abre al completar el anterior. Los formularios están dentro del aula y
// envían a los mismos formularios de Google; el servicio de estado lo confirma.
(function () {
  'use strict';
  var A = window.AULA || { api: '', enlaces: {}, zoom: {}, marcas: { nombre: 'NOMBREPARTICIPANTE', tel: '5550000000' } };
  var T = window.TALLER || null;
  var REVISION = /[?&]revision=1\b/.test(location.search);      // revisión: todo abierto, sin registro obligatorio
  var PRUEBA = REVISION || /[?&]prueba=1\b/.test(location.search);   // para revisar la página fuera de fecha
  if (REVISION) {                                                  // los enlaces de la revisión conservan el modo
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href]');
      if (a && /^(index|taller-\d)\.html/.test(a.getAttribute('href')) && a.getAttribute('href').indexOf('revision=1') < 0)
        a.setAttribute('href', a.getAttribute('href').split('#')[0] + '?revision=1');
    }, true);
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- almacenamiento local (puede fallar en ventanas privadas: la página funciona igual)
  function leer(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  var yo = leer('aulaC6.yo', null);
  if (yo && (!yo.correo || !yo.puesto)) yo = null;   // quien entró antes de pedir correo y puesto vuelve a registrarse
  function claveEstado(t) { return 'aulaC6.estado.' + t + '.' + (yo ? yo.tel : ''); }

  function avisoRevision() {
    var av = document.createElement('p'); av.className = 'aviso-revision';
    av.textContent = 'Modo revisión: igual que una participante, pero con todos los pasos abiertos.'; document.body.prepend(av);
  }

  // ---------- identidad
  var dlg = $('#identidad');
  function pintarYo() {
    var caja = $('#yo');
    if (!caja) return;
    if (yo) { caja.hidden = false; $('#yo-nombre').textContent = yo.nombre.split(' ')[0]; } else caja.hidden = true;
  }
  function pedirIdentidad() {
    if (!dlg) return;
    if (yo) { $('#id-nombre').value = yo.nombre; $('#id-tel').value = yo.tel; $('#id-correo').value = yo.correo || '';
              $$('input[name=puesto]').forEach(function (r) { r.checked = r.value === yo.puesto; }); }
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  if (dlg) {
    $('#form-identidad').addEventListener('submit', function (ev) {
      var nombre = $('#id-nombre').value.replace(/\s+/g, ' ').trim();
      var tel = $('#id-tel').value.replace(/\D/g, '');
      var correo = $('#id-correo').value.trim().toLowerCase();
      var marcado = $('input[name=puesto]:checked'), puestoSel = marcado ? marcado.value : '';
      if (nombre.length < 5 || nombre.indexOf(' ') < 0 || tel.length !== 10 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || !puestoSel) { ev.preventDefault(); $('#id-error').hidden = false; return; }
      yo = { nombre: nombre, tel: tel, correo: correo, puesto: puestoSel }; guardar('aulaC6.yo', yo); $('#id-error').hidden = true;
      pintarYo(); if (T) { estado = leer(claveEstado(T.taller), vacio()); PEND = leer(claveEstado(T.taller) + '.pend', {}); $$('.nativo').forEach(function (c) { delete c.dataset.listo; }); pintar(); comprobar(); } else if (window.aulaPortada) window.aulaPortada();
    });
    dlg.addEventListener('cancel', function (ev) { if (!yo) ev.preventDefault(); });
  }
  var cambiar = $('#yo-cambiar');
  if (cambiar) cambiar.addEventListener('click', pedirIdentidad);
  pintarYo();

  // ---------- portada: solo los talleres de su puesto (del enlace ?puesto=… o elegido una vez), el siguiente destacado
  if (!T) {
    function pintarPortada() {
      var puesto = yo ? yo.puesto : '';
      $$('.grupo[data-puesto]').forEach(function (g) { g.hidden = g.dataset.puesto !== puesto; });
      $$('.otros[data-otros]').forEach(function (g) { g.hidden = g.dataset.otros !== puesto; });   // otros perfiles: opcionales, nunca «siguiente»
      $$('.otros[data-otros="' + puesto + '"] .fila-taller').forEach(function (a) {
        var est = yo ? leer('aulaC6.estado.' + a.dataset.taller + '.' + yo.tel, null) : null, hecho = !!(est && est.completo);
        a.querySelector('.insignia').hidden = !hecho; a.classList.toggle('hecho', hecho);
      });
      var hoy = new Date(); hoy.setHours(0, 0, 0, 0); var marcado = false;
      $$('.grupo[data-puesto="' + puesto + '"] .fila-taller').forEach(function (a) {
        var est = yo ? leer('aulaC6.estado.' + a.dataset.taller + '.' + yo.tel, null) : null;
        var hecho = !!(est && est.completo);
        a.querySelector('.insignia').hidden = !hecho; a.classList.toggle('hecho', hecho);
        var sig = puesto !== 'otro' && !hecho && !marcado; if (sig) marcado = true;   // «otro personal»: todos opcionales, sin «siguiente»
        a.classList.toggle('siguiente', sig); a.querySelector('.sig').hidden = !sig;
      });
    }
    window.aulaPortada = function () { pintarPortada(); window.scrollTo(0, 0); };
    pintarPortada();
    if (REVISION) avisoRevision();
    if (!yo) pedirIdentidad();          // lo primero: el registro (nombre, teléfono, correo y puesto)
    return;
  }

  // ---------- taller
  function vacio() { return { registro: false, inicial: false, entregaAct: false, entregaCaso: false, entrega: false, final: false, completo: false }; }
  var estado = yo ? leer(claveEstado(T.taller), vacio()) : vacio();
  var PEND = yo ? leer(claveEstado(T.taller) + '.pend', {}) : {};     // pasos enviados que Google aún no confirma: {paso: hora}
  var F = (A.forms || {})[T.taller] || null;
  var ms = function (iso) { return Date.parse(iso); };
  function enVentana(a, b) { var n = Date.now(); return PRUEBA || (n >= ms(a) && n <= ms(b)); }
  function antes(a) { return !PRUEBA && Date.now() < ms(a); }
  function despues(b) { return !PRUEBA && Date.now() > ms(b); }
  function guardarEstado() { estado.entrega = !!(estado.entregaAct && estado.entregaCaso); guardar(claveEstado(T.taller), estado); guardar(claveEstado(T.taller) + '.pend', PEND); }

  function ponerPaso(id, est, texto) {
    var li = document.getElementById(id);
    var antesEst = li.dataset.estado;
    li.dataset.estado = est;
    li.querySelector('.paso-estado').textContent = texto || '';
    if (antesEst === 'bloqueado' && est === 'disponible') { li.classList.add('recien'); setTimeout(function () { li.classList.remove('recien'); }, 900); }
    if (antesEst !== 'hecho' && est === 'hecho' && antesEst) { li.classList.add('logrado'); setTimeout(function () { li.classList.remove('logrado'); }, 900); }
  }

  // ---------- formularios dentro del aula: envían a los mismos formularios de Google (mismos campos que el papel)
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var nId = 0;
  function radios(nombre, opciones, valor) {
    var corto = opciones.every(function (o) { return String(o).length <= 12; });
    return '<div class="op-grupo' + (corto ? ' corto' : '') + '" role="radiogroup">' + opciones.map(function (o) {
      var id = 'r' + (++nId);
      return '<label class="op" for="' + id + '"><input type="radio" id="' + id + '" name="' + nombre + '" value="' + esc(o) + '"' + (o === valor ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
    }).join('') + '</div>';
  }
  function campo(etq, html, ayuda) { return '<div class="campo"><p class="campo-etq">' + etq + '</p>' + (ayuda ? '<p class="campo-ayuda">' + ayuda + '</p>' : '') + html + '</div>'; }
  function valorRadio(form, n) { var r = form.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; }
  function enviar(url, datos) {
    var cuerpo = new URLSearchParams();
    Object.keys(datos).forEach(function (k) { if (datos[k] !== '' && datos[k] != null) cuerpo.append(k, datos[k]); });
    return fetch(url, { method: 'POST', mode: 'no-cors', body: cuerpo });
  }
  function quien(c) { var o = {}; o['entry.' + c.nombre.entry] = yo.nombre; o['entry.' + c.tel.entry] = yo.tel; if (c.correo) o['entry.' + c.correo.entry] = yo.correo; return o; }   // las evaluaciones ya no piden correo
  function aviso(form, txt, tipo) { var p = form.querySelector('.form-aviso'); p.textContent = txt; p.className = 'form-aviso ' + (tipo || 'error'); p.hidden = !txt; }
  function alEnviar(form, pasos, ok) {
    var b = form.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
    return function (promesa) {
      promesa.then(function () {
        var ahora = Date.now();
        pasos.forEach(function (k) { estado[k] = true; PEND[k] = ahora; });
        guardarEstado(); pintar(); toast(ok);
        [5000, 15000, 40000].forEach(function (t) { setTimeout(comprobar, t); });
      }).catch(function () {
        b.disabled = false; b.textContent = b.dataset.texto;
        aviso(form, 'No se pudo enviar: revise su conexión a internet y vuelva a intentarlo.');
      });
    };
  }
  function toast(txt) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = txt; t.classList.add('ver'); clearTimeout(t._r); t._r = setTimeout(function () { t.classList.remove('ver'); }, 4000);
  }
  function hecho(caja, txt) { caja.innerHTML = '<p class="enviado">' + ICO_OK + '<span>' + txt + '</span></p>'; }
  var ICO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function formRegistro() {
    var caja = $('#nf-registro'); if (!caja || !F || !yo) return;
    if (estado.registro) return hecho(caja, 'Su asistencia a este taller quedó registrada.');
    if (caja.dataset.listo) return;
    var c = F.registro.campos, f3 = leer('aulaC6.f3', {}), lleno = f3.sexo && f3.rango && f3.edad && f3.categoria && f3.municipio && f3.comunidad;
    // ocupación: la elige ella en un desplegable (26-oct-2026); «Otro personal» escribe además su puesto
    var OCUP = ['Promotora', 'Psicóloga u operadora de la Línea', 'Abogada o Abogada de las Mujeres', 'Otro personal (administrativo, de otra área o externo)'];
    var opSel = f3.ocupOp || (OCUP.indexOf(f3.ocupacion) >= 0 ? f3.ocupacion : ''), otroTxt = f3.ocupOtro || '';
    var ocup = f3.ocupacion || '';
    var datosHtml = campo('Sexo', radios('sexo', c.sexo.opciones, f3.sexo))
      + campo('Rango de edad', radios('rango', c.rango.opciones, f3.rango))
      + campo('Edad', '<input name="edad" inputmode="numeric" maxlength="3" value="' + esc(f3.edad || '') + '">')
      + campo('Categoría', radios('categoria', c.categoria.opciones, f3.categoria))
      + campo('Municipio de procedencia', '<select name="municipio"><option value="">Elija su municipio</option>' + c.municipio.opciones.map(function (o) { return '<option' + (o === f3.municipio ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>')
      + campo('Comunidad / localidad / colonia', '<input name="comunidad" value="' + esc(f3.comunidad || '') + '">')
      + campo('Ocupación', '<select name="ocupacion"><option value="">Elija su ocupación</option>' + OCUP.map(function (o) { return '<option' + (o === opSel ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
              + '<input name="ocupotro" placeholder="Escriba su puesto" value="' + esc(otroTxt) + '"' + (opSel === OCUP[3] ? '' : ' hidden') + ' style="margin-top:8px">')
      + campo('Teléfono, opción 2 <small>(opcional)</small>', '<input name="tel2" inputmode="numeric" maxlength="10" value="' + esc(f3.tel2 || '') + '">');
    caja.innerHTML = '<form class="fnativo" novalidate>'
      + '<p class="quien">' + esc(yo.nombre) + ' · ' + esc(yo.tel) + ' · ' + esc(yo.correo) + '</p>'
      + (lleno ? '<p class="resumen">Sus datos: ' + esc([f3.sexo, f3.rango, f3.edad + ' años', f3.categoria, f3.municipio, f3.comunidad, ocup].join(' · ')) + ' <button type="button" class="enlace" data-editar>Corregir</button></p><div class="datos" hidden>' + datosHtml + '</div>'
               : '<div class="datos">' + datosHtml + '</div>')
      + '<p class="form-aviso" hidden></p><button class="btn" type="submit" data-texto="Registrar mi asistencia">Registrar mi asistencia</button></form>';
    caja.dataset.listo = '1';
    var form = caja.querySelector('form');
    var ed = form.querySelector('[data-editar]'); if (ed) ed.addEventListener('click', function () { form.querySelector('.datos').hidden = false; ed.parentNode.hidden = true; });
    form.ocupacion.addEventListener('change', function () { form.ocupotro.hidden = form.ocupacion.value !== OCUP[3]; if (!form.ocupotro.hidden) form.ocupotro.focus(); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var op = form.ocupacion.value, otro = form.ocupotro.value.trim();
      var v = { sexo: valorRadio(form, 'sexo'), rango: valorRadio(form, 'rango'), edad: form.edad.value.replace(/\D/g, ''), categoria: valorRadio(form, 'categoria'),
                municipio: form.municipio.value, comunidad: form.comunidad.value.trim(),
                ocupacion: op === OCUP[3] ? (otro ? 'Otro personal: ' + otro : '') : op, ocupOp: op, ocupOtro: otro, tel2: form.tel2.value.replace(/\D/g, '') };
      if (!v.sexo || !v.rango || !v.edad || !v.categoria || !v.municipio || !v.comunidad || !v.ocupacion) {
        form.querySelector('.datos').hidden = false;
        return aviso(form, op === OCUP[3] && !otro ? 'Escriba su puesto debajo de «Otro personal».' : !op ? 'Elija su ocupación en la lista desplegable.' : 'Faltan datos: llene todos los campos (el teléfono 2 es opcional).');
      }
      guardar('aulaC6.f3', v);
      var d = quien(c); d['entry.' + c.taller.entry] = F.registro.taller; d['entry.' + c.sexo.entry] = v.sexo; d['entry.' + c.rango.entry] = v.rango;
      d['entry.' + c.edad.entry] = v.edad; d['entry.' + c.categoria.entry] = v.categoria; d['entry.' + c.municipio.entry] = v.municipio;
      d['entry.' + c.comunidad.entry] = v.comunidad; d['entry.' + c.ocupacion.entry] = v.ocupacion; d['entry.' + c.tel2.entry] = v.tel2;
      aviso(form, ''); alEnviar(form, ['registro'], 'Asistencia registrada ✓')(enviar(F.registro.url, d));
    });
  }

  function formEvaluacion(momento) {
    var paso = momento === 'Evaluación inicial' ? 'inicial' : 'final', caja = $('#nf-' + paso); if (!caja || !F || !yo) return;
    if (estado[paso]) return hecho(caja, momento + ' contestada. Gracias.');
    if (caja.dataset.listo) return;
    var c = F.evaluacion.campos, f3 = leer('aulaC6.f3', {});
    var html = (f3.sexo ? '' : campo('Sexo', radios('sexo', c.sexo.opciones, ''))) + (f3.rango ? '' : campo('Rango de edad', radios('rango', c.rango.opciones, '')));
    F.evaluacion.preguntas.forEach(function (q, i) { html += campo(esc(q.titulo), radios('q' + i, q.opciones, '')); });
    caja.innerHTML = '<form class="fnativo" novalidate>' + html + '<p class="form-aviso" hidden></p><button class="btn" type="submit" data-texto="Enviar la ' + momento.toLowerCase() + '">Enviar la ' + momento.toLowerCase() + '</button></form>';
    caja.dataset.listo = '1';
    var form = caja.querySelector('form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sexo = f3.sexo || valorRadio(form, 'sexo'), rango = f3.rango || valorRadio(form, 'rango');
      var resp = F.evaluacion.preguntas.map(function (q, i) { return valorRadio(form, 'q' + i); });
      var falta = resp.indexOf('');
      if (!sexo || !rango || falta >= 0) return aviso(form, falta >= 0 ? 'Falta contestar la pregunta ' + (falta + 1) + '.' : 'Falta marcar su sexo y su rango de edad.');
      var d = quien(c); d['entry.' + c.sexo.entry] = sexo; d['entry.' + c.rango.entry] = rango; d['entry.' + c.momento.entry] = momento;
      F.evaluacion.preguntas.forEach(function (q, i) { d['entry.' + q.entry] = resp[i]; });
      aviso(form, ''); alEnviar(form, [paso], momento + ' enviada ✓')(enviar(F.evaluacion.url, d));
    });
  }

  // Lo que escribió ella: quita las líneas y los títulos de la plantilla («Comunidad:», «1.», …) y cuenta lo demás.
  function escrito(txt, plantilla) {
    var lineas = plantilla.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var titulos = lineas.map(function (l) { return l.replace(/[:\s]+$/, '').toLowerCase(); });
    return txt.split('\n').reduce(function (n, l) {
      l = l.trim(); if (!l) return n;
      if (lineas.indexOf(l) >= 0) return n;
      var m = l.match(/^(.*?):(.*)$/); if (m && titulos.indexOf(m[1].trim().toLowerCase()) >= 0) l = m[2];
      l = l.replace(/^(\d+[.)]|→)\s*/, '').replace(/→/g, '').trim();
      return n + l.length;
    }, 0);
  }

  // La plantilla del taller se convierte en casillas: un título = una caja; «1.» = una línea por elemento; «1. →» = dos casillas;
  // un título en MAYÚSCULAS sin «:» = encabezado de bloque. Nada que la participante pueda descuadrar.
  function apartados(plantilla) {
    var out = [], lineas = plantilla.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    lineas.forEach(function (l) {
      var m = l.match(/^(\d+)[.)]\s*(→)?\s*$/);
      var ult = out[out.length - 1];
      if (m && ult && ult.tipo !== 'bloque') {
        if (m[2]) { ult.tipo = 'pares'; ult.n = (ult.n || 0) + 1; } else { ult.tipo = ult.tipo === 'pares' ? 'pares' : 'lista'; ult.n = (ult.n || 0) + 1; }
      } else if (!/[:?]$/.test(l) && l === l.toUpperCase()) out.push({ tipo: 'bloque', titulo: l });
      else out.push({ tipo: 'texto', titulo: l.replace(/:$/, '') });
    });
    return out;
  }
  function formActividad() {
    var caja = $('#nf-act'); if (!caja || !F || !yo) return;
    if (estado.entregaAct) return hecho(caja, 'Actividad práctica entregada.');
    if (caja.dataset.listo) return;
    var a = F.entrega.actividad, ap = apartados(T.plantilla || ''), clave = claveEstado(T.taller) + '.bact2', borr = leer(clave, {});
    if (!ap.length) ap = [{ tipo: 'texto', titulo: 'Su actividad' }];
    var html = '', k = 0;
    ap.forEach(function (x, i) {
      if (x.tipo === 'bloque') { html += '<p class="ap-bloque">' + esc(x.titulo.charAt(0) + x.titulo.slice(1).toLowerCase()) + '</p>'; return; }
      var cuerpo = '';
      if (x.tipo === 'texto') { var id = 'a' + i; cuerpo = '<textarea name="' + id + '" rows="2">' + esc(borr[id] || '') + '</textarea>'; }
      else if (x.tipo === 'lista') { for (var j = 0; j < x.n; j++) { var id2 = 'a' + i + '_' + j; cuerpo += '<div class="ap-linea"><span class="ap-num">' + (j + 1) + '</span><input name="' + id2 + '" value="' + esc(borr[id2] || '') + '"></div>'; } }
      else { for (var q = 0; q < x.n; q++) { var p1 = 'a' + i + '_' + q + 'a', p2 = 'a' + i + '_' + q + 'b';
        cuerpo += '<div class="ap-par"><span class="ap-num">' + (q + 1) + '</span><input name="' + p1 + '" placeholder="Pregunta que culpa" value="' + esc(borr[p1] || '') + '"><span class="ap-flecha" aria-hidden="true">→</span><input name="' + p2 + '" placeholder="Cómo la reformularía" value="' + esc(borr[p2] || '') + '"></div>'; } }
      html += '<div class="campo ap"><p class="campo-etq">' + esc(x.titulo) + '</p>' + cuerpo + '</div>';
    });
    caja.innerHTML = '<form class="fnativo" novalidate>' + html + '<p class="campo-ayuda">Lo que escriba se queda guardado en este celular o computadora, aunque cierre la página.</p>'
      + '<p class="form-aviso" hidden></p><button class="btn" type="submit" data-texto="Entregar esta actividad">Entregar esta actividad</button></form>';
    caja.dataset.listo = '1';
    var form = caja.querySelector('form');
    form.addEventListener('input', function () { var o = {}; $$('input, textarea', form).forEach(function (e) { o[e.name] = e.value; }); guardar(clave, o); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = function (n) { return (form.elements[n] ? form.elements[n].value : '').trim(); };
      var falta = null, partes = [];
      ap.forEach(function (x, i) {
        if (x.tipo === 'bloque') { partes.push(x.titulo); return; }
        if (x.tipo === 'texto') { var v = val('a' + i); if (!v && !falta) falta = x.titulo; partes.push(x.titulo + ': ' + v); return; }
        var lineas = [], llenas = 0;
        for (var j = 0; j < x.n; j++) {
          var t = x.tipo === 'lista' ? val('a' + i + '_' + j) : [val('a' + i + '_' + j + 'a'), val('a' + i + '_' + j + 'b')].filter(Boolean).join(' → ');
          var completa = x.tipo === 'lista' ? !!t : (val('a' + i + '_' + j + 'a') && val('a' + i + '_' + j + 'b'));
          if (completa) llenas++;
          if (t) lineas.push((j + 1) + '. ' + t);
        }
        var minimo = x.n >= 4 ? 2 : x.n;               // listas largas: al menos dos; cortas («dos acciones»): todas
        if (llenas < minimo && !falta) falta = x.titulo + (x.n >= 4 ? ' (al menos 2)' : '');
        partes.push(x.titulo + ':\n' + lineas.join('\n'));
      });
      if (falta) return aviso(form, 'Falta llenar: «' + falta + '».');
      var d = quien(F.entrega.campos); d['entry.' + a.entry] = partes.join('\n\n');
      aviso(form, ''); alEnviar(form, ['entregaAct'], 'Actividad entregada ✓')(enviar(F.entrega.url, d));
    });
  }

  function formCaso() {
    var caja = $('#nf-caso'); if (!caja || !F || !yo) return;
    if (estado.entregaCaso) return hecho(caja, 'Respuestas al caso entregadas.');
    if (caja.dataset.listo) return;
    var borr = leer(claveEstado(T.taller) + '.bcaso', {});
    var html = F.entrega.caso.map(function (q, i) { return campo(esc(q.titulo), '<textarea name="q' + i + '" rows="4">' + esc(borr['q' + i] || '') + '</textarea>'); }).join('');
    caja.innerHTML = '<form class="fnativo" novalidate>' + html + '<p class="form-aviso" hidden></p><button class="btn" type="submit" data-texto="Entregar el caso">Entregar el caso</button></form>';
    caja.dataset.listo = '1';
    var form = caja.querySelector('form');
    form.addEventListener('input', function () { var o = {}; F.entrega.caso.forEach(function (q, i) { o['q' + i] = form['q' + i].value; }); guardar(claveEstado(T.taller) + '.bcaso', o); });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var resp = F.entrega.caso.map(function (q, i) { return form['q' + i].value.trim(); });
      var falta = resp.findIndex(function (r) { return r.length < 2; });
      if (falta >= 0) return aviso(form, 'Falta responder la pregunta ' + (falta + 1) + '.');
      var d = quien(F.entrega.campos); F.entrega.caso.forEach(function (q, i) { d['entry.' + q.entry] = resp[i]; });
      aviso(form, ''); alEnviar(form, ['entregaCaso'], 'Caso entregado ✓')(enviar(F.entrega.url, d));
    });
  }

  function pintar() {
    var s = estado, z = A.zoom[T.taller] || {};
    s.entrega = !!(s.entregaAct && s.entregaCaso);
    pintarZoom(z);
    if (s.registro) ponerPaso('registro', 'hecho', 'Registrada');
    else if (!yo || antes(T.registro_abre)) ponerPaso('registro', 'bloqueado', '');
    else if (despues(T.registro_cierra)) ponerPaso('registro', 'cerrado', 'El registro de este día ya cerró');
    else ponerPaso('registro', 'disponible', 'Pendiente');
    if (s.inicial) ponerPaso('inicial', 'hecho', 'Contestada');
    else if (!s.registro) ponerPaso('inicial', 'bloqueado', '');
    else ponerPaso('inicial', 'disponible', 'Pendiente');
    if (s.entrega) ponerPaso('asincronica', 'hecho', 'Entregada');
    else if (!s.registro || !s.inicial || antes(T.asinc_abre)) ponerPaso('asincronica', 'bloqueado', '');
    else if (despues(T.asinc_cierra)) ponerPaso('asincronica', 'cerrado', 'La plataforma ya cerró');
    else ponerPaso('asincronica', 'disponible', s.entregaAct || s.entregaCaso ? 'Falta una parte' : 'Pendiente');
    if (s.final) ponerPaso('final', 'hecho', 'Contestada');
    else if (!s.entrega) ponerPaso('final', 'bloqueado', '');
    else ponerPaso('final', 'disponible', 'Pendiente');
    var ea = $('#est-act'), ec = $('#est-caso');
    if (ea) { ea.textContent = s.entregaAct ? 'Entregada' : 'Pendiente'; ea.className = 'tarjeta-estado' + (s.entregaAct ? ' ok' : ''); }
    if (ec) { ec.textContent = s.entregaCaso ? 'Entregado' : 'Pendiente'; ec.className = 'tarjeta-estado' + (s.entregaCaso ? ' ok' : ''); }
    var hechos = [s.registro, s.inicial, s.entrega, s.final].filter(Boolean).length;
    $('#progreso-relleno').style.width = (hechos * 100 / 4) + '%';
    $('#progreso-texto').textContent = hechos === 4 ? 'Taller completado' : hechos + ' de 4 pasos';
    var completo = s.inicial && s.registro && s.entrega && s.final;
    $('#constancia').hidden = !completo && !REVISION;
    if (REVISION) $$('.paso').forEach(function (li) { if (li.dataset.estado !== 'hecho') { li.dataset.estado = 'disponible'; li.querySelector('.paso-estado').textContent = 'Revisión'; } });
    if (completo && !s.completo) { s.completo = true; guardarEstado(); }
    formRegistro(); formEvaluacion('Evaluación inicial'); formActividad(); formCaso(); formEvaluacion('Evaluación final');
    plegar();
  }

  // Pasos plegables: abierto solo el que toca (el primero disponible y sin hacer); la persona puede abrir y cerrar cualquiera.
  var abiertoAMano = {};
  function plegar() {
    var toca = $$('.paso').find(function (li) { return li.dataset.estado === 'disponible'; });
    $$('.paso').forEach(function (li) {
      var abierto = li.id in abiertoAMano ? abiertoAMano[li.id] : li === toca;
      li.classList.toggle('abierto', abierto);
      var b = li.querySelector('.paso-abrir'); if (b) b.setAttribute('aria-expanded', String(abierto));
    });
  }
  $$('.paso-abrir').forEach(function (b) {
    b.addEventListener('click', function () { var li = b.closest('.paso'); abiertoAMano[li.id] = !li.classList.contains('abierto'); plegar(); });
  });

  function pintarZoom(z) {
    var est = $('#zoom-estado'), b = $('#btn-zoom'), web = $('#btn-zoom-web'), grab = $('#grabacion');
    var url = z.enlace || '';
    var m = url.match(/zoom\.us\/j\/(\d+)(\?pwd=[\w.-]+)?/);
    var activo = !!(yo && url);                                       // la reunión no tiene fecha fija: se entra cuando haga falta
    if (!url) est.textContent = 'El enlace de la sesión se publica aquí antes del día de la sesión.';
    else if (antes(T.zoom_abre)) est.textContent = 'La sala se abre 15 minutos antes de empezar. Al entrar, espere a que la dejen pasar.';
    else if (despues(T.zoom_fin)) est.textContent = 'La sesión en vivo ya terminó. Continúe con la sesión asincrónica.';
    else est.textContent = 'La sesión es hoy de 10:00 a 14:00. Entre ahora; espere a que la dejen pasar.';
    var dz = $('#zoom-datos');
    if (dz) dz.innerHTML = url ? '¿No le llegó el enlace? <a href="' + url + '" target="_blank" rel="noopener">Entrar a la sesión de Zoom</a>' + (z.id ? ' · ID: <b>' + z.id + '</b>' : '') + (z.clave ? ' · Clave: <b>' + z.clave + '</b>' : '') : '';
    if (activo) { b.href = url; b.classList.remove('pendiente'); b.removeAttribute('aria-disabled'); }
    else { b.removeAttribute('href'); b.classList.add('pendiente'); b.setAttribute('aria-disabled', 'true'); }
    web.hidden = !(activo && m);
    if (m) web.href = 'https://app.zoom.us/wc/join/' + m[1] + (m[2] || '');
    grab.innerHTML = '';
    if (z.grabacion) {
      var a = document.createElement('a'); a.href = z.grabacion; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn btn-sec'; a.textContent = 'Ver la grabación';
      grab.appendChild(a);
    } else grab.textContent = 'Se publica aquí después de la sesión, por si quiere volver a verla.';
  }

  // ---------- confirmación con Google (JSONP, sin cuenta). Lo recién enviado se da por hecho hasta 2 minutos; si Google
  // no lo confirma en ese tiempo, se avisa para que lo vuelva a enviar.
  var enCurso = false, PASOS = ['registro', 'inicial', 'entregaAct', 'entregaCaso', 'final'];
  var NOMBRES = { registro: 'el registro de asistencia', inicial: 'la evaluación inicial', entregaAct: 'la actividad práctica', entregaCaso: 'las respuestas al caso', final: 'la evaluación final' };
  function comprobar() {
    if (!yo || !A.api || enCurso) return;
    enCurso = true;
    var cb = 'aulaC6_' + Date.now(), s = document.createElement('script');
    var limpiar = function () { enCurso = false; try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); };
    var reloj = setTimeout(limpiar, 20000);
    window[cb] = function (r) {
      clearTimeout(reloj); limpiar();
      if (!r || !r.ok) return;
      var ahora = Date.now(), perdidos = [];
      PASOS.forEach(function (k) {
        if (r[k]) { estado[k] = true; delete PEND[k]; }
        else if (PEND[k] && ahora - PEND[k] < 120000) estado[k] = true;
        else { if (PEND[k]) { perdidos.push(k); delete PEND[k]; var caja = $('#nf-' + { registro: 'registro', inicial: 'inicial', entregaAct: 'act', entregaCaso: 'caso', final: 'final' }[k]); if (caja) delete caja.dataset.listo; } estado[k] = false; }
      });
      guardarEstado(); pintar();
      if (perdidos.length) toast('No nos llegó ' + perdidos.map(function (k) { return NOMBRES[k]; }).join(' ni ') + '. Envíelo de nuevo, por favor.');
    };
    s.src = A.api + '?tel=' + yo.tel + '&correo=' + encodeURIComponent(yo.correo) + '&taller=' + T.taller + '&nombre=' + encodeURIComponent(yo.nombre) + '&callback=' + cb;
    s.onerror = function () { clearTimeout(reloj); limpiar(); };
    document.body.appendChild(s);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') comprobar(); });
  setInterval(pintarZoom.bind(null, A.zoom[T.taller] || {}), 30000);

  // ---------- «Escuchar»: audio grabado con voz de mujer (es-MX), uno por bloque: audio/tN_{lectura,actividad,caso}.mp3
  var TIPO = { '#txt-lectura': 'lectura', '#txt-act': 'actividad', '#txt-caso': 'caso' };
  $$('.escuchar').forEach(function (b) {
    var tipo = TIPO[b.dataset.leer]; if (!tipo) { b.hidden = true; return; }
    var au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.hidden = true; au.className = 'audio-bloque';
    au.src = 'audio/t' + T.taller + '_' + tipo + '.mp3';
    b.insertAdjacentElement('afterend', au);
    var txt = b.querySelector('.esc-txt');
    au.addEventListener('play', function () { $$('audio.audio-bloque').forEach(function (o) { if (o !== au) o.pause(); }); b.classList.add('activo'); txt.textContent = 'Pausar'; });
    au.addEventListener('pause', function () { b.classList.remove('activo'); txt.textContent = au.ended ? 'Escuchar de nuevo' : 'Seguir escuchando'; });
    au.addEventListener('error', function () { b.hidden = true; au.hidden = true; });
    b.addEventListener('click', function () { au.hidden = false; if (au.paused) au.play(); else au.pause(); });
  });

  pintar();
  if (REVISION) avisoRevision();
  if (!yo) pedirIdentidad(); else comprobar();
})();
