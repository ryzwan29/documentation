---
sidebar_position: 3
title: Realm, Groups and Users
description: Create the homelab realm in Keycloak, set up the group structure, and create local users that are ready for Google account linking.
tags: [keycloak, sso]
---

# Realm, Groups, and Users

This guide sets up the base of the SSO: a dedicated realm, the groups used to control access per application, and local users. Do this once. Every application guide (Nextcloud, Vaultwarden, Grafana, and so on) builds on it.

## Prerequisites

- Keycloak is installed and reachable over HTTPS (see [Install Keycloak](./install-keycloak)).
- You can log in to the admin console with an admin account.

## Create the realm

Do not use the `master` realm for applications. It is reserved for managing Keycloak itself.

1. Create new realm on **Manage realms** setting 
2. Fill in:

| Field | Value |
| --- | --- |
| Realm name | `homelab` |
| Enabled | `ON` |

3. Click **Create**. The console switches to the new realm.

:::warning
Always check the realm name in the top left before creating anything. Groups, users, and clients created in `master` by mistake do not move to `homelab`.
:::

### Realm settings

Open **Realm settings** in the `homelab` realm.

**General**

| Field | Value |
| --- | --- |
| Display name | `Homelab SSO` |

**Login tab**

| Field | Value | Note |
| --- | --- | --- |
| User registration | `OFF` | Users are created by the admin, nobody can sign up on their own. |
| Forgot password | `ON` | |
| Remember me | `ON` | |
| Verify email | `OFF` | Turn it on only after SMTP is configured, otherwise users get stuck. |
| Login with email  | `ON` | |

**Tokens tab**

| Field | Value |
| --- | --- |
| Access Token Lifespan | `5 minutes` |

**Sessions tab**

| Field | Value |
| --- | --- |
| SSO Session Idle | `12 hours` |
| SSO Session Max | `10 days` |

These session values avoid daily re-login on a personal homelab. Adjust them to taste.

## Create the groups

Groups map to permissions in each application. For example, `grafana-admin` becomes the Admin role in Grafana, and `admins` can be mapped to the admin of other services.

Target structure:
![Group Tree](<img/Screenshot 2026-10-03 185617.png>)
```
/family
├── /family/admins        (admins of all services)
├── /family/members       (regular users, standard access)
/apps
├── /apps/grafana-admin
├── /apps/grafana-viewer
└── /apps/immich-admin
```

The `/` is only the path notation. You never type it in a group name.

### Top-level groups

1. Go to **Groups → Create group**.
2. Create `family`, then create `apps`.

### Child groups

1. Click the `family` group, open the **Child groups** tab, and click **Create group**.
2. Create `admin`, then repeat for `user`.
3. Click the `apps` group, open **Child groups**, and create `grafana-admin`, `grafana-viewer`, and `immich-admin`.

The paths are built automatically: `/family/admins`, `/family/members`, `/apps/grafana-admin`, and so on.

:::info
A child group inherits the role mapping of its parent. If you assign a base role to `/family`, both `admins` and `members` get it.
:::

:::tip
Keep child group names unique across the realm (`admins`, `members`, `grafana-admin`, ...). The `groups` claim is later sent without the full path, so two groups with the same name under different parents would clash.
:::

## Create users

Every person who will sign in with Google also needs a **local user** in Keycloak. Google login is linked to this user on the first login, so the email must match.

### Create the user

1. Go to **Users → Create new user**.
2. Fill in:

| Field | Value |
| --- | --- |
| Username | `rizwan.fairuz` |
| Email | `rizwanfairuz@gmail.com` |
| First name | Your first name |
| Last name | Your last name |
| Email verified | `ON` |
| Required user actions | Leave empty for your own account |

3. Under **Groups**, click **Join Groups** and select the groups (you can also do this later), then click **Create**.

:::warning
The **Email** must be exactly the same as the Google account the person will sign in with. Keycloak matches the Google login to the local user by email. If they differ, the link fails.
:::

### Set a password

The password is needed once, as proof of ownership when the Google account is linked (see [Account Linking](./account-linking)). It is not needed for daily login afterwards.

1. Open the user, then the **Credentials** tab, and click **Set password**.
2. Enter a strong password and set **Temporary** to `OFF`, then click **Save**.

:::tip
For a family member, set **Required user actions** to **Update password** and give them a temporary password. They change it themselves on their first login. If **Temporary** is `ON`, Keycloak adds this action automatically.
:::

### Join the user to groups

Use either method:

- **Users →** select the user **→ Groups → Join Group**
- **Groups →** select the group **→ Members → Add member**

Example for the admin account:

| Group |
| --- |
| `/family/admins` |
| `/apps/grafana-admin` |
| `/apps/immich-admin` |

A regular family member only joins `/family/members`, plus an `/apps/...` group if they need extra access to a specific application.

### Verify

1. Open **Users** and search by email to make sure there is exactly one user per email.
2. Open the user and check that **Enabled** is `ON`, **Email verified** is `ON`, and the **Groups** tab lists the expected groups.

## User onboarding flow

For every new person, repeat this:

1. Admin creates the local user with the correct email, sets a password, and joins the user to a group.
2. Admin gives the person their username and password.
3. The person signs in with Google once and enters the local password when asked, which links the accounts.
4. From then on, they sign in with Google only.

## What's next

The groups only reach the applications once they are included in the token. Continue with the `groups` client scope and mapper, then create a client for each application.