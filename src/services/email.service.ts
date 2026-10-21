import nodemailer from 'nodemailer';

const hasEmailConfig = Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);

const isGmail = (process.env.EMAIL_HOST || '').toLowerCase().includes('gmail');

export const emailTransport = hasEmailConfig
  ? nodemailer.createTransport({
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
      connectionTimeout: 6000, // 6 segundos máx de espera para conectar, evita colgar el backend
      greetingTimeout: 5000,
      socketTimeout: 8000,
    })
  : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string; error?: string }> {
  if (!emailTransport || !process.env.EMAIL_FROM) {
    console.warn(
      '[EMAIL] Falta la configuración de Gmail SMTP. Completar EMAIL_HOST, EMAIL_USER, EMAIL_PASS y EMAIL_FROM para activar el envío real.'
    );
    return { sent: false, reason: 'missing-email-config' };
  }

  try {
    await emailTransport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Correo enviado exitosamente a: ${to}`);
    return { sent: true };
  } catch (err: any) {
    console.error(`[EMAIL] Falló el envío de correo a ${to}:`, err?.message || err);
    return { sent: false, error: err?.message || 'Error al conectar con servidor SMTP' };
  }
}

