# 49 North — Life Command Interface

This document defines the narrow interface intended for Life Command / Diana. Existing internal Netlify functions remain implementation details.

## Authentication

Every `command*` endpoint requires a valid Netlify Identity user token, supplied as either:

- `Authorization: Bearer <token>` (preferred for Life Command), or
- `X-App-Token: <token>` (compatibility with the current 49 North UI).

Use `GET /.netlify/functions/commandAuthCheck` to verify authentication before issuing commands.

## Mental Armor Mission reads

### `GET commandMentalArmorBrief`
Primary mission-level briefing endpoint. Returns a compact operational snapshot containing:

- dashboard summary
- active / Respond / Gather More Information / Submitted / Disregarded bid counts
- active bids due within seven days
- webinar and weekly social reminder status
- Executive Assistant tasks
- system-administration email counts
- degraded-source warnings when one underlying read fails

### `GET commandGetDashboardData`
Protected access to the existing dashboard data source.

### `GET commandGetBids`
Protected access to bid records.

### `GET commandGetReminders`
Protected access to reminder data. Pass `includeExecutiveTasks=1` when Executive Assistant tasks are required.

### `GET commandGetSystemAdminEmails`
Protected access to system-administration email records.

## Mental Armor Mission actions

### `POST commandUpdateBidStatus`
Protected delegate to the existing bid status workflow. Supports the same payload as `updateBidStatus`.

Recommended Life Command authority:

- `respond`: execute on explicit user command
- `submitted`: confirm if submission status has consequential reporting implications
- `disregard`: execute on explicit user command; retain auditability
- `system-admin`: execute on explicit user command

### `POST commandCreateReminder`
Creates an Executive Assistant reminder using existing 49 North reminder logic.

### `POST commandDeleteBidSystem`
Destructive operation. Life Command should always require explicit confirmation before calling this endpoint.

## Architectural rule

Life Command should call only `command*` endpoints. It should not couple directly to Google Sheets, legacy functions, or 49 North frontend components.

The existing 49 North Command Center remains the system of record until/unless a future migration is deliberately approved.

## Next hardening steps

1. Runtime-test authentication on a Netlify deploy preview.
2. Runtime-test protected read endpoints.
3. Test `commandUpdateBidStatus` against a disposable/test bid record.
4. Migrate current UI calls to protected command endpoints.
5. Disable or protect equivalent legacy write routes after UI migration.
6. Extend the command API to CRM, document retrieval/upload, webinar operations, and social publishing only as Life Command requirements demand.
