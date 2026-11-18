// ─────────────────────────────────────────────────────────────────────────────
// organisations.api.js — Phases 3 and 4. Every customer on HR Clouds, what
// they are on, and the four things platform staff may do to that.
//
// Endpoints #289–#295. Real, on the backend, behind `/api/v1/platform`.
//
// Three contract details that are load-bearing and easy to lose:
//
//   1. `unavailable: []` on the detail read (#290). Every panel but the
//      organisation row is fetched best-effort, and whatever failed is NAMED
//      there. The screen renders those panels as "didn't load" and the other
//      nine normally. Failing the whole page because the audit log timed out
//      would take the record away from an operator with the customer on the
//      phone.
//
//   2. `expected_subscription_id` on #292 and #293 is optimistic locking, and
//      `null` is a LEGAL VALUE meaning "I believe this organisation has no
//      subscription". So it has to be sent as an explicit key — dropping it
//      because it is null turns the guard off, and the whole point of the
//      guard is that a plan override can't land on a subscription that was
//      replaced while the dialog was open.
//
//   3. A conflict is retried ONCE, and only the two codes that mean "somebody
//      beat you by half a second". STALE_SUBSCRIPTION is never retried — see
//      `withConflictRetry`.
// ─────────────────────────────────────────────────────────────────────────────
import { request, qs } from "./client";
import { ENV } from "../../config/env";
import { buildOrgDetail, SAMPLE_ORGS, SAMPLE_PLANS } from "../../data/samplePlatform";
import { shouldRetry } from "../../config/platformMeta";

const settle = (value, ms = 450) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

/**
 * Run a write, and if the server says another request was already in flight
 * against the same row, try the same call exactly once more.
 *
 * Once, not in a loop: two operators clicking at the same moment is a race
 * worth absorbing, but a server that keeps reporting a conflict is reporting
 * something real, and a retry loop would hammer it while telling the operator
 * nothing.
 *
 * `shouldRetry` is true only for STAFF_CHANGE_IN_PROGRESS and
 * ORG_STATUS_CHANGE_CONFLICT. STALE_SUBSCRIPTION deliberately falls through
 * to the caller: it means the record moved under us, so repeating the write
 * would apply it to a subscription that is no longer the one the operator
 * looked at.
 */
async function withConflictRetry(call) {
  try {
    return await call();
  } catch (err) {
    if (!shouldRetry(err?.code)) throw err;
    return call();
  }
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

function normaliseOrgRow(row) {
  if (!row) return null;
  const usage = row.usage || {};
  const plan = row.plan || null;
  const contact = row.primary_contact || null;

  return {
    id: row.id,
    name: row.name,
    key: row.key ?? null,
    // Only ever `active`, `inactive` or `suspended`. See ORG_STATE.
    status: row.status,
    createdAt: row.created_at ?? null,
    industry: row.industry ?? null,
    size: row.size ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          maxEmployees: plan.max_employees ?? null,
          currentPeriodEnd: plan.current_period_end ?? null,
          subscriptionStatus: plan.subscription_status ?? null,
          // True when platform staff granted this rather than the customer
          // paying for it. An operator must be able to see that at a glance
          // before they wonder why a customer is on enterprise for free.
          isOverride: Boolean(plan.is_override),
        }
      : null,
    usage: {
      // null means the COUNT failed, and it must survive as null all the way
      // to the screen. Defaulting it to 0 here would be the end of the story.
      activeEmployees: usage.active_employees ?? null,
      seatLimit: usage.seat_limit ?? null,
      quotaPercent: usage.quota_utilization_percent ?? null,
    },
    contact: contact
      ? {
          name: contact.name ?? null,
          // An HR identified by phone has NO email. Keying the contact off
          // `email` alone hides a real person from the operator trying to
          // reach them, so the identifier is carried as its own fact.
          email: contact.email ?? null,
          identifier: contact.identifier ?? contact.email ?? contact.phone ?? null,
          identifierType: contact.identifier_type ?? null,
          phone: contact.phone ?? null,
        }
      : null,
  };
}

function normaliseDetail(data) {
  if (!data) return null;
  const org = data.organization || data.organisation || null;
  const sub = data.subscription || null;

  return {
    org: org
      ? { id: org.id, name: org.name, key: org.key ?? null, status: org.status, createdAt: org.created_at ?? null }
      : null,
    profile: data.profile
      ? {
          industry: data.profile.industry ?? null,
          size: data.profile.size ?? null,
          city: data.profile.city ?? null,
          state: data.profile.state ?? null,
          logoUrl: data.profile.logo_url ?? null,
          pan: data.profile.pan_number ?? null,
          gst: data.profile.gst_number ?? null,
        }
      : null,
    subscription: sub
      ? {
          id: sub.id ?? null,
          // `is_live` and `status` are not the same question: a cancelled
          // subscription that still runs to the end of a paid period is not
          // live for billing but is very much live for the customer.
          isLive: sub.is_live !== false,
          status: sub.status ?? null,
          isOverride: Boolean(sub.is_override),
          plan: sub.plan
            ? { code: sub.plan.code, name: sub.plan.name, amount: sub.plan.amount ?? null, currency: sub.plan.currency ?? "INR", billingCycle: sub.plan.billing_cycle ?? null }
            : null,
          currentPeriodStart: sub.current_period_start ?? null,
          currentPeriodEnd: sub.current_period_end ?? null,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          limits: sub.limits
            ? { maxEmployees: sub.limits.max_employees ?? null, maxManagers: sub.limits.max_managers ?? null, maxHrs: sub.limits.max_hrs ?? null }
            : null,
          featureKeys: sub.feature_keys || [],
        }
      : null,
    usage: data.usage
      ? {
          activeEmployees: data.usage.active_employees ?? null,
          seatLimit: data.usage.seat_limit ?? null,
          quotaPercent: data.usage.quota_utilization_percent ?? null,
        }
      : null,
    setup: data.setup
      ? {
          completedSteps: data.setup.completed_steps ?? null,
          totalSteps: data.setup.total_steps ?? null,
          percent: data.setup.percent ?? null,
          pending: data.setup.pending || [],
        }
      : null,
    // The server compares the limits SNAPSHOT taken when the subscription was
    // created against the plan's current limits. `drifted` means the plan was
    // edited underneath a live customer, which is a thing somebody needs to
    // know before they debug why a customer can't add their 101st employee.
    limitsAudit: data.limits_audit
      ? { drifted: Boolean(data.limits_audit.drifted), snapshot: data.limits_audit.snapshot || null, current: data.limits_audit.current || null }
      : null,
    subscriptionEvents: (data.recent_subscription_events || []).map((e) => ({
      id: e.id, type: e.type, at: e.at ?? e.created_at ?? null, note: e.note ?? null,
    })),
    auditLogs: (data.recent_audit_logs || []).map((l) => ({
      id: l.id, action: l.action, actor: l.actor ?? null, at: l.at ?? l.created_at ?? null, reason: l.reason ?? null,
    })),
    // The panels the server could not build. A panel named here is "didn't
    // load"; a panel that is null and NOT named here is genuinely empty.
    unavailable: data.unavailable || [],
  };
}

// ─── #289 / #290 Reads ───────────────────────────────────────────────────────

/**
 * `GET /platform/organizations` — the directory.
 *
 * Searched, filtered and paged on the server. The console never pulls the
 * whole table down to filter it in the browser: the organisation table is the
 * one thing in this product guaranteed to grow forever.
 */
export async function listOrgs({ query, status, planCode, page = 1, limit = 20, signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/organizations${qs({ search: query, status, plan_code: planCode, page, limit })}`, { signal });
    const payload = res?.data ?? res;
    const rows = payload?.organizations || payload?.rows || payload?.items || [];
    return {
      rows: rows.map(normaliseOrgRow),
      page: payload?.pagination?.page ?? page,
      total: payload?.pagination?.total ?? rows.length,
      totalPages: payload?.pagination?.total_pages ?? 1,
    };
  }

  const needle = (query || "").trim().toLowerCase();
  const all = SAMPLE_ORGS.map(normaliseOrgRow).filter((org) => {
    if (status && org.status !== status) return false;
    if (planCode && org.plan?.code !== planCode) return false;
    if (needle && !`${org.name} ${org.key || ""} ${org.city || ""} ${org.industry || ""} ${org.contact?.identifier || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const start = (page - 1) * limit;
  return settle({
    rows: all.slice(start, start + limit),
    page,
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  });
}

/** `GET /platform/organizations/:orgId` (#290) — one organisation, ten panels. */
export async function getOrg({ orgId, signal }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/organizations/${encodeURIComponent(orgId)}`, { signal });
    return normaliseDetail(res?.data ?? res);
  }
  const row = SAMPLE_ORGS.find((o) => o.id === orgId);
  if (!row) {
    const err = new Error("No organisation with that id.");
    err.status = 404;
    throw err;
  }
  return settle(normaliseDetail(buildOrgDetail(row)), 520);
}

/** The plans an override may grant. Private plans included — that is the point. */
export async function listPlans({ signal } = {}) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request("/platform/plans", { signal });
    const payload = res?.data ?? res;
    const rows = payload?.plans || payload?.rows || (Array.isArray(payload) ? payload : []);
    return rows.map((p) => ({
      code: p.code, name: p.name, amount: p.amount ?? null, currency: p.currency ?? "INR",
      billingCycle: p.billing_cycle ?? null, maxEmployees: p.max_employees ?? null,
      isActive: p.is_active !== false, isPrivate: Boolean(p.is_private),
    }));
  }
  return settle(
    SAMPLE_PLANS.map((p) => ({
      code: p.code, name: p.name, amount: p.amount, currency: p.currency,
      billingCycle: p.billing_cycle, maxEmployees: p.max_employees,
      isActive: p.is_active, isPrivate: p.is_private,
    })),
    300,
  );
}

// ─── #291 Status ─────────────────────────────────────────────────────────────

/**
 * `PATCH /platform/organizations/:orgId/status` — suspend, or switch back on.
 *
 * This is the heaviest button in the console: suspending an organisation locks
 * every single person at that company out of HR Clouds, mid-working-day. It
 * takes a reason, it is confirmed by name, and it is retried once on a
 * conflict because two operators reacting to the same escalation is a normal
 * Tuesday.
 *
 * `changed: false` means it was already in that state. That is a success with
 * nothing to report, and saying "Suspended" to an operator whose click did
 * nothing is worse than saying so.
 */
export async function setOrgStatus({ orgId, status, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    return withConflictRetry(async () => {
      const res = await request(`/platform/organizations/${encodeURIComponent(orgId)}/status`, {
        method: "PATCH",
        body: { status, reason },
      });
      const data = res?.data ?? res;
      return { changed: data?.changed !== false, status: data?.status ?? status };
    });
  }
  // Sample mode writes back to the in-memory row. Without this the console
  // says "Nimbus Logistics is suspended" and then redraws it as active, which
  // makes a working write look broken to anyone evaluating the screen before
  // the backend is wired up. The mutation dies with the page reload, which is
  // the right lifetime for a stand-in.
  const row = SAMPLE_ORGS.find((o) => o.id === orgId);
  const changed = Boolean(row) && row.status !== status;
  if (row) row.status = status;
  return settle({ changed, status }, 650);
}

// ─── #292 / #293 Money ───────────────────────────────────────────────────────

/**
 * `POST /platform/organizations/:orgId/subscription/override` (#292) — put an
 * organisation on a plan without a payment.
 *
 * `expectedSubscriptionId` is sent as an explicit key EVERY time, including
 * when it is null. Null is the operator asserting "this organisation has no
 * subscription"; leaving the key out instead is asserting nothing, which
 * switches off the check that stops this write landing on a subscription that
 * was created while the dialog was open.
 */
export async function grantPlanOverride({ orgId, planCode, expectedSubscriptionId = null, durationDays, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/organizations/${encodeURIComponent(orgId)}/subscription/override`, {
      method: "POST",
      body: {
        plan_code: planCode,
        // Explicit, never conditional. See above.
        expected_subscription_id: expectedSubscriptionId,
        duration_days: durationDays ? Number(durationDays) : undefined,
        reason,
      },
    });
    const data = res?.data ?? res;
    return { changed: data?.changed !== false, subscriptionId: data?.subscription_id ?? null };
  }
  // Same reason as `setOrgStatus`: the stand-in has to agree with the toast.
  const row = SAMPLE_ORGS.find((o) => o.id === orgId);
  const plan = SAMPLE_PLANS.find((p) => p.code === planCode);
  const changed = Boolean(row) && row.plan?.code !== planCode;
  if (row && plan) {
    row.plan = {
      code: plan.code,
      name: plan.name,
      max_employees: plan.max_employees,
      current_period_end: row.plan?.current_period_end ?? null,
      subscription_status: "active",
      // Granted by staff, not paid for — the whole point of an override, and
      // the flag the directory row prints.
      is_override: true,
    };
    row.usage.seat_limit = plan.max_employees;
  }
  return settle({ changed, subscriptionId: "sub_sample_override" }, 750);
}

/**
 * `PATCH /platform/organizations/:orgId/subscription/seats` (#293) — move the
 * seat ceiling without changing the plan.
 *
 * The server refuses a ceiling below the headcount already in use
 * (SEAT_LIMIT_BELOW_USAGE), which is the right behaviour and also why the
 * dialog prints the current headcount beside the field.
 */
export async function setSeatQuota({ orgId, maxEmployees, expectedSubscriptionId = null, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/organizations/${encodeURIComponent(orgId)}/subscription/seats`, {
      method: "PATCH",
      body: {
        // null here means "no ceiling", which is a real thing an operator
        // grants. It is not the same as not sending the field.
        max_employees: maxEmployees === null || maxEmployees === "" ? null : Number(maxEmployees),
        expected_subscription_id: expectedSubscriptionId,
        reason,
      },
    });
    const data = res?.data ?? res;
    return { changed: data?.changed !== false };
  }
  const row = SAMPLE_ORGS.find((o) => o.id === orgId);
  const next = maxEmployees === null || maxEmployees === "" ? null : Number(maxEmployees);
  const changed = Boolean(row) && row.usage.seat_limit !== next;
  if (row) {
    row.usage.seat_limit = next;
    if (row.plan) row.plan.max_employees = next;
    // Recomputed rather than left stale, so the bar on the directory row
    // moves with the number that was just changed.
    row.usage.quota_utilization_percent =
      next && row.usage.active_employees != null ? Math.round((row.usage.active_employees / next) * 1000) / 10 : null;
  }
  return settle({ changed }, 700);
}

// ─── #294 / #295 Provisioning ────────────────────────────────────────────────

/**
 * `POST /platform/organizations` (#294) — create a customer directly.
 *
 * For a signed deal that is not going to come through self-serve signup. It
 * creates the organisation, optionally puts it on a plan, and optionally
 * invites its first HR in the same call.
 *
 * Like #283, the HR's `activation_link` comes back ONCE. The screen shows it
 * with a copy button rather than relying on the email, because a bounced
 * invitation on a brand new enterprise customer is a bad first day.
 */
export async function provisionOrg({ name, key, planCode, seatLimit, hrIdentifier, hrFirstName, hrLastName, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request("/platform/organizations", {
      method: "POST",
      body: {
        name,
        key: key || undefined,
        plan_code: planCode || undefined,
        max_employees: seatLimit === "" || seatLimit === null || seatLimit === undefined ? undefined : Number(seatLimit),
        hr_identifier: hrIdentifier || undefined,
        hr_first_name: hrFirstName || undefined,
        hr_last_name: hrLastName || undefined,
        reason,
      },
    });
    return normaliseProvision(res?.data ?? res);
  }
  return settle(
    normaliseProvision({
      organization: { id: "550e8400-0099-4a1b-9f3e-000000000099", name, key: key || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) },
      subscription_id: planCode ? "sub_sample_new" : null,
      hr_invitation: hrIdentifier
        ? { sent: true, email_delivered: false, activation_link: `${window.location.origin}/platform/accept-invite?token=sample-hr-token` }
        : null,
    }),
    900,
  );
}

function normaliseProvision(data) {
  if (!data) return null;
  const org = data.organization || data.organisation || null;
  const invite = data.hr_invitation || null;
  return {
    org: org ? { id: org.id, name: org.name, key: org.key ?? null } : null,
    subscriptionId: data.subscription_id ?? null,
    invitation: invite
      ? { sent: Boolean(invite.sent), emailDelivered: invite.email_delivered ?? null, activationLink: invite.activation_link ?? null }
      : null,
  };
}

/**
 * `POST /platform/organizations/:orgId/hr-invitation` (#295) — the recovery
 * path for an organisation whose first HR never got in.
 *
 * It exists because #294 can half-succeed: the organisation is created, the
 * invitation email bounces, and the customer is left with an account nobody
 * can open. Without this the only fix is a database edit.
 */
export async function resendHrInvitation({ orgId, identifier, firstName, lastName, reason }) {
  if (!ENV.USE_SAMPLE_DATA) {
    const res = await request(`/platform/organizations/${encodeURIComponent(orgId)}/hr-invitation`, {
      method: "POST",
      body: {
        identifier: identifier || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        reason,
      },
    });
    const data = res?.data ?? res;
    return {
      sent: data?.sent !== false,
      emailDelivered: data?.email_delivered ?? null,
      activationLink: data?.activation_link ?? null,
    };
  }
  return settle(
    { sent: true, emailDelivered: false, activationLink: `${window.location.origin}/platform/accept-invite?token=sample-hr-resend` },
    800,
  );
}

export const orgsAPI = {
  listOrgs,
  getOrg,
  listPlans,
  setOrgStatus,
  grantPlanOverride,
  setSeatQuota,
  provisionOrg,
  resendHrInvitation,
};
