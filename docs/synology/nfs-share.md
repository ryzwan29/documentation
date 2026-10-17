---
sidebar_position: 6
title: Create an NFS Share
description: Enable NFS on DSM, create a shared folder, grant NFS permissions to the storage subnet, bind NFS to the storage network, and test a mount from a Linux client.
tags: [synology, dsm, nfs, storage]
---

# Create an NFS Share

This guide shares a folder from Synology DSM over **NFS**, so that Linux machines can mount it. In the OpenStack documentation the same share stores the Glance images (see [Glance image storage on NFS](../openstack/glance-nfs-storage.md)), but nothing here is specific to OpenStack. By the end you will have an NFS service that listens on the storage network only, a shared folder with the right permissions, and a successful test mount.

## Prerequisites

- A DSM volume. See [Create a storage pool and a volume](./storage-pool-volume.md).
- A static address on the storage interface (the examples use `172.16.2.31`). See [Set up the DSM network](./network-setup.md).
- The accounts that will touch the files. See [Create a user](./create-user.md).
- A Linux client on the storage subnet (`172.16.2.0/24` in the examples) with `nfs-common` installed.

## Set the names

On the Linux client, define the share once. Replace the values with your own:

```bash
DSM_IP=172.16.2.31
SHARE=/volume1/glance
MNT=/mnt/nfs-test
```

## Pre-check

### Check the network path

```bash
ping -c 2 $DSM_IP
```

Expected: the address answers.

### Check the existing shared folders

Open **Control Panel → Shared Folder**.

Expected: no folder with the name you plan to use exists yet, and you know which volume it will live on.

## Procedure

### Enable the NFS service

In **Control Panel → File Services → NFS**, enable the service and set the maximum protocol to **NFSv4.1**. NFSv4.1 needs only port `2049`, which keeps the firewall rules short.

![Enable NFS](<img/Screenshot 2026-10-01 233601.png>)

### Create the shared folder

In **Control Panel → Shared Folder**, create a folder (the examples use `glance`) on your volume. Its path on DSM is `/volume1/glance`, and that is what the clients mount. The recycle bin and encryption can stay off for an image store.

![Create the shared folder](<img/Screenshot 2026-10-01 233358.png>)

### Grant permissions

1. Give **Read/Write** on the shared folder to the accounts that will touch the files, in this lab the `guest` and `ops` users.
2. Add an **NFS permission** rule for the storage subnet (`172.16.2.0/24`) with **Read/Write**.
3. Set squash to **No mapping**. Otherwise `chown` from the clients is silently remapped and applications such as Glance can hit permission errors.

![Grant permissions](<img/Screenshot 2026-10-01 233449.png>)

### Bind NFS to the storage network

Restrict the NFS service to the storage interface, the same way as for iSCSI. NFS is then only reachable from the storage subnet, not from the management network, and the DSM firewall only needs to allow port `2049` from the clients.

![Network binding for NFS](<img/Screenshot 2026-10-01 233748.png>)

### Allow the clients in the DSM firewall

In **Control Panel → Security → Firewall**, allow port `2049` from the client addresses on the storage subnet, and deny everything else.

## Post-check

### Check that the share is mounted correctly from a client

```bash
sudo apt install -y nfs-common
sudo mkdir -p $MNT
sudo mount -t nfs4 -o vers=4.1 $DSM_IP:$SHARE $MNT
df -h $MNT
```

Expected: `df` shows the DSM share with the size of the volume.

### Test a write and a read

```bash
echo ok | sudo tee $MNT/test.txt
cat $MNT/test.txt
sudo rm $MNT/test.txt
```

Expected: the write succeeds and you read `ok` back. If you have a second client, read the file from there to prove that the share is really shared.

### Check the ownership

```bash
sudo touch $MNT/owner-test
sudo chown 1000:1000 $MNT/owner-test
ls -ln $MNT/owner-test
sudo rm $MNT/owner-test
```

Expected: the owner of the file is `1000:1000`. With squash enabled, the owner would silently change to another user.

### Check that the management network is closed

From a machine on the management network:

```bash
nc -zv -w 3 <dsm-management-ip> 2049
```

Expected: the connection fails.

### Unmount the test mount

```bash
sudo umount $MNT
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `mount.nfs: access denied by server` | The client address is not covered by the NFS permission rule. Add the storage subnet with Read/Write. |
| `mount.nfs: Connection timed out` | Port `2049` is blocked by the DSM firewall, or the client is not on the storage subnet. |
| `chown` seems to work but the owner is another user | Squash is enabled. Set it to **No mapping**. |
| `Permission denied` when writing as an application user | The shared folder permission is missing for the mapped account. Give Read/Write to that account. |
| `Protocol not supported` | The client asks for a protocol that the service does not offer. Use `vers=4.1`, and check the maximum protocol in the NFS settings. |
| The management network can still reach port `2049` | NFS is not bound to the storage interface only. Check the binding. |

## Rollback

On the client, unmount the share:

```bash
sudo umount $MNT
```

On DSM, remove the NFS permission rule, delete the shared folder, and disable the NFS service if nothing else uses it.

:::warning
Deleting a shared folder deletes its files. Copy anything you need first.
:::

## What's next

Synology is ready as a general NAS. If you want to use it as storage for OpenStack, continue with [Introduction to OpenStack](../openstack/introduction.md).
