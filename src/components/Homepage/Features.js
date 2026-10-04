import Link from '@docusaurus/Link'

const FeatureList = [
  {
    title: 'Step-by-Step Docs',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    to: '/docs/intro',
    linkLabel: 'Browse the docs',
    description: (
      <>
        Install guides for Proxmox, OpenStack, Keycloak, Nextcloud, and Vaultwarden, written so you
        can follow them from start to finish.
      </>
    )
  },
  {
    title: 'Homelab Write-ups',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    to: '/blog',
    linkLabel: 'Read the blog',
    description: (
      <>
        Posts on running OpenStack with Synology iSCSI storage, deploying Xpenology on Proxmox, and
        other experiments from the lab.
      </>
    )
  },
  {
    title: 'Cloud & Blockchain Infra',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    to: '/about-me',
    linkLabel: 'More about me',
    description: (
      <>
        By day I monitor OpenStack with Prometheus and Grafana. On the side I operate validator
        nodes on 30+ blockchain networks.
      </>
    )
  }
]

function Feature({ Svg, title, description, to, linkLabel }) {
  return (
    <div>
      <div className='text--center'>
        <Svg className='mx-auto h-52 w-52' role='img' />
      </div>
      <div className='text--center padding-horiz--md'>
        <p className='mb-2 text-xl font-bold'>{title}</p>
        <p className='mx-auto max-w-sm'>{description}</p>
        <Link to={to} className='font-medium'>
          {linkLabel} →
        </Link>
      </div>
    </div>
  )
}

export default function HomepageFeatures() {
  return (
    <section className='py-10'>
      <div className='mx-auto max-w-7xl'>
        <div className='grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3'>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}