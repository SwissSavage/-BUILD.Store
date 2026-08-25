# Storage runbook (task #57)

Three backends behind one API:

| Kind | Backend | Purpose |
|---|---|---|
| `doc` | Google Drive | LOIs, agreements, SOWs, retroactive receipts. Human-organizable, shared with counterparties. |
| `image` | Cloudflare R2 | Avatars, portfolio media, EPK hero, product photos. CDN-served, cheap egress. |
| `other` | Hetzner local disk | RFP attachments, temp uploads, arbitrary. Also the fallback bucket if either of the above is unhealthy. |

Every upload falls back to Hetzner if the primary backend throws. Fallback events audit-log with reason so ops can drain them back to the right home later.

## Cred provisioning

### Cloudflare R2

1. Cloudflare dashboard → R2 (accept TOS on first visit).
2. Create bucket `fm-uploads-prod`, location auto.
3. Manage R2 API Tokens → Create → Object Read & Write scoped to `fm-uploads-prod`, no TTL.
4. Save Access Key ID, Secret Access Key, Account ID.
5. (Later) Custom domain: bucket → Settings → Public access → Connect Custom Domain → `media.afuturemodern.com`.

### Google Drive service account

1. https://console.cloud.google.com → new project `future-modern-storage`.
2. APIs & Services → Library → Google Drive API → Enable.
3. Credentials → Create Credentials → Service Account → name `fm-storage-writer`.
4. Keys tab → Add Key → JSON → downloads keyfile. Guard as secret.
5. In Drive, create root folder `Future Modern — Uploads`, share it with the service account email as Editor.
6. Copy the folder ID from the URL (`/folders/<ID>`).

### Hetzner

1. SSH the VPS: `sudo mkdir -p /var/fm/uploads && sudo chown -R <container-uid>:<container-gid> /var/fm/uploads`.
2. Dokploy → app → Volumes → mount `/var/fm/uploads:/var/fm/uploads`.
3. Redeploy so the mount takes effect.

## Environment variables

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=fm-uploads-prod
R2_PUBLIC_URL_BASE=https://media.afuturemodern.com   # optional; enables public URL vs presigned

## Google Drive credentials — prefer base64 env var

Dokploy (and many other container platforms) mangle escape sequences inside multi-line env var values, which breaks the `\n` markers in the service account's `private_key` field on the way into the container. The driver supports three credential formats, in preference order:

### Preferred: base64 env var (no file mount, no VPS shell)

1. Encode the keyfile locally:
   ```
   base64 -w 0 /path/to/keyfile.json | clip     # Windows Git Bash
   base64 -w 0 /path/to/keyfile.json | pbcopy   # macOS
   ```
2. Dokploy env var: `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64=<paste the single-line base64 blob>`

Base64 characters are all safe for env var passthrough — no escape processing can touch them.

### Alternate: file mount (when you'd rather not put the secret in an env var)

1. Create the file on the VPS at `/var/fm/secrets/google-drive-key.json` (via Hetzner Console or SSH).
2. In Dokploy app config → **Advanced** → **Volumes** → add a Bind mount:
   - **File Path (host):** `/var/fm/secrets/google-drive-key.json`
   - **Mount Path (container):** `/run/secrets/google-drive-key.json`
3. Env var: `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH=/run/secrets/google-drive-key.json`

### Fallback: raw JSON env var (only if the platform preserves escapes verbatim)

`GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON=<entire keyfile JSON minified to one line>`

### Common to all three

`GOOGLE_DRIVE_ROOT_FOLDER_ID=<folder ID shared with the service account email>

HETZNER_UPLOAD_DIR=/var/fm/uploads
```

## Verify

- Hit `GET /api/storage/health` (admin-only) after redeploy. Returns per-driver status. All three should read `ok` before we cut over any existing uploads.

## Rotation

- **R2** — regenerate the API token, update `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` in Dokploy, redeploy. Zero-downtime as long as the old token stays valid during rollout.
- **Drive** — create a new key on the same service account, replace `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, redeploy. Delete the old key after confirming green.
- **Hetzner** — nothing to rotate; disk-local.

## Migration path (once storage is live)

1. **RFP attachments (task #29)** — currently base64 inline on `projects.rfp_attachments`. Script drains → Hetzner disk → updates rows to `{ backend: "hetzner", key: "..." }` shape → drops base64 payload. Runs once, post-deploy.
2. **Avatars + portfolio images** — currently user-pasted URLs. Task #58 image pipeline replaces the URL field with an uploader that writes to R2 through `storeFile({ kind: "image", ... })`.
3. **Signed agreements** — Documenso webhook path (existing) receives the final PDF; wrap the archive step with `storeFile({ kind: "doc", ... })` so it lands in the Drive folder tree keyed by `agreements/<agreementType>/<year>/`.

## Failure modes

- **Drive rate limits** — 100 req / 100s per service account. Batch writes when possible; long tail lands via Hetzner fallback + drain.
- **R2 unavailable** — falls back to Hetzner automatically. Health check flags red until R2 recovers; drain script re-uploads Hetzner → R2 after health recovers.
- **Hetzner disk fills up** — health check reports `unhealthy` at 90% capacity (follow-up). Alert cadence lives in Uptime Robot / whatever monitoring wraps the health endpoint.
- **Drive folder deleted by accident** — `GOOGLE_DRIVE_ROOT_FOLDER_ID` becomes invalid; health probe returns unhealthy immediately. Recreate the folder + reshare with the service account + update the env var.

## What's NOT in this task

- Image resizing (that's task #58 — sharp pipeline).
- Presigned uploads direct from browser (deferred; MVP uploads through the server so we can PII-scrub / virus-scan later).
- Cross-region replication (single-region for beta; add later if needed).
