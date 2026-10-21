# 📌 Estado Actual y Hoja de Ruta (Roadmap) — Turnos_ya Backend

Este documento detalla el estado actual de las funcionalidades de comunicación, autenticación y servicios en segundo plano del backend, así como los próximos pasos para la puesta en producción y evolución del sistema.

---

## 🎯 1. Funcionalidades de Comunicación y Autenticación (100% Operativas)

1. **Configuración de SMTP Real con Gmail:**
   - Envío de correos transaccionales mediante Nodemailer con App Password de Google de 16 caracteres.
   - Plantillas HTML responsivas con estilos de marca.

2. **Recuperación de Contraseña:**
   - Flujo de olvido de contraseña con generación de token temporal seguro (`/api/v1/auth/forgot-password`).
   - Envío de enlace directo al correo del usuario y reseteo en pantalla (`/api/v1/auth/reset-password`).
   - Modal de contingencia en entorno de desarrollo/QA si no hay conexión externa a internet.

3. **Verificación de Correo Electrónico Progresiva:**
   - Envío de email de bienvenida con código numérico de 6 dígitos.
   - Enlace directo de validación en 1 clic: `/verify-email?token=...`.
   - Panel interactivo en el Perfil de usuario con validación de código de 6 dígitos.
   - Banner superior informativo no bloqueante en el frontend.
   - Cuentas iniciadas mediante **Google OAuth 2.0** quedan auto-verificadas desde el primer instante.

4. **Cambio de Contraseña Seguro desde Perfil (2FA por Correo):**
   - El usuario solicita cambiar su contraseña ingresando la actual.
   - El sistema despacha un código de seguridad de 6 dígitos a su correo electrónico.
   - El cambio solo se confirma cuando el usuario introduce dicho código correctamente.

5. **Recordatorios Automatizados de Turnos (Worker en Segundo Plano):**
   - Tarea periódica ejecutándose cada 60 segundos (`reminderJob.start(60000)`).
   - Detecta reservas en estado `CONFIRMED` dentro de la ventana de 65 minutos previos al turno.
   - Genera notificación in-app y despacha email de recordatorio si el usuario tiene `emailNotifications = true`.

---

## ✅ 2. Checklist de Estado del Sistema

- [x] Configuración de `.env` con credenciales de Gmail SMTP (`turnosyapp@gmail.com`).
- [x] Pruebas de envío real de email validadas exitosamente.
- [x] Flujo de recuperación de contraseñas (solicitud, token y reseteo).
- [x] Email HTML de bienvenida tras el registro de usuario.
- [x] Panel de verificación de correo en Perfil con código de 6 dígitos.
- [x] Página dedicada `/verify-email?token=...` para validación en 1 clic.
- [x] Auto-verificación de usuarios al autenticarse con Google OAuth.
- [x] Confirmación de cambio de contraseña con código de 6 dígitos por email.
- [x] Worker de recordatorios de turnos (1 hora antes) con control de preferencias del usuario.
- [x] Preferencias de usuario persistidas en BD (`emailNotifications`, `whatsappNotifications`).
- [x] Cobertura de pruebas unitarias con Jest para Auth, Appointments y Businesses.
- [x] Endpoint de salud `/health` con comprobación de MySQL en vivo y tiempo de actividad.
- [x] Scripts de sincronización de datos y asignación de administrador.

---

## 🔮 3. Próximos Pasos (Roadmap de Evolución)

### Fase A: Optimización para Entornos Cloud (Render / Railway)
- [ ] **Proveedor de Correo HTTP en la Nube:**
  - En plataformas como Render, los puertos SMTP tradicionales (25, 465, 587) pueden encontrarse bloqueados o limitados en planes gratuitos.
  - Se recomienda incorporar un adaptador para **Resend**, **SendGrid** o **Amazon SES** vía API HTTP (puerto 443) como alternativa o fallback al SMTP directo.

### Fase B: Integración Oficial de WhatsApp
- [ ] **Meta Cloud API / Twilio WhatsApp:**
  - Registro de cuenta de negocio en Meta Business Manager.
  - Configuración del número de teléfono corporativo y Webhook de estados.
  - Aprobación de plantillas oficiales de mensajes (*WhatsApp Message Templates*) para recordatorios de turnos y confirmaciones de reserva.

### Fase C: Automatización y Despliegue Continuo (CI/CD)
- [ ] Configuración de GitHub Actions para ejecución automática de:
  - Linter y comprobación de tipos TypeScript (`npm run build`).
  - Suite de pruebas unitarias (`npm test`).
  - Despliegue automático a producción tras merge en la rama `main`.
