---
sidebar_position: 5
title: Verify the iSCSI Paths
description: Check that an instance with a Synology-backed volume has two iSCSI sessions and one multipath device, and test the failover by taking one storage interface down.
tags: [openstack, cinder, iscsi, multipath]
---

# Verify the iSCSI Paths

Two storage networks only help if both paths really form and multipath uses them. This guide checks that an instance with a Synology-backed volume has **two iSCSI sessions** and **one multipath device with two paths**, and then breaks one path on purpose to prove that I/O keeps working. By the end you know that the design from the [overview](./overview.md) works, instead of assuming it.

## Prerequisites

- The backend works and a test volume was created. See [Configure the Cinder backend](./cinder-backend-config.md).
- An instance that boots from a Synology-backed volume, or has one attached. See [Volumes and block storage](../volumes.md).
- Access to the compute node that runs the instance, and to the instance itself.

## Set the names

Define the values once. Replace them with your own:

```bash
SERVER=ins-ops-lab-ubuntu24
```

On the compute node, name the storage NIC you will take down:

```bash
STORAGE_NIC=<storage-nic-1>
```

## Pre-check

### Find the compute node of the instance

On the deployer, with the admin credentials loaded:

```bash
openstack server show $SERVER -c OS-EXT-SRV-ATTR:host -c status
```

Expected: the status is `ACTIVE`, and you know which compute node runs the instance. Run the commands in the next sections on that node.

### Check the containers

On the compute node:

```bash
sudo docker ps --format '{{.Names}}' | grep -E 'iscsid|multipathd'
```

Expected: both the `iscsid` and the `multipathd` containers are running.

## Procedure

### Check the sessions and the paths

On the compute node that runs the instance:

```bash
sudo docker exec iscsid iscsiadm -m session
# expect two sessions: 172.16.2.31:3260 and 172.16.3.31:3260

sudo docker exec multipathd multipath -ll
# expect one device with two paths, both active/ready
```

![Verify multipath](<img/Screenshot 2026-10-02 143248.png>)

Because the config only knows one `target_ip_address`, the second session depends on iSCSI discovery: the initiator asks the first portal which portals exist, and DSM advertises both, provided the target listens on both NICs. Treat this as something to **verify, not assume**. If you only see one session, check that the target is not bound to a single interface, and that port `3260` is open on the second subnet.

### Test the failover

Keep writing to the volume inside the guest, for example:

```bash
ssh -i ~/.ssh/labops ubuntu@<floating-ip> 'while true; do date | sudo tee -a /var/tmp/io-test.log; sleep 1; done'
```

Then, on the compute node, take one storage interface down:

```bash
sudo ip link set $STORAGE_NIC down
sudo docker exec multipathd multipath -ll   # one path failed, one active
sudo ip link set $STORAGE_NIC up
sudo docker exec multipathd multipath -ll   # both paths active again
```

I/O in the guest should keep working, possibly after a short stall while multipath switches paths. If the guest freezes instead, the second session most likely never formed. Repeat with the second NIC.

:::note
Both storage networks are software bridges on the same Proxmox host in this lab. The test trains the logical path failure (a NIC going down inside a VM), not a real physical NIC or switch failure.
:::

By default DM-multipath uses a failover policy (one active path, one standby). Set `path_grouping_policy multibus` in `multipath.conf` if you want both paths in use at the same time.

## Post-check

### Check that both sessions came back

```bash
sudo docker exec iscsid iscsiadm -m session
sudo docker exec multipathd multipath -ll
```

Expected: two sessions, and one device with two paths, both `active` and `ready`.

### Check that the guest kept running

Inside the guest:

```bash
tail -n 5 /var/tmp/io-test.log
```

Expected: the log has no gap longer than the short stall of the path switch.

### Check that the file system is still writable

```bash
touch /var/tmp/after-failover && echo writable
```

Expected: `writable`. If the guest remounted the file system read-only, reboot it and check the paths.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Only one iSCSI session | The target is bound to one NIC, or port `3260` is blocked on the second subnet. Check the network binding in DSM and the firewall. |
| No multipath device | A host-level `iscsid` or `multipathd` still runs, or the container is not up. See [Prepare the nodes for iSCSI](./prepare-nodes-iscsi.md). |
| The guest freezes when one NIC goes down | The second session never formed. Fix it and repeat the test. |
| The device shows two paths but one is `faulty` after the NIC is up again | Wait for the path checker, or check the link with `ip link`. |
| `multipath -ll` prints nothing | The volume is not attached to an instance on that compute node. Run the command on the node that hosts the instance. |

## Rollback

Bring the interface back up if you left it down:

```bash
sudo ip link set $STORAGE_NIC up
```

Remove the test log inside the guest:

```bash
sudo rm /var/tmp/io-test.log
```

## What's next

Continue with [Fail over cinder-volume](./failover-cinder-volume.md).
