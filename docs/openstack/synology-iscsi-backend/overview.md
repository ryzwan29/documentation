---
sidebar_position: 1
title: Overview
description: How Cinder talks to a Synology DSM box over the WebAPI and iSCSI, the limits of this setup, and the design of two storage paths with multipath.
tags: [openstack, cinder, synology, iscsi]
---

# Synology iSCSI Backend: Overview

Most OpenStack storage guides jump straight to Ceph. That is the right answer for production, but it is a lot of machinery for a lab. If you already have a Synology DSM box, there is a much lighter option: Cinder ships an in-tree driver for Synology (`SynoISCSIDriver`) that creates one iSCSI LUN per volume. This section connects the multinode Kolla Ansible cloud to Synology DSM over iSCSI, with two storage paths and multipath, and boots instances from Synology-backed volumes.

## How Cinder talks to Synology

The driver works with two kinds of traffic, and it helps to keep them apart in your head:

```text
cinder-volume ──── HTTPS :5001 ────▶ DSM WebAPI      (control: create / delete LUN + target)

compute node  ──── iSCSI  :3260 ───▶ DSM iSCSI target (data: the instance's disk I/O)
```

Every time you create a volume in OpenStack, `cinder-volume` logs in to the **DSM WebAPI** and creates an *advanced file LUN* plus an iSCSI target inside a DSM volume. When you attach it, the **compute node** logs in to that target directly, and the LUN shows up as a block device for the instance. Once a volume is attached, `cinder-volume` is no longer in the data path.

:::warning
Read this before you build anything on it.

- The driver documentation targets DSM 6.0.2 or later. DSM 7 renamed *iSCSI Manager* to *SAN Manager*, and the driver docs do not explicitly promise that every API still behaves the same. Test with **one** volume before you build anything else on top.
- A single DSM box is a **single point of failure**. Two network paths protect you from a broken link, not from a dead DSM.
- The Synology driver does **not** support active/active. You run `cinder-volume` on exactly one node.
:::

## The design

- **Two storage networks**, `172.16.2.0/24` and `172.16.3.0/24`, no gateway. DSM has an address on both: `172.16.2.31` and `172.16.3.31`.
- **Two iSCSI paths** to the same target. The compute node logs in through both portals, and **multipath** merges the two sessions into one block device.
- **The WebAPI** is reached over the first storage network, on port `5001`.
- **One `cinder-volume`** instance, with a fixed logical host name (`backend_host`), so volumes are not tied to a node name and the service can be moved by hand.

See the [introduction](../introduction.md) for the nodes and the networks.

## What you will do

| Page | What it covers |
| --- | --- |
| [Prepare Synology for Cinder](./prepare-synology.md) | The service account, the firewall, and a test of the WebAPI |
| [Prepare the nodes for iSCSI](./prepare-nodes-iscsi.md) | Disable the host `iscsid` and `multipathd`, and check both storage subnets |
| [Configure the Cinder backend](./cinder-backend-config.md) | `globals.yml`, `cinder-volume.conf`, deploy, a volume type, and a test volume |
| [Verify the iSCSI paths](./verify-multipath.md) | Two sessions, one multipath device, and a failover test |
| [Fail over cinder-volume](./failover-cinder-volume.md) | What fails and what keeps working, and how to move the service |
| [Troubleshooting and fallback](./troubleshooting.md) | Common errors and an LVM fallback |

## Prerequisites

Everything in this section builds on the general guides. Complete them first:

1. A running DSM with a Btrfs volume, static IPs on both storage networks, and iSCSI bound to them. See the [Synology guides](../../synology/deploy-xpenology.md), especially [Set up the DSM network](../../synology/network-setup.md), [Create a storage pool and a volume](../../synology/storage-pool-volume.md), and [Set up iSCSI](../../synology/iscsi-setup.md).
2. A deployed OpenStack cloud. See [Deploy with Kolla Ansible](../deploy-kolla-ansible.md).
3. The basics of [Volumes and block storage](../volumes.md).

## What's next

Continue with [Prepare Synology for Cinder](./prepare-synology.md).
