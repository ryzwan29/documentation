---
sidebar_position: 5
title: Post-Install Configuration
description: Prepare a fresh OpenStack cloud for its first instance with a security group, cloud images, flavors, an external and a tenant network, a router, and a keypair.
tags: [openstack, glance, nova, neutron]
---

# Post-Install Configuration

A fresh OpenStack cloud has services but nothing to launch: no images, no flavors, no networks. This guide creates the minimum set of resources you need before the first instance. By the end you will have a security group, three cloud images in Glance, two flavors, an external network with a pool of floating IPs, a tenant network with a router, and a keypair.

## Prerequisites

- A deployed cloud. See [Deploy with Kolla Ansible](./deploy-kolla-ansible.md).
- The admin credentials loaded on the deployer:

```bash
source /etc/kolla/admin-openrc.sh
```

- Internet access on the deployer, to download the cloud images.
- A range of free addresses on the external subnet for floating IPs. In this lab it shares the management subnet, so pick a range that no node or DSM address uses.

## Set the names

Define the values once, so you can copy and paste the rest of the commands. Replace them with your own:

```bash
EXT_NET=ext-net
EXT_RANGE=192.168.19.0/24
EXT_GW=192.168.19.1
EXT_POOL_START=192.168.19.51
EXT_POOL_END=192.168.19.71

TENANT_NET=lab-ops-net
TENANT_RANGE=10.10.10.0/24
TENANT_GW=10.10.10.1
ROUTER=ops-router
KEYPAIR=labops
```

:::tip
These variables only exist in the current shell. If you lose the session, run the lines again before you continue.
:::

## Pre-check

### Check the credentials

```bash
openstack token issue -c expires
```

Expected: a token is issued. If it fails, load the admin credentials again.

### Check what exists already

```bash
openstack image list
openstack flavor list
openstack network list
```

Expected: empty lists on a fresh cloud. Names you plan to create must not exist yet.

### Check the Glance store

On a controller:

```bash
df -h /mnt/glance
```

Expected: the shared store is mounted and has enough free space for the images.

## Procedure

### Create a security group

A minimal group that allows SSH, HTTP, and ping from anywhere. Outbound traffic is allowed by the default egress rules that every new group gets.

```bash
openstack security group create minimum --description "ssh, http, icmp inbound; all outbound"

openstack security group rule create --ingress --protocol tcp --dst-port 22 --remote-ip 0.0.0.0/0 minimum
openstack security group rule create --ingress --protocol tcp --dst-port 80 --remote-ip 0.0.0.0/0 minimum
openstack security group rule create --ingress --protocol icmp --remote-ip 0.0.0.0/0 minimum
```

### Upload images

Download a few cloud images and upload them to Glance. With the NFS setup, the uploaded files end up on the shared path.

```bash
mkdir -p ~/images && cd ~/images

wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
wget https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img
wget https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2

openstack image create ubuntu-24.04 \
  --file noble-server-cloudimg-amd64.img \
  --disk-format qcow2 --container-format bare --public \
  --property os_distro=ubuntu --property os_version=24.04

openstack image create ubuntu-22.04 \
  --file jammy-server-cloudimg-amd64.img \
  --disk-format qcow2 --container-format bare --public \
  --property os_distro=ubuntu --property os_version=22.04

openstack image create rocky-9 \
  --file Rocky-9-GenericCloud-Base.latest.x86_64.qcow2 \
  --disk-format qcow2 --container-format bare --public \
  --property os_distro=rocky --property os_version=9
```

### Create flavors

A flavor is a hardware template: vCPUs, RAM in MB, and root disk in GB.

```bash
openstack flavor create --vcpus 2 --ram 4096 --disk 20 --public c2r4d20
openstack flavor create --vcpus 1 --ram 2048 --disk 10 --public c1r2d10
```

### Create the networks

An external network for floating IPs, a tenant network for instances, and a router between them.

```bash
# external network + subnet (flat, on the external NIC)
openstack network create $EXT_NET \
  --external --provider-network-type flat --provider-physical-network physnet1

openstack subnet create ext-sub \
  --network $EXT_NET --subnet-range $EXT_RANGE \
  --gateway $EXT_GW --no-dhcp \
  --allocation-pool start=$EXT_POOL_START,end=$EXT_POOL_END

# tenant network + subnet
openstack network create $TENANT_NET

openstack subnet create lab-ops-sub \
  --network $TENANT_NET --subnet-range $TENANT_RANGE \
  --gateway $TENANT_GW

# router: gateway to the external network, interface to the tenant subnet
openstack router create $ROUTER
openstack router set $ROUTER --external-gateway $EXT_NET
openstack router add subnet $ROUTER lab-ops-sub
```

:::note
With ML2/OVN there is no `--ha` flag for routers. High availability comes from the gateway chassis on the three controllers (with BFD), and the router fails over by itself.
:::

### Create a keypair

Create a keypair and save the private key on the deployer:

```bash
openstack keypair create --private-key ~/.ssh/$KEYPAIR $KEYPAIR
chmod 600 ~/.ssh/$KEYPAIR
```

## Post-check

### Check the images

```bash
openstack image list
```

Expected: `ubuntu-24.04`, `ubuntu-22.04`, and `rocky-9` have the status `active`.

### Check the flavors and the security group

```bash
openstack flavor list
openstack security group rule list minimum
```

Expected: both flavors are listed, and the group has the three ingress rules plus the default egress rules.

### Check the networks and the router

```bash
openstack network list
openstack router show $ROUTER -c status -c external_gateway_info
```

Expected: both networks are listed, the router status is `ACTIVE`, and the external gateway points to the external network.

### Check that the router answers

From a machine on the external subnet:

```bash
openstack router show $ROUTER -c external_gateway_info
ping -c 2 <router-external-ip>
```

Expected: the router's external address answers a ping. Use the address from `external_gateway_info`.

### Check in the web UI

Open Horizon and confirm:

- **Project → Network → Network Topology** shows the external network, the router, and the tenant network connected.
- **Project → Compute → Images** lists the three images.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| An image stays in `queued` or `saving` | The upload did not finish, or Glance cannot write to the share. Check the permissions and `df -h /mnt/glance`. |
| `Unable to create the flat network` or an unknown physical network | The provider network name does not match the Neutron configuration. Check the name (`physnet1` in Kolla by default). |
| The external subnet clashes with a node address | The allocation pool overlaps the addresses of nodes. Choose a pool that nothing else uses. |
| The router stays `DOWN` | The external interface is not connected to the external network, or the gateway is wrong. Check `neutron_external_interface` and the external gateway. |
| `Quota exceeded` when you create resources | The project quota is too low. Raise it with `openstack quota set`. |

## Rollback

To remove what this guide created, delete in this order:

```bash
openstack router remove subnet $ROUTER lab-ops-sub
openstack router unset --external-gateway $ROUTER
openstack router delete $ROUTER
openstack subnet delete lab-ops-sub ext-sub
openstack network delete $TENANT_NET $EXT_NET
openstack flavor delete c2r4d20 c1r2d10
openstack image delete ubuntu-24.04 ubuntu-22.04 rocky-9
openstack security group delete minimum
openstack keypair delete $KEYPAIR
```

## What's next

Continue with [Launch an instance](./launch-instance.md).
