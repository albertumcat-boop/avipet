// =========================================================
// AVIPET — vacunas.js
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, query, where, orderBy, limit, serverTimestamp
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
window.imprimirHojaTest = async () => {
  const sel = document.getElementById('selectorTipoFormato');
  if (sel) sel.value = 'test_rapido';
  window.cambiarTipoFormato('test_rapido');

  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  const sec  = document.getElementById('sectionHojaTest');

  if (sec)  sec.classList.add('hidden');
  if (hv)   hv.classList.remove('hidden');
  if (hist) hist.classList.add('hidden');

  // Mismo patrón que imprimirDocumento en historia.js para printTestGallery
  const galTestPrev  = document.getElementById('previewTestGallery');
  const galTestPrint = document.getElementById('printTestGalleryVac');
  const contT        = document.getElementById('printTestContVac');
  const imgsT = galTestPrev ? galTestPrev.querySelectorAll('img') : [];
  await Swal.fire({
    icon: 'info',
    title: 'DEBUG imprimirHojaTest',
    html: `<p style="font-size:11px;text-align:left;">
      galTestPrev: <b>${galTestPrev ? 'OK' : 'NULL'}</b><br>
      galTestPrint: <b>${galTestPrint ? 'OK' : 'NULL'}</b><br>
      contT: <b>${contT ? 'OK' : 'NULL'}</b><br>
      imgs encontradas: <b>${imgsT.length}</b><br>
      src[0]: <b>${imgsT[0]?.src?.substring(0,40) || 'ninguna'}</b>
    </p>`,
    confirmButtonText: 'OK — continuar',
    confirmButtonColor: '#1d4ed8'
  });

  if (galTestPrev && galTestPrint && contT) {
    galTestPrint.innerHTML = '';
    imgsT.forEach(img => {
      const w = document.createElement('div');
      w.style.cssText = 'display:inline-block;max-width:45%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;vertical-align:top;margin:4px;';
      const newImg = document.createElement('img');
      newImg.src = img.src;
      newImg.className = 'foto-anexo';
      newImg.style.cssText = 'width:100%;max-height:300px;object-fit:contain;display:block;';
      w.appendChild(newImg);
      galTestPrint.appendChild(w);
    });
    contT.classList.toggle('hidden', imgsT.length === 0);
  }

  const _cleanup = () => {
    if (contT) contT.classList.add('hidden');
    if (galTestPrint) galTestPrint.innerHTML = '';
    if (hist) hist.classList.remove('hidden');
    if (hv)   hv.classList.add('hidden');
    window.removeEventListener('afterprint', _cleanup);
  };
  window.addEventListener('afterprint', _cleanup);
  window.print();
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
  const formato = document.getElementById('selectorTipoFormato')?.value;
  if (formato === 'test_rapido') {
    await window.imprimirHojaTest();
  } else {
    window.imprimirHojaVacunas();
  }
};

// ─── GUARDAR TEST SIN BORRAR HISTORIA ────────────────────
window.guardarTestRapido = async () => {
  const cedula  = document.getElementById('hCI')?.value.trim();
  const nombre  = document.getElementById('hNombre')?.value.trim();

  // Modo Historia Clínica activa — guardar dentro de la consulta
  if (cedula && nombre) {
    window._modoGuardarTest = true;
    await window.guardarFirebase(false);
    return;
  }

  // Modo tarjeta directa — los datos del paciente están en hv_*
  const hvCedula    = document.getElementById('hv_cedula')?.value.trim();
  const hvPaciente  = document.getElementById('hv_paciente')?.value.trim();

  if (!hvCedula || !hvPaciente) {
    await Swal.fire({ icon:'warning', title:'Paciente no identificado', text:'Ingresa la cédula del paciente en el campo CÉDULA del formulario.', confirmButtonColor:'#1d4ed8' });
    return;
  }

  // Recoger filas de test del DOM
  const filas = [];
  document.querySelectorAll('#cuerpoTablaCertificado tr').forEach(tr => {
    const antigenoEl = tr.querySelector('td:first-child span, td:first-child input');
    const resultadoEl = tr.querySelector('.resultado-print');
    const obsEl = tr.querySelector('.obs-print');
    filas.push({
      antigeno:   antigenoEl?.value?.trim() || antigenoEl?.textContent?.trim() || '',
      resultado:  resultadoEl?.textContent?.trim() || '---',
      observacion: obsEl?.textContent?.trim() || ''
    });
  });

  const dVal = id => document.getElementById(id)?.value?.trim() || '';
  const ahora = new Date();
  const fechaSimple = dVal('hv_fecha') || `${ahora.getDate().toString().padStart(2,'0')}/${(ahora.getMonth()+1).toString().padStart(2,'0')}/${ahora.getFullYear()}`;
  const resumenTests = filas.map(f => `${f.antigeno}: ${f.resultado}${f.observacion ? ' — '+f.observacion : ''}`).join(' | ');
  const doctorNombre = window.doctorVerificado || document.getElementById('dtNombre')?.textContent || '';

  const docData = {
    tipo:              'test_rapido',
    cedula:            hvCedula,
    paciente:          hvPaciente,
    propietario:       dVal('hv_propietario'),
    telefono:          dVal('hv_telefono'),
    direccion:         dVal('hv_direccion'),
    especie:           dVal('hv_especie'),
    raza:              dVal('hv_raza'),
    edad:              dVal('hv_edad'),
    sexo:              dVal('hv_sexo'),
    color:             dVal('hv_color'),
    peso:              dVal('hv_peso'),
    fechaNacimiento:   dVal('hv_fechaNacimiento'),
    fechaSimple:       fechaSimple,
    fecha:             serverTimestamp(),
    doctor:            doctorNombre,
    doctorNombre:      doctorNombre,
    tratamiento:       resumenTests,
    tests:             filas,
    fotoUrl:           document.getElementById('pUrlTest')?.value || '',
    montoVenta:        0,
    montoInsumos:      0,
    serviciosRealizados: [],
    esMuestra:         false,
    vacunaPagadaAnteriormente: false
  };

  try {
    await addDoc(collection(db, 'consultas'), docData);
    await Swal.fire({ icon:'success', title:'Test guardado', text:`Test de ${hvPaciente} guardado. Aparecerá en el buscador de historial.`, timer:2500, showConfirmButton:false });
  } catch(e) {
    console.error('[guardarTestRapido]', e);
    await Swal.fire({ icon:'error', title:'Error al guardar', text: e.message, confirmButtonColor:'#1d4ed8' });
  }
};

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

  // Si no hay doctor autenticado, ofrecer selector rápido antes de imprimir
  if (!window.doctorVerificado) {
    const res = await Swal.fire({
      title: 'Médico Responsable',
      text: 'Selecciona el médico que firma este certificado:',
      input: 'select',
      inputOptions: { 'Darwin Sandoval': 'DR. DARWIN SANDOVAL', 'Joan Silva': 'DR. JOAN SILVA', '': 'Continuar sin médico' },
      inputPlaceholder: 'Selecciona...',
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#1d4ed8',
      showCancelButton: true,
      cancelButtonText: 'Cancelar'
    });
    if (res.isDismissed) return;
    if (res.value) {
      // Poblar datos del doctor en el DOM temporalmente para la impresión
      const DATOS = {
        'Darwin Sandoval': { nombre: 'DR. DARWIN SANDOVAL', credenciales: 'MPPS: 12073 · CMVMIR: 444 · INSAI: 808119259834', telefono: '+58 412-388-5533' },
        'Joan Silva':      { nombre: 'DR. JOAN SILVA',      credenciales: 'CMV: 830 · MSAS: 6567',                               telefono: '+58 412-759-7195' }
      };
      const d = DATOS[res.value];
      if (d) {
        const dtN = document.getElementById('dtNombre');
        const dtC = document.getElementById('dtCredenciales');
        const dtT = document.getElementById('dtTelefono');
        if (dtN) dtN.textContent = d.nombre;
        if (dtC) dtC.textContent = d.credenciales;
        if (dtT) dtT.textContent = d.telefono;
      }
    }
  }

  window.cambiarTipoFormato('test_rapido');
  const sel = document.getElementById('selectorTipoFormato');
  if (sel) sel.value = 'test_rapido';
  await window.imprimirHojaTest();
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

console.log("✅ vacunas.js v13 — imprimirHojaVacunasSeguro enruta segun formato selector");
