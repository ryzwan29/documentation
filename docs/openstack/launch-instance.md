---
sidebar_position: 6
title: Launch an Instance
description: Boot a first instance from an image, give it a floating IP, log in over SSH, and understand where its root disk lives.
tags: [openstack, nova, instance]
---

# Launch an Instance

This guide boots a first instance from a Glance image, gives it a floating IP, and logs in over SSH. It also explains an important detail: by default the root disk of the instance is **ephemeral** and lives on the compute node. By the end you will have a running instance that you can reach from your LAN.

## Prerequisites

- The resources from [Post-install configuration](./post-install-openstack.md): the image, flavor, tenant network, external network, security group, and keypair.
- The admin credentials loaded on the deployer (`source /etc/kolla/admin-openrc.sh`).
- A free floating IP in the external pool.

## Where does the root disk live?

By default, a Nova instance's root disk is **ephemeral and stored on the compute node**. If the instance is deleted, the disk is deleted with it, and if the compute node fails, the disk is gone. That is fine for a first test.

To put the root disk on shared, persistent storage, boot from a **volume** instead. See [Volumes and block storage](./volumes.md).

## Set the names

Define the values once. Replace them with your own:

```bash
SERVER=ins-ops-lab-ubuntu24-eph
IMAGE=ubuntu-24.04
FLAVOR=c2r4d20
TENANT_NET=lab-ops-net
SECGROUP=minimum
KEYPAIR=labops
```

:::tip
These variables only exist in the current shell. If you lose the session, run the lines again before you continue.
:::

## Pre-check

### Check that the resources exist

```bash
openstack image show $IMAGE -c status
openstack flavor show $FLAVOR -c vcpus -c ram -c disk
openstack network show $TENANT_NET -c status
openstack security group show $SECGROUP -c name
openstack keypair show $KEYPAIR -c name
```

Expected: the image is `active`, the network is `ACTIVE`, and the other commands print the resources without errors.

### Check that the computes are up

```bash
openstack compute service list --service nova-compute
```

Expected: both computes are `enabled` and `up`.

## Procedure

### Boot the instance

```bash
openstack server create --flavor $FLAVOR \
  --image $IMAGE \
  --network $TENANT_NET \
  --security-group $SECGROUP \
  --key-name $KEYPAIR \
  $SERVER
```

Wait until the server is `ACTIVE`:

```bash
openstack server show $SERVER -c status -c addresses
```

### Add a floating IP and log in

The instance only has an address on the tenant network (`10.10.10.0/24` in the examples). Give it a floating IP from the external network to reach it from your LAN:

```bash
openstack floating ip create ext-net
openstack server add floating ip $SERVER <floating-ip>

ssh -i ~/.ssh/$KEYPAIR ubuntu@<floating-ip>
```

Replace `<floating-ip>` with the address from the `floating ip create` output. The login user depends on the image: `ubuntu` for the Ubuntu images, `rocky` for Rocky Linux.

## Post-check

### Check the instance

```bash
openstack server show $SERVER -c status -c addresses
```

Expected: the status is `ACTIVE`, and the addresses list the tenant address and the floating IP.

### Check the network path

```bash
ping -c 2 <floating-ip>
ssh -i ~/.ssh/$KEYPAIR ubuntu@<floating-ip> 'hostname; ip -br addr'
```

Expected: the floating IP answers a ping, SSH works, and the instance shows its tenant address.

### Check the root disk inside the guest

```bash
ssh -i ~/.ssh/$KEYPAIR ubuntu@<floating-ip> lsblk
```

Expected: one disk of the size of the flavor (20 GB for `c2r4d20`).

### Check where the instance runs

```bash
openstack server show $SERVER -c OS-EXT-SRV-ATTR:host
```

Expected: the name of one of the computes. The ephemeral disk lives on that node.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The server goes to `ERROR` | Read the reason with `openstack server show $SERVER -c fault`. Common causes are not enough resources on the computes or an image that cannot be fetched. |
| The server stays in `BUILD` | The image is large, or Glance is slow. Wait, then check `docker logs nova_compute` on the compute node. |
| The floating IP does not answer a ping | The security group has no ICMP rule, the router has no external gateway, or the floating IP pool is on the wrong subnet. |
| SSH says `Permission denied (publickey)` | The key does not match the keypair, or the wrong user is used. Use the image's default user. |
| No address on the instance | DHCP in the tenant subnet is disabled, or the OVN metadata agent is down. Check `openstack network agent list`. |

## Rollback

```bash
openstack server remove floating ip $SERVER <floating-ip>
openstack floating ip delete <floating-ip>
openstack server delete $SERVER
```

## What's next

Continue with [Volumes and block storage](./volumes.md).
