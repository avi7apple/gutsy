import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { rf } from '@/lib/hooks/use-responsive';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: rf(16),
    lineHeight: rf(24),
  },
  defaultSemiBold: {
    fontSize: rf(16),
    lineHeight: rf(24),
    fontWeight: '600',
  },
  title: {
    fontSize: rf(32),
    fontWeight: 'bold',
    lineHeight: rf(32),
  },
  subtitle: {
    fontSize: rf(20),
    fontWeight: 'bold',
  },
  link: {
    lineHeight: rf(30),
    fontSize: rf(16),
    color: '#0a7ea4',
  },
});
