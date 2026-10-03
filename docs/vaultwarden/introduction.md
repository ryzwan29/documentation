---
sidebar_position: 1
title: Introduction to Vaultwarden
description: What Vaultwarden is, what problems it solves, and how it compares to other password management solutions.
tags: [vaultwarden, bitwarden, password-manager, self-hosted]
---

# Introduction to Vaultwarden

Vaultwarden is a lightweight, self-hosted **password manager server** that is compatible with the Bitwarden clients. It stores and syncs your passwords, passkeys, notes, and other secrets on infrastructure that you own and control.

This page explains what Vaultwarden is, what problems it solves, its main features and concepts, and how it compares to other solutions.

## What is Vaultwarden?

Vaultwarden is an alternative implementation of the Bitwarden server API. You run the server, and you use the official Bitwarden apps (browser extensions, desktop, mobile, and CLI) to talk to it. The apps handle encryption and autofill, and the server only stores and syncs the encrypted data.

Some quick facts:

- Open source, licensed under AGPL-3.0.
- Written in Rust, with very low resource usage. It runs comfortably on a small VM or a Raspberry Pi.
- Formerly known as `bitwarden_rs`, and renamed to Vaultwarden in 2021.
- An independent community project. It is **not** affiliated with or supported by Bitwarden, Inc.
- Compatible with the official Bitwarden clients, so users get the same apps and browser extensions.
- Self-hosted: you run it yourself (usually as a container) and your encrypted vaults stay on your own storage.

## The problem it solves

Without a central, trusted place for credentials, passwords end up scattered and weak. This is a problem for individuals and a bigger one for teams:

- People reuse the same few passwords across many services, because remembering unique ones is not realistic.
- Shared credentials (Wi-Fi, admin panels, service accounts) live in chat messages, spreadsheets, or sticky notes.
- Secrets are stored in browsers or tools that you do not administer.
- When someone leaves, nobody is sure which shared credentials they knew and which ones need to be rotated.
- Commercial password managers charge per user, and your encrypted vault data lives with the vendor.

Putting Vaultwarden in the middle changes this:

- Each user remembers **one** strong master password, and the vault generates and fills unique passwords everywhere else.
- Shared credentials live in shared collections with controlled access, instead of in chat history.
- The vault is encrypted on the client before it is sent. The server never sees your master password or your plaintext data.
- Everything runs on your own server and is covered by your own backups, with no per-user license cost.
- Offboarding is done in one place: remove the user from the organization and rotate the credentials they had access to.

## Core features

| Feature | What it does |
| --- | --- |
| **Vault items** | Store logins, cards, identities, and secure notes, with custom fields and folders. |
| **Official clients** | Browser extensions, desktop apps, mobile apps, web vault, and CLI, all from Bitwarden. |
| **Autofill and password generator** | Fill credentials in browsers and apps, and generate strong passwords and passphrases. |
| **Organizations and collections** | Share items with teams or families, with per-collection access control. |
| **Two-step login** | Authenticator apps (TOTP), email codes, FIDO2/WebAuthn security keys, YubiKey OTP, and Duo. |
| **Passkeys** | Store and use passkeys from the vault. |
| **TOTP in the vault** | Generate and autofill one-time codes for items that support them. |
| **Attachments** | Attach files to vault items. |
| **Send** | Share temporary text or files through links that expire and can be password protected. |
| **Emergency access** | Let a trusted contact request access to your vault after a waiting period. |
| **Admin page** | A web admin panel to manage users, organizations, and server settings, protected by an admin token. |
| **Multiple databases** | SQLite by default, with PostgreSQL and MySQL/MariaDB as alternatives. |
| **Email and notifications** | SMTP support for invitations, verification, and alerts, and live sync notifications between clients. |

Some features that are paid in the official Bitwarden service, such as organizations, TOTP storage, and attachments, are available in Vaultwarden without a license. Features that depend on Bitwarden's own commercial infrastructure may be missing or limited, so check the project documentation for the current list.

## Key concepts

- **Vault**: the encrypted collection of everything a user stores. Each user has their own vault.
- **Master password**: the one password that unlocks the vault. It is never sent to the server in plain form, and it cannot be recovered if it is lost.
- **Item**: a single entry in a vault, such as a login, card, identity, or secure note.
- **Folder**: a personal way to organize your own items.
- **Organization**: a group of users that share items, such as a team or a family.
- **Collection**: a set of items inside an organization. Access is granted to users or groups per collection.
- **Send**: a temporary, shareable item that can be accessed through a link.
- **Client**: any official Bitwarden app or extension used to access the vault.
- **Admin page**: the built-in management interface, available at `/admin` when an admin token is configured.
- **Data directory**: the folder where Vaultwarden keeps its database, attachments, and keys. It must be part of your backups.
- **Zero-knowledge encryption**: the server only stores encrypted data. Encryption and decryption happen on the client.

## How it works

This is a simplified view of what happens when a user logs in and uses a password.

1. The user enters their email and master password in a Bitwarden client.
2. The client derives encryption keys from the master password locally, using a key derivation function (PBKDF2 or Argon2id).
3. The client authenticates to the Vaultwarden server with a hash derived from the master password, not the password itself.
4. The server returns the encrypted vault, and the client decrypts it locally.
5. When the user visits a login page, the extension finds the matching item and fills in the credentials.
6. When the user adds or changes an item, the client encrypts it and sends the encrypted data to the server, which syncs it to the user's other devices.

At no point does the server see the master password or the plaintext contents of the vault.

:::info
The Bitwarden clients require a secure context. In practice this means Vaultwarden must be served over **HTTPS** (a TLS reverse proxy or certificate), except when you access it from `localhost`.
:::

## How does it compare to other solutions?

There is no single best choice. It depends on whether you want to run the system yourself, how much you want to pay, and what kind of support or compliance you need.

| Solution | Type | Notes |
| --- | --- | --- |
| **Vaultwarden** | Open source, self-hosted | Bitwarden-compatible, very light on resources, and no license cost. You are responsible for running, backing up, and securing it. Community supported. |
| **Bitwarden (official)** | Open source, hosted or self-hosted | The upstream project, with vendor support, audits, and enterprise features. The official self-hosted stack is heavier than Vaultwarden. |
| **1Password** | Commercial SaaS | Very polished, strong team features. Per-user pricing and the vault is hosted by the vendor. |
| **LastPass / Dashlane** | Commercial SaaS | Mature hosted password managers with business plans. |
| **KeePass / KeePassXC** | Open source, file based | Encrypted database file that you sync yourself. No server, but sharing and multi-user access are manual. |
| **Proton Pass** | Commercial SaaS | Part of the Proton ecosystem, with a focus on privacy and email aliases. |
| **Passbolt** | Open source, self-hosted | Built for team credential sharing and automation, with a different model and a smaller feature set for personal use. |
| **Browser built-in managers** | Built into browsers | Convenient and free, but tied to one browser or platform and limited for sharing. |

**When Vaultwarden is a good fit**

- You want your password vault on your own infrastructure, with no per-user pricing.
- You want the polished Bitwarden clients without running the heavier official server.
- You need to share credentials with a small team, a family, or a homelab.
- You are comfortable running and backing up a small service.

**When it might not be the right fit**

- If you do not want to operate and maintain a server yourself, a hosted password manager is easier.
- If you need a vendor SLA, official support, or formal compliance certifications, use the official Bitwarden service or another commercial option.
- If you only need a vault for yourself and do not need sync across many devices, KeePassXC is simpler.
- If you need enterprise features that depend on Bitwarden's commercial services, check whether Vaultwarden supports them before committing.

## Common use cases

- **Personal password manager**: unique passwords, passkeys, and TOTP codes across all your devices without a third-party account.
- **Family vault**: a shared organization for household accounts, subscriptions, and emergency access.
- **Team credentials**: shared collections for admin panels, service accounts, and infrastructure access.
- **Homelab and DevOps secrets**: store credentials, API keys, recovery codes, and notes for your lab services.
- **Temporary sharing**: use Send to pass a secret to someone through an expiring link.

## Deployment overview

Vaultwarden is a single Rust binary, so it is simple to run:

- **Container**: the official `vaultwarden/server` image, run with Docker or Podman. This is the most common way.
- **Kubernetes**: with community Helm charts or plain manifests.
- **VM or bare metal**: build from source or use a community-packaged binary.
- **Database**: SQLite is the default and works well for small and medium setups. PostgreSQL or MySQL/MariaDB are available if you prefer an external database.
- **Reverse proxy**: required in practice, to provide HTTPS (Nginx, Traefik, Caddy, and others).
- **Resources**: very low. A small VM with 1 vCPU and 512 MB to 1 GB of RAM is typically enough for a small team.
- **Storage**: a single data directory holding the database, attachments, and keys.

:::warning
Vaultwarden holds the keys to everything else, so protect it accordingly. Serve it only over HTTPS, back up the **whole data directory** (database, attachments, and keys) and test a restore, keep the server updated, turn off open sign-ups once your users are created, and protect or disable the `/admin` page. Remember that a lost master password cannot be recovered.
:::

## What's next

The following pages in this section walk through installing Vaultwarden, putting it behind an HTTPS reverse proxy, creating users and organizations, securing the admin page, and setting up backups.