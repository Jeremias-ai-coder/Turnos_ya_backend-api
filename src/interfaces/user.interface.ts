import { User, Role } from '@prisma/client';

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: Role;
  phone?: string;
  emailVerified?: boolean;
}

export interface UpdateUserDTO {
  name?: string;
  phone?: string;
  emailVerified?: boolean;
  emailNotifications?: boolean;
  whatsappNotifications?: boolean;
  role?: Role;
  password?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorBackupCodes?: string | null;
  tempTwoFactorSecret?: string | null;
}

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: number, data: UpdateUserDTO): Promise<User>;
  delete(id: number): Promise<User>;
  findAll(): Promise<any[]>;
  count(role?: Role): Promise<number>;
}
