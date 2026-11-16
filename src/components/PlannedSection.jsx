// ─────────────────────────────────────────────────────────────────────────────
// PlannedSection.jsx — what a sidebar section shows before it is built.
//
// This replaces the old "this workspace is clean and ready for your APIs"
// card, which told the operator nothing. A section that does not exist yet is
// listed on purpose (see navigation.js), so it says what it will do and where
// that is specified. Someone reading it should be able to tell whether the
// thing they came for is coming, and roughly what it will look like.
// ─────────────────────────────────────────────────────────────────────────────

import { Hammer, FileText, Check } from 'lucide-react'
import { BRAND } from '../config/brand'

export default function PlannedSection({ item }) {
  const { label, icon: Icon = Hammer, summary, willDo = [], plan } = item

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full dd-fade-in">
      <div className="bg-white border border-[#e6e1f0] rounded-2xl p-8 shadow-[0_2px_12px_rgba(21,12,36,0.02)]">
        <div className="w-11 h-11 rounded-xl bg-[#9333ea]/10 text-[#9333ea] flex items-center justify-center">
          <Icon size={21} />
        </div>

        <div className="flex items-center gap-2.5 mt-5 flex-wrap">
          {/* Same string as the sidebar label and the top bar title. */}
          <h2 className="text-2xl font-black text-[#150c24]">{label}</h2>
          <span className="dd-badge dd-badge-neutral">Not built yet</span>
        </div>

        <p className="text-[#22143a]/60 text-sm font-medium mt-2 leading-relaxed">
          {summary}
        </p>

        {willDo.length > 0 && (
          <div className="mt-7">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#a79db4]">
              What will live here
            </p>
            <ul className="mt-3 space-y-2.5">
              {willDo.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <Check size={15} className="shrink-0 mt-0.5 text-[#9333ea]" />
                  <span className="text-[13px] font-semibold text-[#22143a] leading-relaxed">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 p-4 rounded-xl bg-[#f7f5fc] border border-[#e6e1f0] flex flex-wrap items-center gap-x-2 gap-y-1">
          <FileText size={14} className="text-[#a79db4]" />
          <span className="text-xs font-semibold text-[#a79db4]">Specified in</span>
          <code className="text-xs font-bold font-mono text-[#7e22ce]">
            docs/CONTROL_PLANE_VISION.md{plan ? ` ${plan}` : ''}
          </code>
          <span className="text-xs font-semibold text-[#a79db4]">
            — the {BRAND.console} roadmap.
          </span>
        </div>
      </div>
    </div>
  )
}
