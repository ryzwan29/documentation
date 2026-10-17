---
sidebar_position: 1
title: Introduction to OpenStack
description: What OpenStack is, which services this lab deploys with Kolla Ansible, and the nodes, networks, and addressing used in every OpenStack guide.
tags: [openstack, kolla-ansible, homelab]
---

# Introduction to OpenStack

OpenStack is an open-source platform for building your own cloud. It turns a group of servers into a pool of compute, storage, and networking that users request through an API or a dashboard, much like they would on a public cloud. This page explains the pieces, and describes the lab that every other OpenStack guide in this documentation uses: a multinode deployment with Kolla Ansible. By the end you will know what runs where, which addresses to expect, and in which order to read the guides.

## What is OpenStack?

OpenStack is not one program. It is a set of services, each responsible for one job, that talk to each other through APIs and a message queue. You choose which services to run. This lab runs the core ones:

| Service | Name | What it does |
| --- | --- | --- |
| Identity | Keystone | Users, projects, roles, and the service catalog. Every API call is authenticated here. |
| Compute | Nova | Creates and manages virtual machines on the compute nodes. |
| Placement | Placement | Tracks resources (CPU, RAM, disk) so Nova can choose a host. |
| Networking | Neutron | Virtual networks, routers, floating IPs, and security groups. |
| Image | Glance | Stores the images that instances are created from. |
| Block storage | Cinder | Creates persistent volumes that attach to instances. |
| Dashboard | Horizon | A web interface for all of the above. |

Behind these services run a database (MariaDB with Galera), a message queue (RabbitMQ), and a load balancer for the APIs (HAProxy with Keepalived).

## What is Kolla Ansible?

Installing every service by hand is slow and error-prone. **Kolla Ansible** deploys OpenStack as **containers**, and drives the whole thing with Ansible. You describe your nodes in an inventory, set options in `globals.yml`, and run a few commands. Upgrades and changes use the same tools, so the deployment stays repeatable.

## The lab

The lab runs as VMs on a single Proxmox host, which is why the numbers below are small. Replace the addressing with your own.

| Item | Value |
| --- | --- |
| OpenStack | 2025.1 (Epoxy), deployed with Kolla Ansible |
| Networking | Neutron ML2/OVN |
| OS | Ubuntu 24.04 on every node |
| Shared storage | A Synology DSM VM (see the [Synology guides](../synology/deploy-xpenology.md)). It stores the Glance images over NFS, and optionally serves volumes over iSCSI. |
| Deployment host | An existing jump host at `192.168.19.30`, on the management network only |

### Nodes

| Hostname | Management | Tunnel | Storage 1 | Storage 2 | External | CPU | RAM | Disk | Additional disk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dev-ubuntu24-deployer` | `192.168.19.30` | none | none | none | none | 2 vCPU | 4 GB | 30 GB | none |
| `dev-synology-central-storage` | `192.168.19.31` | none | `172.16.2.31` | `172.16.3.31` | none | 2 vCPU | 4 GB | 51 GB | 5 x 200 GB |
| `dev-openstack-controller-01` | `192.168.19.36` | `172.16.1.36` | `172.16.2.36` | `172.16.3.36` | yes | 4 vCPU | 8 GB | 128 GB | none |
| `dev-openstack-controller-02` | `192.168.19.37` | `172.16.1.37` | `172.16.2.37` | `172.16.3.37` | yes | 4 vCPU | 8 GB | 128 GB | none |
| `dev-openstack-controller-03` | `192.168.19.38` | `172.16.1.38` | `172.16.2.38` | `172.16.3.38` | yes | 4 vCPU | 8 GB | 128 GB | none |
| `dev-openstack-compute-01` | `192.168.19.41` | `172.16.1.41` | `172.16.2.41` | `172.16.3.41` | none | 8 vCPU | 16 GB | 128 GB | none |
| `dev-openstack-compute-02` | `192.168.19.42` | `172.16.1.42` | `172.16.2.42` | `172.16.3.42` | none | 8 vCPU | 16 GB | 128 GB | none |

All subnets are `/24`. Every OpenStack node has five NICs: management, tunnel, storage 1, storage 2, and a fifth NIC for the external network. That fifth NIC has **no IP**, because Neutron takes it over and turns it into `br-ex`.

The VIP for the OpenStack APIs is `192.168.19.35`, held by HAProxy and Keepalived on the controllers.

### Networks

The tunnel and storage networks are internal only, with no gateway.

| Network | Subnet | Used for |
| --- | --- | --- |
| Management | `192.168.19.0/24` | APIs, SSH, DSM web UI, the VIP |
| Tunnel | `172.16.1.0/24` | Geneve overlay traffic between nodes (tenant networks) |
| Storage 1 | `172.16.2.0/24` | Storage API calls, the first storage path, and the Glance NFS share |
| Storage 2 | `172.16.3.0/24` | The second storage path |
| External | `192.168.19.0/24` (flat) | Floating IPs, on the fifth NIC of each controller |

Each node uses the same last octet on every subnet (for example `.36` on controller-01), which makes it easy to tell which node an address belongs to.

:::note
Both storage networks are software bridges on the same Proxmox host. A multipath failover test in this lab therefore trains the logical path failure (a NIC going down inside a VM), not a real physical NIC or switch failure.
:::

## The roles of the nodes

- **Deployer**: runs Kolla Ansible and the OpenStack client. It is not part of the cloud itself.
- **Controllers** (3): the API services, the database, the message queue, HAProxy and Keepalived, Neutron network services, and Horizon. Three controllers keep the control plane alive when one fails.
- **Computes** (2): run the instances (VMs).
- **Storage node for Cinder**: one controller in this lab runs `cinder-volume`. The storage backend itself lives outside OpenStack.

## How to read the guides

Read them in this order:

1. [Prepare the nodes](./prepare-nodes.md): hostnames, SSH, time sync, and network.
2. [Glance image storage on NFS](./glance-nfs-storage.md): a shared place for images, mounted on the controllers.
3. [Deploy with Kolla Ansible](./deploy-kolla-ansible.md): install, inventory, `globals.yml`, and deploy.
4. [Post-install configuration](./post-install-openstack.md): security group, images, flavors, networks, and keypair.
5. [Launch an instance](./launch-instance.md): boot, floating IP, and login.
6. [Volumes and block storage](./volumes.md): how Cinder works, volume types, and boot from volume.
7. [Synology iSCSI backend](./synology-iscsi-backend/overview.md): a complete example of a Cinder backend.

Pages 1 to 6 do not depend on a specific storage backend. Only the last section does.
