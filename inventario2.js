// =========================================================
// AVIPET — inventario.js v10 — fix ajustes, cambiarSubTabConfig
// =========================================================

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

window.eliminarInsumoIndividual=async(idInsumo,nombreInsumo)=>{const clave=prompt('Eliminar '+nombreInsumo+' - CLAVE MAESTRA:');if(!clave||clave.trim()!==MASTER_KEY()){alert('Clave incorrecta.');return;}if(!confirm('Eliminar '+nombreInsumo+'. Confirmas?'))return;try{await deleteDoc(doc(db,'insumos_maestro',idInsumo));alert('Eliminado.');window.renderizarTablaInsumos();}catch(e){console.error(e);alert('Error: '+e.message);}};

// INICIALIZAR BD 
window.inicializarBaseDeDatosCompleta=async()=>{const clave=prompt("CLAVE MAESTRA:");if(!clave||clave.trim()!==MASTER_KEY()){alert("Clave incorrecta.");return;}if(!confirm("Inicializar catalogo de servicios en Firebase?"))return;
const SERVICIOS_DEFAULT={"CONSULTA GENERAL":{precioVenta:30,porcDoc:40},"CONSULTA OFTALMOLOGICA":{precioVenta:80,porcDoc:12.5},"CONSULTA DE EMERGENCIA":{precioVenta:40,porcDoc:40},"ABSCESO":{precioVenta:25,porcDoc:50},"ECOGRAFIA":{precioVenta:30,porcDoc:40},"COLOCACION VIA":{precioVenta:15,porcDoc:50},"ADMINISTRACION MEDICINA":{precioVenta:10,porcDoc:50},"TOMA DE MUESTRA SANGRE":{precioVenta:10,porcDoc:50},"VACUNA SEXTUPLE":{precioVenta:40,porcDoc:50},"VACUNA PUPPY":{precioVenta:40,porcDoc:50},"VACUNA ANTIRRABICA":{precioVenta:30,porcDoc:50},"VACUNA KC (TOS DE LAS PERRERAS)":{precioVenta:45,porcDoc:50},"VACUNA TRIPLE FELINA":{precioVenta:45,porcDoc:50},"VACUNA QUINTUPLE FELINA":{precioVenta:50,porcDoc:50},"VACUNA BIOVETA":{precioVenta:60,porcDoc:50},"HEMATOLOGIA COMPLETA":{precioVenta:23,porcDoc:34.78},"QUIMICA SANGUINEA":{precioVenta:60,porcDoc:50},"DESCARTE HEMOPARASITO":{precioVenta:50,porcDoc:50},"DISTEMPER":{precioVenta:35,porcDoc:50},"PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"FILARIASIS":{precioVenta:40,porcDoc:50},"SIDA - LEUCEMIA":{precioVenta:40,porcDoc:50},"TEST HELICOBACTER PYLORI AG":{precioVenta:40,porcDoc:50},"HEMATOLOGIA + QUIMICA + HEMOPARASITOS":{precioVenta:110,porcDoc:50},"EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"CITOLOGIA 1 OIDO":{precioVenta:15,porcDoc:50},"CITOLOGIA 2 OIDOS":{precioVenta:20,porcDoc:50},"RASPADO PIEL":{precioVenta:10,porcDoc:50},"PERFIL ANEMICO":{precioVenta:25,porcDoc:17.5},"EUTANASIA HASTA 5KG":{precioVenta:80,porcDoc:50},"EUTANASIA HASTA 15KG":{precioVenta:110,porcDoc:50},"EUTANASIA HASTA 25KG":{precioVenta:140,porcDoc:50},"EUTANASIA HASTA 35KG":{precioVenta:170,porcDoc:50},"REFERIDO: EXAMEN DE HECES":{precioVenta:10,porcDoc:50},"REFERIDO: EXAMENES DE ORINA":{precioVenta:10,porcDoc:50},"REFERIDO: CULTIVOS":{precioVenta:30,porcDoc:50},"REFERIDO: DESCARTE HEMOPARASITO":{precioVenta:40,porcDoc:50},"REFERIDO: DISTEMPER":{precioVenta:35,porcDoc:50},"REFERIDO: PARVOVIRUS - CORONAVIRUS":{precioVenta:35,porcDoc:50},"CONSULTA CAMADA 3-4 CACHORROS":{precioVenta:50,porcDoc:40},"CONSULTA CAMADA HASTA 8 CACHORROS":{precioVenta:80,porcDoc:40},"CONSULTA CAMADA MAS DE 8 CACHORROS":{precioVenta:100,porcDoc:40}};
try{Swal.fire({title:'Inicializando...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});let cnt=0;for(const[nombre,datos]of Object.entries(SERVICIOS_DEFAULT)){await setDoc(doc(db,"servicios_maestro",nombre),{...datos,actualizadoEn:serverTimestamp()},{merge:true});cnt++;}Swal.close();alert(`${cnt} servicios inicializados.`);window.renderizarTablaMaestra();}catch(e){Swal.close();console.error(e);alert("Error: "+e.message);}};

// CAMBIAR SUB-TAB CONFIG 
window.cambiarSubTabConfig = (tab) => {
  ['servicios','insumos','medicamentos','seguridad','tarifa','compras'].forEach(t => {
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
};

// 
// CALCULADORA DE COSTOS DE INVENTARIO
// 

let _calcInvModo = 'bcv';
let _calcInvMoneda = 'bs';
let _calcInvAbierto = false;

window.calcInvToggle = () => {
 _calcInvAbierto = !_calcInvAbierto;
 const cuerpo = document.getElementById('calcInvCuerpo');
 const chevron = document.getElementById('calcInvChevron');
 if (cuerpo) cuerpo.classList.toggle('hidden', !_calcInvAbierto);
 if (chevron) chevron.innerText = _calcInvAbierto ? ' Cerrar' : ' Abrir';
};

window.calcInvSetModo = (modo) => {
 _calcInvModo = modo;
 const btnBCV = document.getElementById('calcInvBtnBCV');
 const btnProv = document.getElementById('calcInvBtnProv');
 const filaBS = document.getElementById('calcInvFilaBS');
 const filaUSD = document.getElementById('calcInvFilaUSD');
 const filaTasaProv = document.getElementById('calcInvFilaTasaProv');
 if (modo === 'bcv') {
 if (btnBCV) btnBCV.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all bg-blue-600 text-white';
 if (btnProv) btnProv.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all text-slate-400';
 if (filaBS) filaBS.classList.remove('hidden');
 if (filaUSD) filaUSD.classList.add('hidden');
 if (filaTasaProv) filaTasaProv.classList.add('hidden');
 window.calcInvSetMoneda(_calcInvMoneda);
 } else {
 if (btnProv) btnProv.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all bg-amber-500 text-white';
 if (btnBCV) btnBCV.className = 'flex-1 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all text-slate-400';
 if (filaBS) filaBS.classList.add('hidden');
 if (filaUSD) filaUSD.classList.remove('hidden');
 if (filaTasaProv) filaTasaProv.classList.remove('hidden');
 }
 window.calcularCostoInventario();
};

window.calcInvSetMoneda = (moneda) => {
 _calcInvMoneda = moneda;
 const btnBS = document.getElementById('calcInvBtnMonedaBS');
 const btnUSD = document.getElementById('calcInvBtnMonedaUSD');
 const label = document.getElementById('calcInvLabelPrecio');
 const input = document.getElementById('calcInvPrecioBS');
 if (moneda === 'bs') {
 if (btnBS) btnBS.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all bg-amber-500 text-white';
 if (btnUSD) btnUSD.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all text-slate-400';
 if (label) label.innerText = 'Precio del proveedor (Bs)';
 if (input) input.placeholder = 'Ej: 47595.00';
 } else {
 if (btnUSD) btnUSD.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all bg-blue-500 text-white';
 if (btnBS) btnBS.className = 'flex-1 py-1 rounded-md font-black text-[9px] uppercase transition-all text-slate-400';
 if (label) label.innerText = 'Precio del proveedor ($)';
 if (input) input.placeholder = 'Ej: 100.00';
 }
 if (input) input.value = '';
 window.calcularCostoInventario();
};

window.calcularCostoInventario = () => {
 const tasaBCV = parseFloat(document.getElementById('calcInvTasaBCV')?.value) || window.tasaDolarHoy || 36;
 const margen = parseFloat(document.getElementById('calcInvMargen')?.value) || 30;
 const resultDiv = document.getElementById('calcInvResultado');
 const margenLbl = document.getElementById('calcInvMargenLabel');
 const divisor = 1 - (margen / 100);
 if (margenLbl) margenLbl.innerText = `÷ ${divisor.toFixed(2)}`;
 let costoUSD=0, detalle='', valido=false;
 if (_calcInvModo === 'bcv') {
 const monto = parseFloat(document.getElementById('calcInvPrecioBS')?.value) || 0;
 if (monto > 0 && tasaBCV > 0) {
 if (_calcInvMoneda === 'bs') { costoUSD=monto/tasaBCV; detalle=`Bs ${monto.toLocaleString('es-VE',{minimumFractionDigits:2})} ÷ ${tasaBCV.toFixed(2)} = $${costoUSD.toFixed(4)}`; }
 else { costoUSD=monto; detalle=`$${monto.toFixed(2)} USD directo`; }
 valido=true;
 }
 } else {
 const precioUSD=parseFloat(document.getElementById('calcInvPrecioUSD')?.value)||0;
 const tasaProv=parseFloat(document.getElementById('calcInvTasaProv')?.value)||0;
 if (precioUSD>0&&tasaProv>0&&tasaBCV>0) { const bsPagados=precioUSD*tasaProv; costoUSD=bsPagados/tasaBCV; detalle=`$${precioUSD}×${tasaProv}=Bs${bsPagados.toLocaleString('es-VE',{minimumFractionDigits:2})}÷${tasaBCV.toFixed(2)}=$${costoUSD.toFixed(4)}`; valido=true; }
 }
 if (!valido) { if(resultDiv)resultDiv.classList.add('hidden'); return; }
 const aplicaIVA=document.getElementById('calcInvIVA')?.checked||false;
 const costoConIVA=aplicaIVA?costoUSD*1.16:costoUSD;
 if(aplicaIVA)detalle+=` + IVA 16% = $${costoConIVA.toFixed(4)}`;
 const precioVenta=divisor>0?costoConIVA/divisor:0;
 if(resultDiv)resultDiv.classList.remove('hidden');
 const elC=document.getElementById('calcInvCostoUSD');
 const elV=document.getElementById('calcInvPrecioVentaCalc');
 const elD=document.getElementById('calcInvDetalle');
 if(elC)elC.innerText=`$${costoConIVA.toFixed(2)}${aplicaIVA?' (c/IVA)':''}`;
 if(elV)elV.innerText=`$${precioVenta.toFixed(2)}`;
 if(elD)elD.innerText=`${detalle} ÷ ${divisor.toFixed(2)} = $${precioVenta.toFixed(2)}`;
 window._calcInvResultado={costoUSD:costoConIVA,precioVenta};
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
 Swal.fire({icon:'success',title:'Valores aplicados',text:`Costo: $${costoUSD.toFixed(2)} · Venta: $${precioVenta.toFixed(2)}`,timer:2000,showConfirmButton:false});
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
 if(snap.empty){alert("Sin registros de auditoría.");return;}
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
 Swal.fire({icon:'warning',title:'Stock Bajo',html:`<b>${p.nombre}</b><br>Stock actual: <b>${p.cantidadStock}</b> · Minimo: ${p.stockMinimo||3}`,timer:4000,timerProgressBar:true,showConfirmButton:false});
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
console.log(" inventario.js v12 — agregar insumo con selector de servicios");
