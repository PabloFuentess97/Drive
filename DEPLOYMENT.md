# Despliegue en Hetzner (paso a paso)

Esta guía describe cómo desplegar PersonalDrive en un VPS de **Hetzner Cloud** con **Docker** y el dominio **`drive.pablofuentes.org`** (sustitúyelo por el tuyo si es otro). Si usas otro proveedor de VPS (DigitalOcean, OVH, Vultr, Contabo, etc.) los pasos son prácticamente idénticos.

---

## 0. Pre-requisitos

- Un dominio que controles (en este ejemplo, `pablofuentes.org`).
- Una cuenta de Hetzner Cloud con un proyecto creado: <https://console.hetzner.cloud/>.
- Una clave SSH cargada en Hetzner (Security → SSH Keys). Si aún no tienes una:

  ```bash
  ssh-keygen -t ed25519 -C "tu-email@pablofuentes.org"
  # Copia el contenido de ~/.ssh/id_ed25519.pub al panel de Hetzner.
  ```

---

## 1. Crear el servidor en Hetzner

En el panel de Hetzner Cloud → **Add Server**:

| Opción            | Valor recomendado                                                        |
| ----------------- | ------------------------------------------------------------------------ |
| Location          | El más cercano a tus usuarios (Falkenstein, Helsinki, Ashburn…).         |
| Image             | **Ubuntu 24.04** (LTS, soporte largo).                                   |
| Type              | **CX22** (4 GB RAM, 2 vCPU, 40 GB SSD) — suficiente para uso personal.   |
| Networking        | Pública IPv4 + IPv6.                                                     |
| SSH keys          | Selecciona la que cargaste antes.                                        |
| Firewalls         | (Ver sección 2). Puedes añadirla después.                                |
| Volumes           | Si vas a almacenar > 35 GB, añade un Volume (ver sección 8).             |
| Backups           | **Activa "Enable backups"** si quieres snapshots automáticos (+20%).     |
| Name              | `drive` (o el que prefieras).                                            |

Pulsa **Create & Buy Now**. En menos de un minuto tendrás la IP pública del servidor.

---

## 2. Firewall (Hetzner Cloud Firewall)

En el panel → **Firewalls → Create firewall**, añade reglas **inbound**:

| Protocolo | Puerto    | Origen      | Descripción      |
| --------- | --------- | ----------- | ---------------- |
| TCP       | 22        | tu IP / `0.0.0.0/0`* | SSH    |
| TCP       | 80        | `0.0.0.0/0` | HTTP (Let's Encrypt) |
| TCP       | 443       | `0.0.0.0/0` | HTTPS            |
| UDP       | 443       | `0.0.0.0/0` | HTTP/3 (QUIC)    |

> \* Si tienes IP fija, restringe el SSH a tu IP. Si no, déjalo abierto pero **desactiva la auth por contraseña** (paso 3).

Aplica el firewall al servidor recién creado.

---

## 3. Endurecer SSH (5 minutos)

Conéctate al VPS:

```bash
ssh root@<IP-del-VPS>
```

Crea un usuario no-root y desactiva el login por contraseña:

```bash
adduser pablo
usermod -aG sudo pablo
mkdir -p /home/pablo/.ssh
cp ~/.ssh/authorized_keys /home/pablo/.ssh/
chown -R pablo:pablo /home/pablo/.ssh
chmod 700 /home/pablo/.ssh
chmod 600 /home/pablo/.ssh/authorized_keys

# Desactiva la auth por contraseña y el login directo de root
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/'  /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh
```

A partir de ahora conéctate como `pablo`:

```bash
ssh pablo@<IP-del-VPS>
```

(Opcional pero recomendado: instala `ufw`, `fail2ban` y mantén el sistema actualizado con `unattended-upgrades`.)

---

## 4. Configurar el DNS

En el proveedor de tu dominio (Cloudflare, Hetzner DNS, IONOS…) crea:

| Tipo | Nombre  | Valor                | TTL  |
| ---- | ------- | -------------------- | ---- |
| A    | `drive` | `<IPv4 del VPS>`     | Auto |
| AAAA | `drive` | `<IPv6 del VPS>`     | Auto |

> En **Cloudflare**, deja el proxy en gris (DNS only) para el primer arranque para que Caddy pueda completar el reto HTTP-01 de Let's Encrypt. Después puedes activar el proxy si quieres.

Verifica que resuelve antes de continuar:

```bash
dig +short drive.pablofuentes.org
# debe imprimir la IP del VPS
```

---

## 5. Instalar Docker

```bash
ssh pablo@<IP-del-VPS>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
ssh pablo@<IP-del-VPS>   # vuelve a entrar para que el grupo aplique

docker version
docker compose version
```

---

## 6. Clonar el repo y configurar `.env`

```bash
sudo mkdir -p /opt/drive
sudo chown $USER /opt/drive
git clone https://github.com/pablofuentess97/drive.git /opt/drive
cd /opt/drive
git checkout claude/nextjs-drive-saas-hdxPg

cp .env.production.example .env
nano .env
```

Edita los valores que **debes** cambiar:

```env
DOMAIN=drive.pablofuentes.org
ACME_EMAIL=tu-email@pablofuentes.org
NEXT_PUBLIC_APP_URL=https://drive.pablofuentes.org
ADMIN_EMAILS=tu-email@pablofuentes.org
```

`JWT_SECRET` y `POSTGRES_PASSWORD` los generará automáticamente el script `deploy.sh` si los dejas vacíos. Si quieres hacerlo a mano:

```bash
openssl rand -base64 64    # → JWT_SECRET
openssl rand -base64 32    # → POSTGRES_PASSWORD
```

---

## 7. Desplegar

```bash
sudo bash scripts/deploy.sh
```

El script:

1. Comprueba que `docker` y `docker compose` están instalados.
2. Si `.env` no existe, lo crea desde `.env.production.example` con secretos aleatorios.
3. Construye las imágenes (`docker compose build`).
4. Arranca el stack en background (`docker compose up -d`).

Sigue los logs:

```bash
docker compose logs -f
```

Espera a ver:

- `Esperando a que la base de datos esté disponible...` → `Base de datos disponible`
- `Iniciando aplicación...`
- En `caddy`: `serving initial configuration` y posteriormente `certificate obtained successfully`.

Abre **`https://drive.pablofuentes.org`** en tu navegador. La primera carga puede tardar 10–20 segundos mientras Caddy negocia el certificado con Let's Encrypt.

Crea el primer usuario en `/register`. Si tu correo está en `ADMIN_EMAILS`, será admin automáticamente.

---

## 8. (Opcional) Volume de datos en Hetzner para más almacenamiento

Si vas a guardar más de los ~35 GB libres del disco del CX22:

1. Hetzner Cloud → **Volumes → Create volume** (50 GB, 100 GB, etc.) en la misma región del servidor y con auto-mount activado.
2. Tras crearlo, Hetzner lo monta normalmente en `/mnt/HC_Volume_<id>`.
3. Mueve los volúmenes de Docker a ese disco:

   ```bash
   docker compose down
   sudo systemctl stop docker
   sudo mv /var/lib/docker /mnt/HC_Volume_<id>/docker
   sudo ln -s /mnt/HC_Volume_<id>/docker /var/lib/docker
   sudo systemctl start docker
   docker compose up -d
   ```

   *Alternativa más limpia*: configura `/etc/docker/daemon.json` con `"data-root": "/mnt/HC_Volume_<id>/docker"` antes del primer `docker compose up`.

---

## 9. Backups

### Manual

```bash
cd /opt/drive
bash scripts/backup.sh
# → ./backups/<fecha>/db.sql.gz + storage.tar.gz
```

Copia ese directorio fuera del servidor (rsync, scp, S3, Backblaze, etc.).

### Automatizado (cron diario a las 3:30 a las dos horas locales)

```bash
crontab -e
```

Añade:

```cron
30 3 * * *  cd /opt/drive && /usr/bin/bash scripts/backup.sh >> /var/log/drive-backup.log 2>&1
0  4 * * *  find /opt/drive/backups -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \;
```

(Limpia backups de más de 14 días.)

### Hetzner Backups

Si activaste **Enable backups** al crear el servidor, Hetzner te hace una snapshot semanal automáticamente. Recomendado en cualquier caso, complementa muy bien al backup lógico.

---

## 10. Actualizaciones

```bash
cd /opt/drive
bash scripts/update.sh
```

Este script:

1. Hace `git pull` de la rama actual.
2. Reconstruye la imagen (`docker compose build --pull`).
3. Recrea sólo los contenedores que han cambiado (`docker compose up -d`).
4. Limpia imágenes huérfanas.

Las migraciones de Prisma se aplican automáticamente en el `entrypoint.sh` del contenedor.

---

## 11. Troubleshooting

### El certificado de Let's Encrypt no se emite

- Verifica que `drive.pablofuentes.org` resuelve a tu IP: `dig +short drive.pablofuentes.org`.
- Comprueba que los puertos **80 y 443** están abiertos en el firewall de Hetzner **y** en `ufw` si lo usas.
- Mira los logs de Caddy: `docker compose logs caddy`.
- Si sigues atascado, prueba el entorno de pruebas de Let's Encrypt descomentando `acme_ca` en `deploy/Caddyfile` y reiniciando Caddy: `docker compose restart caddy`. Cuando funcione, comenta de nuevo y borra el volumen `caddy-data` para forzar el certificado real:
  ```bash
  docker compose down
  docker volume rm personaldrive_caddy-data
  docker compose up -d
  ```

### "DATABASE_URL not found" o el contenedor `app` reinicia en bucle

- Asegúrate de que `.env` está en la raíz del proyecto (junto al `docker-compose.yml`).
- `docker compose config` te muestra cómo se han expandido las variables.

### Subidas grandes fallan con `413`

- Revisa que `MAX_UPLOAD_SIZE` (Caddy) **es ≥** `MAX_UPLOAD_BYTES` (app).
- Ejemplo: para subidas de hasta 4 GB → `MAX_UPLOAD_BYTES=4294967296` y `MAX_UPLOAD_SIZE=4GB`.
- Reinicia los contenedores: `docker compose up -d`.

### Quiero entrar a la base de datos

```bash
docker compose exec db psql -U drive drive
```

### Quiero limpiarlo todo y empezar de cero

> ⚠️ Esto borra **todos** los datos.

```bash
docker compose down -v
```

---

## 12. Lista de verificación final

- [ ] DNS de `drive.pablofuentes.org` apunta al VPS (A y AAAA).
- [ ] Firewall abre 80/tcp, 443/tcp, 443/udp.
- [ ] `.env` con `DOMAIN`, `ACME_EMAIL`, `NEXT_PUBLIC_APP_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD`.
- [ ] `docker compose ps` → todo `Up` y `healthy`.
- [ ] Primer login funciona y `/register` deshabilitado tras crear el admin (opcional).
- [ ] Backup diario configurado en cron.
- [ ] Hetzner Backups activado (opcional pero recomendado).

¡Listo! 🚀
