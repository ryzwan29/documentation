import Layout from '@theme/Layout'

import HomepageFeatures from '@/components/Homepage/Features'
import LatestNews from '@/components/LatestNews'
import HeroBanner from '@/components/HeroBanner'

export default function Home({ homePageBlogMetadata, recentPosts }) {
  return (
    <Layout
      title='Homelab & Self-Hosted Documentation'
      description='Personal documentation of the homelab and self-hosted projects I have learned and built, written step by step.'
    >
      <main className='background-grid background-grid--fade-out'>
        <HeroBanner />
        <HomepageFeatures />
        <LatestNews recentPosts={recentPosts} homePageBlogMetadata={homePageBlogMetadata} />
      </main>
    </Layout>
  )
}