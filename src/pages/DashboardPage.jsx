// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage.jsx — picks the workspace for the selected sidebar section.
//
// Sections live in `config/navigation.js`, not in a switch here, so adding one
// is a change to that file plus its component. A section that is not built yet
// renders `PlannedSection`, which reads its own copy out of the same config —
// there is no second place where a section is described.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import DashboardOverview from '../components/DashboardOverview'
import PlannedSection from '../components/PlannedSection'
import { navItem } from '../config/navigation'
import api from '../api'

/** Components for the sections that exist. Everything else is `PlannedSection`. */
const WORKSPACES = {
  overview: DashboardOverview,
}

export default function DashboardPage() {
  const [activeKey, setActiveKey] = useState('overview')

  // Retrieve user info from local storage
  const [user] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('user')) || {
          name: 'Platform Operator',
          role: 'super-admin',
        }
      )
    } catch {
      return { name: 'Platform Operator', role: 'super-admin' }
    }
  })

  const handleSignOut = async () => {
    if (window.confirm('Sign out of the Control Plane?')) {
      await api.logoutUser()
    }
  }

  const item = navItem(activeKey)
  const Workspace = WORKSPACES[activeKey]

  return (
    <DashboardLayout
      user={user}
      activeKey={activeKey}
      setActiveKey={setActiveKey}
      handleSignOut={handleSignOut}
    >
      {Workspace ? <Workspace user={user} /> : <PlannedSection item={item} />}
    </DashboardLayout>
  )
}
