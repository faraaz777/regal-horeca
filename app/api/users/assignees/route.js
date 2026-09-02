import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { ENQUIRY_ASSIGNEE_ROLES } from '@/lib/shared/roles';

/** Active staff who can be assigned enquiries */
export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'enquiries:read' });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const users = await User.find({
    isActive: true,
    role: { $in: ENQUIRY_ASSIGNEE_ROLES },
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
