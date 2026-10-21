# Siguientes pasos para Turnos Ya

## 1) Configurar la cuenta real de Gmail

Antes de probar el envío de emails reales, hay que completar la configuración de SMTP en el archivo `.env`.

### Completar en `.env`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
EMAIL_FROM="Turnos Ya <tu_email@gmail.com>"
```

### Importante
- `EMAIL_USER` debe ser la cuenta real de Gmail que va a enviar correos.
- `EMAIL_PASS` no es la contraseña normal de Gmail.
- Debe ser una "App Password" generada desde Google.
- `EMAIL_FROM` puede ser el mismo correo o un alias del negocio.

### Cómo crear la App Password en Gmail
1. Entrar a la cuenta de Gmail del negocio.
2. Ir a Seguridad.
3. Activar verificación en dos pasos si todavía no está habilitada.
4. Crear una "App Password".
5. Copiar la contraseña generada.
6. Pegar esa contraseña en `EMAIL_PASS`.

---

## 2) Probar el envío de email en local

Una vez completado el `.env`, hay que levantar el backend y verificar que el servicio de correo funcione.

### Comando
```bash
cd c:/xampp/htdocs/Turnos_Ya/Turnos_ya_backend-api
npm run dev
```

### Prueba sugerida
1. Crear un usuario con email válido.
2. Agendar un turno futuro con estado confirmado.
3. Esperar el recordatorio de 1 hora.
4. Verificar si llega el email.

---

## 3) Verificar que el usuario puede activar/desactivar notificaciones

En el frontend, el tab de notificaciones debe guardar en la base datos los valores:
- `emailNotifications`
- `whatsappNotifications`

### Revisión
- El usuario entra al tab de perfil > Notificaciones.
- Activa o desactiva Email.
- Guarda.
- Se actualiza el valor en la base de datos.
- Al recargar la página, sigue estando marcado o no.

---

## 4) Confirmar que los recordatorios solo envían email si está habilitado

La lógica del backend no debe enviar email si el usuario desactivó esa preference.

### Regla esperada
- `emailNotifications = true` => enviar email
- `emailNotifications = false` => no enviar email

Esto ya quedó preparado en la lógica de recordatorios.

---

## 5) Dejar preparado el flujo para WhatsApp futuro

WhatsApp real no es una integración simple como Gmail.

### Lo que falta para hacerlo bien
- elegir un proveedor o la Meta API oficial
- registrar el número del negocio
- configurar webhook o token
- definir plantillas de mensajes
- definir si el envío se hace por negocio o por agencia

### Recomendación
- Por ahora dejar WhatsApp como segunda etapa.
- Gmail/SMTP como primer canal real funcionando.

---

## 6) Probar en entorno real

Cuando ya esté la cuenta de Gmail y el backend funcionando, conviene hacer una prueba de producción con:
- un usuario real
- un turno real
- recordatorio real
- email enviado al Gmail del usuario

Con esto se valida que funciona el flujo completo.

---

## 7) Checklist de estado del MVP

- [x] Completar `.env` con Gmail real (`turnosyapp@gmail.com` con App Password de 16 letras)
- [x] Probar envío real de email a través de Gmail (probado y entregado exitosamente a `jeremiascoll@gmail.com`)
- [x] Recuperación de contraseña con enlace seguro directo y token automático
- [x] Email de bienvenida y confirmación de registro de usuario
- [x] Confirmación de cambio de contraseña con código de 6 dígitos enviado por email en el panel de perfil
- [x] Verificación de correo progresiva con banner discreto en cabecera y botón de verificación
- [x] Panel de verificación interactivo en Perfil con código de 6 dígitos y botón de modo QA
- [x] Página dedicada y directa `/verify-email?token=...` para validación en 1 clic
- [x] Auto-verificación de cuentas que inician sesión mediante Google OAuth
- [x] Confirmar recordatorios de turnos (1 hora antes) con envío de email si `emailNotifications = true`
- [x] Verificar usuarios con `emailNotifications` y `whatsappNotifications` en perfil
- [ ] Dejar WhatsApp para una segunda etapa (Meta Business Cloud API / Twilio)
- [ ] Evaluar proveedor HTTP en la nube (ej. Resend) para producción en Render (por bloqueo de puertos SMTP)
- [ ] Pruebas finales de aceptación de usuario (UAT) en flujo de reserva y notificaciones

---

## 8) Estado actual de las funcionalidades de comunicación

1. **Recuperación de contraseña:** 100% operativo tanto con correo real como con enlace de contingencia / QA en pantalla.
2. **Registro de usuarios:** Envía automáticamente un correo HTML de bienvenida con enlace a la plataforma sin bloquear el onboarding.
3. **Verificación de correo electrónico (Progresiva):**
   - Banner superior informativo si el usuario no tiene el email verificado.
   - Badge distintivo en el Perfil (`✓ Correo verificado` vs `⚠️ Pendiente de verificación`).
   - Envío de código de 6 dígitos por email con botón interactivo de verificación en el perfil.
   - Enlace directo de validación en un clic (`/verify-email?token=...`).
   - Cuentas de Google OAuth pre-verificadas automáticamente.
4. **Cambio de contraseña desde Perfil:** Solicita contraseña actual, envía código numérico de 6 dígitos al correo del usuario y exige validación antes de actualizar la clave en base de datos.
5. **Recordatorios de turnos:** El worker en segundo plano detecta turnos a menos de 65 minutos y envía tanto notificación en la aplicación como correo electrónico si el usuario tiene `emailNotifications` activo.

