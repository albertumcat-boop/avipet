// AVIPET -- inventario.js v10 -- fix ajustes, cambiarSubTabConfig

import { db } from './firebase-config.js';
import {
 collection, addDoc, doc, getDoc, setDoc, updateDoc,
 deleteDoc, getDocs, query, where, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA;

// Variables de estado de la calculadora de inventario
let _calcInvAbierto = false;
let _calcInvModo    = 'bcv';
let _calcInvMoneda  = 'bs';

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
 div.innerHTML=`<div class="flex justify-between items-start"><p class="font-black text-slate-800 uppercase text-[11px] tracking-tight leading-none">${p.nombre}</p>${badgeStock}</div><p class="text-[9px] text-slate-400 italic mt-0.5">${p.proveedor||'---'} ? ${p.categoria||'---'}</p><div class="flex justify-between items-center mt-2"><span class="text-[9px] font-black text-slate-500 uppercase">Stock: <span class="${colorStock} text-[12px]">${p.cantidadStock||0}</span> ${p.unidad||'und'}</span><span class="text-[10px] font-black text-blue-700">$${parseFloat(p.precioVenta||0).toFixed(2)}</span></div>`;
 lista.appendChild(div);
 });
};

window.seleccionarProductoInventario = async (id) => {
 try{const snap=await getDoc(doc(db,"inventario",id));if(!snap.exists())return;const p=snap.data();window._productoEditandoId=id;
 const set=(elId,v)=>{const el=document.getElementById(elId);if(el)el.value=v??"";}
 set('invNombre',p.nombre);set('invProveedor',p.proveedor);set('invCategoria',p.categoria);set('invCostoCompra',p.costoCompra);set('invPrecioVenta',p.precioVenta);set('invStock',p.cantidadStock);set('invStockMinimo',p.stockMinimo);set('invUnidad',p.unidad);set('invDescripcion',p.descripcion);set('invFechaVence',p.fechaVencimiento);set('invCodigoBarra',p.codigoBarra);set('invAlicuotaIVA',p.alicuotaIVA??16);
 window.actualizarEstadoInventarioVisual();const titulo=document.getElementById('tituloFormInventario');if(titulo)titulo.innerText=`Editando: ${p.nombre}`;document.getElementById('formInventarioPanel')?.classList.remove('hidden');document.getElementById('btnEliminarProducto')?.classList.remove('hidden');document.getElementById('btnNuevoProducto')?.classList.remove('hidden');}
 catch(e){console.error(e);alert("Error cargando producto.");}
};

window.guardarProductoInventario = async () => {
 const val=(id)=>document.getElementById(id)?.value.trim()||"";const num=(id)=>parseFloat(document.getElementById(id)?.value)||0;
 const nombre=val('invNombre');if(!nombre){alert("El nombre es obligatorio.");return;}
 const ivaEl=document.getElementById('invAlicuotaIVA');const ivaVal=ivaEl?parseFloat(ivaEl.value):16;const iva=isNaN(ivaVal)?16:ivaVal;
 const data={nombre,proveedor:val('invProveedor'),categoria:val('invCategoria'),costoCompra:num('invCostoCompra'),precioVenta:num('invPrecioVenta'),cantidadStock:num('invStock'),stockMinimo:num('invStockMinimo')||3,unidad:val('invUnidad')||"und",descripcion:val('invDescripcion'),fechaVencimiento:val('invFechaVence'),codigoBarra:val('invCodigoBarra'),alicuotaIVA:iva,ultimaActualizacion:serverTimestamp()};
 try{const id=window._productoEditandoId;
 if(id){await updateDoc(doc(db,"inventario",id),data);
 await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:nombre,tipo:"ACTUALIZACION",cantidad:data.cantidadStock,fecha:serverTimestamp()});
 if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("EDICION PRODUCTO",`Edito: ${nombre}`);alert("Producto actualizado.");}
 else{const ref=await addDoc(collection(db,"inventario"),{...data,fechaCreacion:serverTimestamp()});
 await addDoc(collection(db,"movimientos_inventario"),{productoId:ref.id,productoNombre:nombre,tipo:"INGRESO_INICIAL",cantidad:data.cantidadStock,fecha:serverTimestamp()});
 if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("NUEVO PRODUCTO",`Creo: ${nombre}`);alert("Producto creado.");}
 await window.cargarInventario();window.nuevoProductoInventario();}
 catch(e){console.error(e);alert("Error: "+e.message);}
};

window.nuevoProductoInventario=()=>{window._productoEditandoId=null;['invNombre','invProveedor','invCategoria','invCostoCompra','invPrecioVenta','invStock','invStockMinimo','invUnidad','invDescripcion','invFechaVence','invCodigoBarra','invAlicuotaIVA'].forEach(id=>{const el=document.getElementById(id);
if(el)el.value="";});
const titulo=document.getElementById('tituloFormInventario');
if(titulo)titulo.innerText="Nuevo Producto";
document.getElementById('btnEliminarProducto')?.classList.add('hidden');};

window.eliminarProductoInventario=async()=>{const id=window._productoEditandoId;
if(!id){alert("Selecciona un producto.");
return;}const clave=prompt("CLAVE MAESTRA:");
if(!clave)return;
await window._masterKeyReady;
if(clave.trim()!==MASTER_KEY()){alert("Incorrecta.");
return;}const nombre=document.getElementById('invNombre')?.value||"---";
if(!confirm(`Eliminar "${nombre}". Confirmas?`))return;
try{await deleteDoc(doc(db,"inventario",id));
if(typeof window.registrarAuditoriaInventario==="function")await window.registrarAuditoriaInventario("ELIMINACION PRODUCTO",`Elimino: ${nombre}`);alert(`"${nombre}" eliminado.`);
await window.cargarInventario();
window.nuevoProductoInventario();}catch(e){console.error(e);alert("Error: "+e.message);}};

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

window.actualizarEstadoInventarioVisual=()=>{const stock=parseFloat(document.getElementById('invStock')?.value)||0;
const minimo=parseFloat(document.getElementById('invStockMinimo')?.value)||3;
const badge=document.getElementById('badgeEstadoStock');
if(!badge)return;
if(stock<=0){badge.innerText="AGOTADO";badge.className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[8px] font-black";}else if(stock<=minimo){badge.innerText="STOCK BAJO";badge.className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black";}else{badge.innerText="OK";badge.className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black";}};

window.mostrarAjusteRapido=()=>{document.getElementById('panelAjusteRapido')?.classList.toggle('hidden');};

window.aplicarAjusteRapido=async()=>{const id=window._productoEditandoId;
if(!id){alert("Selecciona un producto.");
return;}const tipo=document.getElementById('tipoAjuste')?.value||"entrada";
const cant=parseFloat(document.getElementById('cantAjuste')?.value)||0;
const nota=document.getElementById('notaAjuste')?.value?.trim()||"";
if(cant<=0){alert("Ingresa una cantidad valida.");
return;}try{const snap=await getDoc(doc(db,"inventario",id));
if(!snap.exists())return;
const stockAct=parseFloat(snap.data().cantidadStock)||0;
const nuevo=tipo==="entrada"?stockAct+cant:Math.max(0,stockAct-cant);
await updateDoc(doc(db,"inventario",id),{cantidadStock:nuevo,ultimaActualizacion:serverTimestamp()});
await addDoc(collection(db,"movimientos_inventario"),{productoId:id,productoNombre:snap.data().nombre,tipo:tipo==="entrada"?"ENTRADA":"SALIDA",cantidad:cant,stockAntes:stockAct,stockDespues:nuevo,nota,fecha:serverTimestamp()});
const elStock=document.getElementById('invStock');
if(elStock)elStock.value=nuevo;
window.actualizarEstadoInventarioVisual();
document.getElementById('panelAjusteRapido')?.classList.add('hidden');
await window.cargarInventario();alert(`Stock: ${nuevo} unidades.`);}catch(e){console.error(e);alert("Error: "+e.message);}};

window.verMovimientosProducto=async()=>{const id=window._productoEditandoId;
if(!id){alert("Selecciona un producto.");
return;}try{const snap=await getDocs(query(collection(db,"movimientos_inventario"),where("productoId","==",id)));
if(snap.empty){alert("Sin movimientos registrados.");
return;}const _movDocs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.fecha?.seconds||0)-(a.fecha?.seconds||0));let html=`<div style="max-height:320px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr style="background:#1e293b;color:#fff;"><th style="padding:6px 8px;text-align:left;">Fecha</th><th style="padding:6px 8px;text-align:center;">Tipo</th><th style="padding:6px 8px;text-align:center;">Cant</th><th style="padding:6px 8px;text-align:center;">Antes-Despues</th><th style="padding:6px 8px;text-align:left;">Nota</th></tr></thead><tbody>`;_movDocs.forEach(r=>{
const fecha=r.fecha?.toDate?r.fecha.toDate().toLocaleDateString():"---";
const color=r.tipo?.includes("ENTRADA")?"#16a34a":"#dc2626";html+=`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:5px 8px;">${fecha}</td><td style="padding:5px 8px;text-align:center;font-weight:900;color:${color};">${r.tipo}</td><td style="padding:5px 8px;text-align:center;font-weight:bold;">${r.cantidad}</td><td style="padding:5px 8px;text-align:center;font-size:9px;">${r.stockAntes??'---'}-${r.stockDespues??'---'}</td><td style="padding:5px 8px;font-style:italic;color:#64748b;">${r.nota||'-'}</td></tr>`;});html+=`</tbody></table></div>`;
Swal.fire({title:'Movimientos',html,width:680,showConfirmButton:true,confirmButtonText:'Cerrar'});}catch(e){console.error(e);alert("Error: "+e.message);}};

window.descargarReporteProveedor=async()=>{try{const snap=await getDocs(collection(db,"inventario"));
const filtroEl=document.getElementById('filtroProveedor');
const filtro=filtroEl?.value||"";
const datos=[];snap.forEach(d=>{const r=d.data();
if(filtro&&r.proveedor!==filtro)return;datos.push({Nombre:r.nombre,Proveedor:r.proveedor||"---",Categoria:r.categoria||"---",Costo:r.costoCompra||0,PrecioVenta:r.precioVenta||0,Stock:r.cantidadStock||0,StockMinimo:r.stockMinimo||3,Unidad:r.unidad||"und",Vencimiento:r.fechaVencimiento||"---",Estado:(r.cantidadStock||0)<=(r.stockMinimo||3)?"BAJO":"OK"});});
if(!datos.length){alert("No hay datos para el filtro.");
return;}const hoja=XLSX.utils.json_to_sheet(datos);
const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,hoja,filtro?`Proveedor_${filtro}`:"Inventario");XLSX.writeFile(libro,`Inventario_${(filtro||"Completo").replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);}catch(e){console.error(e);alert("Error: "+e.message);}};

// window.cargarSelectorServicios definida en historia.js

// window.abrirModalNuevoServicio definida en historia.js

// window.eliminarServicioMaestro definida en historia.js

// window.filtrarTablaServicios definida en historia.js

window.actualizarPrecioIndividual=async(nombreServicio,campo,valor,soloGuardar)=>{try{const snap=await getDoc(doc(db,"servicios_maestro",nombreServicio));const data=snap.exists()?snap.data():{};if(!soloGuardar)data[campo]=parseFloat(valor)||0;await setDoc(doc(db,"servicios_maestro",nombreServicio),data,{merge:true});}catch(e){console.error("Error actualizando precio:",e);}};

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
 const calc = function() { const u=parseFloat(document.getElementById('q_unidades')?.value)||0;
 const p=parseFloat(document.getElementById('q_porServicio')?.value)||1;
 const box=document.getElementById('prev_unidad');
 const txt=document.getElementById('prev_txt_unidad');
 if(u>0&&p>0){const ef=Math.floor((u/p)*(1-MARGEN));txt.textContent=(u/p).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
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
 const calc = function() { const ml=parseFloat(document.getElementById('q_ml')?.value)||0;
 const mls=parseFloat(document.getElementById('q_mlServicio')?.value)||5;
 const box=document.getElementById('prev_vol');
 const txt=document.getElementById('prev_txt_vol');
 if(ml>0){const ef=Math.floor((ml/mls)*(1-MARGEN));txt.textContent=(ml/mls).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
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
 const calc = function() { const m=parseFloat(document.getElementById('q_meses')?.value)||0;
 const sm=parseFloat(document.getElementById('q_serviciosMes')?.value)||0;
 const box=document.getElementById('prev_tiempo');
 const txt=document.getElementById('prev_txt_tiempo');
 if(m>0&&sm>0){const ef=Math.floor(m*sm*(1-MARGEN));txt.textContent=(m*sm).toFixed(0)+' usos, margen 20%: '+ef+' efectivos, $'+(costoUSD/ef).toFixed(4)+'/servicio';box.style.display='block';} };
 document.getElementById('q_meses')?.addEventListener('input', calc); document.getElementById('q_serviciosMes')?.addEventListener('input', calc);
 },
 preConfirm: () => { const m=parseFloat(document.getElementById('q_meses')?.value)||0; const sm=parseFloat(document.getElementById('q_serviciosMes')?.value)||0; if(m<=0||sm<=0){Swal.showValidationMessage('Completa los dos campos');return false;} return Math.floor(m*sm*(1-MARGEN)); }
 });
 if (!res.isConfirmed) return null; usos = res.value;
 }
 return usos > 0 ? usos : null;
}

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

window.sincronizarMedicamentosBase = async () => {
 const res = await Swal.fire({ title:'Cargar medicamentos base', html:'<p style="font-size:11px;color:#64748b;">Agrega los medicamentos del sistema. Los que ya existen no se modifican.</p>', icon:'question', showCancelButton:true, confirmButtonText:'Si, cargar', cancelButtonText:'Cancelar', confirmButtonColor:'#7c3aed' });
 if (!res.isConfirmed) return;
 const MEDS_BASE = [
 {nombre:'PIROYET',precioCliente:10},{nombre:'ENROFLOXACINA',precioCliente:5},{nombre:'SULFATRIM',precioCliente:5},
 {nombre:'DEXAMETASONA',precioCliente:4},{nombre:'CARPROFEN',precioCliente:10},{nombre:'FLUNIXIN',precioCliente:5},
 {nombre:'METADOL',precioCliente:5},{nombre:'COMPLEJO B',precioCliente:5},{nombre:'SUERO HIPERINMUNE',precioCliente:10},
 {nombre:'BROMURO DE HIOSCINA',precioCliente:10},{nombre:'FENOBARBITAL',precioCliente:5},{nombre:'GASTRINE',precioCliente:7},
 {nombre:'RANITIDINA',precioCliente:5},{nombre:'METOCLOPRAMIDA',precioCliente:5},{nombre:'FUROSEMIDA',precioCliente:5},
 {nombre:'VIT K',precioCliente:5},{nombre:'ERITROGEN',precioCliente:5},{nombre:'AMINOVIT',precioCliente:10},
 {nombre:'OXITETRACICLINA',precioCliente:5},{nombre:'CEFTRIAXONA',precioCliente:12},{nombre:'ADRENALINA',precioCliente:14},
 {nombre:'ARTROSAN',precioCliente:20},{nombre:'LISAVAC',precioCliente:5},{nombre:'SOROGLOBULIN',precioCliente:25},
 ];
 try {
 Swal.fire({title:'Cargando...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
 let cnt=0;
 for (const m of MEDS_BASE) {
 const snap=await getDocs(query(collection(db,"medicamentos_maestro"),where("nombre","==",m.nombre)));
 if(snap.empty){await setDoc(doc(db,"medicamentos_maestro",m.nombre),{nombre:m.nombre,precioCliente:m.precioCliente,creadoEn:serverTimestamp(),agregadoPor:'Base del sistema',activo:true});cnt++;}
 }
 Swal.close();
 await window.renderizarTablaMedicamentos();
 if(typeof window.cargarSelectorMedicamentos==='function')window.cargarSelectorMedicamentos();
 Swal.fire({icon:'success',title:cnt+' medicamentos cargados',text:'Los que ya existian no fueron modificados.',timer:2500,showConfirmButton:false});
 } catch(e) { Swal.close(); alert('Error: '+e.message); }
};

// AGREGAR INSUMO MAESTRO 
window.agregarInsumoMaestro = async () => {
 const nombre = document.getElementById('nuevoInsumoNombre')?.value.trim().toUpperCase();
 const costoIngresado = parseFloat(document.getElementById('nuevoInsumoCosto')?.value) || 0;
 if (!nombre) { alert('Escribe el nombre del insumo.'); return; }
 if (costoIngresado <= 0) { alert('Escribe el costo del insumo.'); return; }
 try {
 const snap = await getDocs(query(collection(db, "insumos_maestro"), where("nombre", "==", nombre)));
 if (!snap.empty) { alert('Ya existe un insumo con ese nombre.'); return; }
 const MARGEN=0.20; const tasa=window.tasaDolarHoy||36;
 var htmlMoneda='<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">';
 htmlMoneda+='<button id="btnMonedaUSD" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:12px;color:#1d4ed8;cursor:pointer;">Dolares (USD)</button>';
 htmlMoneda+='<button id="btnMonedaBS" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #fde68a;background:#fffbeb;font-weight:900;font-size:12px;color:#92400e;cursor:pointer;">Bolivares (Bs '+tasa.toFixed(2)+')</button></div>';
 const resMoneda = await Swal.fire({
 title:'En que moneda esta el precio?',
 html:'<p style="font-size:11px;color:#64748b;margin-bottom:8px;"><b>'+nombre+'</b><br>Precio: <b>'+costoIngresado.toFixed(2)+'</b></p>'+htmlMoneda,
 showConfirmButton:false, showCancelButton:true, cancelButtonText:'Cancelar',
 didOpen:function(){document.getElementById('btnMonedaUSD').addEventListener('click',function(){window._monedaInsumo='usd';Swal.clickConfirm();});document.getElementById('btnMonedaBS').addEventListener('click',function(){window._monedaInsumo='bs';Swal.clickConfirm();});}
 });
 if(resMoneda.isDismissed)return;
 const moneda=window._monedaInsumo||'usd';window._monedaInsumo=null;
 const costoUSD=moneda==='bs'?costoIngresado/tasa:costoIngresado;
 const usosEfectivos=await _calcularUsosInsumo(nombre,costoUSD);
 if(!usosEfectivos)return;
 const costoPorUso=costoUSD/usosEfectivos;
 await addDoc(collection(db,"insumos_maestro"),{nombre,costoTotal:costoUSD,costoOriginalBS:moneda==='bs'?costoIngresado:null,costo:parseFloat(costoPorUso.toFixed(4)),usosEstimados:usosEfectivos,margenSeguridad:MARGEN,creadoEn:serverTimestamp()});
 const inpN=document.getElementById('nuevoInsumoNombre');const inpC=document.getElementById('nuevoInsumoCosto');if(inpN)inpN.value='';if(inpC)inpC.value='';
 await window.renderizarTablaInsumos();
 await Swal.fire({icon:'success',title:'Insumo agregado',html:'<b>'+nombre+'</b><br>$'+costoPorUso.toFixed(4)+' por servicio, '+usosEfectivos+' usos',timer:2000,showConfirmButton:false});

 // Asociar insumo a servicios
 await window._asociarInsumoAServicios(nombre, parseFloat(costoPorUso.toFixed(4)));

 } catch(e) { console.error(e); alert('Error: '+e.message); }
};

window.actualizarCostoInsumo = async (idInsumo, valor) => {
 const valorIngresado=parseFloat(valor)||0; if(valorIngresado<=0)return;
 const MARGEN=0.20; const tasa=window.tasaDolarHoy||36;
 var htmlMoneda='<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">';
 htmlMoneda+='<button id="btnMonedaUSD" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #bfdbfe;background:#eff6ff;font-weight:900;font-size:12px;color:#1d4ed8;cursor:pointer;">Dolares (USD)</button>';
 htmlMoneda+='<button id="btnMonedaBS" type="button" style="width:100%;padding:12px;border-radius:10px;border:2px solid #fde68a;background:#fffbeb;font-weight:900;font-size:12px;color:#92400e;cursor:pointer;">Bolivares (Bs '+tasa.toFixed(2)+')</button></div>';
 const resMoneda=await Swal.fire({
 title:'En que moneda esta el precio?',
 html:'<p style="font-size:11px;color:#64748b;margin-bottom:8px;">Precio: <b>'+valorIngresado.toFixed(2)+'</b></p>'+htmlMoneda,
 showConfirmButton:false,showCancelButton:true,cancelButtonText:'Cancelar',
 didOpen:function(){document.getElementById('btnMonedaUSD').addEventListener('click',function(){window._monedaInsumo='usd';Swal.clickConfirm();});document.getElementById('btnMonedaBS').addEventListener('click',function(){window._monedaInsumo='bs';Swal.clickConfirm();});}
 });
 if(resMoneda.isDismissed)return;
 const moneda=window._monedaInsumo||'usd';window._monedaInsumo=null;
 const costoUSD=moneda==='bs'?valorIngresado/tasa:valorIngresado;
 let nombreInsumo=idInsumo;
 try{const snap=await getDoc(doc(db,"insumos_maestro",idInsumo));if(snap.exists())nombreInsumo=snap.data().nombre||idInsumo;}catch(e){}
 const usosEfectivos=await _calcularUsosInsumo(nombreInsumo,costoUSD);if(!usosEfectivos)return;
 const costoPorUso=costoUSD/usosEfectivos;
 await Swal.fire({icon:'success',title:'Costo calculado',html:'<p style="font-size:11px;">USD: <b>$'+costoUSD.toFixed(4)+'</b>'+(moneda==='bs'?' (Bs '+valorIngresado.toFixed(2)+')':'')+'</p><p style="font-size:11px;">Usos: <b>'+usosEfectivos+'</b></p><p style="font-size:16px;font-weight:900;color:#2563eb;">$'+costoPorUso.toFixed(4)+' por servicio</p>',timer:3000,showConfirmButton:false});
 try{await updateDoc(doc(db,"insumos_maestro",idInsumo),{costoTotal:costoUSD,costoOriginalBS:moneda==='bs'?valorIngresado:null,costo:parseFloat(costoPorUso.toFixed(4)),usosEstimados:usosEfectivos,margenSeguridad:MARGEN,actualizadoEn:serverTimestamp()});window.renderizarTablaInsumos();}catch(e){console.error(e);}
};

window.eliminarInsumoIndividual=async(idInsumo,nombreInsumo)=>{const clave=prompt('Eliminar '+nombreInsumo+' - CLAVE MAESTRA:');if(!clave)return;await window._masterKeyReady;if(clave.trim()!==MASTER_KEY()){alert('Clave incorrecta.');return;}if(!confirm('Eliminar '+nombreInsumo+'. Confirmas?'))return;try{await deleteDoc(doc(db,'insumos_maestro',idInsumo));alert('Eliminado.');window.renderizarTablaInsumos();}catch(e){console.error(e);alert('Error: '+e.message);}};

// REPARAR CATEGORÍAS — asigna categoria a todos los servicios sin ella
window.repararCategorias = async () => {
  function _cat(nombre) {
    const n = nombre.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if (n.startsWith('VACUNA'))    return 'VACUNAS';
    if (n.startsWith('CONSULTA'))  return 'CONSULTAS';
    if (n.startsWith('ECOGRAFIA')) return 'ECOGRAFIA';
    if (n.startsWith('EUTANASIA') || n.startsWith('OXIGENO') || n.startsWith('CIRUGIA')) return 'CIRUGIAS';
    if (n.startsWith('HEMATOLOGIA') || n.startsWith('QUIMICA') || n.startsWith('EXAMEN') ||
        n.startsWith('CITOLOGIA')   || n.startsWith('DESCARTE') || n.startsWith('DISTEMPER') ||
        n.startsWith('PARVO')       || n.startsWith('FILARIA')   || n.startsWith('SIDA') ||
        n.startsWith('TEST')        || n.startsWith('PERFIL')    || n.startsWith('RASPADO') ||
        n.startsWith('REFERIDO')    || n.startsWith('TOMA DE MUESTRA')) return 'LABORATORIO';
    return 'OTROS PROCEDIMIENTOS';
  }
  try {
    Swal.fire({title:'Reparando categorías...', allowOutsideClick:false, didOpen:()=>Swal.showLoading()});
    const snap = await getDocs(collection(db, 'servicios_maestro'));
    const batch = (await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")).writeBatch(db);
    let cnt = 0;
    snap.forEach(d => {
      const correcta = _cat(d.id);
      const actual = (d.data().categoria || '').toUpperCase().trim();
      if (actual !== correcta) {
        batch.update(d.ref, { categoria: correcta });
        cnt++;
      }
    });
    if (cnt > 0) await batch.commit();
    Swal.close();
    Swal.fire({icon:'success', title:'Categorías reparadas', text:`${cnt} servicios actualizados.`, timer:2500, showConfirmButton:false});
    window.renderizarTablaMaestra && window.renderizarTablaMaestra();
  } catch(e) { Swal.close(); alert('Error: '+e.message); }
};

// INICIALIZAR BD
window.inicializarBaseDeDatosCompleta=async()=>{const clave=prompt("CLAVE MAESTRA:");if(!clave)return;await window._masterKeyReady;if(clave.trim()!==MASTER_KEY()){alert("Clave incorrecta.");return;}if(!confirm("Inicializar catalogo de servicios en Firebase?"))return;
const SERVICIOS_DEFAULT={
  "CONSULTA GENERAL":{precioVenta:30,porcDoc:40,categoria:"CONSULTAS"},
  "CONSULTA OFTALMOLOGICA":{precioVenta:80,porcDoc:12.5,categoria:"CONSULTAS"},
  "CONSULTA DE EMERGENCIA":{precioVenta:40,porcDoc:40,categoria:"CONSULTAS"},
  "CONSULTA CAMADA 3-4 CACHORROS":{precioVenta:50,porcDoc:40,categoria:"CONSULTAS"},
  "CONSULTA CAMADA HASTA 8 CACHORROS":{precioVenta:80,porcDoc:40,categoria:"CONSULTAS"},
  "CONSULTA CAMADA MAS DE 8 CACHORROS":{precioVenta:100,porcDoc:40,categoria:"CONSULTAS"},
  "ECOGRAFIA":{precioVenta:30,porcDoc:40,categoria:"ECOGRAFIA"},
  "VACUNA SEXTUPLE":{precioVenta:40,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA PUPPY":{precioVenta:40,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA ANTIRRABICA":{precioVenta:30,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA KC (TOS DE LAS PERRERAS)":{precioVenta:45,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA TRIPLE FELINA":{precioVenta:45,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA QUINTUPLE FELINA":{precioVenta:50,porcDoc:50,categoria:"VACUNAS"},
  "VACUNA BIOVETA":{precioVenta:60,porcDoc:50,categoria:"VACUNAS"},
  "HEMATOLOGIA COMPLETA":{precioVenta:23,porcDoc:34.78,categoria:"LABORATORIO"},
  "QUIMICA SANGUINEA":{precioVenta:60,porcDoc:50,categoria:"LABORATORIO"},
  "DESCARTE HEMOPARASITO":{precioVenta:50,porcDoc:50,categoria:"LABORATORIO"},
  "DISTEMPER":{precioVenta:35,porcDoc:50,categoria:"LABORATORIO"},
  "PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50,categoria:"LABORATORIO"},
  "FILARIASIS":{precioVenta:40,porcDoc:50,categoria:"LABORATORIO"},
  "SIDA - LEUCEMIA":{precioVenta:40,porcDoc:50,categoria:"LABORATORIO"},
  "TEST HELICOBACTER PYLORI AG":{precioVenta:40,porcDoc:50,categoria:"LABORATORIO"},
  "HEMATOLOGIA + QUIMICA + HEMOPARASITOS":{precioVenta:110,porcDoc:50,categoria:"LABORATORIO"},
  "EXAMEN DE HECES":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "EXAMENES DE ORINA":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "CITOLOGIA 1 OIDO":{precioVenta:15,porcDoc:50,categoria:"LABORATORIO"},
  "CITOLOGIA 2 OIDOS":{precioVenta:20,porcDoc:50,categoria:"LABORATORIO"},
  "CITOLOGIA FLUIDOS, SECRECIONES":{precioVenta:15,porcDoc:50,categoria:"LABORATORIO"},
  "RASPADO PIEL":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "PERFIL ANEMICO":{precioVenta:25,porcDoc:17.5,categoria:"LABORATORIO"},
  "TOMA DE MUESTRA SANGRE":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "DESCARTE HEMOPARASITO ANAP ERL FIL BAB":{precioVenta:60,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: EXAMEN DE HECES":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: EXAMENES DE ORINA":{precioVenta:10,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: CULTIVOS":{precioVenta:30,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: DESCARTE HEMOPARASITO":{precioVenta:40,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: DESCARTE HEMOPARASITO ANAP ERL":{precioVenta:55,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: DISTEMPER":{precioVenta:35,porcDoc:50,categoria:"LABORATORIO"},
  "REFERIDO: PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50,categoria:"LABORATORIO"},
  "EUTANASIA HASTA 5KG":{precioVenta:80,porcDoc:50,categoria:"CIRUGIAS"},
  "EUTANASIA HASTA 15KG":{precioVenta:110,porcDoc:50,categoria:"CIRUGIAS"},
  "EUTANASIA HASTA 25KG":{precioVenta:140,porcDoc:50,categoria:"CIRUGIAS"},
  "EUTANASIA HASTA 35KG":{precioVenta:170,porcDoc:50,categoria:"CIRUGIAS"},
  "ABSCESO":{precioVenta:25,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "COLOCACION VIA":{precioVenta:15,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "COLOCACION VIA PERDIDA":{precioVenta:20,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "ADMINISTRACION MEDICINA":{precioVenta:10,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "ASPIRADO GANGLIONAR":{precioVenta:20,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "CURA HERIDA TIPO 1":{precioVenta:20,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "CURA HERIDA TIPO 2":{precioVenta:30,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "CURA HERIDA TIPO 3":{precioVenta:40,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "INDUCCION ANESTESICA":{precioVenta:30,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "LIMPIEZA PROFUDA OIDOS":{precioVenta:15,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "QUITAR PUNTOS":{precioVenta:10,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"},
  "CREMACION CON CENIZAS":{precioVenta:80,porcDoc:0,categoria:"OTROS PROCEDIMIENTOS"},
  "DISPOSICION":{precioVenta:30,porcDoc:0,categoria:"OTROS PROCEDIMIENTOS"},
  "KG ADICIONAL":{precioVenta:5,porcDoc:50,categoria:"OTROS PROCEDIMIENTOS"}
};
try{Swal.fire({title:'Inicializando...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});let cnt=0;for(const[nombre,datos]of Object.entries(SERVICIOS_DEFAULT)){await setDoc(doc(db,"servicios_maestro",nombre),{...datos,actualizadoEn:serverTimestamp()},{merge:true});cnt++;}Swal.close();alert(`${cnt} servicios inicializados.`);window.renderizarTablaMaestra();}catch(e){Swal.close();console.error(e);alert("Error: "+e.message);}};

// CAMBIAR SUB-TAB CONFIG 
window.cambiarSubTabConfig = (tab) => {
  ['servicios','insumos','medicamentos','seguridad','tarifa','compras','empleados'].forEach(t => {
    const panel = document.getElementById('panel_subTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const btn   = document.getElementById('btn_subTab'   + t.charAt(0).toUpperCase() + t.slice(1));
    const activo = t === tab;
    panel?.classList.toggle('hidden', !activo);
    if (btn) {
      btn.style.background    = activo ? '#2563eb' : 'transparent';
      btn.style.color         = activo ? '#ffffff' : '#64748b';
      btn.style.fontWeight    = '900';
      btn.style.fontSize      = '10px';
      btn.style.padding       = '8px 4px';
      btn.style.borderRadius  = '8px';
      btn.style.border        = 'none';
      btn.style.cursor        = 'pointer';
      btn.style.textTransform = 'uppercase';
      btn.style.whiteSpace    = 'nowrap';
      btn.style.overflow      = 'hidden';
      btn.style.textOverflow  = 'ellipsis';
    }
  });
  if (tab === 'servicios')    { if(typeof window.renderizarTablaMaestra==='function') window.renderizarTablaMaestra(); else _llamarFuncion('renderizarTablaMaestra'); }
  if (tab === 'insumos')      { if(typeof window.renderizarTablaInsumos==='function') window.renderizarTablaInsumos(); else _llamarFuncion('renderizarTablaInsumos'); }
  if (tab === 'medicamentos') _llamarFuncion('renderizarTablaMedicamentos');
  if (tab === 'compras')      { if(typeof window.cargarRegistroCompras==='function') window.cargarRegistroCompras(); else _llamarFuncion('cargarRegistroCompras'); }
  if (tab === 'empleados')   { if(typeof window.cargarEmpleadosTelefono==='function') window.cargarEmpleadosTelefono(); else _llamarFuncion('cargarEmpleadosTelefono'); }
};

window.calcInvAplicar = () => {
 if(!window._calcInvResultado)return;
 const{costoUSD,precioVenta}=window._calcInvResultado;
 const elCosto=document.getElementById('invCostoCompra');
 const elVenta=document.getElementById('invPrecioVenta');
 if(elCosto){elCosto.value=costoUSD.toFixed(2);elCosto.style.background='#d1fae5';setTimeout(()=>elCosto.style.background='',1200);}
 if(elVenta){elVenta.value=precioVenta.toFixed(2);elVenta.style.background='#dbeafe';setTimeout(()=>elVenta.style.background='',1200);}
 _calcInvAbierto=false;
 document.getElementById('calcInvCuerpo')?.classList.add('hidden');
 const ch=document.getElementById('calcInvChevron');if(ch)ch.innerText=' Abrir';
 Swal.fire({icon:'success',title:'Valores aplicados',text:`Costo: $${costoUSD.toFixed(2)}  x  Venta: $${precioVenta.toFixed(2)}`,timer:2000,showConfirmButton:false});
};

window.inicializarCalculadoraInventario = () => {
 const tasa=window.tasaDolarHoy||36;
 const el=document.getElementById('calcInvTasaBCV');
 if(el)el.value=tasa.toFixed(2);
 _calcInvAbierto=false; _calcInvModo='bcv'; _calcInvMoneda='bs';
};

// AUDITORIA 
window.verAuditoriaInventario = async () => {
 try {
 const snap=await getDocs(query(collection(db,"auditoria_inventario"),orderBy("fecha","desc")));
 if(snap.empty){alert("Sin registros de auditoria.");return;}
 let html=`<div style="max-height:380px;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr style="background:#1e293b;color:#fff;"><th style="padding:6px 8px;text-align:left;">Fecha</th><th style="padding:6px 8px;">Usuario</th><th style="padding:6px 8px;">Accion</th><th style="padding:6px 8px;">Detalle</th></tr></thead><tbody>`;
 snap.forEach(d=>{const r=d.data();const fecha=r.fecha?.toDate?r.fecha.toDate().toLocaleString():"---";html+=`<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:5px 8px;font-size:9px;">${fecha}</td><td style="padding:5px 8px;font-weight:700;">${r.usuario||'---'}</td><td style="padding:5px 8px;color:#2563eb;font-weight:700;">${r.accion||'---'}</td><td style="padding:5px 8px;color:#64748b;">${r.detalle||''}</td></tr>`;});
 html+=`</tbody></table></div>`;
 Swal.fire({title:'Auditoria Inventario',html,width:700,showConfirmButton:true,confirmButtonText:'Cerrar'});
 } catch(e){console.error(e);alert("Error: "+e.message);}
};

window.registrarAuditoriaInventario = async (accion, detalle) => {
 try {
 const usuario = window.doctorVerificado || window.usuarioActivo || 'Sistema';
 await addDoc(collection(db,"auditoria_inventario"),{accion,detalle,usuario,fecha:serverTimestamp()});
 } catch(e){console.warn("Error auditoria:",e);}
};

// VERIFICAR STOCK 
window.verificarStockProducto = async (nombreProducto) => {
 try {
 const snap=await getDocs(query(collection(db,"inventario"),where("nombre","==",nombreProducto.toUpperCase())));
 if(snap.empty)return;
 const p=snap.docs[0].data();
 if((p.cantidadStock||0)<=(p.stockMinimo||3)){
 Swal.fire({icon:'warning',title:'Stock Bajo',html:`<b>${p.nombre}</b><br>Stock actual: <b>${p.cantidadStock}</b>  x  Minimo: ${p.stockMinimo||3}`,timer:4000,timerProgressBar:true,showConfirmButton:false});
 }
 } catch(e){console.warn("Error verificando stock:",e);}
};

window._verificarStockServicio = async (nombreServicio) => {
 try {
 const snap=await getDocs(query(collection(db,"inventario"),where("nombre","==",nombreServicio.toUpperCase())));
 if(!snap.empty){const p=snap.docs[0].data();if((p.cantidadStock||0)<=(p.stockMinimo||3))Swal.fire({icon:'warning',title:'Stock Bajo',html:`<b>${p.nombre}</b>: ${p.cantidadStock} unidades`,timer:3000,showConfirmButton:false});}
 } catch(e){}
};


window._asociarInsumoAServicios = async (nombre, costo) => {
 try {
  const snapServs = await getDocs(collection(db,"servicios_maestro"));
  const listaServs = [];
  snapServs.forEach(sd => listaServs.push({id:sd.id, insumos:sd.data().insumos||[]}));
  listaServs.sort((a,b)=>a.id.localeCompare(b.id));
  let html = '<p style="font-size:10px;color:#64748b;margin:0 0 8px 0;">Agregar <b>'+nombre+'</b> a:</p>';
  html += '<div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;">';
  listaServs.forEach(s => {
   const ya = s.insumos.some(i=>(i.nombre||'').toUpperCase()===nombre.toUpperCase());
   html += '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid '+(ya?'#bbf7d0':'#e2e8f0')+';border-radius:8px;cursor:pointer;background:'+(ya?'#f0fdf4':'#f8fafc')+';opacity:'+(ya?'0.6':'1')+'">' +
    '<input type="checkbox" class="chk-serv-ins" value="'+s.id+'" '+(ya?'checked disabled':'')+' style="width:15px;height:15px;accent-color:#2563eb;">' +
    '<span style="flex:1;font-size:11px;font-weight:700;color:#1e293b;">'+s.id+'</span>' +
    (ya?'<span style="font-size:9px;color:#16a34a;font-weight:900;">Ya incluido</span>':'')+
    '</label>';
  });
  html += '</div>';
  const res = await Swal.fire({title:'Agregar a servicios',html,width:520,showCancelButton:true,confirmButtonText:'Agregar',cancelButtonText:'Omitir',confirmButtonColor:'#2563eb'});
  if (!res.isConfirmed) return;
  const sels = Array.from(document.querySelectorAll('.chk-serv-ins:checked:not(:disabled)')).map(c=>c.value);
  if (!sels.length) return;
  let cnt = 0;
  for (const id of sels) {
   const sn = await getDoc(doc(db,"servicios_maestro",id));
   if (!sn.exists()) continue;
   const ins = sn.data().insumos||[];
   if (ins.some(i=>(i.nombre||'').toUpperCase()===nombre.toUpperCase())) continue;
   ins.push({nombre,costo,bloqueado:false});
   await setDoc(doc(db,"servicios_maestro",id),{insumos:ins},{merge:true});
   cnt++;
  }
  if (cnt>0) await Swal.fire({icon:'success',title:'Listo',html:'<b>'+nombre+'</b> agregado a <b>'+cnt+'</b> servicio(s)',timer:2000,showConfirmButton:false});
 } catch(e){console.warn('Error asociando insumo:',e);}
};
console.log(" inventario.js v12 -- agregar insumo con selector de servicios");

// =========================================================
// AJUSTE POR CONTEO FÍSICO
// =========================================================
window.abrirAjusteConteo = async function() {
  const cache = window._inventarioCache || [];
  if (!cache.length) { alert('Carga el inventario primero.'); return; }

  const filas = cache.map(p => `
    <tr>
      <td style="padding:4px 6px;font-size:10px;font-weight:bold;" data-id="${p.id}">${p.nombre}</td>
      <td style="padding:4px 6px;text-align:center;font-size:10px;color:#64748b;">${p.cantidadStock||0} ${p.unidad||'und'}</td>
      <td style="padding:4px 6px;text-align:center;">
        <input type="number" data-ajuste="${p.id}" min="0" step="1"
          value="${p.cantidadStock||0}"
          style="width:60px;border:1px solid #cbd5e1;border-radius:6px;padding:2px 4px;text-align:center;font-size:11px;">
      </td>
    </tr>`).join('');

  const result = await Swal.fire({
    title: '📦 Ajuste por Conteo Físico',
    html: `<p style="font-size:10px;color:#64748b;margin-bottom:10px;">
      Ingresa el conteo real de cada producto. Solo se guardan los que cambien.
    </p>
    <div style="max-height:350px;overflow-y:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#1e293b;color:#fff;position:sticky;top:0;">
          <th style="padding:4px 6px;text-align:left;font-size:9px;">Producto</th>
          <th style="padding:4px 6px;font-size:9px;">Sistema</th>
          <th style="padding:4px 6px;font-size:9px;">Conteo Real</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`,
    width: 500,
    showCancelButton: true,
    confirmButtonText: '✅ Aplicar Ajuste',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#1d4ed8',
    preConfirm: () => {
      const ajustes = [];
      document.querySelectorAll('[data-ajuste]').forEach(inp => {
        const id      = inp.dataset.ajuste;
        const nuevo   = parseInt(inp.value) || 0;
        const prod    = cache.find(p => p.id === id);
        const actual  = prod ? (prod.cantidadStock || 0) : 0;
        if (nuevo !== actual) ajustes.push({ id, nombre: prod?.nombre||id, actual, nuevo, diff: nuevo - actual });
      });
      return ajustes;
    }
  });

  if (!result.isConfirmed || !result.value.length) return;
  const ajustes = result.value;

  const confirmHtml = ajustes.map(a =>
    `<p style="font-size:11px;color:${a.diff>0?'#16a34a':'#dc2626'};">
      ${a.nombre}: ${a.actual} → <b>${a.nuevo}</b> (${a.diff>0?'+':''}${a.diff})
    </p>`).join('');

  const conf = await Swal.fire({
    title: `Confirmar ${ajustes.length} ajuste(s)`,
    html: confirmHtml, width: 420,
    showCancelButton: true, confirmButtonText: 'Confirmar',
    confirmButtonColor: '#1d4ed8'
  });
  if (!conf.isConfirmed) return;

  try {
    for (const a of ajustes) {
      await updateDoc(doc(db,'inventario',a.id), {
        cantidadStock: a.nuevo, ultimaActualizacion: serverTimestamp()
      });
      await addDoc(collection(db,'movimientos_inventario'), {
        productoId: a.id, productoNombre: a.nombre,
        tipo: 'AJUSTE-CONTEO',
        cantidad: Math.abs(a.diff),
        diferencia: a.diff,
        stockAnterior: a.actual, stockResultante: a.nuevo,
        fecha: serverTimestamp()
      });
    }
    Swal.fire({ icon:'success', title:`${ajustes.length} ajuste(s) aplicados ✓`, timer:2000, showConfirmButton:false });
    window.cargarInventario();
  } catch(e) { alert('Error: ' + e.message); }
};

// =========================================================
// COBERTURA + VALORACIÓN DEL INVENTARIO
// =========================================================
window.mostrarAnalisisInventario = async function() {
  const cache = window._inventarioCache || [];
  if (!cache.length) { alert('Carga el inventario primero.'); return; }

  // Ventas de últimos 30 días desde movimientos_inventario
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
  let movSnap;
  try {
    movSnap = await getDocs(query(collection(db,'movimientos_inventario'), where('tipo','==','SALIDA-FACTURA'), orderBy('fecha','desc'), limit(500)));
  } catch(e) { movSnap = { docs: [] }; }

  const ventasPorId = {};
  movSnap.docs?.forEach(d => {
    const m = d.data();
    if (!ventasPorId[m.productoId]) ventasPorId[m.productoId] = 0;
    ventasPorId[m.productoId] += (m.cantidad || 0);
  });

  let valorTotal = 0, valorCosto = 0;
  const filas = cache.map(p => {
    const stock  = parseFloat(p.cantidadStock || 0);
    const pv     = parseFloat(p.precioVenta || 0);
    const pc     = parseFloat(p.costoCompra || 0);
    const vendidos30 = ventasPorId[p.id] || 0;
    const vendidosDia = vendidos30 / 30;
    const coberturaDias = vendidosDia > 0 ? Math.floor(stock / vendidosDia) : (stock > 0 ? 999 : 0);
    const margen = pc > 0 ? ((pv - pc) / pc * 100) : 0;
    valorTotal += stock * pv;
    valorCosto += stock * pc;

    const colCob = coberturaDias <= 7 ? '#dc2626' : coberturaDias <= 15 ? '#d97706' : '#16a34a';
    const cobText = coberturaDias >= 999 ? 'Sin ventas' : `${coberturaDias}d`;
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:4px 6px;font-size:10px;font-weight:bold;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${p.nombre}</td>
      <td style="padding:4px 6px;text-align:center;font-size:10px;">${stock}</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px;">$${pv.toFixed(2)}</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px;color:#16a34a;">$${(stock*pv).toFixed(2)}</td>
      <td style="padding:4px 6px;text-align:center;font-size:10px;font-weight:bold;color:${colCob};">${cobText}</td>
      <td style="padding:4px 6px;text-align:center;font-size:10px;color:${margen>30?'#16a34a':margen>10?'#d97706':'#dc2626'};">${margen.toFixed(0)}%</td>
    </tr>`;
  }).join('');

  Swal.fire({
    title: '📊 Análisis de Inventario',
    html: `<div style="text-align:left;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="background:#eff6ff;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:8px;color:#64748b;font-weight:bold;">VALOR VENTA</div>
          <div style="font-size:14px;font-weight:900;color:#1d4ed8;">$${valorTotal.toFixed(2)}</div>
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:8px;color:#64748b;font-weight:bold;">VALOR COSTO</div>
          <div style="font-size:14px;font-weight:900;color:#16a34a;">$${valorCosto.toFixed(2)}</div>
        </div>
        <div style="background:#fefce8;border-radius:8px;padding:8px;text-align:center;">
          <div style="font-size:8px;color:#64748b;font-weight:bold;">UTILIDAD BRUTA</div>
          <div style="font-size:14px;font-weight:900;color:#d97706;">$${(valorTotal-valorCosto).toFixed(2)}</div>
        </div>
      </div>
      <div style="max-height:340px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#1e293b;color:#fff;position:sticky;top:0;">
            <th style="padding:4px 6px;text-align:left;font-size:9px;">Producto</th>
            <th style="padding:4px 6px;font-size:9px;">Stock</th>
            <th style="padding:4px 6px;font-size:9px;">P/Venta</th>
            <th style="padding:4px 6px;font-size:9px;">Valor $</th>
            <th style="padding:4px 6px;font-size:9px;">Cobertura</th>
            <th style="padding:4px 6px;font-size:9px;">Margen</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p style="font-size:8px;color:#94a3b8;margin-top:6px;">Cobertura = días de stock según ventas de los últimos 30 días. Margen = (precio venta - costo) / costo.</p>
    </div>`,
    width: 620,
    confirmButtonText: 'Cerrar', confirmButtonColor: '#1d4ed8'
  });
};

// ─── ESCÁNER CÁMARA PARA INVENTARIO ──────────────────────
let _html5QrInv = null;

window.abrirEscanerInventario = async function() {
  const modal    = document.getElementById('modalEscanerInv');
  const estadoEl = document.getElementById('escanerInvEstado');

  if (!modal) {
    Swal.fire({ icon: 'error', title: 'Error interno', text: 'No se encontró el modal del escáner (modalEscanerInv).', timer: 3000, showConfirmButton: false });
    return;
  }

  if (typeof Html5Qrcode === 'undefined') {
    Swal.fire({ icon: 'error', title: 'Librería no cargada', text: 'La librería de escaneo no está disponible. Verifica tu conexión a internet y recarga la página.', confirmButtonColor: '#1d4ed8' });
    return;
  }

  modal.classList.remove('hidden');
  estadoEl.textContent = 'Iniciando cámara...';

  try {
    _html5QrInv = new Html5Qrcode('qr-reader-inv');
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || !cameras.length) throw new Error('No se detectó ninguna cámara en este dispositivo.');

    const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];

    await _html5QrInv.start(
      cam.id,
      { fps: 10, qrbox: { width: 250, height: 180 }, aspectRatio: 1.4 },
      async (decodedText) => {
        await window.cerrarEscanerInventario();

        // Buscar el producto en inventario por código de barras
        try {
          const { getDocs, query, collection, where, limit } =
            await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

          estadoEl.textContent = '🔍 Buscando producto...';
          const snap = await getDocs(query(collection(db, 'inventario'), where('codigoBarra', '==', decodedText), limit(1)));

          if (!snap.empty) {
            // Producto encontrado — cargarlo en el formulario
            await window.seleccionarProductoInventario(snap.docs[0].id);
            Swal.fire({
              icon: 'success',
              title: '✅ Producto encontrado',
              text: snap.docs[0].data().nombre,
              timer: 1800,
              showConfirmButton: false
            });
          } else {
            // No existe — poner el código en el campo para un producto nuevo
            const input = document.getElementById('invCodigoBarra');
            if (input) { input.value = decodedText; input.focus(); }
            Swal.fire({
              icon: 'info',
              title: 'Código escaneado',
              text: `Código: ${decodedText}\n\nNo se encontró en inventario. Completa el formulario para agregar el producto.`,
              confirmButtonColor: '#1d4ed8',
              confirmButtonText: 'OK'
            });
          }
        } catch(err) {
          // Fallback: solo poner el código
          const input = document.getElementById('invCodigoBarra');
          if (input) { input.value = decodedText; input.focus(); }
        }
      },
      () => {}
    );
    estadoEl.textContent = 'Apunta la cámara al código de barras del producto';
  } catch(e) {
    modal.classList.add('hidden');
    Swal.fire({
      icon: 'warning',
      title: 'No se pudo abrir la cámara',
      text: e.message || 'Verifica que diste permiso de cámara al navegador y que no esté siendo usada por otra app.',
      confirmButtonColor: '#1d4ed8'
    });
  }
};

// Variable para el listener QR remoto de inventario
let _unsubEscaneoRemotoInv = null;
let _invScanPendiente = null; // resultado guardado para procesar en .then()

window.abrirEscanerRemotoInventario = async function() {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sesRef    = doc(db, 'scanner_sessions', sessionId);
  const url       = `${location.origin}/scanner.html?s=${sessionId}`;

  try {
    await setDoc(sesRef, { activa: true, scans: [], ts: serverTimestamp() });
  } catch(e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo crear la sesión: ' + e.message });
    return;
  }

  _invScanPendiente = null;
  const yaVistos = new Set();
  let procesando = false;

  _unsubEscaneoRemotoInv = onSnapshot(sesRef, async (snap) => {
    if (!snap.exists() || procesando) return;
    const scans = snap.data().scans || [];
    for (const s of scans) {
      const key = s.codigo + '_' + (s.n || 0);
      if (yaVistos.has(key)) continue;
      yaVistos.add(key);
      procesando = true;

      // Mostrar estado en el modal mientras busca
      const statusEl = document.getElementById('qrInvEstado');
      if (statusEl) {
        statusEl.textContent = '🔍 Buscando: ' + s.codigo + '...';
        statusEl.style.color = '#1d4ed8';
        statusEl.style.fontWeight = 'bold';
        statusEl.style.fontStyle = 'normal';
      }

      // Cancelar la sesión en Firestore
      if (_unsubEscaneoRemotoInv) { _unsubEscaneoRemotoInv(); _unsubEscaneoRemotoInv = null; }
      try { await updateDoc(sesRef, { activa: false }); } catch(_) {}

      // Buscar en inventario
      let resultado = { codigo: s.codigo, encontrado: false, id: null, nombre: null };
      try {
        const snap2 = await getDocs(query(collection(db, 'inventario'), where('codigoBarra', '==', s.codigo)));
        if (!snap2.empty) {
          resultado.encontrado = true;
          resultado.id = snap2.docs[0].id;
          resultado.nombre = snap2.docs[0].data().nombre;
          if (statusEl) statusEl.textContent = '✅ Encontrado: ' + resultado.nombre;
        } else {
          if (statusEl) statusEl.textContent = '📦 Producto nuevo — abriendo formulario...';
        }
      } catch(err) {
        if (statusEl) statusEl.textContent = '⚠️ Error al buscar. Código: ' + s.codigo;
      }

      // Guardar resultado y cerrar el modal después de mostrar el estado
      _invScanPendiente = resultado;
      setTimeout(() => Swal.clickConfirm(), 1200);
      break;
    }
  });

  await Swal.fire({
    title: '📱 Escanear con Teléfono',
    html: `<p style="font-size:11px;color:#64748b;margin-bottom:10px;">
             Escanea este QR con tu teléfono para abrir el escáner.<br>
             El resultado aparecerá aquí automáticamente.
           </p>
           <div id="qrInvDiv" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
           <p id="qrInvEstado" style="font-size:12px;color:#475569;font-style:italic;">
             Esperando escaneo del teléfono...
           </p>`,
    confirmButtonText: '✕ Cancelar',
    confirmButtonColor: '#ef4444',
    allowOutsideClick: false,
    didOpen: () => {
      if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrInvDiv'), {
          text: url, width: 200, height: 200,
          colorDark: '#1e293b', colorLight: '#ffffff'
        });
      } else {
        const p = document.createElement('p');
        p.style = 'font-size:9px;color:#64748b;word-break:break-all;padding:8px;background:#f1f5f9;border-radius:8px;';
        p.textContent = url;
        document.getElementById('qrInvDiv').appendChild(p);
      }
    }
  });

  // Limpiar listener si el usuario canceló manualmente
  if (_unsubEscaneoRemotoInv) { _unsubEscaneoRemotoInv(); _unsubEscaneoRemotoInv = null; }
  try { await updateDoc(sesRef, { activa: false }); } catch(_) {}

  // Procesar el resultado del escaneo (si hubo uno)
  const res = _invScanPendiente;
  _invScanPendiente = null;
  if (!res) return;

  if (res.encontrado) {
    await window.seleccionarProductoInventario(res.id);
    Swal.fire({ icon: 'success', title: '✅ ' + res.nombre, text: 'Producto cargado en el formulario.', timer: 2000, showConfirmButton: false });
  } else {
    const input = document.getElementById('invCodigoBarra');
    if (input) { input.value = res.codigo; input.dispatchEvent(new Event('input')); input.focus(); }
    Swal.fire({
      icon: 'info',
      title: '📦 Producto nuevo',
      html: `<p style="font-size:13px;">Código: <strong>${res.codigo}</strong></p>
             <p style="font-size:11px;color:#64748b;margin-top:6px;">No existe en inventario.<br>Completa el formulario para agregarlo.</p>`,
      confirmButtonColor: '#1d4ed8',
      confirmButtonText: 'Aceptar'
    });
  }
};

window.cerrarEscanerInventario = async function() {
  const modal = document.getElementById('modalEscanerInv');
  if (modal) modal.classList.add('hidden');
  if (_html5QrInv) {
    try { await _html5QrInv.stop(); } catch(_) {}
    try { _html5QrInv.clear(); } catch(_) {}
    _html5QrInv = null;
  }
};

// =========================================================
// LIBRO MENSUAL DE INVENTARIO
// =========================================================
window.abrirLibroMensualInventario = async function() {
  // Generar lista de los últimos 6 meses para selector
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('es-VE',{month:'long',year:'numeric'}) });
  }

  const { value: mesElegido } = await Swal.fire({
    title: '📋 Libro Mensual de Inventario',
    html: `<label style="font-size:11px;font-weight:700;display:block;margin-bottom:6px;">Selecciona el mes:</label>
      <select id="selMesLibro" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:11px;font-weight:700;">
        ${meses.map(m=>`<option value="${m.value}">${m.label}</option>`).join('')}
      </select>`,
    confirmButtonText: 'Ver Libro',
    confirmButtonColor: '#1d4ed8',
    showCancelButton: true,
    preConfirm: () => document.getElementById('selMesLibro').value
  });
  if (!mesElegido) return;

  Swal.fire({ title:'⏳ Generando libro...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });

  try {
    const [snapInv, snapMov] = await Promise.all([
      getDocs(query(collection(db,'inventario'), orderBy('nombre'))),
      getDocs(query(collection(db,'movimientos_inventario')))
    ]);

    const productos = {};
    snapInv.forEach(d => { productos[d.id] = { id:d.id, ...d.data() }; });

    // Filtrar movimientos del mes
    const movMes = [];
    snapMov.forEach(d => {
      const m = d.data();
      const fecha = (m.fecha || '').substring(0,7);
      if (fecha === mesElegido) movMes.push(m);
    });

    // Agrupar movimientos por producto
    const resumen = {};
    movMes.forEach(m => {
      const pid = m.productoId || m.nombre || '?';
      if (!resumen[pid]) resumen[pid] = { nombre: m.nombre||pid, entradas:0, salidas:0, ajustes:0, costo:0 };
      const cant = parseInt(m.cantidad || 0);
      if (m.tipo === 'ENTRADA' || m.tipo === 'ENTRADA-COMPRA') resumen[pid].entradas += cant;
      else if (m.tipo === 'SALIDA-FACTURA' || m.tipo === 'SALIDA') resumen[pid].salidas += cant;
      else if (m.tipo === 'AJUSTE-CONTEO') resumen[pid].ajustes += parseInt(m.diferencia || m.cantidad || 0);
    });

    const filas = Object.values(resumen).map(r =>
      `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:4px 8px;font-size:9px;font-weight:bold;">${r.nombre}</td>
        <td style="padding:4px 8px;font-size:9px;text-align:center;color:#16a34a;font-weight:900;">${r.entradas}</td>
        <td style="padding:4px 8px;font-size:9px;text-align:center;color:#dc2626;font-weight:900;">${r.salidas}</td>
        <td style="padding:4px 8px;font-size:9px;text-align:center;color:#d97706;">${r.ajustes !== 0 ? (r.ajustes>0?'+':'')+r.ajustes : '—'}</td>
        <td style="padding:4px 8px;font-size:9px;text-align:center;font-weight:900;">${r.entradas-r.salidas}</td>
      </tr>`
    ).join('') || '<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;font-size:10px;">Sin movimientos este mes</td></tr>';

    const mesLabel = meses.find(m=>m.value===mesElegido)?.label || mesElegido;
    const totalEntradas = Object.values(resumen).reduce((s,r)=>s+r.entradas,0);
    const totalSalidas  = Object.values(resumen).reduce((s,r)=>s+r.salidas,0);

    Swal.fire({
      title: `📋 Libro: ${mesLabel}`,
      html: `<div style="text-align:left;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          <div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:8px;color:#64748b;font-weight:bold;">ENTRADAS</div>
            <div style="font-size:18px;font-weight:900;color:#16a34a;">${totalEntradas}</div>
          </div>
          <div style="background:#fef2f2;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:8px;color:#64748b;font-weight:bold;">SALIDAS</div>
            <div style="font-size:18px;font-weight:900;color:#dc2626;">${totalSalidas}</div>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:8px;text-align:center;">
            <div style="font-size:8px;color:#64748b;font-weight:bold;">MOVIMIENTOS</div>
            <div style="font-size:18px;font-weight:900;color:#1d4ed8;">${movMes.length}</div>
          </div>
        </div>
        <div style="max-height:380px;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#1e293b;color:#fff;position:sticky;top:0;">
              <th style="padding:4px 8px;font-size:9px;text-align:left;">Producto</th>
              <th style="padding:4px 8px;font-size:9px;">Entradas</th>
              <th style="padding:4px 8px;font-size:9px;">Salidas</th>
              <th style="padding:4px 8px;font-size:9px;">Ajuste</th>
              <th style="padding:4px 8px;font-size:9px;">Neto</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`,
      width: 560,
      confirmButtonText: 'Cerrar', confirmButtonColor: '#1d4ed8'
    });
  } catch(e) {
    Swal.fire({ icon:'error', title:'Error', text: e.message });
  }
};
