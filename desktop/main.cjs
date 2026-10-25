/**
 * Aplicación de escritorio (modo local de pruebas).
 *
 * Arranca el servidor del juego dentro del propio programa, con la base de datos
 * guardada en la carpeta de datos del usuario, y lo muestra en una ventana.
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const TITULO = "Mánager de fútbol · Modo local";
let servidor = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function puertoLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function esperarServidor(url, limiteMs) {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const intentar = () => {
      const peticion = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      peticion.on("error", () => {
        if (Date.now() - inicio > limiteMs) reject(new Error("El servidor del juego no arrancó a tiempo."));
        else setTimeout(intentar, 300);
      });
    };
    intentar();
  });
}

const PANTALLA_CARGA = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${TITULO}</title>
<style>
  body{margin:0;height:100vh;display:grid;place-items:center;background:#f6f5f1;color:#1b1d1a;
       font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .c{text-align:center} .b{width:40px;height:40px;margin:0 auto 16px;border-radius:50%;
       border:4px solid #e3efe6;border-top-color:#1f6b3a;animation:g 1s linear infinite}
  @keyframes g{to{transform:rotate(360deg)}} p{margin:4px 0} .s{color:#6b6f66;font-size:14px}
</style></head><body><div class="c"><div class="b"></div>
<p><strong>Preparando el estadio…</strong></p>
<p class="s">La primera vez tarda unos segundos: se crea la base de datos local.</p>
</div></body></html>`)}`;

async function iniciar() {
  const raiz = app.isPackaged
    ? path.join(process.resourcesPath, "servidor")
    : path.join(__dirname, "..", ".next", "standalone");
  const datos = path.join(app.getPath("userData"), "datos");
  fs.mkdirSync(datos, { recursive: true });
  const registro = fs.createWriteStream(path.join(app.getPath("userData"), "registro.log"), { flags: "w" });

  const ventana = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    title: TITULO,
    backgroundColor: "#f6f5f1",
    autoHideMenuBar: true,
  });
  ventana.loadURL(PANTALLA_CARGA);
  // Los enlaces externos se abren en el navegador, no dentro del juego.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.on("page-title-updated", (e) => e.preventDefault());

  const puerto = await puertoLibre();
  servidor = spawn(process.execPath, [path.join(raiz, "server.js")], {
    cwd: raiz,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(puerto),
      HOSTNAME: "127.0.0.1",
      DATOS_LOCALES: datos,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  servidor.stdout.pipe(registro);
  servidor.stderr.pipe(registro);
  servidor.on("exit", (codigo) => {
    if (codigo && !app.isQuitting) {
      dialog.showErrorBox(TITULO, `El servidor del juego se ha detenido (código ${codigo}).\nRevisa registro.log en:\n${app.getPath("userData")}`);
      app.quit();
    }
  });

  const url = `http://127.0.0.1:${puerto}/`;
  try {
    await esperarServidor(url, 60_000);
    ventana.loadURL(url);
  } catch (e) {
    dialog.showErrorBox(TITULO, `${e.message}\nRevisa registro.log en:\n${app.getPath("userData")}`);
    app.quit();
  }
}

app.on("second-instance", () => {
  const [v] = BrowserWindow.getAllWindows();
  if (v) {
    if (v.isMinimized()) v.restore();
    v.focus();
  }
});

app.whenReady().then(iniciar);

app.on("before-quit", () => {
  app.isQuitting = true;
  if (servidor) servidor.kill();
});

app.on("window-all-closed", () => app.quit());
