// =========================================================
// AVIPET — inventario.js v10 — fix ajustes, cambiarSubTabConfig
// =========================================================

import { db } from './firebase-config.js';
import {
 collection, addDoc, doc, getDoc, setDoc, updateDoc,
 deleteDoc, getDocs, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || "AVIPET2026";

// CARGAR INVENTARIO 
window.cargarInventario = async () => {
 const lista=document.getElementById('listaInventario');if(!lista)return;
 lista.innerHTML=`<p class="text-center text-blue-500 text-[9px] font-black uppercase italic animate-pulse py-8">Cargando inventario...</p>`;
 try{const snap=await getDocs(query(collection(db,"inventario"),orderBy("nombre")));window._inventarioCache=[];snap.forEach(d=>window._inventarioCache.push({id:d.id,...d.data()}));window.renderListaInventario(window._inventarioCache);window.actualizarSelectorProveedores();}
 catch(e){console.error(e);lista.innerHTML=`<p class="text-center text-red-500 text-[9px] font-black uppercase italic py-8">Error de conexion</p>`;}
};

window.renderListaInventario = (items) => {
 const lista=document.getElementById('listaInventario');if(!lista)return;
 if(!items||items.length===0){lista.innerHTML=`<p class="text-center text-slate-400 text-[9px] font-black uppercase italic py-8">Sin productos registrados</p>`;return;}
 lista.innerHTML="";
 items.forEach(p=>{
 const stockBajo=p.cantidadStock<=(p.stockMinimo||3);const colorStock=stockBajo?"text-red-600":"text-emerald-600";
 const badgeStock=stockBajo?`<span class="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[7px] font-black animate-pulse">BAJO</span>`:`<span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[7px] font-black">OK</span>`;
 const div=document.createElement('div');div.className=`bg-white border rounded-xl p-3 cursor-pointer hover:border-blue-400 transition-all ${stockBajo?'border-red-200':'border-slate-200'}`;div.onclick=()=>window.seleccionarProductoInventario(p.id);
 div.innerHTML=`<div class="flex justify-between items-start"><p class="font-black text-slate-800 uppercase text-[11px] tracking-tight leading-none">${p.nombre}</p>${badgeStock}</div><p class="text-[9px] text-slate-400 italic mt-0.5">${p.proveedor||'---'} · ${p.categoria||'---'}</p><div class="flex justify-between items-center mt-2"><span class="text-[9px] font-black text-slate-500 uppercase">Stock: <span class="${colorStock} text-[12px]">${p.cantidadStock||0}</span> ${p.unidad||'und'}</span><span class="text-[10px] font-black text-blue-700">$${parseFloat(p.precioVenta||0).toFixed(2)}</span></div>`;
 lista.appendChild(div);
 });
};

// SELECCIONAR PRODUCTO 
window.seleccionarProductoInventario = async (id) => {
 try{const snap=await getDoc(doc(db,"inventario",id));if(!snap.exists())return;const p=snap.data();window._productoEditandoId=id;
 const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v??"";}
 set('invNombre',p.nombre);set('invProveedor',p.proveedor);set('invCategoria',p.categoria);set('invCostoCompra',p.costoCompra);set('invPrecioVenta',p.precioVenta);set('invStock',p.cantidadStock);set('invStockMinimo',p.stockMinimo);set('invUnidad',p.unidad);set('invDescripcion',p.descripcion);set('invFechaVence',p.fechaVencimiento);
 window.actualizarEstadoInventarioVisual();const titulo=document.getElementById('tituloFormInventario');if(titulo)titulo.innerText=`Editando: ${p.nombre}`;document.getElementById('formInventarioPanel')?.classList.remove('hidden');document.getElementById('btnEliminarProducto')?.classList.remove('hidden');document.getElementById('btnNuevoProducto')?.classList.remove('hidden');}
 catch(e){console.error(e);alert("Error cargando producto.");}
};

// GUARDAR PRODUCTO 
window.guardarProductoInventario = async () => {
 const val=(id)=>document.getElementById(id)?.value.trim()||"";const num=(id)=>parseFloat(document.getElementById(id)?.value)||0;
 const nombre=val('invNombre');if(!nombre){alert("El nombre es obligatorio.");return;}
 const data={nombre,proveedor:val('invProveedor'),categoria:val('invCategoria'),costoCompra:num('invCostoCompra'),precioVenta:num('invPrecioVenta'),cantidadStock:num('invStock'),stockMinimo:num('invStockMinimo')||3,unidad:val('invUnidad')||"und",descripcion:val('invDescripcion'),fechaVencimiento:val('invFechaVence'),ultimaActualizacion:serverTimestamp()};
 try{const id=window._productoEditandoId;if(id){await updateDoc(doc(db,"inventario",id),data);await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:nombre,tipo:"ACTUALIZACION",cantidad:data.cantidadStock,fecha:serverTimestamp()});if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("EDICION PRODUCTO",`Edito: ${nombre}`);alert("Producto actualizado.");}
 else{const ref=await addDoc(collection(db,"inventario"),{...data,fechaCreacion:serverTimestamp()});await addDoc(collection(db,"movimientos_inventario"),{productoId:ref.id,productoNombre:nombre,tipo:"INGRESO_INICIAL",cantidad:data.cantidadStock,fecha:serverTimestamp()});if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("NUEVO PRODUCTO",`Creo: ${nombre}`);alert("Producto creado.");}
 await window.cargarInventario();window.nuevoProductoInventario();}
 catch(e){console.error(e);alert("Error: "+e.message);}
};

window.nuevoProductoInventario=()=>{window._productoEditandoId=null;['invNombre','invProveedor','invCategoria','invCostoCompra','invPrecioVenta','invStock','invStockMinimo','invUnidad','invDescripcion','invFechaVence'].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});const titulo=document.getElementById('tituloFormInventario');if(titulo)titulo.innerText="Nuevo Producto";document.getElementById('btnEliminarProducto')?.classList.add('hidden');};

window.eliminarProductoInventario=async()=>{const id=window._productoEditandoId;if(!id){alert("Selecciona un producto.");return;}const clave=prompt("CLAVE MAESTRA:");if(!clave)return;if(clave.trim()!==MASTER_KEY()){alert("Incorrecta.");return;}const nombre=document.getElementById('invNombre')?.value||"---";if(!confirm(`Eliminar "${nombre}". Confirmas?`))return;try{await deleteDoc(doc(db,"inventario",id));if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("ELIMINACION PRODUCTO",`Elimino: ${nombre}`);alert(`"${nombre}" eliminado.`);await window.cargarInventario();window.nuevoProductoInventario();}catch(e){console.error(e);alert("Error: "+e.message);}};

window.filtrarInventario=()=>{
 const filtroTexto=document.getElementById('filtroInventario')?.value.toLowerCase().trim()||"";
 const filtroProveedor=document.getElementById('filtroProveedor')?.value||"";
 if(!window._inventarioCache)return;
 let filtrados=window._inventarioCache;
 if(filtroProveedor){filtrados=filtrados.filter(p=>(p.proveedor||"")===filtroProveedor);}
 if(filtroTexto){filtrados=filtrados.filter(p=>(p.nombre||"").toLowerCase().includes(filtroTexto)||(p.proveedor||"").toLowerCase().includes(filtroTexto)||(p.categoria||"").toLowerCase().includes(filtroTexto));}
 window.renderListaInventario(filtrados);
};

window.actualizarSelectorProveedores=()=>{if(!window._inventarioCache)return;const proveedores=[...new Set(window._inventarioCache.map(p=>p.proveedor).filter(Boolean))];const sel=document.getElementById('filtroProveedor');if(!sel)return;sel.innerHTML=`<option value="">Todos los proveedores</option>`;proveedores.forEach(p=>{sel.innerHTML+=`<option value="${p}">${p}</option>`;});};

window.calcularPrecioFinalAvipet=()=>{const costo=parseFloat(document.getElementById('invCostoCompra')?.value)||0;const margen=parseFloat(document.getElementById('invMargen')?.value)||30;const precio=costo*(1+margen/100);const el=document.getElementById('invPrecioVenta');if(el)el.value=precio.toFixed(2);};

window.actualizarEstadoInventarioVisual=()=>{const stock=parseFloat(document.getElementById('invStock')?.value)||0;const minimo=parseFloat(document.getElementById('invStockMinimo')?.value)||3;const badge=document.getElementById('badgeEstadoStock');if(!badge)return;if(stock<=0){badge.innerText="AGOTADO";badge.className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[8px] font-black";}else if(stock<=minimo){badge.innerText="STOCK BAJO";badge.className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black";}else{badge.innerText="OK";badge.className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black";}};

window.mostrarAjusteRapido=()=>{document.getElementById('panelAjusteRapido')?.classList.toggle('hidden');};

window.aplicarAjusteRapido=async()=>{const id=window._productoEditandoId;if(!id){alert("Selecciona un producto.");return;}const tipo=document.getElementById('tipoAjuste')?.value||"entrada";const cant=parseFloat(document.getElementById('cantAjuste')?.value)||0;const nota=document.getElementById('notaAjuste')?.value?.trim()||"";if(cant<=0){alert("Ingresa una cantidad valida.");return;}try{const snap=await getDoc(doc(db,"inventario",id));if(!snap.exists())return;const stockAct=parseFloat(snap.data().cantidadStock)||0;const nuevo=tipo==="entrada"?stockAct+cant:Math.max(0,stockAct-cant);await updateDoc(doc(db,"inventario",id),{cantidadStock:nuevo,ultimaActualizacion:serverTimestamp()});await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:snap.data().nombre,tipo:tipo==="entrada"?"ENTRADA":"SALIDA",cantidad:cant,stockAntes:stockAct,stockDespues:nuevo,nota,fecha:serverTimestamp()});const elStock=document.getElementById('invStock');if(elStock)elStock.value=nuevo;window.actualizarEstadoInventarioVisual();document.getElementById('panelAjusteRapido')?.classList.add('hidden');await window.cargarInventario();alert(`Stock: ${nuevo} unidades.`);}catch(e){console.error(e);alert("Error: "+e.message);}};

window.verMovimientosProducto=async()=>{const id=window._productoEditandoId;if(!id){alert("Selecciona un producto.");return;}try{const snap=await getDocs(query(collection(db,"movimientos_inventario"),where("productoId","==",id),orderBy("fecha","desc")));if(snap.empty){alert("Sin movimientos registrados.");return;}let html=`<div style="max-height:320px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr style="background:#1e293b;color:#fff;"><th style="padding:6px 8px;text-align:left;">Fecha</th><th style="padding:6px 8px;text-align:center;">Tipo</th><th style="padding:6px 8px;text-align:center;">Cant</th><th style="padding:6px 8px;text-align:center;">Antes-Despues</th><th style="padding:6px 8px;text-align:left;">Nota</th></tr></thead><tbody>`;snap.forEach(d=>{const r=d.data();const fecha=r.fecha?.toDate?r.fecha.toDate().toLocaleDateString():"---";const color=r.tipo?.includes("ENTRADA")?"#16a34a":"#dc2626";html+=`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:5px 8px;">${fecha}</td><td style="padding:5px 8px;text-align:center;font-weight:900;color:${color};">${r.tipo}</td><td style="padding:5px 8px;text-align:center;font-weight:bold;">${r.cantidad}</td><td style="padding:5px 8px;text-align:center;font-size:9px;">${r.stockAntes??'---'}-${r.stockDespues??'---'}</td><td style="padding:5px 8px;font-style:italic;color:#64748b;">${r.nota||'-'}</td></tr>`;});html+=`</tbody></table></div>`;Swal.fire({title:'Movimientos',html,width:680,showConfirmButton:true,confirmButtonText:'Cerrar'});}catch(e){console.error(e);alert("Error: "+e.message);}};

window.descargarReporteProveedor=async()=>{try{const snap=await getDocs(collection(db,"inventario"));const filtroEl=document.getElementById('filtroProveedor');const filtro=filtroEl?.value||"";const datos=[];snap.forEach(d=>{const r=d.data();if(filtro&&r.proveedor!==filtro)return;datos.push({Nombre:r.nombre,Proveedor:r.proveedor||"---",Categoria:r.categoria||"---",Costo:r.costoCompra||0,PrecioVenta:r.precioVenta||0,Stock:r.cantidadStock||0,StockMinimo:r.stockMinimo||3,Unidad:r.unidad||"und",Vencimiento:r.fechaVencimiento||"---",Estado:(r.cantidadStock||0)<=(r.stockMinimo||3)?"BAJO":"OK"});});if(!datos.length){alert("No hay datos para el filtro.");return;}const hoja=XLSX.utils.json_to_sheet(datos);const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,hoja,filtro?`Proveedor_${filtro}`:"Inventario");XLSX.writeFile(libro,`Inventario_${(filtro||"Completo").replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);}catch(e){console.error(e);alert("Error: "+e.message);}};

// PANEL CONFIG 
window.cargarSelectorServicios = async () => {
 const sel = document.getElementById('selectorServicios');
 if (!sel) return;
 try {
 const snap = await getDocs(collection(db, "servicios_maestro"));
 if (snap.empty) return;
 const yaExisten = new Set(Array.from(sel.querySelectorAll('option')).map(o => o.value.toUpperCase()));
 const iconos = {'CONSULTAS':'','VACUNAS':'','LABORATORIO':'','TESTS RAPIDOS':'','REFERIDOS':'','OTROS':''};
 const nuevos = {};
 snap.forEach(d => {
 const nombre = d.id.toUpperCase();
 if (!yaExisten.has(nombre)) {
 const cat = d.data().categoria || 'OTROS';
 if (!nuevos[cat]) nuevos[cat] = [];
 nuevos[cat].push({ id: d.id, ...d.data() });
 }
 });
 Object.entries(nuevos).sort().forEach(([cat, servicios]) => {
 let grp = Array.from(sel.querySelectorAll('optgroup')).find(g => g.label.includes(cat));
 if (!grp) { grp = document.createElement('optgroup'); grp.label = (iconos[cat]||'')+' '+cat; sel.appendChild(grp); }
 servicios.sort((a,b)=>a.id.localeCompare(b.id)).forEach(s => {
 const opt = document.createElement('option');
 opt.value = s.id; opt.textContent = s.id+' ($'+parseFloat(s.precioVenta||0).toFixed(2)+')';
 opt.dataset.nuevo = 'true';
 grp.appendChild(opt);
 });
 });
 } catch(e) { console.warn('Error cargando selector servicios:', e); }
};

window.abrirModalNuevoServicio = async () => {
 var htmlModal = '<div class="space-y-3 text-left">';
 htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Nombre del Servicio</label>';
 htmlModal += '<input id="ns_nombre" type="text" placeholder="Ej: RADIOGRAFIA SIMPLE" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-blue-500"></div>';
 htmlModal += '<div class="grid grid-cols-2 gap-2">';
 htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Precio ($)</label>';
 htmlModal += '<input id="ns_precio" type="number" placeholder="0.00" step="0.50" min="0" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div>';
 htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">% Doctor</label>';
 htmlModal += '<input id="ns_porc" type="number" placeholder="40" step="0.5" min="0" max="100" value="40" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500"></div></div>';
 htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Categoria</label>';
 htmlModal += '<select id="ns_categoria" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-blue-500 bg-white">';
 htmlModal += '<option value="CONSULTAS">Consultas</option><option value="VACUNAS">Vacunas</option>';
 htmlModal += '<option value="LABORATORIO">Laboratorio</option><option value="TESTS RAPIDOS">Tests Rapidos</option>';
 htmlModal += '<option value="REFERIDOS">Referidos</option><option value="OTROS">Otros</option>';
 htmlModal += '<option value="__nueva__">Crear nueva categoria...</option></select>';
 htmlModal += '<input id="ns_categoria_nueva" type="text" placeholder="Ej: CIRUGIAS..." style="display:none" class="w-full border-2 border-blue-300 rounded-xl px-3 py-2 text-[11px] font-bold uppercase outline-none mt-2"></div>';
 htmlModal += '<div><label class="text-[9px] font-black text-slate-500 uppercase block mb-1">Es una vacuna?</label>';
 htmlModal += '<div class="flex gap-3">';
 htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_si" value="si" class="accent-blue-600"> <span class="text-[10px] font-bold">Si</span></label>';
 htmlModal += '<label class="flex items-center gap-1 cursor-pointer"><input type="radio" name="ns_esvacuna" id="ns_vacuna_no" value="no" checked class="accent-blue-600"> <span class="text-[10px] font-bold">No</span></label>';
 htmlModal += '</div></div></div>';

 const res = await Swal.fire({
 title: 'Nuevo Servicio', html: htmlModal,
 showCancelButton: true, confirmButtonText: 'Crear Servicio', cancelButtonText: 'Cancelar',
 confirmButtonColor: '#2563eb',
 didOpen: () => {
 const catSel = document.getElementById('ns_categoria');
 if (catSel) catSel.addEventListener('change', function() {
 const inp = document.getElementById('ns_categoria_nueva');
 if (inp) inp.style.display = this.value === '__nueva__' ? 'block' : 'none';
 });
 },
 preConfirm: () => {
 const nombre = document.getElementById('ns_nombre')?.value.trim().toUpperCase();
 const precio = parseFloat(document.getElementById('ns_precio')?.value) || 0;
 const porc = parseFloat(document.getElementById('ns_porc')?.value) || 40;
 const catSel = document.getElementById('ns_categoria')?.value || 'OTROS';
 const catNueva = document.getElementById('ns_categoria_nueva')?.value.trim().toUpperCase();
 const categoria = catSel === '__nueva__' ? catNueva : catSel;
 const esVacuna = document.getElementById('ns_vacuna_si')?.checked || false;
 if (catSel === '__nueva__' && !catNueva) { Swal.showValidationMessage('Escribe el nombre de la nueva categoria'); return false; }
 if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
 if (precio <= 0) { Swal.showValidationMessage('El precio debe ser mayor a 0'); return false; }
 return { nombre, precio, porc, categoria, esVacuna };
 }
 });
 if (!res.isConfirmed) return;
 const { nombre, precio, porc, categoria, esVacuna } = res.value;
 try {
 const existe = await getDoc(doc(db, "servicios_maestro", nombre));
 if (existe.exists()) { Swal.fire({ icon:'warning', title:'Ya existe', timer:2500, showConfirmButton:false }); return; }
 await setDoc(doc(db, "servicios_maestro", nombre), { precioVenta:precio, porcDoc:porc, categoria, esVacuna, creadoEn:serverTimestamp(), activo:true });
 await window.renderizarTablaMaestra();
 await window.cargarSelectorServicios();
 Swal.fire({ icon:'success', title:'Servicio creado', html:`<b>${nombre}</b><br>$${precio.toFixed(2)} · ${porc}% doctor`, timer:2500, showConfirmButton:false });
 } catch(e) { console.error(e); alert('Error: '+e.message); }
};

window.eliminarServicioMaestro = async (nombreServicio) => {
 const res = await Swal.fire({
 title: 'Eliminar Servicio',
 html: '<p style="font-size:11px;">Eliminar <b>' + nombreServicio + '</b>?</p>',
 icon: 'warning', showCancelButton: true,
 confirmButtonText: 'Si, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
 });
 if (!res.isConfirmed) return;
 try {
 await deleteDoc(doc(db, "servicios_maestro", nombreServicio));
 await window.renderizarTablaMaestra();
 await window.cargarSelectorServicios();
 Swal.fire({ icon:'success', title:'Eliminado', timer:1500, showConfirmButton:false });
 } catch(e) { console.error(e); alert('Error: '+e.message); }
};

window.filtrarTablaServicios = () => {
 const filtro = document.getElementById('filtroServiciosMaestro')?.value.toUpperCase() || '';
 document.querySelectorAll('#tablaServiciosMaestro tr[data-nombre]').forEach(tr => {
 tr.style.display = tr.dataset.nombre.includes(filtro) ? '' : 'none';
 });
};


window.actualizarPrecioIndividual=async(nombreServicio,campo,valor,soloGuardar)=>{try{const snap=await getDoc(doc(db,"servicios_maestro",nombreServicio));const data=snap.exists()?snap.data():{};if(!soloGuardar)data[campo]=parseFloat(valor)||0;await setDoc(doc(db,"servicios_maestro",nombreServicio),data,{merge:true});// porcGlobal eliminado}catch(e){console.error("Error actualizando precio:",e);}};


// DETECCION TIPO INSUMO 
function _detectarTipoInsumo(nombre) {
 const n = nombre.toLowerCase();
 if (n.includes('guante')||n.includes('jeringa')||n.includes('tubo')||n.includes('hisopo')||n.includes('aguja')||n.includes('mariposa')||n.includes('jelco')||n.includes('compresa')||n.includes('gasa')||n.includes('hoja')||n.includes('bisturi')||n.includes('tira')||n.includes('kit')||n.includes('porta')||n.includes('obturador')||n.includes('adhesivo')||n.includes('cinta')) return 'unidad';
 if (n.includes('alcohol')||n.includes('agua oxigenada')||n.includes('gel')||n.includes('solucion')||n.includes('yodo')||n.includes('clorhex')||n.includes('tincion')||n.includes('reactivo')||n.includes('ml')||n.includes('frasco')||n.includes('shampoo')||n.includes('jabon')) return 'volumen';
 if (n.includes('algodon')||n.includes('papel')||n.includes('rollo')||n.includes('bolsa')||n.includes('detergente')||n.includes('guarda')||n.includes('caja')) return 'tiempo';
 return null;
}

async function _calcularUsosInsumo(nombreInsumo, costoUSD) {
 const MARGEN = 0.20;
 let tipo = _detectarTipoInsumo(nombreInsumo);
 if (!tipo) {
 var htmlTipo = '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">';
 htmlTipo += '<button id="btnTipoUnidad" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:11px;color:#1d4ed8;cursor:pointer;">Por unidad (guantes, jeringas, tubos...)</button>';
 htmlTipo += '<button id="btnTipoVolumen" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #d1fae5;background:#f0fdf4;font-weight:900;font-size:11px;color:#065f46;cursor:pointer;">Por volumen (alcohol, gel, soluciones...)</button>';
 htmlTipo += '<button id="btnTipoTiempo" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #fde68a;background:#fffbeb;font-weight:900;font-size:11px;color:#92400e;cursor:pointer;">Por tiempo (algodon, papel, rollos...)</button>';
 htmlTipo += '</div>';
 const resTipo = await Swal.fire({
 title: 'Como se mide este insumo?',
 html: '<p style="font-size:11px;color:#64748b;margin-bottom:8px;"><b>'+nombreInsumo+'</b></p>'+htmlTipo,
 showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Cancelar',
 didOpen: function() {
 document.getElementById('btnTipoUnidad').addEventListener('click', function() { window._tipoInsumo='unidad'; Swal.clickConfirm(); });
 document.getElementById('btnTipoVolumen').addEventListener('click', function() { window._tipoInsumo='volumen'; Swal.clickConfirm(); });
 document.getElementById('btnTipoTiempo').addEventListener('click', function() { window._tipoInsumo='tiempo'; Swal.clickConfirm(); });
 }
 });
 if (resTipo.isDismissed) return null;
 tipo = window._tipoInsumo || 'unidad'; window._tipoInsumo = null;
 }
 let usos = 0;
 if (tipo === 'unidad') {
 const res = await Swal.fire({
 title: 'Unidades - '+nombreInsumo,
 html: '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;"><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Unidades en el paquete/caja</label><input id="q_unidades" type="number" min="1" placeholder="Ej: 100" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Unidades por servicio</label><input id="q_porServicio" type="number" min="1" value="1" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div id="prev_unidad" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;display:none;"><p id="prev_txt_unidad" style="font-size:13px;font-weight:900;color:#16a34a;"></p></div></div>',
 showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#2563eb',
 didOpen: function() {
 const calc = function() { const u=parseFloat(document.getElementById('q_unidades')?.value)||0; const p=parseFloat(document.getElementById('q_porServicio')?.value)||1; const box=document.getElementById('prev_unidad'); const txt=document.getElementById('prev_txt_unidad'); if(u>0&&p>0){const ef=Math.floor((u/p)*(1-MARGEN));txt.textContent=(u/p).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
 document.getElementById('q_unidades')?.addEventListener('input', calc); document.getElementById('q_porServicio')?.addEventListener('input', calc);
 },
 preConfirm: () => { const u=parseFloat(document.getElementById('q_unidades')?.value)||0; const p=parseFloat(document.getElementById('q_porServicio')?.value)||1; if(u<=0){Swal.showValidationMessage('Ingresa las unidades del paquete');return false;} return Math.floor((u/p)*(1-MARGEN)); }
 });
 if (!res.isConfirmed) return null; usos = res.value;
 } else if (tipo === 'volumen') {
 const res = await Swal.fire({
 title: 'Volumen - '+nombreInsumo,
 html: '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;"><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">ml del frasco</label><input id="q_ml" type="number" min="1" placeholder="Ej: 500 ml" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">ml por servicio</label><input id="q_mlServicio" type="number" min="0.1" step="0.5" value="5" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div id="prev_vol" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;display:none;"><p id="prev_txt_vol" style="font-size:13px;font-weight:900;color:#16a34a;"></p></div></div>',
 showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#2563eb',
 didOpen: function() {
 const calc = function() { const ml=parseFloat(document.getElementById('q_ml')?.value)||0; const mls=parseFloat(document.getElementById('q_mlServicio')?.value)||5; const box=document.getElementById('prev_vol'); const txt=document.getElementById('prev_txt_vol'); if(ml>0){const ef=Math.floor((ml/mls)*(1-MARGEN));txt.textContent=(ml/mls).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
 document.getElementById('q_ml')?.addEventListener('input', calc); document.getElementById('q_mlServicio')?.addEventListener('input', calc);
 },
 preConfirm: () => { const ml=parseFloat(document.getElementById('q_ml')?.value)||0; const mls=parseFloat(document.getElementById('q_mlServicio')?.value)||5; if(ml<=0){Swal.showValidationMessage('Ingresa los ml del frasco');return false;} return Math.floor((ml/mls)*(1-MARGEN)); }
 });
 if (!res.isConfirmed) return null; usos = res.value;
 } else if (tipo === 'tiempo') {
 const res = await Swal.fire({
 title: 'Tiempo - '+nombreInsumo,
 html: '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;"><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Meses que dura aprox.</label><input id="q_meses" type="number" min="1" value="3" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div><label style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Servicios al mes en promedio</label><input id="q_serviciosMes" type="number" min="1" placeholder="Ej: 30" style="width:100%;border:2px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;outline:none;"></div><div id="prev_tiempo" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;display:none;"><p id="prev_txt_tiempo" style="font-size:13px;font-weight:900;color:#16a34a;"></p></div></div>',
 showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#2563eb',
 didOpen: function() {
 const calc = function() { const m=parseFloat(document.getElementById('q_meses')?.value)||0; const sm=parseFloat(document.getElementById('q_serviciosMes')?.value)||0; const box=document.getElementById('prev_tiempo'); const txt=document.getElementById('prev_txt_tiempo'); if(m>0&&sm>0){const ef=Math.floor(m*sm*(1-MARGEN));txt.textContent=(m*sm).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
 document.getElementById('q_meses')?.addEventListener('input', calc); document.getElementById('q_serviciosMes')?.addEventListener('input', calc);
 },
 preConfirm: () => { const m=parseFloat(document.getElementById('q_meses')?.value)||0; const sm=parseFloat(document.getElementById('q_serviciosMes')?.value)||0; if(m<=0||sm<=0){Swal.showValidationMessage('Completa los dos campos');return false;} return Math.floor(m*sm*(1-MARGEN)); }
 });
 if (!res.isConfirmed) return null; usos = res.value;
 }
 return usos > 0 ? usos : null;
}

// GESTION DE MEDICAMENTOS MAESTROS 
window.renderizarTablaMedicamentos = async () => {
 const cont = document.getElementById('tablaMedicamentosMaestro');
 if (!cont) return;
 cont.innerHTML = '<p style="text-align:center;font-size:9px;color:#94a3b8;padding:8px;">Cargando...</p>';
 try {
 const snap = await getDocs(collection(db, "medicamentos_maestro"));
 if (snap.empty) { cont.innerHTML='<p style="text-align:center;font-size:9px;color:#94a3b8;padding:12px;">Sin medicamentos. Agrega uno o carga los base.</p>'; return; }
 const meds=[];snap.forEach(d=>meds.push({id:d.id,...d.data()}));meds.sort((a,b)=>(a.nombre||a.id).localeCompare(b.nombre||b.id));
 const tabla=document.createElement('table');tabla.className='w-full text-left border-collapse';
 tabla.innerHTML='<thead><tr class="bg-slate-800 text-white text-[8px] uppercase font-black"><th class="p-2">Medicamento</th><th class="p-2 text-center">Precio ($)</th><th class="p-2 text-center">Agregado por</th><th class="p-2 text-center">OK</th><th class="p-2 text-center">Del</th></tr></thead>';
 const tbody=document.createElement('tbody');
 meds.forEach(r => {
 const tr=document.createElement('tr');tr.className='border-b border-slate-100 hover:bg-purple-50';
 const tdNom=document.createElement('td');tdNom.className='p-2 font-bold uppercase text-slate-800 text-[10px]';tdNom.textContent=r.nombre||r.id;tr.appendChild(tdNom);
 const tdP=document.createElement('td');tdP.className='p-2 text-center';
 const inp=document.createElement('input');inp.type='number';inp.step='0.50';inp.min='0';inp.value=r.precioCliente||0;inp.className='w-24 text-center border border-slate-300 rounded px-1 py-0.5 outline-none text-[10px] font-bold';inp.dataset.id=r.id;
 inp.addEventListener('blur', function() { const doctor=window.doctorVerificado||'Sistema'; updateDoc(doc(db,"medicamentos_maestro",this.dataset.id),{precioCliente:parseFloat(this.value)||0,actualizadoEn:serverTimestamp(),modificadoPor:doctor}); });
 tdP.appendChild(inp);tr.appendChild(tdP);
 const tdDoc=document.createElement('td');tdDoc.className='p-2 text-center text-[9px] text-slate-500 font-bold';tdDoc.textContent=r.agregadoPor||r.modificadoPor||'Sistema';tr.appendChild(tdDoc);
 const tdOK=document.createElement('td');tdOK.className='p-2 text-center';
 const btnOK=document.createElement('button');btnOK.className='text-[8px] px-2 py-1 bg-purple-600 text-white rounded font-black hover:bg-purple-700';btnOK.textContent='OK';btnOK.dataset.id=r.id;
 btnOK.addEventListener('click', async function() { const i=tr.querySelector('input'); await updateDoc(doc(db,"medicamentos_maestro",this.dataset.id),{precioCliente:parseFloat(i?.value)||0,actualizadoEn:serverTimestamp()}); Swal.fire({icon:'success',title:'Guardado',timer:1000,showConfirmButton:false}); });
 tdOK.appendChild(btnOK);tr.appendChild(tdOK);
 const tdDel=document.createElement('td');tdDel.className='p-2 text-center';
 const btnDel=document.createElement('button');btnDel.className='text-[8px] px-2 py-1 bg-red-100 text-red-600 rounded font-black hover:bg-red-600 hover:text-white';btnDel.textContent='Del';btnDel.dataset.id=r.id;btnDel.dataset.nombre=r.nombre||r.id;
 btnDel.addEventListener('click', function() { window.eliminarMedicamentoMaestro(this.dataset.id, this.dataset.nombre); });
 tdDel.appendChild(btnDel);tr.appendChild(tdDel);tbody.appendChild(tr);
 });
 tabla.appendChild(tbody);cont.innerHTML='';cont.appendChild(tabla);
 } catch(e) { cont.innerHTML='<p style="text-align:center;font-size:9px;color:#dc2626;">Error: '+e.message+'</p>'; }
};

window.eliminarMedicamentoMaestro = async (id, nombre) => {
 const res = await Swal.fire({ title:'Eliminar medicamento', html:'<p style="font-size:11px;">Eliminar <b>'+nombre+'</b>?</p>', icon:'warning', showCancelButton:true, confirmButtonText:'Si, eliminar', cancelButtonText:'Cancelar', confirmButtonColor:'#dc2626' });
 if (!res.isConfirmed) return;
 try { await deleteDoc(doc(db,"medicamentos_maestro",id)); window.renderizarTablaMedicamentos(); if(typeof window.cargarSelectorMedicamentos==='function')window.cargarSelectorMedicamentos(); Swal.fire({icon:'success',title:'Eliminado',timer:1200,showConfirmButton:false}); } catch(e) { alert('Error: '+e.message); }
};

window.agregarMedicamentoMaestro = async () => {
 const nombre = document.getElementById('nuevoMedNombre')?.value.trim().toUpperCase();
 const precio = parseFloat(document.getElementById('nuevoMedPrecio')?.value) || 0;
 if (!nombre) { alert('Escribe el nombre del medicamento.'); return; }
 try {
 const agregadoPor = window.doctorVerificado || 'Ajustes';
 await setDoc(doc(db,"medicamentos_maestro",nombre), { nombre, precioCliente:precio, creadoEn:serverTimestamp(), agregadoPor, activo:true }, { merge:true });
 const n=document.getElementById('nuevoMedNombre'); const p=document.getElementById('nuevoMedPrecio');
 if(n)n.value=''; if(p)p.value='';
 await window.renderizarTablaMedicamentos();
 if(typeof window.cargarSelectorMedicamentos==='function')window.cargarSelectorMedicamentos();
 Swal.fire({icon:'success',title:'Medicamento agregado',text:nombre,timer:1500,showConfirmButton:false});
 } catch(e) { alert('Error: '+e.message); }
};
