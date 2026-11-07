# Object storage — how it works, and how to provision it

> Written 2026-11-07, when poster uploads landed (ROADMAP stage 4.1). Two audiences:
> somebody who has never set up S3 before, and somebody who needs to get the production
> bucket working. §1–§4 are the explanation, §5 is the shopping list, §6 is the gotchas.

---

## 1. What S3 actually is

**It is not a filesystem.** That is the single most useful thing to internalise, because
almost every surprise comes from expecting it to be one.

A filesystem has directories, you can rename things, you can append to a file, and you can
ask "what's in this folder" cheaply. Object storage has none of that. It is a **giant
key–value store where the values are files**:

```
key                                             value
───────────────────────────────────────────────────────────
org/4027f3f1.../poster/5a96ba97....jpg          <248KB of JPEG>
org/4027f3f1.../poster/a1b2c3d4....jpg          <190KB of JPEG>
```

The key is just a string. **The slashes mean nothing** — there is no "folder". The console
draws folders by splitting on `/`, which is a convenience, not a structure. You cannot
rename a key (you copy and delete). You cannot append (you re-upload the whole object).

What you get in exchange is that it is effectively infinite, cheap, and someone else's
problem to keep alive.

### The five things that identify a bucket

Every S3-compatible service, everywhere, needs the same five values. Once you see that,
the providers stop looking different:

| | What it is | Ours, locally |
|---|---|---|
| **endpoint** | The server's address | `http://localhost:9000` (MinIO) |
| **bucket** | A named container of keys | `credopass-media-local` |
| **region** | Which datacentre. Part of the signature even when it is meaningless | `us-east-1` |
| **access key id** | Username, roughly | `credopass` |
| **secret access key** | Password. **Never leaves the server** | `credopass` |

"S3-compatible" means a provider speaks Amazon's protocol, so the same five values and the
same client library work against Cloudflare, Hetzner, Supabase or MinIO. That is why we
develop against MinIO in Docker and deploy against something else without changing code.

---

## 2. The problem presigned URLs solve

Say an organiser uploads a 4MB photo. The obvious design is:

```
browser ──4MB──▶ our API ──4MB──▶ S3
```

This works and it is what most people build first. It is also bad:

- Our API holds 4MB in memory, per concurrent upload, for as long as a phone on a bad
  connection takes to send it. Ten people at once is a stalled service.
- The body-size limit has to be raised to 8MB+, which now applies to *every* endpoint.
- We pay to receive the bytes and again to send them.
- The upload has to finish inside one HTTP request to our app.

**A presigned URL removes the middle hop entirely:**

```
1. browser ──"I want to upload a JPEG"──▶ our API
2. our API ──a signed URL, valid 10 min──▶ browser      (no bytes)
3. browser ─────────4MB─────────────────▶ S3            (never touches us)
4. browser ──"done, asset 5a96…"────────▶ our API
5. our API ──"is it really there?"──────▶ S3  (HEAD, a few bytes)
```

Our service only ever handles small JSON. The bytes go direct.

### How the signature works

S3 authenticates requests with **AWS Signature V4**. Normally your server does this on
every call: it takes the request (method, path, headers, timestamp), hashes it, and
HMACs that hash with the secret key. S3 recomputes the same thing and compares. The secret
is never transmitted — it is the key to a hash, which is the whole trick.

A **presigned URL** is the same calculation with the signature put in the *query string*
instead of a header:

```
http://localhost:9000/credopass-media-local/org/4027.../poster/5a96....jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=credopass/20261107/us-east-1/s3/aws4_request
  &X-Amz-Date=20261107T162800Z
  &X-Amz-Expires=600
  &X-Amz-SignedHeaders=content-type;host
  &X-Amz-Signature=3f9a…
```

Now **anyone holding that URL can do that one thing**, without credentials, until it
expires. It is a capability, not a login. That is what makes it safe to hand to a browser:
the browser never sees the secret, and the URL only permits what was signed.

### What the signature pins down — and what it does not

This is the part that matters for security, and it is why the code is shaped as it is.

**Pinned, and therefore enforced by S3 itself:**

- **The HTTP method.** A URL signed for `PUT` cannot be used to `GET` or `DELETE`.
- **The exact object key.** This is why *we* generate the key from a UUID under the
  tenant's own prefix, and never accept a filename from the client. A client-supplied name
  like `../../other-org/poster/x.jpg` would be a path-traversal into another tenant's
  space, and a repeated name would silently overwrite a poster someone is using.
- **The `Content-Type`.** S3 rejects a PUT whose header differs from the signed value. So
  signing `image/jpeg` means *only* a JPEG can land there. This is the real control on
  what can be stored — the allow-list in our code is what feeds it.
- **The expiry.** Ten minutes: long enough for a slow phone, short enough that a leaked
  URL is not a standing write credential.

**Not pinned — and this is the trap:**

- **Size.** A presigned *PUT* signature has no way to carry a size limit. (S3 has a
  `content-length-range` condition, but only for browser *POST policies*, a different and
  clunkier mechanism.) So the 8MB ceiling cannot be enforced at upload time. We enforce it
  on step 5 by `stat`-ing the object and deleting it if it is too big.
- **Whether the upload happened at all.** Step 4 is the browser *claiming* success. That
  is not evidence. Step 5 is why the `assets` row only becomes `ready` after we have
  looked.

---

## 3. Why there is a database row before there are bytes

`assets.status` is `pending` → `ready`, and the row is written *before* the URL is signed.

Without the row, we would hand out a signed URL and have no record that we had. An upload
that succeeded but was never confirmed would be bytes in the bucket that nothing in the
system knows about: not attributable, not cleanable, not visible. With it, an abandoned
upload is just a `pending` row older than a day — garbage with a name.

**Nothing user-facing may point at a `pending` asset.** `events.cover_image_url` is only
accepted once the asset is `ready` *and* belongs to the same organisation — enforced in
`assertCoverImageAllowed` in the event service, not in the route, because it needs a
database read.

---

## 4. Public reads, and what that means

Our bucket is configured so that **finished objects are world-readable** by URL
(`mc anonymous set download` in the dev compose file). An attendee opening their pass on a
phone with no account has to be able to fetch the poster, so there is no one to
authenticate.

What that implies, and why it is acceptable:

- Keys are UUIDs, so they are not guessable — but **"unguessable" is not access control**.
  Treat anything in this bucket as public. Do not put anything in it that is not meant to
  be seen by someone who has the link.
- Posters are, by their nature, the thing you want strangers to look at. Attendee photos
  or ID documents would need a different design (private bucket, presigned *GET* URLs with
  short expiry).
- **SVG is refused on upload.** It is a document format that can contain `<script>`, and
  anything served from a public URL on a domain we control could become stored XSS. Only
  JPEG, PNG, WebP and AVIF are accepted.

---

## 5. Provisioning production — the shopping list

Production currently has **no bucket**. The service boots fine without one (the storage
client is created lazily), and everything except poster *uploads* works; pasted image links
still work. An upload attempt returns a clear `Storage is not configured: S3_ENDPOINT is
unset` 500 rather than failing mysteriously.

Whatever you pick, you end up setting the same five variables in Coolify:

```bash
S3_ENDPOINT=https://…            # the API address, NOT the public file address
S3_BUCKET=credopass-media
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_REGION=…                      # whatever the provider says; it goes in the signature
S3_PUBLIC_URL=https://…          # where browsers FETCH files from (see §6.1)
```

### The three options worth considering

**Cloudflare R2 — my recommendation.** Storage is $0.015/GB-month, writes $4.50/million,
reads $0.36/million, and **egress is free** — which is the number that matters here,
because every attendee loading a pass is egress. The free tier covers 10GB of storage,
1M writes and 10M reads a month, which this product will not exceed for a long time. It is
S3-compatible, and you can put a custom domain in front of a bucket for the public URL.
([pricing](https://developers.cloudflare.com/r2/pricing/))

**Hetzner Object Storage** — you are already on Hetzner, so the API and the bucket would be
co-located. Billed per account rather than per bucket, from around €6.49/month excluding
VAT, including 1TB of storage and 1TB of egress; API calls and ingress are free. Fine, but
you start paying a monthly base fee for a product currently storing a handful of images,
where R2 would be free. ([overview](https://docs.hetzner.com/storage/object-storage/overview) ·
[pricing](https://www.hetzner.com/storage/object-storage/pricing/))

**Supabase Storage** — the least new infrastructure, since the database is already there.
It has an S3-compatible endpoint at `https://<project-ref>.storage.supabase.co/storage/v1/s3`,
supports SigV4 presigning, and you create an access key pair under *Storage → S3
Configuration*. Two things to know: the S3 connection has to be **enabled** in Storage
Settings first, and **those keys bypass Storage RLS**, so they must stay server-side — which
they do here, since only the API ever holds them.
([compatibility docs](https://supabase.com/docs/guides/storage/s3/compatibility))

**My order:** R2 for the free egress, Supabase if you would rather not add a vendor,
Hetzner if co-location turns out to matter.

### Steps, whichever you choose

1. Create a bucket named `credopass-media`.
2. Make its objects **publicly readable** (R2: connect a custom domain or enable the
   `r2.dev` dev URL; Supabase: mark the bucket public; Hetzner: set a public-read policy).
3. Create an access key pair **scoped to that bucket** if the provider allows it.
4. Set the CORS rule in §6.2.
5. Put the six variables above into Coolify and redeploy.
6. Check it: create an event, add a photo, confirm the poster renders on `/e/{id}`.

---

## 6. The gotchas, in the order they will bite you

### 6.1 The endpoint and the public URL are different things

`S3_ENDPOINT` is where the API *signs and talks to* the bucket. `S3_PUBLIC_URL` is where a
browser *fetches a finished file*. Locally they are the same MinIO, so the default of
`${S3_ENDPOINT}/${S3_BUCKET}` is right. In production they usually differ — R2's S3 API
lives on `<account>.r2.cloudflarestorage.com` while files are served from your custom
domain. Getting this wrong means uploads succeed and images 403.

### 6.2 CORS will be the thing that breaks

The browser PUTs **directly to the storage host**, which is a different origin from the
app. Without a CORS rule the browser refuses before a byte is sent. MinIO is permissive by
default, so this works locally and then fails in production — the classic sequence.

The rule you need, on the bucket:

```json
[{
  "AllowedOrigins": ["https://app.credopass.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["content-type"],
  "ExposeHeaders": ["etag"],
  "MaxAgeSeconds": 3600
}]
```

`AllowedHeaders` must include `content-type`, because we send it and it is part of the
signature.

### 6.3 A clock more than ~15 minutes out invalidates every signature

SigV4 includes a timestamp and S3 rejects requests outside a tolerance window. If signing
suddenly fails everywhere with `RequestTimeTooSkewed`, check the server's clock before
anything else.

### 6.4 Deletes are not transactional with the database

Deleting a row does not delete the object and vice versa. Today nothing deletes posters at
all, so this is latent — but when it is built, the safe order is **soft-delete the row,
then delete the object**, so a failure leaves an orphaned object (invisible, costs
fractions of a penny) rather than a broken image on a live pass.

### 6.5 Abandoned uploads accumulate

A `pending` row older than 24h is an upload that was signed for and never completed.
`idx_assets_pending` exists so the sweep is cheap, and `countAbandonedUploads()` is
written — but **nothing runs it yet**, because there is no scheduler (Phase 4).

---

## 7. What is not built yet

| | |
|---|---|
| Server-side derivatives | AVIF/WebP at card and thumbnail widths via `sharp`. The browser downscales to 2048px, which is the big win; serving a 2048px image as a 300px thumbnail is the remaining waste. |
| `width` / `height` | Columns exist, always null. The browser knows them after compressing but does not send them. |
| Deleting a poster | Clearing the cover on an event leaves the object in the bucket. |
| The abandoned-upload sweep | See §6.5. |
| Avatars, or anything non-poster | `purpose` is in the API and only ever `poster`. |
