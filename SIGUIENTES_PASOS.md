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

---

## 🛡️ 4. Hoja de Ruta de Seguridad y Métodos de Verificación (Security Roadmap)

Para garantizar un estándar de ciberseguridad profesional, cada método de verificación debe apoyarse en infraestructura real de base de datos, criptografía y validación backend, sin simular estados en frontend:

### 1. Contraseña (Estado: 100% Implementado y Operativo)
- **Base de datos:** Campo `users.password` (hash con `bcrypt`).
- **Seguridad:**
  - Recuperación de clave vía email con token temporal firmado de un solo uso.
  - Cambio de clave desde Perfil protegido mediante 2FA obligatorio por correo electrónico (código de 6 dígitos despachado vía SMTP de Gmail).
- **Próximas mejoras:** Política de complejidad configurable (mínimo 8 caracteres, mayúsculas, números y símbolos) y verificación contra listas de contraseñas vulneradas (HaveIBeenPwned API).

### 2. Correo Electrónico (Estado: 100% Implementado y Operativo)
- **Base de datos:** Campo `users.email` y booleano `users.email_verified`.
- **Seguridad:**
  - Código numérico OTP de 6 dígitos con expiración de 15 minutos almacenado en memoria/cache.
  - Enlace de verificación en un clic `/verify-email?token=...`.
  - Auto-verificación de identidad al iniciar sesión mediante Google OAuth 2.0.

### 3. Teléfono de Contacto y Recuperación (Estado: En espera por tiempo indeterminado)
- **Base de datos actual:** Campo `users.phone` en tabla `users`.
- **Estado:** Se mantiene como dato informativo opcional del perfil sin bloqueo ni verificación forzosa por SMS o WhatsApp, postergando la adquisición de línea corporativa y proveedor de mensajería para más adelante.

### 4. Doble Factor de Autenticación con Google Authenticator / TOTP (Estado: 100% Implementado y Operativo)
- **Base de datos:**
  - `two_factor_secret` (clave secreta Base32 cifrada con AES-256 en reposo).
  - `two_factor_enabled` (booleano).
  - `two_factor_backup_codes` (códigos de respaldo criptográficos cifrados).
  - `temp_two_factor_secret` (clave temporal de enrolamiento).
- **Implementación:**
  - Backend: `@otplib` + `qrcode` + AES-256. Endpoints `/api/v1/auth/2fa/setup`, `/verify-and-enable`, `/disable`, `/login-verify`.
  - Frontend Web: Modal de configuración con escaneo QR y confirmación, soporte en login escalonado.
  - Frontend Mobile: Soporte de segundo paso en `LoginScreen.tsx` e indicador de estado de seguridad en `ProfileScreen.tsx`.

### 5. Dispositivos Vinculados y Sesiones Concurrentes (Estado: 100% Implementado y Operativo)
- **Base de datos:**
  - Tabla `user_sessions` (`id`, `user_id`, `device_name`, `user_agent`, `ip_address`, `last_active_at`, `created_at`, `revoked_at`).
- **Implementación:**
  - Inyección de `sessionId` en el JWT emitido tras el login (con fallback seguro en caso de contingencia).
  - Detección automática y amigable de navegador y sistema operativo (`parseDeviceName`).
  - Verificación en middleware `authGuard` para detectar sesiones revocadas a distancia.
  - Endpoints:
    - `GET /api/v1/auth/sessions`: Lista dispositivos con sesión activa e indicador `isCurrent`.
    - `DELETE /api/v1/auth/sessions/:id`: Revocación remota de una sesión puntual.
    - `POST /api/v1/auth/sessions/revoke-all`: Cierre de todas las demás sesiones excepto la actual.
  - Frontend Web: Renderizado dinámico en tiempo real en la pestaña *Dispositivos vinculados* con badges y botones de revocación individual y masiva.

### 6. Llaves de Acceso (Passkeys) y Biometría Facial/Dactilar (FIDO2 / WebAuthn) (Estado: Planificado)
- **Base de datos requerida:**
  - Tabla `user_authenticators` (`id`, `user_id`, `credential_id`, `public_key`, `counter`, `transports`, `created_at`).
- **Plan de implementación:**
  - Librería backend: `@simplewebauthn/server`.
  - Librería frontend: `@simplewebauthn/browser`.
  - Permite acceso sin contraseña usando Windows Hello, Face ID, Touch ID o YubiKey mediante criptografía asimétrica de curva elíptica.

### 7. Código QR de Check-in para Asistencia a Turnos (Estado: Planificado)
- **Base de datos requerida:**
  - Campo `checkin_token` firmado por turno o por usuario (`appointments.checkin_token`).
- **Plan de implementación:**
  - Generación de código QR dinámico con HMAC temporal para evitar capturas de pantalla reutilizadas.
  - Escaneo en recepción del comercio desde la cámara del smartphone del recepcionista para cambiar estado a `ATTENDED` en tiempo real.

