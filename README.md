# PersonalDrive

Almacenamiento personal **autohospedado** tipo Google Drive, construido con **Next.js 14 (App Router)**, **PostgreSQL + Prisma**, **Tailwind CSS** y una **PWA** real con soporte sin conexión.
Diseñado para correr en un único VPS con Docker — sin almacenamiento de terceros, sin SaaS de por medio.

> Cada usuario tiene su propio árbol de carpetas y archivos, una cuota personal de almacenamiento, miniaturas automáticas, streaming de vídeo por rangos, enlaces de compartición protegidos con contraseña / caducidad / límite de descargas, y una app instalable que sigue funcionando offline.

---

## ✨ Características

| Área              | Funcionalidades                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Auth              | Email + contraseña (bcrypt), JWT en cookie `httpOnly`, middleware en el edge para proteger rutas, admins.    |
| Archivos          | Subida drag & drop con progreso, renombrar, mover, eliminar, previsualización imagen/vídeo/audio/PDF.        |
| Carpetas          | Crear / renombrar / mover / borrar recursivo con protección anti-ciclos.                                     |
| Almacenamiento    | Subidas en streaming a disco, checksum SHA-256 y miniaturas automáticas (sharp).                             |
| Compartición      | Enlaces públicos con token, contraseña opcional, caducidad y límite de descargas.                            |
| Carpeta segura    | Sección protegida con una segunda contraseña (JWT efímero de 15 min). Los archivos seguros no se comparten.   |
| Cuotas            | Límite por usuario, controlado en servidor antes y después de subir.                                         |
| Streaming         | Soporte de `Range` HTTP → vídeo seekable y descargas grandes reanudables.                                    |
| PWA               | `manifest.json`, prompt de instalación, página offline dedicada.                                             |
| Offline           | Service Worker (network-first / cache-first) e IndexedDB para archivos pinneados y subidas en cola.          |
| Sync              | Las subidas hechas sin conexión se reproducen automáticamente al volver online.                              |
| Despliegue        | Docker multi-stage, docker-compose con PostgreSQL **+ Caddy con HTTPS automático**, scripts de backup.       |

---

## 🧰 Stack

- **Next.js 14** (App Router, output standalone)
- **PostgreSQL 16** vía **Prisma 5**
- **Tailwind CSS 3**
- **bcryptjs** + **jose** (JWT compatible con Edge)
- **sharp** para miniaturas / metadatos de imagen
- **Service Worker + IndexedDB** para offline
- **Docker** (multi-stage) + **docker-compose** + **Caddy** (HTTPS automático)

---

## 📁 Estructura

```
.
├── prisma/schema.prisma          # Modelos User, Session, Folder, File, Share
├── public/
│   ├── manifest.json
│   ├── sw.js                     # Service Worker
│   ├── offline.html              # Pantalla offline
│   └── icons/                    # Iconos PWA (sustitúyelos por los tuyos)
├── src/
│   ├── middleware.ts             # Guard de auth en el edge
│   ├── app/                      # Páginas y rutas API
│   ├── components/               # Sidebar, Header, FileBrowser, FilePreview, ShareDialog…
│   └── lib/                      # prisma · auth · jwt · storage · env · offline-db · utils
├── deploy/
│   ├── Caddyfile                 # Reverse proxy + HTTPS automático (lo usa docker-compose)
│   └── nginx.conf.example        # Alternativa para Nginx + certbot
├── scripts/
│   ├── deploy.sh                 # Primera instalación: genera .env y arranca el stack
│   ├── update.sh                 # `git pull` + rebuild + up
│   ├── backup.sh                 # Volcado SQL + tar de los archivos
│   ├── restore.sh                # Restaurar un backup
│   └── entrypoint.sh             # Espera a la BBDD, migra y arranca la app
├── Dockerfile
├── docker-compose.yml            # Stack completo (db + app + caddy)
├── .env.example                  # Variables para desarrollo
├── .env.production.example       # Plantilla para producción (¡cópiala como .env!)
├── DEPLOYMENT.md                 # Guía paso a paso para Hetzner / VPS
└── README.md
```

---

## 🚀 Despliegue rápido en un VPS de Hetzner (resumen)

> Para la guía detallada (creación del servidor, firewall, DNS, troubleshooting…) lee **[DEPLOYMENT.md](DEPLOYMENT.md)**.

```bash
# 1. En el VPS, instala Docker
curl -fsSL https://get.docker.com | sh

# 2. Clona el repo
git clone https://github.com/pablofuentess97/drive.git /opt/drive
cd /opt/drive

# 3. Configura las variables (DOMAIN, ACME_EMAIL, JWT, contraseña BBDD…)
cp .env.production.example .env
nano .env

# 4. Despliega
sudo bash scripts/deploy.sh
```

El script:

1. Verifica que `docker` y `docker compose` estén instalados.
2. Genera automáticamente `JWT_SECRET` y `POSTGRES_PASSWORD` si no existen.
3. Construye las imágenes y arranca PostgreSQL, la app y Caddy.

Una vez que `drive.pablofuentes.org` apunte al VPS, Caddy emite el certificado **Let's Encrypt automáticamente** la primera vez que entres por HTTPS — no hay que hacer nada manualmente.

---

## 🌐 DNS para `drive.pablofuentes.org`

En tu proveedor de DNS (Cloudflare, Hetzner DNS, IONOS, Squarespace, etc.) crea **un registro `A`** y, si tienes IPv6, también **un `AAAA`**:

| Tipo | Nombre | Valor                | TTL  |
| ---- | ------ | -------------------- | ---- |
| A    | drive  | `<IP-V4 del VPS>`    | Auto |
| AAAA | drive  | `<IP-V6 del VPS>`    | Auto |

> En Cloudflare, deja el proxy en **DNS only (gris)** la primera vez para que Caddy pueda resolver el reto HTTP-01 de Let's Encrypt. Después puedes activar el proxy si quieres (modo Full strict).

Para verificar que resuelve correctamente:

```bash
dig +short drive.pablofuentes.org
```

---

## 🛠 Operaciones día a día

```bash
# Ver logs en directo
docker compose logs -f app
docker compose logs -f caddy

# Reiniciar la app
docker compose restart app

# Actualizar a la última versión del repo
bash scripts/update.sh

# Backup completo (BBDD + ficheros)
bash scripts/backup.sh
# → ./backups/<fecha>/db.sql.gz + storage.tar.gz

# Restaurar un backup
bash scripts/restore.sh ./backups/2026-04-29_180000

# Entrar a la BBDD
docker compose exec db psql -U drive drive

# Ver uso de disco
docker system df
```

---

## ⚙️ Variables de entorno (producción)

| Variable               | Ejemplo                                | Descripción                                                                |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `DOMAIN`               | `drive.pablofuentes.org`               | Hostname público — Caddy emitirá un certificado para este dominio.         |
| `ACME_EMAIL`           | `tu-email@pablofuentes.org`            | Correo para los avisos de renovación de Let's Encrypt.                     |
| `NEXT_PUBLIC_APP_URL`  | `https://drive.pablofuentes.org`       | URL pública (usada por la PWA y los enlaces compartidos).                  |
| `NEXT_PUBLIC_APP_NAME` | `PersonalDrive`                        | Nombre mostrado en la UI y el manifest.                                    |
| `POSTGRES_USER`        | `drive`                                | Usuario de la BBDD.                                                        |
| `POSTGRES_PASSWORD`    | `<aleatorio>`                          | Contraseña de la BBDD (`openssl rand -base64 32`).                         |
| `POSTGRES_DB`          | `drive`                                | Nombre de la BBDD.                                                         |
| `JWT_SECRET`           | `<aleatorio largo>`                    | Clave para firmar las sesiones (`openssl rand -base64 64`).                |
| `JWT_EXPIRES_IN`       | `7d`                                   | Duración del token / cookie.                                               |
| `DEFAULT_QUOTA_BYTES`  | `10737418240` (10 GB)                  | Cuota por usuario al registrarse.                                          |
| `MAX_UPLOAD_BYTES`     | `2147483648` (2 GB)                    | Tamaño máximo de un archivo subido.                                        |
| `MAX_UPLOAD_SIZE`      | `2GB`                                  | Mismo valor pero con sufijo, para Caddy.                                   |
| `ADMIN_EMAILS`         | `tu-email@pablofuentes.org`            | Correos (separados por coma) que se promocionan a `ADMIN` al registrarse.  |

---

## 💻 Desarrollo local

```bash
# 1. Instala dependencias
npm install

# 2. Variables locales
cp .env.example .env
# - Edita DATABASE_URL si tu Postgres no es el local
# - Pon un JWT_SECRET (openssl rand -base64 64)

# 3. Postgres rápido vía Docker
docker run --rm -d --name drive-pg \
  -e POSTGRES_PASSWORD=drive -e POSTGRES_USER=drive -e POSTGRES_DB=drive \
  -p 5432:5432 postgres:16-alpine

# 4. Sincroniza el esquema y arranca
npx prisma db push
npm run dev
# → http://localhost:3000
```

---

## 🧠 Notas de arquitectura

### Autenticación

- Contraseñas con `bcrypt` (coste 12).
- Sesiones JWT (HS256) firmadas con `JWT_SECRET` y guardadas en cookie `httpOnly`, `SameSite=Lax`, `Secure`.
- También hay tabla `Session` en BBDD para auditar / revocar manualmente.
- `src/middleware.ts` corre en el Edge y redirige si el JWT está ausente o expirado.

### Almacenamiento

- Los ficheros se guardan en `STORAGE_DIR/<userId>/files/<fileId>` — sin segmentos controlados por el usuario (no hay path traversal posible).
- Las subidas hacen streaming directo de la request al disco mientras se calcula el SHA-256 al vuelo. RAM constante, da igual el tamaño.
- `sharp` produce miniaturas WebP de 512×512.
- `src/lib/storage.ts:objectPath` valida que la ruta resuelta queda dentro del directorio del usuario.

### Cuotas e integridad

- La cuota se revisa **antes** de abrir el stream (con `request.size`) y **otra vez** con el tamaño real escrito en disco. Si el cliente miente, se borra el fichero y devuelve `413`.
- Borrar archivos / carpetas decrementa `User.usedBytes` dentro de la misma transacción que el `delete`.
- Borrar una carpeta es recursivo: descuenta los bytes de todos los archivos descendientes.

### Streaming

- `/api/files/[id]/download` entiende la cabecera `Range`, así que los `<video>` pueden hacer seek y las descargas grandes son reanudables.
- Los enlaces públicos `/api/share/[token]` también lo soportan.

### PWA & offline

- `public/manifest.json` hace la app instalable.
- `public/sw.js` aplica estrategias por ruta:
  - `/_next/static`, `/icons` → cache-first.
  - Listados de archivos (`/api/files…`) → network-first con fallback a caché.
  - Navegaciones → network-first con fallback a `/offline.html`.
- `src/lib/offline-db.ts` envuelve IndexedDB con dos *object stores*:
  - `files` — blobs que el usuario pinneó (botón "Sin conexión" en cada archivo).
  - `uploadQueue` — subidas hechas offline; `syncQueuedUploads()` las reproduce al volver online.
- Los componentes `OfflineIndicator` y `PWAInstaller` muestran el estado y el prompt de instalación.

### Compartición

- Una fila `Share` guarda token base64url, hash bcrypt opcional de la contraseña, fecha de caducidad y límite de descargas.
- El endpoint público valida todo antes de abrir el stream e incrementa el contador.
- El propietario puede listar y revocar sus enlaces desde `/shared`.
- **Los archivos marcados como seguros no se pueden compartir** (la API devuelve 403).

### Carpeta segura (Vault)

- Cada usuario puede activar una segunda contraseña en `/secure` (también se gestiona desde `/account`).
- La contraseña se guarda como `bcrypt` en `User.vaultPasswordHash`. Es **independiente** de la contraseña de la cuenta.
- Los archivos y carpetas dentro llevan el flag `isSecure = true`. El flag se hereda al crear nuevos elementos.
- Al desbloquear, el servidor emite un **JWT efímero (15 min)** firmado con `JWT_SECRET` y lo guarda en una cookie aparte (`drive_vault`, `httpOnly`, `Secure`).
- Cualquier ruta de la API (listar, descargar, renombrar, borrar) que toque un item con `isSecure = true` exige esta cookie. Sin ella, la API devuelve `423 Locked` y la UI muestra de nuevo la pantalla de desbloqueo.
- Si pierdes la contraseña: los archivos siguen existiendo pero son inaccesibles. Puedes desactivar la carpeta segura **con la propia contraseña** desde `/account` (no hay reset por la cuenta principal: es deliberado, esa es la protección).
- Los recientes y la búsqueda global **nunca incluyen** archivos seguros.

### Healthcheck

- `/api/health` hace un `SELECT 1` contra Postgres.
- El contenedor Docker incluye `HEALTHCHECK` que apunta ahí, así `docker compose ps` muestra `healthy`/`unhealthy`.

---

## 🔒 Seguridad por capas

- **Caddy** termina TLS, fija HSTS, oculta la versión del servidor y bloquea cuerpos por encima de `MAX_UPLOAD_SIZE`.
- **App** sólo acepta tráfico desde la red interna de Docker (no expone el 3000 al host).
- **Postgres** sólo es accesible desde la red interna.
- **Volúmenes** (`db-data`, `storage`) son del propio Docker — fácil de respaldar y auditar.
- **JWT_SECRET** y **POSTGRES_PASSWORD** se generan al primer despliegue con `openssl rand`.

---

## 📄 Licencia

MIT — haz lo que quieras.
