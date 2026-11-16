// ─────────────────────────────────────────────────────────────────────────────
// DashboardOverview.jsx — the one screen that answers two questions:
// "is the platform healthy?" and "is it growing?"
//
// Same shape as before — welcome banner, four KPI tiles, one searchable table.
// What changed is what it is ABOUT: customer organisations on HR Clouds rather
// than user accounts in one app.
//
// WHAT IS REAL HERE: the layout, the states, the derivations. The numbers come
// from `data/sampleOrganisations.js` because no platform-plane API exists yet,
// and the notice at the top says so. Do not remove that notice before the fetch
// replaces the import — invented figures presented as real ones is the one
// thing an operations console must never do.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Users,
  AlertTriangle,
  Gauge,
  Search,
  RefreshCw,
  FlaskConical,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { BRAND, TERMS } from '../config/brand'
import {
  PLANS,
  SAMPLE_ORGANISATIONS,
  platformTotals,
  seatUsage,
  totalMembers,
} from '../data/sampleOrganisations'

/* ─── Subscription states ─────────────────────────────────────────────────
   `hint` is what the operator should take from the state, said as a
   consequence rather than a mechanism. */
const STATE_META = {
  active: {
    label: 'Active',
    badge: 'dd-badge-active',
    icon: CheckCircle2,
    hint: 'Paid and running.',
  },
  trial: {
    label: 'On Free plan',
    badge: 'dd-badge-neutral',
    icon: Clock,
    hint: 'Using HR Clouds, but not paying yet.',
  },
  grace: {
    label: 'Payment failed',
    badge: 'dd-badge-attention',
    icon: AlertCircle,
    hint: 'Keeps full access for 3 days, then loses it.',
  },
  cancelling: {
    label: 'Cancelling',
    badge: 'dd-badge-attention',
    icon: Clock,
    hint: 'Keeps access until the paid period ends, then stops.',
  },
  suspended: {
    label: 'Suspended',
    badge: 'dd-badge-suspended',
    icon: AlertCircle,
    hint: 'Nobody in this organisation can sign in.',
  },
}

const stateMeta = (state) =>
  STATE_META[state] || {
    label: 'Unknown',
    badge: 'dd-badge-neutral',
    icon: AlertCircle,
    hint: '',
  }

/** The queues an operator actually works, in priority order. */
const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'attention',
    label: 'Needs attention',
    match: (o) => o.state === 'grace' || o.state === 'suspended',
  },
  { key: 'leaving', label: 'Leaving', match: (o) => o.state === 'cancelling' },
  { key: 'free', label: 'On Free plan', match: (o) => o.state === 'trial' },
  { key: 'stalled', label: 'Stalled setup', match: (o) => o.setupPercent < 80 },
]

/** 0–1 → "72%". Never a bare decimal. */
const asPercent = (value) => `${Math.round(value * 100)}%`

export default function DashboardOverview({ user }) {
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

  // Stands in for the platform fetch. Guarded so a swapped-in real call that
  // resolves after an unmount cannot set state on a dead component.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) {
        setOrgs(SAMPLE_ORGANISATIONS)
        setLoading(false)
      }
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const totals = useMemo(() => platformTotals(orgs), [orgs])

  const filteredRecords = useMemo(() => {
    const matcher = FILTERS.find((f) => f.key === filter)?.match ?? (() => true)
    const needle = searchTerm.trim().toLowerCase()
    return orgs
      .filter(matcher)
      .filter(
        (org) =>
          !needle ||
          org.name.toLowerCase().includes(needle) ||
          org.industry.toLowerCase().includes(needle)
      )
  }, [orgs, filter, searchTerm])

  const stats = [
    {
      title: TERMS.orgPlural,
      value: totals.organisations,
      caption: 'companies with a workspace',
      icon: Building2,
    },
    {
      title: 'People on the platform',
      value: totals.members?.toLocaleString('en-IN'),
      caption: 'employees, managers and HR, all orgs',
      icon: Users,
    },
    {
      title: 'Need attention',
      value: totals.atRisk,
      caption: 'payment failed, leaving or suspended',
      icon: AlertTriangle,
    },
    {
      title: 'Near their seat cap',
      value: totals.nearSeatCap,
      caption: '85% or more of paid employee seats used',
      icon: Gauge,
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full dd-fade-in">
      {/* Says plainly where the numbers come from. Goes when the API lands. */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#f7f5fc] border border-[#e6e1f0]">
        <FlaskConical size={16} className="shrink-0 mt-0.5 text-[#9333ea]" />
        <p className="text-xs font-semibold leading-relaxed text-[#22143a]/75">
          <span className="font-black text-[#7e22ce]">Sample data.</span>{' '}
          {BRAND.product} has no platform-wide API yet — every endpoint today answers
          for one organisation only. The layout, states and calculations below are
          real; the figures are placeholders until{' '}
          <code className="font-mono text-[#7e22ce]">/api/v1/platform/*</code> ships.
        </p>
      </div>

      {/* Welcome Banner */}
      <div className="bg-white border border-[#e6e1f0] rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(21,12,36,0.02)]">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#9333ea] bg-[#9333ea]/10 px-2.5 py-1 rounded">
            Platform Overview
          </span>
          <h2 className="text-2xl lg:text-3xl font-black text-[#150c24] mt-2">
            Welcome, {user?.name || 'Platform Operator'}
          </h2>
          <p className="text-[#22143a]/60 text-sm font-medium mt-1">
            {loading
              ? 'Loading the platform picture…'
              : totals.atRisk > 0
                ? `${totals.organisations} organisations on ${BRAND.product}. ${totals.atRisk} need you today — start with the queues below.`
                : `${totals.organisations} organisations on ${BRAND.product}. Nothing needs attention right now.`}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            className="dd-btn-secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ title, value, caption, icon: Icon }) => (
          <div
            key={title}
            className="bg-white border border-[#e6e1f0] rounded-xl p-5 shadow-[0_2px_8px_rgba(21,12,36,0.02)] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#a79db4]">
                {title}
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#9333ea]/10 text-[#9333ea] flex items-center justify-center shrink-0">
                <Icon size={16} />
              </div>
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="dd-skeleton h-8 w-20" />
              ) : (
                <div className="text-2xl font-black text-[#150c24] tabular-nums">
                  {value}
                </div>
              )}
              <div className="text-[11px] text-[#a79db4] font-medium mt-1.5 leading-snug">
                {caption}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="dd-card">
        <div className="dd-card-header flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div>
            <h3 className="font-bold text-base text-[#150c24]">{TERMS.orgPlural}</h3>
            <p className="text-xs text-[#a79db4] font-medium">
              Who is on {BRAND.product}, how many people they have added and what
              they are paying
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a79db4] pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or industry..."
                aria-label={`Search ${TERMS.orgPlural.toLowerCase()}`}
                className="dd-input dd-input-search py-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Queues: tabs left, counts in the labels. */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {FILTERS.map(({ key, label, match }) => {
            const count = orgs.filter(match).length
            const isActive = filter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={isActive}
                className={`shrink-0 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#9333ea]/10 text-[#9333ea]'
                    : 'text-[#22143a]/60 hover:text-[#150c24] hover:bg-[#f7f5fc]'
                }`}
              >
                {label}
                {!loading && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="dd-table">
            <thead>
              <tr>
                <th>{TERMS.org}</th>
                <th>People added</th>
                <th>Employee seats used</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Setup</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j}>
                        <div
                          className="dd-skeleton h-4"
                          style={{ width: j === 0 ? '70%' : '45%' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                filteredRecords.map((org) => {
                  const usage = seatUsage(org)
                  const meta = stateMeta(org.state)
                  const StateIcon = meta.icon
                  const cap = PLANS[org.plan]?.seats.employee

                  return (
                    <tr key={org.id}>
                      <td>
                        <div>
                          <div className="font-bold text-[#150c24]">{org.name}</div>
                          <div className="text-xs text-[#a79db4]">{org.industry}</div>
                        </div>
                      </td>

                      <td>
                        <div className="font-bold text-[#150c24] tabular-nums">
                          {totalMembers(org).toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-[#a79db4]">
                          {org.members.employee} staff · {org.members.manager} mgr ·{' '}
                          {org.members.hr} HR
                        </div>
                      </td>

                      <td>
                        {/* Unlimited is "Unlimited", never a dash and never 0. */}
                        {usage == null ? (
                          <span className="text-xs font-semibold text-[#22143a]/70">
                            Unlimited
                          </span>
                        ) : (
                          <div className="min-w-[120px]">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-bold text-[#22143a] tabular-nums">
                                {org.members.employee} of {cap}
                              </span>
                              <span
                                className={`text-[11px] font-bold tabular-nums ${
                                  usage >= 0.85 ? 'text-[#7e22ce]' : 'text-[#a79db4]'
                                }`}
                              >
                                {asPercent(usage)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden bg-[#e6e1f0]">
                              <div
                                className={`h-full rounded-full ${
                                  usage >= 0.85 ? 'bg-[#7e22ce]' : 'bg-[#9333ea]'
                                }`}
                                style={{ width: asPercent(Math.min(usage, 1)) }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="text-xs font-semibold text-[#22143a]">
                          {PLANS[org.plan]?.label || 'N/A'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`dd-badge ${meta.badge} flex items-center gap-1 w-fit`}
                          title={meta.hint}
                        >
                          <StateIcon size={12} />
                          {meta.label}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            org.setupPercent < 80 ? 'text-[#7e22ce]' : 'text-[#a79db4]'
                          }`}
                        >
                          {org.setupPercent}%
                        </span>
                      </td>
                    </tr>
                  )
                })}

              {!loading && filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-10">
                    <p className="text-sm font-bold text-[#22143a]">
                      No organisations in this view.
                    </p>
                    <p className="text-xs text-[#a79db4] font-medium mt-1">
                      {searchTerm
                        ? `Nothing matches “${searchTerm}”. Try a different search, or clear it.`
                        : 'Nothing is in this queue — which is the result you want.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRecords.length > 0 && (
          <div
            className="px-5 py-3 border-t bg-[#f7f5fc]"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-[11px] font-semibold text-[#a79db4]">
              Showing {filteredRecords.length} of {orgs.length}{' '}
              {TERMS.orgPlural.toLowerCase()}. Opening an organisation arrives with
              the Organisations section.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
