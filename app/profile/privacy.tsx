import { BorderRadius, Colors, Fonts, Shadows, Spacing } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LAST_UPDATED = "March 7, 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Who We Are",
    body: [
      "Gutsy is operated by Abhilokeet Sherchan.",
      "If you have privacy questions or requests, contact: gutsyai.app@gmail.com.",
    ],
  },
  {
    title: "2. Scope",
    body: [
      "This Privacy Policy explains how we collect, use, store, and share information when you use the Gutsy app, including scan and profile features.",
      "By using Gutsy, you agree to this policy.",
    ],
  },
  {
    title: "3. Information We Collect",
    body: [
      "Account and profile data: email, name, profile preferences, onboarding answers, and account metadata.",
      "Scan data: food/product names, barcode details, analysis results, gut/score fields, and timestamps.",
      "Images: photo scans may be uploaded and stored securely to support scan results and history.",
      "Technical and usage data: app events, diagnostics, and logs needed for reliability and fraud/abuse prevention.",
    ],
  },
  {
    title: "4. How We Use Information",
    body: [
      "To provide app functionality (scan analysis, history, profile, and account features).",
      "To personalize your experience based on your profile and wellness preferences.",
      "To maintain security, troubleshoot issues, and improve product performance.",
      "To communicate essential account or service updates.",
    ],
  },
  {
    title: "5. Legal Bases (EU/EEA/UK Users)",
    body: [
      "Where required, we process personal data under one or more legal bases: performance of a contract, legitimate interests, legal obligations, and consent.",
      "You can request details about the legal basis for specific processing by contacting us.",
    ],
  },
  {
    title: "6. How We Share Information",
    body: [
      "We share data only with service providers/processors needed to run Gutsy, such as cloud hosting/database, AI analysis providers, and product/barcode data providers.",
      "We do not sell your personal information.",
      "If subscriptions/paywalls are enabled, we may use providers such as Superwall to operate subscription experiences.",
    ],
  },
  {
    title: "7. Storage, Security, and Retention",
    body: [
      "We use technical and organizational safeguards designed to protect data, but no system is 100% secure.",
      "We retain information for as long as needed to provide the service and meet legal, accounting, and security obligations.",
      "When data is no longer needed, we delete or de-identify it where practical.",
    ],
  },
  {
    title: "8. Your Rights and Choices",
    body: [
      "In-app controls let you manage and delete scan records.",
      "In-app account deletion is available in the app account controls.",
      "You may also request access, correction, deletion, portability, or restriction/objection rights by emailing gutsyai.app@gmail.com.",
      "For California users, we do not sell personal information.",
    ],
  },
  {
    title: "9. Children’s Privacy",
    body: [
      "Gutsy is intended for users age 13 and older.",
      "If you believe data from a child under 13 was provided, contact us and we will review and remove it as appropriate.",
    ],
  },
  {
    title: "10. International Data Transfers",
    body: [
      "Gutsy serves users in the United States and may serve users in the EU/EEA/UK.",
      "Your information may be processed in countries other than your own, with appropriate safeguards where required by law.",
    ],
  },
  {
    title: "11. Health Disclaimer",
    body: [
      "Gutsy provides wellness and nutrition insights for informational purposes only and is not medical advice.",
      "Always seek professional medical guidance for diagnosis or treatment decisions.",
    ],
  },
  {
    title: "12. Changes to This Policy",
    body: [
      "We may update this policy from time to time.",
      "If we make material changes, we will update the Last Updated date and provide notice where required.",
    ],
  },
  {
    title: "13. Contact",
    body: [
      "Privacy contact: gutsyai.app@gmail.com",
      "Owner: Abhilokeet Sherchan",
    ],
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introText}>
            This policy explains how Gutsy collects, uses, and protects your information.
          </Text>
          <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body.map((paragraph, index) => (
              <Text key={`${section.title}-${index}`} style={styles.sectionBody}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: rs(36),
    height: rs(36),
    borderRadius: rs(18),
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Fonts.pageTitle,
    fontSize: rf(28),
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  introCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  introTitle: {
    fontFamily: Fonts.cardTitle,
    fontSize: rf(20),
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  introText: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    lineHeight: rf(21),
    marginBottom: Spacing.md,
  },
  lastUpdated: {
    fontFamily: Fonts.smallLabel,
    fontSize: rf(13),
    color: Colors.textMuted,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.sectionHeader,
    fontSize: rf(16),
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    fontFamily: Fonts.body,
    fontSize: rf(14),
    color: Colors.textSecondary,
    lineHeight: rf(21),
    marginBottom: Spacing.sm,
  },
});
