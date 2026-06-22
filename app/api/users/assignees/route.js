import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';

/** Active staff who can be assigned enquiries */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'enquiries:read' });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const users = await User.find({
    isActive: true,
    role: { $in: ['super_admin', 'data_entry', 'sales'] },
  })
    .select('name email role')
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    success: true,
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
}
