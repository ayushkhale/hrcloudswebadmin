// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle.jsx — where the theme gets chosen, in the one shape.
//
// Two variants, because the control appears in two places that can't take the
// same thing, and a one-off copy on either would drift:
//
//   variant="segmented"  three labelled options — used in the account menu,
//                        where there is room to say what the choice is.
//   variant="icon"       one button that cycles — used on the sign-in screen,
//                        which has no menu to put a list inside.
//
// WHY THE SEGMENTED ONE IS NOT A SWITCH: a switch has two positions and this
// choice has three. A switch would have to drop "System", which is the
// default and the one most people want.
//
// The cycling button shows the icon of the theme you are IN and says what the
// next press does, so it is never ambiguous which half of a toggle you are
// looking at.
// ─────────────────────────────────────────────────────────────────────────────
import { HiDesktopComputer, HiMoon, HiSun } from "react-icons/hi";

import { DICTIONARY } from "../../config/dictionary";
import { useTheme } from "../contexts/ThemeContext";

const OPTIONS = [
  { value: "light", label: DICTIONARY.THEME.LIGHT, icon: HiSun },
  { value: "dark", label: DICTIONARY.THEME.DARK, icon: HiMoon },
  { value: "system", label: DICTIONARY.THEME.SYSTEM, icon: HiDesktopComputer },
];

export default function ThemeToggle({ variant = "segmented", className = "" }) {
  const { theme, isDark, setTheme } = useTheme();

  if (variant === "icon") {
    const next = OPTIONS[(OPTIONS.findIndex((o) => o.value === theme) + 1) % OPTIONS.length];
    const Current = theme === "system" ? HiDesktopComputer : isDark ? HiMoon : HiSun;
    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        title={`${DICTIONARY.THEME.LABEL}: ${OPTIONS.find((o) => o.value === theme)?.label}`}
        aria-label={`${DICTIONARY.THEME.LABEL}. Switch to ${next.label.toLowerCase()}`}
        className={`p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-200 dark:text-slate-400 dark:hover:text-purple-300 dark:hover:bg-night-800 dark:focus-visible:ring-purple-500/40 ${className}`}
      >
        <Current className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={className}>
      <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">
        {DICTIONARY.THEME.LABEL}
      </p>
      <div
        role="radiogroup"
        aria-label={DICTIONARY.THEME.LABEL}
        className="mx-3 flex items-center gap-1 p-1 rounded-xl bg-slate-50 border border-slate-100 dark:bg-night-900 dark:border-night-700"
      >
        {OPTIONS.map((option) => {
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              // The hint sits here rather than on screen: "System" is three
              // words of explanation that only matter while you're choosing.
              title={option.value === "system" ? DICTIONARY.THEME.SYSTEM_HINT : option.label}
              onClick={() => setTheme(option.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-200 dark:focus-visible:ring-purple-500/40 ${
                selected
                  ? "bg-white text-purple-700 shadow-sm dark:bg-night-800 dark:text-purple-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <option.icon className="w-4 h-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
