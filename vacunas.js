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
  const paciente    = document.getElementById('hNombre')?.value     || "";
  const propietario = document.getElementById('hProp')?.value       || "";
  const cedula      = document.getElementById('hCI')?.value         || "";
  const especie     = document.getElementById('hEspecie')?.value    || "";
  const raza        = document.getElementById('hRaza')?.value       || "";
  const edad        = document.getElementById('hEdad')?.value       || "";
  const sexo        = document.getElementById('hSexo')?.value       || "";
  const peso        = document.getElementById('hv_peso')?.value || document.getElementById('hPeso')?.value || "";
  const color       = document.getElementById('hColor')?.value      || "";
  const telefono    = document.getElementById('hTlf')?.value        || "";
  const direccion   = document.getElementById('hDir')?.value        || "";
  const doctor      = document.getElementById('selectDoctor')?.value || "";
  const fechaNac    = document.getElementById('hv_fechaNacimiento')?.value || document.getElementById('hFechaNac')?.value || "";
  const fecha       = new Date().toLocaleDateString();

  const filas = [];
  document.getElementById('cuerpoTablaCertificado')?.querySelectorAll('tr').forEach(tr => {
    const tdNombre    = tr.cells[0];
    const tdResultado = tr.cells[1];
    const tdNota      = tr.cells[2];
    if (!tdNombre || !tdResultado || !tdNota) return;
    const nombreTest = tdNombre.querySelector('input')?.value?.trim() || tdNombre.querySelector('span')?.innerText?.trim() || "";
    const sel        = tdResultado.querySelector('select');
    const resultado  = sel ? sel.options[sel.selectedIndex].text.toUpperCase() : "---";
    const nota       = tdNota.querySelector('input')?.value?.trim() || "";
    if (nombreTest) filas.push({ nombre: nombreTest.toUpperCase(), resultado, nota });
  });

  const fotos = [];
  document.getElementById('previewTestGallery')?.querySelectorAll('img').forEach(img => {
    if (img.src) fotos.push(img.src);
  });

  const filasHtml = filas.map(f => {
    const color = f.resultado.includes("POSITIVO") ? "#dc2626" : f.resultado.includes("NEGATIVO") ? "#16a34a" : "#334155";
    return `<tr>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:bold;text-transform:uppercase;background:#f8fafc;">${f.nombre}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;font-weight:900;font-size:14px;color:${color};">${f.resultado}</td>
      <td style="padding:6px 8px;border:1px solid #e5e7eb;font-style:italic;color:#475569;font-size:11px;">${f.nota || '-'}</td>
    </tr>`;
  }).join("");

  const fotosHtml = fotos.length ? `
    <div style="margin-top:10px;page-break-inside:avoid;">
      <b style="font-size:11px;display:block;margin-bottom:6px;color:#1e293b;text-transform:uppercase;">Registro Fotográfico</b>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        ${fotos.map(src => `<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;text-align:center;">
          <img src="${src}" style="width:100%;height:240px;object-fit:contain;display:block;"></div>`).join("")}
      </div>
    </div>` : "";

  // Inyectar en la página (igual que vacunación) — sin abrir ventana nueva
  const sec = document.getElementById('sectionHojaTest');
  if (!sec) { alert('Error interno: falta #sectionHojaTest'); return; }

  sec.innerHTML = `
    <button type="button" onclick="window.volverAHistoriaDesdeTest()" class="no-print"
      style="position:absolute;top:12px;left:12px;background:#e2e8f0;color:#475569;border:none;padding:5px 14px;border-radius:8px;cursor:pointer;font-weight:900;font-size:11px;">← Volver</button>
    <button type="button" onclick="window.print()" class="no-print"
      style="position:absolute;top:12px;right:12px;background:#7c3aed;color:#fff;border:none;padding:7px 18px;border-radius:8px;cursor:pointer;font-weight:900;font-size:11px;">Imprimir</button>

    <div style="position:relative;padding-top:8px;">
      <div style="border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:18px;font-weight:900;color:#7c3aed;margin:0;">AVIPET — Certificado de Diagnóstico Rápido</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Paciente: <b>${paciente.toUpperCase()}</b> · Propietario: <b>${propietario}</b> · CI: ${cedula}</div>
        </div>
        <div style="text-align:right;font-size:10px;color:#6b7280;">
          <div><b>${fecha}</b></div>
          <div style="color:#7c3aed;font-weight:bold;">${doctor ? 'Dr(a). ' + doctor : ''}</div>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;background:#f9fafb;">
        <b style="display:block;margin-bottom:6px;color:#1e293b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Ficha del Paciente</b>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Especie</span><span style="font-size:11px;font-weight:700;">${especie}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Raza</span><span style="font-size:11px;font-weight:700;">${raza}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Fecha de Nac.</span><span style="font-size:11px;font-weight:700;">${fechaNac || '---'}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Edad</span><span style="font-size:11px;font-weight:700;">${edad}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Sexo</span><span style="font-size:11px;font-weight:700;">${sexo}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Peso</span><span style="font-size:11px;font-weight:700;">${peso} kg</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Color</span><span style="font-size:11px;font-weight:700;">${color}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Teléfono</span><span style="font-size:11px;font-weight:700;">${telefono}</span></div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;"><span style="font-size:8px;font-weight:900;text-transform:uppercase;color:#94a3b8;display:block;">Dirección</span><span style="font-size:11px;font-weight:700;">${direccion}</span></div>
        </div>
      </div>

      ${filas.length
        ? `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;background:#f9fafb;">
            <b style="display:block;margin-bottom:6px;color:#1e293b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Resultados de Tests Rápidos</b>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:#ede9fe;">
                <th style="padding:8px;border:1px solid #c4b5fd;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase;">Prueba</th>
                <th style="padding:8px;border:1px solid #c4b5fd;text-align:center;font-size:11px;color:#5b21b6;text-transform:uppercase;width:140px;">Resultado</th>
                <th style="padding:8px;border:1px solid #c4b5fd;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase;">Observaciones</th>
              </tr></thead>
              <tbody>${filasHtml}</tbody>
            </table>
           </div>`
        : `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;background:#f9fafb;"><p style="color:#94a3b8;font-style:italic;margin:0;">Sin tests registrados.</p></div>`}

      ${fotosHtml ? `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px;background:#f9fafb;">
        <b style="display:block;margin-bottom:6px;color:#1e293b;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">Anexos Fotográficos</b>${fotosHtml}</div>` : ""}

      <div style="margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">
        Documento emitido por el sistema integral AVIPET.${doctor ? ` · Médico Veterinario: <b>${doctor}</b>` : ""}
      </div>
    </div>`;

  sec.style.position = 'relative';
  sec.classList.remove('hidden');
  document.getElementById('sectionHojaVacunas')?.classList.add('hidden');
  document.getElementById('sectionHistoria')?.classList.add('hidden');
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
