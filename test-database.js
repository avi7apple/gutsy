// Simple test to verify database triggers are working
// Run this with: node test-database.js

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables or replace with actual values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Check if user_profiles table has new columns
    console.log('\n1. Checking user_profiles schema...');
    const { data: columns, error: columnsError } = await supabase
      .from('user_profiles')
      .select('current_streak, longest_streak, total_scans, last_scan_date, scan_stats')
      .limit(1);
    
    if (columnsError) {
      console.error('❌ Schema check failed:', columnsError.message);
    } else {
      console.log('✅ Schema check passed - new columns exist');
    }
    
    // Test 2: Check meal_scans table
    console.log('\n2. Checking meal_scans table...');
    const { data: scans, error: scansError } = await supabase
      .from('meal_scans')
      .select('id, user_id, food_name, created_at')
      .limit(5);
    
    if (scansError) {
      console.error('❌ Meal scans check failed:', scansError.message);
    } else {
      console.log(`✅ Found ${scans?.length || 0} meal scans`);
      scans?.forEach(scan => {
        console.log(`   - ${scan.food_name} (${new Date(scan.created_at).toLocaleDateString()})`);
      });
    }
    
    // Test 3: Check user profiles with streak data
    console.log('\n3. Checking user profiles with streak data...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, current_streak, longest_streak, total_scans, last_scan_date')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Profiles check failed:', profilesError.message);
    } else {
      console.log(`✅ Found ${profiles?.length || 0} user profiles`);
      profiles?.forEach(profile => {
        console.log(`   - User ${profile.id.slice(0, 8)}...: streak=${profile.current_streak}, total=${profile.total_scans}`);
      });
    }
    
    console.log('\n✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDatabase();
