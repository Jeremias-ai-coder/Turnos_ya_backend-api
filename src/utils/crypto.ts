// =========================================================================================
// MÓDULO CRIPTOGRÁFICO DE SEGURIDAD (AES-256-GCM)
// Propósito: Cifrado simétrico autenticado para proteger secretos de 2FA TOTP y Códigos de Respaldo.
// Por qué AES-256-GCM:
//  1. Confidencialidad: Cifra con clave de 256 bits derivada de SHA-256.
//  2. Autenticidad e Integridad (AEAD): El Auth Tag de 16 bytes garantiza que si alguien
//     manipula el secreto cifrado en la base de datos, el desencriptador lo detecta y falla.
//  3. Vector de Inicialización (IV) de 12 bytes (96 bits): Criptográficamente aleatorio en cada llamada,
//     garantizando que dos cifrados del mismo texto produzcan salidas completamente diferentes.
// =========================================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.JWT_SECRET || 'turnos_ya_super_secret_2fa_key')
  .digest();

/**
 * Cifra el secreto TOTP utilizando AES-256-GCM para asegurar que no se almacene en texto plano en la base de datos.
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Formato estándar: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra el secreto TOTP comprobando la autenticidad con la etiqueta GCM.
 */
export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de secreto cifrado inválido');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
