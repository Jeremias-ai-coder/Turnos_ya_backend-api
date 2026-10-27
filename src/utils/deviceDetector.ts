/**
 * Utilidad para detectar el nombre legible del dispositivo/navegador a partir del User-Agent
 */
export function parseDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Dispositivo desconocido';

  const ua = userAgent.toLowerCase();

  // 1. Detección de App Móvil o Clientes de API
  if (ua.includes('okhttp') || ua.includes('expo') || ua.includes('turnos-ya-mobile') || ua.includes('dart')) {
    if (ua.includes('android')) return 'App Móvil Turnos Ya (Android)';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('darwin')) return 'App Móvil Turnos Ya (iOS)';
    return 'App Móvil Turnos Ya';
  }

  // 2. Sistema Operativo
  let os = 'Dispositivo';
  if (ua.includes('windows nt 10.0') || ua.includes('windows nt 11.0') || ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone')) {
    os = 'iPhone (iOS)';
  } else if (ua.includes('ipad')) {
    os = 'iPad (iPadOS)';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // 3. Navegador
  let browser = 'Navegador Web';
  if (ua.includes('edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('chrome/') || ua.includes('crios/')) {
    browser = 'Google Chrome';
  } else if (ua.includes('firefox/') || ua.includes('fxios/')) {
    browser = 'Mozilla Firefox';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('opr/') || ua.includes('opera/')) {
    browser = 'Opera';
  }

  return `${browser} en ${os}`;
}
