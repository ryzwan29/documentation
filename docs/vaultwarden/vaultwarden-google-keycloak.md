---
sidebar_position: 3
title: Vaultwarden Google Login (Keycloak SSO)
description: Enable single sign-on in Vaultwarden with Keycloak as the OpenID Connect provider, so users can sign in with their Google account.
tags: [vaultwarden, keycloak, sso]
---

# Vaultwarden SSO (Keycloak)

This guide connects Vaultwarden to Keycloak using its built-in OpenID Connect support. Users click **Enterprise single sign-on**, land on Keycloak, and sign in with Google. Vaultwarden never talks to Google directly.

```
Vaultwarden  ->  Keycloak (realm: homelab)  ->  Google
```

:::info
SSO only proves who the user is. It does not replace the **master password**, which Bitwarden uses to encrypt and unlock the vault. Users still need one.
:::

## Prerequisites

Complete these guides first. Each one is done once for the whole realm, not per application.

| Guide | What it gives you |
| --- | --- |
| [Install Vaultwarden](./install-vaultwarden.md) | A running Vaultwarden at `https://vault.rizwan.my.id` behind HTTPS (version 1.35 or newer, which added SSO). |
| [Install Keycloak](../keycloak/install-keycloak.md) | A running Keycloak at `https://auth.rizwan.my.id`. |
| [Realm, Groups and Users](../keycloak/realm-groups-users.md) | The `homelab` realm and local users with the same **email** as their Google account, **Email verified** `On`. |
| [Google Identity Provider](../keycloak/google-identity-provider.md) | The `google` identity provider in the realm. |
| [Account Linking](../keycloak/account-linking.md) | The flow that links a Google login to the local user. |

Vaultwarden does not read group claims, so the [Groups Client Scope](../keycloak/groups-client-scope.md) is not needed for this application.

## Create the Keycloak client

Create the client as described in [Create an OIDC Client](../keycloak/create-oidc-client.md), using these values:

| Field | Value |
| --- | --- |
| Client ID | `vaultwarden` |
| Client authentication | `On` |
| Standard flow | `On` |
| Direct access grants | `Off` |
| Root URL | `https://vault.rizwan.my.id` |
| Home URL | `https://vault.rizwan.my.id` |
| Valid redirect URIs | `https://vault.rizwan.my.id/identity/connect/oidc-signin` |
| Valid post logout redirect URIs | `https://vault.rizwan.my.id/*` |
| Web origins | `https://vault.rizwan.my.id` |

Then copy the **Client secret** from the **Credentials** tab.

:::warning
Replace `vault.rizwan.my.id` in every URL above with the domain of your own Vaultwarden. **Web origins** must be the domain of the service only, without a path.
:::

## Configure Vaultwarden

Secrets go in a `.env` file next to the compose file. The compose file only references them, so nothing sensitive is hardcoded or committed.

### Create the .env file

```bash
cd /opt/vaultwarden
nano .env
```

```ini
# Hashed admin token. Keep the single quotes, the hash contains "$".
ADMIN_TOKEN='$argon2id$v=19$m=65540,t=3,p=4$replace-with-your-hash'

# Client secret from Keycloak: Clients -> vaultwarden -> Credentials
SSO_CLIENT_SECRET=replace-with-client-secret
```

Lock the file down:

```bash
chmod 600 .env
```

:::tip
If you do not have a hashed admin token yet, generate one with `docker run --rm -it vaultwarden/server /vaultwarden hash`, as described in [Install Vaultwarden](./install-vaultwarden.md). A plain text `ADMIN_TOKEN` works but Vaultwarden warns about it at startup.
:::

Add `.env` to `.gitignore` if the directory is in a repository.

### Update the compose file

```yaml
services:
  vaultwarden:
    image: vaultwarden/server:1.37.3
    container_name: vaultwarden
    restart: unless-stopped
    environment:
      DOMAIN: "https://vault.rizwan.my.id"
      SIGNUPS_ALLOWED: "false"
      ADMIN_TOKEN: ${ADMIN_TOKEN}

      # === SSO / OIDC via Keycloak ===
      SSO_ENABLED: "true"
      SSO_ONLY: "false"
      SSO_AUTHORITY: "https://auth.rizwan.my.id/realms/homelab"
      SSO_CLIENT_ID: "vaultwarden"
      SSO_CLIENT_SECRET: ${SSO_CLIENT_SECRET}
      SSO_SCOPES: "openid email profile offline_access"
      SSO_PKCE: "true"
      SSO_SIGNUPS_MATCH_EMAIL: "true"
    volumes:
      - ./data:/data
    ports:
      - "192.168.18.65:8080:80"
```

Pin the image to a specific version instead of `latest`, so an upgrade only happens when you decide. Check the newest release at [github.com/dani-garcia/vaultwarden/releases](https://github.com/dani-garcia/vaultwarden/releases).

| Variable | Purpose |
| --- | --- |
| `SSO_ENABLED` | Turns on the SSO button on the login page. |
| `SSO_ONLY` | When `true`, password login is disabled and only SSO works. Keep `false` until SSO is stable. |
| `SSO_AUTHORITY` | The Keycloak **issuer** URL: `https://<keycloak>/realms/<realm>`. No `/.well-known/...` at the end. |
| `SSO_CLIENT_ID` | Must match the Client ID in Keycloak. |
| `SSO_CLIENT_SECRET` | The client secret, read from `.env`. |
| `SSO_SCOPES` | Scopes to request. `openid email profile` is enough. |
| `SSO_PKCE` | Uses PKCE for the code exchange. Keep `true`. |
| `SSO_SIGNUPS_MATCH_EMAIL` | Links the SSO login to an existing Vaultwarden account with the same email. |
| `DOMAIN` | Must be exactly the public URL, because it is used to build the redirect URI. |

### Check and start

Check that the variables are read, without printing the secrets in your terminal history:

```bash
docker compose config --quiet && echo OK
```

Check that the container can reach Keycloak, then start:

```bash
docker compose up -d --force-recreate
docker exec vaultwarden curl -sS -o /dev/null -w "code=%{http_code}\n" \
  https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration
docker logs -f vaultwarden
```

You should see `code=200` and no `SSO` or `discovery` errors in the log. If the image has no `curl`, run the same test from the host instead.

:::warning
The container must resolve `auth.rizwan.my.id` itself, not only your browser. With split DNS this often needs the DNS server set in `/etc/docker/daemon.json` (or `dns:` in the compose file). Otherwise the login fails with `Failed to discover OpenID provider`.
:::

## Test the login

<video controls muted playsInline width="100%">
  <source src="/video/vaultwarden-google-login.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

*Demo: signing in to Vaultwarden with Google through Keycloak.*

1. Open `https://vault.rizwan.my.id` in a private window.
2. Enter the email and click **Continue**, then **Use single sign-on**. (On older web vault versions the button is **Enterprise single sign-on**.)
3. Enter any **SSO identifier**, for example `homelab`. It is only a label and is not checked against Keycloak.
4. On the Keycloak page, click **Google** and sign in. On the first login, enter the **local password** to link the account (see [Account Linking](../keycloak/account-linking.md)).
5. You return to Vaultwarden. Enter the **master password** to unlock the vault.

## How accounts are matched

| Situation | Result |
| --- | --- |
| A Vaultwarden account with the same email already exists | SSO links to it (`SSO_SIGNUPS_MATCH_EMAIL`). Unlock it with the existing master password. |
| No account exists and sign-ups are closed | The SSO login is rejected. Invite the user from the admin page, or enable `SIGNUPS_ALLOWED` temporarily. |
| The user is invited from the admin page | The SSO login creates the account, and Vaultwarden asks for a new master password. |
| The email on the Keycloak user is not verified | The login is rejected. Set **Email verified** to `On` on the user. |

:::tip
Create users in this order: Keycloak user first (with a verified email), then the Vaultwarden account or invitation with the same email.
:::

## Optional: SSO only

When SSO works for everyone, you can disable password login for the web vault:

```yaml
SSO_ONLY: "true"
```

Recreate the container with `docker compose up -d`. Keep at least one way to recover: do not do this until the admin account has been tested, and keep access to the `/admin` page.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Failed to discover OpenID provider: Request failed` | The container cannot resolve or reach `SSO_AUTHORITY`. | Fix DNS for the container, and test the discovery URL from inside it. Check that `SSO_AUTHORITY` is the issuer URL. |
| No SSO button | Version older than 1.35, `SSO_ENABLED` is not `true`, or the container was not recreated. | Pin a version that supports SSO and run `docker compose up -d --force-recreate`. |
| `Invalid parameter: redirect_uri` | The redirect URI in Keycloak does not match. | It must be exactly `https://vault.rizwan.my.id/identity/connect/oidc-signin`, and `DOMAIN` must be `https://vault.rizwan.my.id`. |
| `invalid_client` or unauthorized | Wrong client secret. | Copy the secret again from **Credentials**, update `.env`, and recreate the container. |
| `Invalid username or password` on the Keycloak page | The user has no local password, or the Google password was typed at the link step. | Set it under **Users → Credentials**. See [Account Linking](../keycloak/account-linking.md). |
| SSO login rejected after Keycloak | The email is not verified, sign-ups are closed, or the email differs from the Vaultwarden account. | Check **Email verified**, the invitation, and that both emails are identical. |
| The admin token no longer works | `ADMIN_TOKEN` was changed, or `$` characters were expanded. | Keep the hash in single quotes in `.env` and recreate the container. |

For details, read the log:

```bash
docker logs --tail 50 vaultwarden
```

:::warning
Never paste the client secret or the admin token into chats or tickets. If one is exposed, regenerate the secret in Keycloak (**Credentials → Regenerate**), update `.env`, and recreate the container.
:::