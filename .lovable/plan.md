

## Problem

The agent blocking logic has a gap: when `getUserAgents` returns an empty array (no linked agents found for the user), the condition `allAgents.length === 0` evaluates to `true`, which means `hasActiveAgent = true` and the user is **not blocked**. This defeats the purpose.

Additionally, the check only happens in the layouts (`MainLayout` and `AdvLayout`) after login succeeds, but the user still sees the dashboard momentarily while agents load.

## Root Cause

The condition:
```ts
const hasActiveAgent = allAgents.length === 0 || allAgents.some(a => a.status === true);
```

The `allAgents.length === 0` clause was added as a safety net so users without any agents aren't locked out, but it creates a loophole for users whose agent data isn't returned.

## Plan

### 1. Fix the blocking logic in MainLayout and AdvLayout

Change the condition to: if a non-admin user has `cod_agent` set (meaning they are associated with an agent), they **must** have at least one active agent to proceed. If they have no agents returned but have a `cod_agent`, they should be blocked.

```ts
if (!isAdmin && !agentsLoading && agentsData) {
  const allAgents = [...agentsData.myAgents, ...agentsData.monitoredAgents];
  // If user has a cod_agent but no active agents found, block them
  if (allAgents.length > 0 && !allAgents.some(a => a.status === true)) {
    return <AgentBlockedScreen />;
  }
  // If user has cod_agent but no agents returned at all, also block
  if (allAgents.length === 0 && user?.cod_agent) {
    return <AgentBlockedScreen />;
  }
}
```

This ensures:
- Admin users always pass through
- Users with no `cod_agent` (e.g. pure admin/office staff) are not blocked
- Users linked to an agent are blocked if all their agents are inactive or no agents are found

### Files to modify
- `src/components/layout/MainLayout.tsx` — update blocking condition
- `src/components/layout/AdvLayout.tsx` — update blocking condition

