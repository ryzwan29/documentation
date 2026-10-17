---
sidebar_position: 2
title: Prepare Synology for Cinder
description: Create a dedicated DSM service account for the Cinder driver, restrict it with the DSM firewall, and test the WebAPI login and the iSCSI portals from the cinder-volume node.
tags: [openstack, cinder, synology, security]
---

# Prepare Synology for Cinder

The Cinder driver logs in to DSM non-interactively with a username and a password, and then creates LUNs and targets. This guide prepares DSM for that: a service account that has the right rights and no 2FA, firewall rules that limit where it can be used, and a test of the exact path that Cinder will use. By the end `cinder-volume` can log in to the WebAPI, and both iSCSI portals answer.

## Prerequisites

- DSM is prepared as in the [Synology guides](../../synology/deploy-xpenology.md): a Btrfs volume, static IPs on both storage networks (`172.16.2.31` and `172.16.3.31`), and iSCSI bound to the storage interfaces. See [Set up iSCSI](../../synology/iscsi-setup.md).
- Admin access to DSM.
- The node that will run `cinder-volume` (`dev-openstack-controller-01` in the examples), with an address on both storage networks.

## Set the names

Run this on the `cinder-volume` node. Replace the values with your own:

```bash
DSM1=172.16.2.31
DSM2=172.16.3.31
DSM_USER=cinder
```

## Pre-check

### Check the DSM volume name

Open **Storage Manager → Storage** and look at the name of the volume (for example `volume1`).

Expected: you know the name. It becomes `synology_pool_name` in the Cinder configuration.

### Check the two-factor enforcement

Open **Control Panel → Security → Account → Two-factor authentication**.

Expected: you know whether enforcement covers all users or the administrators group. The service account must stay out of it.

## Procedure

### Create the service account

Create a **dedicated** account for the driver, following [Create a user](../../synology/create-user.md):

1. **Control Panel → User & Group**: create the user (`cinder` in the examples) with a long random password.
2. Add the user to the `administrators` group. The driver needs admin rights to create LUNs and targets. Without this, volume creation fails.
3. **Control Panel → Security → Account → Two-factor authentication**: make sure enforcement does **not** cover this user. If enforcement is set to all users or to the administrators group, scope it to a specific group and keep the service account out of it.
4. Use this user as `synology_username` in `cinder-volume.conf`.

:::warning
A service account in `administrators` without 2FA, whose password sits in plain text in `cinder-volume.conf`, gives full admin on DSM to anyone who reads that file. That is why the account should be dedicated, and why the firewall below matters. In the original lab an existing admin user (`ops`) was reused to save work, which is acceptable for a lab but not something to copy beyond it.
:::

### Lock the account down with the firewall

In **Control Panel → Security → Firewall**, allow:

- port `5001` only from the OpenStack nodes on Storage 1,
- port `3260` only from the OpenStack nodes on both storage subnets,
- and deny everything else.

If the same DSM also serves the Glance NFS share, port `2049` from the controllers stays allowed. See [Create an NFS share](../../synology/nfs-share.md).

Also:

- use a long random password,
- keep `cinder-volume.conf` at `chmod 600` and out of git.

:::tip
The driver also supports a `synology_device_id` option (a trusted-device token that skips the OTP prompt), which lets you keep 2FA on an account. The token is tied to that account and breaks if its password or 2FA is reset, so a dedicated service account is usually cleaner.
:::

## Post-check

Run these from the node that will host `cinder-volume`, because that is the exact path Cinder will use.

### Check the iSCSI portals

```bash
nc -zv $DSM1 3260
nc -zv $DSM2 3260
```

Expected: both connections succeed.

### Check the WebAPI login

```bash
read -rsp "DSM password: " P; echo
curl -sk https://$DSM1:5001/webapi/auth.cgi \
  --data-urlencode "api=SYNO.API.Auth" \
  --data-urlencode "version=6" \
  --data-urlencode "method=login" \
  --data-urlencode "account=$DSM_USER" \
  --data-urlencode "passwd=$P" \
  --data-urlencode "format=sid"
```

Expected: the response contains `"success":true`. Unset the password afterwards with `unset P`.

### Check from the other nodes

Run the two `nc` commands on every compute node too, because the compute nodes log in to the targets directly.

Expected: both portals answer from every node.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The login returns `403` or a `404` style error | 2FA is probably still enforced for that account. Scope the enforcement so the account is outside it. |
| `"success":false` with an error code | The password is wrong, or the account is disabled. Test the same login in the DSM web interface. |
| `nc` to port `3260` fails | iSCSI is not bound to that interface, or the DSM firewall blocks the source. Check the network binding and the firewall. |
| `nc` to port `5001` fails | The WebAPI is not reachable on the storage network, or the firewall blocks it. |
| `curl` reports a certificate error | You left out `-k`. DSM uses a self-signed certificate out of the box. |

## Rollback

To remove the service account, open **Control Panel → User & Group** and delete it, and remove the firewall rules that were made for it.

## What's next

Continue with [Prepare the nodes for iSCSI](./prepare-nodes-iscsi.md).
