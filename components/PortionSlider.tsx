import { Colors, Fonts, Spacing, BorderRadius } from "@/constants/theme";
import React, { useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface PortionSliderProps {
  value: number;
  minValue: number;
  maxValue: number;
  onValueChange: (value: number) => void;
  visualReference?: string;
  ingredientName: string;
  unit?: string;
}

export function PortionSlider({
  value,
  minValue,
  maxValue,
  onValueChange,
  visualReference,
  ingredientName,
  unit = "g",
}: PortionSliderProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Calculate angle for circular slider (0 to 270 degrees)
  const calculateAngle = (value: number) => {
    const range = maxValue - minValue;
    const normalizedValue = value - minValue;
    const percentage = normalizedValue / range;
    return percentage * 270; // 270 degrees arc
  };

  // Convert angle to value
  const calculateValue = (angle: number) => {
    const percentage = Math.max(0, Math.min(1, angle / 270));
    const range = maxValue - minValue;
    return minValue + Math.round(percentage * range);
  };

  // Handle touch events for circular slider
  const handlePanResponderMove = (_: any, gestureState: any) => {
    const { x0, y0, dx, dy } = gestureState;
    
    // Calculate angle from center
    const centerX = 150; // Half of slider width
    const centerY = 150; // Half of slider height
    const touchX = x0 + dx;
    const touchY = y0 + dy;
    
    // Calculate angle from center to touch point
    const deltaX = touchX - centerX;
    const deltaY = touchY - centerY;
    
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    angle = angle + 90; // Adjust for 12 o'clock start
    
    // Convert to 0-270 degree range
    if (angle < 0) angle += 360;
    if (angle > 270) angle = 270;
    
    const newValue = calculateValue(angle);
    onValueChange(newValue);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setIsDragging(true),
    onPanResponderMove: handlePanResponderMove,
    onPanResponderRelease: () => setIsDragging(false),
  });

  const currentAngle = calculateAngle(value);
  const radius = 60;
  const centerX = 150;
  const centerY = 150;

  // Calculate thumb position
  const thumbAngle = (currentAngle - 135) * (Math.PI / 180); // Convert to radians and adjust start position
  const thumbX = centerX + radius * Math.cos(thumbAngle);
  const thumbY = centerY + radius * Math.sin(thumbAngle);

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer} {...panResponder.panHandlers}>
        {/* Circular track */}
        <View style={[styles.track, { width: 120, height: 120, borderRadius: 60 }]}>
          {/* Progress arc */}
          <View
            style={[
              styles.progressArc,
              {
                width: 120,
                height: 120,
                borderRadius: 60,
                transform: [{ rotate: `${currentAngle - 135}deg` }],
              },
            ]}
          />
          {/* Thumb */}
          <View
            style={[
              styles.thumb,
              {
                position: 'absolute',
                left: thumbX - 12,
                top: thumbY - 12,
                backgroundColor: isDragging ? Colors.primaryDark : Colors.primary,
                transform: [{ scale: isDragging ? 1.2 : 1 }],
              },
            ]}
          />
        </View>

        {/* Center value display */}
        <View style={styles.centerValue}>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>

      {/* Ingredient name and reference */}
      <View style={styles.infoContainer}>
        <Text style={styles.ingredientName}>{ingredientName}</Text>
        {visualReference && (
          <Text style={styles.referenceText}>{visualReference}</Text>
        )}
      </View>

      {/* Min/Max labels */}
      <View style={styles.rangeLabels}>
        <Text style={styles.rangeText}>{minValue}{unit}</Text>
        <Text style={styles.rangeText}>{maxValue}{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  sliderContainer: {
    position: 'relative',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    backgroundColor: Colors.borderLight,
    position: 'absolute',
  },
  progressArc: {
    backgroundColor: Colors.primary,
    position: 'absolute',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderBottomRightRadius: 60,
    borderBottomLeftRadius: 60,
    overflow: 'hidden',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  centerValue: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Fonts.scoreNumber,
  },
  unitText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    fontFamily: Fonts.productName,
  },
  referenceText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
    fontFamily: Fonts.body,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.sm,
  },
  rangeText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Fonts.body,
  },
});
