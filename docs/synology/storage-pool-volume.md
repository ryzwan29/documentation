---
sidebar_position: 4
title: Create a Storage Pool and a Volume
description: Attach data disks to the DSM VM, create a storage pool and a Btrfs volume in Storage Manager, and check that the volume is healthy.
tags: [synology, dsm, storage, btrfs]
---

# Create a Storage Pool and a Volume

This guide turns the empty data disks of the DSM VM into a **storage pool** and a **Btrfs volume**. Everything else on DSM sits on top of this volume: shared folders, NFS exports, and iSCSI LUNs. By the end you will have a healthy volume with a name you can refer to in other guides.

## Concepts in one minute

- A **storage pool** is a group of disks with one redundancy level (for example SHR, RAID 5, or Basic for a single disk).
- A **volume** is a file system created on a pool. DSM stores shared folders and LUNs inside volumes.
- **Btrfs** is the file system to choose here. Thin-provisioned LUNs and snapshots generally need it.

:::warning
A virtual disk is not redundancy. If all virtual disks live on one Proxmox node, a RAID level inside DSM protects you from a failed *virtual* disk, not from a failed host. Keep a separate backup of anything you care about.
:::

## Prerequisites

- A running DSM. See [Deploy Xpenology with Arc Loader](./deploy-xpenology.md).
- One or more data disks that are not used yet. Everything on them will be erased by the pool creation.
- An admin account on DSM.

## Set the names

Define the VM and the storage once. Replace the values with your own:

```bash
VMID=100
STORAGE=local-lvm
```

## Pre-check

### Check the disks of the VM

On the Proxmox host:

```bash
qm config $VMID | grep -E '^sata'
```

Expected: `sata0` is the loader and `sata1` is the DSM system disk. Extra data disks, if you already added them, appear as `sata2`, `sata3`, and so on.

### Check the disks in DSM

Open **Storage Manager → HDD/SSD**.

Expected: the data disks you want to use are listed and their status is `Normal`. Disks that are already part of a pool are not available for a new one.

## Procedure

### Add data disks (optional)

If you want more space than the single data disk from the deploy guide, add more disks as SATA:

```bash
qm set $VMID --sata2 $STORAGE:200
qm set $VMID --sata3 $STORAGE:200
```

The number after the colon is the size in GB. Proxmox allows six SATA devices (`sata0` to `sata5`), and the loader already uses one. Reboot the VM so DSM sees the new disks:

```bash
qm reboot $VMID
```

:::tip
Keep the disks as SATA. DSM expects SATA-style disks, and VirtIO or SCSI disks are often not offered as drives.
:::

### Create the storage pool

1. Open **Storage Manager → Storage** and click **Create → Create Storage Pool**.
2. Choose the RAID type that matches your disks and your risk. For a single disk choose **Basic**.
3. Select the disks.
4. Follow the wizard until the pool is created.

### Create the volume

1. In the same wizard (or later under **Storage → Create → Create Volume**), create a volume on the new pool.
2. Choose **Btrfs** as the file system.
3. Use the full available size, or a smaller size if you want to keep space for other volumes.
4. Finish the wizard.

![Create the pool and the volume](<img/Screenshot 2026-10-01 225156.png>)

:::info
Write down the volume name (for example `volume1`). Other guides use it: the NFS path is `/volume1/<shared-folder>`, and the OpenStack Cinder driver reads it as `synology_pool_name`.
:::

## Post-check

### Check the pool and the volume

Open **Storage Manager → Storage**.

Expected: the pool and the volume both show the status `Healthy`, and the file system is Btrfs.

### Check the capacity

Look at the volume details.

Expected: the size matches what you planned, and the used space is close to zero on a new volume.

### Check that DSM can create a shared folder

Open **Control Panel → Shared Folder** and click **Create**. Select the new volume as the location and cancel the wizard.

Expected: the new volume is offered as a location. The shared folder itself is created in [Create an NFS share](./nfs-share.md).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| No disk is offered when creating the pool | The disks are not attached as SATA, or DSM has not rescanned them. Check `qm config $VMID`, then reboot the VM. |
| A disk shows as `Not initialized` or `Crashed` | The disk was used before, or the virtual disk is damaged. Use another disk, or recreate the virtual disk. |
| The pool wizard only offers Basic | Only one disk is selected. Select more disks for a redundant RAID type. |
| Btrfs is not offered as file system | The DSM model chosen in Arc does not support it. Check the model notes in Arc, and rebuild the loader with another model if needed. |

## Rollback

To remove a volume and a pool, open **Storage Manager → Storage**, select the volume and remove it, then do the same for the pool.

:::warning
Removing a volume deletes all shared folders, LUNs, and data on it. Do this only when nothing on it is needed.
:::

## What's next

Continue with [Set up iSCSI](./iscsi-setup.md), or with [Create an NFS share](./nfs-share.md).
