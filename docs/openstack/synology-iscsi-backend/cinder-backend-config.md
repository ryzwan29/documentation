---
sidebar_position: 4
title: Configure the Cinder Backend
description: Enable the iSCSI options in globals.yml, write cinder-volume.conf for the Synology driver with two portals, deploy it with Kolla Ansible, and test one volume.
tags: [openstack, cinder, synology, kolla-ansible]
---

# Configure the Cinder Backend

This guide connects Cinder to Synology DSM. You tell Kolla to run `iscsid` and `multipathd`, describe the Synology backend in `cinder-volume.conf`, apply it, and create a first volume. By the end `cinder-volume` is `up` for the Synology backend, a volume type points to it, and a test volume exists as a LUN in DSM.

## Prerequisites

- A deployed cloud with Cinder enabled. See [Deploy with Kolla Ansible](../deploy-kolla-ansible.md).
- `[storage]` in the inventory has exactly **one** node.
- The service account, the firewall, and the WebAPI test are done. See [Prepare Synology for Cinder](./prepare-synology.md).
- The host `iscsid` and `multipathd` are disabled on all nodes. See [Prepare the nodes for iSCSI](./prepare-nodes-iscsi.md).
- The admin credentials loaded on the deployer (`source /etc/kolla/admin-openrc.sh`).

## Pre-check

### Check the inventory

```bash
grep -A2 '^\[storage\]' ./multinode
```

Expected: exactly one host under `[storage]`.

### Check the current volume services

```bash
openstack volume service list
```

Expected: `cinder-scheduler` is `up`. There is no working Synology `cinder-volume` yet.

### Check the Kolla configuration directory

```bash
ls /etc/kolla/config/cinder 2>/dev/null || echo "no cinder config directory yet"
```

Expected: either nothing or an earlier `cinder-volume.conf` that you are about to replace.

## Procedure

### Enable the iSCSI options in globals.yml

Add these lines to `/etc/kolla/globals.yml`, next to the Cinder options from the deploy guide:

```yaml
enable_iscsid: "yes"
enable_multipathd: "yes"
enable_cinder_backend_iscsi: "yes"
skip_cinder_backend_check: "yes"
```

`enable_iscsid` and `enable_multipathd` start the containers on the nodes that need them, and `enable_cinder_backend_iscsi` tells Kolla that Cinder uses iSCSI. `skip_cinder_backend_check` stays on because the backend is described in a custom config file, not through a Kolla backend option.

### Write cinder-volume.conf

Create `/etc/kolla/config/cinder/cinder-volume.conf` on the deployment host. Kolla copies it to the `cinder-volume` node.

```ini
[DEFAULT]
enabled_backends = synology

[synology]
# Fixed logical host name, so volumes are not tied to one node.
# Set it BEFORE creating the first volume.
backend_host = cinder-synology
volume_backend_name = synology
volume_driver = cinder.volume.drivers.synology.synology_iscsi.SynoISCSIDriver
target_protocol = iscsi

# Path 1: WebAPI and the main iSCSI portal
target_ip_address = 172.16.2.31
# Path 2: second iSCSI portal
target_secondary_ip_addresses = 172.16.3.31

synology_admin_port = 5001
driver_use_ssl = True
# DSM uses a self-signed certificate out of the box
synology_ssl_verify = False
driver_ssl_cert_verify = False

synology_username = <username>
synology_password = <password>
synology_pool_name = volume1

use_multipath_for_image_xfer = True

# Cache images in the backend to speed up "create volume from image"
image_volume_cache_enabled = True
image_volume_cache_max_size_gb = 100
image_volume_cache_max_count = 20
```

Replace `<username>`, `<password>`, and `synology_pool_name` with the service account and the DSM volume name. A few notes:

- `target_ip_address` takes only **one** IP and is also used for the WebAPI calls. The second iSCSI portal goes in `target_secondary_ip_addresses`. Either way, verify that both sessions really form. See [Verify the iSCSI paths](./verify-multipath.md).
- `driver_ssl_cert_verify = False` is fine for a lab. In production, install a proper certificate on DSM and leave verification on.
- The image-volume cache only becomes active after you set `cinder_internal_tenant_project_id` and `cinder_internal_tenant_user_id`, which need Keystone to be running first. Until then it does nothing, so it is safe to leave in.
- The password sits in this file in plain text. Set `chmod 600`, keep it out of git, and consider `ansible-vault` for the file.

```bash
chmod 600 /etc/kolla/config/cinder/cinder-volume.conf
```

### Apply the configuration

On the deployment host, with the virtual environment active:

```bash
kolla-ansible deploy -i ./multinode
```

This is safe on a running cloud: it only changes what differs, and it starts the `iscsid` and `multipathd` containers and `cinder-volume` with the new backend. Later, when only `cinder-volume.conf` changes, a targeted reconfigure is enough:

```bash
kolla-ansible reconfigure -i ./multinode --tags cinder
```

### Create a volume type and test one volume

First, check that the `cinder-volume` service for the Synology backend is up:

```bash
openstack volume service list
# cinder-volume ... synology ... up
```

![Cinder volume service list](<img/Screenshot 2026-10-02 124620.png>)

Create a volume type that points to the backend, then create a 10 GB test volume:

```bash
openstack volume type create fast
openstack volume type set fast --property volume_backend_name=synology

openstack volume create --size 10 --type fast test-vol
openstack volume list
openstack volume show test-vol -c status -c os-vol-host-attr:host
```

![Test volume status and host](<img/Screenshot 2026-10-02 125052.png>)

The status should become `available`. In DSM, **SAN Manager** should now show a new LUN and a target whose name starts with `Cinder-Target-`.

![New Cinder LUN in DSM SAN Manager](<img/Screenshot 2026-10-02 125102.png>)

If the status goes to `error`, look at the Cinder log on the `cinder-volume` node:

```bash
sudo docker logs cinder_volume
```

Login failures, 2FA problems, and API-version differences on DSM 7 all show up there.

## Post-check

### Check the service and the containers

```bash
openstack volume service list
ssh <storage-node> sudo docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'cinder|iscsid|multipathd'
```

Expected: `cinder-volume` for `cinder-synology@synology` is `up`, and the `cinder_volume`, `iscsid`, and `multipathd` containers are running.

### Check the host name of the volume

```bash
openstack volume show test-vol -c os-vol-host-attr:host
```

Expected: the host is `cinder-synology@synology#volume1`, the fixed logical name and not a node name.

### Check the LUN in DSM

Open **SAN Manager** and confirm that a LUN and a `Cinder-Target-` target exist for the test volume.

### Clean up

```bash
openstack volume delete test-vol
```

Expected: the volume disappears, and the LUN and the target disappear in DSM.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Precheck: `Please enable at least one backend` | Add `skip_cinder_backend_check: "yes"` to `globals.yml`. |
| The volume goes to `error` immediately | Read `docker logs cinder_volume`. Common causes: wrong password, the account is not in `administrators`, 2FA still enforced. |
| SSL certificate errors in the log | DSM has a self-signed cert. Set `driver_ssl_cert_verify = False` or install a trusted cert. |
| `cinder-volume` is not deployed at all | `[storage]` is empty in the inventory. |
| The `cinder-synology@synology` service is `down` | The container cannot reach the WebAPI on port `5001`, or the credentials are wrong. Read the container log. |
| The config change has no effect | The file is in the wrong path or has wrong syntax. Check `/etc/kolla/config/cinder/cinder-volume.conf` and run the reconfigure command again. |

## Rollback

To stop using the backend, delete all volumes that use the `fast` type, then remove the type and the configuration:

```bash
openstack volume type delete fast
rm /etc/kolla/config/cinder/cinder-volume.conf
```

Remove the iSCSI options from `globals.yml` if you no longer need them, then run `kolla-ansible deploy -i ./multinode` again.

:::warning
Deleting volumes deletes their data, and the LUNs behind them in DSM.
:::

## What's next

Continue with [Verify the iSCSI paths](./verify-multipath.md).
