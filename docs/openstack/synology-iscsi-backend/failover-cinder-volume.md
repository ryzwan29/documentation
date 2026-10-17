---
sidebar_position: 6
title: Fail Over cinder-volume
description: What breaks and what keeps working when a storage path, the cinder-volume node, DSM, or the DSM API fails, and how to move cinder-volume to another node by hand.
tags: [openstack, cinder, failover, kolla-ansible]
---

# Fail Over cinder-volume

The Synology driver runs as a single active `cinder-volume` instance (active/passive). Without a distributed lock manager and a driver that supports active/active, running several instances against the same `backend_host` is not formally safe, so failover is manual and the recovery time depends on the operator. This guide lists what each failure does, and shows how to move `cinder-volume` to another node. By the end you know what to expect, and you have a procedure that you have tested once on a quiet day.

## What happens when something fails

| Failure | Result |
| --- | --- |
| One storage path goes down | I/O continues over the other path. |
| `cinder-volume` node goes down | You cannot create, delete, or resize volumes. Attached volumes keep working, because the instance talks to DSM directly. |
| DSM goes down | All volumes lose their I/O. Guests freeze or remount read-only. After DSM is back, iSCSI sessions reconnect. Reboot guests that went read-only. |
| DSM is up, API unreachable | New volumes cannot be created. Existing ones are fine. |

**Scope of a `cinder-volume` failure:** only the control path for volumes (create, attach, detach, delete) is interrupted. Running instances keep their I/O because the data path goes directly from the compute node to the Synology over multipath iSCSI.

## Prerequisites

- A working backend. See [Configure the Cinder backend](./cinder-backend-config.md).
- A fixed logical host name in the backend section, set **before** the first volume was created:

```ini
[synology]
backend_host = cinder-synology
```

- If volumes already exist under a node-specific host name, move them once (see below).
- Every candidate node must reach both iSCSI portals (`172.16.2.31` and `172.16.3.31`) over the storage interface, and the Synology DSM API (port `5001`).
- The host `iscsid` and `multipathd` are disabled on every candidate node. See [Prepare the nodes for iSCSI](./prepare-nodes-iscsi.md).

## Set the names

Run this on the deployer. Replace the values with your own:

```bash
OLD_NODE=dev-openstack-controller-01
NEW_NODE=dev-openstack-controller-02
POOL=volume1
```

## Pre-check

### Check the host name of the existing volumes

```bash
openstack volume list
openstack volume show <id> -c os-vol-host-attr:host
```

Expected: the host is `cinder-synology@synology#volume1`. If it contains a node name instead, move the volumes once:

```bash
sudo docker exec cinder_api cinder-manage volume update_host \
  --currenthost $OLD_NODE@synology#$POOL \
  --newhost cinder-synology@synology#$POOL
```

### Check that the new node can reach DSM

```bash
ssh $NEW_NODE "nc -zv 172.16.2.31 3260; nc -zv 172.16.3.31 3260; nc -zv 172.16.2.31 5001"
```

Expected: all three connections succeed.

## Procedure

### Make sure the old node is really stopped

Make sure the old node is really stopped or isolated. Two `cinder-volume` instances running at the same time is unsafe.

### Move the service in the inventory

In the inventory, remove the old node from `[storage]` and add the new one:

```ini
[storage]
dev-openstack-controller-02
```

### Deploy to the new node

Refresh facts, then deploy only to the new node:

```bash
kolla-ansible gather-facts -i ./multinode
kolla-ansible deploy -i ./multinode --tags cinder,iscsi --limit $NEW_NODE
```

If `gather-facts` fails because the dead node is unreachable, temporarily remove it from the inventory or limit the facts to the remaining hosts.

### Reset volumes stuck in a transient state

Volumes stuck in `creating`, `attaching`, or `deleting` from before the failure are not recovered automatically. Reset them and retry:

```bash
openstack volume set --state available <id>   # or: cinder reset-state
```

## Post-check

### Check the service

```bash
openstack volume service list      # cinder-synology@synology must be up
```

Expected: `cinder-volume` for `cinder-synology@synology` is `up`, with the host of the new node.

### Check that new volumes work

```bash
openstack volume create --size 1 failover-test
openstack volume show failover-test -c status
openstack volume delete failover-test
```

Expected: the volume becomes `available`, and the delete works.

### Check that running instances were not affected

Log in to an instance that was running before the failover and write a file.

Expected: the instance never lost its disk.

## When the old node returns

Deploy does not stop containers on hosts outside `[storage]`. Before bringing the node back online (or immediately after, if it auto-starts), remove the stale container so it does not run next to the new one:

```bash
sudo docker rm -f cinder_volume
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Two `cinder-volume` services appear in the list | The old node came back with its container. Remove it with `docker rm -f cinder_volume` on the old node. |
| New volumes stay in `creating` | The new service is not up, or the node cannot reach DSM. Read `docker logs cinder_volume` on the new node. |
| Existing volumes show the old node in their host name | They were created before `backend_host` was set. Use `cinder-manage volume update_host` as shown above. |
| `gather-facts` fails | A dead node is still in the inventory. Remove it temporarily, or limit the run with `--limit`. |

## Rollback

To move the service back to the original node, repeat the procedure with the two node names swapped.

:::warning
Never run `cinder-volume` on two nodes for the same backend at the same time.
:::

## What's next

Continue with [Troubleshooting and fallback](./troubleshooting.md).
