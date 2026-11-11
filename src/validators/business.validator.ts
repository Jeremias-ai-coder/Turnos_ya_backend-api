import { z } from 'zod';

const safeHttpUrl = z
  .string()
  .trim()
  .refine(
    (val) => !val || /^https?:\/\//i.test(val),
    'La URL debe comenzar con http:// o https://'
  )
  .optional()
  .nullable()
  .or(z.literal(''));

const safeLogoUrl = z
  .string()
  .trim()
  .refine(
    (val) => !val || /^https?:\/\//i.test(val) || /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(val),
    'El logo debe ser una URL http(s):// o una imagen válida'
  )
  .optional()
  .nullable()
  .or(z.literal(''));

export const createBusinessSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional().nullable(),
  address: z.string().min(3, 'La dirección es requerida'),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  phone: z.string().min(6, 'El teléfono de contacto es requerido'),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  category: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  logoUrl: safeLogoUrl,
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  timezone: z.string().optional().nullable(),
  webhookUrl: safeHttpUrl,

  // Evidencias de veracidad y redes sociales
  instagramUrl: safeHttpUrl,
  facebookUrl: safeHttpUrl,
  websiteUrl: safeHttpUrl,
  googleMapsUrl: safeHttpUrl,
  cuit: z.string().optional().nullable().or(z.literal('')),
});

export const updateBusinessSchema = createBusinessSchema.partial().extend({
  status: z.enum(['pending_approval', 'approved', 'rejected', 'suspended']).optional(),
  rejectionReason: z.string().optional().nullable()
});

export const rejectBusinessSchema = z.object({
  reason: z.string().min(5, 'El motivo de rechazo debe contener al menos 5 caracteres')
});
