---
sidebar_position: 6
title: Groups Client Scope
description: Create a shared groups client scope with a Group Membership mapper, so group membership is sent to applications in the token.
tags: [keycloak, sso]
---

# Groups Client Scope

Applications cannot see Keycloak groups by default. This guide creates a shared `groups` client scope with a **Group Membership** mapper, which adds a `groups` claim to the tokens. Create it once, then assign it to every client that needs group information.

## Prerequisites

- The `homelab` realm and the groups exist (see [Realm, Groups and Users](./realm-groups-users)).
- At least one user is a member of a group, so you have something to verify.

## How it works

```
User joins /family/admins  ->  Group Membership mapper  ->  "groups": ["admins"]  ->  token sent to the app
```

A client scope is a reusable bundle of claims. The mapper lives in the scope, and each client that uses the scope gets the claim. This is why the mapper is created only once, instead of once per application.

## Create the client scope

1. Switch to the `homelab` realm (check the top left).
2. Go to **Client scopes → Create client scope**.
3. Fill in:

| Field | Value | Note |
| --- | --- | --- |
| Name | `groups` | |
| Description | `Group membership claim used for SSO authorization.` | Free text. |
| Type | `None` | The scope is not attached to new clients automatically. You assign it per client. Choose `Default` to attach it to every new client. |
| Protocol | `OpenID Connect` | |
| Display on consent screen | `Off` | Only shown when **Consent required** is enabled on a client (off by default). |
| Consent screen text | Leave empty | Only used together with the option above. |
| Include in token scope | `On` | Adds the name `groups` to the `scope` claim. Some applications check for it. |
| Include in OpenID Provider Metadata | `On` | |
| Display Order | Leave empty | |

4. Click **Save**.

## Add the Group Membership mapper

1. Open the new `groups` scope and go to the **Mappers** tab.
2. Click **Configure a new mapper** and choose **Group Membership**.
3. Fill in:

| Field | Value | Note |
| --- | --- | --- |
| Name | `groups` | |
| Token Claim Name | `groups` | |
| Full group path | `Off` | The claim holds `admins` instead of `/family/admins`. |
| Add to ID token | `On` | |
| Add to access token | `On` | |
| Add to lightweight access token | `Off` | Only needed when you use lightweight access tokens. |
| Add to userinfo | `On` | |
| Add to token introspection | `On` | |

4. Leave the other switches at their defaults: **Add to ID token**, **Add to access token**, **Add to userinfo**, and **Add to token introspection** are `On`, **Add to lightweight access token** is `Off`.
5. Click **Save**.

:::warning
Create the mapper from **Client scopes → groups → Mappers**, not from inside a client. A mapper added in a client's own `-dedicated` scope only applies to that one client.
:::

### Full group path

Full group path decides what the application receives:

| Full group path | Claim for a user in `/family/admins` and `/apps/app-admin` |
| --- | --- |
| `Off` | `["admins", "app-admin"]` |
| `On` | `["/family/admins", "/apps/app-admin"]` |

This guide uses `Off`, because most applications are easier to configure with plain names. Everything that reads the claim must use the same style. A check for `/apps/app-admin` never matches a claim that contains `app-admin`, and the other way around.

:::tip
With `Off`, two groups with the same name under different parents (for example `/family/admins` and `/apps/admins`) produce the same value. Keep child group names unique, as in [Realm, Groups and Users](./realm-groups-users).
:::

## Assign the scope to a client

Repeat this for every client that needs group information. If the client does not exist yet, do this after [Create an OIDC Client](./create-oidc-client).

1. Go to **Clients** and open the client.
2. Open the **Client scopes** tab and click **Add client scope**.
3. Select `groups` and click **Add → Default**.

The table now has a `groups` row with the assigned type **Default**.

| Assigned type | Behavior |
| --- | --- |
| `Default` | The claim is always in the token. Use this when the application does not request the `groups` scope itself. |
| `Optional` | The claim is only included when the application asks for `scope=groups`. |

:::info
The `<client>-dedicated` row in the same table is the built-in scope of that client. Leave it alone. You do not need it because the mapper already lives in the shared `groups` scope.
:::

## Verify

1. In the client, open **Client scopes** and then the **Evaluate** sub-tab.
2. Under **Users**, select a user who is in at least one group.
3. Open **Generated ID token** (also check **Generated access token** and **Generated user info**).
4. Look for the `groups` claim:

```json
"groups": [
  "admins",
  "app-admin"
]
```

If the claim shows the groups of the user, the scope works. Repeat the check for each client.

## Use the claim in an application

The application is the one that turns group names into permissions, so its configuration must match the claim. Look for these settings in the application (the names differ per product):

| What to configure | Typical value | Note |
| --- | --- | --- |
| Scopes to request | `openid email profile groups` | Needed when the scope is `Optional`. Harmless when it is `Default`. |
| Claim that holds groups or roles | `groups` | Must match the **Token Claim Name** of the mapper. |
| Value that grants admin access | `admins` | Must match the claim exactly. With **Full group path** `Off` there is no leading `/`. |

Not every application reads group claims. If it only needs a login, assigning the scope is harmless but unnecessary.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `groups` is not in the **Add client scope** list | The scope was not saved, or the wrong realm is open. | Check **Client scopes** in the `homelab` realm. |
| No `groups` claim in the evaluated token | The scope is not assigned to the client, or the mapper is missing. | Check the client's **Client scopes** tab and the scope's **Mappers** tab. |
| The claim exists but is empty | The selected user is not in any group. | Join the user to a group under **Users → Groups**. |
| The claim shows `/family/admins` instead of `admins` | **Full group path** is `On`. | Turn it off in the mapper, then evaluate again. |
| The claim is missing in userinfo only | **Add to userinfo** is `Off`. | Turn it on in the mapper. |
| The claim is correct but the application ignores it | The application setting uses another style (with or without `/`), or does not request the scope. | Compare the value in the application config with the claim, and check the scopes the application requests. |
| Old values after changing group membership | The token was issued before the change. | Sign out and sign in again, or wait for the token to expire. |

## What's next

The claim is ready. Continue with [Create an OIDC Client](./create-oidc-client) to register each application in Keycloak.