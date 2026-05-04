# Setup VPS — Evolution API para WhatsApp

## Requisitos
- VPS Ubuntu 22.04 (Hostinger KVM 1 o similar)
- IP pública del VPS
- Acceso SSH como root

---

## 1. Conectarse al VPS

```bash
ssh root@TU_IP_DEL_VPS
```

---

## 2. Script de instalación completo (copy-paste todo de una)

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
apt install -y docker.io docker-compose curl ufw

# Habilitar Docker
systemctl enable docker
systemctl start docker

# Crear carpeta de Evolution API
mkdir -p /opt/evolution && cd /opt/evolution

# Generar API key aleatoria
EVOLUTION_KEY=$(openssl rand -hex 32)
echo "Tu API Key es: $EVOLUTION_KEY"
echo "GUARDALA — la vas a necesitar para Vercel"
echo ""

# Obtener IP del servidor
SERVER_IP=$(curl -s ifconfig.me)
echo "Tu IP del servidor es: $SERVER_IP"
echo ""

# Crear docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'
services:
  evolution:
    image: atendai/evolution-api:latest
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    environment:
      SERVER_URL: http://$SERVER_IP:8080
      AUTHENTICATION_TYPE: apikey
      AUTHENTICATION_API_KEY: $EVOLUTION_KEY
      STORE_MESSAGES: "false"
      STORE_MESSAGE_UP: "false"
      STORE_CONTACTS: "false"
      DEL_INSTANCE: "false"
      WEBHOOK_GLOBAL_ENABLED: "false"
      LOG_LEVEL: ERROR

volumes:
  evolution_instances:
  evolution_store:
EOF

# Configurar firewall
ufw allow 22/tcp
ufw allow 8080/tcp
ufw --force enable

# Levantar Evolution API
docker-compose up -d

# Esperar que arranque
sleep 5

# Verificar que está corriendo
docker-compose ps
echo ""
echo "========================================"
echo "Verificando que Evolution API responde..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  -H "apikey: $EVOLUTION_KEY" \
  http://localhost:8080/instance/fetchInstances
echo "========================================"
echo ""
echo "Si ves 'HTTP Status: 200' — todo OK!"
echo ""
echo "Variables para pegar en Vercel:"
echo "EVOLUTION_API_URL = http://$SERVER_IP:8080"
echo "EVOLUTION_API_KEY = $EVOLUTION_KEY"
```

---

## 3. Variables para agregar en Vercel

Una vez que corrió el script, vas a ver al final los valores exactos.
Ir a: **Vercel Dashboard → tu proyecto → Settings → Environment Variables**

| Variable | Valor |
|---|---|
| `EVOLUTION_API_URL` | `http://TU_IP:8080` (el script lo muestra) |
| `EVOLUTION_API_KEY` | el valor que generó el script |
| `CRON_SECRET` | cualquier string largo random (ej: corré `openssl rand -hex 32` en el VPS) |

---

## 4. Aplicar migración en Supabase

En el SQL Editor de Supabase (supabase.com → tu proyecto → SQL Editor):

Pegá el contenido completo de:
`supabase/migrations/20260504000001_whatsapp.sql`

O si tenés Supabase CLI:
```bash
npx supabase db push
```

---

## 5. Verificar que todo funciona

Desde el VPS:
```bash
cd /opt/evolution
docker-compose logs --tail=50
```

Desde el navegador, ir a `/configuracion` → sección WhatsApp → click "Conectar WhatsApp" → debería aparecer el QR.

---

## Comandos útiles post-instalación

```bash
# Ver logs en tiempo real
cd /opt/evolution && docker-compose logs -f

# Reiniciar Evolution API
cd /opt/evolution && docker-compose restart

# Actualizar a nueva versión
cd /opt/evolution && docker-compose pull && docker-compose up -d

# Ver instancias conectadas
curl -H "apikey: TU_KEY" http://localhost:8080/instance/fetchInstances | python3 -m json.tool
```

---

## Troubleshooting

**El QR no aparece**
- Verificar que `EVOLUTION_API_URL` en Vercel apunta al VPS correcto
- Verificar que el puerto 8080 está abierto: `ufw status`
- Ver logs: `docker-compose logs -f`

**WhatsApp se desconecta solo**
- Normal si el celular pierde internet o se reinicia
- La UI de /configuracion muestra el estado en tiempo real
- El dueño tiene que reconectar escaneando el QR de nuevo

**Los recordatorios no salen**
- Verificar que `CRON_SECRET` está configurado en Vercel
- Verificar que Vercel Cron está habilitado (Vercel Dashboard → Settings → Crons)
- Testear manualmente: `GET /api/cron/reminders?secret=TU_CRON_SECRET`
