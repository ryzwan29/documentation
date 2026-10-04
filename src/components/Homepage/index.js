import Layout from '@theme/Layout'

import HomepageFeatures from '@/components/Homepage/Features'
import LatestNews from '@/components/LatestNews'
import HeroBanner from '@/components/HeroBanner'

export default function Home({ homePageBlogMetadata, recentPosts }) {
  return (
    <Layout
      title='Cloud Infrastructure Docs & Blog'
      description='Docs and write-ups on OpenStack, Proxmox, Synology storage, Keycloak SSO, Nextcloud, and Vaultwarden by Rizwan Fairuz Mamduh.'
    >
      <main className='background-grid background-grid--fade-out'>
        <HeroBanner />
        <HomepageFeatures />
        <LatestNews recentPosts={recentPosts} homePageBlogMetadata={homePageBlogMetadata} />
      </main>
    </Layout>
  )
}