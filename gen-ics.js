// Genera avisos-luna.ics: un aviso a las 10:00 (hora de Madrid) 3 días antes de cada luna llena.
// Uso: node gen-ics.js   (volver a ejecutar y subir antes de 2035)
const fs = require("fs"), vm = require("vm"), path = require("path");
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "luna.js"), "utf8"));

const DESDE = new Date(Date.UTC(2026, 10, 1)), HASTA = "2035-12-31";
const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const fold = line => {
  const out = []; let buf = "", len = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (len + b > (out.length ? 74 : 75)) { out.push(buf); buf = ""; len = 0; }
    buf += ch; len += b;
  }
  out.push(buf);
  return out.join("\r\n ");
};
const fmtCuando = d => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

const L = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Calendario lunar//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:Avisos luna", "X-WR-TIMEZONE:Europe/Madrid",
  "X-WR-CALDESC:Aviso 3 días antes de cada luna llena para dormir pronto",
  "REFRESH-INTERVAL;VALUE=DURATION:P7D", "X-PUBLISHED-TTL:P7D",
  "BEGIN:VTIMEZONE", "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE"
];

let n = 0;
for (const fd of fullMoonsFrom(DESDE, 200)) {
  const key = ymd(fd);
  if (key > HASTA) break;
  const [y, m, d] = key.split("-").map(Number);
  const av = new Date(Date.UTC(y, m - 1, d - AVISO_DIAS)).toISOString().slice(0, 10).replace(/-/g, "");
  const tipo = isSuper(fd) ? "Superluna" : "Luna llena";
  L.push(
    "BEGIN:VEVENT",
    "UID:luna-" + key.replace(/-/g, "") + "@calendario-lunar",
    "DTSTAMP:" + stamp,
    "DTSTART;TZID=Europe/Madrid:" + av + "T100000",
    "DTEND;TZID=Europe/Madrid:" + av + "T101500",
    fold("SUMMARY:" + esc("🌕 " + tipo + " en 3 días · dormir pronto")),
    fold("DESCRIPTION:" + esc(tipo + " el " + fmtCuando(fd) + " h (hora de España).\nEstas 3 noches se duerme peor: acuéstate pronto.\nEl día de luna llena toca descanso.")),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", fold("DESCRIPTION:" + esc(tipo + " en 3 días")), "TRIGGER:PT0S", "END:VALARM",
    "END:VEVENT"
  );
  n++;
}
L.push("END:VCALENDAR");
fs.writeFileSync(path.join(__dirname, "avisos-luna.ics"), L.join("\r\n") + "\r\n");
console.log("avisos-luna.ics:", n, "avisos");
