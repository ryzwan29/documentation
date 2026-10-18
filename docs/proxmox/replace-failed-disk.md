---
sidebar_position: 4
title: Replace a Failed Disk in a ZFS Pool
description: Find a failed or failing disk in a ZFS pool on Proxmox VE, prepare for the swap, replace it with zpool replace, and verify the resilver with pre-checks and post-checks.
tags: [proxmox, zfs]
---

# Replace a Failed Disk in a ZFS Pool

This guide shows how to find out that a disk in a ZFS pool is failing, what you need to have ready before you touch anything, and how to replace the disk on a Proxmox VE node. By the end the pool is `ONLINE` again with the new disk fully resilvered, and you will have verified that no data was lost.

The pool keeps its name and its Proxmox storage ID, so nothing in `storage.cfg` or in the VM and container configs has to change.

## Find the failed disk

Do not replace a disk just because one command looks odd. Confirm the problem with more than one source first.

### Check the pool status

Ask ZFS if any pool has a problem:

```bash
zpool status -x
```

Expected: `all pools are healthy`. If a pool is listed instead, look at it in detail:

```bash
zpool status -v <pool>
```

Look at the `state` line of the pool, the state of each disk, and the `READ`, `WRITE`, and `CKSUM` columns. The `action:` line tells you what ZFS suggests.

| Disk state | Meaning |
| --- | --- |
| `ONLINE` | The disk works. It can still have errors, check the counters. |
| `DEGRADED` | The pool or vdev still works, but it has lost redundancy. Usually one of its disks is `FAULTED`, `UNAVAIL`, or `OFFLINE`. |
| `FAULTED` | ZFS stopped using the disk because of too many errors. |
| `UNAVAIL` | ZFS cannot open the disk. It is dead, removed, or the cable or slot is bad. If the disk is gone, ZFS shows a long number (the GUID) instead of its name. |
| `REMOVED` | The disk was pulled out while the system was running (hot-swap). |
| `OFFLINE` | An administrator took the disk offline on purpose. |

| Counter | Meaning |
| --- | --- |
| `READ` | The disk failed to read a block. |
| `WRITE` | The disk failed to write a block. |
| `CKSUM` | The disk returned data that did not match its checksum. ZFS repaired it from redundancy if it could. |

### Check the SMART data

SMART is the disk's own health report. Run it for the disk you suspect:

```bash
smartctl -H /dev/disk/by-id/<disk-id>
smartctl -a /dev/disk/by-id/<disk-id>
```

`-H` gives a quick `PASSED` or `FAILED`. A disk can still say `PASSED` and be close to failing, so also read the attributes from `-a`:

| Attribute (SATA/SAS) | Why it matters |
| --- | --- |
| `Reallocated_Sector_Ct` (5) | The disk moved bad sectors to spare ones. A growing number means the surface is wearing out. |
| `Current_Pending_Sector` (197) | Sectors that could not be read and wait to be remapped. Anything above 0 is a warning. |
| `Offline_Uncorrectable` (198) | Sectors that could not be fixed. Anything above 0 is a warning. |
| `UDMA_CRC_Error_Count` (199) | Errors on the cable or port, not on the disk surface. Check the cable first. |

For NVMe disks, look at `Critical Warning`, `Media and Data Integrity Errors`, `Available Spare`, and `Percentage Used`.

To run a quick self-test, and read the result after a couple of minutes:

```bash
smartctl -t short /dev/disk/by-id/<disk-id>
smartctl -l selftest /dev/disk/by-id/<disk-id>
```

### Check the kernel log

```bash
dmesg -T | grep -iE 'I/O error|blk_update_request|ata[0-9]+|nvme|reset|offline'
```

Repeated `I/O error`, link resets, or `failed command` lines for the same disk point to a failing disk, or to a bad cable or controller.

### Check in the web UI

- **your node → Disks** shows the SMART status of every disk. A red `FAILED` is clear.
- **your node → Disks → ZFS** shows the health of each pool.
- Proxmox also sends an email to `root` when ZFS reports a problem (through `zfs-zed`), if mail is set up on the node.

### Decide what to do

| What you see | Likely cause | Action |
| --- | --- | --- |
| Disk `FAULTED`, `UNAVAIL`, or `REMOVED`, SMART cannot read it | Dead disk or lost connection | Reseat the disk or the cable if it is a hot-swap bay. If it is still missing, replace it. |
| SMART `FAILED`, or `Reallocated`/`Pending` sectors growing | Failing disk | Replace it. |
| `READ` or `WRITE` errors keep growing | Failing disk | Replace it. |
| Only `UDMA_CRC_Error_Count` is growing, the surface attributes are fine | Bad cable, port, or backplane | Change the cable or the port first, then clear the errors and watch. |
| A few `CKSUM` errors once, SMART is clean, they do not come back | One-off glitch | Run `zpool clear <pool>`, then a scrub, and keep watching. |

:::warning
When one disk fails, the pool is running without that redundancy. On a mirror or `raidz1`, one more failure can lose data. Replace the disk soon, and do not wait for the next scrub.
:::

## Prerequisites

Before you replace anything, make sure you have all of this:

- A Proxmox VE node with `root` access.
- A ZFS pool with redundancy (mirror, `raidz1`, `raidz2`, or `raidz3`). A stripe has no redundancy, so a dead disk means the pool is lost, and `zpool replace` only works while the failing disk can still be read.
- The pool is **not** the root pool of the host (the one Proxmox is installed on, usually `rpool`). Replacing a boot disk needs extra steps (the partition layout and the boot loader), and is not covered here. See the "Changing a failed bootable device" section of the Proxmox VE documentation.
- A **replacement disk** that is the same size as the failed one or **larger**. A disk that is even a few MB smaller is refused. The same type (SSD or HDD) and a similar speed is best.
- The **serial number** of the failed disk, so you pull the right one from the server. Pulling the wrong disk from a degraded `raidz1` or mirror loses the pool.
- A **backup** of the data that matters (for example a recent `vzdump` or Proxmox Backup Server run). While the disk is being rebuilt, the pool has less or no redundancy.
- The **other disks in the pool are healthy**. A rebuild reads every disk heavily, and a weak disk can fail right then.
- No other scrub or resilver is running on the pool.
- A quiet period. The pool stays online and the guests keep running, but the rebuild is slower when the pool is busy, and the rebuild takes hours on large disks.
- A way to swap the disk: a hot-swap bay, or a short shutdown of the node. If you have to shut the node down, plan a maintenance window and shut down the guests first.

:::info
**Cluster note.** A pool exists only on the node that owns it. Run all commands on that node. The other nodes are not affected.
:::

## Set the names

Define the names once, so you can copy and paste the rest of the commands. Replace the values with your own. For `OLD_DISK`, copy the name exactly as `zpool status` shows it. If the disk is gone, use the long number (GUID) instead:

```bash
POOL="tank"
OLD_DISK="<failed-disk-name-or-guid>"
NEW_DISK="/dev/disk/by-id/<new-disk-id>"
```

:::tip
These variables only exist in the current shell. If you lose the session (for example the SSH connection drops), run the lines again before you continue. You can set `NEW_DISK` later, after the new disk is installed.
:::

## Pre-check

Run these commands before you touch anything. Confirm each result matches what is described. If one does not, stop and fix it first.

### Check the pool and find the failed disk

```bash
zpool status -v "$POOL"
```

Expected: exactly the disk you found earlier is `FAULTED`, `UNAVAIL`, `REMOVED`, or has errors, and the rest of the pool is `ONLINE`. If the pool is `FAULTED` instead of `DEGRADED`, too many disks are lost. Stop here and restore from backup.

### Check that the pool is not the root pool

```bash
findmnt -n -o SOURCE /
```

Expected: the output does **not** start with `$POOL/`. If it does, this is the root pool. Stop here.

### Check that no scrub or resilver is running

```bash
zpool status "$POOL" | grep -A3 'scan:'
```

Expected: no `in progress` message. If a scrub is running and the pool is degraded, stop it with `zpool scrub -s "$POOL"`. If a resilver is running, wait until it is done.

### Record the current state

Save the layout. You will use it to match the serial number to the right disk and to compare in the post-check.

```bash
mkdir -p /var/backups/zpool-replace
zpool status -v "$POOL" > /var/backups/zpool-replace/status-before.txt
lsblk -o NAME,SIZE,MODEL,SERIAL,MOUNTPOINTS > /var/backups/zpool-replace/lsblk-before.txt
ls -l /dev/disk/by-id/ | grep -v -- '-part' > /var/backups/zpool-replace/by-id-before.txt
```

### Match the failed disk to a physical disk

Find the serial number of the failed disk. The disk ID usually ends with it:

```bash
ls -l /dev/disk/by-id/ | grep -v -- '-part'
smartctl -i /dev/disk/by-id/<disk-id> | grep -iE 'model|serial'
```

If the disk is already gone and does not show up any more, use the files you saved earlier, or an older output of `lsblk`, to find its serial number. Compare the serial number with the label on the physical disk. If your bays have an activity LED, you can read from a disk that still works so its LED blinks (for example `dd if=/dev/disk/by-id/<disk-id> of=/dev/null bs=1M count=2000`).

:::warning
Never pull a disk when you are not sure it is the failed one. Compare the serial number on the label with the one from `smartctl`.
:::

### Check the health of the remaining disks

```bash
for d in /dev/disk/by-id/<disk-id-1> /dev/disk/by-id/<disk-id-2>; do
  echo "== $d"; smartctl -H "$d"
done
zpool status "$POOL" | grep 'scan:'
```

Replace the list with the other disks of the pool. Expected: `PASSED` for all of them, and the last scrub finished with `0 errors`. If another disk already shows problems, take a backup first, and think about replacing that disk too.

### Check the replacement disk

Once the new disk is installed (or before, if it is in another computer), check that it is not smaller than the failed disk and that it is healthy:

```bash
lsblk -b -o NAME,SIZE,MODEL,SERIAL
smartctl -H "$NEW_DISK"
```

Expected: its size in bytes is the same or larger than the failed disk, and SMART says `PASSED`. Compare the size with the size of the other disks in the pool. Check also that the pool works with the sector size of the new disk:

```bash
zpool get ashift "$POOL"
lsblk -o NAME,PHY-SEC,LOG-SEC "$NEW_DISK"
```

Expected: `ashift` is `12` (or `0`, which means automatic). If `ashift` is `9`, the pool cannot take a disk that uses real 4K sectors. See [Troubleshooting](#troubleshooting).

### Check the HA state of the guests (optional)

You do not need to stop the guests, because the pool stays online. Only check that none of them is moving or being backed up at the moment:

```bash
ha-manager status
cat /etc/pve/jobs.cfg 2>/dev/null
```

If a backup job on this pool runs soon, wait until it is done or postpone it.

## Procedure

Follow the sections in order.

### Take the failed disk offline

This step depends on the state of the disk.

- If the disk is already `FAULTED`, `UNAVAIL`, or `REMOVED`, skip this step. ZFS has stopped using it.
- If the disk is still `ONLINE` but has errors, and you **can add the new disk without removing the old one** (a free bay or port), skip this step too. Leave the old disk online. ZFS then reads from it during the replacement, which is safer.
- If you must pull the old disk before the new one goes in, take it offline first:

```bash
zpool offline "$POOL" "$OLD_DISK"
zpool status "$POOL"
```

Expected: the disk is `OFFLINE` and the pool is `DEGRADED`.

:::info
If ZFS answers `no valid replicas`, taking the disk offline would make data unavailable. Do not force it. Keep the disk online and replace it as described above, or restore from backup.
:::

### Swap the disk

**Hot-swap bay:** pull the failed disk and insert the new one.

**No hot-swap:** shut down the guests, shut down the node, swap the disk, and start the node again. The pool is imported as `DEGRADED`.

Then find the new disk and get its stable ID:

```bash
dmesg -T | tail -20
lsblk -o NAME,SIZE,MODEL,SERIAL,MOUNTPOINTS
ls -l /dev/disk/by-id/ | grep -v -- '-part'
```

Use the ID under `/dev/disk/by-id/` (for example `ata-...` or `nvme-...`), not `/dev/sdX`. Put it in `NEW_DISK` (see [Set the names](#set-the-names)) and check it:

```bash
ls -l "$NEW_DISK"
smartctl -i "$NEW_DISK" | grep -iE 'model|serial'
```

### Wipe the new disk

If the disk is brand new, you can skip this. If it was used before, this removes old partition tables, filesystem signatures, and ZFS labels:

```bash
wipefs -a "$NEW_DISK"
sgdisk --zap-all "$NEW_DISK"
```

:::warning
This step is destructive and cannot be undone. Make sure `NEW_DISK` is the new disk and not a disk of the pool.
:::

### Replace the disk

```bash
zpool replace "$POOL" "$OLD_DISK" "$NEW_DISK"
```

ZFS partitions the new disk by itself and starts rebuilding the data on it (this is called a **resilver**). The pool stays online during this.

:::info
Do not add `-f` just to make an error go away. If ZFS refuses with a message about an existing filesystem or pool, the disk is not clean or is the wrong disk. Check it first. See [Troubleshooting](#troubleshooting).
:::

### Watch the resilver

```bash
zpool status -v "$POOL"
```

Expected: a `replacing-N` group that contains the old and the new disk, and a `scan:` line with `resilver in progress`, with the speed and the estimated time. To follow it live:

```bash
watch -n 10 zpool status "$POOL"
```

Press `Ctrl+C` to leave `watch`. The resilver keeps running without you.

:::tip
A resilver takes from minutes (small or SSD pools) to many hours (large HDDs, especially `raidz`). The pool is usable meanwhile. Avoid heavy writes, and do not reboot or pull other disks until it is finished.
:::

When it is done, the `replacing-N` group disappears by itself, the old disk is gone from the list, and the `scan:` line says `resilvered ... with 0 errors`.

### Clear the old error counters

After the resilver finishes, reset the counters, so old errors do not hide new ones:

```bash
zpool clear "$POOL"
```

## Post-check

Run these after the resilver is finished to confirm that the procedure succeeded.

### Check the pool

```bash
zpool status -v "$POOL"
zpool status -x
```

Expected: the pool is `ONLINE`, every disk is `ONLINE` with `0` in `READ`, `WRITE`, and `CKSUM`, the new disk is listed, there is no `replacing` group, and `errors: No known data errors`. `zpool status -x` says that all pools are healthy.

### Check the new disk

```bash
lsblk -o NAME,SIZE,MODEL,SERIAL
smartctl -H "$NEW_DISK"
```

Expected: the new disk is partitioned by ZFS (a large partition and a small one) and SMART says `PASSED`.

### Run a scrub

A scrub reads every block and checks it against its checksum. It proves that the data on the new disk and on the old ones is correct:

```bash
zpool scrub "$POOL"
zpool status "$POOL"
```

Expected: the scrub finishes with `0 errors`. If it finds and repairs errors on the disks, look for the cause. It can be a bad cable or another weak disk.

### Check the storage in Proxmox

```bash
pvesm status
```

Expected: the storage of the pool is `active`, and the used and available space are as before.

### Check the guests

```bash
qm list
pct list
```

Expected: the same VMs and containers are running as before the replacement.

### Check in the web UI

Open the Proxmox web UI and confirm:

- **your node → Disks → ZFS** shows the pool as healthy.
- **your node → Disks** shows the new disk with its serial number and SMART status `PASSED`, and the failed disk is gone from the pool.
- No storage-related errors appear in the task log.

### Handle the old disk

Write the serial number of the old disk down and mark it as failed, so it is not used again by mistake. If you return it (warranty) or throw it away, wipe it first when it can still be read:

```bash
wipefs -a /dev/disk/by-id/<old-disk-id>
```

:::tip
Keep `/var/backups/zpool-replace` for a few days until you are sure that the pool is stable. Then you can delete it. Also update your notes (which serial number sits in which bay).
:::

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `cannot replace ... device is too small` | The new disk is smaller than the old one. Use a disk of the same size or larger. Compare the sizes in bytes with `lsblk -b`. |
| `cannot replace ... devices have different sector alignment` | The pool uses `ashift=9` and the new disk has real 4K sectors. Use a disk with 512 byte sectors, or back up and recreate the pool with `ashift=12`. |
| `is in use and contains a unknown filesystem` or `contains a valid ZFS label` | The new disk still has old data or labels. Run the [wipe step](#wipe-the-new-disk) again. Use `-f` only when you are sure it is the right disk. |
| `no such device in pool` | `OLD_DISK` does not match the name in `zpool status`. Copy the name or the GUID exactly as it is shown. |
| `cannot offline ... no valid replicas` | Taking the disk offline would make data unavailable. Keep the disk online and replace it directly, or restore from backup. |
| The new disk does not show up | Check the cable, the slot, and `dmesg -T`. On a hot-swap bay you can rescan the controller with `echo '- - -' > /sys/class/scsi_host/host<N>/scan`. |
| The resilver is very slow | Normal for large HDDs and for `raidz`. Check that the pool is not busy with a backup, and look at `zpool status` for the speed. Check `dmesg -T` if it is much slower than expected. |
| The resilver keeps restarting | A disk is dropping out and coming back (cable, power, or controller). Check `dmesg -T` and the cables. |
| Another disk fails during the resilver | On a mirror or `raidz1` the pool can be lost, check `zpool status -v` for `permanent errors` and restore from backup. On `raidz2` or `raidz3` the resilver can still finish. Replace the next disk afterwards. |
| `errors: Permanent errors have been detected` after the resilver | Some data could not be repaired. Restore the files or VM disks listed in `zpool status -v` from backup, then run a scrub. The list can take up to two scrubs to clear. |
| The pool is still `DEGRADED` after the resilver, the old disk is still listed | Detach the old disk: `zpool detach "$POOL" "$OLD_DISK"`. This works on mirrors and on `replacing` groups that did not clean up. |
| A hot spare is still shown as `INUSE` | Detach the spare so it goes back to being a spare: `zpool detach "$POOL" <spare-disk>`. |
| The `CKSUM` errors on the new disk keep growing | The disk is bad, or the cable, port, or backplane is. Check `UDMA_CRC_Error_Count` in `smartctl -A`, and try another port. |
| `smartctl` cannot read a disk behind a RAID controller | Use the controller option, for example `smartctl -a -d megaraid,<N> /dev/sdX`. A controller in RAID mode is not recommended for ZFS. |

## Rollback

A replacement cannot be undone once the resilver has finished, because the old disk is then out of the pool. You can cancel it **while the resilver is running**, as long as the old disk is still attached to the `replacing` group:

```bash
zpool detach "$POOL" "$NEW_DISK"
zpool status "$POOL"
```

Expected: the `replacing` group is gone and the pool is back to the old disk.

If the new disk turns out to be bad, replace it again with another one:

```bash
zpool replace "$POOL" "$NEW_DISK" /dev/disk/by-id/<other-disk-id>
```

If you stopped a scrub or changed HA settings along the way, set them back: `zpool scrub "$POOL"` to start a scrub, and `ha-manager set vm:<id> --state started` for a guest that you disabled. For a container use `ct:<id>` instead of `vm:<id>`.

:::warning
Do not try to put an old disk back into the pool after the resilver finished. Its data is out of date. Wipe it and add it as a new disk with `zpool replace` if you really need it.
:::

## What's next

The pool is healthy again. To find the next failure early, check that `zfs-zed` is running and that mail for `root` reaches you (the address is set in `/etc/zfs/zed.d/zed.rc`), and run a scrub on a schedule. If you want to change the name of the pool later, continue with [Rename a ZFS Pool](./rename-zfspool.md).