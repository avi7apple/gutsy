import OnboardingButton from "@/components/onboarding/OnboardingButton";
import { Shimmer } from "@/components/SkeletonCard";
import { BorderRadius, Colors, Fonts, OnboardingButtonBar, Shadows, Spacing } from "@/constants/theme";
import { fetchProfileSettings, updateProfileName } from "@/lib/profile-settings";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const settings = await fetchProfileSettings();
      setFullName(settings.fullName);
      setEmail(settings.email);
    } catch (error) {
      console.error("Failed to load profile settings:", error);
      Alert.alert("Error", "Couldn't load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }

    try {
      setSaving(true);
      await updateProfileName(trimmedName);
      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert("Error", "We couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}> 
        <StatusBar style="dark" />
        <View style={{ padding: Spacing.xxl, gap: 20, paddingTop: 80 }}>
          <Shimmer width="40%" height={18} />
          <Shimmer width="100%" height={48} borderRadius={BorderRadius.md} />
          <Shimmer width="40%" height={18} style={{ marginTop: 12 }} />
          <Shimmer width="100%" height={48} borderRadius={BorderRadius.md} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Text style={[styles.label, styles.secondaryLabel]}>Email</Text>
          <TextInput
            value={email}
            editable={false}
            style={[styles.input, styles.inputDisabled]}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.helperText}>Email updates are managed by your sign-in provider.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton
          title={saving ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          disabled={saving}
          loading={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: 24,
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.massive,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  label: {
    fontFamily: Fonts.smallLabel,
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  secondaryLabel: {
    marginTop: Spacing.lg,
  },
  input: {
    backgroundColor: Colors.backgroundWhite,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.text,
  },
  inputDisabled: {
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
  },
  helperText: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    ...OnboardingButtonBar,
  },
});
