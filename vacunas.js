// =========================================================
// AVIPET — vacunas.js
// CAMBIOS v2:
//   • Fecha de nacimiento aparece y se autorrellena
//     en hojas de vacunación y test rápido
//   • cambiarTipoFormato
//   • agregarFilaTest
//   • imprimirHojaVacunas / imprimirHojaTest
//   • volverAHistoriaDesdeVacunas
// =========================================================

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
  fila.className = "h-14 border-b border-slate-400 bg-white";
  fila.innerHTML = `
    <td class="px-3 font-bold uppercase italic text-slate-800">
      ${nombre === "OTRO"
        ? `<input type="text" class="w-full border-b border-blue-300 outline-none bg-transparent" placeholder="NOMBRE DEL TEST...">`
        : `<span>${nombre}</span>`}
    </td>
    <td class="px-2 text-center border-l border-r border-slate-200 relative">
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
    <td class="px-2 border-l border-slate-300">
      <input type="text" class="w-full outline-none text-[10px] bg-transparent italic" placeholder="Nota...">
    </td>
    <td class="no-print px-2 text-center">
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
  // Usar sectionHojaVacunas con formato test_rapido — mismo mecanismo que funciona para vacunas.
  // guardarFirebase ya pobló los campos hv_* antes de llamar esta función.
  const sel = document.getElementById('selectorTipoFormato');
  if (sel) sel.value = 'test_rapido';
  window.cambiarTipoFormato('test_rapido');

  const hv   = document.getElementById('sectionHojaVacunas');
  const hist = document.getElementById('sectionHistoria');
  const sec  = document.getElementById('sectionHojaTest');

  if (sec)  sec.classList.add('hidden');
  if (hv)   hv.classList.remove('hidden');
  if (hist) hist.classList.add('hidden');

  window.print();

  setTimeout(() => {
    if (hist) hist.classList.remove('hidden');
    if (hv)   hv.classList.add('hidden');
  }, 500);

};

// ─────────────────────────────────────────────
// VOLVER A HISTORIA
// ─────────────────────────────────────────────
window.volverAHistoriaDesdeTest = () => {
  document.getElementById('sectionHojaTest')?.classList.add('hidden');
  const hist = document.getElementById('sectionHistoria');
  if (hist) hist.classList.remove('hidden');
  else if (typeof window.showTab === 'function') window.showTab('historia');
};

window.volverAHistoriaDesdeVacunas = () => {
  document.getElementById('sectionHojaVacunas')?.classList.add('hidden');
  const hist = document.getElementById('sectionHistoria');
  if (hist) hist.classList.remove('hidden');
  else if (typeof window.showTab === 'function') window.showTab('historia');
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

// ─── IMPRIMIR VACUNAS — guarda automáticamente primero ───
window.imprimirHojaVacunasSeguro = async () => {
  const cedula = document.getElementById('hCI')?.value.trim();
  const nombre = document.getElementById('hNombre')?.value.trim();
  if (!cedula || !nombre) {
    await Swal.fire({
      icon: 'warning',
      title: 'Paciente no identificado',
      text: 'Ingresa la cédula y el nombre de la mascota en Historia Clínica antes de imprimir.',
      confirmButtonColor: '#1d4ed8'
    });
    return;
  }
  window._modoGuardarTest = true;
  window._modoAutoImprimir = true;
  await window.guardarFirebase(false);
  if (window._modoGuardarTest) { // sigue true = save falló (early return)
    window._modoGuardarTest = false;
    window._modoAutoImprimir = false;
    return;
  }
  window.imprimirHojaVacunas();
};

// ─── GUARDAR TEST SIN BORRAR HISTORIA ────────────────────
window.guardarTestRapido = async () => {
  const cedula  = document.getElementById('hCI')?.value.trim();
  const nombre  = document.getElementById('hNombre')?.value.trim();
  if (!cedula || !nombre) {
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
window.imprimirHojaTestSeguro = async () => {
  const cedula = document.getElementById('hCI')?.value.trim();
  const nombre = document.getElementById('hNombre')?.value.trim();
  if (!cedula || !nombre) {
    await Swal.fire({
      icon: 'warning',
      title: 'Paciente no identificado',
      text: 'Ingresa la cédula y el nombre de la mascota en Historia Clínica antes de imprimir.',
      confirmButtonColor: '#1d4ed8'
    });
    return;
  }
  window._modoGuardarTest = true;
  window._modoAutoImprimir = true;
  await window.guardarFirebase(false);
  if (window._modoGuardarTest) { // sigue true = save falló (early return)
    window._modoGuardarTest = false;
    window._modoAutoImprimir = false;
    return;
  }
  window.imprimirHojaTest();
};

console.log("✅ vacunas.js v3 cargado — guardarTestRapido sin borrar historia");
