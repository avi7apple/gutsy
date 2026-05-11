import { Colors, Fonts, Spacing } from '@/constants/theme';
import { rf } from '@/lib/hooks/use-responsive';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StreakDisplayProps {
  currentStreak: number;
  size?: 'small' | 'medium' | 'large';
}

export function StreakDisplay({ currentStreak, size = 'medium' }: StreakDisplayProps) {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { padding: Spacing.sm, gap: Spacing.xs },
          text: { fontSize: rf(12) },
          icon: { size: 14 }
        };
      case 'large':
        return {
          container: { padding: Spacing.lg, gap: Spacing.sm },
          text: { fontSize: rf(18) },
          icon: { size: 24 }
        };
      default:
        return {
          container: { padding: Spacing.md, gap: Spacing.sm },
          text: { fontSize: rf(14) },
          icon: { size: 16 }
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, sizeStyles.container]}>
      <Text style={[styles.text, sizeStyles.text]}>
        {currentStreak}-day streak
      </Text>
      <Ionicons 
        name="flame" 
        size={sizeStyles.icon.size} 
        color="#FF6B35" 
        style={styles.icon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}14`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: {
    fontFamily: Fonts.smallLabel,
    color: Colors.primary,
    fontWeight: '600',
  },
  icon: {
    // Icon styling handled by Ionicons props
  },
});
