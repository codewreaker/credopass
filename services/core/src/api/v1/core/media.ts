/**
 * Media uploads. ROADMAP stage 4.1 · docs/API-FIRST-REBUILD.md §9.1
 *
 * Two calls, because the bytes do not come through here:
 *
 *   POST /media/uploads            reserve a key, get a presigned PUT URL
 *   POST /media/uploads/{id}/done  confirm the bytes landed, get the URL
 *
 * The browser PUTs straight to object storage in between. That keeps a 4MB
 * photo out of the API entirely — no body limit to raise, no worker tied up
 * for the length of a phone's upload — at the cost of the API not seeing the
 * file. Everything that would otherwise be checked on the way past is
 * therefore baked into the signature or checked on `done`; `services/storage.ts`
 * sets out which is which.
 *
 * `media:upload` is the permission. It is held by owner, admin and organizer
 * and not by `checkin` or `viewer` — a door tablet has no business writing to
 * the bucket.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { defineRoute, problemResponse } from '../../../http/define-route';
import {
  requireCaller,
  requirePermission,
  requireTenant,
  type CallerVars,
} from '../../../middleware/caller';
import { getDatabase } from '../../../db/client';
import * as Storage from '../../../services/storage';

export const mediaRoutes = new OpenAPIHono<{ Variables: CallerVars }>();

mediaRoutes.use('/media/*', requireCaller, requireTenant());

const PresignedUploadSchema = z
  .object({
    assetId: z.string().uuid(),
    /** PUT the file here, with exactly `contentType` as the Content-Type header. */
    uploadUrl: z.string(),
    contentType: z.string(),
    expiresInSeconds: z.number().int(),
    /** Enforced on `done`, not by the signature — a presigned PUT cannot carry a size condition. */
    maxBytes: z.number().int(),
  })
  .openapi('PresignedUpload');

const AssetSchema = z
  .object({
    id: z.string().uuid(),
    url: z.string(),
    byteSize: z.number().int(),
    contentType: z.string(),
  })
  .openapi('Asset');

mediaRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/media/uploads',
    scope: 'organization',
    permission: 'media:upload',
    summary: 'Reserve a key and get a presigned upload URL',
    tags: ['Media'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('media:upload')] as const,
    request: {
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                /**
                 * What you are about to upload. The signature is bound to it,
                 * so S3 refuses a PUT that sends anything else — this is the
                 * actual control on what can be stored, not a hint.
                 */
                contentType: z.enum(Storage.UPLOADABLE_IMAGE_TYPES),
                purpose: z.literal('poster').optional(),
              })
              .openapi('CreateUploadBody'),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Upload reserved',
        content: { 'application/json': { schema: PresignedUploadSchema } },
      },
      400: problemResponse('Unsupported file type'),
      403: problemResponse('Insufficient role'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    const upload = await Storage.createUpload(db, c.get('tenant'), c.req.valid('json'));
    return c.json(upload, 201);
  }
);

mediaRoutes.openapi(
  defineRoute({
    method: 'post',
    path: '/media/uploads/{id}/done',
    scope: 'organization',
    permission: 'media:upload',
    summary: 'Confirm an upload landed, and get its public URL',
    tags: ['Media'],
    security: [{ bearerAuth: [] }],
    middleware: [requirePermission('media:upload')] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: 'The asset', content: { 'application/json': { schema: AssetSchema } } },
      400: problemResponse('The upload did not arrive, or is too large'),
      403: problemResponse('Insufficient role'),
      404: problemResponse('Upload not found'),
    },
  }),
  async (c) => {
    const db = await getDatabase();
    // HEADs the object rather than believing the client — see finaliseUpload.
    const asset = await Storage.finaliseUpload(db, c.get('tenant'), c.req.valid('param').id);
    return c.json(asset, 200);
  }
);
