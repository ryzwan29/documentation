import React from 'react'
import {
  Activity,
  Bell,
  Blocks,
  BrickWall,
  Boxes,
  Cable,
  Cloud,
  DatabaseBackup,
  Globe,
  Network,
  Server,
  ShieldCheck,
  Users
} from 'lucide-react'
import brandIcons from './skillIcons'
import styles from './SkillsSection.module.css'

// `brand` -> logo from skillIcons.js, `icon` -> generic lucide icon for skills without a logo
const skills = [
  { label: 'OpenStack', brand: 'openstack' },
  { label: 'Kolla Ansible', icon: Boxes },
  { label: 'Proxmox VE', brand: 'proxmox' },
  { label: 'Ceph', brand: 'ceph' },
  { label: 'VMware ESXi', brand: 'vmware' },
  { label: 'vSphere', brand: 'vmware' },
  { label: 'HCI', icon: Server },
  { label: 'High Availability', icon: ShieldCheck },
  { label: 'Prometheus', brand: 'prometheus' },
  { label: 'Grafana', brand: 'grafana' },
  { label: 'Zabbix', icon: Activity },
  { label: 'Alerting', icon: Bell },
  { label: 'Linux', brand: 'linux' },
  { label: 'Ubuntu', brand: 'ubuntu' },
  { label: 'Red Hat', brand: 'redhat' },
  { label: 'Bash', brand: 'bash' },
  { label: 'Python', brand: 'python' },
  { label: 'Ansible', brand: 'ansible' },
  { label: 'Terraform', brand: 'terraform' },
  { label: 'Jenkins', brand: 'jenkins' },
  { label: 'GitLab CI/CD', brand: 'gitlab' },
  { label: 'Git', brand: 'git' },
  { label: 'Docker', brand: 'docker' },
  { label: 'Docker Compose', brand: 'docker' },
  { label: 'AWS', icon: Cloud },
  { label: 'Azure', brand: 'azure' },
  { label: 'DigitalOcean', brand: 'digitalocean' },
  { label: 'Mikrotik', brand: 'mikrotik' },
  { label: 'Cisco', brand: 'cisco' },
  { label: 'VLAN', icon: Network },
  { label: 'FTTH', icon: Cable },
  { label: 'TCP/IP', icon: Globe },
  { label: 'Firewall', icon: BrickWall },
  { label: 'Windows Server', brand: 'windows' },
  { label: 'Active Directory', icon: Users },
  { label: 'Proxmox Backup Server', brand: 'proxmox' },
  { label: 'Vinchin', icon: DatabaseBackup },
  { label: 'Arcserve', icon: DatabaseBackup },
  { label: 'Acronis', icon: DatabaseBackup },
  { label: 'Blockchain Validator', icon: Blocks }
]

const mid = Math.ceil(skills.length / 2)
const row1 = skills.slice(0, mid)
const row2 = skills.slice(mid)

function SkillIcon({ brand, icon: Icon }) {
  if (brand) {
    const b = brandIcons[brand]
    return (
      <svg
        viewBox={b.vb}
        className={styles.icon}
        fill={b.color || 'currentColor'}
        aria-hidden='true'
        focusable='false'
      >
        <path d={b.d} />
      </svg>
    )
  }
  return <Icon className={styles.icon} strokeWidth={1.75} aria-hidden='true' />
}

function SkillItem({ skill }) {
  return (
    <div className={styles.item}>
      <SkillIcon brand={skill.brand} icon={skill.icon} />
      <span className={styles.label}>{skill.label}</span>
    </div>
  )
}

function CarouselRow({ items, direction, rowId }) {
  const animClass = direction === 'left' ? styles.scrollLeft : styles.scrollRight

  return (
    <div className={styles.rowWrapper}>
      <div className={`${styles.row} ${animClass}`}>
        {/* duplicated for seamless looping */}
        {[...items, ...items].map((skill, i) => (
          <SkillItem key={`${rowId}-${i}`} skill={skill} />
        ))}
      </div>
    </div>
  )
}

export default function SkillsSection() {
  return (
    <section className='container mx-auto max-w-5xl px-4 py-16'>
      <h2 className='mb-8 text-3xl font-bold'>Skills</h2>
      <div className={styles.carousel}>
        <CarouselRow items={row1} direction='left' rowId='r1' />
        <CarouselRow items={row2} direction='right' rowId='r2' />
      </div>
    </section>
  )
}