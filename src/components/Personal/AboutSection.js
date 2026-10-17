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
          This site is my notebook for documenting and sharing what I build and run: homelab setups, step-by-step tutorials, and the projects I work on. It is not meant to show off, just to keep notes I can come back to, and maybe save someone else some time.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          The docs cover the self-hosted services and infrastructure I have learned and built, and they keep growing as I take on new projects. Each guide is written to be followed from top to bottom, from a clean install to a working setup.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          I try to write the guides in a general way, so they work on your hardware and not only on mine. Names, domains, and disks are placeholders you replace with your own. Where a change can break something, the guide has a pre-check before it, a post-check after it, a troubleshooting table, and a way to roll back.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          The blog is for longer write-ups and experiments. These are the things I tried, what worked, and what did not.
        </p>
        <p className='text-lg leading-relaxed text-gray-700 dark:text-gray-300'>
          I also run blockchain infrastructure as an independent validator operator since
          January 2025 (
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