# GSC indexation sync — one-time setup

The nightly `/api/cron/sync-gsc-indexation` route pulls per-URL indexation
status (URL Inspection API) and 28-day Search Analytics rollups (impressions,
clicks, CTR, position) into Supabase. Cron schedule: 03:00 UTC daily, defined
in `vercel.json`.

This doc walks through the GCP + Search Console setup that the cron depends on.

## 1. Create a Google Cloud service account

1. Open the Google Cloud Console → pick (or create) a project for Arco.
2. **APIs & Services → Library** → search for **Search Console API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**.
   - Name: `arcolist-gsc-sync` (any name works).
   - Role: leave empty — Search Console permissions are granted via Search
     Console itself, not IAM.
4. After creation, open the service account → **Keys → Add Key → Create new key
   → JSON**. Download and keep the JSON file private (it contains the private
   key).
5. Copy the service-account email — it looks like
   `arcolist-gsc-sync@<project-id>.iam.gserviceaccount.com`. You'll need it in
   step 2.

## 2. Confirm the GSC property exists

1. Open [Google Search Console](https://search.google.com/search-console).
2. Make sure a **URL-prefix property** for `https://www.arcolist.com/` exists
   and is verified (with the trailing slash — must match `GSC_PROPERTY` in
   `lib/gsc-sync.ts`).
3. The Workspace user the service account will impersonate (see step 3) must
   have at least **Restricted** access to this property. The Workspace super
   admin who set up the domain typically has full access by default.

Note: a domain property (`sc-domain:arcolist.com`) does not work — the
URL-prefix variant is required because that's what the URL Inspection API
needs as `siteUrl`.

## 3. Set up domain-wide delegation (Workspace-domain properties)

Google Workspace blocks adding non-domain emails (like `*.gserviceaccount.com`)
as users on Search Console properties. Instead, we use **domain-wide
delegation**: the service account impersonates a Workspace user (who already
has property access), so GSC sees the calls as coming from that user.

GCP side:

1. https://console.cloud.google.com/iam-admin/serviceaccounts → click the
   service account.
2. **Details** tab → **Show domain-wide delegation** → enable.
3. Copy the **Client ID** (a long numeric string — different from the email).

Workspace side:

4. https://admin.google.com → **Security → Access and data control → API
   controls → Manage Domain-wide delegation**.
5. **Add new**.
6. **Client ID**: paste from step 3.
7. **OAuth scopes**: `https://www.googleapis.com/auth/webmasters.readonly`.
8. **Authorise**.

## 4. Set the Vercel env vars

`GOOGLE_GSC_SERVICE_ACCOUNT` — full JSON of the service-account key:

```bash
GOOGLE_GSC_SERVICE_ACCOUNT='{"type":"service_account","project_id":"…","private_key_id":"…","private_key":"-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n","client_email":"arcolist-gsc-sync@…iam.gserviceaccount.com",…}'
```

`GSC_IMPERSONATE_USER` — the Workspace user the service account acts as.
Must be a real user with at least Restricted access to the GSC property:

```bash
GSC_IMPERSONATE_USER=niek@arcolist.com
```

Set both on Vercel for **Production** and **Preview**. `CRON_SECRET` (already
used by other crons) authenticates the cron itself.

## 5. Trigger a first run

Vercel runs the cron at 03:00 UTC daily. To trigger manually before then:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://www.arcolist.com/api/cron/sync-gsc-indexation
```

Expected response:

```json
{
  "ok": true,
  "projectsSynced": 12,
  "companiesSynced": 7,
  "total": 19,
  "errorCount": 0,
  "lastError": null
}
```

A row also lands in the `gsc_sync_runs` table.

## 6. Verify

After the first successful run:

```sql
-- Spot-check a project row
SELECT slug, seo_indexed, seo_indexation_state, seo_canonical_chosen,
       seo_impressions_28d, seo_clicks_28d, seo_ctr_28d, seo_position_28d,
       seo_synced_at
FROM projects
WHERE status = 'published'
ORDER BY seo_synced_at DESC NULLS LAST
LIMIT 5;

-- Latest sync run
SELECT * FROM gsc_sync_runs ORDER BY started_at DESC LIMIT 1;
```

The new admin columns on `/admin/projects` and `/admin/professionals` start
showing **Impressions / Clicks / CTR** values. Pages where Google did *not*
pass indexation read **"Not indexed"** in the Impressions column.

## Quotas

- **URL Inspection API**: ~2,000 requests/day per property. We currently
  inspect ~20 URLs/day, so we're at ~1% of the quota.
- **Search Analytics API**: 1,200 queries/day per property. We make 1 call per
  run, so we're at ~0.1% of the quota.

Plenty of headroom even at 100× current scale.

## Failure modes

- **Token exchange fails** → check the JSON in `GOOGLE_GSC_SERVICE_ACCOUNT` is
  valid and that the service-account email is added as a verified user on the
  GSC property.
- **403 on URL inspection** → the URL must belong to the verified property
  (`https://www.arcolist.com/`). Apex `arcolist.com` URLs won't work; we rely
  on Vercel's apex→www 307 to keep the canonical host single.
- **Rate limit (429)** → unlikely at our scale, but if it ever happens, throttle
  by sleeping between URL Inspection calls in `lib/gsc-sync.ts`.
