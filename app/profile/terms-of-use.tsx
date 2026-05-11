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
    title: "1. Acceptance of Terms",
    body: [
      "These Terms of Use govern your use of the Gutsy app and related services.",
      "By using Gutsy, you agree to these Terms and our Privacy Policy.",
      "If you do not agree, do not use the app.",
    ],
  },
  {
    title: "2. Who Operates Gutsy",
    body: [
      "Gutsy is operated by Abhilokeet Sherchan.",
      "For legal or support questions, contact: gutsyai.app@gmail.com.",
    ],
  },
  {
    title: "3. Eligibility",
    body: [
      "Gutsy is intended for users age 13 and older.",
      "If you are under the age of majority where you live, use Gutsy only with parent or legal guardian involvement as required by law.",
    ],
  },
  {
    title: "4. Account and Security",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials and for activity under your account.",
      "You must provide accurate information and keep it updated.",
      "We may suspend access to protect the service, users, or legal compliance.",
    ],
  },
  {
    title: "5. What the Service Does",
    body: [
      "Gutsy provides food scan and wellness insights, including image/barcode analysis, history, and profile-based personalization.",
      "Features may evolve over time, and some features may be added, changed, or removed.",
    ],
  },
  {
    title: "6. Medical and Health Disclaimer",
    body: [
      "Gutsy provides informational wellness content only and does not provide medical advice, diagnosis, or treatment.",
      "Do not rely on app outputs as a substitute for professional medical judgment.",
      "Always consult a qualified healthcare professional for medical decisions.",
    ],
  },
  {
    title: "7. AI and Data-Driven Outputs",
    body: [
      "Some outputs are generated using automated systems and third-party providers and may be incomplete, delayed, or inaccurate.",
      "You are responsible for how you use scan results, recommendations, and summaries.",
    ],
  },
  {
    title: "8. User Content and Uploads",
    body: [
      "You may submit content such as scan images and related inputs.",
      "You represent that you have rights to submit that content and that it does not violate law or third-party rights.",
      "You grant us a limited license to host, process, and display submitted content only as needed to operate and improve the service.",
    ],
  },
  {
    title: "9. Acceptable Use",
    body: [
      "You agree not to misuse the service, including attempting unauthorized access, interfering with app operation, scraping data at scale, reverse engineering where prohibited, or violating law.",
      "You must not upload unlawful, abusive, or infringing content.",
    ],
  },
  {
    title: "10. Subscriptions and Purchases",
    body: [
      "If paid plans or subscription features are offered, additional pricing and billing terms will apply at purchase.",
      "App store billing terms and refund rules may also apply.",
      "Restore purchases and paywall functionality may be provided through third-party tools (for example, Superwall and app store infrastructure).",
    ],
  },
  {
    title: "11. Third-Party Services",
    body: [
      "Gutsy relies on third-party infrastructure and APIs (for example, hosting, AI, and product data providers).",
      "We are not responsible for third-party services outside our reasonable control.",
    ],
  },
  {
    title: "12. Intellectual Property",
    body: [
      "The app, design, branding, and software components are owned by us or our licensors and are protected by law.",
      "Except as allowed by law, you may not copy, modify, distribute, or create derivative works from the service without permission.",
    ],
  },
  {
    title: "13. Availability and Changes",
    body: [
      "We may modify, pause, or discontinue features at any time, including for maintenance, security, or compliance reasons.",
      "We do not guarantee uninterrupted or error-free service.",
    ],
  },
  {
    title: "14. Termination",
    body: [
      "You may stop using the app at any time.",
      "We may suspend or terminate access for violations of these Terms, misuse, risk, or legal reasons.",
      "Where available, in-app account deletion controls can be used to delete your account.",
    ],
  },
  {
    title: "15. Disclaimers",
    body: [
      "The service is provided on an \"as is\" and \"as available\" basis to the extent permitted by law.",
      "To the maximum extent permitted by law, we disclaim warranties including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
    ],
  },
  {
    title: "16. Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or loss of profits, data, or goodwill.",
      "Our total liability for claims arising from the service is limited to amounts you paid us for the service in the 12 months before the claim, or USD $100 if no payments were made, unless law requires otherwise.",
    ],
  },
  {
    title: "17. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold us harmless from claims, damages, and expenses arising from your misuse of the service, your content, or your violation of these Terms or applicable law.",
    ],
  },
  {
    title: "18. Governing Law and Regional Rights",
    body: [
      "These Terms are governed by applicable laws, subject to mandatory consumer protections in your jurisdiction.",
      "If you are in the EU/EEA/UK, nothing in these Terms limits rights you cannot waive under local law.",
    ],
  },
  {
    title: "19. Changes to These Terms",
    body: [
      "We may update these Terms from time to time.",
      "If material changes are made, we will update the Last Updated date and provide notice where required.",
    ],
  },
  {
    title: "20. Contact",
    body: [
      "Terms contact: gutsyai.app@gmail.com",
      "Operator: Abhilokeet Sherchan",
    ],
  },
];

export default function TermsOfUseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Use</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Terms of Use Agreement</Text>
          <Text style={styles.introText}>
            Please review these terms carefully before using Gutsy.
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
