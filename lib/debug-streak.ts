import { calculateUserStreak, updateUserStreak } from './streak-calculator';
import { supabase } from './supabase';

/**
 * Debug function to test streak calculation
 * Call this from the browser console or in development
 */
export async function debugStreakCalculation(userId?: string) {
  try {
    // Get current user if no userId provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[DebugStreak] No user logged in');
        return;
      }
      userId = user.id;
    }

    console.log(`[DebugStreak] Testing streak calculation for user: ${userId.slice(0, 8)}...`);
    
    // Get current streak from database
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_streak, longest_streak, last_scan_date')
      .eq('id', userId)
      .single();
    
    console.log('[DebugStreak] Current database values:', profile);
    
    // Calculate correct streak
    const calculated = await calculateUserStreak(userId);
    console.log('[DebugStreak] Calculated values:', calculated);
    
    // Update if different
    if (profile?.current_streak !== calculated.currentStreak) {
      console.log('[DebugStreak] Streak mismatch detected, updating...');
      await updateUserStreak(userId);
      console.log('[DebugStreak] Updated successfully');
    } else {
      console.log('[DebugStreak] Streak values match, no update needed');
    }
    
    return calculated;
  } catch (error) {
    console.error('[DebugStreak] Error:', error);
  }
}

/**
 * Make this available globally for debugging in development
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugStreak = debugStreakCalculation;
}
