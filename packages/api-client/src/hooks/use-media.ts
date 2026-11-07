/**
 * Media uploads — reserve, PUT, confirm. ROADMAP stage 4.1 / 4.2.
 *
 * Three steps, and the middle one does not go through our API at all:
 *
 *   1. `POST /media/uploads`           → a presigned URL
 *   2. `PUT` straight to object storage → the bytes
 *   3. `POST /media/uploads/{id}/done` → the public URL
 *
 * This hook is the only place that sequence lives, so no screen has to know
 * it. It is also why the upload uses a bare `fetch`: step 2 is a signed
 * request to S3, not to us. Sending it through the generated client would
 * attach our `Authorization` header to somebody else's host — leaking a
 * bearer token to the storage provider — and S3 would reject the signature
 * for the extra header anyway.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { api } from '../client';
import type { Asset } from '../types';
import { unwrap } from './internal';
import { compressImage, type CompressedImage } from '../image';

export interface UploadProgress {
  /** 0–1, or null while we do not know. */
  fraction: number | null;
  stage: 'compressing' | 'uploading' | 'finishing';
}

export interface UploadImageInput {
  file: File;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Upload an image and get back a URL an event can point at.
 *
 * The file is **downscaled and re-encoded in the browser first** (stage 4.2).
 * That is the layer that actually matters: a modern phone photo is 4–12MB and
 * nobody needs more than about 2048px for a poster, so compressing before the
 * PUT is what stops the bytes crossing the network at all. The server's size
 * ceiling is a backstop for clients that are not ours, not the mechanism.
 */
export function useUploadImage(): UseMutationResult<Asset, Error, UploadImageInput> {
  return useMutation({
    mutationFn: async ({ file, onProgress }) => {
      onProgress?.({ fraction: null, stage: 'compressing' });
      const compressed: CompressedImage = await compressImage(file);

      onProgress?.({ fraction: 0, stage: 'uploading' });
      const reserved = await unwrap(
        api.POST('/media/uploads', {
          body: { contentType: compressed.contentType, purpose: 'poster' },
        })
      );

      // Bare fetch, to a signed URL on the storage host — see the file note.
      const put = await fetch(reserved.uploadUrl, {
        method: 'PUT',
        // Exactly the signed type. Anything else and S3 rejects the signature.
        headers: { 'Content-Type': reserved.contentType },
        body: compressed.blob,
      });

      if (!put.ok) {
        throw new Error(
          `The image could not be uploaded (${put.status}). Check your connection and try again.`
        );
      }

      onProgress?.({ fraction: 1, stage: 'finishing' });
      // The server HEADs the object here, so a PUT that silently failed does
      // not become a `ready` asset.
      return unwrap(
        api.POST('/media/uploads/{id}/done', {
          params: { path: { id: reserved.assetId } },
        })
      );
    },
  });
}
