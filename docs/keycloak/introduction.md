---
sidebar_position: 1
title: Introduction to Keycloak
description: What Keycloak is, what problems it solves, and how it compares to other identity solutions, told through the story of a small team.
tags: [keycloak, iam, sso, oidc]
---

# Introduction to Keycloak

It is Monday morning and Dina, a new engineer, joins a small infrastructure team. Before lunch she needs access to the monitoring dashboard, the Git server, the CI pipeline, the cloud console, the wiki, and the ticket tracker. Six tools, six accounts, six passwords.

Throughout this page we will follow Dina and her team. Her first week is a pretty good way to understand why Keycloak exists and what it does.

## What is Keycloak?

Keycloak is an open-source **Identity and Access Management (IAM)** solution. It sits in front of your applications and handles the parts of security that nobody wants to build twice: logging users in, remembering who they are, and deciding what they are allowed to do.

Instead of every application implementing its own login form, password storage, session handling, and password reset flow, you point them all at Keycloak. The applications trust Keycloak to authenticate the user and tell them who that user is.

Some quick facts:

- Open source, licensed under Apache 2.0.
- Started around 2014 as a Red Hat project, and accepted into the Cloud Native Computing Foundation (CNCF) as an incubating project in 2023.
- Written in Java and built on Quarkus.
- Self-hosted: you run it yourself (VM, container, or Kubernetes) and keep full control of your data.

## The problem it solves

Dina's team has never had a central login system. Every tool grew its own little user table, and it worked fine back when there were only two tools. Now it looks like this:

- Dina has six passwords. By Wednesday she has reset two of them and reused one she should not have.
- Adding MFA would mean going into each of the six tools and hoping each one supports it.
- Each tool handles security slightly differently, and a couple of them do it badly.

A few months later, someone leaves the team on a Friday afternoon. Now somebody has to remember every place that person had an account, log into each one, and disable it. Everyone is fairly sure they got them all. Nobody is completely sure.

Nothing in this story is a bug. It is just what happens when every application grows its own login system. It is annoying with six apps and a real security risk with twenty.

Now imagine the team puts Keycloak in the middle:

- Dina logs in **once** and gets into every connected tool (Single Sign-On).
- Authentication logic lives in **one place**, built and maintained by people who do this full time.
- Password rules, MFA, and session timeouts are configured centrally.
- Onboarding and offboarding happen in one place. When someone leaves, one click disables them everywhere.
- The tools only need to validate tokens. They never see anyone's password.

## Core features

Here is what the team gets once Keycloak is in place.

| Feature | What it does | Dina's week |
| --- | --- | --- |
| **Single Sign-On (SSO)** | One login for many applications. Single logout is supported too. | One login instead of six. |
| **Standard protocols** | OpenID Connect (OIDC), OAuth 2.0, and SAML 2.0. | Old and new tools can both connect. |
| **Multi-factor authentication** | OTP apps (TOTP), WebAuthn, and passkeys. | MFA turned on once, for everything. |
| **Identity brokering** | Let users log in with Google, GitHub, Microsoft, or any other OIDC/SAML provider. | Contractors can sign in with their own accounts. |
| **User federation** | Connect to existing LDAP or Active Directory servers instead of migrating users. | No need to recreate the old company directory. |
| **Roles and groups** | Organize users and map them to permissions. | She joins the "ops" group and gets the right access. |
| **Fine-grained authorization** | Policy-based permissions for resources and scopes. | Read-only on production, full access on staging. |
| **Admin console and Account console** | A web UI for admins, and a self-service portal for users. | She changes her own password without asking anyone. |
| **Themes** | Customize login pages, emails, and account pages. | The login page shows the team's logo. |
| **Extensibility** | Provider interfaces (SPIs) to plug in custom authenticators, user storage, event listeners, and more. | Room to grow when requirements get weird. |
| **Admin REST API** | Automate almost everything you can do in the UI. | Onboarding can be scripted. |

## Key concepts

You will see these terms everywhere in the Keycloak docs and UI. Here they are, mapped back to the team's office.

- **Realm**: an isolated space that holds its own users, clients, roles, and settings. Think of it as the whole office building. The team might have one realm for internal tools and another for the customer-facing product, like two separate buildings with separate guest lists.
- **Client**: an application or service that uses Keycloak to authenticate users. Each tool Dina uses (the dashboard, Git, CI) is a client, like a separate door in the building.
- **User**: an account that can log in. Dina is a user.
- **Role**: a permission label such as `admin` or `viewer`. This is what decides which doors her badge opens.
- **Group**: a collection of users that share attributes and role mappings. Instead of giving Dina ten permissions one by one, she is added to the "ops" group.
- **Identity Provider (IdP)**: an external system Keycloak can delegate login to (Google, GitHub, another Keycloak, and so on). It is like a visitor showing an ID issued by someone else that the front desk trusts.
- **Token**: the signed proof of identity (ID token, access token, refresh token) that Keycloak hands to the client after a successful login. It is the badge itself.

## How a login works

On Tuesday morning, Dina opens the monitoring dashboard. Behind the scenes this is the simplified OpenID Connect Authorization Code flow, the most common one.

1. Dina opens the dashboard and clicks login.
2. The dashboard redirects her browser to Keycloak.
3. She authenticates on the Keycloak login page (password, MFA, or an external provider).
4. Keycloak redirects her back to the dashboard with a short-lived authorization code.
5. The dashboard exchanges that code with Keycloak for tokens.
6. The dashboard validates the tokens and creates her session.

Ten minutes later she opens the Git server. Keycloak already knows who she is, so she is let in without typing anything. That is SSO. And at no point did either tool see her password. They only received signed tokens that they can verify.

## How does it compare to other solutions?

When the team talked about fixing this, they did not just grab the first tool they found. There is no single best choice. It depends on whether you want to run the system yourself, how much you want to pay, and how much control you need.

| Solution | Type | Notes |
| --- | --- | --- |
| **Keycloak** | Open source, self-hosted | Very feature-rich, no per-user licensing cost, full control. You are responsible for running, upgrading, and securing it. |
| **Auth0 / Okta** | Commercial SaaS | Easy to start and well polished, but pricing typically scales with user count and your data lives with the vendor. |
| **AWS Cognito** | Managed cloud service | Tight AWS integration and low effort to run, but less flexible and more tied to AWS. |
| **Microsoft Entra ID** | Managed cloud service | Excellent for Microsoft 365 and enterprise environments, less suited as a general customer identity platform. |
| **Authentik** | Open source, self-hosted | Lighter and more modern UI, popular in homelabs. Smaller ecosystem than Keycloak. |
| **Authelia** | Open source, self-hosted | Focused on protecting apps behind a reverse proxy with MFA. Not a full IAM server. |
| **ZITADEL / Ory / FusionAuth** | Open source or commercial | Alternatives with different trade-offs in architecture, licensing, and hosting options. |

**Why Dina's team picked Keycloak**

- They did not want vendor lock-in or per-user pricing.
- They needed standard protocols and enterprise features such as SAML, LDAP federation, and fine-grained authorization.
- They wanted identity data to stay on their own infrastructure.
- They liked that it is a mature project with a large community and plenty of integrations.

**When it might not be the right fit**

Another team, with different needs, could reasonably choose differently:

- If you do not want to operate and maintain an identity server yourself, a managed service is easier.
- If your needs are small, for example protecting a couple of homelab services, a lighter tool would do.
- If you need a fully managed service with a vendor SLA, Keycloak on its own will not give you that.

## Common use cases

Over time the team found more and more places to use it.

- **Company SSO**: one login for internal tools, dashboards, and admin panels. This is where Dina's team started.
- **Customer identity (CIAM)**: sign up, login, social login, and MFA for their own product.
- **Securing APIs and microservices**: issue and verify access tokens between services.
- **Bridging legacy and modern apps**: expose SAML to the old wiki and OIDC to the new tools from the same user directory.
- **Infrastructure and DevOps tooling**: log in to Grafana, Argo CD, Kubernetes (via OIDC), and OpenStack with the same account.

## Deployment overview

Keycloak itself is stateless apart from its database and caches, which makes it straightforward to run in several ways:

- **Container**: the official image, run with Docker or Podman.
- **Kubernetes / OpenShift**: via the Keycloak Operator or Helm charts.
- **Bare metal or VM**: using the distribution archive.
- **Database**: PostgreSQL is the most common choice for production.
- **Clustering**: multiple nodes behind a load balancer for high availability.

:::warning
There is a catch the team learned early. Keycloak is now the front door for everything, so if it goes down, nobody can log in anywhere. Plan for high availability, regular database backups, and routine upgrades before putting it in front of production tools.
:::

## What's next

By Friday of her first week, Dina has one account, one password, and MFA turned on, and nobody on the team has to ask who has access to what. Time to build the same setup for yourself.

The following pages in this section walk through installing Keycloak, creating your first realm, registering a client, and connecting an application.