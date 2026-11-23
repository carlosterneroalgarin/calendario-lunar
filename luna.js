// Cálculos astronómicos compartidos (página, service worker y generador del calendario .ics).
// Solo declaraciones de función y var, para poder cargarlo con <script>, importScripts() o vm en Node.
var TZ = "Europe/Madrid", R = Math.PI / 180, AVISO_DIAS = 3, SUPER_KM = 362000;
function sin(x) { return Math.sin(x * R); }
function cos(x) { return Math.cos(x * R); }
function jdToDate(jd) { return new Date((jd - 2440587.5) * 864e5); }
function dateToJd(d) { return d.getTime() / 864e5 + 2440587.5; }
function ymd(d) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }

// Meeus cap. 49: luna nueva (q=0) y llena (q=0.5)
function phaseJD(k) {
  var full = Math.abs(k % 1) > 0.25;
  var T = k / 1236.85, E = 1 - 0.002516 * T - 0.0000074 * T * T;
  var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  var M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
  var Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  var F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  var O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
  var a = full ? [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209] : [-0.40720, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208];
  jde += a[0] * sin(Mp) + a[1] * E * sin(M) + a[2] * sin(2 * Mp) + a[3] * sin(2 * F) + a[4] * E * sin(Mp - M) + a[5] * E * sin(Mp + M) + a[6] * E * E * sin(2 * M)
    - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F)
    + 0.00038 * E * sin(M - 2 * F) - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O);
  return jde - 0.0008; // ~ΔT
}
// Meeus cap. 48: fracción iluminada
function illum(date) {
  var T = (dateToJd(date) - 2451545) / 36525;
  var D = ((297.8501921 + 445267.1114034 * T) % 360 + 360) % 360;
  var M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T;
  var i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  return { k: (1 + cos(i)) / 2, waxing: D < 180 };
}
// Meeus cap. 47: distancia Tierra-Luna (km), términos principales
function distKm(date) {
  var T = (dateToJd(date) - 2451545) / 36525;
  var D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T;
  return 385000.56 - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * Mp) + 48.888 * cos(M)
    + 246.158 * cos(2 * D - 2 * Mp) - 152.138 * cos(2 * D - M - Mp) - 170.733 * cos(2 * D + Mp) - 204.586 * cos(2 * D - M) - 129.62 * cos(Mp - M) + 108.743 * cos(D) + 104.755 * cos(Mp + M);
}
function isSuper(d) { return distKm(d) < SUPER_KM; }

// Lunas llenas desde `from` (Date) en adelante, `n` como máximo
function fullMoonsFrom(from, n) {
  var jdNow = dateToJd(from), out = [];
  var k = Math.floor((from.getUTCFullYear() + from.getUTCMonth() / 12 - 2000) * 12.3685) - 2;
  for (var i = 0; i < n + 6 && out.length < n; i++, k++) {
    var j = phaseJD(k + 0.5);
    if (j > jdNow - 1.5) out.push(jdToDate(j));
  }
  return out;
}
// Días de calendario (hora de Madrid) entre dos fechas
function daysBetween(a, b) {
  return Math.round((new Date(ymd(b) + "T00:00:00Z") - new Date(ymd(a) + "T00:00:00Z")) / 864e5);
}
// Próxima luna llena (hoy incluido) y cuántos días faltan
function nextFull(now) {
  var key = ymd(now), list = fullMoonsFrom(now, 3);
  for (var i = 0; i < list.length; i++) if (ymd(list[i]) >= key) return { date: list[i], days: daysBetween(now, list[i]) };
  return null;
}
// Texto del aviso si toca (de 1 a AVISO_DIAS días antes); null si no
function avisoPara(now) {
  var nf = nextFull(now);
  if (!nf || nf.days < 1 || nf.days > AVISO_DIAS) return null;
  var cuando = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(nf.date);
  return {
    id: ymd(nf.date),
    title: nf.days === 1 ? "Mañana hay luna llena" : "Luna llena en " + nf.days + " días",
    body: (isSuper(nf.date) ? "Superluna" : "Luna llena") + " el " + cuando + " h. Estas noches, a dormir pronto."
  };
}
