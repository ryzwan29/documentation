import React from 'react'
import Link from '@docusaurus/Link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'
import brandIcons from '@/components/Personal/skillIcons'

const TechPill = ({ tech }) => {
  const icon = brandIcons[tech.brand]

  return (
    <div className='inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 transition-all duration-200 hover:scale-105 hover:border-gray-300 hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-900'>
      <svg
        viewBox={icon.vb}
        fill={icon.color || 'currentColor'}
        className='mr-1.5 h-4 w-4 text-gray-800 sm:mr-2 dark:text-gray-200'
        aria-hidden='true'
        focusable='false'
      >
        <path d={icon.d} />
      </svg>
      <span className='text-sm font-semibold text-gray-700 sm:text-sm dark:text-gray-300'>
        {tech.name}
      </span>
    </div>
  )
}

export default function HeroBanner() {
  const techs = [
    { id: 'openstack', brand: 'openstack', name: 'OpenStack' },
    { id: 'proxmox', brand: 'proxmox', name: 'Proxmox VE' },
    { id: 'ceph', brand: 'ceph', name: 'Ceph' },
    { id: 'prometheus', brand: 'prometheus', name: 'Prometheus' },
    { id: 'grafana', brand: 'grafana', name: 'Grafana' },
    { id: 'linux', brand: 'linux', name: 'Linux' }
  ]

  return (
    <div>
      <div className='px-4 py-8 sm:py-12'>
        <div className='mx-auto max-w-7xl'>
          <div className='text-center'>
            <div className='group relative mx-auto flex w-max items-center justify-center rounded-full bg-white px-4 py-1.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f] dark:bg-transparent'>
              <span
                className={cn(
                  'animate-gradient absolute inset-0 block h-full w-full rounded-[inherit] bg-linear-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-size-[300%_100%] p-px'
                )}
                style={{
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'destination-out',
                  mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  maskComposite: 'subtract',
                  WebkitClipPath: 'padding-box'
                }}
              />
              <AnimatedGradientText className='text-sm font-medium'>
                ☁️ Cloud Infrastructure · Homelab 
              </AnimatedGradientText>
            </div>

            <h1 className='mt-4 mb-4 text-[28px] leading-tight font-bold text-gray-900 sm:mt-6 sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl dark:text-white'>
              Cloud Infrastructure, Homelab
              <br className='hidden sm:block' />
              <span className='sm:hidden'> </span>&amp; Self-Hosted Guides
            </h1>

            <p className='mx-auto mb-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:mb-8 sm:text-lg dark:text-gray-300'>
              Docs and write-ups from Rizwan Fairuz Mamduh, a cloud engineer. OpenStack, Proxmox,
              Synology storage, Keycloak SSO, Nextcloud, and Vaultwarden, documented step by step
              from my own lab.
            </p>

            <div className='mb-8 flex flex-wrap justify-center gap-3'>
              <Button size='lg' asChild>
                <Link to='/docs/intro' className='hover:text-primary-foreground'>
                  Read the Docs
                </Link>
              </Button>
              <Button variant='outline' size='lg' asChild>
                <Link to='/blog'>Latest Posts</Link>
              </Button>
              <Button variant='outline' size='lg' asChild>
                <Link to='/about-me'>About Me</Link>
              </Button>
            </div>

            <div className='flex flex-wrap justify-center gap-4'>
              {techs.map((tech) => (
                <TechPill key={tech.id} tech={tech} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}