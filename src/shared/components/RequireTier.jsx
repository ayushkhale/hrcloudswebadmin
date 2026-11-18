// ─────────────────────────────────────────────────────────────────────────────
// RequireTier.jsx — the route-level half of the tier gate.
//
// Hiding a menu row hides the door, not the room: a URL typed, bookmarked or
// pasted from a colleague's message reaches the screen anyway. This is what
// stands in front of it.
//
// It is NOT a security control and must never be the only thing between a
// person and a capability — the server enforces every tier itself, on every
// request, and would refuse the reads behind this page regardless. What this
// prevents is the worse user experience: a screen that mounts, fires its read,
// and resolves into a wall of error cards, when the honest answer was knowable
// before it rendered a single pixel.
//
// Not a redirect, either. Silently bouncing someone to the Overview leaves
// them wondering whether they mistyped the address. Say what happened.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from "react-router-dom";
import { HiLockClosed } from "react-icons/hi";

import ConsoleTopBar from "./ConsoleTopBar";
import Card from "./Card";
import { EmptyState } from "./States";
import { useAuth } from "../contexts/AuthContext";
import { DICTIONARY } from "../../config/dictionary";

export default function RequireTier({ tier, title = "Restricted", children }) {
  const { can } = useAuth();
  if (can(tier)) return children;

  return (
    <>
      <ConsoleTopBar title={title} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <Card>
          <EmptyState
            icon={HiLockClosed}
            title={DICTIONARY.ACCESS.ABOVE_YOUR_LEVEL}
            hint={DICTIONARY.ACCESS.ASK_FOR_ACCESS}
            action={
              <Link
                to="/console"
                className="inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
              >
                Back to the Overview
              </Link>
            }
          />
        </Card>
      </main>
    </>
  );
}
