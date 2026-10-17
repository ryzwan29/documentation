---
sidebar_position: 3
title: Glance Image Storage on NFS
description: Give the three controllers one shared image store by mounting an NFS share at the Glance data path, and prove the share is really shared.
tags: [openstack, glance, nfs, kolla-ansible]
---

# Glance Image Storage on NFS

This guide mounts an NFS share on all three controllers, so that Glance has one image store that every controller sees. By the end the same directory is mounted on all controllers, a file written on one of them is visible on the others, and the path is ready to be used as the Glance data directory in `globals.yml`.

## Why a shared image store?

By default Glance stores images as plain files on the local disk of the controller that received them. With three controllers behind one VIP, an upload lands on whichever controller answers, and the other two do not have the file. A request that is later served by another controller then fails to find the image.

The fix is one location that every controller mounts. NFS is the simplest way to do that in a lab. Any NFS server works. This documentation uses the Synology share from [Create an NFS share](../synology/nfs-share.md), at `172.16.2.31:/volume1/glance`.

:::note
A single NFS server is a single point of failure for the image store. Instances that are already running do not need Glance, but you cannot create new instances from images while the share is down.
:::

## Prerequisites

- The NFS share is ready, with a read/write permission for the storage subnet, **No mapping** squash, and the service bound to the storage network. See [Create an NFS share](../synology/nfs-share.md).
- The controllers have an address on the storage 1 network (`172.16.2.36`, `.37`, `.38` in the examples). See [Prepare the nodes](./prepare-nodes.md).
- Port `2049` is allowed from the controllers in the firewall of the NFS server.
- `sudo` access on the three controllers.

## Set the names

Run these on each controller. Replace the values with your own:

```bash
NFS_SERVER=172.16.2.31
NFS_EXPORT=/volume1/glance
MNT=/mnt/glance
```

:::tip
These variables only exist in the current shell. If you lose the session, run the lines again before you continue.
:::

## Pre-check

### Check that the NFS server answers

```bash
ping -c 2 $NFS_SERVER
nc -zv $NFS_SERVER 2049
```

Expected: the server answers a ping, and port `2049` accepts the connection.

### Check that the mount point is free

```bash
findmnt $MNT || echo "not mounted"
ls -la $MNT 2>/dev/null
```

Expected: `not mounted`, and either no directory or an empty one.

## Procedure

Run this on **all three controllers**.

### Install the NFS client

```bash
sudo apt install -y nfs-common
sudo mkdir -p $MNT
```

### Make the mount permanent

Add the share to `/etc/fstab`:

```bash
echo "$NFS_SERVER:$NFS_EXPORT  $MNT  nfs4  vers=4.1,_netdev,nofail,x-systemd.automount  0  0" | sudo tee -a /etc/fstab
```

The options mean:

- `vers=4.1` selects NFSv4.1, which needs only port `2049`.
- `_netdev` waits for the network before mounting.
- `nofail` lets the node boot even if the share is not available.
- `x-systemd.automount` mounts the share on first access instead of at boot.

### Mount it

```bash
sudo systemctl daemon-reload
sudo mount -a
sudo chmod 755 -R $MNT/
```

## Post-check

### Check the mount

On each controller:

```bash
df -h $MNT
findmnt $MNT
```

Expected: the NFS share is mounted at `/mnt/glance` with the size of the NFS volume.

### Check that the share is really shared

Write from one controller and read from the others:

```bash
echo ok | sudo tee $MNT/test.txt   # controller-01
cat $MNT/test.txt                  # controller-02 and controller-03
sudo rm $MNT/test.txt              # any controller
```

Expected: `controller-02` and `controller-03` print `ok`. If they do not, the controllers are not mounting the same export.

### Check the mount after a reboot

Reboot one controller, then:

```bash
ls $MNT
df -h $MNT
```

Expected: the share is mounted again without manual steps.

## Use it in Glance

The deploy guide sets `glance_file_datadir_volume: "/mnt/glance"` in `globals.yml`. Kolla then mounts that directory into the Glance container, and uploaded images are stored on the share. See [Deploy with Kolla Ansible](./deploy-kolla-ansible.md).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `mount.nfs: access denied by server` | The controller address is not covered by the NFS permission rule on the server. |
| `mount.nfs: Connection timed out` | Port `2049` is blocked, or the controller has no address on the storage 1 network. |
| `Permission denied` when Glance writes later | The export maps users (squash). Set **No mapping** on the server and check the folder permissions. |
| The node hangs at boot | The `fstab` line lacks `nofail` or `_netdev`. Add both options. |
| The files differ between controllers | The controllers mount different exports, or one has a local directory under `/mnt/glance` that is hiding the mount. Check `findmnt $MNT`. |

## Rollback

To stop using the share on a controller, remove the line from `/etc/fstab` and unmount it:

```bash
sudo sed -i "\|$NFS_SERVER:$NFS_EXPORT|d" /etc/fstab
sudo umount $MNT
```

## What's next

Continue with [Deploy with Kolla Ansible](./deploy-kolla-ansible.md).
