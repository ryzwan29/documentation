---
sidebar_position: 5
title: Set Up iSCSI
description: Bind the DSM iSCSI service to the storage network, create a LUN and a target, and prove the data path with an iscsiadm login from a Linux machine.
tags: [synology, dsm, iscsi, storage]
---

# Set Up iSCSI

This guide prepares **iSCSI** on Synology DSM. iSCSI gives other machines a block device over the network: DSM offers a **LUN** (a virtual disk) through an iSCSI **target**, and a client (the **initiator**) logs in to the target and sees the LUN as a local disk. By the end the iSCSI service listens on the storage interfaces only, and you have proven with a test login that the data path works.

## Prerequisites

- A DSM volume. See [Create a storage pool and a volume](./storage-pool-volume.md).
- Static addresses on the storage interfaces. See [Set up the DSM network](./network-setup.md). The examples use `172.16.2.31` and `172.16.3.31`.
- A Linux machine on the storage network for the test login. It must **not** be a node that runs Kolla Ansible containers, because the host `iscsid` conflicts with the `iscsid` container. See [Prepare the nodes for iSCSI](../openstack/synology-iscsi-backend/prepare-nodes-iscsi.md).

:::info
DSM 7 renamed *iSCSI Manager* to **SAN Manager**. Menu names differ a little between DSM versions.
:::

## Set the names

On the Linux test machine, define the portals once. Replace the values with your own:

```bash
DSM1=172.16.2.31
DSM2=172.16.3.31
```

## Pre-check

### Check the storage network from the test machine

```bash
ping -c 2 $DSM1
ping -c 2 $DSM2
```

Expected: both addresses answer.

### Check for leftovers

Open **SAN Manager** and look at the **LUN** and **iSCSI** tabs.

Expected: you know which LUNs and targets already exist. Do not reuse a target that another system depends on.

## Procedure

### Bind the iSCSI service to the storage network

In the iSCSI network binding settings, allow the service to listen on the two storage interfaces only. This makes both portals (`172.16.2.31` and `172.16.3.31`) visible to initiators, which multipath depends on, and keeps iSCSI off the management network.

![Network binding for iSCSI](<img/Screenshot 2026-10-01 234512.png>)

### Create a LUN

In **SAN Manager**, create a LUN on the volume. Use a small size for the test, for example 1 GB.

![Create a LUN](<img/Screenshot 2026-10-01 234459.png>)

:::note
Programs that manage LUNs themselves, such as the OpenStack Cinder driver, create and delete LUNs on their own. A manual LUN is still useful to confirm that the volume can host LUNs at all, and it is the starting point for a setup with one big LUN and LVM on top.
:::

### Create a target and map the LUN

Create an iSCSI target and map the LUN to it. Note the **IQN** of the target, because the test login needs it.

![Create an iSCSI target](<img/Screenshot 2026-10-02 112946.png>)

## Post-check

### Check that the portals answer

From the test machine:

```bash
nc -zv $DSM1 3260
nc -zv $DSM2 3260
```

Expected: both connections succeed.

### Check discovery

```bash
sudo apt install -y open-iscsi
sudo iscsiadm -m discovery -t sendtargets -p $DSM1:3260
```

Expected: the output lists your target IQN once for each portal that DSM advertises, here `172.16.2.31:3260` and `172.16.3.31:3260`. If only one portal appears, the service is bound to one interface only.

### Test a login

```bash
sudo iscsiadm -m node -T <target-iqn> -p $DSM1 --login
lsblk
```

Expected: a new block device with the size of the LUN appears in `lsblk`.

### Clean up the test

```bash
sudo iscsiadm -m node -T <target-iqn> -p $DSM1 --logout
sudo iscsiadm -m node -T <target-iqn> -o delete
```

Expected: the extra block device disappears. Keep the LUN and the target if you want to use them, or delete them in SAN Manager.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Port `3260` is refused on a storage address | The iSCSI service is not bound to that interface, or no target exists yet. Check the network binding. |
| Discovery shows only one portal | The target listens on one NIC. Allow both storage interfaces in the binding settings. |
| Login fails with an authentication error | The target requires CHAP. Disable CHAP on the target for the test, or configure the credentials on the initiator. |
| The device does not show up after login | The LUN is not mapped to the target. Map it in SAN Manager and log in again. |
| iSCSI works from one machine but not from another | A firewall rule on DSM blocks the second source. Allow port `3260` from the storage subnets. |

## Rollback

To remove the test setup, log out and delete the node record on the initiator (see the clean up step above), then delete the target and the LUN in SAN Manager.

## What's next

Continue with [Create an NFS share](./nfs-share.md).
