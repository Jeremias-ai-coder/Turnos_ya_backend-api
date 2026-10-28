/**
 * Script Profesional de Pruebas de Estrés y Benchmarking para Turnos Ya API
 * 
 * Evalúa:
 * - Rendimiento con Caché Fría vs Caché Caliente
 * - Capacidad de concurrencia y tolerancia a carga (RPS, latencia p50, p95, p99)
 * - Tasa de éxito (2xx vs fallos)
 * - Impacto del sistema de Caché Inteligente
 * 
 * Uso: npx tsx scripts/stress-test.ts [BASE_URL]
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

interface BenchResult {
  name: string;
  totalRequests: number;
  concurrency: number;
  durationMs: number;
  rps: number;
  successCount: number;
  errorCount: number;
  latencies: number[];
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

// Helper para calcular percentiles
function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// Ejecuta un lote concurrente de peticiones
async function runLoadBatch(
  name: string,
  url: string,
  totalRequests: number,
  concurrency: number,
  headers: Record<string, string> = {}
): Promise<BenchResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  let executedCount = 0;

  const startTime = performance.now();

  async function worker() {
    while (executedCount < totalRequests) {
      executedCount++;
      const reqStart = performance.now();
      try {
        const res = await fetch(url, { headers });
        const reqEnd = performance.now();
        const latency = reqEnd - reqStart;
        latencies.push(latency);

        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        const reqEnd = performance.now();
        latencies.push(reqEnd - reqStart);
        errorCount++;
      }
    }
  }

  // Lanzar pool concurrente de trabajadores
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const durationMs = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  const sum = latencies.reduce((acc, curr) => acc + curr, 0);
  const avgLatency = latencies.length > 0 ? sum / latencies.length : 0;
  const rps = (totalRequests / (durationMs / 1000));

  return {
    name,
    totalRequests,
    concurrency,
    durationMs,
    rps,
    successCount,
    errorCount,
    latencies,
    avgLatency,
    p50: getPercentile(latencies, 50),
    p95: getPercentile(latencies, 95),
    p99: getPercentile(latencies, 99),
    min: latencies[0] || 0,
    max: latencies[latencies.length - 1] || 0
  };
}

// Imprime resultados formateados
function printBenchResult(r: BenchResult) {
  console.log(`\n======================================================`);
  console.log(`🎯 PRUEBA: ${r.name}`);
  console.log(`======================================================`);
  console.log(`  • Peticiones Totales : ${r.totalRequests}`);
  console.log(`  • Concurrencia       : ${r.concurrency} clientes simultáneos`);
  console.log(`  • Tiempo Total       : ${(r.durationMs / 1000).toFixed(2)} segundos`);
  console.log(`  • Rendimiento (RPS)  : ${r.rps.toFixed(1)} req/segundo ⚡`);
  console.log(`  • Tasa de Éxito      : ${((r.successCount / r.totalRequests) * 100).toFixed(1)}% (${r.successCount} OK, ${r.errorCount} errores)`);
  console.log(`  ----------------------------------------------------`);
  console.log(`  📊 DISTRIBUCIÓN DE LATENCIA:`);
  console.log(`     - Promedio (Avg)  : ${r.avgLatency.toFixed(2)} ms`);
  console.log(`     - Mínima (Min)    : ${r.min.toFixed(2)} ms`);
  console.log(`     - Mediana (P50)   : ${r.p50.toFixed(2)} ms`);
  console.log(`     - Percentil 95    : ${r.p95.toFixed(2)} ms`);
  console.log(`     - Percentil 99    : ${r.p99.toFixed(2)} ms`);
  console.log(`     - Máxima (Max)    : ${r.max.toFixed(2)} ms`);
  console.log(`======================================================\n`);
}

async function main() {
  console.log(`\n🚀 INICIANDO SUITE DE PRUEBAS DE ESTRÉS PARA TURNOS YA API`);
  console.log(`Target: ${BASE_URL}\n`);

  // 1. Healthcheck preliminar
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) {
      console.error(`❌ El servidor en ${BASE_URL} no respondió adecuadamente en /health`);
      process.exit(1);
    }
    console.log(`✅ Servidor en línea y saludable. Iniciando pruebas...\n`);
  } catch (err: any) {
    console.error(`❌ No se pudo conectar con el servidor en ${BASE_URL}:`, err.message);
    process.exit(1);
  }

  // =========================================================================
  // FASE 1: COMPARACIÓN EN VIVO: CACHÉ FRÍA vs CACHÉ CALIENTE
  // =========================================================================
  console.log(`\n🔬 [FASE 1] Midiendo Impacto de la Caché (Cold DB Hit vs Warm Memory)...`);

  const uniqueSearch = `bench_${Date.now()}`;

  // Petición 1: Fría (obliga a consultar base de datos por primera vez)
  const coldStart = performance.now();
  await fetch(`${BASE_URL}/api/v1/businesses?search=${uniqueSearch}`);
  const coldDuration = performance.now() - coldStart;

  // Petición 2: Caliente (servida inmediatamente desde la caché LRU en memoria)
  const warmStart = performance.now();
  await fetch(`${BASE_URL}/api/v1/businesses?search=${uniqueSearch}`);
  const warmDuration = performance.now() - warmStart;

  const speedup = (coldDuration / Math.max(warmDuration, 0.1)).toFixed(1);
  console.log(`   🧊 Caché Fría (Primer golpe / Base de Datos) : ${coldDuration.toFixed(2)} ms`);
  console.log(`   🔥 Caché Caliente (Memoria LRU en Servidor) : ${warmDuration.toFixed(2)} ms`);
  console.log(`   ⚡ Factor de aceleración                    : ${speedup}x más rápido con caché inteligente\n`);

  // =========================================================================
  // FASE 2: ESTRÉS EN CATÁLOGO DE CATEGORÍAS (1.000 peticiones, 50 concurrentes)
  // =========================================================================
  console.log(`🔥 [FASE 2] Prueba de Estrés: Catálogo de Categorías (/categories)`);
  console.log(`   Enviando 1.000 peticiones con 50 clientes concurrentes...`);
  const resCat = await runLoadBatch(
    'GET /api/v1/categories (1.000 reqs @ 50 concurrencia)',
    `${BASE_URL}/api/v1/categories`,
    1000,
    50
  );
  printBenchResult(resCat);

  // =========================================================================
  // FASE 3: ESTRÉS EN LISTADO DE COMERCIOS (/businesses)
  // =========================================================================
  console.log(`🔥 [FASE 3] Prueba de Estrés: Listado de Comercios (/businesses)`);
  console.log(`   Enviando 500 peticiones con 25 clientes concurrentes...`);
  const resBiz = await runLoadBatch(
    'GET /api/v1/businesses (500 reqs @ 25 concurrencia)',
    `${BASE_URL}/api/v1/businesses`,
    500,
    25
  );
  printBenchResult(resBiz);

  // Obtener un ID de negocio real existente en la base de datos
  let validBizId = 1;
  try {
    const bizListRes = await fetch(`${BASE_URL}/api/v1/businesses`);
    const bizJson = await bizListRes.json();
    if (bizJson?.data?.[0]?.id) {
      validBizId = bizJson.data[0].id;
    }
  } catch {}

  // =========================================================================
  // FASE 4: ESTRÉS EN CÁLCULO DE DISPONIBILIDAD DE SLOTS (/busy-slots)
  // =========================================================================
  console.log(`🔥 [FASE 4] Prueba de Estrés: Horarios Ocupados y Disponibilidad (/busy-slots)`);
  console.log(`   Enviando 500 peticiones con 25 clientes concurrentes (Negocio #${validBizId})...`);
  const resSlots = await runLoadBatch(
    `GET /api/v1/businesses/${validBizId}/busy-slots (500 reqs @ 25 concurrencia)`,
    `${BASE_URL}/api/v1/businesses/${validBizId}/busy-slots?date=2026-10-28`,
    500,
    25
  );
  printBenchResult(resSlots);

  // =========================================================================
  // FASE 5: ESTRÉS EXTREMO CON TRÁFICO MIXTO REALISTA (100 CONCURRENTES)
  // =========================================================================
  console.log(`⚡ [FASE 5] PRUEBA DE ESTRÉS EXTREMO: Tráfico Mixto Simultáneo`);
  console.log(`   Simulando 100 usuarios activos navegando catálogo, comercios y turnos en paralelo...`);
  console.log(`   Enviando 2.000 peticiones con 100 clientes concurrentes...`);

  const endpoints = [
    `${BASE_URL}/api/v1/categories`,
    `${BASE_URL}/api/v1/businesses`,
    `${BASE_URL}/api/v1/businesses/${validBizId}`,
    `${BASE_URL}/api/v1/businesses/${validBizId}/busy-slots?date=2026-10-28`,
    `${BASE_URL}/health`,
  ];

  const mixedLatencies: number[] = [];
  let mixedSuccess = 0;
  let mixedErrors = 0;
  let mixedExecuted = 0;
  const TOTAL_MIXED = 2000;
  const CONCURRENCY_MIXED = 100;

  const mixedStart = performance.now();

  async function mixedWorker() {
    while (mixedExecuted < TOTAL_MIXED) {
      mixedExecuted++;
      const url = endpoints[Math.floor(Math.random() * endpoints.length)];
      const reqStart = performance.now();
      try {
        const res = await fetch(url);
        const reqEnd = performance.now();
        mixedLatencies.push(reqEnd - reqStart);
        if (res.ok) mixedSuccess++;
        else mixedErrors++;
      } catch {
        mixedLatencies.push(performance.now() - reqStart);
        mixedErrors++;
      }
    }
  }

  const mixedWorkers = Array.from({ length: CONCURRENCY_MIXED }, () => mixedWorker());
  await Promise.all(mixedWorkers);

  const mixedDuration = performance.now() - mixedStart;
  mixedLatencies.sort((a, b) => a - b);
  const mixedSum = mixedLatencies.reduce((acc, curr) => acc + curr, 0);
  const mixedAvg = mixedLatencies.length > 0 ? mixedSum / mixedLatencies.length : 0;
  const mixedRps = TOTAL_MIXED / (mixedDuration / 1000);

  const resMixed: BenchResult = {
    name: 'TRÁFICO MIXTO EXTREMO (2.000 reqs @ 100 concurrencia)',
    totalRequests: TOTAL_MIXED,
    concurrency: CONCURRENCY_MIXED,
    durationMs: mixedDuration,
    rps: mixedRps,
    successCount: mixedSuccess,
    errorCount: mixedErrors,
    latencies: mixedLatencies,
    avgLatency: mixedAvg,
    p50: getPercentile(mixedLatencies, 50),
    p95: getPercentile(mixedLatencies, 95),
    p99: getPercentile(mixedLatencies, 99),
    min: mixedLatencies[0] || 0,
    max: mixedLatencies[mixedLatencies.length - 1] || 0
  };
  printBenchResult(resMixed);

  // =========================================================================
  // RESUMEN EJECUTIVO FINAL
  // =========================================================================
  console.log(`\n🏁 RESUMEN EJECUTIVO DE LA PRUEBA DE ESTRÉS:`);
  console.log(`=========================================================================================`);
  console.log(` Endpoint / Escenario         | Reqs | Concurrencia | RPS       | Latencia Prom | Éxito`);
  console.log(`------------------------------|------|--------------|-----------|---------------|--------`);
  console.log(` /api/v1/categories           | 1000 | 50           | ${resCat.rps.toFixed(1).padStart(7)}/s | ${resCat.avgLatency.toFixed(1).padStart(11)}ms | ${((resCat.successCount / resCat.totalRequests) * 100).toFixed(0)}%`);
  console.log(` /api/v1/businesses           |  500 | 25           | ${resBiz.rps.toFixed(1).padStart(7)}/s | ${resBiz.avgLatency.toFixed(1).padStart(11)}ms | ${((resBiz.successCount / resBiz.totalRequests) * 100).toFixed(0)}%`);
  console.log(` /api/v1/businesses/1/slots   |  500 | 25           | ${resSlots.rps.toFixed(1).padStart(7)}/s | ${resSlots.avgLatency.toFixed(1).padStart(11)}ms | ${((resSlots.successCount / resSlots.totalRequests) * 100).toFixed(0)}%`);
  console.log(` TRÁFICO MIXTO CONCURRENTE    | 2000 | 100          | ${resMixed.rps.toFixed(1).padStart(7)}/s | ${resMixed.avgLatency.toFixed(1).padStart(11)}ms | ${((resMixed.successCount / resMixed.totalRequests) * 100).toFixed(0)}%`);
  console.log(`=========================================================================================\n`);
}

main().catch((err) => {
  console.error('Error fatal durante la prueba de estrés:', err);
  process.exit(1);
});
