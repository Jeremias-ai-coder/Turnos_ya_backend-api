import { Business, BusinessStatus } from '@prisma/client';

export interface CreateBusinessDTO {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  category?: string;
  categoryId?: number;
  logoUrl?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  webhookUrl?: string;

  // Evidencias y Redes Sociales
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  cuit?: string;
}

export interface UpdateBusinessDTO {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  category?: string;
  categoryId?: number;
  logoUrl?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  webhookUrl?: string;

  // Evidencias y Redes Sociales
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  cuit?: string;

  // Estados y Auditoría
  status?: BusinessStatus;
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  reviewedById?: number | null;
}

export interface IBusinessRepository {
  findAll(skip: number, take: number, search?: string, status?: BusinessStatus | 'ALL'): Promise<[any[], number]>;
  findById(id: number): Promise<any | null>;
  findByOwnerId(ownerId: number): Promise<Business[]>;
  create(ownerId: number, data: CreateBusinessDTO): Promise<Business>;
  update(id: number, data: UpdateBusinessDTO): Promise<Business>;
  count(status?: BusinessStatus | 'ALL'): Promise<number>;
}
