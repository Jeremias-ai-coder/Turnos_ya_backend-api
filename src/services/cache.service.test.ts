/// <reference types="jest" />
import { CacheService } from './cache.service';

describe('CacheService (Unit Tests)', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({ maxEntries: 3, defaultTTL: 2 });
  });

  it('debe guardar y recuperar un valor correctamente', async () => {
    await cache.set('clave1', { nombre: 'Comercio A' }, 10);
    const result = await cache.get<any>('clave1');

    expect(result).toEqual({ nombre: 'Comercio A' });
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);
    expect(stats.totalKeys).toBe(1);
  });

  it('debe devolver null y contar un miss si la clave no existe', async () => {
    const result = await cache.get('inexistente');
    expect(result).toBeNull();
    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it('debe expirar la clave cuando transcurre el TTL', async () => {
    // TTL de 1 segundo
    await cache.set('temporal', 'dato_sensible', 1);

    // Inmediatamente está disponible
    expect(await cache.get('temporal')).toBe('dato_sensible');

    // Simular paso del tiempo adelantando 1100ms
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Ahora debe estar expirado
    const expired = await cache.get('temporal');
    expect(expired).toBeNull();
  });

  it('debe implementar Cache-Aside con getOrSet sin ejecutar el fetcher si ya está en caché', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 1, name: 'Peluquería' });

    // Primera llamada: ejecuta fetcher y guarda
    const res1 = await cache.getOrSet('biz:1', fetcher, 60);
    expect(res1).toEqual({ id: 1, name: 'Peluquería' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Segunda llamada: recupera de caché sin llamar al fetcher
    const res2 = await cache.getOrSet('biz:1', fetcher, 60);
    expect(res2).toEqual({ id: 1, name: 'Peluquería' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
  });

  it('debe desalojar según política LRU cuando se excede la capacidad máxima', async () => {
    // maxEntries configurado en 3
    await cache.set('k1', 'val1');
    await cache.set('k2', 'val2');
    await cache.set('k3', 'val3');

    // Accedemos a k1 para que sea más reciente que k2
    await cache.get('k1');

    // Insertamos k4: debe desalojar la menos usada recientemente (k2)
    await cache.set('k4', 'val4');

    expect(await cache.get('k2')).toBeNull(); // k2 fue desalojada por LRU
    expect(await cache.get('k1')).toBe('val1'); // k1 se preservó porque fue accedida
    expect(await cache.get('k3')).toBe('val3');
    expect(await cache.get('k4')).toBe('val4');
  });

  it('debe invalidar claves por patrón con delPattern (*)', async () => {
    const wideCache = new CacheService({ maxEntries: 10, defaultTTL: 60 });
    await wideCache.set('slots:biz1:2026-10-28', ['10:00', '11:00']);
    await wideCache.set('slots:biz1:2026-10-29', ['12:00']);
    await wideCache.set('slots:biz2:2026-10-28', ['14:00']);
    await wideCache.set('business:detail:1', { id: 1 });

    const deleted = await wideCache.delPattern('slots:biz1:*');
    expect(deleted).toBe(2);

    expect(await wideCache.get('slots:biz1:2026-10-28')).toBeNull();
    expect(await wideCache.get('slots:biz1:2026-10-29')).toBeNull();
    expect(await wideCache.get('slots:biz2:2026-10-28')).not.toBeNull();
    expect(await wideCache.get('business:detail:1')).not.toBeNull();
  });

  it('debe limpiar toda la caché y resetear estadísticas con clear()', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.get('a');

    await cache.clear();

    const stats = cache.getStats();
    expect(stats.totalKeys).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(await cache.get('a')).toBeNull();
  });
});
