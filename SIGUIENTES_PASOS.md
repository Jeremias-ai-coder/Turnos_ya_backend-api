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

## 7) Checklist final antes de cerrar el MVP

- [ ] Completar `.env` con Gmail real
- [ ] Probar envío de email
- [ ] Verificar usuarios con `emailNotifications`
- [ ] Confirmar recordatorios con email
- [ ] Dejar WhatsApp para una segunda etapa
- [ ] Revisar si hace falta un panel administrativo para ver notificaciones

---

## 8) Observación importante

El proyecto ya tiene la lógica de recordatorios y notificaciones base. Lo que falta para “hacerlo funcionar de verdad” es simplemente:
- cuenta Gmail real
- App Password
- configuración del `.env`
- pruebas con un usuario real

Una vez hecho eso, el sistema queda listo para enviar avisos por email de forma real.
