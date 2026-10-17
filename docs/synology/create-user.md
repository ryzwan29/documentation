---
sidebar_position: 2
title: Create a User
description: Create a DSM user, add it to the administrators group, keep it out of two-factor enforcement when it is a service account, and lock it down with the DSM firewall.
tags: [synology, dsm, user, security]
---

# Create a User

This guide creates a user on Synology DSM. It covers a normal user and a **service account**: an account that a program (for example the OpenStack Cinder driver) uses to log in without a human typing a password or a one-time code. By the end you will have a user in the right groups, a clear picture of how two-factor authentication (2FA) affects it, and firewall rules that limit where it can be used from.

## Prerequisites

- A running DSM with an admin account. See [Deploy Xpenology with Arc Loader](./deploy-xpenology.md).
- Access to the DSM web interface (`http://<dsm-ip>:5000`).
- A password manager, or another safe place to store a long random password.

:::warning
A service account that has admin rights and no 2FA is a powerful account. Whoever gets its password gets full admin on DSM. Create a **dedicated** account for each program, and do not reuse your personal admin account.
:::

## Plan the account

Decide these things before you open the wizard:

| Question | Why it matters |
| --- | --- |
| What is the account for? | A person who logs in to the web interface, or a program that logs in by itself. |
| Does it need admin rights? | Programs that create LUNs and targets through the WebAPI need the `administrators` group. File sharing alone does not. |
| Will it use 2FA? | A program cannot type a one-time code. A service account must be outside the 2FA enforcement. |
| Which shared folders does it touch? | Permissions are set per shared folder. See [Create an NFS share](./nfs-share.md). |

## Pre-check

### Check the existing users

Open **Control Panel → User & Group** and look at the **User** tab.

Expected: the name you plan to use is not taken, and you know which account you are logged in with.

### Check the 2FA enforcement

Open **Control Panel → Security → Account → Two-factor authentication** and note the current setting.

Expected: you know whether enforcement is set to nobody, to specific groups, or to all users. If it is set to all users or to the administrators group, a service account in `administrators` will be forced to use 2FA. The procedure below shows how to avoid that.

## Procedure

### Create the user

1. Open **Control Panel → User & Group** and click **Create** on the **User** tab.
2. Enter a name and a **long random password**. A name that says what the account is for (for example `cinder`) is easier to audit later than a generic one.
3. In the next steps of the wizard, join the groups you planned, and set the shared folder permissions you need. Everything can be changed later.
4. Finish the wizard.

### Add the user to the administrators group

Only do this when the account really needs admin rights, for example a service account that creates LUNs and targets.

![Add user to the administrators group](<img/Screenshot 2026-10-02 114534.png>)

1. Open **Control Panel → User & Group**, select the user, and click **Edit**.
2. On the **User Groups** tab, tick `administrators`.
3. Save.

### Keep a service account out of 2FA enforcement

1. Open **Control Panel → Security → Account → Two-factor authentication**.
2. If enforcement is set to **all users** or to the **administrators group**, change it to a specific group that contains only the people who should use 2FA.
3. Make sure the service account is **not** in that group.
4. Save.

:::tip
Some programs support a trusted-device token that skips the one-time code prompt, so the account can keep 2FA. The token is tied to that account and breaks when its password or 2FA is reset. A dedicated service account without 2FA, protected by the firewall below, is usually simpler.
:::

### Restrict the account with the firewall

A service account without 2FA must not be reachable from everywhere. Open **Control Panel → Security → Firewall** and allow only the ports and source networks the program needs, then deny everything else. The exact rules depend on the program. For the OpenStack Cinder driver they are listed in [Prepare Synology for Cinder](../openstack/synology-iscsi-backend/prepare-synology.md).

Also:

- Use a long random password and store it in a password manager.
- If the password ends up in a configuration file, set `chmod 600` on that file and keep it out of git.

## Post-check

### Check the groups

Open **Control Panel → User & Group**, select the user, and click **Edit**.

Expected: the user is in the groups you planned, and in `administrators` only when needed.

### Check that the user can log in

Open `http://<dsm-ip>:5000` in a private browser window and log in with the new user.

Expected: login works. A person account may be asked for a 2FA code if enforcement covers it. A service account must **not** be asked.

### Check the firewall

Open **Control Panel → Security → Firewall**.

Expected: the allow rules for the service account are listed above the final deny rule.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| A program gets a `403` or `404` style error when it logs in | 2FA is probably still enforced for that account. Scope the enforcement to a group that does not include the account. |
| The account can log in but cannot create LUNs or targets | The account is not in `administrators`. Add it. |
| Login works in the browser but not from the program | The firewall blocks the source IP, or the program uses another port. Check the firewall rules. |
| The trusted-device token stopped working | The password or the 2FA of the account was reset. Create a new token, or use a service account without 2FA. |

## Rollback

To remove the account, open **Control Panel → User & Group**, select the user, and click **Delete**. Files the user owns on shared folders stay on the folders, but check the folder permissions afterwards.

## What's next

Continue with [Set up the DSM network](./network-setup.md).
