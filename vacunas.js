// =========================================================
// AVIPET — vacunas.js
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─────────────────────────────────────────────
// AUTOCOMPLETAR CAMPOS hv_* POR CÉDULA DEL DUEÑO
// ─────────────────────────────────────────────
window.autocompletarTarjeta = async (ci) => {
  if (!ci || ci.length < 3) return;
  const _norm = (s) => (s||'').replace(/[\s.\-]/g,'').toUpperCase();
  const ciNorm = _norm(ci);
  const ciOrig = ci.trim();
  const variantes = [...new Set([ciNorm, ciOrig, 'V'+ciNorm, 'V-'+ciNorm,
    ...(/^[VEJPvejp]/.test(ciNorm) ? [ciNorm.slice(1)] : [])])].filter(v=>v.length>=3);

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) { el.value = val; el.style.background='#eff6ff'; setTimeout(()=>el.style.background='',1000); }
  };
  try {
    let snap = null;
    for (const v of variantes) {
      const s = await getDocs(query(collection(db,"consultas"), where("cedula","==",v), limit(5)));
      if (!s.empty) { snap = s; break; }
    }
    if (!snap || snap.empty) { alert("No se encontró ningún paciente con esa cédula."); return; }
    const r = snap.docs[0].data();
    set('hv_paciente',    r.paciente);
    set('hv_especie',     r.especie);
    set('hv_raza',        r.raza);
    set('hv_edad',        r.edad);
    set('hv_sexo',        r.sexo);
    set('hv_color',       r.color);
    set('hv_peso',        r.peso);
    set('hv_propietario', r.propietario);
    set('hv_cedula',      r.cedula || ciNorm);
    set('hv_telefono',    r.telefono);
    set('hv_direccion',   r.direccion);
    if (r.fechaNacimiento) set('hv_fechaNacimiento', r.fechaNacimiento);
  } catch(e) { console.warn('[autocompletarTarjeta]', e); }
};

// ─────────────────────────────────────────────
// CAMBIAR TIPO DE FORMATO
// ─────────────────────────────────────────────
window.cambiarTipoFormato = (valor) => {
  const tituloDoc = document.getElementById('tituloDocumentoDinámico');
  const subtitulo = document.getElementById('tituloFormatoDinamico');
  const bloqVac   = document.getElementById('bloqueVacunas');
  const bloqTests = document.getElementById('bloqueTests');
  if (!bloqVac || !bloqTests) return;

  if (valor === 'vacunas') {
    if (tituloDoc) tituloDoc.innerText = 'Tarjeta de Vacunación y Desparasitación';
    if (subtitulo) subtitulo.innerText = 'CONTROL DE VACUNAS';
    bloqVac.classList.remove('hidden');
    bloqTests.classList.add('hidden');
  } else if (valor === 'test_rapido') {
    if (tituloDoc) tituloDoc.innerText = 'Certificado de Diagnóstico Rápido';
    if (subtitulo) subtitulo.innerText = 'RESULTADOS DE LABORATORIO';
    bloqVac.classList.add('hidden');
    bloqTests.classList.remove('hidden');
  }
};

// ─────────────────────────────────────────────
// AGREGAR FILA DE TEST
// ─────────────────────────────────────────────
window.agregarFilaTest = (nombre) => {
  if (!nombre) return;
  const tabla = document.getElementById('cuerpoTablaCertificado');
  if (!tabla) return;
  const fila = document.createElement('tr');
  fila.className = "border-b border-slate-400 bg-white";
  fila.innerHTML = `
    <td class="px-3 py-2 font-bold uppercase italic text-slate-800 align-top">
      ${nombre === "OTRO"
        ? `<input type="text" class="w-full border-b border-blue-300 outline-none bg-transparent" placeholder="NOMBRE DEL TEST...">`
        : `<span>${nombre}</span>`}
    </td>
    <td class="px-2 py-2 text-center border-l border-r border-slate-200 relative align-top">
      <select class="print:hidden font-black text-[11px] border rounded p-1 uppercase outline-none bg-white w-full cursor-pointer"
              onchange="
                const espejo = this.parentElement.querySelector('.resultado-print');
                const valor  = this.value;
                espejo.innerText = valor;
                const color  = valor.includes('POSITIVO') ? '#dc2626' : valor.includes('NEGATIVO') ? '#16a34a' : 'black';
                this.style.color = color; espejo.style.color = color;">
        <option value="---">---</option>
        <option value="NEGATIVO (-)">NEGATIVO (-)</option>
        <option value="POSITIVO (+)">POSITIVO (+)</option>
        <option value="INVALIDO">INVALIDO</option>
      </select>
      <span class="resultado-print font-black text-[12px] uppercase text-center" style="display:none;">---</span>
    </td>
    <td class="px-2 py-2 border-l border-slate-300 align-top">
      <textarea rows="2" class="obs-textarea w-full outline-none text-[10px] bg-transparent italic resize-none overflow-hidden"
        placeholder="Nota..."
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';this.parentElement.querySelector('.obs-print').innerText=this.value;"></textarea>
      <span class="obs-print text-[10px] italic whitespace-pre-wrap break-words" style="display:none;"></span>
    </td>
    <td class="no-print px-2 py-2 text-center align-top">
      <button onclick="this.closest('tr').remove()" class="text-red-500 font-bold">✕</button>
    </td>`;
  tabla.appendChild(fila);
};

// ─────────────────────────────────────────────
// IMPRIMIR HOJA DE VACUNAS
// (con fecha de nacimiento)
// ─────────────────────────────────────────────
window.imprimirHojaVacunas = () => {
  // Autorrelleno de fecha de nacimiento antes de imprimir
  const fechaNac = document.getElementById('hFechaNac')?.value || "";
  const elFechaNacVac = document.getElementById('hv_fechaNacimiento');
  if (elFechaNacVac && !elFechaNacVac.value && fechaNac) {
    elFechaNacVac.value = fechaNac;
  }

  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  if (hv)   hv.classList.remove('hidden');
  if (hist) hist.classList.add('hidden');
  window.print();
  setTimeout(() => {
    if (hist) hist.classList.remove('hidden');
    if (hv)   hv.classList.add('hidden');
  }, 500);
};

// ─────────────────────────────────────────────
// IMPRIMIR HOJA DE TEST RÁPIDO
// (con fecha de nacimiento incluida)
// ─────────────────────────────────────────────
window.imprimirHojaTest = () => {
  const sel = document.getElementById('selectorTipoFormato');
  if (sel) sel.value = 'test_rapido';
  window.cambiarTipoFormato('test_rapido');

  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  const sec  = document.getElementById('sectionHojaTest');

  if (sec)  sec.classList.add('hidden');
  if (hv)   hv.classList.remove('hidden');
  if (hist) hist.classList.add('hidden');

  // Copiar imágenes del test al documento para que aparezcan al imprimir
  const bloqTests = document.getElementById('bloqueTests');
  const galPrev   = document.getElementById('previewTestGallery');
  const imgs      = galPrev ? Array.from(galPrev.querySelectorAll('img')).filter(i => i.src && i.src !== window.location.href) : [];

  // Contenedor de imágenes: lo sacamos del bloqueTests (que tiene hidden) y lo ponemos directo en hv
  let imgCont = document.getElementById('_testImgPrintCont');
  if (!imgCont) {
    imgCont = document.createElement('div');
    imgCont.id = '_testImgPrintCont';
  }
  imgCont.style.cssText = 'display:block;text-align:center;margin-top:16px;page-break-inside:avoid;';
  imgCont.innerHTML = '';
  // Insertar ANTES del footer para que quede dentro del área de impresión
  const hvFooter = hv?.querySelector('footer');
  if (hvFooter) hv.insertBefore(imgCont, hvFooter);
  else if (hv) hv.appendChild(imgCont);

  if (imgs.length > 0) {
    imgCont.innerHTML = '<p style="font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Evidencia / Cassette</p>';
    const flex = document.createElement('div');
    flex.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';
    imgs.forEach(img => {
      const w = document.createElement('div');
      w.style.cssText = 'max-width:45%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;';
      const newImg = document.createElement('img');
      newImg.src = img.src;
      newImg.style.cssText = 'width:100%;max-height:280px;object-fit:contain;display:block;';
      w.appendChild(newImg);
      flex.appendChild(w);
    });
    imgCont.appendChild(flex);
  }

  // Esperar a que las imágenes carguen antes de imprimir
  const _doPrint = () => {
    window.print();
    setTimeout(() => {
      if (hist) hist.classList.remove('hidden');
      if (hv)   hv.classList.add('hidden');
      imgCont?.remove();
    }, 500);
  };

  if (imgs.length === 0) {
    _doPrint();
  } else {
    // Verificar que todas las imágenes estén cargadas (importante para URLs de Firebase)
    const allImgs = document.getElementById('_testImgPrintCont')?.querySelectorAll('img') || [];
    let printed = false;
    const safePrint = () => { if (!printed) { printed = true; _doPrint(); } };
    let loaded = 0;
    const total = allImgs.length;
    if (total === 0) { safePrint(); return; }
    allImgs.forEach(img => {
      if (img.complete && img.naturalWidth > 0) { loaded++; }
      else { img.onload = () => { loaded++; if (loaded >= total) safePrint(); }; img.onerror = () => { loaded++; if (loaded >= total) safePrint(); }; }
    });
    // Si todas ya estaban completas (data URLs), esperar 800ms para que el browser repinte
    if (loaded >= total) { setTimeout(safePrint, 800); return; }
    // Fallback: imprimir aunque no carguen todas (máximo 3s)
    setTimeout(safePrint, 3000);
  }

};

// ─────────────────────────────────────────────
// PERSISTENCIA STAND-BY DE VACUNA/TEST
// Los datos quedan en DOM y en localStorage hasta que guardarFirebase los ancle
// ─────────────────────────────────────────────
function _guardarBorradorVacuna(tipo) {
  try {
    const dVal = (id) => document.getElementById(id)?.value || '';
    const campos = {};
    ['hv_cedula','hv_paciente','hv_propietario','hv_especie','hv_raza',
     'hv_edad','hv_sexo','hv_color','hv_peso','hv_telefono',
     'hv_direccion','hv_fechaNacimiento','hv_fecha'].forEach(id => { campos[id] = dVal(id); });
    // Capturar filas de tests si aplica
    if (tipo === 'test') {
      const filas = [];
      document.querySelectorAll('#bloqueTests .fila-test').forEach(fila => {
        filas.push(fila.outerHTML);
      });
      campos._filasTest = filas;
    }
    // Capturar filas de vacunas si aplica
    if (tipo === 'vacuna') {
      const filas = [];
      document.querySelectorAll('#bloqueVacunas .fila-vacuna').forEach(fila => {
        filas.push(fila.outerHTML);
      });
      campos._filasVacuna = filas;
    }
    campos._tipo = tipo;
    campos._ts   = Date.now();
    localStorage.setItem('avipet_borrador_vacuna', JSON.stringify(campos));
  } catch(e) { console.warn('[borrador vacuna]', e); }
}

function _mostrarBadgePendiente() {
  if (document.getElementById('_badgePendienteVacuna')) return;
  const badge = document.createElement('div');
  badge.id = '_badgePendienteVacuna';
  badge.style.cssText = 'position:fixed;bottom:70px;right:16px;z-index:9000;background:#f59e0b;color:#fff;padding:8px 14px;border-radius:12px;font-size:10px;font-weight:900;text-transform:uppercase;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer;';
  badge.innerHTML = '📋 Vacunación/Test en stand-by<br><span style="font-size:9px;font-weight:600;opacity:.85;">Se ancla al guardar la historia</span>';
  badge.onclick = () => { document.getElementById('sectionHojaVacunas')?.classList.remove('hidden'); document.getElementById('sectionHistoria')?.classList.add('hidden'); };
  document.body.appendChild(badge);
}

window._limpiarBorradorVacuna = () => {
  localStorage.removeItem('avipet_borrador_vacuna');
  document.getElementById('_badgePendienteVacuna')?.remove();
};

// ─────────────────────────────────────────────
// VOLVER A HISTORIA
// ─────────────────────────────────────────────
window.volverAHistoriaDesdeTest = () => {
  const tipo = document.getElementById('selectorTipoFormato')?.value === 'test_rapido' ? 'test' : 'vacuna';
  _guardarBorradorVacuna(tipo);
  document.getElementById('sectionHojaTest')?.classList.add('hidden');
  document.getElementById('sectionHojaVacunas')?.classList.add('hidden');
  const hist = document.getElementById('sectionHistoria');
  if (hist) hist.classList.remove('hidden');
  else if (typeof window.showTab === 'function') window.showTab('historia');
  _mostrarBadgePendiente();
  Swal?.fire({ icon:'success', title:'Datos en stand-by', text:'Se anclarán automáticamente al guardar la historia clínica.', timer:2000, showConfirmButton:false, toast:true, position:'bottom-end' });
};

window.volverAHistoriaDesdeVacunas = () => {
  _guardarBorradorVacuna('vacuna');
  document.getElementById('sectionHojaVacunas')?.classList.add('hidden');
  const hist = document.getElementById('sectionHistoria');
  if (hist) hist.classList.remove('hidden');
  else if (typeof window.showTab === 'function') window.showTab('historia');
  _mostrarBadgePendiente();
  Swal?.fire({ icon:'success', title:'Datos en stand-by', text:'Se anclarán automáticamente al guardar la historia clínica.', timer:2000, showConfirmButton:false, toast:true, position:'bottom-end' });
};

// ─── BORRAR FECHA DE NACIMIENTO ───
window.borrarFechaNacVacuna = () => {
  const el = document.getElementById('hv_fechaNacimiento');
  if (!el) return;
  el.value = "";
  el.type  = "text";   // cambiar a texto para poder dejarlo vacío visualmente
  el.type  = "date";   // volver a date
  // Forzar limpieza con valueAsDate
  try { el.valueAsDate = null; } catch {}
  el.removeAttribute('value');
  el.dispatchEvent(new Event('change'));
};

// ─── HELPER: copiar campos de historia a tarjeta sin cambiar vista ───
function _poblarCamposVacunaDesdeHistoria() {
  const dVal = (id) => document.getElementById(id)?.value?.trim() || "";
  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set('hv_propietario',    dVal('hProp'));
  set('hv_cedula',         dVal('hCI'));
  set('hv_telefono',       dVal('hTlf'));
  set('hv_direccion',      dVal('hDir'));
  set('hv_especie',        dVal('hEspecie'));
  set('hv_raza',           dVal('hRaza'));
  set('hv_paciente',       dVal('hNombre'));
  set('hv_edad',           dVal('hEdad'));
  set('hv_sexo',           dVal('hSexo'));
  set('hv_color',          dVal('hColor'));
  set('hv_peso',           dVal('hPeso'));
  set('hv_fechaNacimiento',dVal('hFechaNac'));
  if (!document.getElementById('hv_fecha')?.value) {
    const f = new Date();
    set('hv_fecha', `${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`);
  }
}

// ─── IMPRIMIR VACUNAS — solo imprime, sin guardar ni pedir forma de pago ───
window.imprimirHojaVacunasSeguro = async () => {
  const hvCedula  = document.getElementById('hv_cedula')?.value.trim();
  const hvPaciente = document.getElementById('hv_paciente')?.value.trim();
  const cedula = document.getElementById('hCI')?.value.trim();
  const nombre = document.getElementById('hNombre')?.value.trim();

  if (!hvCedula && !hvPaciente) {
    if (!cedula || !nombre) {
      await Swal.fire({ icon:'warning', title:'Paciente no identificado', text:'Carga el paciente desde Historia Clínica primero.', confirmButtonColor:'#1d4ed8' });
      return;
    }
    _poblarCamposVacunaDesdeHistoria();
  }
  window.imprimirHojaVacunas();
};

// ─── GUARDAR TEST SIN BORRAR HISTORIA ────────────────────
window.guardarTestRapido = async () => {
  const cedula  = document.getElementById('hCI')?.value.trim();
  const nombre  = document.getElementById('hNombre')?.value.trim();
  if (!cedula || !nombre) {
    // Si tiene datos en la tarjeta (modo directo), no hay historia que guardar — solo confirmar
    const hvCedula = document.getElementById('hv_cedula')?.value.trim();
    const hvPaciente = document.getElementById('hv_paciente')?.value.trim();
    if (hvCedula && hvPaciente) {
      // Datos cargados desde la tarjeta directa — no hay historia activa para guardar
      await Swal.fire({ icon:'info', title:'Test sin historia vinculada', text:'Este test fue generado desde la tarjeta directa. Para guardarlo en Firestore, carga el paciente desde Historia Clínica. Puedes usar "Imprimir Certificado" sin necesidad de guardar.', confirmButtonColor:'#1d4ed8', confirmButtonText:'Entendido' });
      return;
    }
    await Swal.fire({
      icon: 'warning',
      title: 'Paciente no identificado',
      text: 'Ingresa la cédula y el nombre de la mascota en Historia Clínica antes de guardar el test.',
      confirmButtonColor: '#1d4ed8'
    });
    return;
  }
  window._modoGuardarTest = true;
  await window.guardarFirebase(false);
};

// ─── IMPRIMIR TEST — guarda automáticamente primero ──────
// ─── IMPRIMIR TEST — solo imprime, sin guardar ni pedir forma de pago ───
window.imprimirHojaTestSeguro = async () => {
  const hvCedula  = document.getElementById('hv_cedula')?.value.trim();
  const hvPaciente = document.getElementById('hv_paciente')?.value.trim();
  const cedula = document.getElementById('hCI')?.value.trim();
  const nombre = document.getElementById('hNombre')?.value.trim();

  if (!hvCedula && !hvPaciente) {
    if (!cedula || !nombre) {
      await Swal.fire({ icon:'warning', title:'Paciente no identificado', text:'Ingresa la cédula en el campo CÉDULA de la tarjeta o carga el paciente desde Historia Clínica.', confirmButtonColor:'#1d4ed8' });
      return;
    }
    _poblarCamposVacunaDesdeHistoria();
  }
  window.cambiarTipoFormato('test_rapido');
  const sel = document.getElementById('selectorTipoFormato');
  if (sel) sel.value = 'test_rapido';
  window.imprimirHojaTest();
};

// ─── ABRIR HOJA DE VACUNAS DESDE BUSCADOR ───────────────────
window.abrirHojaVacunasDesdeBuscador = (consulta) => {
  // Ocultar todas las secciones visibles
  ['sectionHistoria','sectionBuscador','sectionFinanzas','sectionInventario',
   'sectionPeluqueria','sectionAlmuerzo','sectionDocumentos'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  // Mostrar hoja de vacunas
  const sec = document.getElementById('sectionHojaVacunas');
  if (sec) { sec.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }

  // Llenar campos hv_* desde el objeto consulta
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set('hv_propietario',    consulta.propietario);
  set('hv_cedula',         consulta.cedula);
  set('hv_telefono',       consulta.telefono);
  set('hv_direccion',      consulta.direccion);
  set('hv_especie',        consulta.especie);
  set('hv_raza',           consulta.raza);
  set('hv_paciente',       consulta.paciente);
  set('hv_edad',           consulta.edad);
  set('hv_sexo',           consulta.sexo);
  set('hv_color',          consulta.color);
  set('hv_peso',           consulta.peso);
  set('hv_fechaNacimiento',consulta.fechaNacimiento);
  const f = new Date();
  set('hv_fecha', `${f.getDate().toString().padStart(2,'0')}/${(f.getMonth()+1).toString().padStart(2,'0')}/${f.getFullYear()}`);
};

console.log("✅ vacunas.js v6 — abrirHojaVacunasDesdeBuscador, stand-by borrador, imprimir sin modal de pago");
