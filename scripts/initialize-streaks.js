const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initializeStreaks() {
  try {
    console.log('Initializing user streaks...');
    
    // Get all distinct users who have scans
    const { data: users, error: usersError } = await supabase
      .from('meal_scans')
      .select('user_id')
      .not('user_id', 'is', null);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    const uniqueUserIds = [...new Set(users?.map(u => u.user_id))];
    console.log(`Found ${uniqueUserIds.length} users with scans`);
    
    for (const userId of uniqueUserIds) {
      console.log(`Processing user: ${userId}`);
      
      // Get first and last scan dates
      const { data: scanDates, error: datesError } = await supabase
        .from('meal_scans')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (datesError) {
        console.error(`Error fetching scan dates for user ${userId}:`, datesError);
        continue;
      }
      
      if (!scanDates || scanDates.length === 0) {
        console.log(`No scans found for user ${userId}`);
        continue;
      }
      
      const totalScans = scanDates.length;
      const lastScanDate = scanDates[scanDates.length - 1].created_at;
      
      // Calculate current streak
      let currentStreak = 1;
      let longestStreak = 1;
      let tempStreak = 1;
      
      for (let i = scanDates.length - 1; i > 0; i--) {
        const currentDate = new Date(scanDates[i].created_at);
        const previousDate = new Date(scanDates[i - 1].created_at);
        
        // Calculate days difference
        const daysDiff = Math.floor((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day
          tempStreak++;
          if (i === scanDates.length - 1) {
            currentStreak = tempStreak;
          }
        } else {
          // Break in streak
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
      
      // Check final tempStreak against longest
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      
      // Calculate average score
      const { data: scores, error: scoresError } = await supabase
        .from('meal_scans')
        .select('gut_score, bloat_score')
        .eq('user_id', userId);
      
      let averageScore = 0;
      if (!scoresError && scores && scores.length > 0) {
        const validScores = scores.map(s => s.gut_score || s.bloat_score || 50);
        averageScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
      }
      
      // Find most scanned food
      const { data: foodCounts, error: foodError } = await supabase
        .from('meal_scans')
        .select('food_name')
        .eq('user_id', userId);
      
      let mostScannedFood = '';
      if (!foodError && foodCounts && foodCounts.length > 0) {
        const foodFrequency = {};
        foodCounts.forEach(item => {
          const food = item.food_name || 'Unknown';
          foodFrequency[food] = (foodFrequency[food] || 0) + 1;
        });
        
        mostScannedFood = Object.keys(foodFrequency).reduce((a, b) => 
          foodFrequency[a] > foodFrequency[b] ? a : b
        );
      }
      
      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_scans: totalScans,
          last_scan_date: lastScanDate,
          scan_stats: {
            average_score: Math.round(averageScore * 10) / 10,
            most_scanned_food: mostScannedFood,
            last_updated: new Date().toISOString()
          }
        });
      
      if (updateError) {
        console.error(`Error updating profile for user ${userId}:`, updateError);
      } else {
        console.log(`✓ Updated user ${userId}: streak=${currentStreak}, longest=${longestStreak}, total=${totalScans}`);
      }
    }
    
    console.log('✅ Streaks initialization completed!');
    
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

initializeStreaks();
