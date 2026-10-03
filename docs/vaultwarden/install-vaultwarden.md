---
sidebar_position: 2
title: Install Vaultwarden
description: Install Vaultwarden with Docker Compose and Caddy (automatic HTTPS) on Ubuntu.
tags: [vaultwarden]
---

# Install Vaultwarden

This guide installs Vaultwarden on an Ubuntu server using Docker Compose, with Caddy as a reverse proxy that provides automatic HTTPS. By the end you will have a running Vaultwarden instance, a user account, and access to the admin page.

HTTPS is not optional here. The Bitwarden clients only work with a server that is served over HTTPS, so this guide includes the reverse proxy from the start.

## Prerequisites

- An Ubuntu server (22.04 or newer) with `sudo` access.
- At least 1 vCPU and 1 GB of RAM. Vaultwarden itself uses very little.
- A DNS name pointing to the server (for example `vault.example.com`). Caddy needs it to get a certificate.
- Ports `80` and `443` reachable from the internet (port `80` is used to issue the certificate). If the server is only for your LAN, see the tip in the Caddy section.

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
sudo mkdir -p /opt/vaultwarden
sudo chown $USER:$USER /opt/vaultwarden
cd /opt/vaultwarden
```

### Generate the admin token

The admin page (`/admin`) is protected by a token. Store it as a hash, not as plain text. Run the built-in helper and enter a strong password when prompted:

```bash
docker run --rm -it vaultwarden/server /vaultwarden hash
```

The command prints a line like `ADMIN_TOKEN='$argon2id$v=19$m=...'`. Copy the whole value, including the single quotes. You will paste it into `.env` in the next step. The password you typed is what you use to log in to the admin page; the hash is what goes in the config.

### Create the environment file

Keep all secrets and version settings in a `.env` file so the compose file stays clean and can be committed or shared safely.

```bash
nano /opt/vaultwarden/.env
```

```ini
# Vaultwarden image tag. Pin a specific version, avoid "latest".
# Check the newest release at https://github.com/dani-garcia/vaultwarden/releases
VAULTWARDEN_VERSION=1.34.3

# Public domain users will use to reach Vaultwarden (no scheme, no port)
VAULTWARDEN_DOMAIN=vault.example.com

# Hashed admin token from the previous step. Keep the single quotes.
ADMIN_TOKEN='$argon2id$v=19$m=65540,t=3,p=4$replace-with-your-hash'

# Allow open registration. Set to "false" after your accounts are created.
SIGNUPS_ALLOWED=true
```

Lock the file down so only your user can read it:

```bash
chmod 600 /opt/vaultwarden/.env
```

:::warning
Keep the single quotes around `ADMIN_TOKEN`. The hash contains `$` characters, and without the quotes Docker Compose tries to expand them as variables and the token breaks.
:::

### Create the Caddyfile

Caddy requests and renews the HTTPS certificate automatically.

```bash
nano /opt/vaultwarden/Caddyfile
```

```
{$VAULTWARDEN_DOMAIN} {
    encode zstd gzip
    reverse_proxy vaultwarden:80
}
```

:::tip
For a LAN-only lab without public DNS, add `tls internal` inside the site block. Caddy then uses its own internal certificate authority. You need to trust that CA on your devices, and you will see browser warnings until you do.
:::

### Create the Docker Compose file

```bash
nano /opt/vaultwarden/docker-compose.yml
```

```yaml
services:
  vaultwarden:
    image: vaultwarden/server:${VAULTWARDEN_VERSION}
    container_name: vaultwarden
    restart: unless-stopped
    environment:
      DOMAIN: https://${VAULTWARDEN_DOMAIN}
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      SIGNUPS_ALLOWED: ${SIGNUPS_ALLOWED}
    volumes:
      - vw_data:/data
    networks:
      - vaultwarden-net

  caddy:
    image: caddy:2
    container_name: vaultwarden-caddy
    restart: unless-stopped
    depends_on:
      - vaultwarden
    environment:
      VAULTWARDEN_DOMAIN: ${VAULTWARDEN_DOMAIN}
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - vaultwarden-net

volumes:
  vw_data:
  caddy_data:
  caddy_config:

networks:
  vaultwarden-net:
```

A few notes on this file:

- Vaultwarden has no published ports. It is only reachable through Caddy, so every connection goes over HTTPS.
- All Vaultwarden data (the SQLite database, attachments, Send files, and keys) lives in the `vw_data` volume and survives container restarts and re-creation.
- `caddy_data` holds the issued certificates. Keep it, or Caddy has to request new ones after a re-create.
- `DOMAIN` must match the URL you use in the browser. Vaultwarden uses it for links in emails and for features such as WebAuthn.
- Vaultwarden uses SQLite by default, which is enough for a small team or a family. PostgreSQL and MySQL/MariaDB are supported through `DATABASE_URL` if you need them.

## Start Vaultwarden

Validate the file first. This prints the resolved config and catches typos or missing variables:

```bash
cd /opt/vaultwarden
docker compose config
```

Then start the stack in the background:

```bash
docker compose up -d
```

Follow the Caddy logs until the certificate is issued:

```bash
docker compose logs -f caddy
```

You should see a line saying the certificate was obtained for your domain. Press `Ctrl+C` to stop following the logs (the containers keep running).

Check the status of both containers:

```bash
docker compose ps
```

## Create your account

Open Vaultwarden in your browser:

```
https://vault.example.com
```

Select **Create account**, enter your email, and choose a master password.

:::warning
The master password cannot be recovered. If you lose it, the vault is gone. Use a long passphrase, and store a copy of it somewhere safe and offline.
:::

After your accounts are created, close registration. Set `SIGNUPS_ALLOWED=false` in `.env` and recreate the container:

```bash
cd /opt/vaultwarden
docker compose up -d
```

From now on, new users can only join by invitation from the admin page.

## Open the admin page

Go to:

```
https://vault.example.com/admin
```

Log in with the **password** you typed when generating the token (not the hash). From here you can invite users, manage organizations, and review the server configuration.

## Post-install setup

### Connect the Bitwarden clients

In any official Bitwarden app or browser extension, open the login screen, choose **Self-hosted** (the server selector), and enter `https://vault.example.com` as the server URL. Then log in with your account.

### Enable two-step login

In the web vault, open **Account settings → Security → Two-step login** and enable an authenticator app or a security key for your account before storing anything important.

### Configure email (optional)

Invitations and email verification need SMTP. Add the `SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, and `SMTP_PASSWORD` variables to the `vaultwarden` service, or set them from the admin page. Without SMTP you can still create accounts directly while `SIGNUPS_ALLOWED` is `true`.

## Day-to-day operations

### Stop, start, and restart

```bash
cd /opt/vaultwarden
docker compose stop
docker compose start
docker compose restart vaultwarden
```

### Back up Vaultwarden

Back up the **entire** data volume, not only the database. It also holds attachments, Send files, and the keys. Stop Vaultwarden briefly so the SQLite database is not written to during the copy:

```bash
cd /opt/vaultwarden
docker compose stop vaultwarden

docker run --rm \
  -v vaultwarden_vw_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/vaultwarden-data-$(date +%F).tar.gz -C /data .

docker compose start vaultwarden
```

The volume name is prefixed with the compose project name, which defaults to the directory name. Check the exact name with `docker volume ls`.

Store the archive somewhere other than this server, and test a restore at least once.

### Upgrade Vaultwarden

1. Take a backup (see above).
2. Read the release notes for the version you are moving to.
3. Change `VAULTWARDEN_VERSION` in `.env`.
4. Pull the new image and recreate the container:

```bash
cd /opt/vaultwarden
docker compose pull
docker compose up -d
docker compose logs -f vaultwarden
```

Vaultwarden migrates the database automatically on startup, which is why the backup matters. Keep the Bitwarden clients updated as well.

### Remove everything

This deletes the containers **and all data**, including every vault and the issued certificates:

```bash
cd /opt/vaultwarden
docker compose down -v
```

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Caddy cannot get a certificate | Check that the DNS name points to this server, that ports `80` and `443` are open (with UFW: `sudo ufw allow 80,443/tcp`), and read `docker compose logs caddy`. |
| Browser or client says a secure context or HTTPS is required | You are reaching Vaultwarden over plain HTTP. Use the `https://` URL through Caddy. |
| Cannot reach the page | Check `docker compose ps`, the firewall, and that the domain in `.env` is the one you typed in the browser. |
| `/admin` shows "disabled" or returns an error | `ADMIN_TOKEN` is empty or was not loaded. Check `.env` and run `docker compose up -d`. |
| Admin login fails | Use the password you typed during `hash`, not the hash itself. Also check that `ADMIN_TOKEN` is wrapped in single quotes in `.env`. |
| Cannot create an account | `SIGNUPS_ALLOWED` is `false`. Invite the user from the admin page, or enable sign-ups temporarily. |
| Invitation or verification emails are not sent | SMTP is not configured or the settings are wrong. Check the Vaultwarden logs. |
| Changes in `.env` have no effect | Recreate the container with `docker compose up -d`. Compose does not apply new variables to a running container. |
| `permission denied` running docker | You have not re-logged in since being added to the `docker` group. Run `newgrp docker` or log out and back in. |

## What's next

Vaultwarden is up and running. Next, put your first logins in the vault, create an organization and collections for shared credentials, and set up scheduled backups.