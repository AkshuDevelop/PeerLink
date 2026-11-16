/**
 * ============================================================
 * SCRIPT PURPOSE:
 *   Standalone CLI utility to purge all guest accounts and
 *   their associated contacts, pair PINs, and transfers from
 *   the configured MongoDB database (Atlas or local).
 *
 * RUN VIA:
 *   npm run clean:guests --prefix server
 *   OR
 *   tsx src/scripts/cleanGuests.ts
 * ============================================================
 */

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { purgeAllGuestAccounts } from '../services/guestCleanupService';

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in server/.env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected. Scanning for guest accounts and their contacts...');

  const result = await purgeAllGuestAccounts();

  console.log('----------------------------------------------------');
  console.log(`✅ Clean up finished successfully!`);
  console.log(`   - Guest Accounts Deleted : ${result.purgedUsers}`);
  console.log(`   - Contacts Purged        : ${result.deletedContacts}`);
  console.log(`   - Pairing PINs Cleared   : ${result.deletedPairPins}`);
  console.log(`   - Transfers Cleared      : ${result.deletedTransfers}`);
  console.log('----------------------------------------------------');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error during guest purge:', err);
  process.exit(1);
});
