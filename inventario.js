// =========================================================
// AVIPET — inventario.js  v2
// NUEVO: función pública verificarStockProducto() para llamar
//        desde historia.js al agregar servicios/meds
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc,
  deleteDoc, getDocs, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || "AVIPET2026";

// ─── CARGAR INVENTARIO ───
window.cargarInventario = async () => {
  const lista=document.getElementById('listaInventario');if(!lista)return;
  lista.innerHTML=`<p class="text-center text-blue-500 text-[9px] font-black uppercase italic animate-pulse py-8">⚙️ Cargando inventario...</p>`;
  try{const snap=await getDocs(query(collection(db,"inventario"),orderBy("nombre")));window._inventarioCache=[];snap.forEach(d=>window._inventarioCache.push({id:d.id,...d.data()}));window.renderListaInventario(window._inventarioCache);window.actualizarSelectorProveedores();}
  catch(e){console.error(e);lista.innerHTML=`<p class="text-center text-red-500 text-[9px] font-black uppercase italic py-8">❌ Error de conexión</p>`;}
};

window.renderListaInventario = (items) => {
  const lista=document.getElementById('listaInventario');if(!lista)return;
  if(!items||items.length===0){lista.innerHTML=`<p class="text-center text-slate-400 text-[9px] font-black uppercase italic py-8">Sin productos registrados</p>`;return;}
  lista.innerHTML="";
  items.forEach(p=>{
    const stockBajo=p.cantidadStock<=(p.stockMinimo||3);const colorStock=stockBajo?"text-red-600":"text-emerald-600";
    const badgeStock=stockBajo?`<span class="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[7px] font-black animate-pulse">⚠️ BAJO</span>`:`<span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[7px] font-black">OK</span>`;
    const div=document.createElement('div');div.className=`bg-white border rounded-xl p-3 cursor-pointer hover:border-blue-400 transition-all ${stockBajo?'border-red-200':'border-slate-200'}`;div.onclick=()=>window.seleccionarProductoInventario(p.id);
    div.innerHTML=`<div class="flex justify-between items-start"><p class="font-black text-slate-800 uppercase text-[11px] tracking-tight leading-none">${p.nombre}</p>${badgeStock}</div><p class="text-[9px] text-slate-400 italic mt-0.5">${p.proveedor||'---'} · ${p.categoria||'---'}</p><div class="flex justify-between items-center mt-2"><span class="text-[9px] font-black text-slate-500 uppercase">Stock: <span class="${colorStock} text-[12px]">${p.cantidadStock||0}</span> ${p.unidad||'und'}</span><span class="text-[10px] font-black text-blue-700">$${parseFloat(p.precioVenta||0).toFixed(2)}</span></div>`;
    lista.appendChild(div);
  });
};

// ─── SELECCIONAR PRODUCTO ───
window.seleccionarProductoInventario = async (id) => {
  try{const snap=await getDoc(doc(db,"inventario",id));if(!snap.exists())return;const p=snap.data();window._productoEditandoId=id;
  const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v??"";}
  set('invNombre',p.nombre);set('invProveedor',p.proveedor);set('invCategoria',p.categoria);set('invCostoCompra',p.costoCompra);set('invPrecioVenta',p.precioVenta);set('invStock',p.cantidadStock);set('invStockMinimo',p.stockMinimo);set('invUnidad',p.unidad);set('invDescripcion',p.descripcion);set('invFechaVence',p.fechaVencimiento);
  window.actualizarEstadoInventarioVisual();const titulo=document.getElementById('tituloFormInventario');if(titulo)titulo.innerText=`✏️ Editando: ${p.nombre}`;document.getElementById('formInventarioPanel')?.classList.remove('hidden');document.getElementById('btnEliminarProducto')?.classList.remove('hidden');document.getElementById('btnNuevoProducto')?.classList.remove('hidden');}
  catch(e){console.error(e);alert("❌ Error cargando producto.");}
};

// ─── GUARDAR PRODUCTO ───
window.guardarProductoInventario = async () => {
  const val=(id)=>document.getElementById(id)?.value.trim()||"";const num=(id)=>parseFloat(document.getElementById(id)?.value)||0;
  const nombre=val('invNombre');if(!nombre){alert("⚠️ El nombre es obligatorio.");return;}
  const data={nombre,proveedor:val('invProveedor'),categoria:val('invCategoria'),costoCompra:num('invCostoCompra'),precioVenta:num('invPrecioVenta'),cantidadStock:num('invStock'),stockMinimo:num('invStockMinimo')||3,unidad:val('invUnidad')||"und",descripcion:val('invDescripcion'),fechaVencimiento:val('invFechaVence'),ultimaActualizacion:serverTimestamp()};
  try{const id=window._productoEditandoId;if(id){await updateDoc(doc(db,"inventario",id),data);await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:nombre,tipo:"ACTUALIZACIÓN",cantidad:data.cantidadStock,fecha:serverTimestamp()});if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("EDICIÓN PRODUCTO",`Editó: ${nombre}`);alert("✅ Producto actualizado.");}
  else{const ref=await addDoc(collection(db,"inventario"),{...data,fechaCreacion:serverTimestamp()});await addDoc(collection(db,"movimientos_inventario"),{productoId:ref.id,productoNombre:nombre,tipo:"INGRESO_INICIAL",cantidad:data.cantidadStock,fecha:serverTimestamp()});if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("NUEVO PRODUCTO",`Creó: ${nombre}`);alert("✅ Producto creado.");}
  await window.cargarInventario();window.nuevoProductoInventario();}
  catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

window.nuevoProductoInventario=()=>{window._productoEditandoId=null;['invNombre','invProveedor','invCategoria','invCostoCompra','invPrecioVenta','invStock','invStockMinimo','invUnidad','invDescripcion','invFechaVence'].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});const titulo=document.getElementById('tituloFormInventario');if(titulo)titulo.innerText="➕ Nuevo Producto";document.getElementById('btnEliminarProducto')?.classList.add('hidden');};

window.eliminarProductoInventario=async()=>{const id=window._productoEditandoId;if(!id){alert("⚠️ Selecciona un producto.");return;}const clave=prompt("🔐 CLAVE MAESTRA:");if(!clave)return;if(clave.trim()!==MASTER_KEY()){alert("🚫 Incorrecta.");return;}const nombre=document.getElementById('invNombre')?.value||"---";if(!confirm(`⚠️ Eliminar "${nombre}".\n¿Confirmas?`))return;try{await deleteDoc(doc(db,"inventario",id));if(typeof window.registrarLogAuditoria==='function')await window.registrarLogAuditoria("ELIMINACIÓN INVENTARIO",`Eliminó: ${nombre}`);if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("ELIMINACIÓN PRODUCTO",`Eliminó: ${nombre}`);alert(`✅ "${nombre}" eliminado.`);await window.cargarInventario();window.nuevoProductoInventario();}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

window.filtrarInventario=()=>{
  const filtroTexto=document.getElementById('filtroInventario')?.value.toLowerCase().trim()||"";
  const filtroProveedor=document.getElementById('filtroProveedor')?.value||"";
  if(!window._inventarioCache)return;
  let filtrados=window._inventarioCache;
  // Filtrar por proveedor seleccionado
  if(filtroProveedor){
    filtrados=filtrados.filter(p=>(p.proveedor||"")===filtroProveedor);
  }
  // Filtrar por texto
  if(filtroTexto){
    filtrados=filtrados.filter(p=>
      (p.nombre||"").toLowerCase().includes(filtroTexto)||
      (p.proveedor||"").toLowerCase().includes(filtroTexto)||
      (p.categoria||"").toLowerCase().includes(filtroTexto)
    );
  }
  window.renderListaInventario(filtrados);
};

window.actualizarSelectorProveedores=()=>{if(!window._inventarioCache)return;const proveedores=[...new Set(window._inventarioCache.map(p=>p.proveedor).filter(Boolean))];const sel=document.getElementById('filtroProveedor');if(!sel)return;sel.innerHTML=`<option value="">Todos los proveedores</option>`;proveedores.forEach(p=>{sel.innerHTML+=`<option value="${p}">${p}</option>`;});};

window.calcularPrecioFinalAvipet=()=>{const costo=parseFloat(document.getElementById('invCostoCompra')?.value)||0;const margen=parseFloat(document.getElementById('invMargen')?.value)||30;const precio=costo*(1+margen/100);const el=document.getElementById('invPrecioVenta');if(el)el.value=precio.toFixed(2);};

window.actualizarEstadoInventarioVisual=()=>{const stock=parseFloat(document.getElementById('invStock')?.value)||0;const minimo=parseFloat(document.getElementById('invStockMinimo')?.value)||3;const badge=document.getElementById('badgeEstadoStock');if(!badge)return;if(stock<=0){badge.innerText="AGOTADO";badge.className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[8px] font-black";}else if(stock<=minimo){badge.innerText="STOCK BAJO";badge.className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black";}else{badge.innerText="OK";badge.className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black";}};

window.mostrarAjusteRapido=()=>{document.getElementById('panelAjusteRapido')?.classList.toggle('hidden');};

window.aplicarAjusteRapido=async()=>{const id=window._productoEditandoId;if(!id){alert("⚠️ Selecciona un producto.");return;}const tipo=document.getElementById('tipoAjuste')?.value||"entrada";const cant=parseFloat(document.getElementById('cantAjuste')?.value)||0;const nota=document.getElementById('notaAjuste')?.value?.trim()||"";if(cant<=0){alert("Ingresa una cantidad válida.");return;}try{const snap=await getDoc(doc(db,"inventario",id));if(!snap.exists())return;const stockAct=parseFloat(snap.data().cantidadStock)||0;const nuevo=tipo==="entrada"?stockAct+cant:Math.max(0,stockAct-cant);await updateDoc(doc(db,"inventario",id),{cantidadStock:nuevo,ultimaActualizacion:serverTimestamp()});await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:snap.data().nombre,tipo:tipo==="entrada"?"ENTRADA":"SALIDA",cantidad:cant,stockAntes:stockAct,stockDespues:nuevo,nota,fecha:serverTimestamp()});const elStock=document.getElementById('invStock');if(elStock)elStock.value=nuevo;window.actualizarEstadoInventarioVisual();document.getElementById('panelAjusteRapido')?.classList.add('hidden');await window.cargarInventario();alert(`✅ Stock: ${nuevo} unidades.`);}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

window.verMovimientosProducto=async()=>{const id=window._productoEditandoId;if(!id){alert("⚠️ Selecciona un producto.");return;}try{const snap=await getDocs(query(collection(db,"movimientos_inventario"),where("productoId","==",id),orderBy("fecha","desc")));if(snap.empty){alert("Sin movimientos registrados.");return;}let html=`<div style="max-height:320px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr style="background:#1e293b;color:#fff;"><th style="padding:6px 8px;text-align:left;">Fecha</th><th style="padding:6px 8px;text-align:center;">Tipo</th><th style="padding:6px 8px;text-align:center;">Cant</th><th style="padding:6px 8px;text-align:center;">Antes→Después</th><th style="padding:6px 8px;text-align:left;">Nota</th></tr></thead><tbody>`;snap.forEach(d=>{const r=d.data();const fecha=r.fecha?.toDate?r.fecha.toDate().toLocaleDateString():"---";const color=r.tipo?.includes("ENTRADA")?"#16a34a":"#dc2626";html+=`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:5px 8px;">${fecha}</td><td style="padding:5px 8px;text-align:center;font-weight:900;color:${color};">${r.tipo}</td><td style="padding:5px 8px;text-align:center;font-weight:bold;">${r.cantidad}</td><td style="padding:5px 8px;text-align:center;font-size:9px;">${r.stockAntes??'---'}→${r.stockDespues??'---'}</td><td style="padding:5px 8px;font-style:italic;color:#64748b;">${r.nota||'-'}</td></tr>`;});html+=`</tbody></table></div>`;Swal.fire({title:'📊 Movimientos',html,width:680,showConfirmButton:true,confirmButtonText:'Cerrar'});}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

window.descargarReporteProveedor=async()=>{try{const snap=await getDocs(collection(db,"inventario"));const filtroEl=document.getElementById('filtroProveedor');const filtro=filtroEl?.value||"";const datos=[];snap.forEach(d=>{const r=d.data();if(filtro&&r.proveedor!==filtro)return;datos.push({Nombre:r.nombre,Proveedor:r.proveedor||"---",Categoría:r.categoria||"---",Costo:r.costoCompra||0,PrecioVenta:r.precioVenta||0,Stock:r.cantidadStock||0,StockMínimo:r.stockMinimo||3,Unidad:r.unidad||"und",Vencimiento:r.fechaVencimiento||"---",Estado:(r.cantidadStock||0)<=(r.stockMinimo||3)?"BAJO":"OK"});});if(!datos.length){alert("No hay datos para el filtro.");return;}const hoja=XLSX.utils.json_to_sheet(datos);const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,hoja,filtro?`Proveedor_${filtro}`:"Inventario");XLSX.writeFile(libro,`Inventario_${(filtro||"Completo").replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

// ─── PANEL CONFIG ───
// ─── CARGAR SELECTOR DE SERVICIOS DINÁMICAMENTE ──────────
// Estrategia: el HTML ya tiene los servicios base estáticos.
// Esta función SOLO agrega los servicios NUEVOS de Firebase
// que no estén ya en el selector — se ejecuta en segundo plano.
window.cargarSelectorServicios = async () => {
  const sel = document.getElementById('selectorServicios');
  if (!sel) return;

  try {
    const snap = await getDocs(collection(db, "servicios_maestro"));
    if (snap.empty) return;

    // Recoger todos los valores que ya están en el selector (opciones estáticas)
    const yaExisten = new Set(
      Array.from(sel.querySelectorAll('option')).map(o => o.value.toUpperCase())
    );

    // Íconos por categoría
    const iconos = {
      'CONSULTAS':     '🩺',
      'VACUNAS':       '💉',
      'LABORATORIO':   '🔬',
      'TESTS RÁPIDOS': '🧪',
      'REFERIDOS':     '📋',
      'OTROS':         '🐾',
    };

    // Agrupar solo los NUEVOS (no están en el HTML estático)
    const nuevos = {};
    snap.forEach(d => {
      const nombre = d.id.toUpperCase();
      if (!yaExisten.has(nombre)) {
        const cat = d.data().categoria || 'OTROS';
        if (!nuevos[cat]) nuevos[cat] = [];
        nuevos[cat].push({ id: d.id, ...d.data() });
      }
    });

    // Agregar los nuevos al selector agrupados
    Object.entries(nuevos).sort().forEach(([cat, servicios]) => {
      // Buscar si ya existe el optgroup de esa categoría
      let grp = Array.from(sel.querySelectorAll('optgroup'))
        .find(g => g.label.includes(cat));

      if (!grp) {
        grp = document.createElement('optgroup');
        grp.label = (iconos[cat] || '🔹') + ' ' + cat;
        sel.appendChild(grp);
      }

      servicios.sort((a,b) => a.id.localeCompare(b.id)).forEach(s => {
        const opt = document.createElement('option');
        opt.value       = s.id;
        opt.textContent = s.id + ' ($' + parseFloat(s.precioVenta||0).toFixed(2) + ')';
        opt.dataset.nuevo = 'true'; // marcar como dinámico
        grp.appendChild(opt);
      });
    });

  } catch(e) {
    console.warn('Error cargando selector servicios:', e);
  }
};

// ─── ABRIR MODAL NUEVO SERVICIO ───────────────────────────
window.abrirModalNuevoServicio = async () => {
  var htmlModal = '<div class="space-y-3 text-left">';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Nombre del Servicio</label>';
  htmlModal += '<input id="ns_nombre" type="text" placeholder="Ej: RADIOGRAFIA SIMPLE" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-blue-500"></div>';
  htmlModal += '<div class="grid grid-cols-2 gap-2">';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Precio ($)</label>';
  htmlModal += '<input id="ns_precio" type="number" placeholder="0.00" step="0.50" min="0" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">% Doctor</label>';
  htmlModal += '<input id="ns_porc" type="number" placeholder="40" step="0.5" min="0" max="100" value="40" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Categoria (grupo en el selector)</label>';
  htmlModal += '<select id="ns_categoria" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500 bg-white">';
  htmlModal += '<option value="CONSULTAS">Consultas</option>';
  htmlModal += '<option value="VACUNAS">Vacunas</option>';
  htmlModal += '<option value="LABORATORIO">Laboratorio</option>';
  htmlModal += '<option value="TESTS RAPIDOS">Tests Rapidos</option>';
  htmlModal += '<option value="REFERIDOS">Referidos</option>';
  htmlModal += '<option value="OTROS">Otros</option>';
  htmlModal += '<option value="__nueva__">Crear nueva categoria...</option>';
  htmlModal += '</select>';
  htmlModal += '<input id="ns_categoria_nueva" type="text" placeholder="Ej: CIRUGIAS, HOSPITALIZACION..." style="display:none" class="w-full border-2 border-blue-300 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-blue-500 mt-2"></div>';
  htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Es una vacuna? (afecta combos de precios)</label>';
  htmlModal += '<div class="flex gap-3">';
  htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_si" value="si" class="accent-blue-600"> <span class="text-[10px] font-bold">Si</span></label>';
  htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_no" value="no" checked class="accent-blue-600"> <span class="text-[10px] font-bold">No</span></label>';
  htmlModal += '</div></div>';
  htmlModal += '<div class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[9px] text-blue-700 font-bold">El % Doctor se aplica sobre (Precio - Insumos), no sobre el precio bruto.</div>';
  htmlModal += '</div>';

  const res = await Swal.fire({
    title: 'Nuevo Servicio',
    html: htmlModal,
    showCancelButton: true,
    confirmButtonText: '✅ Crear Servicio',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2563eb',
    didOpen: () => {
      // Listener para mostrar/ocultar campo de categoría nueva
      const catSel = document.getElementById('ns_categoria');
      if (catSel) {
        catSel.addEventListener('change', function() {
          const inp = document.getElementById('ns_categoria_nueva');
          if (inp) inp.style.display = this.value === '__nueva__' ? 'block' : 'none';
        });
      }
    },
    preConfirm: () => {
      const nombre    = document.getElementById('ns_nombre')?.value.trim().toUpperCase();
      const precio    = parseFloat(document.getElementById('ns_precio')?.value) || 0;
      const porc      = parseFloat(document.getElementById('ns_porc')?.value)   || 40;
      const catSel    = document.getElementById('ns_categoria')?.value || 'OTROS';
      const catNueva  = document.getElementById('ns_categoria_nueva')?.value.trim().toUpperCase();
      const categoria = catSel === '__nueva__' ? catNueva : catSel;
      const esVacuna  = document.getElementById('ns_vacuna_si')?.checked || false;
      if (catSel === '__nueva__' && !catNueva) { Swal.showValidationMessage('⚠️ Escribe el nombre de la nueva categoría'); return false; }
      if (!nombre) { Swal.showValidationMessage('⚠️ El nombre es obligatorio'); return false; }
      if (precio <= 0) { Swal.showValidationMessage('⚠️ El precio debe ser mayor a 0'); return false; }
      return { nombre, precio, porc, categoria, esVacuna };
    }
  });

  if (!res.isConfirmed) return;
  const { nombre, precio, porc, categoria, esVacuna } = res.value;

  try {
    // Verificar si ya existe
    const existe = await getDoc(doc(db, "servicios_maestro", nombre));
    if (existe.exists()) {
      Swal.fire({ icon:'warning', title:'Ya existe', text:'Un servicio con ese nombre ya está registrado.', timer:2500, showConfirmButton:false });
      return;
    }

    // Guardar en Firebase
    await setDoc(doc(db, "servicios_maestro", nombre), {
      precioVenta: precio,
      porcDoc:     porc,
      categoria,
      esVacuna,
      creadoEn:    serverTimestamp(),
      activo:      true
    });

    // Recargar tabla y selector
    await window.renderizarTablaMaestra();
    await window.cargarSelectorServicios();

    await Swal.fire({
      icon: 'success',
      title: '✅ Servicio creado',
      html: `<b>${nombre}</b><br>$${precio.toFixed(2)} · ${porc}% doctor · ${categoria}`,
      timer: 2500,
      showConfirmButton: false
    });

  } catch(e) { console.error(e); alert('❌ Error: '+e.message); }
};

// ─── ELIMINAR SERVICIO ────────────────────────────────────
window.eliminarServicioMaestro = async (nombreServicio) => {
  const res = await Swal.fire({
    title: '🗑 Eliminar Servicio',
    html: `<p class="text-[11px] text-slate-600">¿Eliminar <b>${nombreServicio}</b> del listado?<br><br>Ya no aparecerá en el selector de Historia Clínica.</p>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626'
  });
  if (!res.isConfirmed) return;

  try {
    await deleteDoc(doc(db, "servicios_maestro", nombreServicio));
    await window.renderizarTablaMaestra();
    await window.cargarSelectorServicios();
    Swal.fire({ icon:'success', title:'✅ Eliminado', timer:1500, showConfirmButton:false });
  } catch(e) { console.error(e); alert('❌ Error: '+e.message); }
};

// ─── FILTRAR TABLA DE SERVICIOS ───────────────────────────
window.filtrarTablaServicios = () => {
  const filtro = document.getElementById('filtroServiciosMaestro')?.value.toUpperCase() || '';
  document.querySelectorAll('#tablaServiciosMaestro tr[data-nombre]').forEach(tr => {
    tr.style.display = tr.dataset.nombre.includes(filtro) ? '' : 'none';
  });
};

window.renderizarTablaMaestra=async()=>{
  const cont=document.getElementById('tablaServiciosMaestro');
  if(!cont)return;
  cont.innerHTML='<p class="text-center text-[9px] animate-pulse text-blue-500 font-black uppercase italic py-4">Cargando...</p>';
  try{
    const snap=await getDocs(collection(db,"servicios_maestro"));
    if(snap.empty){cont.innerHTML='<p class="text-center text-slate-400 text-[9px] italic py-4">Sin servicios. Usa el botón ➕ para agregar.</p>';return;}
    let html='<table class="w-full text-left border-collapse">';
    html+='<thead><tr class="bg-slate-800 text-white text-[8px] uppercase font-black">';
    html+='<th class="p-2">Servicio</th>';
    html+='<th class="p-2 text-center">Categoría</th>';
    html+='<th class="p-2 text-center w-24">Precio ($)</th>';
    html+='<th class="p-2 text-center w-20">% Doctor</th>';
    html+='<th class="p-2 text-center w-16">Guardar</th>';
    html+='<th class="p-2 text-center w-12">Eliminar</th>';
    html+='</tr></thead><tbody class="text-[10px]">';
    const servicios=[];snap.forEach(d=>servicios.push({id:d.id,...d.data()}));
    servicios.sort((a,b)=>a.id.localeCompare(b.id));
    servicios.forEach(r=>{
      const esVacuna=r.esVacuna?'💉':''
      html+='<tr class="border-b border-slate-100 hover:bg-blue-50" data-nombre="'+r.id+'">';
      html+='<td class="p-2 font-bold uppercase text-slate-800">'+esVacuna+r.id+'</td>';
      html+='<td class="p-2 text-center text-slate-500 text-[9px]">'+(r.categoria||'OTROS')+'</td>';
      html+='<td class="p-2 text-center"><input type="number" value="'+(r.precioVenta||0)+'" step="0.50" min="0" onblur="window.actualizarPrecioIndividual(''+r.id+'','precioVenta',this.value)" class="w-20 text-center border border-slate-300 rounded px-1 py-0.5 focus:border-blue-500 outline-none text-[10px] font-bold"></td>';
      html+='<td class="p-2 text-center"><input type="number" value="'+(r.porcDoc||r.porcentajeDoc||30)+'" step="0.5" min="0" max="100" onblur="window.actualizarPrecioIndividual(''+r.id+'','porcDoc',this.value)" class="w-16 text-center border border-slate-300 rounded px-1 py-0.5 focus:border-blue-500 outline-none text-[10px] font-bold"></td>';
      html+='<td class="p-2 text-center"><button onclick="window.actualizarPrecioIndividual(''+r.id+'','guardado',null,true)" class="text-[8px] px-2 py-1 bg-blue-600 text-white rounded font-black hover:bg-blue-700">✅</button></td>';
      html+='<td class="p-2 text-center"><button onclick="window.eliminarServicioMaestro(''+r.id+'')" class="text-[8px] px-2 py-1 bg-red-100 text-red-600 rounded font-black hover:bg-red-600 hover:text-white">🗑</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table>';
    cont.innerHTML=html;
  }catch(e){console.error(e);cont.innerHTML='<p class="text-red-500 text-[9px] text-center italic py-4">❌ Error</p>';}
};

window.actualizarPrecioIndividual=async(nombreServicio,campo,valor,soloGuardar)=>{try{const snap=await getDoc(doc(db,"servicios_maestro",nombreServicio));const data=snap.exists()?snap.data():{};if(!soloGuardar)data[campo]=parseFloat(valor)||0;await setDoc(doc(db,"servicios_maestro",nombreServicio),data,{merge:true});if(typeof window.porcGlobalCache!=='undefined')window.porcGlobalCache=undefined;}catch(e){console.error("Error actualizando precio:",e);}};

window.renderizarTablaInsumos=async()=>{const cont=document.getElementById('tablaInsumosMaestro');if(!cont)return;cont.innerHTML=`<p class="text-center text-[9px] animate-pulse text-blue-500 font-black uppercase italic py-4">Cargando...</p>`;try{const snap=await getDocs(collection(db,"insumos_maestro"));if(snap.empty){cont.innerHTML=`<p class="text-center text-slate-400 text-[9px] italic py-4">Sin insumos.</p>`;return;}let html=`<table class="w-full text-left border-collapse"><thead><tr class="bg-slate-800 text-white text-[8px] uppercase font-black italic"><th class="p-2">Insumo</th><th class="p-2 text-center w-24">Costo ($)</th><th class="p-2 text-center w-16">✕</th></tr></thead><tbody class="text-[10px]">`;snap.forEach(d=>{const r=d.data();html+=`<tr class="border-b border-slate-100 hover:bg-emerald-50"><td class="p-2 font-bold italic text-slate-700">${r.nombre||d.id}</td><td class="p-2 text-center"><input type="number" value="${r.costo||0}" step="0.05" min="0" onblur="window.actualizarCostoInsumo('${d.id}',this.value)" class="w-20 text-center border border-slate-300 rounded px-1 py-0.5 focus:border-blue-500 outline-none text-[10px]"></td><td class="p-2 text-center"><button onclick="window.eliminarInsumoIndividual('${d.id}','${(r.nombre||d.id).replace(/'/g,'')}')" class="text-[8px] px-2 py-1 bg-red-100 text-red-600 rounded font-black hover:bg-red-600 hover:text-white transition-all">✕</button></td></tr>`;});html+=`</tbody></table>`;cont.innerHTML=html;}catch(e){console.error(e);cont.innerHTML=`<p class="text-red-500 text-[9px] text-center italic py-4">❌ Error</p>`;}};

window.actualizarCostoInsumo=async(idInsumo,valor)=>{try{await updateDoc(doc(db,"insumos_maestro",idInsumo),{costo:parseFloat(valor)||0,actualizadoEn:serverTimestamp()});}catch(e){console.error(e);}};

window.eliminarInsumoIndividual=async(idInsumo,nombreInsumo)=>{const clave=prompt(`🔐 Eliminar "${nombreInsumo}"\nCLAVE MAESTRA:`);if(!clave||clave.trim()!==MASTER_KEY()){alert("🚫 Clave incorrecta.");return;}if(!confirm(`⚠️ Eliminar "${nombreInsumo}".\n¿Confirmas?`))return;try{await deleteDoc(doc(db,"insumos_maestro",idInsumo));alert(`✅ Eliminado.`);window.renderizarTablaInsumos();}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

// ─── INICIALIZAR BD ───
window.inicializarBaseDeDatosCompleta=async()=>{const clave=prompt("🔐 CLAVE MAESTRA:");if(!clave||clave.trim()!==MASTER_KEY()){alert("🚫 Clave incorrecta.");return;}if(!confirm("⚠️ ¿Inicializar catálogo de servicios en Firebase?"))return;
const SERVICIOS_DEFAULT={"CONSULTA GENERAL":{precioVenta:30,porcDoc:40},"CONSULTA OFTALMOLÓGICA":{precioVenta:80,porcDoc:12.5},"CONSULTA DE EMERGENCIA":{precioVenta:40,porcDoc:40},"ABSCESO":{precioVenta:25,porcDoc:50},"ECOGRAFÍA":{precioVenta:30,porcDoc:40},"COLOCACION VIA":{precioVenta:15,porcDoc:50},"ADMINISTRACION MEDICINA":{precioVenta:10,porcDoc:50},"TOMA DE MUESTRA SANGRE":{precioVenta:10,porcDoc:50},"VACUNA SEXTUPLE":{precioVenta:40,porcDoc:50},"VACUNA PUPPY":{precioVenta:40,porcDoc:50},"VACUNA ANTIRRÁBICA":{precioVenta:30,porcDoc:50},"VACUNA KC (TOS DE LAS PERRERAS)":{precioVenta:45,porcDoc:50},"VACUNA TRIPLE FELINA":{precioVenta:45,porcDoc:50},"VACUNA QUINTUPLE FELINA":{precioVenta:50,porcDoc:50},"VACUNA BIOVETA":{precioVenta:60,porcDoc:50},"HEMATOLOGÍA COMPLETA":{precioVenta:23,porcDoc:34.78},"QUÍMICA SANGUÍNEA":{precioVenta:60,porcDoc:50},"DESCARTE HEMOPARASITO":{precioVenta:50,porcDoc:50},"DISTEMPER":{precioVenta:35,porcDoc:50},"PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"FILARIASIS":{precioVenta:40,porcDoc:50},"SIDA - LEUCEMIA":{precioVenta:40,porcDoc:50},"TEST HELICOBACTER PYLORI AG":{precioVenta:40,porcDoc:50},"HEMATOLOGIA + QUIMICA + HEMOPARASITOS":{precioVenta:110,porcDoc:50},"EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"CITOLOGIA 1 OIDO":{precioVenta:15,porcDoc:50},"CITOLOGIA 2 OIDOS":{precioVenta:20,porcDoc:50},"RASPADO PIEL":{precioVenta:10,porcDoc:50},"PERFIL ANEMICO":{precioVenta:25,porcDoc:17.5},"EUTANASIA HASTA 5KG":{precioVenta:80,porcDoc:50},"EUTANASIA HASTA 15KG":{precioVenta:110,porcDoc:50},"EUTANASIA HASTA 25KG":{precioVenta:140,porcDoc:50},"EUTANASIA HASTA 35KG":{precioVenta:170,porcDoc:50},"REFERIDO: EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"REFERIDO: EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"REFERIDO: CULTIVOS":{precioVenta:30,porcDoc:50},"REFERIDO: DESCARTE HEMOPARASITO":{precioVenta:40,porcDoc:50},"REFERIDO: DISTEMPER":{precioVenta:35,porcDoc:50},"REFERIDO: PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"CONSULTA CAMADA 3-4 CACHORROS":{precioVenta:50,porcDoc:40},"CONSULTA CAMADA HASTA 8 CACHORROS":{precioVenta:80,porcDoc:40},"CONSULTA CAMADA MAS DE 8 CACHORROS":{precioVenta:100,porcDoc:40}};
try{Swal.fire({title:'⏳ Inicializando...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});let cnt=0;for(const[nombre,datos]of Object.entries(SERVICIOS_DEFAULT)){await setDoc(doc(db,"servicios_maestro",nombre),{...datos,actualizadoEn:serverTimestamp()},{merge:true});cnt++;}Swal.close();alert(`✅ ${cnt} servicios inicializados.`);window.renderizarTablaMaestra();}catch(e){Swal.close();console.error(e);alert("❌ Error: "+e.message);}};

// ─── CAMBIAR SUB-TAB CONFIG ───
window.cambiarSubTabConfig=(tab)=>{'servicios,insumos,seguridad,tarifa'.split(',').forEach(t=>{const panel=document.getElementById('panel_subTab'+t.charAt(0).toUpperCase()+t.slice(1));const btn=document.getElementById('btn_subTab'+t.charAt(0).toUpperCase()+t.slice(1));const esActivo=t===tab;panel?.classList.toggle('hidden',!esActivo);if(btn){btn.className=esActivo?"text-[9px] px-3 py-1.5 font-black uppercase rounded-lg bg-blue-600 text-white":"text-[9px] px-3 py-1.5 font-black uppercase rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-50";}});if(tab==='servicios')window.renderizarTablaMaestra();if(tab==='insumos')window.renderizarTablaInsumos();};

// ═══════════════════════════════════════════════════════
// CALCULADORA DE COSTOS DE INVENTARIO
//
// MODO BCV — cobra en Bs:  Bs ÷ BCV = Costo USD
// MODO BCV — cobra en USD: USD × BCV = Bs → Bs ÷ BCV = Costo USD (= precio USD directo)
// MODO PROVEEDOR:          USD × TasaProv = Bs → Bs ÷ BCV = Costo USD real
// MARGEN sobre venta:      Costo ÷ (1 - margen%) = Precio Venta
// ═══════════════════════════════════════════════════════

let _calcInvModo   = 'bcv';  // 'bcv' | 'proveedor'
let _calcInvMoneda = 'bs';   // 'bs'  | 'usd'  (solo en modo BCV)
let _calcInvAbierto = false;

// ── Toggle desplegable ──
window.calcInvToggle = () => {
  _calcInvAbierto = !_calcInvAbierto;
  const cuerpo  = document.getElementById('calcInvCuerpo');
  const chevron = document.getElementById('calcInvChevron');
  if (cuerpo)  cuerpo.classList.toggle('hidden', !_calcInvAbierto);
  if (chevron) chevron.innerText = _calcInvAbierto ? '▲ Cerrar' : '▼ Abrir';
};

// ── Cambiar modo: BCV o Proveedor con tasa propia ──
window.calcInvSetModo = (modo) => {
  _calcInvModo = modo;
  const btnBCV  = document.getElementById('calcInvBtnBCV');
  const btnProv = document.getElementById('calcInvBtnProv');
  const filaBS  = document.getElementById('calcInvFilaBS');
  const filaUSD = document.getElementById('calcInvFilaUSD');
  const filaTasaProv = document.getElementById('calcInvFilaTasaProv');

  if (modo === 'bcv') {
    if (btnBCV)  btnBCV.className  = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all bg-blue-600 text-white';
    if (btnProv) btnProv.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all text-slate-400';
    if (filaBS)  filaBS.classList.remove('hidden');
    if (filaUSD) filaUSD.classList.add('hidden');
    if (filaTasaProv) filaTasaProv.classList.add('hidden');
    // restaurar moneda actual
    window.calcInvSetMoneda(_calcInvMoneda);
  } else {
    if (btnProv) btnProv.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all bg-amber-500 text-white';
    if (btnBCV)  btnBCV.className  = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all text-slate-400';
    if (filaBS)  filaBS.classList.add('hidden');
    if (filaUSD) filaUSD.classList.remove('hidden');
    if (filaTasaProv) filaTasaProv.classList.remove('hidden');
  }
  window.calcularCostoInventario();
};

// ── Cambiar moneda del proveedor en modo BCV ──
window.calcInvSetMoneda = (moneda) => {
  _calcInvMoneda = moneda;
  const btnBS  = document.getElementById('calcInvBtnMonedaBS');
  const btnUSD = document.getElementById('calcInvBtnMonedaUSD');
  const label  = document.getElementById('calcInvLabelPrecio');
  const input  = document.getElementById('calcInvPrecioBS');

  if (moneda === 'bs') {
    if (btnBS)  btnBS.className  = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all bg-amber-500 text-white';
    if (btnUSD) btnUSD.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all text-slate-400';
    if (label)  label.innerText  = 'Precio del proveedor (Bs)';
    if (input)  input.placeholder = 'Ej: 47595.00';
  } else {
    if (btnUSD) btnUSD.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all bg-blue-500 text-white';
    if (btnBS)  btnBS.className  = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all text-slate-400';
    if (label)  label.innerText  = 'Precio del proveedor ($)';
    if (input)  input.placeholder = 'Ej: 100.00';
  }
  if (input) input.value = '';
  window.calcularCostoInventario();
};

// ── Cálculo principal ──
window.calcularCostoInventario = () => {
  const tasaBCV   = parseFloat(document.getElementById('calcInvTasaBCV')?.value) || window.tasaDolarHoy || 36;
  const margen    = parseFloat(document.getElementById('calcInvMargen')?.value)  || 30;
  const resultDiv = document.getElementById('calcInvResultado');
  const margenLbl = document.getElementById('calcInvMargenLabel');
  const divisor   = 1 - (margen / 100);

  if (margenLbl) margenLbl.innerText = `÷ ${divisor.toFixed(2)}`;

  let costoUSD    = 0;
  let detalle     = '';
  let valido      = false;

  if (_calcInvModo === 'bcv') {
    const monto = parseFloat(document.getElementById('calcInvPrecioBS')?.value) || 0;
    if (monto > 0 && tasaBCV > 0) {
      if (_calcInvMoneda === 'bs') {
        // Proveedor cobra en Bs a tasa BCV
        costoUSD = monto / tasaBCV;
        detalle  = `Bs ${monto.toLocaleString('es-VE',{minimumFractionDigits:2})} ÷ Bs ${tasaBCV.toFixed(2)} = $${costoUSD.toFixed(4)}`;
      } else {
        // Proveedor cobra en USD directamente (tasa BCV solo para referencia de costo real)
        costoUSD = monto; // ya es USD, no hay conversión
        detalle  = `$${monto.toFixed(2)} USD directo`;
      }
      valido = true;
    }

  } else {
    // MODO PROVEEDOR: cobra en USD a su propia tasa
    const precioUSD  = parseFloat(document.getElementById('calcInvPrecioUSD')?.value)  || 0;
    const tasaProv   = parseFloat(document.getElementById('calcInvTasaProv')?.value)   || 0;
    if (precioUSD > 0 && tasaProv > 0 && tasaBCV > 0) {
      const bsPagados = precioUSD * tasaProv;
      costoUSD = bsPagados / tasaBCV;
      detalle  = `$${precioUSD} × ${tasaProv} = Bs ${bsPagados.toLocaleString('es-VE',{minimumFractionDigits:2})} ÷ ${tasaBCV.toFixed(2)} = $${costoUSD.toFixed(4)}`;
      valido = true;
    }
  }

  if (!valido) {
    if (resultDiv) resultDiv.classList.add('hidden');
    return;
  }

  // Aplicar IVA al costo si está marcado
  const aplicaIVA  = document.getElementById('calcInvIVA')?.checked || false;
  const costoConIVA = aplicaIVA ? costoUSD * 1.16 : costoUSD;
  if (aplicaIVA) detalle += ` + IVA 16% = $${costoConIVA.toFixed(4)}`;

  const precioVenta = divisor > 0 ? costoConIVA / divisor : 0;

  if (resultDiv) resultDiv.classList.remove('hidden');
  const elCosto   = document.getElementById('calcInvCostoUSD');
  const elVenta   = document.getElementById('calcInvPrecioVentaCalc');
  const elDetalle = document.getElementById('calcInvDetalle');
  if (elCosto)   elCosto.innerText   = `$${costoConIVA.toFixed(2)}${aplicaIVA ? ' (c/IVA)' : ''}`;
  if (elVenta)   elVenta.innerText   = `$${precioVenta.toFixed(2)}`;
  if (elDetalle) elDetalle.innerText = `${detalle} ÷ ${divisor.toFixed(2)} = $${precioVenta.toFixed(2)}`;

  window._calcInvResultado = { costoUSD: costoConIVA, precioVenta };
};

// ── Aplicar al formulario del producto ──
window.calcInvAplicar = () => {
  if (!window._calcInvResultado) return;
  const { costoUSD, precioVenta } = window._calcInvResultado;
  const elCosto = document.getElementById('invCostoCompra');
  const elVenta = document.getElementById('invPrecioVenta');
  if (elCosto) { elCosto.value = costoUSD.toFixed(2); elCosto.style.background='#d1fae5'; setTimeout(()=>elCosto.style.background='',1200); }
  if (elVenta) { elVenta.value = precioVenta.toFixed(2); elVenta.style.background='#dbeafe'; setTimeout(()=>elVenta.style.background='',1200); }
  // Cerrar calculadora
  _calcInvAbierto = false;
  document.getElementById('calcInvCuerpo')?.classList.add('hidden');
  document.getElementById('calcInvChevron').innerText = '▼ Abrir';
  Swal.fire({ icon:'success', title:'✅ Valores aplicados', text:`Costo: $${costoUSD.toFixed(2)} · Venta: $${precioVenta.toFixed(2)}`, timer:2000, showConfirmButton:false });
};

// ── Inicializar al abrir inventario ──
window.inicializarCalculadoraInventario = () => {
  const tasa = window.tasaDolarHoy || 36;
  const el   = document.getElementById('calcInvTasaBCV');
  if (el) el.value = tasa.toFixed(2);
  // Asegurar estado inicial
  _calcInvAbierto = false;
  _calcInvModo    = 'bcv';
  _calcInvMoneda  = 'bs';
};

console.log("✅ inventario.js v2 cargado");
