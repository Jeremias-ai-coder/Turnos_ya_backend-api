# ⚙️ Turnos_ya - Backend RESTful API

Servidor RESTful central para la plataforma de reservas y gestión de turnos **Turnos_ya**. Desarrollado con **Node.js**, **Express**, **TypeScript** y **Prisma ORM sobre MySQL**, implementa una arquitectura limpia basada en 3 capas con inversión de dependencias (DIP), autenticación híbrida (JWT + Google OAuth 2.0), envío de correos transaccionales (Nodemailer), sistema de bloqueo concurrente de turnos (*Hold Tokens*) y tareas en segundo plano.

---

## 🛠️ Stack Tecnológico

- **Entorno de Ejecución**: [Node.js](https://nodejs.org/) (v20+ LTS)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) (v5.1+)
- **Framework Web**: [Express.js](https://expressjs.com/) (v4.18) con `express-async-errors`
- **ORM & Base de Datos**: [Prisma ORM](https://www.prisma.io/) (v5.22) conectado a **MySQL 8.0**
- **Autenticación y Criptografía**: [JSON Web Tokens (JWT)](https://jwt.io/), [bcrypt](https://www.npmjs.com/package/bcrypt) con salt rounds
- **Emails Transaccionales**: [Nodemailer](https://nodemailer.com/) con transporte SMTP (Gmail App Password)
- **Validación de Payloads**: [Zod](https://zod.dev/) (v3.21)
- **Seguridad y Cabeceras**: [Helmet](https://helmetjs.github.io/) y [CORS](https://www.npmjs.com/package/cors)
- **Pruebas Automatizadas**: [Jest](https://jestjs.io/) (v30+) con `ts-jest`
- **Contenedores y DevOps**: Docker Compose para MySQL local y configuración para Render (`render.yaml`)
- **Ejecución en Desarrollo**: `tsx` (TypeScript Execute / Watch)

---

## 🏗️ Arquitectura del Sistema (Clean Architecture / Inversión de Dependencias)

El backend aplica el principio de **Inversión de Dependencias (Dependency Inversion Principle - DIP)** y el **Patrón Repositorio**:

```text
               ┌────────────────────────────────────────────────────────┐
               │                     Cliente HTTP                       │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CAPA DE PRESENTACIÓN / CONTROLADORES (Presentation Layer)                            │
│    • src/routes/        : Enrutadores Express (v1 y alias directos).                    │
│    • src/middlewares/   : JWT Guard (authGuard), Logger y ErrorHandler (RFC 7807).     │
│    • src/validators/    : Esquemas Zod para validación estricta de entrada.             │
│    • src/controllers/   : Gestión de req/res, códigos HTTP y serialización.             │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │  Invoca (Inyección mediante container.ts)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. CAPA DE LÓGICA DE NEGOCIO (Domain & Business Logic Layer)                            │
│    • src/services/      : Lógica de reserva, hold tokens, hash bcrypt, verificación     │
│                           de email, reseteo de claves y worker de recordatorios.       │
│    • src/container.ts   : Contenedor IoC / Wire-up de dependencias de la aplicación.    │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │  Consume Interfaces (IUserRepository, etc.)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CAPA DE PERSISTENCIA Y EXTERNOS (Data Access & Infrastructure)                       │
│    • src/interfaces/    : Contratos desacoplados de persistencia.                       │
│    • src/repositories/  : Implementaciones concretas con Prisma Client sobre MySQL.     │
│    • src/config/        : Singleton de PrismaClient y comprobación de esquema.          │
│    • src/infrastructure/: Webhooks HTTP asíncronos para integración con terceros.       │
│    • src/services/email : Despacho de correos HTML mediante Gmail SMTP.                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```text
Turnos_ya_backend-api-main/
├── prisma/
│   ├── schema.prisma                 # Definición del modelo relacional (User, Business, Service, etc.)
│   └── seeds/                        # Scripts de sembrado de datos iniciales
├── scripts/
│   ├── check-db.ts                   # Comprobación de estado y conectividad MySQL
│   ├── grant-admin.ts                # Asignación de rol de administrador por correo
│   └── sync-businesses-to-prod.ts    # Sincronización de comercios semilla a producción
├── src/
│   ├── config/
│   │   └── prisma.ts                 # Singleton de PrismaClient y ensureDatabaseSchema()
│   ├── container.ts                  # Inyección de dependencias centralizada (IoC)
│   ├── controllers/                  # Controladores HTTP
│   │   ├── admin.controller.ts
│   │   ├── appointment.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── business.controller.ts
│   │   ├── category.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── review.controller.ts
│   │   ├── schedule.controller.ts
│   │   └── service.controller.ts
│   ├── infrastructure/
│   │   └── webhook.service.ts        # Despacho de webhooks de negocio
│   ├── interfaces/                   # Contratos de repositorios (DIP)
│   │   ├── appointment.interface.ts
│   │   ├── business.interface.ts
│   │   ├── schedule.interface.ts
│   │   ├── service.interface.ts
│   │   └── user.interface.ts
│   ├── middlewares/
│   │   ├── authGuard.ts              # Validación de token JWT y asignación de req.user
│   │   ├── errorHandler.ts           # Manejo uniforme de errores (RFC 7807 Problem Details)
│   │   └── requestLogger.ts          # Registro de peticiones HTTP en consola
│   ├── repositories/                 # Implementaciones Prisma de acceso a datos
│   │   ├── prisma-appointment.repository.ts
│   │   ├── prisma-business.repository.ts
│   │   ├── prisma-schedule.repository.ts
│   │   ├── prisma-service.repository.ts
│   │   └── prisma-user.repository.ts
│   ├── routes/                       # Definición de rutas Express
│   │   ├── admin.routes.ts
│   │   ├── appointment.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── business.routes.ts
│   │   ├── category.routes.ts
│   │   ├── health.routes.ts
│   │   └── notification.routes.ts
│   ├── services/                     # Servicios de lógica de negocio y tests
│   │   ├── admin.service.ts
│   │   ├── appointment.service.ts & appointment.service.test.ts
│   │   ├── auth.service.ts & auth.service.test.ts
│   │   ├── business.service.ts & business.service.test.ts
│   │   ├── category.service.ts
│   │   ├── email.service.ts          # Envío de emails HTML con Nodemailer
│   │   ├── notification.service.ts   # Notificaciones in-app y recordatorios
│   │   ├── review.service.ts
│   │   ├── schedule.service.ts
│   │   └── service.service.ts
│   ├── utils/
│   │   ├── keepAlive.ts              # Auto-ping para evitar suspensión en Render
│   │   └── pagination.ts             # Helpers de paginación estandarizada
│   ├── validators/                   # Schemas de validación Zod
│   │   ├── appointment.validator.ts
│   │   ├── auth.validator.ts
│   │   ├── business.validator.ts
│   │   ├── schedule.validator.ts
│   │   └── service.validator.ts
│   └── server.ts                     # Entrada de la app, jobs periódicos y middleware setup
├── docker-compose.yml                # Contenedor MySQL 8.0 para desarrollo local
├── jest.config.js                    # Configuración de pruebas unitarias Jest
├── render.yaml                       # Despliegue de infraestructura en Render Cloud
├── package.json
└── tsconfig.json
```

---

## 🔗 Catálogo de Endpoints RESTful

Todos los endpoints están disponibles bajo el prefijo `/api/v1/` y cuentan con alias directos en `/` para máxima compatibilidad:

### 🔐 Autenticación y Perfil (`/api/v1/auth`)
- `POST /login` — Inicio de sesión con email y contraseña, retorno de JWT.
- `POST /register` — Registro de usuario y envío de email de bienvenida.
- `POST /google` — Autenticación federada con Google OAuth 2.0 (auto-verifica email).
- `POST /forgot-password` — Solicitud de recuperación de contraseña vía email con token seguro.
- `POST /reset-password` — Establecimiento de nueva contraseña con token de recuperación.
- `GET /me` — Perfil del usuario autenticado actual.
- `PATCH /profile` — Actualización de nombre, teléfono y preferencias (`emailNotifications`, `whatsappNotifications`).
- `POST /send-verification-email` — Envío de código numérico de 6 dígitos para verificar correo.
- `GET /verify-email` & `POST /verify-email` — Validación de email en 1 clic mediante enlace o código de 6 dígitos.
- `POST /request-password-change-code` — Envío de código de seguridad de 6 dígitos para cambio de contraseña desde perfil.
- `POST /verify-password-change-code` — Validación del código de seguridad previo al cambio de clave.
- `POST /confirm-password-change` — Actualización definitiva de clave validando código y contraseña anterior.

### 🏬 Comercios y Catálogo (`/api/v1/businesses`)
- `GET /` — Listado público paginado con filtros por búsqueda y categoría.
- `POST /` — Creación de un nuevo comercio (eleva automáticamente el rol a `owner`).
- `GET /my` — Listado de los comercios pertenecientes al usuario logueado.
- `GET /:id` — Ficha completa del comercio con coordenadas, horarios y servicios.
- `PATCH /:id` — Actualización de datos del comercio (solo dueño o admin).
- `GET /:id/services` — Listado de servicios del comercio.
- `POST /:id/services` — Creación de servicio (duración, precio, buffer time).
- `PUT /:id/services/:serviceId` & `DELETE ...` — Edición o baja de servicio.
- `GET /:id/schedules` — Matriz de horarios de atención semanal.
- `POST /:id/schedules` & `DELETE ...` — Configuración de franjas horarias por día.
- `GET /:id/busy-slots?date=YYYY-MM-DD` — Consulta de franjas horarias ocupadas para una fecha dada.
- `GET /:id/reviews` — Reseñas y calificaciones otorgadas al comercio.

### 📅 Turnos y Reservas (`/api/v1/appointments`)
- `GET /` & `GET /my` — Historial de turnos del usuario (o turnos del comercio si es dueño).
- `GET /:id` — Detalle del turno.
- `POST /` — Confirmación y persistencia de un turno (directo o mediante `holdToken`).
- `POST /hold` — Bloqueo temporal transaccional de 10 minutos para evitar colisiones (*Hold Token*).
- `PATCH /:id/cancel` — Cancelación de turno con motivo registrado y auditoría de usuario.
- `PATCH /:id/status` — Cambio de estado del turno (`CONFIRMED`, `COMPLETED`, `CANCELLED`, etc.).
- `POST /:id/reviews` — Calificación y comentario sobre un turno completado.

### 🔔 Notificaciones (`/api/v1/notifications`)
- `GET /` — Listado de notificaciones del usuario logueado.
- `PATCH /read-all` — Marcar todas las notificaciones como leídas.
- `PATCH /:id/read` — Marcar una notificación individual como leída.

### 🏷️ Categorías (`/api/v1/categories`)
- `GET /` — Catálogo general de categorías disponibles.
- `GET /:slug` — Detalle y comercios asociados a una categoría específica.

### 🛡️ Administración Global (`/api/v1/admin`)
- `GET /users` — Listado de todos los usuarios registrados en el sistema.
- `PATCH /users/:id/role` — Modificación del rol de un usuario (`client`, `owner`, `administrator`).
- `DELETE /users/:id` — Baja de un usuario.
- `GET /stats` — Métricas globales (total de usuarios, turnos, comercios y reservas).
- `GET /appointments` — Visualización global de todos los turnos registrados.

### 🩺 Salud del Servicio (`/health`)
- `GET /health` & `GET /api/v1/health` — Estado de conectividad de MySQL, tiempo de actividad (*uptime*) y timestamp.

---

## ⏰ Tareas en Segundo Plano (Workers)

1. **`reminderJob` (Recordatorios de Turnos)**:
   - Se ejecuta periódicamente cada 60 segundos.
   - Detecta reservas en estado `CONFIRMED` programadas dentro de los siguientes 65 minutos que aún no hayan recibido recordatorio.
   - Genera una notificación in-app y, si el usuario tiene `emailNotifications = true`, despacha un correo HTML de recordatorio mediante Nodemailer.
2. **`startKeepAlive` (Prevención de Suspensión en Render)**:
   - Realiza un auto-ping HTTP cada 10 minutos para evitar que la instancia en la nube entre en reposo.
3. **`ensureDatabaseSchema`**:
   - Comprobación y compatibilidad automática de columnas al arrancar el servidor.

---

## ⚙️ Variables de Entorno

Crear un archivo `.env` en la raíz del backend con los siguientes parámetros:

```env
# Puerto del servidor
PORT=3000
NODE_ENV=development

# Conexión a Base de Datos MySQL
DATABASE_URL="mysql://root:@localhost:3306/turnos_ya"

# Seguridad y Autenticación
JWT_SECRET="tu_clave_secreta_super_segura_jwt"
JWT_EXPIRES_IN="7d"

# Configuración de Correo SMTP (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
EMAIL_FROM="Turnos Ya <tu_email@gmail.com>"

# URL base para enlaces generados (validación de email / reseteo)
APP_URL=http://localhost:5173
```

---

## 🚀 Comandos de Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar base de datos local con Docker (opcional)
npm run db:up

# 3. Aplicar esquema Prisma a MySQL
npm run db:push

# 4. Sembrar datos iniciales (usuarios, comercios, categorías)
npm run db:seed

# 5. Iniciar en modo desarrollo (recarga en caliente con tsx)
npm run dev

# 6. Ejecutar tests unitarios con Jest
npm test
npm run test:coverage

# 7. Compilar para producción
npm run build
npm start
```

---

## 🧪 Pruebas Unitarias

El backend incluye pruebas unitarias escritas con Jest y `ts-jest` cubriendo los servicios críticos:
- `auth.service.test.ts`: Registro, login, verificación de email y reseteo de claves.
- `appointment.service.test.ts`: Lógica de *Hold Tokens*, prevención de colisiones y cancelaciones.
- `business.service.test.ts`: CRUD de negocios, validación de pertenencia por dueño.
