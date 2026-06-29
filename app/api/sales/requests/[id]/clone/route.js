import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/connect';

import { requireAuth } from '@/lib/server/auth/requireAuth';

import { cloneRequestToBucket } from '@/lib/server/sales/requestService';



export const dynamic = 'force-dynamic';



/** Clone an immutable InventoryRequest into a new draft bucket. */

export async function POST(request, { params }) {

  const auth = await requireAuth(request, { permission: 'sales:requests:write' });

  if (auth.error) return auth.error;



  try {

    await connectToDatabase();

    const result = await cloneRequestToBucket(auth.session, params.id, request);



    if (result.error === 'not_found') {

      return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    }

    if (result.error === 'forbidden') {

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    }

    if (result.error === 'not_cloneable') {

      return NextResponse.json(

        { error: result.message || 'Request cannot be cloned in its current status' },

        { status: 400 }

      );

    }



    return NextResponse.json(

      {

        success: true,

        bucket: result.bucket,

        sourceRequestNumber: result.sourceRequestNumber,

      },

      { status: 201 }

    );

  } catch (error) {

    console.error('Clone request:', error);

    return NextResponse.json({ error: 'Failed to clone request' }, { status: 500 });

  }

}

