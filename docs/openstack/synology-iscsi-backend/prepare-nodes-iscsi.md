---
sidebar_position: 3
title: Prepare the Nodes for iSCSI
description: Disable the host iscsid and multipathd so the Kolla containers can run them, and check that every node has an address on both storage subnets and reaches both iSCSI portals.
tags: [openstack, cinder, iscsi, multipath, kolla-ansible]
---

# Prepare the Nodes for iSCSI

Kolla Ansible runs `iscsid` and `multipathd` as **containers** on the compute nodes and on the `cinder-volume` node. If the host's own `iscsid`, `open-iscsi`, or `multipathd` are also running, they fight with the containers. This guide turns the host services off, and checks the storage network on every node. By the end no host-level iSCSI or multipath service runs, and every node reaches both iSCSI portals.

## Prerequisites

- The nodes are prepared as in [Prepare the nodes](../prepare-nodes.md), with an address on **both** storage subnets (`172.16.2.x` and `172.16.3.x`) and no gateway on them.
- DSM is prepared for Cinder. See [Prepare Synology for Cinder](./prepare-synology.md).
- `sudo` access on all OpenStack nodes.

:::note
Disable the services on **all** nodes, not only on the ones that run the containers today, so that moving `cinder-volume` to another node later does not bring the conflict back.
:::

## Set the names

Run this on the deployer. `NODES` is defined in [Prepare the nodes](../prepare-nodes.md):

```bash
NODES=(
  dev-openstack-controller-0{1,2,3}
  dev-openstack-compute-0{1,2}
)
DSM1=172.16.2.31
DSM2=172.16.3.31
```

## Pre-check

### Check the state of the host services

```bash
for h in "${NODES[@]}"; do
  echo "== $h"
  ssh "$h" 'systemctl is-active multipathd iscsid open-iscsi' 2>&1
done
```

Expected: you see which services are `active` and which are `inactive`. Any `active` service must be disabled in the procedure.

### Check the storage addresses

```bash
for h in "${NODES[@]}"; do
  echo "== $h"
  ssh "$h" "ip -br addr | grep -E '172\.16\.[23]\.'"
done
```

Expected: every node shows one address in `172.16.2.0/24` and one in `172.16.3.0/24`.

## Procedure

Run these two commands on **every** node, directly or through SSH:

```bash
sudo systemctl disable --now multipathd.service multipathd.socket
sudo systemctl disable --now iscsid.service iscsid.socket open-iscsi.service
```

If you prefer to do all nodes from the deployer:

```bash
for h in "${NODES[@]}"; do
  ssh "$h" 'sudo systemctl disable --now multipathd.service multipathd.socket; sudo systemctl disable --now iscsid.service iscsid.socket open-iscsi.service'
done
```

:::info
Do this before the first deploy of the iSCSI backend. If a host `iscsid` already holds sessions, log out of them first with `sudo iscsiadm -m node -u`.
:::

## Post-check

### Check that the host services are off

```bash
for h in "${NODES[@]}"; do
  echo "== $h"
  ssh "$h" 'systemctl is-enabled multipathd iscsid open-iscsi 2>&1; systemctl is-active multipathd iscsid open-iscsi 2>&1'
done
```

Expected: the services are `disabled` (or not found) and `inactive`.

### Check that both portals answer from every node

```bash
for h in "${NODES[@]}"; do
  echo "== $h"
  ssh "$h" "nc -zv $DSM1 3260; nc -zv $DSM2 3260"
done
```

Expected: both connections succeed on every node. If one fails, check the DSM firewall for that node's storage address, and the network binding of the iSCSI service.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| A service is still `active` after the command | A socket unit starts it again. Disable the `.socket` units too, as in the procedure. |
| Attach fails later, or no multipath device appears | A host-level `iscsid` or `multipathd` is still running next to the container. Disable it and confirm the containers are up. |
| `nc` to a portal fails from one node only | The DSM firewall does not allow that node's address, or the node has no address on that subnet. |
| A node has an address on one storage subnet only | Add the second address. Without it there is only one path. |

## Rollback

To give the host services back:

```bash
sudo systemctl enable --now multipathd.service iscsid.service open-iscsi.service
```

Only do this when you stop using the Kolla containers on that node.

## What's next

Continue with [Configure the Cinder backend](./cinder-backend-config.md).
