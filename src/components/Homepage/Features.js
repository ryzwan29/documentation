import Link from '@docusaurus/Link'

const FeatureList = [
  {
    title: 'Step-by-Step Docs',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    to: '/docs/intro',
    linkLabel: 'Browse the docs',
    description: (
      <>
        Guides written from the setups I actually ran, so you can follow them from start to
        finish.
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
        Longer write-ups and experiments from the lab, including what worked and what did not.
      </>
    )
  },
  {
    title: 'Projects & Validator Nodes',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    to: '/about-me',
    linkLabel: 'About this site',
    description: (
      <>
        Notes from other projects I have learned from, including my independent blockchain
        validator operations under RydOne.
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