import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/connect';

import { requireAuth } from '@/lib/server/auth/requireAuth';

import { completeBucket } from '@/lib/server/sales/bucketService';



export const dynamic = 'force-dynamic';



/** Mark a submitted bucket as completed (hides from workspace). Empty drafts are discarded. */

export async function POST(request, { params }) {

  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });

  if (auth.error) return auth.error;



  try {

    await connectToDatabase();

    const result = await completeBucket(auth.session, params.id, request);



    if (result.error === 'not_found') {

      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

    }

    if (result.error === 'forbidden') {

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    }

    if (result.error === 'draft_has_lines') {

      return NextResponse.json(

        { error: 'Remove items or submit this draft before closing the tab' },

        { status: 400 }

      );

    }

    if (result.error === 'not_completable') {

      return NextResponse.json({ error: 'Bucket cannot be closed' }, { status: 400 });

    }



    return NextResponse.json({

      success: true,

      removed: result.removed || false,

      bucket: result.bucket || null,

    });

  } catch (error) {

    console.error('Complete bucket:', error);

    return NextResponse.json({ error: 'Failed to close customer tab' }, { status: 500 });

  }

}

