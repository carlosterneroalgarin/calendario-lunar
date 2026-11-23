# Calendario lunar

App web instalable (PWA): fases de la luna día a día, días de descanso en luna llena,
superlunas, eclipses y aviso 3 días antes de cada luna llena.

- `luna.js` — cálculos astronómicos (Meeus), compartidos por la página, el service worker y el generador.
- `sw.js` — modo sin conexión y aviso diario (Periodic Background Sync).
- `avisos-luna.ics` — calendario suscribible con los avisos hasta 2035. Regenerar con `node gen-ics.js`.
