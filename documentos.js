// =====================================================================
// AVIPET — Sistema de Documentos de Empleados
// Colecciones: empleados_rh, documentos_empleados, tipos_documentos_custom
// =====================================================================

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  query, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Constantes ──────────────────────────────────────────────────────
const COL_EMP   = 'empleados_rh';
const COL_DOCS  = 'documentos_empleados';
const COL_TIPOS = 'tipos_documentos_custom';

const EMPRESA_DEFECTO = 'AVIPET';

// Plantillas integradas — define qué campos tiene cada tipo
const PLANTILLAS_BASE = {
  carta_trabajo: {
    label: '📋 Carta de Trabajo',
    campos: [
      { id: 'empresa',        label: 'Empresa',          auto: 'empresa',       tipo: 'text' },
      { id: 'nombre',         label: 'Nombre del empleado', auto: 'nombre',     tipo: 'text' },
      { id: 'ci',             label: 'Cédula de identidad', auto: 'ci',         tipo: 'text' },
      { id: 'cargo',          label: 'Cargo',            auto: 'cargo',         tipo: 'text' },
      { id: 'fechaIngreso',   label: 'Fecha de ingreso', auto: 'fechaIngreso',  tipo: 'date' },
      { id: 'firmadoPor',     label: 'Firmado por',      auto: '',              tipo: 'text' },
      { id: 'lugarFecha',     label: 'Lugar y fecha',    auto: 'hoy',           tipo: 'text' },
    ],
  },
  permiso: {
    label: '🚪 Permiso de Ausencia',
    campos: [
      { id: 'nombre',         label: 'Empleado',         auto: 'nombre',        tipo: 'text' },
      { id: 'ci',             label: 'Cédula',           auto: 'ci',            tipo: 'text' },
      { id: 'cargo',          label: 'Cargo',            auto: 'cargo',         tipo: 'text' },
      { id: 'fechaInicio',    label: 'Fecha inicio',     auto: '',              tipo: 'date' },
      { id: 'fechaFin',       label: 'Fecha fin',        auto: '',              tipo: 'date' },
      { id: 'motivo',         label: 'Motivo',           auto: '',              tipo: 'textarea' },
      { id: 'goce',           label: 'Con goce de sueldo', auto: 'Si',         tipo: 'select', opciones: ['Si','No'] },
      { id: 'aprobadoPor',    label: 'Aprobado por',     auto: '',              tipo: 'text' },
    ],
  },
  constancia_ingresos: {
    label: '💵 Constancia de Ingresos',
    campos: [
      { id: 'empresa',        label: 'Empresa',          auto: 'empresa',       tipo: 'text' },
      { id: 'nombre',         label: 'Nombre',           auto: 'nombre',        tipo: 'text' },
      { id: 'ci',             label: 'Cédula',           auto: 'ci',            tipo: 'text' },
      { id: 'cargo',          label: 'Cargo',            auto: 'cargo',         tipo: 'text' },
      { id: 'salario',        label: 'Salario mensual',  auto: '',              tipo: 'text' },
      { id: 'fechaIngreso',   label: 'Trabaja desde',    auto: 'fechaIngreso',  tipo: 'date' },
      { id: 'lugarFecha',     label: 'Lugar y fecha',    auto: 'hoy',           tipo: 'text' },
    ],
  },
  memorandum: {
    label: '📝 Memorándum',
    campos: [
      { id: 'para',           label: 'Para',             auto: 'nombre',        tipo: 'text' },
      { id: 'de',             label: 'De',               auto: '',              tipo: 'text' },
      { id: 'fecha',          label: 'Fecha',            auto: 'hoy',           tipo: 'text' },
      { id: 'asunto',         label: 'Asunto',           auto: '',              tipo: 'text' },
      { id: 'cuerpo',         label: 'Contenido',        auto: '',              tipo: 'textarea' },
    ],
  },
};

// ── Estado local ─────────────────────────────────────────────────────
let _empleados        = [];   // { id, nombre, ci, cargo, fechaIngreso, telefono }
let _tiposCustom      = [];   // { id, label, campos }
let _empSelId         = null;
let _tipoSel          = null;
let _docActual        = null; // último documento cargado
let _modoHistorial    = false;

// ── Helpers ──────────────────────────────────────────────────────────
function _hoy() {
  const d = new Date();
  return d.toLocaleDateString('es-VE', { day:'2-digit', month:'long', year:'numeric' });
}

function _tiposDisponibles() {
  const base = Object.entries(PLANTILLAS_BASE).map(([id, p]) => ({ id, label: p.label, campos: p.campos, custom: false }));
  return [...base, ..._tiposCustom.map(t => ({ ...t, custom: true }))];
}

function _plantillaCampos(tipoId) {
  const tipos = _tiposDisponibles();
  const tipo  = tipos.find(t => t.id === tipoId);
  return tipo ? tipo.campos : [];
}

function _empActual() {
  return _empleados.find(e => e.id === _empSelId) || null;
}

function _autoValor(autoKey, emp) {
  if (!autoKey) return '';
  if (autoKey === 'hoy')    return _hoy();
  if (autoKey === 'empresa') return EMPRESA_DEFECTO;
  return emp?.[autoKey] ?? '';
}

// ── Cargar datos ──────────────────────────────────────────────────────
async function _cargarEmpleados() {
  const snap = await getDocs(query(collection(db, COL_EMP), orderBy('nombre')));
  _empleados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _renderSelectEmp();
}

async function _cargarTiposCustom() {
  const snap = await getDocs(collection(db, COL_TIPOS));
  _tiposCustom = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  _renderSelectTipo();
}

// ── Render selects ────────────────────────────────────────────────────
function _renderSelectEmp() {
  const sel = document.getElementById('docSelectEmp');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Seleccionar empleado --</option>' +
    _empleados.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  if (_empSelId) sel.value = _empSelId;
}

function _renderSelectTipo() {
  const sel = document.getElementById('docSelectTipo');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Tipo de documento --</option>' +
    _tiposDisponibles().map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  if (_tipoSel) sel.value = _tipoSel;
}

// ── Generar formulario ────────────────────────────────────────────────
function _renderFormulario(tipoId, emp, contenidoPrevio) {
  const campos  = _plantillaCampos(tipoId);
  const area    = document.getElementById('docFormArea');
  if (!area || !campos.length) return;

  area.innerHTML = campos.map(c => {
    const val = contenidoPrevio?.[c.id] ?? _autoValor(c.auto, emp);

    if (c.tipo === 'textarea') {
      return `<div class="mb-3">
        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">${c.label}</label>
        <textarea id="docCampo_${c.id}" rows="3"
          class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium outline-none focus:border-blue-500 resize-y"
          placeholder="${c.label}">${val}</textarea>
      </div>`;
    }

    if (c.tipo === 'select') {
      const opts = (c.opciones || []).map(o =>
        `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
      return `<div class="mb-3">
        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">${c.label}</label>
        <select id="docCampo_${c.id}"
          class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500 bg-white">
          ${opts}
        </select>
      </div>`;
    }

    return `<div class="mb-3">
      <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">${c.label}</label>
      <input id="docCampo_${c.id}" type="${c.tipo === 'date' ? 'date' : 'text'}" value="${val}"
        class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium outline-none focus:border-blue-500">
    </div>`;
  }).join('');
}

function _leerFormulario(tipoId) {
  const campos  = _plantillaCampos(tipoId);
  const contenido = {};
  campos.forEach(c => {
    const el = document.getElementById(`docCampo_${c.id}`);
    contenido[c.id] = el ? el.value.trim() : '';
  });
  return contenido;
}

// ── Cargar documento existente ────────────────────────────────────────
async function _cargarDocumento(empId, tipoId) {
  const docId = `${empId}_${tipoId}`;
  const ref   = doc(db, COL_DOCS, docId);
  const snap  = await getDoc(ref);
  _docActual  = snap.exists() ? { id: docId, ...snap.data() } : null;
  return _docActual;
}

// ── Guardar documento ─────────────────────────────────────────────────
async function _guardarDocumento(empId, tipoId, contenido) {
  const emp   = _empActual();
  const docId = `${empId}_${tipoId}`;
  const ref   = doc(db, COL_DOCS, docId);
  const now   = Timestamp.now();

  const entrada = {
    version:   (_docActual?.historial?.length ?? 0) + 1,
    fecha:     now,
    contenido: { ...contenido },
  };

  const payload = {
    empleadoId:     empId,
    empleadoNombre: emp?.nombre || '',
    tipo:           tipoId,
    contenido:      contenido,
    fechaUltima:    now,
    historial:      [...(_docActual?.historial ?? []), entrada],
  };

  await setDoc(ref, payload);
  _docActual = { id: docId, ...payload };
}

// ── Imprimir ──────────────────────────────────────────────────────────
// Reutiliza sectionHojaVacunas — mismo logo, RIF, membrete, doctor.
// Inyecta el contenido del documento en bloqueVacunas para que sea lo único que aparezca.
function _imprimirDocumento(tipoId, contenido, empleadoNombre) {
  const tipos   = _tiposDisponibles();
  const tipoObj = tipos.find(t => t.id === tipoId);
  const titulo  = tipoObj?.label?.replace(/^[^\s]+\s/, '') || 'Documento';

  const cuerpoHtml = _generarCuerpoDocumento(titulo, tipoId, contenido, empleadoNombre);

  // Actualizar título en sectionHojaVacunas
  const elTitulo = document.getElementById('tituloDocumentoDinámico');
  const elSub    = document.getElementById('tituloFormatoDinamico');
  if (elTitulo) elTitulo.innerText = titulo.toUpperCase();
  if (elSub)    elSub.innerText    = 'DOCUMENTO DE RECURSOS HUMANOS';

  // Inyectar cuerpo en bloqueVacunas, ocultar bloqueTests
  const bloqVac   = document.getElementById('bloqueVacunas');
  const bloqTests = document.getElementById('bloqueTests');
  if (bloqVac)   { bloqVac.innerHTML = cuerpoHtml; bloqVac.classList.remove('hidden'); }
  if (bloqTests) { bloqTests.classList.add('hidden'); }

  // Fecha de emisión
  const hv_fecha = document.getElementById('hv_fecha');
  if (hv_fecha) hv_fecha.value = _hoy();

  // Mostrar/ocultar secciones
  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  const alm  = document.getElementById('sectionAlmuerzo');
  if (alm)  alm.classList.add('hidden');
  if (hist) hist.classList.add('hidden');
  if (hv)   hv.classList.remove('hidden');

  window.print();

  setTimeout(() => {
    if (hv)   hv.classList.add('hidden');
    if (alm)  alm.classList.remove('hidden');
    // Limpiar bloqueVacunas para no dejar basura
    if (bloqVac) bloqVac.innerHTML = '';
  }, 500);
}

function _generarCuerpoDocumento(titulo, tipoId, contenido, empleadoNombre) {
  const campos = _plantillaCampos(tipoId);

  let cuerpoContent = '';

  if (tipoId === 'carta_trabajo') {
    cuerpoContent = `
      <p style="margin-bottom:14px;">Por medio de la presente, la empresa <strong>${contenido.empresa || EMPRESA_DEFECTO}</strong> hace constar que el/la ciudadano(a):</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
        <tr><td style="padding:6px 0;width:40%;color:#555;">Nombre y Apellido:</td><td style="padding:6px 0;font-weight:600;">${contenido.nombre || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Cédula de Identidad:</td><td style="padding:6px 4px;font-weight:600;">${contenido.ci || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Cargo:</td><td style="padding:6px 0;font-weight:600;">${contenido.cargo || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Fecha de ingreso:</td><td style="padding:6px 4px;font-weight:600;">${contenido.fechaIngreso || ''}</td></tr>
      </table>
      <p style="margin-bottom:28px;">Presta sus servicios de manera satisfactoria en nuestra institución desde la fecha indicada. La presente carta se emite a solicitud del interesado para los fines que estime convenientes.</p>
      <p style="margin-bottom:6px;"><strong>Atentamente,</strong></p>
      <br><br>
      <p style="border-top:1px solid #333;display:inline-block;padding-top:4px;min-width:200px;">${contenido.firmadoPor || ''}</p>
      <p style="font-size:11px;color:#555;">${contenido.lugarFecha || _hoy()}</p>`;

  } else if (tipoId === 'permiso') {
    cuerpoContent = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
        <tr><td style="padding:6px 0;width:40%;color:#555;">Empleado(a):</td><td style="padding:6px 0;font-weight:600;">${contenido.nombre || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Cédula:</td><td style="padding:6px 4px;font-weight:600;">${contenido.ci || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Cargo:</td><td style="padding:6px 0;font-weight:600;">${contenido.cargo || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Fecha inicio:</td><td style="padding:6px 4px;font-weight:600;">${contenido.fechaInicio || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Fecha fin:</td><td style="padding:6px 0;font-weight:600;">${contenido.fechaFin || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Goce de sueldo:</td><td style="padding:6px 4px;font-weight:600;">${contenido.goce || ''}</td></tr>
      </table>
      <p style="margin-bottom:8px;"><strong>Motivo:</strong></p>
      <p style="padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:28px;">${contenido.motivo || ''}</p>
      <br>
      <p style="border-top:1px solid #333;display:inline-block;padding-top:4px;min-width:200px;">${contenido.aprobadoPor || ''}</p>
      <p style="font-size:11px;color:#555;">Autorizado por</p>`;

  } else if (tipoId === 'constancia_ingresos') {
    cuerpoContent = `
      <p style="margin-bottom:14px;">Por medio de la presente, la empresa <strong>${contenido.empresa || EMPRESA_DEFECTO}</strong> hace constar que:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
        <tr><td style="padding:6px 0;width:40%;color:#555;">Nombre:</td><td style="padding:6px 0;font-weight:600;">${contenido.nombre || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Cédula:</td><td style="padding:6px 4px;font-weight:600;">${contenido.ci || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Cargo:</td><td style="padding:6px 0;font-weight:600;">${contenido.cargo || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:6px 4px;color:#555;">Trabaja desde:</td><td style="padding:6px 4px;font-weight:600;">${contenido.fechaIngreso || ''}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Salario mensual:</td><td style="padding:6px 0;font-weight:600;">${contenido.salario || ''}</td></tr>
      </table>
      <p style="margin-bottom:28px;">Constancia que se expide a solicitud del interesado para los fines que estime conveniente.</p>
      <p style="font-size:11px;color:#555;">${contenido.lugarFecha || _hoy()}</p>`;

  } else if (tipoId === 'memorandum') {
    cuerpoContent = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
        <tr><td style="padding:5px 0;width:15%;color:#555;font-weight:700;">PARA:</td><td style="padding:5px 0;">${contenido.para || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:5px 4px;font-weight:700;">DE:</td><td style="padding:5px 4px;">${contenido.de || ''}</td></tr>
        <tr><td style="padding:5px 0;font-weight:700;">FECHA:</td><td style="padding:5px 0;">${contenido.fecha || ''}</td></tr>
        <tr style="background:#f8f8f8;"><td style="padding:5px 4px;font-weight:700;">ASUNTO:</td><td style="padding:5px 4px;font-weight:600;">${contenido.asunto || ''}</td></tr>
      </table>
      <hr style="border:1px solid #333;margin-bottom:16px;">
      <p style="white-space:pre-wrap;font-size:12px;">${contenido.cuerpo || ''}</p>`;

  } else {
    // Tipo custom: mostrar todos los campos como tabla
    const campos = _plantillaCampos(tipoId);
    const filas = campos.map((c, i) => `
      <tr${i % 2 === 1 ? ' style="background:#f8f8f8;"' : ''}>
        <td style="padding:6px 4px;width:40%;color:#555;">${c.label}:</td>
        <td style="padding:6px 4px;font-weight:600;">${contenido[c.id] || ''}</td>
      </tr>`).join('');
    cuerpoContent = `<table style="width:100%;border-collapse:collapse;font-size:12px;">${filas}</table>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;padding:8px 0;">
      <div style="border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:12px;font-weight:900;text-transform:uppercase;color:#1e3a5f;">${titulo.toUpperCase()}</span>
        <span style="font-size:10px;color:#64748b;">Empleado: <b>${empleadoNombre}</b></span>
      </div>
      <div style="font-size:12px;line-height:1.7;">${cuerpoContent}</div>
      <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:9px;color:#aaa;text-align:center;">
        AVIPET · Documento generado el ${_hoy()}
      </div>
    </div>`;
}

// ── Historial UI ──────────────────────────────────────────────────────
function _mostrarHistorial(doc_) {
  const area = document.getElementById('docHistorialArea');
  if (!area) return;

  if (!doc_?.historial?.length) {
    area.innerHTML = '<p class="text-[10px] text-slate-400 italic text-center py-4">Sin historial para este documento.</p>';
    return;
  }

  area.innerHTML = doc_.historial.slice().reverse().map((h, i) => {
    const fecha = h.fecha?.toDate ? h.fecha.toDate().toLocaleString('es-VE') : '—';
    return `<div class="border border-slate-200 rounded-xl p-3 mb-2 bg-white">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[10px] font-black text-purple-600">Versión ${h.version}</span>
        <span class="text-[9px] text-slate-400">${fecha}</span>
      </div>
      <div class="flex gap-2">
        <button onclick="window.docVerVersion(${doc_.historial.length - 1 - i})"
          class="text-[10px] font-black text-blue-600 underline">Ver campos</button>
        <button onclick="window.docRestaurarVersion(${doc_.historial.length - 1 - i})"
          class="text-[10px] font-black text-emerald-600 underline">Usar esta versión</button>
      </div>
    </div>`;
  }).join('');
}

// ── Inicializar módulo ────────────────────────────────────────────────
let _inicializado = false;

window.iniciarDocumentos = async () => {
  if (!document.getElementById('panelDocumentos')) return;
  if (_inicializado) { _renderSelectEmp(); _renderSelectTipo(); return; }
  _inicializado = true;

  await Promise.all([_cargarEmpleados(), _cargarTiposCustom()]);

  _renderSelectEmp();
  _renderSelectTipo();
};

// Llamadas desde los selects vía _llamarFuncion
window._docOnEmpChange = async () => {
  const sel = document.getElementById('docSelectEmp');
  _empSelId = sel?.value || null;
  _docActual = null;
  if (_empSelId && _tipoSel) {
    await _cargarDocumento(_empSelId, _tipoSel);
    _renderFormulario(_tipoSel, _empActual(), _docActual?.contenido || null);
    _mostrarSeccionDoc(true);
    _mostrarHistorial(_docActual);
  }
};

window._docOnTipoChange = async () => {
  const sel = document.getElementById('docSelectTipo');
  _tipoSel = sel?.value || null;
  _docActual = null;
  if (_empSelId && _tipoSel) {
    await _cargarDocumento(_empSelId, _tipoSel);
    _renderFormulario(_tipoSel, _empActual(), _docActual?.contenido || null);
    _mostrarSeccionDoc(true);
    _mostrarHistorial(_docActual);
  }
};

function _mostrarSeccionDoc(show) {
  const sec = document.getElementById('docSeccionEdicion');
  if (sec) sec.classList.toggle('hidden', !show);
}

// ── Funciones globales (llamadas desde HTML) ──────────────────────────

window.docGuardar = async () => {
  if (!_empSelId || !_tipoSel) {
    Swal?.fire({ icon:'warning', title:'Faltan datos', text:'Selecciona empleado y tipo de documento.', timer:2000, showConfirmButton:false });
    return;
  }
  const contenido = _leerFormulario(_tipoSel);
  const btn = document.getElementById('docBtnGuardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    await _guardarDocumento(_empSelId, _tipoSel, contenido);
    _mostrarHistorial(_docActual);
    Swal?.fire({ icon:'success', title:'Guardado', timer:1500, showConfirmButton:false });
  } catch(e) {
    Swal?.fire({ icon:'error', title:'Error', text:e.message });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
  }
};

window.docImprimir = () => {
  if (!_empSelId || !_tipoSel) return;
  const contenido = _leerFormulario(_tipoSel);
  const emp       = _empActual();
  _imprimirDocumento(_tipoSel, contenido, emp?.nombre || '');
};

window.docVerVersion = (idx) => {
  if (!_docActual?.historial?.[idx]) return;
  const entrada = _docActual.historial[idx];
  _renderFormulario(_tipoSel, _empActual(), entrada.contenido);
};

window.docRestaurarVersion = (idx) => {
  if (!_docActual?.historial?.[idx]) return;
  const entrada = _docActual.historial[idx];
  _renderFormulario(_tipoSel, _empActual(), entrada.contenido);
  Swal?.fire({ icon:'info', title:'Versión cargada', text:'Pulsa Guardar para aplicarla.', timer:2000, showConfirmButton:false });
};

window.docAgregarEmpleado = async () => {
  const nombre     = document.getElementById('docNuevoNombre')?.value.trim();
  const ci         = document.getElementById('docNuevoCi')?.value.trim();
  const cargo      = document.getElementById('docNuevoCargo')?.value.trim();
  const fecha      = document.getElementById('docNuevaFecha')?.value.trim();
  const telefono   = document.getElementById('docNuevoTel')?.value.trim();

  if (!nombre) {
    Swal?.fire({ icon:'warning', title:'Nombre requerido', timer:1800, showConfirmButton:false });
    return;
  }

  await addDoc(collection(db, COL_EMP), { nombre, ci: ci||'', cargo: cargo||'', fechaIngreso: fecha||'', telefono: telefono||'', activo: true });
  // limpiar
  ['docNuevoNombre','docNuevoCi','docNuevoCargo','docNuevaFecha','docNuevoTel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const modal = document.getElementById('docModalEmp');
  if (modal) modal.classList.add('hidden');
  await _cargarEmpleados();
  Swal?.fire({ icon:'success', title:'Empleado agregado', timer:1500, showConfirmButton:false });
};

window.docEliminarEmpleado = async (id) => {
  const ok = await Swal?.fire({
    icon:'warning', title:'¿Eliminar empleado?',
    showCancelButton:true, confirmButtonText:'Sí, eliminar', cancelButtonText:'Cancelar'
  });
  if (!ok?.isConfirmed) return;
  await deleteDoc(doc(db, COL_EMP, id));
  await _cargarEmpleados();
};

window.docAgregarTipo = async () => {
  const label = document.getElementById('docNuevoTipoLabel')?.value.trim();
  if (!label) return;

  // Campos básicos para tipo custom: solo un campo de texto libre "contenido"
  const camposBase = [
    { id: 'descripcion', label: 'Descripción / Contenido', auto: '', tipo: 'textarea' },
    { id: 'firmadoPor',  label: 'Firmado por',             auto: '', tipo: 'text' },
    { id: 'fecha',       label: 'Fecha',                   auto: 'hoy', tipo: 'text' },
  ];

  const ref = await addDoc(collection(db, COL_TIPOS), { label: `📄 ${label}`, campos: camposBase });
  const el  = document.getElementById('docNuevoTipoLabel');
  if (el) el.value = '';
  const modal = document.getElementById('docModalTipo');
  if (modal) modal.classList.add('hidden');
  await _cargarTiposCustom();
  _renderSelectTipo();
  Swal?.fire({ icon:'success', title:'Tipo agregado', timer:1500, showConfirmButton:false });
};

window.docToggleModalEmp  = () => document.getElementById('docModalEmp')?.classList.toggle('hidden');
window.docToggleModalTipo = () => document.getElementById('docModalTipo')?.classList.toggle('hidden');
window.docToggleHistorial = () => {
  const sec = document.getElementById('docHistorialSec');
  if (sec) sec.classList.toggle('hidden');
};
