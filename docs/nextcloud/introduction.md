---
sidebar_position: 1
title: Introduction to Nextcloud
description: What Nextcloud is, what problems it solves, and how it compares to other file sync and collaboration solutions.
tags: [nextcloud, file-sync, collaboration, self-hosted]
---

# Introduction to Nextcloud

Nextcloud is an open-source, self-hosted **file sync, sharing, and collaboration platform**. It gives you a private alternative to Google Drive, Dropbox, or OneDrive, running on infrastructure that you own and control.

This page explains what Nextcloud is, what problems it solves, its main features and concepts, and how it compares to other solutions.

## What is Nextcloud?

At its core, Nextcloud stores your files in one place and syncs them to every device you use. On top of that core you can enable apps for calendars, contacts, chat and video calls, document editing, notes, task boards, and more. It starts as a file server and can grow into a full collaboration suite.

Some quick facts:

- Open source, licensed under AGPL-3.0.
- Started in 2016 as a fork of ownCloud, led by its original creator, Frank Karlitschek.
- Written mainly in PHP, with a web interface and native clients for desktop and mobile.
- Self-hosted: you run it yourself (VM, container, or Kubernetes) and your files stay on your own storage.
- Extensible through an app store with hundreds of community and official apps.

## The problem it solves

Without a central file platform, files end up scattered across email attachments, chat groups, USB drives, and personal cloud accounts. This works for a small team, but it breaks down as the team grows:

- Nobody knows which copy of a file is the latest, and names like `report_final_v3_REAL.pdf` pile up.
- Sharing a large file with an external party means using a third-party upload service.
- Internal documents and customer data sit on services that you do not administer.
- Backups depend on each person remembering to make one.
- When someone leaves, some files exist only on their laptop or personal account.

Putting Nextcloud in the middle changes this:

- Files sync automatically between laptop, phone, and the web interface.
- There is **one** copy of each document, with version history and a recycle bin.
- Sharing is a link with an optional password and expiry date, or a share with specific users and groups.
- Data lives on your own server and is covered by your own backups.
- Team folders belong to the team, not to an individual account, and offboarding is done in one place.

## Core features

| Feature | What it does |
| --- | --- |
| **File sync and access** | Web interface, desktop clients (Windows, macOS, Linux), mobile apps (iOS, Android), and WebDAV. |
| **Sharing** | Share with users, groups, or public links. Links support passwords, expiry dates, and read-only or upload-only permissions. |
| **Versions and trash** | Previous versions of files and a recycle bin for deleted files. |
| **Group folders** | Shared team folders managed by admins, independent of who created the files. |
| **Collaborative editing** | Edit documents, spreadsheets, and presentations together in the browser through Collabora Online or ONLYOFFICE integration. |
| **Talk, Calendar, Contacts, Mail** | Chat, video calls, shared calendars, address books, and an email client, delivered as apps. |
| **Encryption** | Server-side encryption and optional end-to-end encrypted folders. |
| **External storage** | Mount S3, SMB/CIFS, SFTP, WebDAV, and other storage as folders. |
| **User management and SSO** | Local users, LDAP/Active Directory, and SSO through SAML or OpenID Connect. |
| **Federated sharing** | Share files between separate Nextcloud servers. |
| **Workflows and automation** | Flow rules, activity feeds, and OCS/WebDAV APIs for scripting. |
| **App ecosystem** | Install additional apps from the built-in app store. |

## Key concepts

- **Instance**: your Nextcloud installation (the server and everything it serves).
- **Data directory**: the folder on disk where Nextcloud stores the actual files. It must be part of your backups.
- **Database**: stores metadata such as users, shares, file listings, and settings. PostgreSQL and MariaDB/MySQL are the usual production choices.
- **User**: an account that can log in.
- **Group**: a collection of users that can share the same access, quotas, or app permissions.
- **Share**: access to a file or folder granted to a user, a group, or anyone with a link.
- **Group folder**: a team-owned folder that belongs to a group rather than to a person.
- **App**: a feature module that can be enabled or disabled (Files, Talk, Calendar, and so on). Nextcloud is a set of apps on a common core.
- **Client**: the desktop or mobile application that syncs files with the server.
- **WebDAV**: the standard protocol used for file access and sync. Many other tools can talk to Nextcloud this way too.
- **Background jobs (cron)**: scheduled tasks for cleanup, indexing, and notifications.

## How file sync works

This is a simplified view of what happens when you change a file in a synced folder.

1. You save the file in your synced Nextcloud folder.
2. The desktop client detects the change.
3. The client uploads the file to the server over HTTPS using WebDAV.
4. The server stores the file in the data directory, keeps the previous version, and records the change in the database.
5. Other clients learn about the change and download the new version.
6. The file appears on those devices, and the activity shows up in the web interface.

For external sharing, you create a public link on a file or folder, optionally set a password and expiry date, and send it. The recipient opens it in a browser without needing an account, and the link stops working when it expires.

## How does it compare to other solutions?

There is no single best choice. It depends on whether you want to run the system yourself, how much you want to pay, and how much of a full suite you need.

| Solution | Type | Notes |
| --- | --- | --- |
| **Nextcloud** | Open source, self-hosted | File sync plus a broad app ecosystem (office, chat, calendar, mail). Full control over data. You are responsible for running, upgrading, and backing it up. |
| **Google Drive / Google Workspace** | Commercial SaaS | Very polished, with excellent real-time collaboration. Per-user pricing and your data lives with the vendor. |
| **Dropbox** | Commercial SaaS | Known for reliable sync and ease of use. Narrower than a full collaboration suite. |
| **Microsoft OneDrive / SharePoint** | Commercial SaaS | Best fit for organizations already built around Microsoft 365. |
| **ownCloud (Infinite Scale)** | Open source and commercial | The project Nextcloud forked from. Different architecture and a smaller app ecosystem. |
| **Seafile** | Open source, self-hosted | Focused on fast, efficient file sync. Fewer collaboration features built in. |
| **Syncthing** | Open source, peer-to-peer | Syncs folders directly between devices with no central server. No web sharing or user management. |
| **Synology Drive / QNAP** | NAS vendor software | Convenient if you already own the hardware, but tied to that vendor. |

**When Nextcloud is a good fit**

- You want your files on your own infrastructure, with no per-user pricing.
- You need more than sync: shared calendars, chat, and document editing in one platform.
- You want SSO with an existing identity system such as Keycloak or LDAP.
- You want a mature project with a large community and many integrations.

**When it might not be the right fit**

- If you do not want to operate and maintain a server yourself, a managed service is easier.
- If you only need to sync a few folders between your own devices, something lighter like Syncthing is enough.
- If your organization already lives in Microsoft 365 or Google Workspace, Nextcloud may duplicate what you already pay for.
- If you need a vendor SLA and support out of the box, you will need Nextcloud's commercial support or a managed hosting provider.

## Common use cases

- **Team file sharing**: shared folders, version history, and public links for clients.
- **Private cloud replacement**: personal files, photos, contacts, and calendars synced across devices without a big-tech account.
- **Documentation and runbooks**: collaborative editing of documents with history, next to the files they refer to.
- **Client and partner exchange**: upload-only links for receiving files, and federated sharing with other organizations.
- **Backup and archive target**: external storage mounts and WebDAV access for scripts and backup tools.
- **Centralized login**: connect Nextcloud to an identity provider such as Keycloak so the same account works across your tools.

## Deployment overview

Nextcloud is a PHP application with a database and some supporting services, so it can be run in several ways:

- **Container**: the official Docker image, or Nextcloud All-in-One (AIO), which bundles the app, database, Redis, and other components behind one management interface.
- **Kubernetes**: via the official Helm chart.
- **VM or bare metal**: a classic web server stack (Nginx or Apache with PHP-FPM) on Linux.
- **Database**: PostgreSQL or MariaDB/MySQL for production. SQLite is meant only for testing.
- **Caching and locking**: Redis is recommended for performance and correct file locking.
- **Storage**: local disk, NFS, or object storage such as S3 as the primary storage backend.
- **Scaling**: multiple application servers behind a load balancer, with shared storage, database, and Redis.

:::warning
Nextcloud becomes the place where everyone's files live, so a bad upgrade or a failed disk affects everyone. Plan for regular backups of **both the database and the data directory**, test that you can restore them, keep the server updated, and put it behind HTTPS before exposing it to the internet.
:::

## What's next

The following pages in this section walk through installing Nextcloud, configuring the database and caching, creating users and groups, setting up sharing, and connecting an identity provider for SSO.