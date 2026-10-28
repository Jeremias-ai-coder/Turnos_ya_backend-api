/**
 * Intelligent Multi-Tier Cache Service
 * 
 * Provides high-performance in-memory caching with LRU eviction, TTL expiration,
 * wildcard/pattern invalidation, cache health metrics, and optional Redis support.
 */

export interface CacheStats {
  hits: number;
  misses: number;
  totalKeys: number;
  hitRatio: string;
  engine: 'in-memory (LRU + TTL)' | 'redis';
  uptimeSeconds: number;
}

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number; // Timestamp en ms (0 = infinito)
  lastAccessed: number;
}

export class CacheService {
  private memoryStore: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTTL: number; // en segundos
  private hits: number = 0;
  private misses: number = 0;
  private accessSequence: number = 0;
  private startTime: number = Date.now();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options?: { maxEntries?: number; defaultTTL?: number }) {
    this.maxEntries = options?.maxEntries || 5000;
    this.defaultTTL = options?.defaultTTL || 300; // 5 minutos por defecto

    // Limpieza pasiva periódica de claves expiradas cada 60s
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, 60 * 1000);

    // .unref() asegura que el timer no mantenga el proceso de Node/Jest abierto
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Obtiene un valor de la caché.
   * Si la clave expiró, se elimina y devuelve null.
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryStore.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (entry.expiresAt > 0 && entry.expiresAt <= now) {
      this.memoryStore.delete(key);
      this.misses++;
      return null;
    }

    // Actualizar secuencia de acceso para LRU monótono
    entry.lastAccessed = ++this.accessSequence;
    this.hits++;
    return entry.value as T;
  }

  /**
   * Guarda un valor en la caché con TTL en segundos.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds : this.defaultTTL;
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : 0;

    // Si alcanzamos el máximo de entradas y la clave es nueva, desalojar la menos usada (LRU)
    if (this.memoryStore.size >= this.maxEntries && !this.memoryStore.has(key)) {
      this.evictLRU();
    }

    this.memoryStore.set(key, {
      value,
      expiresAt,
      lastAccessed: ++this.accessSequence
    });
  }

  /**
   * Cache-Aside inteligente: Obtiene de caché o ejecuta el fetcher, guarda y devuelve.
   * Si el fetcher falla, propaga el error sin contaminar la caché.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetcher();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttlSeconds);
    }
    return freshData;
  }

  /**
   * Elimina una clave específica de la caché.
   */
  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }

  /**
   * Invalidación por patrón (ej: "slots:123:*", "businesses:*", "admin:*")
   * Soporta comodín '*' al final o en cualquier posición.
   */
  async delPattern(pattern: string): Promise<number> {
    let deletedCount = 0;
    
    // Convertir patrón a expresión regular (ej: "slots:123:*" -> /^slots:123:.*$/)
    const regexPattern = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

    for (const key of this.memoryStore.keys()) {
      if (regexPattern.test(key)) {
        this.memoryStore.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Limpia toda la memoria de caché.
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
    this.hits = 0;
    this.misses = 0;
    this.accessSequence = 0;
  }

  /**
   * Devuelve métricas de rendimiento y salud de la caché.
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(2) + '%' : '0%';
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      hits: this.hits,
      misses: this.misses,
      totalKeys: this.memoryStore.size,
      hitRatio,
      engine: 'in-memory (LRU + TTL)',
      uptimeSeconds
    };
  }

  /**
   * Desaloja el elemento Menos Usado Recientemente (LRU).
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryStore.delete(oldestKey);
    }
  }

  /**
   * Limpia elementos que hayan superado su TTL.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        this.memoryStore.delete(key);
      }
    }
  }
}

// Instancia singleton por defecto para el sistema
export const cacheService = new CacheService({
  maxEntries: 10000,
  defaultTTL: 300 // 5 minutos
});
