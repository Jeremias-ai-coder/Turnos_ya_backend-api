/**
 * Módulo de Plantillas de Correo Electrónico Oficiales de Turnos Ya
 * Diseñado con estándares de email marketing y diseño UI/UX premium:
 * - Compatible con clientes de correo (Gmail, Outlook, Apple Mail, Yahoo)
 * - Look & Feel moderno con paleta oficial de Turnos Ya (#009ee3 / #0284c7)
 * - Responsive y con tipografía optimizada
 */

interface BaseEmailOptions {
  preheader?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

/**
 * Contenedor maestro de email con diseño premium
 */
export function buildEmailLayout({
  preheader = 'Turnos Ya - Tu plataforma inteligente de turnos online',
  badge = '📅 Turnos Ya',
  title,
  subtitle,
  contentHtml,
  ctaText,
  ctaUrl,
  footerNote,
}: BaseEmailOptions): string {
  const currentYear = new Date().getFullYear();
  const frontendUrl = process.env.FRONTEND_URL || 'https://turnos-ya-frontend-web-delta.vercel.app';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #334155;
    }
    table {
      border-collapse: separate;
    }
    a {
      color: #009ee3;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        margin: 0 !important;
        border-radius: 0 !important;
      }
      .content-cell {
        padding: 24px 18px !important;
      }
      .header-cell {
        padding: 28px 18px 24px 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <!-- Preheader oculto para vista previa en bandeja de entrada -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header con Gradiente Oficial -->
          <tr>
            <td class="header-cell" style="background: linear-gradient(135deg, #0284c7 0%, #009ee3 100%); padding: 34px 28px 30px 28px; text-align: center;">
              
              <!-- Badge de Identidad -->
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); padding: 5px 14px; border-radius: 9999px; margin-bottom: 12px;">
                <span style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                  ${badge}
                </span>
              </div>

              <!-- Título del Correo -->
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; line-height: 1.25; letter-spacing: -0.3px;">
                ${title}
              </h1>

              ${
                subtitle
                  ? `<p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 14px; line-height: 1.4; font-weight: 500;">
                      ${subtitle}
                    </p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td class="content-cell" style="padding: 32px 28px 24px 28px; background-color: #ffffff;">
              ${contentHtml}

              <!-- Botón CTA Principal (si se define) -->
              ${
                ctaText && ctaUrl
                  ? `
                  <div style="text-align: center; margin: 32px 0 20px 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="18%" strokecolor="#0284c7" fillcolor="#009ee3">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${ctaText}</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${ctaUrl}" target="_blank" style="background: linear-gradient(135deg, #009ee3 0%, #0284c7 100%); color: #ffffff; padding: 14px 34px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 14px rgba(0, 158, 227, 0.35); text-align: center; letter-spacing: 0.2px;">
                      ${ctaText}
                    </a>
                  </div>
                  `
                  : ''
              }

              ${
                footerNote
                  ? `
                  <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                      ${footerNote}
                    </p>
                  </div>
                  `
                  : ''
              }
            </td>
          </tr>

          <!-- Footer Institucional -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 28px; border-top: 1px solid #f1f5f9; text-align: center;">
              
              <!-- Enlaces Rápidos -->
              <div style="margin-bottom: 14px;">
                <a href="${frontendUrl}" style="color: #009ee3; font-size: 13px; font-weight: 600; margin: 0 10px;">Inicio</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="${frontendUrl}/my-appointments" style="color: #009ee3; font-size: 13px; font-weight: 600; margin: 0 10px;">Mis Turnos</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="${frontendUrl}/profile" style="color: #009ee3; font-size: 13px; font-weight: 600; margin: 0 10px;">Mi Cuenta</a>
              </div>

              <!-- Copyright y Aviso -->
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                © ${currentYear} <strong>Turnos Ya</strong> — Gestión y reserva inteligente de turnos online.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
                Este correo fue enviado automáticamente por el sistema de Turnos Ya.<br/>
                Por favor, no respondas directamente a este mensaje automático.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plantilla de Bienvenida y Creación de Cuenta (Estética y Premium)
 */
export function getWelcomeEmailHtml({
  name,
  email,
  frontendUrl,
}: {
  name: string;
  email: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <!-- Saludo Personalizado -->
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        ¡Hola, ${name}! 👋
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Te damos una cálida bienvenida a <strong>Turnos Ya</strong>. Tu cuenta ha sido creada exitosamente y ya está lista para que empieces a disfrutar de una experiencia de reservas ágil, moderna y sin esperas.
      </p>
    </div>

    <!-- Ficha Resumen de Cuenta -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 22px 0;">
      <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
        Detalles de tu cuenta
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Correo electrónico:</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Estado de la cuenta:</td>
          <td align="right" style="padding: 4px 0;">
            <span style="background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px;">
              ✓ Activa & Habilitada
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Plataforma:</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #0284c7;">Web & Mobile</td>
        </tr>
      </table>
    </div>

    <!-- Lo que podés hacer en Turnos Ya -->
    <div style="margin: 26px 0 12px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 14px;">
        ¿Qué podés hacer ahora en Turnos Ya?
      </div>

      <!-- Item 1 -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
        <tr>
          <td width="38" valign="top" style="padding-right: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background-color: #eff6ff; text-align: center; line-height: 36px; font-size: 18px;">
              ⚡
            </div>
          </td>
          <td valign="top">
            <div style="font-size: 14px; font-weight: 700; color: #1e293b;">Reservá turnos en segundos</div>
            <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">
              Buscá por rubro (barberías, estética, salud, deportes) y elegí día y horario en tiempo real las 24 horas.
            </div>
          </td>
        </tr>
      </table>

      <!-- Item 2 -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
        <tr>
          <td width="38" valign="top" style="padding-right: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background-color: #fef3c7; text-align: center; line-height: 36px; font-size: 18px;">
              🔔
            </div>
          </td>
          <td valign="top">
            <div style="font-size: 14px; font-weight: 700; color: #1e293b;">Recordatorios y Avisos Previos</div>
            <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">
              Te notificamos antes de cada cita para que nunca te olvides ni pierdas un turno programado.
            </div>
          </td>
        </tr>
      </table>

      <!-- Item 3 -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="38" valign="top" style="padding-right: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background-color: #fce7f3; text-align: center; line-height: 36px; font-size: 18px;">
              ❤️
            </div>
          </td>
          <td valign="top">
            <div style="font-size: 14px; font-weight: 700; color: #1e293b;">Seguí a tus Comercios Favoritos</div>
            <div style="font-size: 13px; color: #64748b; line-height: 1.4; margin-top: 2px;">
              Guardá tus negocios predilectos y recibí novedades de feriados, cambios de horario y promociones exclusivas.
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return buildEmailLayout({
    preheader: `¡Hola ${name}! Te damos la bienvenida a Turnos Ya. Tu cuenta está lista para reservar.`,
    badge: '🎉 ¡Bienvenido a Turnos Ya!',
    title: '¡Tu cuenta ha sido creada!',
    subtitle: 'Comenzá a reservar turnos de forma rápida, simple e intuitiva',
    contentHtml,
    ctaText: 'Comenzar a explorar comercios →',
    ctaUrl: frontendUrl,
    footerNote:
      'Si no reconocés la creación de esta cuenta o se trató de un error, podés desestimar este mensaje de forma segura.',
  });
}

/**
 * Plantilla de Recuperación de Contraseña
 */
export function getPasswordResetEmailHtml({
  name,
  resetUrl,
}: {
  name: string;
  resetUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Hola, ${name}
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Recibimos una solicitud para restablecer la contraseña de acceso a tu cuenta en <strong>Turnos Ya</strong>.
      </p>
    </div>

    <div style="background-color: #eff6ff; border-left: 4px solid #009ee3; padding: 16px 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
        ⏱️ Este enlace es personal e intransferible, y tiene una validez de <strong>1 hora</strong> por motivos de seguridad.
      </p>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Hacé clic en el siguiente botón para definir tu nueva contraseña de forma segura:
    </p>
  `;

  return buildEmailLayout({
    preheader: 'Enlace de restablecimiento de contraseña para tu cuenta de Turnos Ya.',
    badge: '🔒 Seguridad de la Cuenta',
    title: 'Restablecimiento de Contraseña',
    subtitle: 'Crea una nueva contraseña segura para tu cuenta',
    contentHtml,
    ctaText: 'Restablecer mi contraseña →',
    ctaUrl: resetUrl,
    footerNote: `
      Si el botón no funciona, podés copiar y pegar este enlace en tu navegador:<br/>
      <a href="${resetUrl}" style="color: #009ee3; word-break: break-all; font-size: 12px;">${resetUrl}</a><br/><br/>
      Si vos no solicitaste este cambio, no te preocupes: nadie puede acceder a tu cuenta sin este enlace. Podés ignorar este correo.
    `,
  });
}

/**
 * Plantilla de Código de 6 dígitos para cambio de contraseña desde el perfil
 */
export function getPasswordChangeCodeEmailHtml({
  name,
  code,
}: {
  name: string;
  code: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Hola, ${name}
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Recibimos una solicitud para modificar la contraseña de tu cuenta desde el panel de seguridad de Turnos Ya.
      </p>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5;">
      Para confirmar y autorizar esta acción, ingresá el siguiente código de seguridad de 6 dígitos:
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: #f0f9ff; border: 2px dashed #009ee3; padding: 14px 34px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0284c7; border-radius: 12px;">
        ${code}
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
        ⏱️ Válido durante los próximos 15 minutos.
      </p>
    </div>
  `;

  return buildEmailLayout({
    preheader: `Tu código de verificación de seguridad es ${code}.`,
    badge: '🛡️ Verificación de Seguridad',
    title: 'Código de Confirmación',
    subtitle: 'Autorización de cambio de contraseña',
    contentHtml,
    footerNote:
      '⚠️ Si vos no realizaste esta solicitud, por favor cambiá tu contraseña o comunicate con el equipo de soporte de inmediato.',
  });
}

/**
 * Plantilla de Notificación de Recordatorio de Turno (1 hora antes)
 */
export function getAppointmentReminderEmailHtml({
  clientName,
  businessName,
  serviceName,
  timeFormatted,
  frontendUrl,
}: {
  clientName: string;
  businessName: string;
  serviceName: string;
  timeFormatted: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        ¡Hola, ${clientName}! 👋
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Te recordamos que tenés un turno reservado para dentro de <strong>aproximadamente 1 hora</strong>.
      </p>
    </div>

    <!-- Ficha del Turno -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #009ee3; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 5px 0; font-size: 14px; color: #64748b;">Comercio / Profesional:</td>
          <td align="right" style="padding: 5px 0; font-size: 15px; font-weight: 700; color: #0f172a;">${businessName}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 14px; color: #64748b;">Servicio a realizar:</td>
          <td align="right" style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0284c7;">${serviceName}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; font-size: 14px; color: #64748b;">Horario programado:</td>
          <td align="right" style="padding: 5px 0; font-size: 16px; font-weight: 800; color: #16a34a;">${timeFormatted} hs</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-top: 18px;">
      Te sugerimos llegar con unos minutos de anticipación. Si necesitás ver indicaciones del local o gestionar tu cita, podés acceder a tu sección de turnos:
    </p>
  `;

  return buildEmailLayout({
    preheader: `Recordatorio: tu turno en ${businessName} para ${serviceName} es hoy a las ${timeFormatted} hs.`,
    badge: '⏰ Recordatorio de Turno',
    title: '¡Tu turno es en 1 hora!',
    subtitle: `Cita en ${businessName} • Hoy ${timeFormatted} hs`,
    contentHtml,
    ctaText: 'Ver mis turnos agendados →',
    ctaUrl: `${frontendUrl}/my-appointments`,
    footerNote:
      'Si necesitás reprogramar o cancelar el turno, hacelo cuanto antes desde la plataforma para liberar el lugar a otro cliente.',
  });
}

/**
 * Plantilla: Solicitud de Negocio Recibida en Revisión
 */
export function getBusinessSubmittedEmailHtml({
  applicantName,
  businessName,
  frontendUrl,
}: {
  applicantName: string;
  businessName: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Hola, ${applicantName} 👋
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Recibimos correctamente la solicitud para registrar tu comercio <strong>${businessName}</strong> en Turnos Ya.
      </p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #0284c7; margin-bottom: 6px;">
        📋 Estado: En revisión por Auditoría Oficial
      </div>
      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
        <strong>Tiempo estimado:</strong> 12 a 24 horas hábiles.<br/>
        El equipo corrobora las redes y canales oficiales ingresados para certificar la veracidad de la ficha antes de publicarla.
      </div>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5;">
      Apenas el proceso de auditoría finalice, recibirás un correo de confirmación y tu negocio quedará publicado en el catálogo público.
    </p>
  `;

  return buildEmailLayout({
    preheader: `Solicitud de alta recibida para ${businessName} en Turnos Ya.`,
    badge: '🏢 Registro Comercial',
    title: '¡Solicitud en Revisión!',
    subtitle: `Comercio: ${businessName}`,
    contentHtml,
    ctaText: 'Ver estado de mi solicitud →',
    ctaUrl: `${frontendUrl}/dashboard`,
  });
}

/**
 * Plantilla: Negocio Aprobado y Activado
 */
export function getBusinessApprovedEmailHtml({
  ownerName,
  businessName,
  frontendUrl,
}: {
  ownerName: string;
  businessName: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        ¡Felicitaciones, ${ownerName}! 🎉
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Nuestro equipo de administración auditó los datos y aprobó el alta oficial de <strong>${businessName}</strong>.
      </p>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px;">
        ✓ Tu comercio ya está activo
      </div>
      <div style="font-size: 13px; color: #15803d; line-height: 1.5;">
        • Tu ficha pública ya se encuentra disponible en el catálogo de Turnos Ya.<br/>
        • Tus clientes pueden reservar turnos, ver tus horarios y seguir tus novedades.<br/>
        • Podés cargar servicios, gestionar tu agenda y enviar promociones desde tu panel.
      </div>
    </div>
  `;

  return buildEmailLayout({
    preheader: `¡Tu negocio "${businessName}" fue aprobado y ya está disponible en Turnos Ya!`,
    badge: '✨ Negocio Verificado',
    title: '¡Tu negocio fue aprobado!',
    subtitle: `"${businessName}" ya está disponible para reservas`,
    contentHtml,
    ctaText: 'Ir a mi Panel de Control →',
    ctaUrl: `${frontendUrl}/dashboard`,
  });
}

/**
 * Plantilla: Negocio Observado
 */
export function getBusinessObservedEmailHtml({
  ownerName,
  businessName,
  reason,
  frontendUrl,
}: {
  ownerName: string;
  businessName: string;
  reason: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Hola, ${ownerName}
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        El equipo de auditoría revisó la solicitud de alta de <strong>${businessName}</strong> y requiere algunas modificaciones o aclaraciones antes de poder habilitarlo.
      </p>
    </div>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
        Motivo de la observación:
      </div>
      <div style="font-size: 14px; color: #b91c1c; line-height: 1.5;">
        ${reason}
      </div>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5;">
      Podés ingresar a tu panel de control para corregir los datos o adjuntar las evidencias solicitadas y reenviar la ficha a revisión.
    </p>
  `;

  return buildEmailLayout({
    preheader: `Observaciones sobre tu solicitud para "${businessName}" en Turnos Ya.`,
    badge: '⚠️ Solicitud Observada',
    title: 'Modificaciones Requeridas',
    subtitle: `Solicitud de "${businessName}"`,
    contentHtml,
    ctaText: 'Corregir y reenviar solicitud →',
    ctaUrl: `${frontendUrl}/dashboard`,
  });
}

/**
 * Plantilla: Negocio Suspendido
 */
export function getBusinessSuspendedEmailHtml({
  ownerName,
  businessName,
  reason,
}: {
  ownerName: string;
  businessName: string;
  reason: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Estimado/a ${ownerName},
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Te informamos que la administración de Turnos Ya ha suspendido temporalmente tu comercio <strong>${businessName}</strong>.
      </p>
    </div>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
        Motivo de la suspensión:
      </div>
      <div style="font-size: 14px; color: #b91c1c; line-height: 1.5;">
        ${reason}
      </div>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5;">
      Durante el período de suspensión, tu negocio no estará visible en el catálogo público ni aceptará nuevas reservas. Si considerás que se trata de un error o deseás regularizar la situación, podés contactar al equipo de soporte.
    </p>
  `;

  return buildEmailLayout({
    preheader: `Aviso importante: El comercio "${businessName}" ha sido suspendido temporalmente.`,
    badge: '⚠️ Aviso de Administración',
    title: 'Comercio Suspendido',
    subtitle: `"${businessName}"`,
    contentHtml,
  });
}

/**
 * Plantilla: Negocio Reactivado
 */
export function getBusinessReactivatedEmailHtml({
  ownerName,
  businessName,
  frontendUrl,
}: {
  ownerName: string;
  businessName: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        ¡Hola de nuevo, ${ownerName}! 👋
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Te confirmamos que tu comercio <strong>${businessName}</strong> ha sido <strong>reactivado</strong> por nuestro equipo de administración.
      </p>
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 6px;">
        ✓ Comercio nuevamente visible
      </div>
      <div style="font-size: 13px; color: #15803d; line-height: 1.5;">
        Tu perfil público vuelve a estar activo en el catálogo y listo para agendar turnos normalmente con tus clientes.
      </div>
    </div>
  `;

  return buildEmailLayout({
    preheader: `¡Tu comercio "${businessName}" ha sido reactivado y vuelve a aceptar turnos!`,
    badge: '✅ Comercio Habilitado',
    title: '¡Comercio Reactivado!',
    subtitle: `"${businessName}" vuelve a estar activo en Turnos Ya`,
    contentHtml,
    ctaText: 'Ir a mi Panel de Control →',
    ctaUrl: `${frontendUrl}/dashboard`,
  });
}

/**
 * Plantilla: Cancelación por Fuerza Mayor
 */
export function getEmergencyCancellationEmailHtml({
  clientName,
  businessName,
  serviceName,
  dateFormatted,
  reason,
  frontendUrl,
}: {
  clientName: string;
  businessName: string;
  serviceName: string;
  dateFormatted: string;
  reason: string;
  frontendUrl: string;
}): string {
  const contentHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Hola, ${clientName}
      </h2>
      <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.6;">
        Te informamos que debido a una situación de fuerza mayor o imprevisto en el local <strong>${businessName}</strong>, tu cita programada ha debido ser cancelada.
      </p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Comercio:</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${businessName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Servicio:</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #0284c7;">${serviceName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Fecha agendada:</td>
          <td align="right" style="padding: 4px 0; font-size: 14px; font-weight: 700; color: #334155;">${dateFormatted}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 10px; padding: 16px 18px; margin: 20px 0;">
      <div style="font-size: 13px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">
        Motivo comunicado por el local:
      </div>
      <div style="font-size: 14px; color: #b91c1c; line-height: 1.5;">
        ${reason}
      </div>
    </div>

    <p style="font-size: 14px; color: #475569; line-height: 1.5;">
      Lamentamos los inconvenientes ocasionados. Ya podés volver a ingresar a la plataforma para reprogramar tu cita en otra fecha u horario disponible.
    </p>
  `;

  return buildEmailLayout({
    preheader: `Aviso urgente: Tu turno en ${businessName} para ${serviceName} ha sido cancelado por imprevistos.`,
    badge: '⚠️ Aviso Urgente de Turno',
    title: 'Cancelación por Fuerza Mayor',
    subtitle: `${businessName} • ${dateFormatted}`,
    contentHtml,
    ctaText: 'Reprogramar mi turno →',
    ctaUrl: `${frontendUrl}/my-appointments`,
  });
}
