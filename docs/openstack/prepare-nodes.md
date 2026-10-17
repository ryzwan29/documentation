---
sidebar_position: 2
title: Prepare the Nodes
description: Prepare the deployer and the OpenStack nodes for Kolla Ansible with hostname mapping, passwordless SSH, time sync, and the right network layout, with pre-checks and post-checks.
tags: [openstack, kolla-ansible, ubuntu, chrony]
---

# Prepare the Nodes

This guide prepares the deployment host and the OpenStack nodes for Kolla Ansible. Kolla Ansible connects to the nodes by name over SSH, and services such as RabbitMQ, Galera, and Keystone are sensitive to wrong hostnames and to clock drift, so a few minutes of preparation here prevent most deployment failures. By the end every node resolves by name, accepts passwordless SSH, keeps its clock in sync, and has the network addresses described in the [introduction](./introduction.md).

## Prerequisites

- The nodes from the [introduction](./introduction.md), installed with Ubuntu 24.04 and reachable on the management network.
- A deployment host that can reach every node over SSH on the management network.
- A user with `sudo` rights on every node.
- Five NICs on every OpenStack node: management, tunnel, storage 1, storage 2, and one for the external network. The external NIC has **no IP**, because Neutron takes it over and turns it into `br-ex`.

## Set the names

Define the list of nodes once, so you can copy and paste the loops below. Replace the names with your own:

```bash
NODES=(
  dev-openstack-controller-0{1,2,3}
  dev-openstack-compute-0{1,2}
)
```

:::tip
This variable only exists in the current shell. If you lose the session, run the lines again before you continue.
:::

## Pre-check

Run these commands before you touch anything. If one does not match what is described, stop and fix it first.

### Check the addresses on every node

Run this on each OpenStack node:

```bash
ip -br addr
```

Expected: an address on the management, tunnel, and both storage interfaces, and **no address** on the external interface. The addresses match the tables in the [introduction](./introduction.md), and the storage interfaces have no gateway.

### Check the interface names

Still on a node:

```bash
ip -br link
```

Write down which interface is which. You need the names for `globals.yml` in [Deploy with Kolla Ansible](./deploy-kolla-ansible.md). Names differ between images and virtual hardware, so do not copy them from this documentation.

### Check the hostname

```bash
hostnamectl --static
```

Expected: the full hostname of the node, for example `dev-openstack-controller-01`.

## Procedure

### Map the hostnames on the deployer

Kolla Ansible connects to the nodes by the names in the inventory, so the deployment host must be able to resolve them. On the deployer, add the management IPs of all OpenStack nodes to `/etc/hosts`:

```bash
sudo tee -a /etc/hosts <<'HOSTS'

# OpenStack VIP
192.168.19.35   openstack-vip kolla-vip

# OpenStack controllers
192.168.19.36   dev-openstack-controller-01 controller-01
192.168.19.37   dev-openstack-controller-02 controller-02
192.168.19.38   dev-openstack-controller-03 controller-03

# OpenStack computes
192.168.19.41   dev-openstack-compute-01 compute-01
192.168.19.42   dev-openstack-compute-02 compute-02
HOSTS
```

A few notes:

- The inventory always uses the **full** hostname (`dev-openstack-controller-01`). The short aliases (`controller-01`) are only for typing `ssh` by hand.
- Each node's own hostname must match the name in the inventory, because RabbitMQ and Galera use it. Fix a wrong name on the node with `sudo hostnamectl set-hostname <full-hostname>`.

:::info
The deployer needs only this hostname mapping. The other steps in this guide happen on the OpenStack nodes.
:::

### Enable passwordless SSH

Kolla Ansible needs passwordless SSH to every node. On the deployer, create a key (if you do not have one) and copy it to the nodes:

```bash
[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519

for h in "${NODES[@]}"; do
  ssh-copy-id "$h"
done
```

The user also needs passwordless `sudo` on the nodes, because Ansible escalates privileges. A file in `/etc/sudoers.d/` on each node does it:

```bash
echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$USER
sudo chmod 440 /etc/sudoers.d/$USER
```

Run the two lines above on **each node**, with the same user name that Ansible will use.

### Set up time sync (all nodes)

Galera, RabbitMQ, and Keystone tokens are sensitive to clock drift between nodes, so every node needs working time sync. In this lab chrony runs on the host, and Kolla's own chrony container stays off, so the two do not fight over NTP. The `globals.yml` guide sets that option.

```bash
sudo apt install -y chrony
sudo systemctl enable --now chrony
sudo timedatectl set-timezone Asia/Jakarta
chronyc tracking
```

Use your own timezone instead of `Asia/Jakarta`.

## Post-check

### Check that every name resolves

On the deployer:

```bash
for h in "${NODES[@]}"; do
  getent hosts "$h" || echo "$h: NOT RESOLVED"
done
```

Expected: every node prints its address, and no line says `NOT RESOLVED`.

### Check SSH

```bash
for h in "${NODES[@]}"; do
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$h" hostname || echo "$h: SSH FAILED"
done
```

Expected: each node prints its own full hostname. If one prints `SSH FAILED`, fix the SSH key or user first.

### Check passwordless sudo

```bash
for h in "${NODES[@]}"; do
  ssh -o BatchMode=yes "$h" sudo -n true && echo "$h: sudo ok"
done
```

Expected: every node prints `sudo ok`.

### Check the time sync

On each node:

```bash
chronyc tracking
timedatectl
```

Expected: `Leap status : Normal`, a small offset, and `System clock synchronized: yes`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `NOT RESOLVED` for a node | The line is missing or misspelled in `/etc/hosts` on the deployer. |
| `Permission denied (publickey)` | The key was not copied to that node, or the wrong user is used. Run `ssh-copy-id` again. |
| `sudo: a password is required` | Passwordless sudo is not set for that user on that node. Create the file in `/etc/sudoers.d/`. |
| RabbitMQ or Galera complains about the hostname later | The node's own hostname does not match the inventory name. Fix it with `hostnamectl set-hostname`. |
| `chronyc tracking` shows a large offset | The node cannot reach its time source. Check DNS and the network, or point chrony to a reachable NTP server. |

## Rollback

To remove the hostname block from the deployer, edit `/etc/hosts` and delete the lines that were added. To stop time sync on a node:

```bash
sudo systemctl disable --now chrony
```

## What's next

Continue with [Glance image storage on NFS](./glance-nfs-storage.md).
