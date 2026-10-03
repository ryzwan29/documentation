---
sidebar_position: 7
title: Create an OIDC Client
description: Register an application in Keycloak as an OpenID Connect client, get its credentials, and assign the groups scope.
tags: [keycloak, sso]
---

# Create an OIDC Client

Every application that signs users in through Keycloak is registered as a **client**. This guide covers the steps that are the same for every application. Only a few values differ per application, mainly the redirect URI, and those belong in the guide of that application.

## Prerequisites

- The `homelab` realm exists (see [Realm, Groups and Users](./realm-groups-users)).
- The `groups` client scope exists if the application needs group information (see [Groups Client Scope](./groups-client-scope)).
- You know the public URL of the application, for example `https://app.example.com`, and the redirect URI its documentation asks for.

## Create the client

1. Switch to the `homelab` realm (check the top left).
2. Go to **Clients → Create client**.

### General settings

| Field | Value | Note |
| --- | --- | --- |
| Client type | `OpenID Connect` | |
| Client ID | A short, lowercase name, for example `myapp` | Used in the application config. It cannot be changed later. |
| Name | Optional | Display name in the admin console. |

Click **Next**.

### Capability config

| Field | Value | Note |
| --- | --- | --- |
| Client authentication | `On` | Makes it a confidential client with a secret. Use this for applications that have a server side. |
| Authorization | `Off` | Only needed for fine-grained authorization services. |
| Standard flow | `On` | The Authorization Code flow. This is the normal browser login. |
| Direct access grants | `Off` | Lets the application send the user's password to Keycloak. Not needed. |
| Implicit flow | `Off` | Legacy and not recommended. |

Click **Next**.

:::info
Turn **Client authentication** `Off` only for public clients that cannot keep a secret, such as a browser-only app or a mobile app. Those must use PKCE. If the application documentation asks for a "public client", follow that instead.
:::

### Login settings

| Field | Value | Note |
| --- | --- | --- |
| Root URL | `https://app.example.com` | Base URL of the application. Relative values in the fields below are added to it. |
| Home URL | `https://app.example.com` | Where Keycloak sends the user from the account console. |
| Valid redirect URIs | The callback URL from the application documentation | See the rules below. |
| Valid post logout redirect URIs | `https://app.example.com/*` | Or `+` to reuse the redirect URIs. |
| Web origins | `https://app.example.com` | Origin only, without a path. Or `+` to reuse the redirect URIs. |

Click **Save**.

### Rules for the URL fields

| Field | Rule |
| --- | --- |
| Valid redirect URIs | Must match the URI the application sends **exactly**: scheme, host, port, and path. A single `*` at the end allows any path under it. |
| Valid post logout redirect URIs | Where Keycloak may send the user after logout. |
| Web origins | Only `scheme://host[:port]`. A path in this field is wrong. It is used for CORS. |

:::warning
Avoid a bare `*` as redirect URI. It lets any address receive the login response. Keep the URI as specific as the application allows.
:::

## Get the credentials

1. Open the client and go to the **Credentials** tab.
2. Make sure **Client Authenticator** is `Client Id and Secret`.
3. Copy the **Client secret**.

The application needs these values:

| Value | Where to find it | Example |
| --- | --- | --- |
| Client ID | The ID you chose | `myapp` |
| Client secret | **Credentials** tab | Copy from Keycloak |
| Issuer / discovery URL | Fixed per realm | `https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration` |

Some applications want the issuer without the `.well-known/...` part: `https://auth.rizwan.my.id/realms/homelab`. Others ask for the authorization, token, and userinfo endpoints separately. All of them are listed in the discovery URL.

:::warning
Treat the client secret like a password. Keep it in a `.env` file or a secret manager, never in a repository, and do not paste it into chats or tickets. Each client has its own secret, so do not reuse one across applications.

If a secret leaks, open **Credentials** and click **Regenerate**, then update the application.
:::

## Assign the groups scope

Skip this if the application does not use groups.

1. Open the client and go to the **Client scopes** tab.
2. Click **Add client scope**, select `groups`, and click **Add → Default**.

The table now has a `groups` row with the assigned type **Default**. The `<client>-dedicated` row is built in. Leave it alone.

## Verify the client

### Check the token

1. In the client, open **Client scopes → Evaluate**.
2. Under **Users**, select a user who is in at least one group.
3. Open **Generated ID token** and check that the `groups` claim is there.

### Check the discovery URL

Open the discovery URL in a browser, or from the machine that runs the application:

```bash
curl -sS https://auth.rizwan.my.id/realms/homelab/.well-known/openid-configuration
```

It must return JSON, and `issuer` must be exactly `https://auth.rizwan.my.id/realms/homelab`. The application must be able to reach this URL itself, not only your browser.

### Test the login

Configure the application with the values above, open it in a private browser window, and start the login. A successful test sends you to Keycloak and back to the application, signed in.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Invalid parameter: redirect_uri` | The URI sent by the application is not in **Valid redirect URIs**. | Compare it character by character with the `redirect_uri` parameter in the browser address bar. Check `http` vs `https`, the port, and trailing slashes. |
| `Client not found` | The Client ID in the application does not match. | Copy the Client ID again. It is case sensitive. |
| `invalid_client` or `Invalid client credentials` | Wrong or old client secret. | Copy the secret again from **Credentials**. Check for spaces and for shell characters like `$` in `.env` files. |
| `Invalid scopes` | The application requests a scope that does not exist in the realm. | Create the scope, or remove it from the application config. |
| The application cannot reach the provider | DNS, firewall, or certificate problem between the application and Keycloak. | Test the discovery URL from inside the application's container or server. |
| `Invalid username or password` on the Keycloak page | The user has no local password, or the account is not linked yet. | See [Account Linking](./account-linking). |
| Login works but groups are missing | The `groups` scope is not assigned, or the application does not read the claim. | Check the **Client scopes** tab and the evaluated token. |
| Users get logged out after a short time | Session lifetimes are short in the realm. | Check **Realm settings → Sessions**. |

## What's next

The client is ready. Continue with the guide of the application you want to connect, and use the Client ID, secret, and discovery URL from this page.