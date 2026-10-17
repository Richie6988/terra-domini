# HEXOD — Premier déploiement sur le VPS de PaintIt (app séparée)

Même architecture que PaintIt : **nginx système + gunicorn sous systemd + SQLite + certbot**, mais tout est séparé :

| | PaintIt | HEXOD |
|---|---|---|
| Utilisateur Linux | `paintit` | `hexod` |
| Code | `/home/paintit/Django` | `/home/hexod/terra-domini` |
| Port interne | `127.0.0.1:8000` | `127.0.0.1:8002` |
| Base | `db.sqlite3` | `/home/hexod/data/hexod.sqlite3` (hors du dépôt git) |
| Service | `paintit.service` | `hexod.service` |
| Site nginx | `/etc/nginx/sites-available/paintit` | `/etc/nginx/sites-available/hexod` |

PaintIt n'est jamais modifié. Remplace partout `hexod.example.com` par ton domaine.

---

## 0. DNS (avant tout)
Chez ton registrar : enregistrement **A** `hexod.example.com` → IP du VPS (et `www` en A ou CNAME). Vérifie : `ping hexod.example.com`.

## 1. Paquets et utilisateur (en root / sudo)
```bash
sudo apt update
sudo apt install -y python3-venv python3-dev build-essential git sqlite3 libpq-dev
python3 --version            # 3.10 à 3.12 OK
sudo adduser --disabled-password --gecos "" hexod
sudo chmod 755 /home/hexod   # nginx (www-data) doit pouvoir lire assets/static
```

## 2. Code + environnement Python (en tant que hexod)
```bash
sudo -iu hexod
git clone https://github.com/Richie6988/terra-domini.git
cd terra-domini
python3 -m venv .venv
.venv/bin/pip install --upgrade pip wheel
.venv/bin/pip install -r backend/requirements.txt      # quelques minutes
mkdir -p /home/hexod/data/media /home/hexod/data/backups
```
Le frontend est déjà compilé dans `frontend/dist` (pas besoin de Node sur le VPS).

## 3. Configuration `.env.prod`
```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
python3 -c "import secrets;print(secrets.token_urlsafe(64))"   # → colle dans DJANGO_SECRET_KEY
nano .env.prod
```
Remplis : `DJANGO_SECRET_KEY`, le domaine (`ALLOWED_HOSTS`, `SITE_URL`, `DEFAULT_FROM_EMAIL`)
et **le SMTP** (tu peux réutiliser celui de PaintIt) : sans e-mail, les joueurs ne reçoivent pas
leur code de vérification et **ne peuvent pas se connecter**.

## 4. Base de données + données de départ
```bash
cd /home/hexod/terra-domini/backend
export DJANGO_SETTINGS_MODULE=terra_domini.settings.prod
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py collectstatic --noinput
../.venv/bin/python manage.py seed_shop                           # boutique (sinon vide)
../.venv/bin/python manage.py seed_bots --count 20 --claim 5      # 20 bots + alliance Hexod Founders
../.venv/bin/python manage.py fetch_news --demo                   # événements
../.venv/bin/python manage.py createsuperuser                     # TON compte admin (email + mot de passe fort)
../.venv/bin/python manage.py verify_admin                        # marque le staff comme e-mail vérifié
exit                                                              # retour root
```
Note : le compte de dev `admin@td.com / admin123` n'existe PAS en production (et n'est plus jamais créé automatiquement).

## 5. Service systemd
```bash
sudo cp /home/hexod/terra-domini/deploy/hexod.service /etc/systemd/system/hexod.service
sudo systemctl daemon-reload
sudo systemctl enable --now hexod
sudo systemctl status hexod --no-pager
curl -s http://127.0.0.1:8002/health/        # → {"status": "ok", ...}
```
Logs : `sudo journalctl -u hexod -f`

## 6. Certificat HTTPS + nginx
```bash
sudo certbot certonly --nginx -d hexod.example.com -d www.hexod.example.com
sudo cp /home/hexod/terra-domini/deploy/nginx-hexod.conf /etc/nginx/sites-available/hexod
sudo sed -i 's/hexod.example.com/TONDOMAINE/g' /etc/nginx/sites-available/hexod
sudo ln -s /etc/nginx/sites-available/hexod /etc/nginx/sites-enabled/hexod
sudo nginx -t && sudo systemctl reload nginx
```
Ouvre `https://TONDOMAINE` → écran de connexion HEXOD. PaintIt continue de tourner sur son domaine.

## 7. Tâches planifiées (remplace Celery : pas de Redis nécessaire)
```bash
sudo crontab -u hexod /home/hexod/terra-domini/deploy/hexod.cron
sudo crontab -u hexod -l
```
Raids de bots toutes les 2 h, production de ressources quotidienne, news du jour, sauvegarde SQLite chaque nuit (14 jours).

## 8. Vérifications
- `https://TONDOMAINE` s'affiche, inscription → e-mail reçu → connexion OK.
- Connecté avec ton compte staff : bouton GOD MODE visible, `/gm` accessible.
- Réclame un premier hex (gratuit), le bouton RÉCOLTE apparaît.
- `sudo journalctl -u hexod --since "10 min ago"` sans erreur.

---

## Mises à jour (à chaque nouvelle version)
```bash
sudo -iu hexod
cd terra-domini && git pull
.venv/bin/pip install -r backend/requirements.txt
cd backend && export DJANGO_SETTINGS_MODULE=terra_domini.settings.prod
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py collectstatic --noinput
exit
sudo systemctl restart hexod
```

## Plus tard (montée en charge)
- **Redis** : `apt install redis-server`, `REDIS_HOST=127.0.0.1` dans `.env.prod`, puis `-w 3` dans `hexod.service`
  (sans Redis, garder 1 worker : cache et WebSocket sont en mémoire). Attention à ne pas partager la DB Redis 0 avec PaintIt.
- **PostgreSQL** : `POSTGRES_HOST/DB/USER/PASSWORD` dans `.env.prod` (prend le pas sur SQLite).
- Stripe / Polygon : variables commentées dans `.env.prod.example`.
