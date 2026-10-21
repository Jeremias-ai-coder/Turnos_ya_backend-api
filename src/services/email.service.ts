import nodemailer from 'nodemailer';

const hasEmailConfig = Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);

const isGmail = (process.env.EMAIL_HOST || '').toLowerCase().includes('gmail');

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
  const transport = getEmailTransport();
  const fromAddress = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `Turnos Ya <${process.env.EMAIL_USER}>` : '');

  if (!transport || !fromAddress) {
    console.warn(
      '[EMAIL] Falta la configuración de Gmail SMTP. Completar EMAIL_HOST, EMAIL_USER y EMAIL_PASS para activar el envío real.'
    );
    return { sent: false, reason: 'missing-email-config' };
  }

  try {
    await transport.sendMail({
      from: fromAddress,
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

