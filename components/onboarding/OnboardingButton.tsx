import { BorderRadius, Colors, Typography } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import React from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from "react-native";

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabledBackgroundColor?: string;
}

export default function OnboardingButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
  disabledBackgroundColor,
}: OnboardingButtonProps) {
  const buttonStyles = [
    styles.base,
    variant === "primary" && styles.primary,
    variant === "secondary" && styles.secondary,
    variant === "text" && styles.text,
    disabled && !disabledBackgroundColor && styles.disabled,
    disabled && disabledBackgroundColor && { backgroundColor: disabledBackgroundColor, opacity: 1 },
    style,
  ];

  const labelStyles = [
    styles.label,
    variant === "primary" && styles.primaryLabel,
    variant === "secondary" && styles.secondaryLabel,
    variant === "text" && styles.textLabel,
    disabled && !disabledBackgroundColor && styles.disabledLabel,
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={buttonStyles}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : Colors.primary}
        />
      ) : (
        <Text style={labelStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: rs(56),
    borderRadius: rs(BorderRadius.md),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(24),
  },
  primary: {
    backgroundColor: "#325C3A",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  text: {
    backgroundColor: "transparent",
    height: "auto" as unknown as number,
    paddingHorizontal: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: Typography.button.fontFamily,
    fontSize: rf(Typography.button.fontSize),
    lineHeight: rf(Typography.button.lineHeight),
  },
  primaryLabel: {
    color: "#FFFFFF",
  },
  secondaryLabel: {
    color: Colors.primary,
  },
  textLabel: {
    color: Colors.primary,
    fontSize: rf(15),
    fontWeight: "500",
  },
  disabledLabel: {
    color: Colors.textMuted,
  },
});
