---
sidebar_position: 2
title: Install Keycloak
description: Install Keycloak with Docker Compose and PostgreSQL on Ubuntu.
tags: [keycloak]
---

# Install Keycloak

This guide installs Keycloak on an Ubuntu server using Docker Compose, with PostgreSQL as the database. By the end you will have a running Keycloak instance and be logged in to the admin console.

## Prerequisites

- An Ubuntu server (22.04 or newer) with `sudo` access.
- At least 2 vCPU and 2 GB of RAM. 4 GB is more comfortable.
- A hostname or DNS name for Keycloak (for example `auth.example.com`). For a quick lab you can use the server IP instead.
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
sudo mkdir -p /opt/keycloak
sudo chown $USER:$USER /opt/keycloak
cd /opt/keycloak
```

### Create the environment file

Keep all secrets and version settings in a `.env` file so the compose file stays clean and can be committed or shared safely.

First, generate two strong passwords:

```bash
openssl rand -base64 32   # use for POSTGRES_PASSWORD
openssl rand -base64 32   # use for KC_BOOTSTRAP_ADMIN_PASSWORD
```

Then create the file:

```bash
nano /opt/keycloak/.env
```

```ini
# Keycloak image tag. Pin a specific version, avoid "latest".
# Check the newest release at https://www.keycloak.org/downloads
KEYCLOAK_VERSION=26.8.0

# Public URL users will use to reach Keycloak
KC_HOSTNAME=https://auth.example.com

# Temporary admin account, created on first start only
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=change-me

# PostgreSQL
POSTGRES_DB=keycloak
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=change-me-too
```

Lock the file down so only your user can read it:

```bash
chmod 600 /opt/keycloak/.env
```

:::tip
For a quick lab without DNS or TLS, set `KC_HOSTNAME=http://<server-ip>:8080` (replace `<server-ip>` with your server's IP address).
:::

### Create the Docker Compose file

```bash
nano /opt/keycloak/docker-compose.yml
```

```yaml
services:
  postgres:
    image: postgres:17
    container_name: keycloak-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - keycloak-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  keycloak:
    image: quay.io/keycloak/keycloak:${KEYCLOAK_VERSION}
    container_name: keycloak
    restart: unless-stopped
    command: start
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      # Database
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      KC_DB_USERNAME: ${POSTGRES_USER}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}

      # Initial admin (first start only)
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KC_BOOTSTRAP_ADMIN_USERNAME}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KC_BOOTSTRAP_ADMIN_PASSWORD}

      # Hostname and HTTP
      KC_HOSTNAME: ${KC_HOSTNAME}
      KC_HTTP_ENABLED: "true"

      # Only enable this when Keycloak sits behind a reverse proxy
      # that sets the X-Forwarded-* headers (Nginx, Traefik, Caddy, ...)
      # KC_PROXY_HEADERS: xforwarded

      # Exposes /health endpoints on the management port (9000)
      KC_HEALTH_ENABLED: "true"
    ports:
      - "8080:8080"
    networks:
      - keycloak-net

volumes:
  postgres_data:

networks:
  keycloak-net:
```

A few notes on this file:

- `command: start` runs Keycloak in production mode. For throwaway testing you can switch it to `start-dev`, but never use that for anything real.
- `depends_on` with `service_healthy` makes Keycloak wait until PostgreSQL is actually ready to accept connections.
- Data lives in the `postgres_data` named volume, so it survives container restarts and re-creation.
- If you run a reverse proxy on the same host, bind the port to localhost only with `"127.0.0.1:8080:8080"` and uncomment `KC_PROXY_HEADERS`.

## Start Keycloak

Validate the file first. This prints the resolved config and catches typos or missing variables:

```bash
cd /opt/keycloak
docker compose config
```

Then start the stack in the background:

```bash
docker compose up -d
```

Follow the logs until Keycloak finishes booting:

```bash
docker compose logs -f keycloak
```

You should see a line saying Keycloak has started. Press `Ctrl+C` to stop following the logs (the containers keep running).

Check the status of both containers:

```bash
docker compose ps
```

## Log in to the admin console

Open the URL you set in `KC_HOSTNAME` in your browser, then go to the admin console at:

```
https://auth.example.com/admin
```

Log in with `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` from your `.env` file.

:::warning
The bootstrap admin is meant to be temporary. After your first login, create a permanent admin user with its own strong password (and MFA), then delete the bootstrap account.
:::

## Day-to-day operations

### Stop, start, and restart

```bash
cd /opt/keycloak
docker compose stop
docker compose start
docker compose restart keycloak
```

### Back up the database

```bash
cd /opt/keycloak
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > keycloak-backup-$(date +%F).sql
```

Store the dump somewhere other than this server.

### Upgrade Keycloak

1. Take a database backup (see above).
2. Read the release notes and upgrading guide for the version you are moving to.
3. Change `KEYCLOAK_VERSION` in `.env`.
4. Pull the new image and recreate the container:

```bash
cd /opt/keycloak
docker compose pull keycloak
docker compose up -d
docker compose logs -f keycloak
```

Keycloak migrates the database schema automatically on startup, which is why the backup matters.

### Remove everything

This deletes the containers **and all data**:

```bash
cd /opt/keycloak
docker compose down -v
```

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Cannot reach the page | Check `docker compose ps`, then the firewall. With UFW: `sudo ufw allow 8080/tcp`. |
| "HTTPS required" in the browser | Keycloak only allows plain HTTP from localhost and private network addresses by default. Put it behind a TLS reverse proxy, or access it from a private IP while testing. |
| Keycloak exits right after starting | Run `docker compose logs keycloak`. Usually a wrong database URL or password, or a missing `KC_HOSTNAME`. |
| Login redirects to the wrong URL | `KC_HOSTNAME` does not match the URL in your browser. Fix it and run `docker compose up -d`. |
| `permission denied` running docker | You have not re-logged in since being added to the `docker` group. Run `newgrp docker` or log out and back in. |
| Changed the DB password but Keycloak cannot connect | PostgreSQL only reads `POSTGRES_PASSWORD` when the volume is first created. Change the password inside PostgreSQL, or recreate the volume (this wipes data). |

## What's next

Keycloak is up and running. Next, create your first realm, register a client, and connect an application.