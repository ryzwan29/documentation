---
sidebar_position: 4
title: Google Identity Provider
description: Create an OAuth client in Google Cloud and add Google as an Identity Provider in the homelab realm, so users can sign in with their Google account.
tags: [keycloak, sso, google]
---

# Google Identity Provider

This guide adds "Sign in with Google" to the `homelab` realm. Do this once. Google is only a login broker: the real identity stays in the Keycloak user, and applications never talk to Google directly.

## Prerequisites

- The `homelab` realm, groups, and local users exist (see [Realm, Groups and Users](./realm-groups-users)).
- Keycloak is reachable over HTTPS on a **public domain**, for example `auth.rizwan.my.id`.
- You have a Google account to manage the Google Cloud project.

:::warning
Google rejects redirect URIs on private suffixes such as `.local` or `.lan`. If Keycloak only answers on an internal name, put it behind a reverse proxy with a real domain and a valid certificate first.
:::

## Create the OAuth client in Google Cloud

### Create a project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project picker at the top, then **New project**.
3. Name it `homelab-sso` and click **Create**. Make sure the new project is selected.

### Configure the consent screen

1. Go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform** in newer consoles) and click **Get started**.
2. Fill in:

| Field | Value |
| --- | --- |
| App name | `Homelab SSO` |
| User support email | Your email |
| Audience | `External` |
| Contact information | Your email |

3. Accept the policy and click **Create**.
4. Open **Data Access** (or **Scopes**) and add only these scopes:

| Scope | Purpose |
| --- | --- |
| `openid` | Basic OpenID Connect login |
| `email` | Email address, used to match the local user |
| `.../auth/userinfo.profile` | Name and profile picture |

These are non-sensitive scopes, so no Google verification is needed.

### Publish the app

New apps start in **Testing** status. In this status only listed test users can sign in, and sessions are cut short.

1. Open **Audience**.
2. Click **Publish app** and confirm. The status changes to **In production**.

:::info
If you only have one or two accounts, you can stay in Testing and add them under **Test users**. Publishing is simpler for a family, because new members need no extra step on the Google side.
:::

### Create the OAuth client ID

1. Go to **Credentials → Create credentials → OAuth client ID** (or **Clients → Create client**).
2. Fill in:

| Field | Value |
| --- | --- |
| Application type | `Web application` |
| Name | `Homelab SSO` |
| Authorized JavaScript origins | Leave empty |
| Authorized redirect URIs | `https://auth.rizwan.my.id/realms/homelab/broker/google/endpoint` |

3. Click **Create**, then copy the **Client ID** and **Client secret**.

:::warning
The redirect URI must match exactly, including `https://`, the realm name `homelab`, and the path `broker/google/endpoint`. Keycloak shows the same value when you add the provider in the next step, so you can copy it from there.
:::

## Add Google in Keycloak

1. Switch to the `homelab` realm (check the top left).
2. Go to **Identity providers**, click **Google**.
3. Fill in:

| Field | Value |
| --- | --- |
| Redirect URI | Read-only. Must be the same as the one in Google. |
| Client ID | From Google |
| Client Secret | From Google |
| Hosted domain | Leave empty (only for Google Workspace) |
| Display order | Leave empty |

4. Click **Add**.

### Advanced settings

Open the `google` provider, then **Advanced settings**.

| Field | Value | Note |
| --- | --- | --- |
| Scopes | `openid email profile` | |
| Trust Email | `ON` | Google already verifies the email, so Keycloak can match it to the local user without another check. |
| Account linking only | `OFF` | If `ON`, users cannot sign in with Google at all, they can only link it from the Account Console. Keep it `OFF`. |
| Hide on login page | `OFF` | Keeps the Google button visible. |
| Sync mode | `Import` | Profile data is copied on the first login only, so manual changes by the admin are not overwritten. |
| First login flow override | Keep default for now | Changed in [Account Linking](./account-linking). |

Click **Save**.

:::info
With **Trust Email** `ON`, the "Verify existing account by Email" step of a first login flow can link accounts without sending any email or asking for a password. This is safe in this setup because the custom flow in [Account Linking](./account-linking) disables that step and requires the local password instead.
:::

:::warning
Do not test the Google login yet. With the default first login flow, a Google account whose email does not match a local user creates a **duplicate user**, and the "verify by email" option needs SMTP. Finish [Account Linking](./account-linking) first, then test.
:::

## Verify

1. Open a private browser window and go to `https://auth.rizwan.my.id/realms/homelab/account`.
2. The login page shows a **Google** button under the username and password form. Do not click it yet.
3. In the admin console, open **Identity providers** and check that `google` is **Enabled**.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` | The redirect URI in Google is different from the one in Keycloak. | Copy the **Redirect URI** from the Keycloak provider page into Google. Check the realm name, `https://`, and trailing slashes. |
| `Error 400: invalid_request` or `Access blocked: this app's request is invalid` | The consent screen is incomplete, or the redirect URI uses a private domain. | Finish the consent screen (app name, support email, scopes) and use a public domain with HTTPS. |
| `Error 401: invalid_client` | Wrong Client ID or Client Secret. | Paste the credentials again in Keycloak, without extra spaces. |
| `Access blocked: ... has not completed the Google verification process` | The app is in Testing and the account is not a test user. | Add the account under **Test users**, or publish the app. |
| No Google button on the login page | **Hide on login page** is `ON`, the provider is disabled, or the wrong realm is open. | Check the provider settings in the `homelab` realm. |
| Redirect URI cannot be saved in Google | The domain uses a private suffix such as `.local`. | Use a public domain with HTTPS. |

## What's next

Google can authenticate users now, but Keycloak does not know yet how to connect a Google login to an existing local user. Continue with [Account Linking](./account-linking) to create the first login flow and link the accounts.