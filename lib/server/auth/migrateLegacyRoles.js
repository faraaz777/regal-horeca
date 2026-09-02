import 'server-only';

import mongoose from 'mongoose';

let migrated = false;

/**
 * Collapse duplicate role names onto the originals.
 * Native update so Mongoose enum does not reject leftover documents.
 */
export async function migrateLegacyUserRoles() {
  if (migrated) return;
  if (mongoose.connection.readyState !== 1) return;

  const col = mongoose.connection.collection('users');
  await col.updateMany({ role: 'product_manager' }, { $set: { role: 'data_entry' } });
  await col.updateMany({ role: 'inventory_supervisor' }, { $set: { role: 'inventory_manager' } });
  migrated = true;
}
