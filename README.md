# ⚙️ Turnos_ya - Backend RESTful API

Servidor RESTful central para la plataforma de reservas y gestión de turnos **Turnos_ya**. Desarrollado con **Node.js**, **Express**, **TypeScript** y **Prisma ORM sobre MySQL**, implementa una **Arquitectura Limpia de 3 capas** con Inversión de Dependencias (DIP), autenticación multifactor (**JWT + Google OAuth 2.0 + 2FA TOTP cifrado con AES-256-GCM**), despacho de correos transaccionales de baja latencia mediante **Resend HTTP API (puerto 443)** con fallback automático a **Nodemailer SMTP**, streaming de notificaciones en tiempo real (**Server-Sent Events**), caché en memoria inteligente (**LRU + TTL**) y bloqueo concurrente de turnos (*Hold Tokens*).

---

## 🛠️ Stack Tecnológico

- **Entorno de Ejecución**: [Node.js](https://nodejs.org/) (v20+ LTS)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) (v5.1+)
- **Framework Web**: [Express.js](https://expressjs.com/) (v4.18) con `express-async-errors`
- **ORM & Base de Datos**: [Prisma ORM](https://www.prisma.io/) (v5.22) conectado a **MySQL 8.0**
- **Autenticación, 2FA y Criptografía**:
  - [JSON Web Tokens (JWT)](https://jwt.io/) con validación de sesión activa (`UserSession`) y protección contra confusión de tipos (`type: 'SESSION'`).
  - [otplib](https://github.com/yeojz/otplib) + [qrcode](https://github.com/soldair/node-qrcode) para **2FA TOTP (Google Authenticator)** con secretos y códigos de respaldo cifrados en reposo mediante **AES-256-GCM** (`src/utils/crypto.ts`).
  - Códigos OTP de 6 dígitos protegidos con **HMAC-SHA256** y hashing de contraseñas con [bcrypt](https://www.npmjs.com/package/bcrypt).
- **Emails Transaccionales Híbridos**:
  - **Primario**: [Resend HTTP API](https://resend.com/) sobre HTTPS (puerto 443, inmune a bloqueos de puertos SMTP en Render Free).
  - **Fallback**: [Nodemailer](https://nodemailer.com/) con transporte SMTP (Gmail App Password).
- **Caché y Rendimiento**: Motor propio `CacheService` en memoria (LRU + TTL + invalidación por comodines) y cabeceras HTTP `Cache-Control` (`stale-while-revalidate`).
- **Seguridad y Validación**: [Zod](https://zod.dev/) (v3.21), [Helmet](https://helmetjs.github.io/), [CORS](https://www.npmjs.com/package/cors) y `rateLimiter` por IP/usuario con soporte `trust proxy`.
- **Pruebas Automatizadas**: [Jest](https://jestjs.io/) (v30+) con `ts-jest` (8 suites, 87 tests unitarios).

---

## 🏗️ Arquitectura del Sistema (Clean Architecture & DIP)

```text
               ┌────────────────────────────────────────────────────────┐
               │              Cliente Web SPA / App Móvil               │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CAPA DE PRESENTACIÓN / CONTROLADORES (Presentation Layer)                            │
│    • src/routes/        : Enrutadores Express (/api/v1/* y alias directos /*).          │
│    • src/middlewares/   : authGuard (JWT + revocación remota), rateLimiter,             │
│                           cacheControl, requestLogger y errorHandler (RFC 7807).        │
│    • src/validators/    : Esquemas Zod para validación estricta de entrada.             │
│    • src/controllers/   : Orquestación HTTP, serialización y delegación a servicios.    │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │  Invoca (Inyección mediante container.ts)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. CAPA DE LÓGICA DE NEGOCIO (Domain & Business Logic Layer)                            │
│    • src/services/      : Auth (JWT, OAuth, 2FA, Sesiones), Appointments (Hold Tokens,  │
│                           feriados), Admin (Inmunidad Cuenta Raíz), Community,          │
│                           Reviews, Categories, BugReports, Announcements, Audit, Cache. │
│    • src/container.ts   : Contenedor IoC / Wire-up centralizado de dependencias.        │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │  Consume Interfaces (IUserRepository, etc.)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA DE PERSISTENCIA Y EXTERNOS (Data Access & Infrastructure)                       │
│    • src/interfaces/    : Contratos desacoplados de persistencia.                       │
│    • src/repositories/  : Implementaciones concretas con Prisma Client sobre MySQL.     │
│    • src/config/        : Singleton de PrismaClient y auto-healing (prisma.ts).         │
│    • src/infrastructure/: Worker periódico de recordatorios (reminder.job.ts).          │
│    • src/services/email : Despacho híbrido Resend HTTPS API + Nodemailer SMTP.          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```text
Turnos_ya_backend-api-main/
├── prisma/
│   ├── schema.prisma                 # Esquema relacional (User, UserSession, Business, Category, Service, Schedule, Appointment, Review, Notification, BugReport)
│   └── seeds/                        # Sembrado inicial ( parametrizado por variables de entorno sin credenciales hardcodeadas)
├── scripts/
│   ├── breaking-point-test.ts        # Prueba de estrés hasta punto de quiebre
│   ├── check-db.ts                   # Diagnóstico de conectividad MySQL
│   ├── grant-admin.ts                # Promoción administrativa por consola
│   ├── inspect-dbs.ts                # Inspección de tablas y registros
│   ├── migrate-to-clean-prod.ts      # Migración limpia a entorno productivo
│   ├── stress-test.ts                # Benchmark de concurrencia y latencia
│   └── sync-businesses-to-prod.ts    # Sincronización de comercios semilla
├── src/
│   ├── config/
│   │   └── prisma.ts                 # Singleton PrismaClient y ensureDatabaseSchema()
│   ├── container.ts                  # Contenedor IoC de inyección de dependencias
│   ├── controllers/                  # Controladores HTTP
│   │   ├── admin.controller.ts
│   │   ├── announcement.controller.ts
│   │   ├── appointment.controller.ts
│   │   ├── audit.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── bug-report.controller.ts
│   │   ├── business.controller.ts
│   │   ├── category.controller.ts
│   │   ├── community.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── review.controller.ts
│   │   ├── schedule.controller.ts
│   │   └── service.controller.ts
│   ├── infrastructure/
│   │   └── reminder.job.ts           # Worker de recordatorios automáticos cada 60s
│   ├── interfaces/                   # Contratos de repositorios (DIP)
│   ├── middlewares/
│   │   ├── authGuard.ts & .test.ts   # Validación JWT, tipo SESSION y revocación remota
│   │   ├── cacheControl.ts           # Cabeceras HTTP Cache-Control (SWR)
│   │   ├── errorHandler.ts           # Respuestas estandarizadas RFC 7807
│   │   ├── rateLimiter.ts            # Límite de peticiones por IP y usuario
│   │   └── requestLogger.ts          # Auditoría HTTP con redacción de tokens
│   ├── repositories/                 # Implementaciones Prisma
│   ├── routes/                       # Definición de rutas Express
│   │   ├── admin.routes.ts
│   │   ├── announcement.routes.ts
│   │   ├── appointment.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── business.routes.ts
│   │   ├── category.routes.ts
│   │   ├── health.routes.ts
│   │   ├── notification.routes.ts
│   │   └── report.routes.ts
│   ├── services/                     # Lógica de negocio y suites de pruebas (.test.ts)
│   ├── utils/
│   │   ├── crypto.ts                 # Cifrado AES-256-GCM para secretos 2FA
│   │   ├── date.ts                   # Manejo de horas wall-clock y zonas horarias
│   │   ├── deviceDetector.ts         # Detección de navegador/SO para sesiones
│   │   ├── emailTemplates.ts         # Plantillas HTML transaccionales
│   │   ├── keepAlive.ts              # Auto-ping para Render Cloud
│   │   └── pagination.ts             # Helpers de paginación estandarizada
│   ├── validators/                   # Esquemas Zod y pruebas unitarias
│   └── server.ts                     # Entrada principal de la aplicación
├── docker-compose.yml
├── jest.config.js
├── render.yaml
├── package.json
└── tsconfig.json
```

---

## 🔗 Catálogo de Endpoints RESTful

Todos los endpoints están disponibles bajo `/api/v1/` y cuentan con alias directos en `/`:

### 🔐 Autenticación, 2FA y Sesiones (`/api/v1/auth` y `/api/v1/users`)
- `POST /register` — Registro de usuario (forzado a `client`/`owner`) y correo de bienvenida.
- `POST /login` — Login con credenciales (retorna `require2FA: true` y `tempToken` si el usuario tiene 2FA activo).
- `POST /google` — Autenticación federada con Google OAuth 2.0 (soporta flujo 2FA si está activo).
- `POST /2fa/login-verify` — Verificación de código TOTP o código de respaldo para completar el login.
- `GET /2fa/setup` & `POST /2fa/setup` — Generación de secreto TOTP y código QR para Google Authenticator.
- `POST /2fa/verify-and-enable` — Confirmación de código TOTP y emisión de 8 códigos de respaldo únicos.
- `POST /2fa/disable` — Desactivación de 2FA mediante contraseña actual, código TOTP o código de respaldo.
- `GET /me` & `PATCH /profile` — Consulta y edición de perfil y preferencias de alertas.
- `DELETE /account` — Baja voluntaria de cuenta y revocación de sesiones.
- `POST /send-verification-email` & `POST /verify-email` (`GET /verify-email`) — Verificación de correo por código de 6 dígitos (HMAC) o enlace de 1 clic.
- `POST /request-password-change-code` — Solicitud de código OTP por email para cambio de contraseña.
- `POST /verify-password-change-code` — Validación del código OTP de correo y emisión de `changeAuthToken`.
- `POST /verify-password-change-2fa` — Validación de identidad vía Google Authenticator para cambio de contraseña.
- `POST /submit-password-change` — Actualización definitiva de contraseña (soporta `skipCurrentPassword` cuando la identidad fue validada por OTP o 2FA, ideal para cuentas Google OAuth) y revocación de sesiones previas.
- `POST /forgot-password` & `POST /reset-password` — Recuperación de contraseña olvidada por email.
- `GET /sessions`, `DELETE /sessions/:id` & `POST /sessions/revoke-all` — Listado y cierre remoto de dispositivos vinculados.

### 🏬 Comercios, Comunidad y Catálogo (`/api/v1/businesses`)
- `GET /` — Listado público paginado de comercios aprobados con búsqueda y filtro por categoría.
- `POST /` — Postulación de nuevo comercio (nace en `pending_approval` con evidencias comerciales).
- `GET /my` — Listado de comercios propios del usuario autenticado.
- `GET /my/favorites` — Listado de comercios seguidos por el usuario con datos enriquecidos del local.
- `GET /:id` & `PATCH /:id` — Detalle completo y actualización del comercio.
- `GET /:id/community` — Resumen de seguidores, estado de seguimiento, próximos feriados y avisos recientes.
- `POST /:id/follow` & `PATCH /:id/follow/notifications` — Seguir/dejar de seguir comercio y configurar alertas.
- `POST /:id/broadcasts` — Envío de comunicados/promociones a seguidores (cupo anti-spam de 3 por semana).
- `POST /:id/closed-dates` & `DELETE /:id/closed-dates/:date` — Gestión de días cerrados / Modo Feriado.
- `GET /:id/services`, `POST /:id/services`, `PUT/PATCH /:id/services/:serviceId`, `DELETE /:id/services/:serviceId` — ABM de servicios con invalidación automática de caché.
- `GET /:id/schedules`, `POST /:id/schedules`, `PUT/PATCH /:id/schedules/:scheduleId`, `DELETE /:id/schedules/:scheduleId` — Matriz horaria semanal.
- `GET /:id/busy-slots?date=YYYY-MM-DD` — Franjas horarias ocupadas en una fecha.
- `GET /:id/reviews` — Reseñas visibles y estadísticas de calificación del comercio.

### 📅 Turnos y Reservas (`/api/v1/appointments`)
- `GET /` & `GET /my` — Listado de turnos del cliente o agenda del comercio.
- `POST /hold` — Bloqueo temporal transaccional de 10 minutos (*Hold Token*), validando días feriados/cerrados.
- `POST /` — Confirmación de reserva (con `holdToken` o directa).
- `PATCH /:id/cancel` — Cancelación de turno con política de 24 hs para clientes y registro inalterable de autoría.
- `PATCH /:id/status` — Cambio de estado (`CONFIRMED`, `COMPLETED`, `CANCELLED`).
- `POST /:id/reviews` — Creación de reseña verificada (1 a 5 estrellas) sobre un turno completado.

### 🔔 Notificaciones (`/api/v1/notifications`)
- `GET /` — Listado de notificaciones in-app.
- `GET /stream` — Canal de tiempo real mediante **Server-Sent Events (SSE)** con heartbeat cada 25s.
- `PATCH /read-all` & `PATCH /:id/read` — Lectura masiva o individual de notificaciones.

### 🏷️ Categorías (`/api/v1/categories`), 📢 Anuncios (`/api/v1/announcements`) y 🐛 Reportes (`/api/v1/reports`)
- `GET /categories` & `GET /categories/:slug` — Catálogo dinámico de rubros comerciales activos.
- `GET /announcements/active` — Aviso global activo para toda la plataforma.
- `POST /reports` (y alias `/bug-reports`) — Creación de tickets de soporte (`BUG`), solicitud de nuevos rubros (`SOLICITUD_RUBRO`) o denuncias de reseñas (`MODERACION_RESENA`).

### 🛡️ Administración Global y Cuenta Raíz (`/api/v1/admin`)
> **Jerarquía de Seguridad:** La Cuenta Raíz (`turnosyapp@gmail.com`) goza de **inmunidad absoluta** en código: no puede ser eliminada ni degradada de rol bajo ninguna circunstancia, y es la **única cuenta autorizada** para otorgar o revocar el rol `administrator` o eliminar a otros administradores.

- `GET /users`, `PATCH /users/:id/role`, `DELETE /users/:id` — Gestión de usuarios con protección de Cuenta Raíz.
- `GET /businesses`, `PATCH /businesses/:id/approve`, `PATCH /businesses/:id/reject`, `PATCH /businesses/:id/suspend`, `PATCH /businesses/:id/reactivate`, `DELETE /businesses/:id` — Moderación e inspección documental de comercios.
- `POST /businesses/:id/emergency-cancel` — Cancelación masiva de turnos por fuerza mayor / emergencia.
- `PATCH /reviews/:id/hide`, `PATCH /reviews/:id/unhide`, `DELETE /reviews/:id` — Moderación de reseñas.
- `GET /categories`, `POST /categories`, `PUT /categories/:id`, `PATCH /categories/:id/toggle`, `DELETE /categories/:id` — Gestor dinámico de rubros.
- `GET /announcements`, `POST /announcements`, `PATCH /announcements/:id/toggle`, `DELETE /announcements/:id` — Gestión de comunicados globales.
- `GET /reports` & `PATCH /reports/:id/status` — Bandeja de tickets y solicitudes de rubros.
- `GET /audit-logs` — Bitácora de auditoría forense paginada.
- `GET /stats`, `GET /cache/stats` & `POST /cache/clear` — Métricas ejecutivas y control de caché.

---

## ⚙️ Variables de Entorno (`.env`)

```env
# Servidor y Entorno
PORT=3000
NODE_ENV=development
APP_TIMEZONE="America/Argentina/Buenos_Aires"

# Base de Datos MySQL
DATABASE_URL="mysql://root:@localhost:3306/turnos_ya"

# Seguridad, JWT, 2FA y Google OAuth
JWT_SECRET="clave_secreta_jwt_aleatoria_minimo_32_caracteres"
TWO_FACTOR_ENCRYPTION_KEY="clave_hex_o_texto_para_cifrado_aes_256_gcm"
GOOGLE_CLIENT_ID="tu_google_client_id.apps.googleusercontent.com"

# Correos Transaccionales: Resend HTTP API (Prioritario en Cloud)
RESEND_API_KEY="re_tu_api_key_de_resend"
RESEND_FROM="Turnos Ya <onboarding@resend.dev>"

# Fallback SMTP tradicional (Opcional / Desarrollo local)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
EMAIL_FROM="Turnos Ya <tu_email@gmail.com>"

# URL del Frontend Web para enlaces en correos
FRONTEND_URL=http://localhost:5173

# Semillas iniciales (Opcional - nunca subir credenciales reales al repo)
# SEED_ADMIN_EMAIL=admin@ejemplo.com
# SEED_ADMIN_PASSWORD=TuPasswordSegura123!
```

---

## 🚀 Comandos de Ejecución y Pruebas

```bash
npm install              # Instalar dependencias
npm run db:push          # Sincronizar esquema Prisma con MySQL
npm run db:seed          # Ejecutar semillas iniciales
npm run dev              # Iniciar servidor en modo desarrollo con tsx
npm test                 # Ejecutar las 8 suites de pruebas unitarias (87 tests)
npm run build            # Generar cliente Prisma y compilar TypeScript a dist/
npm start                # Ejecutar servidor compilado en producción
```
