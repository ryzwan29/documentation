import React from 'react'
import Link from '@docusaurus/Link'

export default function AboutSection() {
  const stats = [
    { value: '30+', label: 'Blockchain networks operated as validator' },
    { value: '99%+', label: 'Availability on production validator nodes' }
  ]

  return (
    <section className='container mx-auto max-w-5xl px-4 py-16'>
      <h2 className='mb-8 text-3xl font-bold'>About</h2>
      <div className='prose prose-lg dark:prose-invert max-w-none space-y-4'>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          I&apos;m a Cloud Engineer where I keep OpenStack-based cloud
          infrastructure and virtual machine environments healthy. My day-to-day covers monitoring
          with Grafana and Prometheus, writing alerting rules for better incident detection,
          maintaining local Linux package repositories, and troubleshooting Ubuntu and Red Hat-based
          servers together with the OpenStack infrastructure team.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          My path into infrastructure started with networking at SMK Wikrama Bogor, then moved
          through ISP and FTTH work, and on to system engineering: VMware ESXi and vCenter, Proxmox
          clusters with Ceph and HA, Windows Server, and VM backup and recovery. Along the way I
          picked up cloud fundamentals through an OpenStack and Kolla Ansible project at the
          Infradigital cybersecurity bootcamp, plus hands-on AWS work.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          Outside of work, I run blockchain infrastructure as an independent validator operator
          since January 2025 (
          <Link
            to='https://rydone.xyz'
            target='_blank'
            rel='noopener noreferrer'
            className='font-medium text-blue-600 no-underline hover:underline'
          >
            RydOne
          </Link>
          ). That means validator, RPC, and sentry nodes, provisioned with Terraform and Ansible,
          automated with Bash and Python, and watched with Prometheus and Grafana. 
        </p>
      </div>

      <div className='mt-10 grid gap-4 sm:grid-cols-2'>
        {stats.map((stat) => (
          <div
            key={stat.value}
            className='rounded-xl border border-gray-200 p-6 dark:border-gray-700'
          >
            <div className='text-4xl font-bold text-blue-600'>{stat.value}</div>
            <div className='mt-2 text-sm text-gray-600 dark:text-gray-400'>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}