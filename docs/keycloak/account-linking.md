---
sidebar_position: 5
title: Account Linking
description: Create a custom first login flow so a Google login is linked to the existing local Keycloak user instead of creating a duplicate.
tags: [keycloak, sso, google]
---

# Account Linking

This guide makes sure that signing in with Google and signing in with the local account lead to the **same Keycloak user**. Without it, the first Google login creates a second user, and every application sees two different people.

## Prerequisites

- The `homelab` realm, groups, and local users exist (see [Realm, Groups and Users](./realm-groups-users)).
- The `google` Identity Provider is added (see [Google Identity Provider](./google-identity-provider)).
- Each local user has the same email as their Google account, **Email verified** is `ON`, and the user has a **local password** (set under **Credentials**).

## How linking works

Keycloak runs a **first broker login flow** the first time someone signs in through an Identity Provider. By default this flow creates a new user when it cannot confirm the person. The custom flow in this guide changes that:

1. Google confirms who the person is and sends the email.
2. Keycloak looks for a local user with the same email.
3. If found, Keycloak asks for that user's **local password once**, as proof of ownership, then links the Google account to the user.
4. If not found, the login is rejected. No user is created.

After the first time, the person signs in with Google only and is never asked for the local password again.

:::info
Step 4 matters. With the default flow, any Google account that reaches the login page can get a new user in the realm, even when **User registration** is `OFF`. The custom flow closes that gap: only users the admin created can sign in.
:::

## Create the first login flow

### Duplicate the default flow

1. Go to **Authentication → Flows**.
2. Open the menu (⋮) of `first broker login` and click **Duplicate**.
3. Set the name to `first-broker-login-homelab` and click **Duplicate**.

Do not edit the built-in flow. Keep it as a reference.

### Add the "Detect existing broker user" step

In the default flow, **Create User If Unique** is also the step that notices an existing user with the same email. This guide disables that step, so a separate step has to do the detection.

1. In the **User creation or linking** sub-flow, click the **+** icon and choose **Add step** (shown as **Add execution** in some versions).
2. Select **Detect existing broker user** and click **Add**.
3. Drag the new step above **Handle Existing Account**. The order matters, because the steps below need the result of this one.

:::warning
Authenticator names can differ slightly between Keycloak versions. If **Detect existing broker user** is missing from the list, check the version of your Keycloak and its release notes before using another step.
:::

### Adjust the steps

Set the requirements in `first-broker-login-homelab` as follows. Indented rows are inside the sub-flow above them.

| Step | Requirement | Purpose |
| --- | --- | --- |
| Review Profile | `Disabled` | No manual profile page that could lead to a new user. |
| User creation or linking (sub-flow) | `Required` | Keep as is. |
| &nbsp;&nbsp;Detect existing broker user | `Required` | Finds the local user with the same email. |
| &nbsp;&nbsp;Create User If Unique | `Disabled` | Never create a user automatically. |
| &nbsp;&nbsp;Handle Existing Account (sub-flow) | `Required` | Runs the confirmation and the password check. |
| &nbsp;&nbsp;&nbsp;&nbsp;Confirm link existing account | `Required` | Shows the "Account already exists" page. |
| &nbsp;&nbsp;&nbsp;&nbsp;Account verification options (sub-flow) | `Required` | Keep as is. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verify existing account by Email | `Disabled` | Needs SMTP, and would skip the password check. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Verify Existing Account by Re-authentication (sub-flow) | `Required` | Asks for the local password once. |
| First Broker Login - Conditional Organization (sub-flow) | Leave as is | Only used when Organizations are enabled. |

Leave the steps inside **Verify Existing Account by Re-authentication** as they are: the username and password form (`Required`) and the conditional OTP form. If the user has OTP configured, Keycloak asks for the code during linking too.

Changes to a requirement are saved as soon as you pick a value in the dropdown. There is no separate save button.

Finished flow:

![Broker Tabel](<img/Screenshot 2026-10-04 015343.png>)

:::info
Do not add **Automatically Set Existing User**. It links silently without any proof of ownership, which defeats the purpose of the password check. Also skip **Confirm Override Existing Link**, which is only used when a user is already linked to a different Google account.
:::

## Use the flow in the Identity Provider

1. Go to **Identity providers → google → Advanced settings**.
2. Set **First login flow override** to `first-broker-login-homelab`.
3. Click **Save**.

Also confirm that **Trust Email** is `ON` on the same page. It was set in [Google Identity Provider](./google-identity-provider).

## Onboard a user

Linking needs the admin to prepare the user first. For each person:

**Admin, once per user**

1. Create the local user with the exact Google email and **Email verified** `ON` (see [Realm, Groups and Users](./realm-groups-users)).
2. Set a local password under **Credentials → Set password** with **Temporary** `OFF`.
3. Join the user to the right groups.
4. Give the person their username and password.

**User, once**

1. Open `https://auth.rizwan.my.id/realms/homelab/account` (or sign in to any application through SSO).
2. Click **Google** and sign in.
3. On the **Account already exists** page, confirm and enter the local password.

After that the person signs in with Google only. The local password stays as a backup login. If the person does not need it, set a long random password.

## Test

### First login with Google

<video controls muted playsInline width="100%">
  <source src="/video/keycloak-first-login-google.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

*Demo: first login with Google, confirming the link with the local password.*

1. Open a private browser window and go to `https://auth.rizwan.my.id/realms/homelab/account`.
2. Click **Google** and sign in with the Google account that matches the local user's email.
3. Keycloak shows **Account already exists**. Click **Add to existing account**.
4. Enter the local password (the username is usually pre-filled), then click **Sign in**.
5. You land in the account console, signed in as the local user.

:::warning
This step asks for the **local** password set by the admin, not the Google password. If no local password exists yet, or a different one is typed, Keycloak shows `Invalid username or password`.
:::

### Second login with Google

Sign out, click **Google** again. This time you go straight in without a password.

### Login with the local account

Sign out and sign in with the local username and password. You must land on the same user.

### A Google account without a local user

Sign in with a Google account that has no matching local user. Keycloak shows an error page and does **not** create a user. This is the expected result.

## Verify

1. Open **Users** in the `homelab` realm and search by email. There must be exactly one user.
2. Open the user, then the **Identity provider links** tab. There is one row for `google`.
3. Check that the groups and the **Enabled** and **Email verified** switches are unchanged.

## Link manually (fallback)

Use this only when the Google email cannot be made the same as the local email.

1. Sign in with the local account at `https://auth.rizwan.my.id/realms/homelab/account`.
2. Open **Account security → Linked accounts**.
3. Click **Link account** next to `google` and sign in with Google.

:::tip
Fixing the email on the local user is usually the cleaner solution, since manual linking has to be repeated for every person.
:::

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Invalid username or password` on the link page | The local password is not set, or the Google password was typed. | Set the password under the user's **Credentials** tab with **Temporary** `OFF`, and enter that one. |
| Google login creates a new user | **First login flow override** on `google` is still the default. | Set it to `first-broker-login-homelab`, delete the duplicate user, and log in again. |
| Error after choosing Google, no password page | No local user has the same email, or **Detect existing broker user** is missing. | Check the email on the local user (it must match exactly) and the steps in the flow table. |
| Error that the Google account is already linked | An earlier test linked it to another user. | Open that user, **Identity provider links**, and unlink `google`. Then try again. |
| The person forgot the local password | The password is only used for the first link. | Reset it under the user's **Credentials** tab with **Temporary** `OFF`. |
| The Google button works but the person lands on the wrong user | A duplicate user from earlier tests exists. | Search by email in **Users**, delete the extra user, and unlink and relink. |

## What's next

The accounts are linked, but applications still cannot see group membership. Continue with the `groups` client scope and mapper, then create a client for each application.