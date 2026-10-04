import React from 'react'
import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import Image from '@theme/IdealImage'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'

const DiscordIcon = () => (
  <svg viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5' aria-hidden='true'>
    <path d='M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z' />
  </svg>
)

const TelegramIcon = () => (
  <svg viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5' aria-hidden='true'>
    <path d='M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' />
  </svg>
)

export default function HeroSection() {
  const avatarUrl = useBaseUrl('/img/docusaurus.png')
  const emailIcon = useBaseUrl('/img/email.svg')
  const githubIcon = useBaseUrl('/img/github.svg')
  const linkedinIcon = useBaseUrl('/img/linkedin.svg')

  return (
    <section className='container mx-auto max-w-5xl px-4 pt-20 pb-16'>
      <div className='flex flex-col items-center gap-8 md:flex-row'>
        {/* Left side - Text content */}
        <div className='flex-1 space-y-6'>
          <div className='inline-block'>
            <AnimatedGradientText className='text-lg font-semibold'>
              👋 Hi, Rizwan Fairuz Mamduh
            </AnimatedGradientText>
          </div>

          <h1 className='text-5xl font-bold tracking-tight md:text-6xl'>
            Cloud Engineer | IT Infrastructure
          </h1>

          <p className='text-xl leading-relaxed text-gray-600 dark:text-gray-400'>
            I keep OpenStack clouds monitored and running, and I operate validator nodes on 20+
            blockchain networks. Infrastructure, automation, and observability are what I do.
          </p>

          <div className='flex flex-wrap gap-3 pt-4'>
            <Button variant='outline' size='lg' asChild>
              <a href='mailto:rizwanfairuzmamduh29@gmail.com' className='flex items-center'>
                <Image img={emailIcon} alt='Email' className='h-5 w-5' />
                Email me
              </a>
            </Button>
            <Button variant='outline' size='lg' asChild>
              <Link
                to='https://github.com/ryzwan29'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center'
              >
                <Image img={githubIcon} alt='GitHub' className='h-5 w-5' />
                GitHub
              </Link>
            </Button>
            <Button variant='outline' size='lg' asChild>
              <Link
                to='https://www.linkedin.com/in/rizwan-fairuz-mamduh'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center'
              >
                <Image img={linkedinIcon} alt='LinkedIn' className='h-5 w-5' />
                LinkedIn
              </Link>
            </Button>
            <Button variant='outline' size='lg' asChild>
              <Link
                to='https://discord.com/users/791457544358199368'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2'
              >
                <DiscordIcon />
                Discord
              </Link>
            </Button>
            <Button variant='outline' size='lg' asChild>
              <Link
                to='https://t.me/Ryddd29'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2'
              >
                <TelegramIcon />
                Telegram
              </Link>
            </Button>
          </div>
        </div>

        {/* Right side - Avatar */}
        <div className='shrink-0'>
          <Avatar className='h-48 w-48 border-4 border-gray-200 dark:border-gray-700'>
            <AvatarImage src={avatarUrl} alt='Profile Picture' />
            <AvatarFallback className='bg-linear-to-br from-blue-500 to-purple-600 text-6xl font-bold text-white'>
              RF
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </section>
  )
}