// =========================================================
// AVIPET — peluqueria.js  v3
// NUEVO: tarjeta fidelidad VIP rediseñada (diseño premium)
//        historial últimos 7 días desde bitácora sin ir a cierre
//        impresión rápida de recibo desde bitácora
// =========================================================

import { db } from './firebase-config.js';
import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc,
  deleteDoc, getDocs, query, where, orderBy, serverTimestamp,
  arrayUnion, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MASTER_KEY = () => window.MASTER_KEY_SISTEMA || "AVIPET2026";

// ─── GESTIÓN DE MASCOTAS EN FORMULARIO ───────────────────
window.agregarMascotaPelu = () => {
  const lista = document.getElementById('listaMascotasPelu');
  if (!lista) return;

  const filas = lista.querySelectorAll('.mascota-pelu-row');
  if (filas.length >= 10) { alert('Máximo 10 mascotas por registro.'); return; }

  const row = document.createElement('div');
  row.className = "mascota-pelu-row flex gap-2 items-center";
  row.innerHTML = `
    <div class="flex-1">
      <input type="text" placeholder="Nombre mascota"
             oninput="window.recalcularTotalPelu()"
             class="pelu-nombre w-full border-b border-slate-300 p-1 text-xs font-black text-blue-600 uppercase outline-none focus:border-blue-500 bg-transparent">
    </div>
    <div class="w-20">
      <input type="text" placeholder="Raza"
             class="pelu-raza w-full border-b border-slate-300 p-1 text-[10px] font-bold uppercase outline-none bg-transparent">
    </div>
    <div class="w-16">
      <input type="number" placeholder="$0" step="0.50" min="0"
             class="pelu-precio w-full border-b border-slate-300 p-1 text-[10px] font-black text-emerald-700 outline-none bg-transparent text-right"
             oninput="window.recalcularTotalPelu()"
             title="Precio individual">
    </div>
    <button type="button" onclick="this.parentElement.remove();window.recalcularTotalPelu()"
            class="text-red-400 font-black text-lg hover:text-red-600 flex-shrink-0">×</button>`;
  lista.appendChild(row);
};

// Leer todas las mascotas del formulario
function _leerMascotasPelu() {
  const filas = document.querySelectorAll('.mascota-pelu-row');
  const mascotas = [];
  filas.forEach(row => {
    const nombre  = row.querySelector('.pelu-nombre')?.value.trim().toUpperCase();
    const raza    = row.querySelector('.pelu-raza')?.value.trim()   || '';
    const precioI = parseFloat(row.querySelector('.pelu-precio')?.value) || null;
    if (nombre) mascotas.push({ nombre, raza, precioIndividual: precioI });
  });
  return mascotas;
}

// ─── 1. GUARDAR SERVICIO ───
window.guardarPeluqueriaPro = async () => {
  const val=(id)=>document.getElementById(id)?.value.trim()||"";
  const cedula=val('pCedula'),duenio=val('pDuenio'),telefono=val('pTelefono'),direccion=val('pDireccion'),condicion=val('pCondicion');
  const base=parseFloat(document.getElementById('pTamano')?.value)||0,ajuste=parseFloat(val('pAjuste'))||0;
  const tipoServ=document.getElementById('pTipoServicio')?.value||"completo";
  let precioUnas=parseFloat(document.getElementById('pPrecioUnas')?.value);if(isNaN(precioUnas)||precioUnas<0)precioUnas=0;

  // ── Leer TODAS las mascotas del formulario ──
  const mascotas = _leerMascotasPelu();
  if (!cedula) { Swal.fire("⚠️ ATENCIÓN","La cédula es obligatoria.","warning"); return; }
  if (mascotas.length === 0) { Swal.fire("⚠️ ATENCIÓN","Agrega al menos una mascota.","warning"); return; }

  let precioFinal=tipoServ==='solo_unas'?precioUnas:(base+ajuste);
  const tieneAyu1=document.getElementById('pAyudante1')?.checked,tieneAyuExt=document.getElementById('pAyudanteExtra')?.checked,extraSolo=document.getElementById('pExtraSolo')?.checked,montoAyu1=parseFloat(document.getElementById('pMontoAyu1')?.value)||2;
  let pagoPelu=0,pagoAyu1=0,pagoAyuExt=0,ingresoAvipet=0;
  if(extraSolo){pagoAyuExt=precioFinal*0.40;ingresoAvipet=precioFinal*0.60;}
  else if(tieneAyuExt){const p=precioFinal/3;pagoPelu=p;pagoAyuExt=p;ingresoAvipet=p;}
  else{pagoPelu=precioFinal*0.40;ingresoAvipet=precioFinal*0.60;if(tieneAyu1){pagoPelu-=montoAyu1;pagoAyu1=montoAyu1;}}

  // PIN — calcular total real sumando precios individuales
  const totalAcumulado = mascotas.reduce((sum, pet) => {
    return sum + (pet.precioIndividual !== null ? pet.precioIndividual : precioFinal);
  }, 0);
  const detallePin = mascotas.map(p => {
    const pr = p.precioIndividual !== null ? p.precioIndividual : precioFinal;
    return p.nombre + ': $' + pr.toFixed(2);
  }).join(' | ');
  const txtPin = '🔐 FIRMA EMPLEADO' +
    (mascotas.length > 1 ? '\n' + detallePin + '\nTotal: $' + totalAcumulado.toFixed(2) : '\nTotal: $' + totalAcumulado.toFixed(2)) +
    '\nPIN de empleado o clave maestra:';
  const pin=prompt(txtPin);if(!pin)return;
  const empleadoInfo=await window.validarEmpleadoConPin(String(pin).trim());
  if(!empleadoInfo&&String(pin).trim()!==MASTER_KEY()){alert("❌ PIN incorrecto.");return;}
  const nombreEmpleado=empleadoInfo?empleadoInfo.nombre:"ADMIN_MASTER";

  try{
    const ahora=new Date();
    const fechaSimple=`${ahora.getDate()}/${ahora.getMonth()+1}/${ahora.getFullYear()}`;
    const hora=ahora.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const premios = [];

    // ── Crear un registro independiente por cada mascota ──
    // Calcular pago ayudante principal: $1 × perros_con_ayudante × 2
    const cantConAyu = tieneAyu1 ? mascotas.length : 0;
    const totalAyu1  = cantConAyu * 1 * 2; // $1 por perro × 2 = pago total ayudante
    const descPeluPorPerro = tieneAyu1 ? 1 : 0; // $1 se descuenta por perro de la peluquera

    for (const pet of mascotas) {
      const mascota = pet.nombre;
      const raza    = pet.raza;

      // Precio: usar el individual si lo tiene, si no el precio general del formulario
      const precioEsta = pet.precioIndividual !== null ? pet.precioIndividual : precioFinal;

      // Recalcular comisiones con el precio individual
      let pagoPeluEsta=0, pagoAyu1Esta=0, pagoAyuExtEsta=0, ingresoAvipetEsta=0;
      if(extraSolo){
        pagoAyuExtEsta=precioEsta*0.40; ingresoAvipetEsta=precioEsta*0.60;
      } else if(tieneAyuExt){
        const p=precioEsta/3; pagoPeluEsta=p; pagoAyuExtEsta=p; ingresoAvipetEsta=p;
      } else {
        pagoPeluEsta=precioEsta*0.40; ingresoAvipetEsta=precioEsta*0.60;
        if(tieneAyu1){
          pagoPeluEsta -= descPeluPorPerro;   // $1 por perro descontado a peluquera
          pagoAyu1Esta  = descPeluPorPerro;   // guardado por perro para sumar en semana
        }
      }

      const idFid=`${cedula}-${mascota}`.toLowerCase().replace(/\s+/g,'');
      const fidRef=doc(db,"fidelidad_peluqueria",idFid);
      const fidSnap=await getDoc(fidRef);
      let visitas=fidSnap.exists()?(fidSnap.data().contador||0):0;
      let nuevaVis=visitas+1;if(nuevaVis>10)nuevaVis=1;
      const esPremio=nuevaVis===10;
      if(esPremio) premios.push(mascota);

      await addDoc(collection(db,"servicios_estetica"),{
        cedulaCliente:cedula,duenio,paciente:mascota,raza,telefono,direccion,condicion,
        precioTotal:precioEsta,visitaNumero:nuevaVis,
        fecha:serverTimestamp(),fechaSimple,hora,tipo:"PELUQUERIA",servicio:tipoServ,
        pagoPeluquera:pagoPeluEsta,pagoAyudante1:pagoAyu1Esta,pagoAyudanteExtra:pagoAyuExtEsta,
        ingresoAvipet:esPremio?0:ingresoAvipetEsta,
        estatusPago:"pendiente",empleadoRegistro:nombreEmpleado,
        montoPagadoUSD:0,montoPagadoBS:0,modoPago:''
      });

      await setDoc(fidRef,{
        contador:nuevaVis,ultimaVisita:serverTimestamp(),ultimaFechaSimple:fechaSimple,
        paciente:mascota,propietario:duenio,cedula,telefono,
        historialVisitas:arrayUnion({visita:nuevaVis,fecha:fechaSimple,creadoEn:new Date()})
      },{merge:true});
    }

    // Mensaje de confirmación
    if (premios.length > 0) {
      await Swal.fire({icon:'success',title:'🎉 ¡VISITA #10 GRATIS!',
        text:`¡${premios.join(', ')} llegó a la visita #10!`,timer:3000,showConfirmButton:false});
    } else {
      const detalles = mascotas.map(p => {
        const pr = p.precioIndividual !== null ? p.precioIndividual : precioFinal;
        return `${p.nombre}: $${pr.toFixed(2)}`;
      }).join(' · ');
      const txt = mascotas.length > 1
        ? `${detalles} = $${totalAcumulado.toFixed(2)} total`
        : `${mascotas[0].nombre}: $${totalAcumulado.toFixed(2)}`;
      await Swal.fire({icon:'info',title:'✅ REGISTRO EXITOSO',text:txt,timer:2000,showConfirmButton:false});
    }

    await window.cargarBitacoraHoy();
    _limpiarPelu();
  }catch(e){console.error(e);alert("❌ ERROR: "+e.message);}
};

function _limpiarPelu(){
  ['pCedula','pDuenio','pNombre','pRaza','pAjuste','pCondicion','pTelefono','pDireccion']
    .forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  ['pTotalCobro','pResPeluquera','pResAyudante1','pResAyudanteExtra']
    .forEach(id=>{const el=document.getElementById(id);if(el)el.innerText="$ 0.00";});
  const a1=document.getElementById('pAyudante1');
  if(a1){a1.checked=true;a1.disabled=false;}
  ['pAyudanteExtra','pExtraSolo'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});

  // Limpiar lista de mascotas — dejar solo la primera fila vacía
  const lista=document.getElementById('listaMascotasPelu');
  if(lista){
    lista.innerHTML=`
      <div class="mascota-pelu-row flex gap-2 items-center">
        <div class="flex-1">
          <input type="text" placeholder="Nombre mascota"
                 class="pelu-nombre w-full border-b border-slate-300 p-1 text-xs font-black text-blue-600 uppercase outline-none focus:border-blue-500 bg-transparent">
        </div>
        <div class="w-20">
          <input type="text" placeholder="Raza"
                 class="pelu-raza w-full border-b border-slate-300 p-1 text-[10px] font-bold uppercase outline-none bg-transparent">
        </div>
        <div class="w-16">
          <input type="number" placeholder="$0" step="0.50" min="0"
                 class="pelu-precio w-full border-b border-slate-300 p-1 text-[10px] font-black text-emerald-700 outline-none bg-transparent text-right"
                 oninput="window.recalcularTotalPelu()"
                 title="Precio individual">
        </div>
      </div>`;
  }
}

// ─── BUSCAR BITÁCORA POR FECHA ───────────────────────────
window.buscarBitacoraFecha = async () => {
  const inputFecha = document.getElementById('fechaBitacora');
  if (!inputFecha?.value) {
    Swal.fire({ icon:'warning', title:'Selecciona una fecha', timer:1500, showConfirmButton:false });
    return;
  }
  // Convertir de YYYY-MM-DD a D/M/YYYY
  const [yr, mo, dy] = inputFecha.value.split('-');
  const fechaSimple = parseInt(dy) + '/' + parseInt(mo) + '/' + yr;
  await _cargarBitacoraFecha(fechaSimple);
};

window.cargarBitacoraHoy = async () => {
  const hoy = new Date();
  const fechaSimple = hoy.getDate() + '/' + (hoy.getMonth()+1) + '/' + hoy.getFullYear();
  await _cargarBitacoraFecha(fechaSimple);
};

// ─── 2. BITÁCORA DEL DÍA ───
async function _cargarBitacoraFecha(fechaSimple) {
  const cuerpo=document.getElementById('bitacoraPeluqueriaHoy');if(!cuerpo)return;
  cuerpo.innerHTML=`<div class="col-span-full py-12 text-center border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/30"><p class="text-blue-500 text-[10px] font-black uppercase animate-pulse italic">⚙️ Cargando ${fechaSimple}...</p></div>`;
  try{
    const hoyS = fechaSimple;
    const snap=await getDocs(query(collection(db,"servicios_estetica"),where("fechaSimple","==",hoyS)));
    if(snap.empty){cuerpo.innerHTML=`<div class="col-span-full py-12 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white"><p class="text-slate-400 text-[9px] font-black uppercase italic tracking-widest">Sin servicios para esta fecha</p></div>`;return;}
    const registros=[];snap.forEach(d=>registros.push({id:d.id,...d.data()}));registros.sort((a,b)=>(a.fecha?.seconds||0)-(b.fecha?.seconds||0));cuerpo.innerHTML="";
    registros.forEach((d,i)=>{
      const estatus=d.estatusPago||'pendiente';const pagado=estatus==='pagado';
      const tlf=d.telefono||"Sin teléfono";const dir=d.direccion||"Sin dirección";
      let resumenPago="";if(pagado){
  const usd=parseFloat(d.montoPagadoUSD||0),bs=parseFloat(d.montoPagadoBS||0);
  const modo=d.modoPago||'';
  if(modo==='bs')
    resumenPago=`<span class="text-amber-700 font-black">🟡 $${bs.toFixed(2)} en Bs</span>`;
  else if(modo==='mixto')
    resumenPago=`<span class="text-slate-700 font-black">🔀 $${usd.toFixed(2)} USD + $${bs.toFixed(2)} Bs</span>`;
  else
    resumenPago=`<span class="text-emerald-700 font-black">💵 $${usd.toFixed(2)} USD</span>`;
}
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
            <button type="button" onclick="window.enviarMensajePelu('${(d.telefono||'').replace(/'/g,'')}','${(d.paciente||'').replace(/'/g,'')}','${(d.duenio||'').replace(/'/g,'')}')" class="text-[8px] px-2 py-1 rounded-lg font-black uppercase bg-green-100 text-green-700 hover:bg-green-600 hover:text-white transition-all">📲 Mensaje</button>
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
window.togglePagoPeluqueria = async (idServicio, estatusActual) => {
  const estabaPagado = estatusActual === 'pagado';

  if (!estabaPagado) {
    const snap = await getDoc(doc(db, "servicios_estetica", idServicio));
    if (!snap.exists()) return;
    const precioTotal = parseFloat(snap.data().precioTotal || 0);

    // ── PASO 1: Elegir modalidad de pago ──
    const modalidad = await Swal.fire({
      title: '💰 ¿Cómo pagó el cliente?',
      html: `
        <p class="text-[11px] text-slate-500 mb-4">Total a cobrar: <b class="text-slate-800 text-base">$${precioTotal.toFixed(2)}</b></p>
        <div class="flex flex-col gap-3">
          <button type="button" id="btnPagoUSD"
                  onclick="window._selPago('usd')"
                  class="w-full py-4 rounded-2xl border-2 border-blue-200 bg-blue-50 font-black text-sm text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
            💵 Todo en Dólares (USD)
          </button>
          <button type="button" id="btnPagoBS"
                  onclick="window._selPago('bs')"
                  class="w-full py-4 rounded-2xl border-2 border-amber-200 bg-amber-50 font-black text-sm text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all">
            🟡 Todo en Bolívares (Bs)
          </button>
          <button type="button" id="btnPagoMixto"
                  onclick="window._selPago('mixto')"
                  class="w-full py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 font-black text-sm text-slate-600 hover:bg-slate-600 hover:text-white hover:border-slate-600 transition-all">
            🔀 Pago Mixto (USD + Bs)
          </button>
        </div>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        window._selPago = (modo) => {
          window._modoPago = modo;
          Swal.clickConfirm();
        };
        // Hack para que el botón cancelar funcione sin confirmButton
        document.querySelector('.swal2-cancel').onclick = () => Swal.close();
      }
    });

    if (!modalidad.isConfirmed && !window._modoPago) return;
    const modo = window._modoPago;
    window._modoPago = null;
    if (!modo) return;

    // ── PASO 2: Ingresar monto (siempre en USD) ──
    const labelModo = modo === 'usd' ? '💵 Monto en Dólares ($)' :
                      modo === 'bs'  ? '🟡 Monto en Dólares ($ equivalente en Bs)' :
                                       '💵 Cuánto pagó en USD';
    const labelModo2 = modo === 'mixto' ? '🟡 Cuánto pagó en Bs (monto en $)' : '';

    let htmlMonto = `
      <p class="text-[10px] text-slate-400 mb-3">Total: <b class="text-slate-700">$${precioTotal.toFixed(2)}</b></p>
      <div class="space-y-3 text-left">
        <div>
          <label class="text-[9px] font-black text-slate-500 uppercase block mb-1">${labelModo}</label>
          <input type="number" id="swal_monto1" step="0.50" min="0" placeholder="0.00"
                 class="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-lg font-black text-slate-800 outline-none focus:border-blue-500">
        </div>`;

    if (modo === 'mixto') {
      htmlMonto += `
        <div>
          <label class="text-[9px] font-black text-slate-500 uppercase block mb-1">${labelModo2}</label>
          <input type="number" id="swal_monto2" step="0.50" min="0" placeholder="0.00"
                 class="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-lg font-black text-slate-800 outline-none focus:border-amber-500">
        </div>`;
    }
    htmlMonto += '</div>';

    const titulos = { usd: '💵 Pago en Dólares', bs: '🟡 Pago en Bolívares', mixto: '🔀 Pago Mixto' };

    const resMonto = await Swal.fire({
      title: titulos[modo],
      html: htmlMonto,
      showCancelButton: true,
      confirmButtonText: '✅ Confirmar Pago',
      cancelButtonText: '← Atrás',
      confirmButtonColor: '#16a34a',
      preConfirm: () => {
        const m1 = parseFloat(document.getElementById('swal_monto1')?.value) || 0;
        const m2 = modo === 'mixto' ? parseFloat(document.getElementById('swal_monto2')?.value) || 0 : 0;
        if (m1 <= 0 && m2 <= 0) { Swal.showValidationMessage('⚠️ Ingresa al menos un monto.'); return false; }
        return { m1, m2 };
      }
    });

    if (!resMonto.isConfirmed) return;
    const { m1, m2 } = resMonto.value;

    // Guardar según modalidad:
    // montoPagadoUSD = monto pagado en dólares físicos
    // montoPagadoBS  = monto (en $) pagado en bolívares
    // modoPago       = 'usd' | 'bs' | 'mixto'
    let guardar = { modoPago: modo };
    let txtConfirm = '';

    if (modo === 'usd') {
      guardar.montoPagadoUSD = m1;
      guardar.montoPagadoBS  = 0;
      txtConfirm = `$${m1.toFixed(2)} en Dólares`;
    } else if (modo === 'bs') {
      guardar.montoPagadoUSD = 0;
      guardar.montoPagadoBS  = m1;   // guardamos el equivalente en $ que se pagó en Bs
      txtConfirm = `$${m1.toFixed(2)} en Bolívares`;
    } else {
      guardar.montoPagadoUSD = m1;
      guardar.montoPagadoBS  = m2;
      txtConfirm = `$${m1.toFixed(2)} USD + $${m2.toFixed(2)} en Bs`;
    }

    try {
      await updateDoc(doc(db, "servicios_estetica", idServicio), {
        estatusPago: 'pagado',
        ...guardar,
        actualizadoEn: serverTimestamp()
      });
      await window.cargarBitacoraHoy();
      await Swal.fire({ icon: 'success', title: '✅ Pago registrado', text: txtConfirm, timer: 2000, showConfirmButton: false });
    } catch (e) { console.error(e); alert("❌ Error: " + e.message); }

  } else {
    // Revertir
    const res = await Swal.fire({
      title: '↩ Revertir Pago', text: '¿Marcar como PENDIENTE?',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí', cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    try {
      await updateDoc(doc(db, "servicios_estetica", idServicio), {
        estatusPago: 'pendiente', montoPagadoUSD: 0, montoPagadoBS: 0,
        modoPago: '', actualizadoEn: serverTimestamp()
      });
      await window.cargarBitacoraHoy();
      await Swal.fire({ icon: 'info', title: 'Marcado como pendiente', timer: 1400, showConfirmButton: false });
    } catch (e) { console.error(e); alert("❌ Error: " + e.message); }
  }
};

// ─── 5. ENVIAR MENSAJE WHATSAPP DESDE BITÁCORA ───
window.enviarMensajePelu = async (telefonoRaw, mascota, duenio) => {
  if (!telefonoRaw || telefonoRaw.length < 7) {
    Swal.fire({ icon:'warning', title:'Sin teléfono', text:'Este registro no tiene número registrado.', timer:2000, showConfirmButton:false });
    return;
  }

  // Limpiar y formatear teléfono
  let tlf = telefonoRaw.replace(/\D/g,'');
  if (tlf.startsWith('0')) tlf = '58' + tlf.substring(1);
  if (!tlf.startsWith('58') && tlf.length === 10) tlf = '58' + tlf;

  // Elegir tipo de mensaje
  const res = await Swal.fire({
    title: '📲 Enviar Mensaje',
    html: `
      <p class="text-[11px] text-slate-500 mb-4">Para: <b>${duenio}</b> · ${mascota}</p>
      <div class="flex flex-col gap-2">
        <button type="button" onclick="window._tipoMsgPelu=1;Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-green-200 bg-green-50 font-black text-[11px] text-green-700 hover:bg-green-600 hover:text-white transition-all">
          🐾 Recordatorio de próxima visita
        </button>
        <button type="button" onclick="window._tipoMsgPelu=2;Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-blue-200 bg-blue-50 font-black text-[11px] text-blue-700 hover:bg-blue-600 hover:text-white transition-all">
          ✅ Confirmación de servicio realizado
        </button>
        <button type="button" onclick="window._tipoMsgPelu=3;Swal.clickConfirm()"
                class="w-full py-3 rounded-xl border-2 border-purple-200 bg-purple-50 font-black text-[11px] text-purple-700 hover:bg-purple-600 hover:text-white transition-all">
          ✏️ Mensaje personalizado
        </button>
      </div>`,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: 'Cancelar'
  });

  if (res.isDismissed) return;
  const tipo = window._tipoMsgPelu || 1;
  window._tipoMsgPelu = null;

  let mensaje = '';

  if (tipo === 1) {
    // Recordatorio próxima visita
    mensaje = `🐾 Hola ${duenio}, te recordamos que *${mascota}* ya está lista para su próxima visita de estética en *AVIPET*.

✂️ ¡Escríbenos para agendar tu cita!

📍 Av. Fco. de Miranda, Sector Buena Vista, Petare.`;

  } else if (tipo === 2) {
    // Confirmación de servicio
    mensaje = `🐾 Hola ${duenio}, te confirmamos que el servicio de estética de *${mascota}* fue completado exitosamente en *AVIPET*.

¡Gracias por confiar en nosotros! 🙏
Esperamos verte pronto. ✂️`;

  } else {
    // Mensaje personalizado
    const custom = await Swal.fire({
      title: '✏️ Escribe tu mensaje',
      input: 'textarea',
      inputPlaceholder: 'Escribe aquí el mensaje para el cliente...',
      inputAttributes: { rows: 4 },
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a'
    });
    if (!custom.isConfirmed || !custom.value) return;
    mensaje = custom.value;
  }

  window.open('https://wa.me/' + tlf + '?text=' + encodeURIComponent(mensaje), '_blank');
};

// ─── 5. IMPRIMIR RECIBO DESDE BITÁCORA ───
window.imprimirReciboPelu = async (idServicio) => {
  try{
    const snap=await getDoc(doc(db,"servicios_estetica",idServicio));if(!snap.exists())return;
    const d=snap.data();
    const usd=parseFloat(d.montoPagadoUSD||0),bs=parseFloat(d.montoPagadoBS||0);
    const modo=d.modoPago||'';
    let pagoStr='PENDIENTE';
    if(d.estatusPago==='pagado'){
      if(modo==='bs') pagoStr=`🟡 $${bs.toFixed(2)} en Bolívares`;
      else if(modo==='mixto') pagoStr=`🔀 $${usd.toFixed(2)} USD + $${bs.toFixed(2)} en Bs`;
      else pagoStr=`💵 $${usd.toFixed(2)} Dólares`;
    }
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
window.recalcularTotalPelu = () => {
  const tipo   = document.getElementById('pTipoServicio')?.value || 'completo';
  const base   = parseFloat(document.getElementById('pTamano')?.value)  || 0;
  const ajuste = parseFloat(document.getElementById('pAjuste')?.value)  || 0;
  const exSolo = document.getElementById('pExtraSolo')?.checked;
  const ayu1Act= document.getElementById('pAyudante1')?.checked;
  const ayuExt = document.getElementById('pAyudanteExtra')?.checked;
  const mAyu1  = parseFloat(document.getElementById('pMontoAyu1')?.value) || 0;
  let unas = parseFloat(document.getElementById('pPrecioUnas')?.value);
  if (isNaN(unas) || unas < 0) unas = 0;

  // Precio base del formulario (para mascotas sin precio individual)
  const precioBase = tipo === 'solo_unas' ? unas : (base + ajuste);

  // Sumar precio de CADA mascota (individual si tiene, si no el base)
  const filas = document.querySelectorAll('.mascota-pelu-row');
  let totalCobro = 0;
  let totalPelu  = 0;
  let totalA1    = 0;
  let totalAex   = 0;

  const chkA1 = document.getElementById('pAyudante1');

  filas.forEach(row => {
    const nombre = row.querySelector('.pelu-nombre')?.value.trim();
    if (!nombre) return; // fila vacía, no contar

    const precioInd = parseFloat(row.querySelector('.pelu-precio')?.value) || null;
    const cobro = precioInd !== null ? precioInd : precioBase;

    let pelu = 0, a1 = 0, aex = 0;
    if (exSolo) {
      aex = cobro * 0.40;
      if (chkA1) { chkA1.checked = false; chkA1.disabled = true; }
    } else if (ayuExt) {
      if (chkA1) { chkA1.checked = false; chkA1.disabled = true; }
      pelu = cobro / 3;
      aex  = cobro / 3;
    } else {
      if (chkA1) chkA1.disabled = false;
      pelu = cobro * 0.40;
      if (ayu1Act) {
          // $1 por perro descontado a la peluquera, pago ayudante = $1×perros×2 (mostrado al final)
          pelu -= 1; a1 = 1; // por esta mascota individual
        }
    }

    totalCobro += cobro;
    totalPelu  += pelu;
    totalA1    += a1;
    totalAex   += aex;
  });

  // Si no hay ninguna mascota con nombre, usar el precio base solo
  if (totalCobro === 0) {
    totalCobro = precioBase;
    if (exSolo) {
      totalAex  = precioBase * 0.40;
    } else if (ayuExt) {
      totalPelu = precioBase / 3;
      totalAex  = precioBase / 3;
    } else {
      totalPelu = precioBase * 0.40;
      if (ayu1Act) { totalPelu -= mAyu1; totalA1 = mAyu1; }
    }
  }

  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = `$ ${v.toFixed(2)}`; };
  setT('pTotalCobro',      totalCobro);
  setT('pResPeluquera',    totalPelu);
  setT('pResAyudante1',    totalA1);
  setT('pResAyudanteExtra',totalAex);
  const suma = document.getElementById('pResAyudantes');
  if (suma) suma.innerText = `$ ${(totalA1 + totalAex).toFixed(2)}`;
};

// ─── 7. BUSCAR CLIENTE ───
window.buscarClientePeluqueria = async (cedulaInput) => {
  const valor = (cedulaInput || "").replace(/\./g,'').trim();
  if (!valor || valor.length < 5) return;
  try {
    // Buscar en consultas primero, luego en fidelidad
    const qPac = query(collection(db,"consultas"), where("cedula","==",valor), limit(1));
    const snap  = await getDocs(qPac);
    let datos   = null;
    if (!snap.empty) datos = snap.docs[0].data();
    if (!datos) {
      const fidSnap = await getDoc(doc(db,"fidelidad_peluqueria", valor.toLowerCase()));
      if (fidSnap.exists()) datos = fidSnap.data();
    }

    if (datos) {
      // Llenar campos de texto del dueño
      const llenar = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||""; };
      llenar('pDuenio',   datos.propietario || datos.duenio);
      llenar('pTelefono', datos.telefono);
      llenar('pDireccion',datos.direccion);

      // Llenar la PRIMERA fila de mascotas con el nombre y raza del paciente
      const lista      = document.getElementById('listaMascotasPelu');
      const primeraFila = lista?.querySelector('.mascota-pelu-row');
      if (primeraFila) {
        const inputNombre = primeraFila.querySelector('.pelu-nombre');
        const inputRaza   = primeraFila.querySelector('.pelu-raza');
        if (inputNombre) inputNombre.value = datos.paciente || "";
        if (inputRaza)   inputRaza.value   = datos.raza     || "";
      }

      // También actualizar campos hidden para compatibilidad
      llenar('pNombre', datos.paciente);
      llenar('pRaza',   datos.raza);
    }

    // Cargar sellos de fidelidad (usando la primera mascota encontrada)
    try {
      const pacNombre = datos?.paciente || "";
      const idFid = `${valor}-${pacNombre}`.toLowerCase().replace(/\s+/g,'');
      const fidSnap = await getDoc(doc(db,"fidelidad_peluqueria", idFid));
      const vis = fidSnap.exists() ? (fidSnap.data().contador || 0) : 0;
      if (typeof window.renderizarSellos === 'function') window.renderizarSellos(vis);
    } catch {
      if (typeof window.renderizarSellos === 'function') window.renderizarSellos(0);
    }

  } catch(e) { console.error("Error búsqueda:", e); }
};

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
