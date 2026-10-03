---
sidebar_position: 2
title: Install Nextcloud
description: Install Nextcloud with Docker Compose, PostgreSQL, and Redis on Ubuntu.
tags: [nextcloud]
---

# Install Nextcloud

This guide installs Nextcloud on an Ubuntu server using Docker Compose, with PostgreSQL as the database and Redis for caching and file locking. By the end you will have a running Nextcloud instance and be logged in as an admin.

## Prerequisites

- An Ubuntu server (22.04 or newer) with `sudo` access.
- At least 2 vCPU and 2 GB of RAM. 4 GB is more comfortable.
- Enough disk space for your files. User data lives on this server, so size the disk (or mount dedicated storage) for what you plan to store.
- A hostname or DNS name for Nextcloud (for example `cloud.example.com`). For a quick lab you can use the server IP instead.
- Port `8080` reachable from your browser, or a reverse proxy in front of it.

## Update packages

```bash
sudo apt update
sudo apt upgrade -y
```

## Install Docker

The commands below follow Docker's official instructions for Ubuntu.

### Set up the Docker repository

```bash
# Add Docker's official GPG key:
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
```

### Install the Docker packages

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Run Docker without sudo

Add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

Group changes only apply to new sessions. Log out and back in, or start a new shell with the group applied:

```bash
newgrp docker
```

### Verify the installation

```bash
docker --version
docker compose version
docker run --rm hello-world
```

If `hello-world` prints a welcome message, Docker is working.

:::info
Members of the `docker` group effectively have root access on the host. Only add users you trust.
:::

## Configuration

### Create the working directory

```bash
sudo mkdir -p /opt/nextcloud
sudo chown $USER:$USER /opt/nextcloud
cd /opt/nextcloud
```

### Create the environment file

Keep all secrets and version settings in a `.env` file so the compose file stays clean and can be committed or shared safely.

First, generate three strong passwords:

```bash
openssl rand -base64 32   # use for POSTGRES_PASSWORD
openssl rand -base64 32   # use for REDIS_PASSWORD
openssl rand -base64 32   # use for NEXTCLOUD_ADMIN_PASSWORD
```

Then create the file:

```bash
nano /opt/nextcloud/.env
```

```ini
# Nextcloud image tag. Pin a specific major version, avoid "latest".
# Check the supported versions at https://hub.docker.com/_/nextcloud
NEXTCLOUD_VERSION=32-apache

# Domain or IP users will use to reach Nextcloud (no scheme, no port)
NEXTCLOUD_TRUSTED_DOMAINS=cloud.example.com

# Initial admin account, created on first start only
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=change-me

# PostgreSQL
POSTGRES_DB=nextcloud
POSTGRES_USER=nextcloud
POSTGRES_PASSWORD=change-me-too

# Redis
REDIS_PASSWORD=change-me-as-well
```

Lock the file down so only your user can read it:

```bash
chmod 600 /opt/nextcloud/.env
```

:::tip
For a quick lab without DNS or TLS, set `NEXTCLOUD_TRUSTED_DOMAINS=<server-ip>` (replace `<server-ip>` with your server's IP address).
:::

### Create the Docker Compose file

```bash
nano /opt/nextcloud/docker-compose.yml
```

```yaml
services:
  db:
    image: postgres:17
    container_name: nextcloud-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - nextcloud-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nextcloud-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    networks:
      - nextcloud-net

  nextcloud:
    image: nextcloud:${NEXTCLOUD_VERSION}
    container_name: nextcloud
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      # Database
      POSTGRES_HOST: db
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

      # Redis
      REDIS_HOST: redis
      REDIS_HOST_PASSWORD: ${REDIS_PASSWORD}

      # Initial admin (first start only)
      NEXTCLOUD_ADMIN_USER: ${NEXTCLOUD_ADMIN_USER}
      NEXTCLOUD_ADMIN_PASSWORD: ${NEXTCLOUD_ADMIN_PASSWORD}
      NEXTCLOUD_TRUSTED_DOMAINS: ${NEXTCLOUD_TRUSTED_DOMAINS}

      # Only enable these when Nextcloud sits behind a TLS reverse proxy
      # (Nginx, Traefik, Caddy, ...)
      # OVERWRITEPROTOCOL: https
      # OVERWRITEHOST: cloud.example.com
      # TRUSTED_PROXIES: 172.16.0.0/12

      # PHP limits
      PHP_MEMORY_LIMIT: 512M
      PHP_UPLOAD_LIMIT: 2G
    volumes:
      - nextcloud_data:/var/www/html
    ports:
      - "8080:80"
    networks:
      - nextcloud-net

  cron:
    image: nextcloud:${NEXTCLOUD_VERSION}
    container_name: nextcloud-cron
    restart: unless-stopped
    entrypoint: /cron.sh
    depends_on:
      - nextcloud
    volumes:
      - nextcloud_data:/var/www/html
    networks:
      - nextcloud-net

volumes:
  db_data:
  nextcloud_data:

networks:
  nextcloud-net:
```

A few notes on this file:

- `depends_on` with `service_healthy` makes Nextcloud wait until PostgreSQL is actually ready to accept connections.
- The `cron` container runs Nextcloud's background jobs every 5 minutes using the same image and the same volume. Without it, background jobs only run when someone opens the web interface.
- Both Nextcloud files and configuration live in the `nextcloud_data` volume, and the database in `db_data`. Both survive container restarts and re-creation.
- `PHP_UPLOAD_LIMIT` sets the maximum upload size in PHP. A reverse proxy has its own limit as well (see [Troubleshooting](#troubleshooting)).
- If you run a reverse proxy on the same host, bind the port to localhost only with `"127.0.0.1:8080:80"` and uncomment the `OVERWRITE*` and `TRUSTED_PROXIES` variables.

:::warning
The `NEXTCLOUD_ADMIN_*`, `NEXTCLOUD_TRUSTED_DOMAINS`, and database variables are only read during the **first start**, when Nextcloud installs itself. Changing them in `.env` afterwards does not change an existing installation. Use `occ` or `config.php` instead.
:::

## Start Nextcloud

Validate the file first. This prints the resolved config and catches typos or missing variables:

```bash
cd /opt/nextcloud
docker compose config
```

Then start the stack in the background:

```bash
docker compose up -d
```

Follow the logs while Nextcloud installs itself. The first start can take a few minutes:

```bash
docker compose logs -f nextcloud
```

When the logs show Apache has started and stop printing installation messages, the instance is ready. Press `Ctrl+C` to stop following the logs (the containers keep running).

Check the status of all containers:

```bash
docker compose ps
```

## Log in to Nextcloud

Open Nextcloud in your browser:

```
http://cloud.example.com:8080
```

Log in with `NEXTCLOUD_ADMIN_USER` and `NEXTCLOUD_ADMIN_PASSWORD` from your `.env` file.

:::warning
The first admin account has full control over the instance. Use a strong password and enable two-factor authentication for it (**Personal settings → Security**) before inviting other users.
:::

## Post-install setup

### Switch background jobs to Cron

The `cron` container only does its job if Nextcloud is set to use cron. Run:

```bash
cd /opt/nextcloud
docker compose exec -u www-data nextcloud php occ background:cron
```

You can confirm it under **Administration settings → Basic settings → Background jobs**.

### Set a default phone region

This removes a warning in the admin overview and makes phone number validation work properly. Use your own [ISO 3166-1 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2):

```bash
docker compose exec -u www-data nextcloud php occ config:system:set default_phone_region --value="ID"
```

### Review the admin overview

Open **Administration settings → Overview**. Nextcloud lists security and setup warnings there. A fresh installation behind plain HTTP will show a few, such as missing HTTPS. Resolve them before putting the server on the internet.

## Day-to-day operations

### Stop, start, and restart

```bash
cd /opt/nextcloud
docker compose stop
docker compose start
docker compose restart nextcloud
```

### Run occ commands

`occ` is Nextcloud's command-line admin tool. Always run it as the `www-data` user:

```bash
docker compose exec -u www-data nextcloud php occ status
```

### Back up Nextcloud

A consistent backup needs **both** the database and the data volume. Put Nextcloud in maintenance mode first so nobody changes files while you copy them:

```bash
cd /opt/nextcloud
docker compose exec -u www-data nextcloud php occ maintenance:mode --on

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > nextcloud-db-$(date +%F).sql

docker run --rm \
  -v nextcloud_nextcloud_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/nextcloud-data-$(date +%F).tar.gz -C /data .

docker compose exec -u www-data nextcloud php occ maintenance:mode --off
```

The volume name is prefixed with the compose project name, which defaults to the directory name. Check the exact name with `docker volume ls`.

Store both files somewhere other than this server, and test a restore at least once.

### Upgrade Nextcloud

1. Take a full backup (see above).
2. Read the release notes and upgrade notes for the version you are moving to.
3. Change `NEXTCLOUD_VERSION` in `.env`. Move up **one major version at a time**; Nextcloud does not support skipping majors.
4. Pull the new image and recreate the containers:

```bash
cd /opt/nextcloud
docker compose pull
docker compose up -d
docker compose logs -f nextcloud
```

Nextcloud runs the upgrade automatically on startup. Afterwards, check **Administration settings → Overview** for new warnings.

### Remove everything

This deletes the containers **and all data**, including every user's files:

```bash
cd /opt/nextcloud
docker compose down -v
```

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Cannot reach the page | Check `docker compose ps`, then the firewall. With UFW: `sudo ufw allow 8080/tcp`. |
| "Access through untrusted domain" | The address in your browser is not in `trusted_domains`. Add it: `docker compose exec -u www-data nextcloud php occ config:system:set trusted_domains 1 --value="cloud.example.com"`. |
| Installation seems stuck on first start | It can take a few minutes. Watch `docker compose logs -f nextcloud`. If it keeps failing, check the database variables and that `db` is healthy. |
| Redirects to `http://` or mixed content errors behind a proxy | Set `OVERWRITEPROTOCOL=https`, `OVERWRITEHOST`, and `TRUSTED_PROXIES` for the `nextcloud` service, then run `docker compose up -d`. |
| Large uploads fail | Raise the limit in the reverse proxy as well (for Nginx, `client_max_body_size`), in addition to `PHP_UPLOAD_LIMIT`. |
| Overview says background jobs have not run | Check that the `cron` container is running and that you ran `occ background:cron`. |
| `permission denied` running docker | You have not re-logged in since being added to the `docker` group. Run `newgrp docker` or log out and back in. |
| Changed the DB password but Nextcloud cannot connect | PostgreSQL only reads `POSTGRES_PASSWORD` when the volume is first created, and Nextcloud stores its copy in `config.php`. Change the password inside PostgreSQL and update `dbpassword` in `config.php`, or recreate the volumes (this wipes data). |

## What's next

Nextcloud is up and running. Next, create users and groups, set up sharing, and connect an identity provider for SSO.