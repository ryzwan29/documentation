---
sidebar_position: 7
title: Volumes and Block Storage
description: How OpenStack Cinder provides persistent volumes, how backends and volume types fit together, and how to create volumes, boot from a volume, and attach extra disks.
tags: [openstack, cinder, volumes, storage]
---

# Volumes and Block Storage

This page explains how persistent storage works in OpenStack, and then shows the basic operations: create a volume type, create a volume, boot an instance from a volume, and attach an extra disk. Nothing here depends on a specific storage backend. By the end you will know what Cinder does, why a volume type matters, and how an instance gets its disk from a volume.

## Ephemeral disk or volume?

An instance can get its disk in two ways:

| | Ephemeral disk | Volume (Cinder) |
| --- | --- | --- |
| Where it lives | On the local disk of the compute node | On a storage backend, outside the compute node |
| Lifetime | Deleted together with the instance | Independent of the instance |
| If the compute node dies | The disk is lost | The volume survives and can be attached to another instance |
| Typical use | Tests, stateless instances | Databases, anything you want to keep |

A volume is a block device. You can use one as the **root disk** (boot from volume) or as an **extra data disk** on top of the root disk.

## How Cinder works

Cinder is the block storage service. Four things matter:

- **`cinder-api`** receives your requests (`openstack volume create ...`).
- **`cinder-scheduler`** chooses which backend gets the new volume.
- **`cinder-volume`** talks to the storage backend and creates the volume there. A **driver** inside it knows how to speak to one kind of storage.
- **The backend** is the actual storage: an LVM volume group, a Ceph cluster, an NFS server, or a vendor array such as a Synology box.

### Control path and data path

It helps to keep two kinds of traffic apart:

```text
cinder-volume ──── management API ────▶ storage backend   (control: create / delete volume)

compute node  ──── storage protocol ───▶ storage backend   (data: the instance's disk I/O)
```

- The **control path** is used when you create, delete, resize, or snapshot a volume. `cinder-volume` calls the backend.
- The **data path** carries the disk I/O of a running instance. The compute node talks to the backend directly, with a protocol such as iSCSI.

With an external storage backend, once a volume is attached, `cinder-volume` is no longer in the data path. If the `cinder-volume` node fails, you cannot create, delete, or resize volumes, but attached volumes keep working.

### Backends and volume types

A deployment can have several backends, for example a fast one and a cheap one. Each backend has a `volume_backend_name` in its configuration. A **volume type** is a label that points to a backend through that name. When a user creates a volume with `--type fast`, the scheduler places it on the backend whose `volume_backend_name` matches.

Common backends:

| Backend | What it is | Good for |
| --- | --- | --- |
| LVM | A volume group on a node, exported over iSCSI | Small labs, a single node |
| Ceph RBD | A distributed storage cluster | Production, high availability |
| NFS | Volumes as files on an NFS server | Simple shared storage |
| Vendor driver | A driver for a specific array, for example Synology over iSCSI | Using existing hardware |

This documentation shows one complete example in the [Synology iSCSI backend](./synology-iscsi-backend/overview.md) section. The operations on this page are the same for any backend.

## Prerequisites

- A Cinder backend that works, with `cinder-volume` running and `up`.
- A volume type that points to that backend. If you have none, create one in the procedure below.
- The resources from [Post-install configuration](./post-install-openstack.md).
- The admin credentials loaded on the deployer.

## Set the names

Define the values once. Replace them with your own. `BACKEND_NAME` must be the `volume_backend_name` from your backend configuration:

```bash
VTYPE=fast
BACKEND_NAME=<volume_backend_name>
IMAGE=ubuntu-24.04
FLAVOR=c2r4d20
TENANT_NET=lab-ops-net
SECGROUP=minimum
KEYPAIR=labops
ROOT_VOL=vol-root-ops-lab-ubuntu24
DATA_VOL=vol-data01-ops-lab-ubuntu24
SERVER=ins-ops-lab-ubuntu24
```

## Pre-check

### Check the volume service

```bash
openstack volume service list
```

Expected: `cinder-scheduler` is `up` on the controllers, and a `cinder-volume` entry for your backend is `up`. If `cinder-volume` is missing or `down`, fix the backend first.

### Check the existing volume types

```bash
openstack volume type list
```

Expected: you know which types exist. Names you plan to create must not exist yet.

## Procedure

### Create a volume type

```bash
openstack volume type create $VTYPE
openstack volume type set $VTYPE --property volume_backend_name=$BACKEND_NAME
```

### Create a test volume

Start with one small volume, and check it before you build anything on top:

```bash
openstack volume create --size 1 --type $VTYPE test-vol
openstack volume show test-vol -c status -c os-vol-host-attr:host
```

The status should become `available`. If it goes to `error`, read the Cinder log on the `cinder-volume` node:

```bash
sudo docker logs cinder_volume
```

Delete the test volume when it works:

```bash
openstack volume delete test-vol
```

### Boot an instance from a volume

Create the root volume from the image on your volume type first, so it is guaranteed to land on the intended backend, then boot from it:

```bash
openstack volume create --size 20 --type $VTYPE --image $IMAGE --bootable $ROOT_VOL

openstack server create --flavor $FLAVOR \
  --volume $ROOT_VOL \
  --network $TENANT_NET \
  --security-group $SECGROUP \
  --key-name $KEYPAIR \
  $SERVER
```

Wait until the volume is `available` before booting, and until the server is `ACTIVE` before the next step:

```bash
openstack volume show $ROOT_VOL -c status
openstack server show $SERVER -c status -c addresses
```

Then give the instance a floating IP and log in as shown in [Launch an instance](./launch-instance.md).

:::note
`--boot-from-volume 20` is the shortcut, but it creates the root volume with the **default** volume type and gives you no way to choose another. With one backend this makes no difference, but creating the volume yourself with `--type` keeps working if you add a second backend later.
:::

### Attach an extra data volume

```bash
openstack volume create --size 10 --type $VTYPE $DATA_VOL
openstack server add volume $SERVER $DATA_VOL
```

Inside the guest, the new disk appears as a second block device. Create a file system on it and mount it as you would on any server.

## Post-check

### Check the volumes

```bash
openstack volume list
```

Expected: the root volume is `in-use` and bootable, and the data volume is `in-use`.

### Check inside the guest

```bash
ssh -i ~/.ssh/$KEYPAIR ubuntu@<floating-ip> lsblk
```

Expected: `lsblk` shows the 20 GB root disk and the 10 GB data disk.

![Disks inside the instance](<img/Screenshot 2026-10-02 142956.png>)

### Check where the volume lives

```bash
openstack volume show $ROOT_VOL -c os-vol-host-attr:host
```

Expected: the host name contains your backend. This field is visible to admins only.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| A volume goes to `error` immediately | Read `docker logs cinder_volume` on the `cinder-volume` node. Common causes are wrong credentials for the backend or an unreachable backend. |
| A volume stays in `creating` | The scheduler found no backend that matches the type, or `cinder-volume` is down. Check `openstack volume service list` and the `volume_backend_name` of the type. |
| `No valid backend was found` | The type points to a `volume_backend_name` that no running backend uses. Compare the type property with the backend configuration. |
| The server boots but cannot find a root disk | The root volume is not `bootable`, or it was created without `--image`. Recreate it with both options. |
| Attach fails | The compute node cannot reach the backend over the storage network. Check the storage interface and the protocol requirements of your backend. |
| A volume is stuck in `attaching` or `deleting` | A previous failure left it in a transient state. Reset it with `openstack volume set --state available <id>` and retry. |

## Rollback

Delete in this order, because a volume that is in use cannot be deleted:

```bash
openstack server delete $SERVER
openstack volume delete $DATA_VOL $ROOT_VOL
openstack volume type delete $VTYPE
```

:::warning
Deleting a volume deletes its data. Do this only on volumes that hold nothing you need.
:::

## What's next

If you want a complete example of a backend, continue with the [Synology iSCSI backend](./synology-iscsi-backend/overview.md).
