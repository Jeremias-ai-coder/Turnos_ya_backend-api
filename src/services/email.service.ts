import nodemailer from 'nodemailer';

const hasEmailConfig = Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);

export const emailTransport = hasEmailConfig
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
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
}) {
  if (!emailTransport || !process.env.EMAIL_FROM) {
    console.warn(
      '[EMAIL] Falta la configuración de Gmail SMTP. Completar EMAIL_HOST, EMAIL_USER, EMAIL_PASS y EMAIL_FROM para activar el envío real.'
    );
    return { sent: false, reason: 'missing-email-config' };
  }

  await emailTransport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  return { sent: true };
}
