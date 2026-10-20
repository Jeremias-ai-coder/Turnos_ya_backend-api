/**
 * Utilidad Keep-Alive para evitar que plataformas como Render entren en modo reposo (cold sleep)
 * durante fases de QA o pruebas activas.
 */
export const startKeepAlive = (intervalMinutes = 10): NodeJS.Timeout | null => {
  // Render inyecta automáticamente RENDER_EXTERNAL_URL (ej: https://turnos-ya-backend.onrender.com)
  const targetUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

  if (!targetUrl) {
    return null;
  }

  const cleanUrl = targetUrl.replace(/\/+$/, '');
  const healthEndpoint = `${cleanUrl}/health`;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[KeepAlive] Activado. Enviando auto-ping a ${healthEndpoint} cada ${intervalMinutes} minutos.`);

  const timer = setInterval(async () => {
    try {
      const response = await fetch(healthEndpoint);
      if (response.ok) {
        console.log(`[KeepAlive] Auto-ping exitoso a ${healthEndpoint} - Status: ${response.status}`);
      } else {
        console.warn(`[KeepAlive] Auto-ping a ${healthEndpoint} respondió con status ${response.status}`);
      }
    } catch (err: any) {
      console.error(`[KeepAlive] Error enviando auto-ping:`, err.message || err);
    }
  }, intervalMs);

  // Evita que el timer impida que el proceso termine limpiamente si se detiene
  if (timer.unref) {
    timer.unref();
  }

  return timer;
};
