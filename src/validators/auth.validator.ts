import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido y debe ser mayor a 2 caracteres'),
  email: z.string().email('Debe ser un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['client', 'owner', 'administrator']).default('client')
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
  credential: z.string().optional(),
  accessToken: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  googleId: z.string().optional()
}).refine(data => data.credential || data.accessToken || (data.email && data.name), {
  message: 'Debe enviar una credencial o token de acceso de Google válido o los datos de usuario'
});

