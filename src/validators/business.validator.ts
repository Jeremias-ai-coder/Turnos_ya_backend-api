import { z } from 'zod';

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
  logoUrl: z.string().optional().nullable().or(z.literal('')),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  timezone: z.string().optional().nullable(),
  webhookUrl: z.string().optional().nullable().or(z.literal('')),

  // Evidencias de veracidad y redes sociales
  instagramUrl: z.string().optional().nullable().or(z.literal('')),
  facebookUrl: z.string().optional().nullable().or(z.literal('')),
  websiteUrl: z.string().optional().nullable().or(z.literal('')),
  googleMapsUrl: z.string().optional().nullable().or(z.literal('')),
  cuit: z.string().optional().nullable().or(z.literal('')),
});

export const updateBusinessSchema = createBusinessSchema.partial().extend({
  status: z.enum(['pending_approval', 'approved', 'rejected', 'suspended']).optional(),
  rejectionReason: z.string().optional().nullable()
});

export const rejectBusinessSchema = z.object({
  reason: z.string().min(5, 'El motivo de rechazo debe contener al menos 5 caracteres')
});
