---
sidebar_position: 3
title: Rename a ZFS Pool
description: Rename a ZFS pool and its Proxmox VE storage ID, and update every VM and container config that references it, with pre-checks and post-checks.
tags: [proxmox, zfs]
---

# Rename a ZFS Pool

This guide renames a ZFS pool on a Proxmox VE node, together with the Proxmox storage ID and every VM and container config that points to it. By the end the pool, the storage, and all guests use the new name, and you will have verified that nothing was lost on the way.

## Prerequisites

- A Proxmox VE node with `root` access.
- A ZFS pool that is used as a Proxmox storage (type `zfspool`), where the storage ID is the same as the pool name.
- The pool is **not** the root pool of the host (the one Proxmox is installed on, usually `rpool`). Renaming that pool is a different and riskier procedure and is not covered here.
- A maintenance window. All guests that use the pool must be shut down.
- A new pool name that is not used by another pool or storage on the node.

:::warning
This procedure shuts down every VM and container on the pool. Plan a maintenance window before you start.
:::

:::info
**Cluster note.** `storage.cfg` is shared by the whole cluster, but a pool exists only on the node that owns it. If the same storage ID is backed by pools on several nodes, rename the pool on every one of those nodes and shut down their guests too. The commands below only touch the guests of the node you run them on.
:::

If your storage ID is different from the pool name, only the `pool` line in `storage.cfg` needs to change. You can skip the sections about the storage ID and the guest configs.

## Set the names

Define the names once, so you can copy and paste the rest of the commands as they are. Replace the values with your own:

```bash
OLD_POOL="old-pool"
NEW_POOL="new-pool"
```

:::tip
These variables only exist in the current shell. If you lose the session (for example the SSH connection drops), run the two lines again before you continue.
:::

## Pre-check

Run these commands before you touch anything. Confirm each result matches what is described. If one does not, stop and fix it first.

### Check the pool health

![Before](<img/Screenshot 2026-10-17 200637.png>)

```bash
zpool status "$OLD_POOL"
```

Expected: the pool state is `ONLINE` and there are no errors. If it shows `DEGRADED` or `FAULTED`, fix the pool before you continue.

### Check that the pool is not the root pool

```bash
findmnt -n -o SOURCE /
```

Expected: the output does **not** start with `$OLD_POOL/`. If it does, this is the root pool. Stop here.

### Check that the new name is free

```bash
zpool list -H -o name
pvesm status
```

Expected: `$NEW_POOL` does not appear as a pool name, and it does not appear as a storage ID.

### Record the datasets and mountpoints

Save the current layout. You will compare against it in the post-check.

```bash
mkdir -p /var/backups/zpool-rename
zfs list -r -H -o name "$OLD_POOL" > /var/backups/zpool-rename/datasets-before.txt
zfs list -r -o name,used,mountpoint "$OLD_POOL"
zfs get -r -s local mountpoint "$OLD_POOL"
```

The last command lists only the datasets with a custom mountpoint. Datasets that use the default mountpoint follow the new pool name by themselves. Custom ones keep their path and may need manual attention after the rename.

### Find every reference to the old name

```bash
grep -rnI "$OLD_POOL" /etc 2>/dev/null
```

Review every match. The ones you expect to see:

- `/etc/pve/storage.cfg`: the storage definition.
- `/etc/pve/qemu-server/*.conf`: VM disk references.
- `/etc/pve/lxc/*.conf`: container disk references.

Matches in other files (backup jobs, replication jobs, permissions, scripts) are not changed by the commands in this guide. Plan to edit them by hand, see [Update the remaining references](#update-the-remaining-references).

Also think about what lives outside `/etc`: cron jobs, backup tools, monitoring, and scripts that mention the pool name or its mount path.

### Record the running guests

```bash
qm list
pct list
qm list  | awk '/running/ {print $1}' | sort -n > /var/backups/zpool-rename/running-vms.txt
pct list | awk '/running/ {print $1}' | sort -n > /var/backups/zpool-rename/running-cts.txt
```

These files are used later to start exactly the guests that were running before, and nothing else.

### Check for HA-managed guests

```bash
ha-manager status
```

If a guest is managed by HA, HA will restart it while you work. Write down its ID and its current state, then disable it:

```bash
ha-manager set vm:<id> --state disabled
```

Replace `<id>` with the VM ID. For a container use `ct:<id>` instead of `vm:<id>`.

## Procedure

Follow the sections in order.

### Back up the configuration

```bash
tar czf /var/backups/zpool-rename/pve-config-$(date +%F).tar.gz -C /etc pve
cp /etc/pve/storage.cfg /var/backups/zpool-rename/storage.cfg.bak
```

### Shut down all VMs and containers

```bash
for id in $(qm list | awk '/running/ {print $1}'); do qm shutdown $id --timeout 60 || qm stop $id; done
for id in $(pct list | awk '/running/ {print $1}'); do pct shutdown $id --timeout 60 || pct stop $id; done
```

Confirm that everything is stopped:

```bash
qm list
pct list
```

No VM or container should show `running`.

### Stop the Proxmox services

`pvestatd` polls the storage and can re-import the pool on its own. `pvescheduler` runs backup and replication jobs. Stop both so they do not interfere.

```bash
systemctl stop pvestatd pvescheduler
```

### Rename the pool

Export the pool under the old name, then import it under the new name:

```bash
zpool export "$OLD_POOL" && zpool import -d /dev/disk/by-id "$OLD_POOL" "$NEW_POOL"
```

Verify:

```bash
zpool status "$NEW_POOL"
```

Expected: the pool is `ONLINE` under the new name.

:::info
`-d /dev/disk/by-id` makes ZFS look for the disks by their stable IDs. If your pool was created with other device paths, point `-d` to that directory instead.
:::

### Update the storage config

Update the storage ID, the pool name, and the mountpoint (if the storage has one) in `storage.cfg`:

```bash
sed -i -E \
  -e "s|^(zfspool: )${OLD_POOL}\$|\1${NEW_POOL}|" \
  -e "s|^([[:space:]]+pool[[:space:]]+)${OLD_POOL}(/.*)?\$|\1${NEW_POOL}\2|" \
  -e "s|^([[:space:]]+mountpoint[[:space:]]+)/${OLD_POOL}(/.*)?\$|\1/${NEW_POOL}\2|" \
  /etc/pve/storage.cfg
```

The patterns match the whole name, so a pool called `old-pool-2` is not touched when you rename `old-pool`. A pool that sits in a sub-dataset (for example `old-pool/vmdata`) is handled as well.

Check the result:

```bash
grep -A6 "^zfspool: ${NEW_POOL}" /etc/pve/storage.cfg
```

:::warning
If the storage has a `mountpoint` line, it must be updated. When it still points to the old path, every container fails to start with `lxc.hook.pre-start` exit status 2.
:::

### Update the guest configs

Replace the storage ID in every VM and container config of this node:

```bash
sed -i -E "s/(^|[[:space:],])${OLD_POOL}:/\1${NEW_POOL}:/g" /etc/pve/qemu-server/*.conf /etc/pve/lxc/*.conf
```

This also covers the snapshot sections of the config files. Check that no disk reference is left:

```bash
grep -rnI "${OLD_POOL}:" /etc/pve/qemu-server /etc/pve/lxc
```

Expected: no output.

### Update the remaining references

Look for what is left in the Proxmox config:

```bash
grep -rnI "$OLD_POOL" /etc/pve
```

Edit the matches by hand. Typical places:

| File | What to change |
| --- | --- |
| `/etc/pve/user.cfg` | Permission paths such as `/storage/<old-pool>`. |
| `/etc/pve/jobs.cfg` | The `storage` field of backup jobs. |
| `/etc/pve/replication.cfg` | Replication jobs. The pool must be renamed on the target node too. |
| `/etc/vzdump.conf` | Default backup storage or paths. |
| `/etc/pve/lxc/*.conf` | Bind mounts that use the old mount path, for example `mp0: /old-pool/data,mp=/data`. |

### Start the Proxmox services

```bash
systemctl start pvestatd pvescheduler
pvesm status
```

Expected: the storage shows up under the new name and its status is `active`.

### Start the VMs and containers

Start only the guests that were running before the maintenance:

```bash
for id in $(cat /var/backups/zpool-rename/running-vms.txt); do qm start $id; done
for id in $(cat /var/backups/zpool-rename/running-cts.txt); do pct start $id; done
```

If you disabled HA for some guests, set them back to their previous state (usually `started`). HA then starts them, so do not start those guests by hand as well:

```bash
ha-manager set vm:<id> --state started
```

## Post-check

Run these after all guests are back up to confirm that the procedure succeeded.

### Check the pool

![After](<img/Screenshot 2026-10-17 200657.png>)

```bash
zpool list
zpool status -x
```

Expected: the pool is listed under the new name, and the old name does not appear. `zpool status -x` reports that all pools are healthy.

### Check that all datasets are intact

```bash
diff <(sed "s|^${OLD_POOL}|${NEW_POOL}|" /var/backups/zpool-rename/datasets-before.txt) <(zfs list -r -H -o name "$NEW_POOL")
```

Expected: no output. Every dataset recorded in the pre-check is present under the new pool name. Any line in the output is a dataset that is missing or new.

### Check the storage in Proxmox

```bash
pvesm status
```

Expected: the storage shows up under the new name, is `active`, and has the correct used and available space.

### Check that no old reference remains

```bash
grep -rnI "$OLD_POOL" /etc 2>/dev/null
```

Expected: no output. If something is left, edit that file by hand.

### Check the guests

```bash
diff <(qm list  | awk '/running/ {print $1}' | sort -n) /var/backups/zpool-rename/running-vms.txt
diff <(pct list | awk '/running/ {print $1}' | sort -n) /var/backups/zpool-rename/running-cts.txt
```

Expected: no output. The same VMs and containers are running as before.

Also confirm that the disks use the new storage and that HA is back to normal:

```bash
grep -rhI "${NEW_POOL}:" /etc/pve/qemu-server /etc/pve/lxc | head
ha-manager status
```

### Check in the web UI

Open the Proxmox web UI and confirm:

- The storage is listed under the new name in **Datacenter → Storage**.
- Each VM and container shows its disks on the new storage.
- No storage-related errors appear in the task log.

:::tip
Keep `/var/backups/zpool-rename` for a few days until you are sure that everything, including backup jobs, runs fine. Then you can delete it.
:::

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `pool is busy` when exporting | Something still uses the pool. Run `fuser -vm /$OLD_POOL` to find it, then stop it. Also check that all guests are really stopped. |
| `no such pool available` after the export | `pvestatd` imported the pool again. Stop it (see [Stop the Proxmox services](#stop-the-proxmox-services)) and try again. |
| `zpool import` cannot find the pool | Add `-d /dev/disk/by-id` to the command, or point `-d` to the directory where your disks are. |
| A VM fails to start, disk `<old-pool>:...` not found | A config still has the old name. Run `grep -rnI "${OLD_POOL}:" /etc/pve/qemu-server` and apply the `sed` command from [Update the guest configs](#update-the-guest-configs) again. |
| A container fails to start, `lxc.hook.pre-start` exit status 2 | The `mountpoint` in `storage.cfg` still has the old path. Update it, see [Update the storage config](#update-the-storage-config). |
| A container fails to start, bind mount path not found | A `mp` line uses the old mount path. Edit it by hand, see [Update the remaining references](#update-the-remaining-references). |
| `pvesm status` still shows the old name | Restart the service: `systemctl restart pvestatd`. |
| Backup job fails with `storage not available` | `jobs.cfg` still has the old storage ID. Edit the job in **Datacenter → Backup** or in the file. |
| `Permission check failed` on the storage for a non-root user | `user.cfg` still has the old permission path. Update `/storage/<old-pool>` to the new name. |

## Rollback

If something goes wrong before the guests are started, reverse the changes:

```bash
systemctl stop pvestatd pvescheduler
zpool export "$NEW_POOL" && zpool import -d /dev/disk/by-id "$NEW_POOL" "$OLD_POOL"
sed -i -E "s/(^|[[:space:],])${NEW_POOL}:/\1${OLD_POOL}:/g" /etc/pve/qemu-server/*.conf /etc/pve/lxc/*.conf
cp /var/backups/zpool-rename/storage.cfg.bak /etc/pve/storage.cfg
systemctl start pvestatd pvescheduler
```

If you edited other files by hand (`user.cfg`, `jobs.cfg`, and so on), extract the archive to a temporary folder and copy those files back:

```bash
mkdir -p /root/pve-restore
tar xzf /var/backups/zpool-rename/pve-config-*.tar.gz -C /root/pve-restore
```

The files are then under `/root/pve-restore/pve/`. Copy back only the ones you need.