import { Colors } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback renderer; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Called when an error is caught. Use for telemetry. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-wide error boundary. Prevents a single broken screen from leaving
 * the app in an unrecoverable white/blank state. Shows a friendly retry UI
 * and calls `onError` for logging. Wrap the root (or subtrees) with this.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      this.props.onError?.(error, info);
    } catch {
      // Never throw from the boundary itself.
    }
    // Always log — this is the single source of truth for uncaught crashes.
    console.warn("[ErrorBoundary] caught error:", error?.message ?? error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app hit an unexpected error. Tap below to try again.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: rf(20),
    fontWeight: "700",
    color: Colors.text,
    marginBottom: rs(8),
    textAlign: "center",
  },
  subtitle: {
    fontSize: rf(14),
    color: Colors.textSecondary,
    marginBottom: rs(24),
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: rf(15),
  },
});
