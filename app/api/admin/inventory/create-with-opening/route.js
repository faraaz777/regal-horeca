import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { createProductWithOpeningStock } from '@/lib/server/inventory/addToInventoryService';
import { createWithOpeningSchema, formatZodError } from '@/lib/server/inventory/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const role = auth.session.role;
  if (!hasPermission(role, 'products:write') || !hasPermission(role, 'inventory:write')) {
    return NextResponse.json(
      { error: 'Requires product master and inventory permissions' },
      { status: 403 }
    );
  }

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = createWithOpeningSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const product = await createProductWithOpeningStock({
      master: parsed.data.product,
      opening: parsed.data.opening,
      session: auth.session,
      request,
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('create-with-opening error:', error);
    const status = error.code === 'DUPLICATE_IDENTITY' ? 409 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
}
