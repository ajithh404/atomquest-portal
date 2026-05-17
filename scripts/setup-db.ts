/**
 * Database Setup Script
 * 
 * This script reads the migration.sql file and executes it against your Supabase project.
 * It requires the SUPABASE_SERVICE_ROLE_KEY environment variable.
 * 
 * Usage: npx tsx scripts/setup-db.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function setupDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables.');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    console.error('   You can find your service_role key in:');
    console.error('   Supabase Dashboard → Project Settings → API → service_role (secret)');
    console.error('');
    console.error('   Set it temporarily:');
    console.error('   $env:SUPABASE_SERVICE_ROLE_KEY="your_key_here"');
    process.exit(1);
  }

  const sqlPath = join(__dirname, '..', 'supabase', 'migration.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log('🚀 Running migration against Supabase...');
  console.log(`   URL: ${supabaseUrl}`);
  console.log('');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // Try the pg_net approach - direct SQL execution via Supabase Management API
      console.log('   RPC not available, trying direct SQL endpoint...');
      
      const pgResponse = await fetch(`${supabaseUrl}/pg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!pgResponse.ok) {
        const text = await pgResponse.text();
        console.error('❌ Migration failed:', text);
        console.error('');
        console.error('   Please run the migration manually:');
        console.error('   1. Go to https://supabase.com/dashboard/project/gsfdvryvwupphoivatdo/sql/new');
        console.error('   2. Paste the contents of supabase/migration.sql');
        console.error('   3. Click "Run"');
        process.exit(1);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('   Demo accounts created:');
    console.log('   📧 employee@demo.com / Demo@1234 (Employee - Rahul Sharma)');
    console.log('   📧 manager@demo.com  / Demo@1234 (Manager - Priya Nair)');
    console.log('   📧 admin@demo.com    / Demo@1234 (Admin - Admin User)');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    console.error('');
    console.error('   Please run the migration manually:');
    console.error('   1. Go to https://supabase.com/dashboard/project/gsfdvryvwupphoivatdo/sql/new');
    console.error('   2. Paste the contents of supabase/migration.sql');
    console.error('   3. Click "Run"');
    process.exit(1);
  }
}

setupDatabase();
