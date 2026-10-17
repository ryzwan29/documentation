---
sidebar_position: 4
title: Deploy with Kolla Ansible
description: Install Kolla Ansible on the deployer, write the inventory and globals.yml for a three-controller OpenStack cloud, deploy it, and verify the services.
tags: [openstack, kolla-ansible, ansible, ovn]
---

# Deploy with Kolla Ansible

This guide installs Kolla Ansible on the deployment host and uses it to deploy OpenStack to three controllers and two computes. By the end the OpenStack services run as containers on the nodes, the APIs answer on the VIP, the dashboard is reachable, and you have the admin credentials loaded in your shell.

The configuration here is **backend neutral**: it enables Cinder but does not choose where volumes are stored. The storage backend is added later. See [Volumes and block storage](./volumes.md).

## Prerequisites

- The nodes are prepared. See [Prepare the nodes](./prepare-nodes.md).
- The Glance share is mounted on the controllers at `/mnt/glance`. See [Glance image storage on NFS](./glance-nfs-storage.md).
- A deployment host with Ubuntu 24.04, `sudo`, and internet access, and passwordless SSH and `sudo` to every node.
- The interface names of the nodes, written down in the node preparation guide.
- A free IP address in the management subnet for the VIP (`192.168.19.35` in the examples).

## Set the names

The commands below use one virtual environment name. Replace it if you prefer another:

```bash
VENV=openstack
```

## Pre-check

Run these commands before you touch anything. If one does not match what is described, stop and fix it first.

### Check the Python version on the deployer

```bash
python3 --version
```

Expected: the Python 3 that ships with Ubuntu 24.04.

### Check that the VIP is free

```bash
ping -c 2 192.168.19.35
```

Expected: no reply. The VIP must not belong to any other machine.

### Check the free disk space on the nodes

```bash
for h in "${NODES[@]}"; do ssh "$h" df -h / | tail -n 1; done
```

Expected: enough free space on every node for the container images. `NODES` is defined in [Prepare the nodes](./prepare-nodes.md).

## Procedure

Run everything in this section on the deployment host.

### Install Kolla Ansible

```bash
sudo apt update
sudo apt install -y git python3-dev libffi-dev gcc libssl-dev python3-venv

python3 -m venv $VENV
source $VENV/bin/activate
pip install -U pip

# 2025.1 needs ansible-core 2.16 to 2.17 (check the exact range in the 2025.1 Quick Start)
pip install 'ansible-core>=2.16,<2.18'
pip install git+https://opendev.org/openstack/kolla-ansible@stable/2025.1

sudo mkdir -p /etc/kolla
sudo chown $USER:$USER /etc/kolla
cp -r $VIRTUAL_ENV/share/kolla-ansible/etc_examples/kolla/* /etc/kolla
cp $VIRTUAL_ENV/share/kolla-ansible/ansible/inventory/multinode .

kolla-ansible install-deps
```

### Write the inventory

Edit the `multinode` file you just copied. The groups used in this lab:

```ini
[control]
dev-openstack-controller-01
dev-openstack-controller-02
dev-openstack-controller-03

[network]
dev-openstack-controller-01
dev-openstack-controller-02
dev-openstack-controller-03

[compute]
dev-openstack-compute-01
dev-openstack-compute-02

[monitoring]
dev-openstack-controller-01

[storage]
dev-openstack-controller-01
```

`cinder-volume` runs on the hosts in `[storage]`. Some storage backends cannot run active/active, so that group gets exactly one node. Do not leave it empty: without a node there, `cinder-volume` is never deployed, even if the backend is not a local disk.

Check that Ansible can reach every node before going further:

```bash
ansible -i ./multinode all -m ping
```

Expected: every node answers `pong`.

### Generate the passwords

```bash
kolla-genpwd
```

This fills `/etc/kolla/passwords.yml`. Keep that file out of git.

### Write globals.yml

Add or change these lines in `/etc/kolla/globals.yml`:

```yaml
kolla_base_distro: "ubuntu"

kolla_internal_vip_address: "192.168.19.35"

neutron_plugin_agent: "ovn"
network_interface: "eth0"           # management
tunnel_interface: "eth1"            # tunnel (internal)
storage_interface: "eth2"           # storage
neutron_external_interface: "ens22" # external, no IP

enable_haproxy: "yes"
enable_keepalived: "yes"
keepalived_virtual_router_id: "51"

# Time sync runs on the host (chrony), not in a container
enable_chrony: "no"

enable_horizon: "yes"

# Image store shared by all controllers
glance_file_datadir_volume: "/mnt/glance"

# Block storage: the API is deployed now, the backend is chosen later
enable_cinder: "yes"
enable_cinder_backup: "no"
skip_cinder_backend_check: "yes"
```

The options mean:

| Option | Meaning |
| --- | --- |
| `kolla_internal_vip_address` | The address of the API endpoints. HAProxy and Keepalived hold it on the controllers. |
| `neutron_plugin_agent: "ovn"` | Uses ML2/OVN instead of the older OVS agents. |
| `network_interface` | The management NIC, used for the APIs and for SSH. |
| `tunnel_interface` | The NIC for Geneve overlay traffic between nodes. |
| `storage_interface` | The NIC for storage traffic. |
| `neutron_external_interface` | The NIC that Neutron takes over for the external network. It has no IP. |
| `keepalived_virtual_router_id` | Must be unique in the management network. Change it if another Keepalived uses `51`. |
| `enable_chrony: "no"` | Kolla does not start its own chrony container, so it does not fight with the host chrony. |
| `glance_file_datadir_volume` | The directory that stores Glance images. It must be the NFS mount on the controllers. |
| `skip_cinder_backend_check` | Lets the prechecks pass while no Cinder backend is configured yet. |

:::note
The interface names above are examples. Use the names you wrote down with `ip -br link`. They can differ between nodes only if you set them per host in the inventory, so keep the same names on all nodes of a role.
:::

### Bootstrap, check, and deploy

```bash
kolla-ansible bootstrap-servers -i ./multinode
kolla-ansible prechecks -i ./multinode
kolla-ansible deploy -i ./multinode
```

`bootstrap-servers` installs Docker and the packages that Kolla needs on the nodes. `prechecks` finds configuration problems before anything is deployed. `deploy` pulls the images and starts the containers, and takes a while.

### Create the admin credentials

```bash
kolla-ansible post-deploy -i ./multinode
```

This writes `/etc/kolla/admin-openrc.sh` and a `clouds.yaml`. Then install the OpenStack client in the same virtual environment:

```bash
pip install python-openstackclient -c https://releases.openstack.org/constraints/upper/2025.1
```

:::info
Check the 2025.1 Kolla Ansible Quick Start for the exact constraints URL. It follows the release name.
:::

Load the credentials:

```bash
source /etc/kolla/admin-openrc.sh
```

## Post-check

### Check the services

```bash
openstack service list
openstack compute service list
openstack network agent list
```

Expected: the services are listed, the compute services are `enabled` and `up` on both computes, and the network agents (for OVN the controller and metadata agents) are `UP`.

### Check the containers on a node

```bash
ssh dev-openstack-controller-01 sudo docker ps --format '{{.Names}}\t{{.Status}}' | head -n 20
```

Expected: containers such as `keystone`, `nova_api`, `neutron_server`, and `horizon` show `Up`, and none is stuck restarting.

### Check the VIP

```bash
ping -c 2 192.168.19.35
curl -s http://192.168.19.35:5000/v3 | head -c 200
```

Expected: the VIP answers, and Keystone returns a JSON document with version information. If you enabled TLS for the internal VIP, use `https://` and add `-k` for a self-signed certificate.

### Check the dashboard

Find the admin password:

```bash
grep keystone_admin_password /etc/kolla/passwords.yml
```

Open `http://192.168.19.35` (or `https://` if you enabled TLS), and log in as `admin` with that password, in the `Default` domain.

Expected: the Horizon overview page opens.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Please enable at least one backend` in the prechecks | Cinder is enabled without a backend. Add `skip_cinder_backend_check: "yes"` to `globals.yml`, or configure a backend. |
| `ansible ... -m ping` fails for a node | SSH, the hostname mapping, or passwordless sudo is not working. See [Prepare the nodes](./prepare-nodes.md). |
| `cinder-volume` is not deployed at all | `[storage]` is empty in the inventory. Add one node. |
| The prechecks complain about the VIP | Another machine uses the address, or `keepalived_virtual_router_id` clashes with another Keepalived. Change it. |
| RabbitMQ or MariaDB do not start | The hostname of a node does not match the inventory name, or the clocks differ. Check both. |
| An image pull fails | The node cannot reach the registry. Check DNS and internet access. |
| Neutron cannot take over the external interface | `neutron_external_interface` names a NIC that has an IP or that does not exist. Use the NIC without an address. |

## Rollback

To change the configuration, edit `globals.yml` and run:

```bash
kolla-ansible reconfigure -i ./multinode
```

To remove the whole deployment, which deletes every container and every volume of the services:

```bash
kolla-ansible destroy -i ./multinode --yes-i-really-really-mean-it
```

:::warning
`destroy` removes the containers and their data. Use it only on a lab that holds nothing you need.
:::

## What's next

Continue with [Post-install configuration](./post-install-openstack.md).
