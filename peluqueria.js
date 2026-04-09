// =========================================================
// AVIPET — peluqueria.js  v3
// NUEVO: tarjeta fidelidad VIP rediseñada (diseño premium)
//        historial últimos 7 días desde bitácora sin ir a cierre
//        impresión rápida de recibo desde bitácora
// =========================================================

import { db } from '../firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc,
  deleteDoc, getDocs, query, where, orderBy, serverTimestamp,
  arrayUnion, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || "AVIPET2026";

// ─── 1. GUARDAR SERVICIO ───
window.guardarPeluqueriaPro = async () => {
  const val=(id)=>document.getElementById(id)?.value.trim()||"";
  const cedula=val('pCedula'),duenio=val('pDuenio'),mascota=val('pNombre'),raza=val('pRaza'),telefono=val('pTelefono'),direccion=val('pDireccion'),condicion=val('pCondicion');
  const base=parseFloat(document.getElementById('pTamano')?.value)||0,ajuste=parseFloat(val('pAjuste'))||0;
  const tipoServ=document.getElementById('pTipoServicio')?.value||"completo";
  let precioUnas=parseFloat(document.getElementById('pPrecioUnas')?.value);if(isNaN(precioUnas)||precioUnas<0)precioUnas=0;
  if(!cedula||!mascota){Swal.fire("⚠️ ATENCIÓN","Cédula y Mascota son obligatorios.","warning");return;}
  let precioFinal=tipoServ==='solo_unas'?precioUnas:(base+ajuste);
  const tieneAyu1=document.getElementById('pAyudante1')?.checked,tieneAyuExt=document.getElementById('pAyudanteExtra')?.checked,extraSolo=document.getElementById('pExtraSolo')?.checked,montoAyu1=parseFloat(document.getElementById('pMontoAyu1')?.value)||2;
  let pagoPelu=0,pagoAyu1=0,pagoAyuExt=0,ingresoAvipet=0;
  if(extraSolo){pagoAyuExt=precioFinal*0.40;ingresoAvipet=precioFinal*0.60;}
  else if(tieneAyuExt){const p=precioFinal/3;pagoPelu=p;pagoAyuExt=p;ingresoAvipet=p;}
  else{pagoPelu=precioFinal*0.40;ingresoAvipet=precioFinal*0.60;if(tieneAyu1){pagoPelu-=montoAyu1;pagoAyu1=montoAyu1;}}
  const pin=prompt(`🔐 FIRMA EMPLEADO\nTotal: $${precioFinal.toFixed(2)}\nPIN de empleado o clave maestra:`);if(!pin)return;
  const empleadoInfo=await window.validarEmpleadoConPin(String(pin).trim());
  if(!empleadoInfo&&String(pin).trim()!==MASTER_KEY()){alert("❌ PIN incorrecto.");return;}
  const nombreEmpleado=empleadoInfo?empleadoInfo.nombre:"ADMIN_MASTER";
  try{
    const idFid=`${cedula}-${mascota}`.toLowerCase().replace(/\s+/g,'');const fidRef=doc(db,"fidelidad_peluqueria",idFid);const fidSnap=await getDoc(fidRef);
    let visitas=fidSnap.exists()?(fidSnap.data().contador||0):0;let nuevaVis=visitas+1;if(nuevaVis>10)nuevaVis=1;const esPremio=nuevaVis===10;
    const ahora=new Date();const fechaSimple=`${ahora.getDate()}/${ahora.getMonth()+1}/${ahora.getFullYear()}`;const hora=ahora.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    await addDoc(collection(db,"servicios_estetica"),{cedulaCliente:cedula,duenio,paciente:mascota,raza,telefono,direccion,condicion,precioTotal:precioFinal,visitaNumero:nuevaVis,fecha:serverTimestamp(),fechaSimple,hora,tipo:"PELUQUERIA",servicio:tipoServ,pagoPeluquera:pagoPelu,pagoAyudante1:pagoAyu1,pagoAyudanteExtra:pagoAyuExt,ingresoAvipet:esPremio?0:ingresoAvipet,estatusPago:"pendiente",empleadoRegistro:nombreEmpleado,montoPagadoUSD:0,montoPagadoBS:0,tasaCambioPago:0});
    await setDoc(fidRef,{contador:nuevaVis,ultimaVisita:serverTimestamp(),ultimaFechaSimple:fechaSimple,paciente:mascota,propietario:duenio,cedula,telefono,historialVisitas:arrayUnion({visita:nuevaVis,fecha:fechaSimple,creadoEn:new Date()})},{merge:true});
    await Swal.fire({icon:esPremio?'success':'info',title:esPremio?'🎉 ¡VISITA #10 GRATIS!':'✅ REGISTRO EXITOSO',text:`${mascota} — Visita ${nuevaVis}/10`,timer:2000,showConfirmButton:false});
    await window.cargarBitacoraHoy();_limpiarPelu();window.showTab('historia');
  }catch(e){console.error(e);alert("❌ ERROR: "+e.message);}
};

function _limpiarPelu(){['pCedula','pDuenio','pNombre','pRaza','pAjuste','pCondicion','pTelefono','pDireccion'].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});['pTotalCobro','pResPeluquera','pResAyudante1','pResAyudanteExtra'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerText="$ 0.00";});const a1=document.getElementById('pAyudante1');if(a1){a1.checked=true;a1.disabled=false;}['pAyudanteExtra','pExtraSolo'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});}

// ─── 2. BITÁCORA DEL DÍA ───
window.cargarBitacoraHoy = async () => {
  const cuerpo=document.getElementById('bitacoraPeluqueriaHoy');if(!cuerpo)return;
  cuerpo.innerHTML=`<div class="col-span-full py-12 text-center border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/30"><p class="text-blue-500 text-[10px] font-black uppercase animate-pulse italic">⚙️ Sincronizando...</p></div>`;
  try{
    const hoy=new Date();const hoyS=`${hoy.getDate()}/${hoy.getMonth()+1}/${hoy.getFullYear()}`;
    const snap=await getDocs(query(collection(db,"servicios_estetica"),where("fechaSimple","==",hoyS)));
    if(snap.empty){cuerpo.innerHTML=`<div class="col-span-full py-12 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white"><p class="text-slate-400 text-[9px] font-black uppercase italic tracking-widest">Sin servicios registrados hoy</p></div>`;return;}
    const registros=[];snap.forEach(d=>registros.push({id:d.id,...d.data()}));registros.sort((a,b)=>(a.hora||"").localeCompare(b.hora||""));cuerpo.innerHTML="";
    registros.forEach((d,i)=>{
      const estatus=d.estatusPago||'pendiente';const pagado=estatus==='pagado';
      const tlf=d.telefono||"Sin teléfono";const dir=d.direccion||"Sin dirección";
      let resumenPago="";if(pagado){const usd=parseFloat(d.montoPagadoUSD||0),bs=parseFloat(d.montoPagadoBS||0);if(usd>0&&bs>0)resumenPago=`<span class="text-emerald-700 font-black">$${usd.toFixed(2)}+Bs${bs.toFixed(2)}</span>`;else if(bs>0)resumenPago=`<span class="text-amber-700 font-black">Bs${bs.toFixed(2)}</span>`;else resumenPago=`<span class="text-emerald-700 font-black">$${usd.toFixed(2)}</span>`;}
      const card=document.createElement('div');card.className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-blue-400 transition-all";
      card.innerHTML=`
        <div class="flex justify-between items-start mb-2"><span class="text-blue-600 font-black text-xs italic">#${i+1}</span><span class="text-[9px] font-bold text-slate-400 font-mono uppercase italic">${d.hora||'--:--'}</span></div>
        <div class="mb-2"><p class="font-black text-slate-800 uppercase text-xs leading-none tracking-tighter">${d.paciente||'---'}</p>${d.raza?`<p class="text-[9px] text-slate-400 italic">${d.raza}</p>`:''}<p class="text-[9px] text-blue-600 font-bold uppercase mt-0.5 italic">${d.servicio==='solo_unas'?'✂️ Uñas':'🛁 Baño y Corte'}</p></div>
        <div class="bg-slate-50 border border-slate-100 rounded-lg p-2 mb-2 space-y-0.5">
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">👤 Propietario</p>
          <p class="text-[10px] font-bold text-slate-700">${d.duenio||'Cliente'}</p>
          <p class="text-[9px] text-slate-500">CI: <span class="font-bold text-slate-700">${d.cedulaCliente||'---'}</span></p>
          <p class="text-[9px] text-slate-500">📞 <span class="font-bold text-slate-700">${tlf}</span></p>
          <p class="text-[9px] text-slate-500">📍 <span class="font-bold text-slate-600">${dir}</span></p>
          ${d.condicion?`<p class="text-[9px] text-amber-600 italic mt-0.5">⚠️ ${d.condicion}</p>`:''}
        </div>
        <div class="text-[8px] text-slate-400 font-black uppercase space-y-0.5 mb-2">
          <p>Empleado: <span class="text-slate-600">${d.empleadoRegistro||'N/D'}</span></p>
          <div class="flex items-center gap-1 flex-wrap">Pago: ${pagado?`<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black">✅ PAGADO</span> ${resumenPago}`:`<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[8px] font-black animate-pulse">⏳ PENDIENTE</span>`}</div>
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-slate-100">
          <p class="text-sm font-black text-slate-800 font-mono">$${parseFloat(d.precioTotal||0).toFixed(2)}</p>
          <div class="flex gap-1 flex-wrap justify-end">
            <button type="button" onclick="window.togglePagoPeluqueria('${d.id}','${estatus}')" class="text-[8px] px-2 py-1 rounded-lg font-black uppercase ${pagado?'bg-slate-200 text-slate-600':'bg-emerald-600 text-white'}">${pagado?'↩ Revertir':'💰 Pagar'}</button>
            <button type="button" onclick="window.imprimirReciboPelu('${d.id}')" class="text-[8px] px-2 py-1 rounded-lg font-black uppercase bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">🖨 Recibo</button>
            <button type="button" onclick="window.eliminarRegistroBitacora('${d.id}','${(d.paciente||'').replace(/'/g,'')}')" class="text-[8px] px-2 py-1 rounded-lg font-black uppercase bg-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-all">🗑</button>
          </div>
        </div>`;
      cuerpo.appendChild(card);
    });
  }catch(e){console.error("Error bitácora:",e);cuerpo.innerHTML=`<div class="col-span-full py-12 text-center border-2 border-red-100 rounded-2xl bg-red-50"><p class="text-red-500 text-[9px] font-black uppercase italic">❌ Error de conexión</p></div>`;}
};

// ─── 3. ELIMINAR REGISTRO ───
window.eliminarRegistroBitacora=async(idDoc,nombreMascota)=>{const clave=prompt(`🔐 Eliminar registro de: "${nombreMascota}"\nCLAVE MAESTRA:`);if(!clave)return;if(clave.trim()!==MASTER_KEY()){alert("🚫 Clave incorrecta.");return;}if(!confirm(`⚠️ Eliminar permanentemente "${nombreMascota}".\n¿Confirmas?`))return;try{await deleteDoc(doc(db,"servicios_estetica",idDoc));if(typeof window.registrarLogAuditoria==='function')await window.registrarLogAuditoria("ELIMINACIÓN PELUQUERÍA",`Eliminó ${nombreMascota}`);alert(`✅ Eliminado.`);await window.cargarBitacoraHoy();}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

// ─── 4. TOGGLE PAGO MIXTO ───
window.togglePagoPeluqueria=async(idServicio,estatusActual)=>{
  const estabaPagado=estatusActual==='pagado';
  if(!estabaPagado){
    const snap=await getDoc(doc(db,"servicios_estetica",idServicio));if(!snap.exists())return;
    const precioTotal=parseFloat(snap.data().precioTotal||0);const tasaActual=window.tasaDolarHoy||36;
    const res=await Swal.fire({title:'💰 Registrar Pago',html:`<p class="text-[11px] text-slate-500 mb-3">Total: <b class="text-slate-800">$${precioTotal.toFixed(2)}</b></p><div class="space-y-3 text-left"><div><label class="text-[10px] font-black text-slate-600 uppercase block mb-1">💵 Dólares (USD)</label><input type="number" id="swal_usd" step="0.50" min="0" placeholder="0.00" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-blue-500" oninput="window._calcularRestoPago(${precioTotal},${tasaActual})"></div><div><label class="text-[10px] font-black text-slate-600 uppercase block mb-1">🟡 Bolívares (Bs)</label><input type="number" id="swal_bs" step="1" min="0" placeholder="0.00" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-amber-500" oninput="window._calcularRestoPago(${precioTotal},${tasaActual})"></div><div><label class="text-[10px] font-black text-slate-600 uppercase block mb-1">📊 Tasa Bs/$</label><input type="number" id="swal_tasa" step="0.01" min="1" value="${tasaActual}" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-[12px] outline-none" oninput="window._calcularRestoPago(${precioTotal},null)"></div><div id="swal_resumen" class="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-600 border border-slate-200 hidden"><p id="swal_resumen_txt"></p></div></div>`,showCancelButton:true,confirmButtonText:'✅ Confirmar',cancelButtonText:'Cancelar',confirmButtonColor:'#16a34a',preConfirm:()=>{const usd=parseFloat(document.getElementById('swal_usd')?.value)||0;const bs=parseFloat(document.getElementById('swal_bs')?.value)||0;const tasa=parseFloat(document.getElementById('swal_tasa')?.value)||tasaActual;if(usd<=0&&bs<=0){Swal.showValidationMessage("⚠️ Ingresa al menos un monto.");return false;}const totalEnUSD=usd+(bs/tasa);if(totalEnUSD>precioTotal*1.5){Swal.showValidationMessage(`⚠️ Excede demasiado el total.`);return false;}return{usd,bs,tasa};}});
    if(!res.isConfirmed)return;
    const{usd,bs,tasa}=res.value;
    try{await updateDoc(doc(db,"servicios_estetica",idServicio),{estatusPago:'pagado',montoPagadoUSD:usd,montoPagadoBS:bs,tasaCambioPago:tasa,actualizadoEn:serverTimestamp()});await window.cargarBitacoraHoy();let txt=usd>0&&bs>0?`$${usd.toFixed(2)} + Bs${bs.toFixed(2)}`:bs>0?`Bs${bs.toFixed(2)}`:`$${usd.toFixed(2)} USD`;await Swal.fire({icon:'success',title:'✅ Pago registrado',text:txt,timer:2000,showConfirmButton:false});}
    catch(e){console.error(e);alert("❌ Error: "+e.message);}
  }else{const res=await Swal.fire({title:'↩ Revertir Pago',text:'¿Marcar como PENDIENTE?',icon:'warning',showCancelButton:true,confirmButtonText:'Sí',cancelButtonText:'Cancelar'});if(!res.isConfirmed)return;try{await updateDoc(doc(db,"servicios_estetica",idServicio),{estatusPago:'pendiente',montoPagadoUSD:0,montoPagadoBS:0,tasaCambioPago:0,actualizadoEn:serverTimestamp()});await window.cargarBitacoraHoy();await Swal.fire({icon:'info',title:'Marcado como pendiente',timer:1400,showConfirmButton:false});}catch(e){console.error(e);alert("❌ Error: "+e.message);}}
};

window._calcularRestoPago=(precioTotal,tasaBase)=>{const usd=parseFloat(document.getElementById('swal_usd')?.value)||0;const bs=parseFloat(document.getElementById('swal_bs')?.value)||0;const tasa=parseFloat(document.getElementById('swal_tasa')?.value)||tasaBase||36;const totalEnUSD=usd+(bs/tasa);const diff=precioTotal-totalEnUSD;const resumen=document.getElementById('swal_resumen');const txt=document.getElementById('swal_resumen_txt');if((usd>0||bs>0)&&resumen&&txt){resumen.classList.remove('hidden');if(diff>0.05)txt.innerHTML=`Falta: <b class="text-red-600">$${diff.toFixed(2)}</b>`;else if(diff<-0.05)txt.innerHTML=`Exceso: <b class="text-amber-600">$${Math.abs(diff).toFixed(2)}</b>`;else txt.innerHTML=`<b class="text-emerald-600">✅ Exacto</b>`;}else if(resumen)resumen.classList.add('hidden');};

// ─── 5. IMPRIMIR RECIBO DESDE BITÁCORA ───
window.imprimirReciboPelu = async (idServicio) => {
  try{
    const snap=await getDoc(doc(db,"servicios_estetica",idServicio));if(!snap.exists())return;
    const d=snap.data();
    const usd=parseFloat(d.montoPagadoUSD||0),bs=parseFloat(d.montoPagadoBS||0);
    let pagoStr=d.estatusPago==='pagado'?(usd>0&&bs>0?`$${usd.toFixed(2)} + Bs ${bs.toFixed(2)}`:bs>0?`Bs ${bs.toFixed(2)}`:`$${usd.toFixed(2)} USD`):'PENDIENTE';
    const win=window.open("","_blank","width=400,height=500");if(!win)return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo AVIPET</title>
      <style>@page{size:80mm auto;margin:4mm;}body{font-family:'Courier New',monospace;font-size:11px;color:#000;margin:0;padding:8px;}
      .center{text-align:center;}.bold{font-weight:bold;}.title{font-size:14px;font-weight:900;}.sep{border-top:1px dashed #000;margin:4px 0;}.big{font-size:18px;font-weight:900;}
      @media print{.no-print{display:none;}}</style></head><body>
      <div class="center"><p class="title">🐾 AVIPET</p><p style="font-size:9px;margin:0;">Centro de Estética Canina</p></div>
      <div class="sep"></div>
      <p><b>Mascota:</b> ${d.paciente||'---'}</p>
      <p><b>Dueño:</b> ${d.duenio||'---'}</p>
      <p><b>Servicio:</b> ${d.servicio==='solo_unas'?'Corte de Uñas':'Baño y Corte'}</p>
      <p><b>Fecha:</b> ${d.fechaSimple||'---'} ${d.hora||''}</p>
      <p><b>Empleado:</b> ${d.empleadoRegistro||'---'}</p>
      <div class="sep"></div>
      <div class="center"><p class="big">$${parseFloat(d.precioTotal||0).toFixed(2)}</p></div>
      <p class="center"><b>PAGO:</b> ${pagoStr}</p>
      <div class="sep"></div>
      <p class="center" style="font-size:9px;">¡Gracias por visitar AVIPET! 🐾</p>
      <div class="no-print" style="text-align:center;margin-top:10px;"><button onclick="window.print()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:900;">Imprimir</button></div>
      </body></html>`);
    win.document.close();win.onload=()=>setTimeout(()=>{win.focus();win.print();},300);
  }catch(e){console.error(e);alert("❌ Error: "+e.message);}
};

// ─── 6. RECALCULAR TOTAL ───
window.recalcularTotalPelu=()=>{const tipo=document.getElementById('pTipoServicio')?.value||'completo';const base=parseFloat(document.getElementById('pTamano')?.value)||0;const ajuste=parseFloat(document.getElementById('pAjuste')?.value)||0;const exSolo=document.getElementById('pExtraSolo')?.checked;const ayu1Act=document.getElementById('pAyudante1')?.checked;const ayuExt=document.getElementById('pAyudanteExtra')?.checked;const mAyu1=parseFloat(document.getElementById('pMontoAyu1')?.value)||0;let unas=parseFloat(document.getElementById('pPrecioUnas')?.value);if(isNaN(unas)||unas<0)unas=0;let cobro=tipo==='solo_unas'?unas:(base+ajuste);let pelu=0,a1=0,aex=0;const chkA1=document.getElementById('pAyudante1');if(exSolo){aex=cobro*0.40;if(chkA1){chkA1.checked=false;chkA1.disabled=true;}}else if(ayuExt){if(chkA1){chkA1.checked=false;chkA1.disabled=true;}pelu=cobro/3;aex=cobro/3;}else{if(chkA1)chkA1.disabled=false;pelu=cobro*0.40;if(ayu1Act){pelu-=mAyu1;a1=mAyu1;}}const setT=(id,v)=>{const el=document.getElementById(id);if(el)el.innerText=`$ ${v.toFixed(2)}`;};setT('pTotalCobro',cobro);setT('pResPeluquera',pelu);setT('pResAyudante1',a1);setT('pResAyudanteExtra',aex);const suma=document.getElementById('pResAyudantes');if(suma)suma.innerText=`$ ${(a1+aex).toFixed(2)}`;};

// ─── 7. BUSCAR CLIENTE ───
window.buscarClientePeluqueria=async(cedulaInput)=>{const valor=(cedulaInput||"").replace(/\./g,'').trim();if(!valor||valor.length<5)return;try{const qPac=query(collection(db,"consultas"),where("cedula","==",valor),limit(1));const snap=await getDocs(qPac);let datos=null;if(!snap.empty)datos=snap.docs[0].data();if(!datos){const fidSnap=await getDoc(doc(db,"fidelidad_peluqueria",valor.toLowerCase()));if(fidSnap.exists())datos=fidSnap.data();}if(datos){const llenar=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||"";};llenar('pDuenio',datos.propietario||datos.duenio);llenar('pNombre',datos.paciente);llenar('pRaza',datos.raza);llenar('pTelefono',datos.telefono);llenar('pDireccion',datos.direccion);}try{const pacNombre=document.getElementById('pNombre')?.value||'';const idFid=`${valor}-${pacNombre}`.toLowerCase().replace(/\s+/g,'');const fidSnap=await getDoc(doc(db,"fidelidad_peluqueria",idFid));const vis=fidSnap.exists()?(fidSnap.data().contador||0):0;if(typeof window.renderizarSellos==='function')window.renderizarSellos(vis);}catch{if(typeof window.renderizarSellos==='function')window.renderizarSellos(0);}}catch(e){console.error("Error búsqueda:",e);}};

// ─── 8. SELLOS DE FIDELIDAD ───
window.renderizarSellos=(numVisitas)=>{const cont=document.getElementById('contenedorSellos');const contTxt=document.getElementById('contadorVisitas');const badge=document.getElementById('badgeFidelidad');const msg=document.getElementById('proximaGratis');if(!cont||!contTxt)return;let vis=numVisitas%10;if(vis===0&&numVisitas>0)vis=10;contTxt.innerText=`${vis} / 10 VISITAS`;cont.innerHTML='';for(let i=1;i<=10;i++){const activo=i<=vis;const s=document.createElement('div');s.className="h-10 w-10 flex items-center justify-center";s.innerHTML=`<div class="relative w-full h-full flex items-center justify-center"><svg class="w-7 h-7 ${activo?'text-blue-100':'text-slate-200'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM12 11.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 13.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM17.5 13.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM12 21.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" stroke-linecap="round"/></svg><svg class="absolute w-7 h-7 fill-blue-600 transition-all duration-700 ${activo?'opacity-100 scale-110':'opacity-0 scale-0'}" viewBox="0 0 24 24"><path d="M12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM12 11.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 13.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM17.5 13.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM12 21.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg></div>`;cont.appendChild(s);}const esPremio=vis===10;if(badge)badge.classList.toggle('hidden',!esPremio);if(msg)msg.classList.toggle('hidden',!esPremio);};

// ─── 9. TARJETA FIDELIDAD VIP — REDISEÑADA ───
window.descargarTarjetaPelu = async () => {
  const mascota = document.getElementById('pNombre')?.value || "Mascota VIP";
  const cedula  = document.getElementById('pCedula')?.value || "";
  const duenio  = document.getElementById('pDuenio')?.value || "Propietario";
  const tlf     = document.getElementById('pTelefono')?.value.replace(/\D/g,'') || "";

  let visitas = 0, historial = [], ultimaFecha = "";
  try {
    if (cedula && mascota) {
      const idFid   = `${cedula}-${mascota}`.toLowerCase().replace(/\s+/g,'');
      const fidSnap = await getDoc(doc(db,"fidelidad_peluqueria",idFid));
      if (fidSnap.exists()) {
        const fd = fidSnap.data();
        visitas      = fd.contador || 0;
        ultimaFecha  = fd.ultimaFechaSimple || "";
        historial    = Array.isArray(fd.historialVisitas) ? fd.historialVisitas.slice().sort((a,b)=>(a.visita||0)-(b.visita||0)).slice(-10) : [];
      }
    }
  } catch(e){console.warn(e);}

  let vis = visitas % 10; if (vis===0&&visitas>0) vis=10;
  const esPremio = vis === 10;
  const proxima  = esPremio ? "🎁 ¡GRATIS!" : `Visita ${vis+1}/10`;

  // Construir sellos SVG
  const sellosHtml = Array.from({length:10},(_,i)=>{
    const n = i+1;
    const activo = n <= vis;
    return activo
      ? `<div style="width:36px;height:36px;background:linear-gradient(135deg,#ffd700,#ff8c00);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(255,200,0,0.7);font-size:18px;">🐾</div>`
      : `<div style="width:36px;height:36px;background:rgba(255,255,255,0.08);border-radius:50%;border:2px dashed rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.2);font-size:16px;">·</div>`;
  }).join('');

  // Historial compacto
  const histHtml = historial.length === 0
    ? `<p style="opacity:.5;font-style:italic;font-size:9px;">Primera visita en camino...</p>`
    : historial.map(v=>`<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px;opacity:.8;"><span>#${v.visita||'?'}</span><span>${v.fecha||''}</span></div>`).join('');

  // Crear contenedor DOM temporal para html2canvas
  const wrap = document.createElement('div');
  wrap.style.cssText = "position:fixed;left:-9999px;top:0;z-index:9999;";
  wrap.innerHTML = `
    <div id="tarjetaVIP" style="
      width:680px;height:380px;
      background:linear-gradient(135deg,#0a0a1a 0%,#12174a 40%,#0d1b3e 70%,#0a0a1a 100%);
      border-radius:24px;
      position:relative;overflow:hidden;
      font-family:'Segoe UI',Arial,sans-serif;
      box-shadow:0 30px 80px rgba(0,0,50,.8);
    ">
      <!-- Destellos decorativos -->
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(99,102,241,.25) 0%,transparent 70%);border-radius:50%;"></div>
      <div style="position:absolute;bottom:-40px;left:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(245,158,11,.15) 0%,transparent 70%);border-radius:50%;"></div>
      <div style="position:absolute;top:80px;left:200px;width:120px;height:120px;background:radial-gradient(circle,rgba(139,92,246,.15) 0%,transparent 70%);border-radius:50%;"></div>

      <!-- Línea dorada superior -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#ffd700,#ff8c00,#ffd700,transparent);"></div>

      <!-- Contenido principal -->
      <div style="position:relative;z-index:2;padding:28px 32px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">

        <!-- CABECERA -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:22px;">🐾</span>
              <div>
                <p style="margin:0;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:3px;color:#ffd700;">AVIPET</p>
                <p style="margin:0;font-size:8px;color:rgba(255,255,255,.5);letter-spacing:2px;text-transform:uppercase;">Centro de Estética Canina</p>
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="background:linear-gradient(135deg,#ffd700,#ff8c00);border-radius:20px;padding:4px 12px;display:inline-block;">
              <p style="margin:0;font-size:8px;font-weight:900;color:#0a0a1a;text-transform:uppercase;letter-spacing:1px;">⭐ TARJETA VIP</p>
            </div>
            ${esPremio ? `<div style="margin-top:6px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:20px;padding:4px 12px;display:inline-block;"><p style="margin:0;font-size:8px;font-weight:900;color:#fff;text-transform:uppercase;">🎁 VISITA GRATIS</p></div>` : ''}
          </div>
        </div>

        <!-- NOMBRE MASCOTA -->
        <div>
          <p style="margin:0 0 2px;font-size:8px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:2px;">Paciente</p>
          <p style="margin:0;font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;text-transform:uppercase;">${mascota}</p>
          <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,.55);">👤 ${duenio} · CI: ${cedula || '---'}</p>
        </div>

        <!-- SELLOS -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <p style="margin:0;font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1.5px;">Progreso de visitas</p>
            <p style="margin:0;font-size:10px;font-weight:900;color:#ffd700;">${vis} / 10</p>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">${sellosHtml}</div>
          <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
            <p style="margin:0;font-size:8px;color:rgba(255,255,255,.35);font-style:italic;">Última visita: ${ultimaFecha||'---'}</p>
            <p style="margin:0;font-size:9px;font-weight:900;color:${esPremio?'#ffd700':'rgba(255,255,255,.6)'};">Próxima: ${proxima}</p>
          </div>
        </div>

        <!-- PIE -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;">
          <div>
            <p style="margin:0;font-size:7px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px;">Al completar 10 visitas, la siguiente es</p>
            <p style="margin:2px 0 0;font-size:9px;font-weight:900;color:#ffd700;">🎁 COMPLETAMENTE GRATIS</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:7px;color:rgba(255,255,255,.25);font-family:'Courier New',monospace;">${cedula ? 'ID-'+cedula : '🐾 AVIPET'}</p>
          </div>
        </div>

      </div>

      <!-- Línea dorada inferior -->
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#ffd700,#ff8c00,#ffd700,transparent);"></div>
    </div>`;

  document.body.appendChild(wrap);

  Swal.fire({ title:'🎨 Generando tarjeta VIP...', allowOutsideClick:false, didOpen:()=>Swal.showLoading() });

  setTimeout(async () => {
    try {
      const canvas = await html2canvas(wrap.querySelector('#tarjetaVIP'), {
        scale: 3, useCORS: true, backgroundColor: null,
        logging: false
      });
      document.body.removeChild(wrap);
      const img = canvas.toDataURL("image/png");
      const a   = document.createElement("a");
      a.href = img; a.download = `TarjetaVIP_${mascota.replace(/\s+/g,'_')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      Swal.close();

      if (tlf) {
        const r = await Swal.fire({ icon:'question', title:'¿Enviar por WhatsApp?', showCancelButton:true, confirmButtonText:'Sí', cancelButtonText:'No' });
        if (r.isConfirmed) {
          const msg = encodeURIComponent(`🐾 ¡Hola! Te enviamos la *Tarjeta VIP de Fidelidad* de *${mascota}* en AVIPET.\n\n✅ Cada visita acumula un sello.\n🎁 Al llegar a 10 visitas, ¡la siguiente es COMPLETAMENTE GRATIS!\n\n¡Gracias por confiar en nosotros! 🐾`);
          window.open(`https://wa.me/${tlf}?text=${msg}`,'_blank');
        }
      } else {
        await Swal.fire({ icon:'success', title:'🎨 Tarjeta VIP descargada', timer:2000, showConfirmButton:false });
      }
    } catch (e) {
      try { document.body.removeChild(wrap); } catch {}
      Swal.close();
      Swal.fire('Error', 'No se pudo generar la tarjeta.', 'error');
    }
  }, 700);
};

window.mostrarQRTarjeta=()=>{const cedula=document.getElementById('pCedula')?.value||"";const mascota=document.getElementById('pNombre')?.value||"CLIENTE VIP";const visitas=document.getElementById('contadorVisitas')?.innerText||"0/10";if(!cedula){Swal.fire({icon:'error',title:'FALTA CÉDULA'});return;}Swal.fire({title:`<span class="text-blue-700 font-black italic">TARJETA DIGITAL</span>`,html:`<div class="flex flex-col items-center"><div id="qr_real" class="bg-white p-3 border-4 border-blue-600 rounded-2xl shadow-lg"></div><p class="mt-4 text-sm font-black text-slate-800 uppercase">${mascota}</p><p class="text-[10px] font-bold text-blue-600">CI: ${cedula}</p></div>`,showConfirmButton:true,confirmButtonText:'LISTO',confirmButtonColor:'#1d4ed8',didOpen:()=>{new QRCode(document.getElementById("qr_real"),{text:`AVIPET_VIP\nID:${cedula}\nPET:${mascota}\nVISITS:${visitas}`,width:180,height:180,colorDark:"#1d4ed8",correctLevel:QRCode.CorrectLevel.H});}});};

// ─── 10. LIQUIDACIÓN SEMANAL ───
window.generarCierrePeluqueria=async()=>{const cont=document.getElementById('reportePeluqueriaResultados');if(!cont)return;cont.classList.remove('hidden');cont.innerHTML=`<div class="flex flex-col items-center p-10 bg-white rounded-xl border border-slate-100 mt-4"><div class="animate-spin rounded-full h-10 w-10 border-b-4 border-purple-600 mb-4"></div><p class="text-[10px] font-black uppercase text-purple-900 italic">Calculando...</p></div>`;try{const hace7=new Date();hace7.setDate(hace7.getDate()-7);const snap=await getDocs(query(collection(db,"servicios_estetica"),where("fecha",">=",hace7),orderBy("fecha","desc")));let totalRec=0,totalPelu=0,totalAyu=0,totalUSD=0,totalBS=0,cnt=0,rows='';snap.forEach(d=>{const r=d.data();const b=parseFloat(r.precioTotal)||0,p=parseFloat(r.pagoPeluquera)||0,a=(parseFloat(r.pagoAyudante1)||0)+(parseFloat(r.pagoAyudanteExtra)||0);totalRec+=b;totalPelu+=p;totalAyu+=a;cnt++;if(r.estatusPago==='pagado'){totalUSD+=parseFloat(r.montoPagadoUSD||0);totalBS+=parseFloat(r.montoPagadoBS||0);}const usd=parseFloat(r.montoPagadoUSD||0),bs=parseFloat(r.montoPagadoBS||0);const pagoStr=r.estatusPago==='pagado'?(usd>0&&bs>0?`$${usd.toFixed(0)}+Bs${bs.toFixed(0)}`:bs>0?`Bs${bs.toFixed(0)}`:`$${usd.toFixed(0)}`):'-';rows+=`<tr class="border-b border-slate-100 hover:bg-purple-50"><td class="p-3 opacity-70">${r.fechaSimple||'---'}</td><td class="p-3 uppercase"><span class="text-purple-600 block">${r.paciente||'---'}</span><span class="text-[8px] text-slate-400">${r.duenio||''}</span></td><td class="p-3 text-center font-mono">$${b.toFixed(2)}</td><td class="p-3 text-center text-blue-700 font-mono font-black">$${p.toFixed(2)}</td><td class="p-3 text-center text-emerald-600 font-mono font-black">$${a.toFixed(2)}</td><td class="p-3 text-center text-[9px] font-bold ${r.estatusPago==='pagado'?'text-emerald-600':'text-red-500'}">${pagoStr}</td></tr>`;});cont.innerHTML=`<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4"><div class="bg-slate-900 border-b-4 border-slate-600 p-4 rounded-xl"><p class="text-[8px] text-slate-400 uppercase font-black mb-1">Bruto 7d</p><p class="text-xl font-black text-white">$${totalRec.toFixed(2)}</p></div><div class="bg-blue-600 border-b-4 border-blue-800 p-4 rounded-xl"><p class="text-[8px] text-blue-100 uppercase font-black mb-1">Peluquera</p><p class="text-xl font-black text-white">$${totalPelu.toFixed(2)}</p></div><div class="bg-emerald-500 border-b-4 border-emerald-700 p-4 rounded-xl"><p class="text-[8px] text-emerald-100 uppercase font-black mb-1">Caja USD</p><p class="text-xl font-black text-white">$${totalUSD.toFixed(2)}</p></div><div class="bg-amber-500 border-b-4 border-amber-700 p-4 rounded-xl"><p class="text-[8px] text-amber-100 uppercase font-black mb-1">Caja Bs</p><p class="text-xl font-black text-white">Bs ${totalBS.toFixed(2)}</p></div></div>${cnt===0?`<div class="mt-6 p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 font-black uppercase italic text-xs">Sin servicios en 7 días</div>`:`<div class="overflow-x-auto mt-6"><table class="w-full text-left border-collapse rounded-lg overflow-hidden shadow-sm"><thead><tr class="bg-purple-900 text-white uppercase text-[9px] font-black italic"><th class="p-3">Fecha</th><th class="p-3">Mascota</th><th class="p-3 text-center">Total</th><th class="p-3 text-center">Peluquera</th><th class="p-3 text-center">Ayudantes</th><th class="p-3 text-center">Cobrado</th></tr></thead><tbody class="text-[11px] font-bold text-slate-700 bg-white">${rows}</tbody></table></div>`}<button onclick="this.parentElement.classList.add('hidden')" class="w-full mt-4 text-[9px] font-black text-slate-400 uppercase hover:text-red-500 italic">✖ Cerrar</button>`;}catch(e){console.error(e);alert("Error: "+e.message);}};

// ─── 11. EXPORTAR EXCEL ───
window.exportarExcelPeluqueria=async()=>{try{const snap=await getDocs(collection(db,"servicios_estetica"));const datos=[];snap.forEach(d=>{const r=d.data();datos.push({Fecha:r.fechaSimple||'---',Paciente:r.paciente||'---',Dueno:r.duenio||'---',CI:r.cedulaCliente||'---',Telefono:r.telefono||'---',Direccion:r.direccion||'---',Servicio:r.servicio||'---',Total:r.precioTotal||0,Peluquera:r.pagoPeluquera||0,Ayudantes:(parseFloat(r.pagoAyudante1)||0)+(parseFloat(r.pagoAyudanteExtra)||0),PagadoUSD:r.montoPagadoUSD||0,PagadoBS:r.montoPagadoBS||0,TasaCambio:r.tasaCambioPago||0,Estatus:r.estatusPago||'---',Empleado:r.empleadoRegistro||'---'});});if(!datos.length)return alert("No hay datos.");const hoja=XLSX.utils.json_to_sheet(datos);const libro=XLSX.utils.book_new();XLSX.utils.book_append_sheet(libro,hoja,"Peluqueria");XLSX.writeFile(libro,`Peluqueria_${new Date().toISOString().split('T')[0]}.xlsx`);}catch(e){console.error(e);alert("❌ Error: "+e.message);}};

// ─── 12. VALIDAR EMPLEADO ───
window.validarEmpleadoConPin=async(pin)=>{if(!pin)return null;try{const snap=await getDocs(query(collection(db,"empleados"),where("PIN","==",String(pin).trim())));if(snap.empty)return null;const d=snap.docs[0];return{id:d.id,nombre:d.data().nombreEmpleado||d.id};}catch(e){console.error("Error validando empleado:",e);return null;}};

console.log("✅ peluqueria.js v3 — tarjeta VIP premium, recibo impresión, pago mixto");
