---
sidebar_position: 3
title: Set Up the DSM Network
description: Add network interfaces to the DSM VM, set a static IP on each one, and keep storage traffic on separate subnets without a gateway.
tags: [synology, dsm, network, proxmox]
---

# Set Up the DSM Network

This guide gives the DSM VM the network layout of a small storage lab: one interface for management and internet access, and one or two interfaces that only carry storage traffic. By the end each interface has a static IP, the storage interfaces have no gateway, and you have checked that the other machines can reach them.

## Why separate networks?

Storage traffic (iSCSI, NFS) should not share a network with management traffic. A separate subnet keeps it predictable, keeps it off the internet path, and lets you firewall it easily.

With **two** storage subnets (instead of two addresses in one subnet), routing stays unambiguous and you get two independent paths to the same DSM. That is what multipath iSCSI needs later.

The layout used in this documentation:

| Interface | Subnet | DSM address | Used for |
| --- | --- | --- | --- |
| Management | `192.168.19.0/24` | `192.168.19.31` | DSM web interface, internet access |
| Storage 1 | `172.16.2.0/24` | `172.16.2.31` | iSCSI path 1, NFS, API calls |
| Storage 2 | `172.16.3.0/24` | `172.16.3.31` | iSCSI path 2 |

The storage subnets have **no gateway**. Replace the addresses with your own.

## Prerequisites

- A running DSM VM. See [Deploy Xpenology with Arc Loader](./deploy-xpenology.md).
- One Proxmox bridge per storage network (the examples use `vmbr1` and `vmbr2`). They can be internal bridges without a physical port if all machines of the lab run on the same Proxmox host.
- An admin account on DSM.

:::note
When both storage networks are bridges on the same Proxmox host, a failover test on them only trains a logical path failure (a NIC going down inside a VM), not a real physical NIC or switch failure.
:::

## Set the names

Define the VM and the bridges once. Replace the values with your own:

```bash
VMID=100
BR_STORAGE1=vmbr1
BR_STORAGE2=vmbr2
```

:::tip
These variables only exist in the current shell. If you lose the session, run the lines again before you continue.
:::

## Pre-check

### Check the NICs of the VM

On the Proxmox host:

```bash
qm config $VMID | grep ^net
ip -br link show $BR_STORAGE1
ip -br link show $BR_STORAGE2
```

Expected: `net0` exists, and both storage bridges exist and are `UP`. If `net1` and `net2` already exist, skip the next section.

### Check the addresses that are already in use

Make sure the addresses you plan to use are free, for example from a machine on the same network:

```bash
ping -c 2 172.16.2.31
ping -c 2 172.16.3.31
```

Expected: no reply, because nothing uses those addresses yet.

## Procedure

### Add the storage NICs to the VM

```bash
qm set $VMID --net1 virtio,bridge=$BR_STORAGE1
qm set $VMID --net2 virtio,bridge=$BR_STORAGE2
```

Reboot the VM so DSM sees the new interfaces:

```bash
qm reboot $VMID
```

:::note
DSM only sees the NICs that the loader knows about. If a new interface does not show up in DSM, switch it to `e1000` (`qm set $VMID --net1 e1000,bridge=$BR_STORAGE1`), or boot into the Arc menu and rebuild the loader so it detects the new NICs. Menu labels differ between Arc versions.
:::

### Set a static IP on each interface

1. Open **Control Panel → Network → Network Interface**.
2. Select the storage 1 interface, click **Edit**, choose **Use manual configuration**, and enter `172.16.2.31` with the netmask `255.255.255.0`. **Leave the gateway empty.**
3. Do the same for the storage 2 interface with `172.16.3.31`.
4. Keep the management interface on its own address and gateway, because DSM needs the gateway for internet access.

![Static IP on the storage interfaces](<img/Screenshot 2026-10-01 224458.png>)

:::warning
Do not set a default gateway on the storage interfaces. DSM then keeps a single default route through the management network, and storage traffic stays inside its own subnets.
:::

## Post-check

### Check the addresses from another machine

From a machine that has an address on both storage subnets:

```bash
ping -c 2 172.16.2.31
ping -c 2 172.16.3.31
```

Expected: both answer.

### Check that there is no extra gateway

Open **Control Panel → Network → General** and look at the default gateway.

Expected: there is one default gateway, and it belongs to the management network.

### Check in the web UI

Open **Control Panel → Network → Network Interface** and confirm:

- Every interface shows the static address you set.
- The storage interfaces show an empty gateway.
- All interfaces are connected.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The new interface does not appear in DSM | The loader does not know the NIC. Switch the NIC to `e1000` or rebuild the loader in Arc. |
| The storage address does not answer a ping | The machine you test from has no address in that subnet, or the VM NIC is on the wrong bridge. Check `qm config $VMID` and the bridge name. |
| DSM lost internet access after the change | A gateway was set on a storage interface and became the default route. Remove it and keep only the management gateway. |
| DSM web interface is not reachable after the change | The management address changed by mistake. Use the Proxmox console of the VM to fix it. |

## Rollback

To remove the storage interfaces, shut down the VM, then remove the NICs:

```bash
qm shutdown $VMID
qm set $VMID --delete net1,net2
qm start $VMID
```

Then set the DSM network back to a single interface.

## What's next

Continue with [Create a storage pool and a volume](./storage-pool-volume.md).
