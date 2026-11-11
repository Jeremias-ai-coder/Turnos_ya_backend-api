import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido y debe ser mayor a 2 caracteres'),
  email: z.string().email('Debe ser un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['client', 'owner', 'USER', 'BUSINESS_OWNER']).default('client').transform(val => {
    if (val === 'USER') return 'client';
    if (val === 'BUSINESS_OWNER') return 'owner';
    return val;
  }),
  phone: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Debe ser un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Debe ser un correo electrónico válido')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'El token es requerido o inválido'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
});

export const googleAuthSchema = z.object({
  credential: z.string().min(10).optional(),
  accessToken: z.string().min(10).optional(),
}).refine(data => Boolean(data.credential || data.accessToken), {
  message: 'Debe enviar una credencial o token de acceso de Google válido'
});

