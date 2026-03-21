import React, { useEffect, useRef } from "react";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

// ─── Smooth fade transition wrapper ─────────────────────────────────────
export function SmoothFade({
  children,
  visible,
  duration = 300,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
  delay?: number;
  style?: any;
}) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(visible ? 1 : 0, {
        duration,
        easing: Easing.out(Easing.ease),
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [visible, duration, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Smooth scale transition for numbers ───────────────────────────────────
export function SmoothScale({
  children,
  trigger,
  scale = 1.05,
  duration = 200,
  style,
}: {
  children: React.ReactNode;
  trigger: any; // Change this value to trigger animation
  scale?: number;
  duration?: number;
  style?: any;
}) {
  const scaleValue = useSharedValue(1);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger !== prevTrigger.current) {
      scaleValue.value = withSpring(scale, {
        damping: 15,
        stiffness: 300,
      });
      
      setTimeout(() => {
        scaleValue.value = withSpring(1, {
          damping: 15,
          stiffness: 300,
        });
      }, duration);
      
      prevTrigger.current = trigger;
    }
  }, [trigger, scale, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Smooth number counter animation ───────────────────────────────────────
export function AnimatedNumber({
  value,
  duration = 600,
  style,
}: {
  value: number;
  duration?: number;
  style?: any;
}) {
  const animatedValue = useSharedValue(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      animatedValue.value = withTiming(value, {
        duration,
        easing: Easing.out(Easing.ease),
      });
      prevValue.current = value;
    }
  }, [value, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            animatedValue.value,
            [prevValue.current, value],
            [0, prevValue.current > value ? 2 : -2]
          ) as any,
        },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Animated.Text style={style}>
        {Math.round(animatedValue.value)}
      </Animated.Text>
    </Animated.View>
  );
}

// ─── Smooth color transition for scores ───────────────────────────────────────
export function AnimatedScore({
  value,
  style,
  getScoreColor,
}: {
  value: number;
  style?: any;
  getScoreColor: (score: number) => string;
}) {
  const animatedValue = useSharedValue(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      animatedValue.value = withTiming(value, {
        duration: 400,
        easing: Easing.out(Easing.ease),
      });
      prevValue.current = value;
    }
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      animatedValue.value,
      [0, 40, 70, 100],
      [0, 0.33, 0.66, 1]
    );
    
    return {
      color: animatedValue.value >= 70 ? "#10B981" : 
             animatedValue.value >= 40 ? "#F59E0B" : "#EF4444",
    };
  });

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {Math.round(animatedValue.value)}
    </Animated.Text>
  );
}

// ─── Smooth list item addition/removal ───────────────────────────────────────
export function AnimatedListItem({
  children,
  isEntering = false,
  isExiting = false,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  isEntering?: boolean;
  isExiting?: boolean;
  style?: any;
  delay?: number;
}) {
  const translateY = useSharedValue(isEntering ? 20 : 0);
  const opacity = useSharedValue(isEntering ? 0 : 1);
  const scale = useSharedValue(isExiting ? 0.95 : 1);

  useEffect(() => {
    if (isEntering) {
      setTimeout(() => {
        translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
        opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
        scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      }, delay);
    } else if (isExiting) {
      translateY.value = withTiming(-20, { duration: 250, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.ease) });
      scale.value = withTiming(0.95, { duration: 250, easing: Easing.in(Easing.ease) });
    }
  }, [isEntering, isExiting, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
