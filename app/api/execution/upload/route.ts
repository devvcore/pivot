/**
 * POST /api/execution/upload
 *
 * Accepts multipart FormData with files (images, documents).
 * Uploads to Supabase Storage bucket "execution-media" and returns public URLs.
 * Used by the execution dashboard chat so agents can reference uploaded files
 * (e.g., post an image to Instagram, attach a doc to an email).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const BUCKET = 'execution-media';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const orgId = formData.get('orgId') as string;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: [...ALLOWED_TYPES],
    }).catch(() => {
      // Bucket already exists — fine
    });

    const uploaded: { name: string; url: string; type: string; size: number }[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Validate
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 20MB limit`);
        continue;
      }

      if (!ALLOWED_TYPES.has(file.type) && !file.type.startsWith('image/')) {
        errors.push(`${file.name}: unsupported file type (${file.type})`);
        continue;
      }

      // Build storage path: orgId/uuid_filename
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${orgId}/${uuidv4()}_${safeName}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        errors.push(`${file.name}: upload failed — ${uploadError.message}`);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      uploaded.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    return NextResponse.json({
      uploaded,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[POST /api/execution/upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
