---
sidebar_position: 3
title: Nextcloud Google Login (Keycloak SSO)
description: Add "Login with Google" to Nextcloud using the user_oidc app and Keycloak as the OpenID Connect provider.
tags: [nextcloud, keycloak]
---

# Nextcloud Google Login (Keycloak SSO)

This guide connects Nextcloud to Keycloak with the `user_oidc` app, so users sign in with their Google account. Nextcloud never talks to Google directly: it talks to Keycloak (OIDC), and Keycloak handles Google as an identity provider.

```
Nextcloud  ->  Keycloak (realm: homelab)  ->  Google
```

## Assumptions

- Nextcloud is already installed and reachable at `https://cloud.rizwan.my.id` (check with the command below, it must print `installed: true`).
- Keycloak runs at `https://auth.rizwan.my.id`, with the realm `homelab`, the `google` identity provider, and the `groups` client scope already created.
- The `first-broker-login-homelab` flow is set on the Google identity provider, and each user already exists in Keycloak with a **local password** and the same **email** as their Google account.

```bash
docker exec -u www-data nextcloud-app php occ status | grep installed
```

## Create the Keycloak client

In the Keycloak admin console, select the `homelab` realm, then **Clients → Create client**.

### General settings

| Field | Value |
| --- | --- |
| Client type | `OpenID Connect` |
| Client ID | `nextcloud` |

### Capability config

| Field | Value |
| --- | --- |
| Client authentication | `ON` |
| Authorization | `OFF` |
| Standard flow | `ON` |
| Direct access grants | `OFF` |

### Login settings

| Field | Value |
| --- | --- |
| Root URL | `https://cloud.rizwan.my.id` |
| Home URL | `https://cloud.rizwan.my.id` |
| Valid redirect URIs | `https://cloud.rizwan.my.id/apps/user_oidc/code` |
| Valid post logout redirect URIs | `https://cloud.rizwan.my.id/*` |
| Web origins | `https://cloud.rizwan.my.id` |

:::warning
The redirect URI for `user_oidc` is `/apps/user_oidc/code`. The path `/apps/oidc_login/oidc/*` belongs to a different plugin (`oidc_login`) and causes `Invalid parameter: redirect_uri`.
:::

### Copy the secret and assign the groups scope

1. Open the client, go to the **Credentials** tab, and copy the **Client secret**.
2. Go to **Client scopes → Add client scope**, select `groups`, and add it as **Default**.

## Install the user_oidc app

Download the latest release from the GitHub releases page:

```
https://github.com/nextcloud-releases/user_oidc/releases
```

Pick the newest `user_oidc-*.tar.gz`, copy it to the Nextcloud server, then extract it into `custom_apps` and enable it:

```bash
sudo mkdir -p /mnt/nextcloud/html/custom_apps
sudo tar -xzf user_oidc-*.tar.gz -C /mnt/nextcloud/html/custom_apps/
sudo chown -R 33:33 /mnt/nextcloud/html/custom_apps/user_oidc
docker exec -u www-data nextcloud-app php occ app:enable user_oidc
```

Expected output:

```
user_oidc 8.11.0 enabled
```

:::tip
`docker exec -u www-data nextcloud-app php occ app:install user_oidc` also works when the app store is reachable. If it fails with `not found on the appstore`, the app store may be rate limiting your IP (HTTP `429`). Use the manual install above instead of retrying.
:::

## Allow connections to local servers

Keycloak usually resolves to a private IP inside the LAN (split DNS). Nextcloud blocks requests to local addresses by default, which shows up as `Could not reach the OpenID Connect provider`. Allow it:

```bash
docker exec -u www-data nextcloud-app php occ config:system:set allow_local_remote_servers --value=true --type=boolean
```

The Nextcloud container must also be able to resolve `auth.rizwan.my.id`. Test it from inside the container:

```bash
docker exec nextcloud-app curl -sS -o /dev/null -w "code=%{http_code}\n" \
  https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration
```

You should get `code=200`. If the host does not resolve, set the DNS server in `/etc/docker/daemon.json` (or `dns:` in the compose file) and restart Docker.

## Register the provider

The provider **identifier** is the text shown on the login button, and it cannot be renamed later. Use `Google` so the button reads "Login with Google".

```bash
docker exec -u www-data nextcloud-app php occ user_oidc:provider Google \
  --clientid="nextcloud" \
  --clientsecret="SECRET" \
  --discoveryuri="https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration" \
  --scope="openid email profile groups" \
  --unique-uid=0 \
  --mapping-uid=preferred_username \
  --mapping-display-name=name \
  --mapping-email=email \
  --group-provisioning=1 \
  --mapping-groups=groups
```

What the options do:

| Option | Purpose |
| --- | --- |
| `--unique-uid=0` | Use the readable username as the Nextcloud user ID instead of a long hash. |
| `--mapping-uid=preferred_username` | Take the user ID from the Keycloak username. |
| `--mapping-display-name=name` | Display name comes from the `name` claim. |
| `--mapping-email=email` | Email comes from the `email` claim. |
| `--group-provisioning=1` | Create and sync groups from the token. |
| `--mapping-groups=groups` | Read groups from the `groups` claim. |

The command prints nothing on success. Verify it:

```bash
docker exec -u www-data nextcloud-app php occ user_oidc:provider
```

```
+----+------------+---------------------------------------------------------------------------+-----------+
| ID | Identifier | Discovery endpoint                                                        | Client ID |
+----+------------+---------------------------------------------------------------------------+-----------+
| 1  | Google     | https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration | nextcloud |
+----+------------+---------------------------------------------------------------------------+-----------+
```

:::warning
The client secret ends up in your shell history. Remove the entry with `history -d <number>`, or regenerate the secret in Keycloak and update it with:

```bash
docker exec -u www-data nextcloud-app php occ user_oidc:provider Google --clientsecret="NEW_SECRET"
```
:::

To remove a provider you no longer need:

```bash
docker exec -u www-data nextcloud-app php occ user_oidc:provider:delete Google
```

## Test the login

1. Open `https://cloud.rizwan.my.id` in a private window.
2. Click **Login with Google**.
3. On the Keycloak page, choose Google and sign in.
4. On the first login, Keycloak asks for the **local password** of the user to link the Google account. Later logins skip this.
5. You are redirected back to Nextcloud and the user is created automatically.

## Make a user admin

Groups from Keycloak (for example `admins`) do not match the built-in Nextcloud group `admin`. After the user's first login, add them manually:

```bash
docker exec -u www-data nextcloud-app php occ group:adduser admin rizwan.fairuz
```

:::tip
Keep the local `admin` account as a break-glass login, and do not disable password login until SSO is stable. If you get locked out of the SSO redirect, use `https://cloud.rizwan.my.id/login?direct=1`.
:::

## Optional: clean up the login page

Disable the "Forgot password?" link:

```bash
docker exec -u www-data nextcloud-app php occ config:system:set lost_password_link --value=disabled
```

"Log in with a device" has no setting. Hide it with CSS in **Administration settings → Theming → Custom CSS**. Inspect the element first, because selectors change between versions:

```css
a[href*="webauthn"] { display: none !important; }
```

:::info
CSS only hides the element, it does not turn off the feature. The same applies to a Google logo on the button: add it with a `::before` rule on the button's selector and an inline SVG data URI.
:::

To skip the Keycloak page and jump straight to Google, open Keycloak **Authentication → Flows → browser**, click the gear on **Identity Provider Redirector**, and set **Default Identity Provider** to `google`. This applies to every login in the realm, so local Keycloak logins are no longer shown.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `Nextcloud is not installed - only a limited number of commands are available` | The first-start install has not finished. Wait, then check `occ status` and `docker logs nextcloud-app`. |
| `Could not download app user_oidc, it was not found on the appstore` | App store rate limit (`429`) or no route. Install manually from the GitHub release. |
| `There are no commands defined in the "user_oidc" namespace` | The app is not enabled yet. Run `occ app:enable user_oidc`. |
| `Could not reach the OpenID Connect provider` | The container cannot resolve or reach Keycloak, or local servers are blocked. Fix DNS and set `allow_local_remote_servers` to `true`. |
| `Invalid parameter: redirect_uri` | The redirect URI in Keycloak must be exactly `https://cloud.rizwan.my.id/apps/user_oidc/code`. |
| `invalid_client` or unauthorized | Wrong client secret. Update it with `--clientsecret`. |
| `Invalid username or password` on first Google login | The user has no local password in Keycloak, or the wrong one was entered. Set it under **Users → Credentials**. |
| Untrusted domain | Check `NEXTCLOUD_TRUSTED_DOMAINS` and the headers sent by the reverse proxy. |
| A second user such as `rizwan.fairuz_1` appears | The user ID mapping changed after the first login. Keep `--unique-uid=0` and `--mapping-uid=preferred_username` consistent. |

For details, read the Nextcloud log:

```bash
docker exec nextcloud-app tail -n 30 /var/www/html/data/nextcloud.log
```