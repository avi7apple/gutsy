import {
    BorderRadius,
    Colors,
    Fonts,
    Shadows,
    Spacing,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
};

/** Simple gut-health knowledge: keyword triggers → response. Supports learning without an API. */
const GUT_HEALTH_KNOWLEDGE: Array<{
  keywords: string[];
  response: string;
}> = [
  {
    keywords: ["probiotic", "probiotics", "fermented", "yogurt", "kefir", "kimchi", "sauerkraut"],
    response:
      "Probiotics are live bacteria and yeasts that support your gut. You can get them from fermented foods like yogurt, kefir, kimchi, and sauerkraut, or from supplements. They help balance your gut microbiome and may improve digestion and immunity. Try including a serving of fermented food daily.",
  },
  {
    keywords: ["prebiotic", "prebiotics", "fiber"],
    response:
      "Prebiotics are types of fiber that feed the good bacteria in your gut. Foods rich in prebiotics include garlic, onions, leeks, asparagus, bananas, oats, and whole grains. Eating a variety of fiber-rich foods helps your microbiome thrive and supports regular digestion.",
  },
  {
    keywords: ["bloat", "bloating", "gas", "gassy"],
    response:
      "Bloating can come from eating too fast, carbonated drinks, high-sodium or highly processed foods, or certain hard-to-digest carbs. Tips: eat slowly, chew well, limit fizzy drinks, and try reducing obvious triggers (e.g. beans, cruciferous veggies) if they bother you. Staying hydrated and moving after meals can also help.",
  },
  {
    keywords: ["gut health", "gut microbiome", "microbiome", "what is gut"],
    response:
      "Gut health refers to the balance and function of your digestive system and the trillions of bacteria (microbiome) living in it. A healthy gut helps with digestion, nutrient absorption, immunity, and even mood. You can support it with fiber, probiotics, varied whole foods, and less ultra-processed food.",
  },
  {
    keywords: ["digestion", "digest", "digestive"],
    response:
      "Good digestion means your body breaks down food and absorbs nutrients smoothly. To support it: eat mindfully and chew well, stay hydrated, include fiber from fruits and vegetables, and avoid large heavy meals late at night. Regular movement and managing stress also help your digestive system work better.",
  },
  {
    keywords: ["score", "gutsy score", "gut score", "how is my score"],
    response:
      "Your Gutsy score reflects how your recent food choices and habits may be affecting your gut. Scanning foods and logging meals helps the app give you personalized feedback. Focus on variety, whole foods, and less processed options to help your score trend in a positive direction over time.",
  },
  {
    keywords: ["water", "hydrat", "drink"],
    response:
      "Staying hydrated helps digestion by keeping things moving and supporting the mucosal lining of your gut. Aim for enough water throughout the day—often around 8 glasses, but listen to your body and activity level. Herbal teas and water-rich foods (like cucumber and melon) count too.",
  },
  {
    keywords: ["stress", "anxiety", "nervous", "gut brain"],
    response:
      "The gut and brain are connected (the gut–brain axis). Stress and anxiety can affect digestion and vice versa. Simple steps: eat in a calm setting when possible, practice deep breathing or short walks, and get enough sleep. Over time, a healthier gut can also support a calmer mood.",
  },
  {
    keywords: ["processed", "junk", "unhealthy", "bad food"],
    response:
      "Highly processed foods often have lots of sugar, salt, and additives and little fiber, which can disrupt your gut microbiome and cause inflammation. Try to base your diet on whole foods—fruits, vegetables, whole grains, legumes, and lean proteins—and use processed foods as occasional treats rather than staples.",
  },
  {
    keywords: ["tip", "tips", "advice", "improve", "better", "help my gut"],
    response:
      "Here are simple ways to support your gut: 1) Eat a variety of plants (fruits, veggies, whole grains). 2) Include fermented foods or a probiotic if it suits you. 3) Stay hydrated. 4) Move regularly. 5) Limit ultra-processed foods. 6) Eat slowly and manage stress. Small, consistent changes add up.",
  },
  {
    keywords: ["hello", "hi", "hey", "help"],
    response:
      "Hi! I'm your Gut Helper. Ask me about gut health, probiotics, bloating, digestion, your Gutsy score, or how to feel better. Try: \"What are probiotics?\" or \"Tips for better digestion?\"",
  },
];

function getBotResponse(userText: string): string {
  const lower = userText.trim().toLowerCase();
  if (!lower) return "Type a question about gut health and I'll do my best to help!";

  for (const { keywords, response } of GUT_HEALTH_KNOWLEDGE) {
    if (keywords.some((k) => lower.includes(k))) return response;
  }

  return "That's a great question. I'm best at topics like probiotics, prebiotics, bloating, digestion, gut health basics, and tips to improve your gut. Try asking about one of those, or say \"tips\" for general advice!";
}

const SUGGESTED_PROMPTS = [
  "What are probiotics?",
  "Tips for better digestion",
  "Why do I feel bloated?",
  "What is gut health?",
];

export default function GutHelperScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Hi! I'm your Gut Helper. Ask me anything about gut health—probiotics, bloating, digestion, or how to feel better. Tap a prompt below or type your own question.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setInput("");
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const reply = getBotResponse(trimmed);
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleSend = () => sendMessage(input);
  const handleSuggested = (prompt: string) => sendMessage(prompt);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* Header — white to top of screen */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={[styles.avatar, { backgroundColor: Colors.primary + "22" }]}>
          <Ionicons name="leaf" size={24} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Gut Helper</Text>
          <Text style={styles.headerSubtitle}>Learn about gut health</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={[styles.messagesContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubbleWrap, msg.role === "user" ? styles.bubbleWrapUser : undefined]}
            >
              <View
                style={[
                  styles.bubble,
                  msg.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[styles.bubbleText, msg.role === "user" ? styles.bubbleTextUser : undefined]}
                  selectable
                >
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
          {isTyping && (
            <View style={[styles.bubbleWrap]}>
              <View style={[styles.bubble, styles.bubbleBot]}>
                <Text style={styles.bubbleText}>...</Text>
              </View>
            </View>
          )}
          {/* Show suggested prompts after initial welcome and after each bot response */}
          {(messages.length <= 1 || (messages.length > 1 && messages[messages.length - 1]?.role === "bot")) && (
            <View style={styles.suggestedWrap}>
              <Text style={styles.suggestedLabel}>Try asking</Text>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={[styles.suggestedChip, { borderColor: Colors.primary }]}
                  onPress={() => handleSuggested(prompt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestedChipText, { color: Colors.primary }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about gut health..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: Colors.primary }]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  headerText: {},
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.cardTitle,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
  },
  bubbleWrap: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    justifyContent: "flex-start",
  },
  bubbleWrapUser: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "85%",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  bubbleBot: {
    backgroundColor: Colors.backgroundWhite,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
  },
  bubbleText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: "#FFF",
  },
  suggestedWrap: {
    marginTop: Spacing.lg,
  },
  suggestedLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  suggestedChip: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  suggestedChipText: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    fontFamily: Fonts.body,
    ...Shadows.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
