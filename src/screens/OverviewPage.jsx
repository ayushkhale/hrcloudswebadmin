// ─────────────────────────────────────────────────────────────────────────────
// OverviewPage.jsx — the first screen, and the answer to "how is HR Clouds
// doing today".
//
// ONE READ. `platformAPI.getOverview()` returns every figure on this page, so
// there is one loading state, one error state, and no chance of the tiles
// disagreeing with the list underneath them. If a new card needs a number,
// the number joins that one response — it does not get a fetch of its own.
//
// Nothing is said twice. The tiles carry the totals; the cards below carry
// what you'd click into. A "Needs attention" row does not repeat the figures
// already on a tile, it says what is wrong and who with.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HiArrowRight,
  HiCash,
  HiExclamationCircle,
  HiOfficeBuilding,
  HiSparkles,
  HiUserGroup,
} from "react-icons/hi";

import PageHeader from "../shared/components/PageHeader";
import ConsoleTopBar from "../shared/components/ConsoleTopBar";
import Card, { CardHeader } from "../shared/components/Card";
import StatTile from "../shared/components/StatTile";
import StatusPill, { OrgMark } from "../shared/components/StatusPill";
import { EmptyState, ErrorState } from "../shared/components/States";
import { SkeletonCard, SkeletonRows, SkeletonTiles } from "../shared/components/Skeleton";
import { platformAPI } from "../shared/api";
import { DICTIONARY } from "../config/dictionary";
import { useTheme } from "../shared/contexts/ThemeContext";
import { formatCount, formatMoney, timeAgo } from "../shared/utils/format";

/**
 * Three shades of the one brand colour, per theme. No second hue enters a
 * chart in either of them.
 *
 * The dark set is shifted two steps lighter rather than reused: `#7E22CE` is
 * a strong colour on white and nearly invisible on `night-850`, so the light
 * triad on a dark card loses its darkest slice altogether — which is a chart
 * that silently under-reports one plan.
 */
const PLAN_COLORS = {
  light: ["#D8B4FE", "#A855F7", "#7E22CE"],
  dark: ["#E9D5FF", "#C084FC", "#9333EA"],
};

/**
 * Everything Recharts takes as a prop rather than a class. A chart cannot be
 * themed with `dark:`, so these come from the theme hook instead — and they
 * live here, in one object per theme, so a new chart on this screen cannot
 * pick its own grey.
 */
const CHART = {
  light: {
    grid: "#f1f5f9",
    tick: "#94a3b8",
    bar: "#7E22CE",
    cursor: "#faf5ff",
    tooltip: {
      borderRadius: 12,
      border: "1px solid #f1f5f9",
      fontSize: 12,
      fontWeight: 600,
      boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
    },
    tooltipLabel: { color: "#334155", fontWeight: 700 },
  },
  dark: {
    grid: "#2A2338",
    tick: "#94a3b8",
    bar: "#A855F7",
    cursor: "rgba(168,85,247,0.12)",
    tooltip: {
      borderRadius: 12,
      border: "1px solid #3A3150",
      // Recharts paints the tooltip white inline, so the dark one has to say
      // its own background or the text lands white-on-white.
      backgroundColor: "#201B2C",
      color: "#e2e8f0",
      fontSize: 12,
      fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    },
    tooltipLabel: { color: "#e2e8f0", fontWeight: 700 },
  },
};

export default function OverviewPage() {
  const { isDark } = useTheme();
  const chart = isDark ? CHART.dark : CHART.light;
  const planColors = isDark ? PLAN_COLORS.dark : PLAN_COLORS.light;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    platformAPI
      .getOverview({ signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setData(res);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // Returned so the effect can cancel it — a response that lands after the
    // screen is gone must not call setState on an unmounted tree.
    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  return (
    <>
      <ConsoleTopBar title={DICTIONARY.HEADERS.OVERVIEW} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
        <PageHeader
          badgeText="PLATFORM CONSOLE"
          badgeIcon={HiSparkles}
          title="How HR Clouds is doing"
          subtitle="Every organisation, their people, and what they pay."
        />

        {error ? (
          <Card>
            <ErrorState error={error} onRetry={load} fallback="Couldn’t load the overview." />
          </Card>
        ) : loading ? (
          <>
            <SkeletonTiles count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2">
                <SkeletonCard height="h-64" />
              </div>
              <SkeletonCard height="h-64" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <SkeletonRows rows={4} />
              </Card>
              <Card>
                <SkeletonRows rows={4} />
              </Card>
            </div>
          </>
        ) : (
          <>
            {/* ── The four numbers ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                icon={HiOfficeBuilding}
                label={DICTIONARY.TERMS.ORGANISATIONS}
                value={formatCount(data.totals.organisations)}
                note={`${data.totals.onTrial} on trial`}
              />
              <StatTile
                icon={HiUserGroup}
                label="People"
                value={formatCount(data.totals.people)}
                note="Across all payrolls"
                tone="violet"
              />
              <StatTile
                icon={HiCash}
                label={DICTIONARY.TERMS.MRR}
                value={formatMoney(data.totals.mrr)}
                note={`${formatMoney(data.totals.mrr * 12)} a year`}
                tone="indigo"
              />
              <StatTile
                icon={HiExclamationCircle}
                label="Needs attention"
                value={formatCount(data.attention.length)}
                note={data.totals.atRisk > 0 ? `${data.totals.atRisk} not paying` : "Nothing overdue"}
                tone={data.attention.length > 0 ? "rose" : "purple"}
              />
            </div>

            {/* ── Growth, and who is on what ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
              <Card className="lg:col-span-2 flex flex-col">
                <CardHeader title={DICTIONARY.HEADERS.SIGNUPS} subtitle={DICTIONARY.DESCRIPTIONS.SIGNUPS} />
                <div className="flex-1 min-h-[16rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.signups} margin={{ top: 8, right: 0, left: -24, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: chart.tick, fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: chart.tick, fontSize: 10, fontWeight: 600 }}
                      />
                      <Tooltip
                        cursor={{ fill: chart.cursor }}
                        contentStyle={chart.tooltip}
                        labelStyle={chart.tooltipLabel}
                        formatter={(value) => [value, "Joined"]}
                      />
                      <Bar dataKey="organisations" fill={chart.bar} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="flex flex-col">
                <CardHeader title={DICTIONARY.HEADERS.PLAN_MIX} subtitle={DICTIONARY.DESCRIPTIONS.PLAN_MIX} />
                <div className="flex-1 min-h-[11rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.planMix}
                        dataKey="organisations"
                        nameKey="tier"
                        innerRadius="58%"
                        outerRadius="86%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {data.planMix.map((slice, i) => (
                          <Cell key={slice.tier} fill={planColors[i % planColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chart.tooltip} formatter={(value, name) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* The legend carries the counts, so nobody has to hover a
                    slice to read a number that fits on screen anyway. */}
                <ul className="mt-4 space-y-2">
                  {data.planMix.map((slice, i) => (
                    <li key={slice.tier} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: planColors[i % planColors.length] }}
                      />
                      {slice.tier}
                      <span className="ml-auto tabular-nums text-slate-800 font-bold dark:text-slate-100">
                        {slice.organisations}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* ── Who needs a person, and who is biggest ────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
              <Card>
                <CardHeader
                  title={DICTIONARY.HEADERS.NEEDS_ATTENTION}
                  subtitle={DICTIONARY.DESCRIPTIONS.NEEDS_ATTENTION}
                />
                {data.attention.length === 0 ? (
                  <EmptyState title={DICTIONARY.EMPTY.NEEDS_ATTENTION} hint="Every organisation is paid up and active." />
                ) : (
                  <ul className="divide-y divide-slate-50 dark:divide-night-700">
                    {data.attention.map(({ org, reason }) => (
                      <li key={org.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <OrgMark name={org.name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">{org.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500 truncate dark:text-slate-400">{reason}</p>
                        </div>
                        <StatusPill status={org.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader
                  title={DICTIONARY.HEADERS.BIGGEST_ORGS}
                  subtitle={DICTIONARY.DESCRIPTIONS.BIGGEST_ORGS}
                  action={
                    <span
                      title="The full list is being built"
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 cursor-default dark:text-slate-600"
                    >
                      See all <HiArrowRight className="w-3.5 h-3.5" />
                    </span>
                  }
                />
                <ul className="divide-y divide-slate-50 dark:divide-night-700">
                  {data.biggest.map((org) => (
                    <li key={org.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <OrgMark name={org.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate dark:text-slate-100">{org.name}</p>
                        {/* Last active, not the city: a console reads for
                            signs of life, and the city is on the record page. */}
                        <p className="text-[11px] font-semibold text-slate-500 truncate dark:text-slate-400">
                          Active {timeAgo(org.lastActive)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-800 tabular-nums shrink-0 dark:text-slate-100">
                        {formatCount(org.employees)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
