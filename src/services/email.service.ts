import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getEmailTransport() {
  const hasEmailConfig = Boolean(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS
  );

  if (!hasEmailConfig) return null;

  const isGmail = (process.env.EMAIL_HOST || '').toLowerCase().includes('gmail');

  return nodemailer.createTransport({
    ...(isGmail
      ? { service: 'gmail' }
      : {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: Number(process.env.EMAIL_PORT) === 465,
        }),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS?.replace(/\s+/g, ''),
    },
    connectionTimeout: 8000,
    greetingTimeout: 6000,
    socketTimeout: 10000,
  });
}

export const emailTransport = getEmailTransport();

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string; error?: string }> {
  // 0. En entorno de tests automáticos (Jest), no enviar correos reales
  if (process.env.NODE_ENV === 'test') {
    return { sent: true };
  }

  // 1. Envío prioritario vía Resend API (HTTPS Port 443 - Totalmente compatible con Render Free)
  const resend = getResendClient();
  if (resend) {
    try {
      // Determinación inteligente del remitente para Resend:
      // Resend requiere un dominio verificado propio o el dominio de onboarding gratuito 'onboarding@resend.dev'
      let fromAddress = process.env.RESEND_FROM?.trim();
      if (!fromAddress) {
        const emailFrom = process.env.EMAIL_FROM?.trim() || '';
        // Si EMAIL_FROM usa dominio público (gmail, yahoo, etc.), Resend lo rechaza; usamos onboarding@resend.dev
        if (!emailFrom || /@(gmail|hotmail|yahoo|outlook)\./i.test(emailFrom)) {
          fromAddress = 'Turnos Ya <onboarding@resend.dev>';
        } else {
          fromAddress = emailFrom;
        }
      }

      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html,
      });

      if (error) {
        console.error('[EMAIL-RESEND] Error retornado por Resend API:', error.message || error);
        // Si Resend falla, continuará abajo hacia el fallback si existe SMTP
      } else {
        console.log(`[EMAIL-RESEND] ✔ Correo enviado exitosamente a: ${to} (ID: ${data?.id})`);
        return { sent: true };
      }
    } catch (err: any) {
      console.error('[EMAIL-RESEND] Excepción al invocar Resend:', err?.message || err);
    }
  }

  // 2. Fallback tradicional SMTP (Nodemailer)
  const transport = getEmailTransport();
  const fromAddress = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `Turnos Ya <${process.env.EMAIL_USER}>` : '');

  if (!transport || !fromAddress) {
    if (!resend) {
      console.warn(
        '[EMAIL] No hay proveedor de correo configurado. Agregá RESEND_API_KEY (Recomendado para Render) o EMAIL_HOST/USER/PASS.'
      );
      return { sent: false, reason: 'missing-email-config' };
    }
    return { sent: false, error: 'Resend falló y no hay transporte SMTP de respaldo disponible.' };
  }

  try {
    await transport.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL-SMTP] ✔ Correo enviado exitosamente a: ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[EMAIL-SMTP] Falló el envío de correo a ${to}:`, err?.message || err);
    return { sent: false, error: err?.message || 'Error al conectar con servidor SMTP' };
  }
}
