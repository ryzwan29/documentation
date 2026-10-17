---
sidebar_position: 2
title: Create a ZFS Pool
description: Create a ZFS pool on a Proxmox VE node, choose a RAID layout (stripe, mirror, RAIDZ1/2/3), add it as storage, and verify it with pre-checks and post-checks.
tags: [proxmox, zfs]
---

# Create a ZFS Pool

This guide creates a ZFS pool from one or more empty disks on a Proxmox VE node and adds it as VM and container storage. It also explains the RAID layouts that ZFS offers (mirror, RAIDZ1, RAIDZ2, and so on), so you can pick the one that fits your disks and your risk. By the end you will have a healthy pool, a working Proxmox storage on top of it, and a set of checks that prove it.

## Prerequisites

- A Proxmox VE node with `root` access.
- One or more disks that are **empty and unused**. Everything on them will be destroyed.
- Disks that ZFS can see directly. Use an HBA or a controller in IT/passthrough mode. Do not build ZFS on top of a hardware RAID volume, because ZFS then cannot see the real disks and cannot repair data errors properly.
- A name for the pool that is not used by another pool or storage on the node, for example `tank` or `data`.
- A backup of anything important on the disks.

:::warning
Creating a pool wipes the disks you give it. Double-check the disk IDs before you run the create command.
:::

## Choose a layout

ZFS builds a pool from one or more **vdevs** (virtual devices). Each vdev is a group of disks with its own redundancy. The redundancy level is chosen when you create the vdev, and for the most part it cannot be changed later, so decide before you start.

### How parity works

Redundancy in ZFS comes in two forms: **mirroring** (every disk in the group holds a full copy of the data) and **parity** (the group stores extra data that lets it rebuild a lost disk). In RAIDZ, the number after `raidz` is the **number of parity disks**, which is also the number of disks that can fail at the same time without data loss.

:::info
There is no `raidz5`. The number in `raidz1`, `raidz2`, and `raidz3` is the parity count, not a RAID level. If you are used to classic RAID levels, `raidz1` is similar to RAID 5 and `raidz2` is similar to RAID 6. `raidz3` has no classic equivalent.
:::

### Layouts at a glance

| Layout | Similar to | Minimum disks | Disks that can fail | Usable capacity |
| --- | --- | --- | --- | --- |
| Stripe | RAID 0 | 1 | 0 | All disks |
| Mirror | RAID 1 | 2 | All but one disk in the mirror | One disk (per mirror) |
| Striped mirrors | RAID 10 | 4 | One per mirror, as long as no mirror loses all its disks | Half of the disks |
| `raidz1` | RAID 5 | 3 | 1 | Number of disks minus 1 |
| `raidz2` | RAID 6 | 4 | 2 | Number of disks minus 2 |
| `raidz3` | None | 5 | 3 | Number of disks minus 3 |

Usable capacity is roughly `(disks − parity) × size of the smallest disk`, before ZFS overhead. If the disks have different sizes, every disk is treated as if it had the size of the smallest one.

For example, with 6x 4 TB disks:

| Layout | Usable capacity | Can lose |
| --- | --- | --- |
| Stripe | about 24 TB | 0 disks (one failure loses the pool) |
| Striped mirrors (3 pairs) | about 12 TB | 1 disk per pair |
| `raidz1` | about 20 TB | 1 disk |
| `raidz2` | about 16 TB | 2 disks |
| `raidz3` | about 12 TB | 3 disks |

### Stripe

Data is spread over all disks. You get all the capacity and the best throughput, but there is no redundancy: if one disk dies, the whole pool is lost. Use it only for data you can recreate, such as a scratch or cache pool. A single-disk pool is a stripe of one.

### Mirror

Every disk in the mirror holds the same data. A 2-disk mirror survives one failure, a 3-disk mirror survives two. Capacity is that of one disk. Mirrors are simple, rebuild fast, and give the best random IOPS, so they are the usual choice for VM storage and for pools with only two disks.

### Striped mirrors

Several mirrors in one pool, with data striped across them (like RAID 10). It combines mirror safety with more capacity and speed, and you can grow the pool later by adding another mirror pair. The price is that half of the raw capacity goes to redundancy. This is a strong layout for VMs when you have four or more disks.

### RAIDZ1

One disk worth of parity, spread over all disks of the vdev. It survives one failed disk and loses only one disk of capacity, so it is space-efficient. The risk is the rebuild: while a failed disk is being replaced, the pool has no redundancy left, and one more failure or read error loses data. With large disks (several TB) rebuilds take many hours, so `raidz1` is best for small disks, SSDs, or data you can restore from a backup.

### RAIDZ2

Two disks worth of parity. It survives two failures at the same time, including a second failure during a rebuild. This is the common choice for pools of 6 or more large disks, and a sensible default for important bulk data.

### RAIDZ3

Three disks worth of parity. It survives three failures, and fits very wide vdevs (roughly 8 disks or more) made of large disks, where the rebuild time and the chance of another failure are high. It costs three disks of capacity, so it is not useful for small pools.

### Which one should I pick?

| Situation | Suggested layout |
| --- | --- |
| 1 disk | Stripe of one. No redundancy, so keep backups. |
| 2 disks | Mirror. |
| 4 or more disks, mainly VMs and containers | Striped mirrors. |
| 3 to 5 disks, capacity matters, backups exist | `raidz1`. |
| 5 or more large disks, important data | `raidz2`. |
| Very wide vdevs of large disks | `raidz3`. |

:::tip
RAIDZ is a good fit for large files, media, and backups. For VM disks (zvols) with many small random writes, mirrors are faster. RAIDZ can also waste extra space on small zvol blocks because of padding, so test it with your workload first.
:::

### What you cannot change later

- The parity level of a vdev. You cannot turn `raidz1` into `raidz2`, or a mirror into RAIDZ.
- The `ashift` value of a vdev (see the create step below).
- You can add another vdev to the pool later (for example another mirror pair), but a pool that mixes different layouts is hard to reason about and not recommended.
- Newer OpenZFS versions (2.3 and later) can add a disk to an existing RAIDZ vdev ("RAIDZ expansion"). Check your version with `zfs version` before you rely on it.

:::warning
A pool with several vdevs is only as safe as its **weakest** vdev. If one vdev is lost, the whole pool is lost. Keep the redundancy level the same on every vdev.
:::

## Set the names

Define the pool name once, so you can copy and paste the rest of the commands. Replace the value with your own:

```bash
POOL="tank"
```

:::tip
This variable only exists in the current shell. If you lose the session, run the line again before you continue.
:::

## Pre-check

Run these commands before you touch anything. If one does not match what is described, stop and fix it first.

### Check that ZFS is available

```bash
zfs version
```

Expected: both the `zfs` and `zfs-kmod` versions are printed. If the command is not found, install the ZFS packages first.

### Identify the disks

List the disks with their sizes, models, and serial numbers:

```bash
lsblk -o NAME,SIZE,TYPE,MODEL,SERIAL,MOUNTPOINTS
```

Then find their stable IDs:

```bash
ls -l /dev/disk/by-id/ | grep -v -- '-part'
```

Use the IDs under `/dev/disk/by-id/` (for example `ata-...` or `nvme-...`) and not `/dev/sda`. The `sdX` names can change after a reboot or when you add a disk, the IDs do not.

Write down the disks you want to use. Check that the model and serial number match the physical disks.

### Check that the disks are unused

```bash
lsblk -o NAME,FSTYPE,MOUNTPOINTS
zpool status
pvs
```

Expected: the chosen disks have no mountpoint, are not part of an existing pool, and are not listed as LVM physical volumes. Disks that show a filesystem or a partition table still contain old data. You will wipe them in the procedure.

### Check the disk health

```bash
smartctl -H /dev/disk/by-id/<disk-id>
```

Run it for each disk. Expected: `PASSED`. Do not build a new pool on a disk that already reports problems.

### Check the sector size

```bash
lsblk -o NAME,PHY-SEC,LOG-SEC
```

Most modern disks use 4K physical sectors, and `ashift=12` fits them. Some disks report 512 byte sectors but are really 4K. Using `ashift=12` is safe for both, and it avoids a slow pool when you replace a disk with a newer one later. A wrong `ashift` cannot be changed without recreating the pool.

### Check that the name is free

```bash
zpool list -H -o name
pvesm status
```

Expected: `$POOL` does not appear as a pool name and does not appear as a storage ID.

## Procedure

Follow the sections in order.

### Define the disks

Put the disk IDs in a shell array. Replace the example IDs with your own:

```bash
DISKS=(
  /dev/disk/by-id/<disk-id-1>
  /dev/disk/by-id/<disk-id-2>
  /dev/disk/by-id/<disk-id-3>
)
```

Check that the list is what you expect before you continue:

```bash
printf '%s\n' "${DISKS[@]}"
ls -l "${DISKS[@]}"
```

### Wipe the disks

This removes old partition tables, filesystem signatures, and RAID or ZFS labels:

```bash
for d in "${DISKS[@]}"; do
  wipefs -a "$d"
  sgdisk --zap-all "$d"
done
```

:::warning
This step is destructive and cannot be undone. Make sure `DISKS` contains only the disks meant for the new pool.
:::

### Create the pool

Run **one** of the commands below, the one that matches the layout you chose. All of them set `ashift=12`.

**Stripe** (no redundancy):

```bash
zpool create -o ashift=12 "$POOL" "${DISKS[@]}"
```

**Mirror** (2 disks give a 2-way mirror, 3 disks give a 3-way mirror):

```bash
zpool create -o ashift=12 "$POOL" mirror "${DISKS[@]}"
```

**Striped mirrors** (write each pair out explicitly, one `mirror` keyword per pair):

```bash
zpool create -o ashift=12 "$POOL" \
  mirror /dev/disk/by-id/<disk-id-1> /dev/disk/by-id/<disk-id-2> \
  mirror /dev/disk/by-id/<disk-id-3> /dev/disk/by-id/<disk-id-4>
```

**RAIDZ1** (at least 3 disks):

```bash
zpool create -o ashift=12 "$POOL" raidz1 "${DISKS[@]}"
```

**RAIDZ2** (at least 4 disks):

```bash
zpool create -o ashift=12 "$POOL" raidz2 "${DISKS[@]}"
```

**RAIDZ3** (at least 5 disks):

```bash
zpool create -o ashift=12 "$POOL" raidz3 "${DISKS[@]}"
```

:::info
Do not add `-f` just to make an error go away. If ZFS refuses with a message about an existing filesystem or pool, one of the disks is not clean or is the wrong disk. Check it first. See [Troubleshooting](#troubleshooting).
:::

### Set the pool properties

Turn on compression and stop updating the access time on every read. Both improve performance and cost almost nothing:

```bash
zfs set compression=lz4 "$POOL"
zfs set atime=off "$POOL"
```

### Add the pool to Proxmox

Register the pool as storage for VM disks and container volumes:

```bash
pvesm add zfspool "$POOL" --pool "$POOL" --content images,rootdir --sparse 1 --nodes "$(hostname)"
```

| Option | Meaning |
| --- | --- |
| `--pool` | The ZFS pool or dataset that Proxmox uses. |
| `--content images,rootdir` | The storage holds VM disks and container volumes. |
| `--sparse 1` | Thin provisioning. Volumes only use the space they actually write. |
| `--nodes` | Restricts the storage to this node. A pool exists on one node only, so in a cluster this stops other nodes from showing the storage as unavailable. |

:::tip
You can do the same in the web UI with **Datacenter → Storage → Add → ZFS**. You can also create the pool and the storage together under **your node → Disks → ZFS → Create: ZFS**. The commands above give you more control, for example over `ashift` and the disk IDs.
:::

## Post-check

Run these after the storage is added to confirm that the pool works.

### Check the layout and the health

```bash
zpool status "$POOL"
```

Expected: the state is `ONLINE`, there are no errors, and the disks are grouped as you planned (for example under `mirror-0` or `raidz1-0`). Every disk shows `ONLINE`.

### Check the size

```bash
zpool list "$POOL"
zfs list "$POOL"
```

Expected: the size matches the layout you chose (see the capacity table). Note that `zpool list` shows the raw size including parity, and `zfs list` shows the usable space.

### Check the properties

```bash
zpool get ashift "$POOL"
zfs get compression,atime "$POOL"
```

Expected: `ashift` is `12`, `compression` is `lz4`, and `atime` is `off`.

### Check the storage in Proxmox

```bash
pvesm status
```

Expected: `$POOL` is listed as type `zfspool`, its status is `active`, and the total size matches the pool.

### Test a write

Create a small test volume and remove it again:

```bash
zfs create -V 1G "$POOL/ztest"
zfs list -r "$POOL"
zfs destroy "$POOL/ztest"
```

Expected: the volume is created without errors and is gone after the last command.

### Run a first scrub

A scrub reads every block and checks it against its checksum. On an empty pool it finishes quickly, and it proves that every disk can be read:

```bash
zpool scrub "$POOL"
zpool status "$POOL"
```

Expected: the scrub finishes with `0 errors`.

### Check the pool after a reboot

At the next reboot, confirm that the pool is imported again by itself:

```bash
zpool list
pvesm status
```

Expected: the pool is listed and the storage is `active`.

### Check in the web UI

Open the Proxmox web UI and confirm:

- The storage is listed under **Datacenter → Storage**.
- The pool is listed with a healthy state under **your node → Disks → ZFS**.
- The storage shows up when you add a disk to a VM or container.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `invalid vdev specification` / `use '-f' to override` | A disk still has an old filesystem, partition, or ZFS label. Run the [wipe step](#wipe-the-disks) again. Use `-f` only when you are sure the disk is the right one. |
| `is part of active pool` or `is in use` | The disk belongs to another pool, an LVM volume, or is mounted. Check `zpool status`, `pvs`, and `lsblk`, and pick another disk. |
| `mismatched replication level` | The vdevs have different layouts (for example a mirror and a stripe). Use the same layout for every vdev. |
| `cannot mount '/<pool>': directory is not empty` | A directory with that name already exists on the host. Rename or remove it, or set another mountpoint with `zfs set mountpoint=/path "$POOL"`. |
| The pool is smaller than expected | Disks of different sizes are treated as the smallest one, and parity takes its share. Compare against the capacity table. |
| `pvesm add` says the storage ID already exists | Another storage uses that ID. Choose another ID, or remove the old entry with `pvesm remove`. |
| The storage shows `unknown` or a question mark on another node | The storage is not restricted to the node that owns the pool. Set it with `pvesm set "$POOL" --nodes <node-name>`. |
| The pool is missing after a reboot | The pool was not imported. Run `zpool import` to list importable pools, then `zpool import "$POOL"`. Check that `zfs-import-cache` and `zfs-import-scan` are enabled. |
| Wrong `ashift` | It cannot be changed on an existing vdev. Back up the data, destroy the pool, and create it again with the right value. |

## Rollback

If you want to undo the creation, remove the storage first and destroy the pool afterwards:

```bash
pvesm remove "$POOL"
zpool destroy "$POOL"
```

To make the disks fully clean again (for example to reuse them in another pool):

```bash
for d in "${DISKS[@]}"; do
  wipefs -a "$d"
  sgdisk --zap-all "$d"
done
```

:::warning
`zpool destroy` deletes all data in the pool. Do this only on a pool that holds nothing you need.
:::

## What's next

The pool is ready. If you want to change its name later, continue with [Rename a ZFS Pool](./rename-zfs-pool).