# AVIPET — Instrucciones para Claude

## REGLA OBLIGATORIA: Nueva colección de Firestore

Cada vez que se crea una nueva colección en Firestore (en cualquier archivo .js),
Claude DEBE antes de hacer deploy:

1. Abrir `firestore.rules`
2. Agregar la regla para esa colección
3. Hacer `firebase deploy --only firestore:rules` ANTES o junto con el deploy de Vercel

**Sin regla en firestore.rules = error "missing or insufficient permissions" para el usuario.**

## Colecciones actuales con reglas (no repetir)
- consultas, servicios_maestro, insumos_maestro, inventario, movimientos_inventario
- espera, servicios_estetica, pacientes_peluqueria, fidelidad_peluqueria
- transferencias_fotos, doctores, usuarios_inventario, configuracion
- auditoria_sistema, auditoria_inventario, almuerzo, control_descanso
- notas_internas, encuestas, empleados, empleados_descanso, deudas
- medicamentos_maestro, compras_insumos, cashea_registros, planificador_tareas
- facturas, correlativos, notas_credito, notas_debito, auditoria_facturacion
- compras_fiscales, retenciones, scanner_sessions
- empleados_rh, documentos_empleados, tipos_documentos_custom
- permisos_empresa

## Stack
- Frontend: HTML + Tailwind CDN (sin bundler)
- Backend: Firebase Firestore v10 ES Modules
- Deploy frontend: Vercel (`npx vercel deploy --prod`)
- Deploy reglas: `npx firebase deploy --only firestore:rules`
- Service Worker: bumpar `CACHE_V` en sw.js en cada deploy

## Orden de deploy cuando hay cambios en Firestore
1. Editar `firestore.rules`
2. `npx firebase deploy --only firestore:rules`
3. Bumpar SW (`avipet-vN`)
4. `npx vercel deploy --prod`
