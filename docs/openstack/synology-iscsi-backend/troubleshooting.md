---
sidebar_position: 7
title: Troubleshooting and Fallback
description: A table of common errors for the Synology iSCSI backend with their causes, and an LVM fallback for the case where the Synology driver does not work on your DSM version.
tags: [openstack, cinder, synology, troubleshooting, lvm]
---

# Troubleshooting and Fallback

This page collects the errors that show up most often with the Synology iSCSI backend, and describes a fallback for the case where the driver does not work on your DSM version. Start with the table, and read the log of the service that complains before you change anything.

## Where to look first

```bash
# on the cinder-volume node
sudo docker logs cinder_volume

# on the compute node that runs the instance
sudo docker exec iscsid iscsiadm -m session
sudo docker exec multipathd multipath -ll
sudo docker logs nova_compute
```

## Common problems

| Symptom | Likely cause |
| --- | --- |
| Precheck: "Please enable at least one backend" | Add `skip_cinder_backend_check: "yes"` to `globals.yml`. |
| Volume goes to `error` immediately | Read `docker logs cinder_volume`. Common causes: wrong password, the account is not in `administrators`, 2FA still enforced. |
| WebAPI login returns `403` or a `404` style error | 2FA is enforced for the service account. See [Prepare Synology for Cinder](./prepare-synology.md). |
| SSL certificate errors in the log | DSM has a self-signed cert. Set `driver_ssl_cert_verify = False` or install a trusted cert. |
| `cinder-volume` is not deployed at all | `[storage]` is empty in the inventory. |
| Only one iSCSI session | The target is bound to one NIC, or port 3260 is blocked on the second subnet. |
| Attach fails or no multipath device | A host-level `iscsid` or `multipathd` is still running. Disable it and confirm the containers are up. |
| Volumes stuck in `creating`, `attaching`, or `deleting` | A failure left them in a transient state. Reset them with `openstack volume set --state available <id>`. |
| DSM 7 API behaves differently from the driver docs | The driver docs target DSM 6.0.2 or later. Test with one volume, and use the fallback below if it fails. |

## If the Synology driver does not work

The driver is the part most likely to give trouble on newer DSM versions. If it does, there is a fallback that keeps the same hardware: create one big LUN manually in DSM, log in to both portals from the cinder node with `iscsiadm`, let multipath merge them into one device, build an LVM volume group named `cinder-volumes` on it, and use Kolla's regular LVM backend (`enable_cinder_backend_lvm` and `enable_cinder_backend_iscsi`). Cinder then slices volumes inside LVM, and DSM is just a big disk.

You lose Synology's native snapshots and clones, but it is the most predictable path.

### Outline

1. In DSM, create one big LUN and a target, and map them. See [Set up iSCSI](../../synology/iscsi-setup.md).
2. From the `cinder-volume` node, log in to the target through both portals:

```bash
sudo iscsiadm -m discovery -t sendtargets -p 172.16.2.31:3260
sudo iscsiadm -m node -T <target-iqn> --login
```

3. Let multipath merge the two sessions into one device, and check it with `multipath -ll`.
4. Create the volume group on that device:

```bash
sudo pvcreate /dev/mapper/<multipath-device>
sudo vgcreate cinder-volumes /dev/mapper/<multipath-device>
```

5. In `globals.yml`, enable the LVM backend and remove the custom Synology backend file:

```yaml
enable_cinder_backend_lvm: "yes"
enable_cinder_backend_iscsi: "yes"
```

6. Apply with `kolla-ansible deploy -i ./multinode`, and create a volume type for the LVM backend.

:::note
For this fallback the host-level `iscsiadm` session is used on the `cinder-volume` node to build the volume group. Keep that in mind next to the rule that the host `iscsid` must not run next to the Kolla container. Plan the order of the steps for your node, and check the result with `iscsiadm -m session` and `multipath -ll`.
:::

## Rollback

Switching from the fallback back to the Synology driver means removing the LVM options from `globals.yml`, restoring `cinder-volume.conf`, and deleting or migrating the volumes that live in LVM. Plan this before you put real data on the fallback.

## What's next

Return to [Volumes and block storage](../volumes.md), or to the [Synology guides](../../synology/deploy-xpenology.md).
