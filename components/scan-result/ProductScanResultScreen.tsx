import { ScanResultColors } from "@/constants/theme";
import { getProductInsightFromScan } from "@/lib/scan-result/map-legacy-scan";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import type { ProductAlternative, ProductInsight } from "@/types/product-scan";
import type { ScanResult } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AtAGlanceCard } from "./AtAGlanceCard";
import { BetterAlternativesCard } from "./BetterAlternativesCard";
import { HealthFlagsCard } from "./HealthFlagsCard";
import { IngredientAnalysisCard } from "./IngredientAnalysisCard";
import { ProductInfoCard } from "./ProductInfoCard";
import { ScanResultCTAs } from "./ScanResultCTAs";
import { SHARE_CARD_WIDTH, ShareCard } from "./ShareCard";
import { H_PAD, SECTION_GAP } from "./scan-result-styles";

interface ProductScanResultScreenProps {
  result: ScanResult;
  savedAlternatives: AlternativeProduct[] | null;
  alternativesLoading?: boolean;
  scrollEnabled?: boolean;
  sheetFullScreen?: boolean;
  onDismiss: () => void;
  onExpand?: () => void;
  onScanAgain: () => void;
  onSave: () => void;
  onShare: (shareRef: React.RefObject<View | null>) => void;
  onSelectAlternative: (alt: ProductAlternative) => void;
  saving?: boolean;
  saved?: boolean;
  sharing?: boolean;
  isFavorite?: boolean;
}

export function ProductScanResultScreen({
  result,
  savedAlternatives,
  alternativesLoading,
  scrollEnabled = true,
  sheetFullScreen = true,
  onDismiss,
  onExpand,
  onScanAgain,
  onSave,
  onShare,
  onSelectAlternative,
  saving,
  saved,
  sharing,
  isFavorite,
}: ProductScanResultScreenProps) {
  const insets = useSafeAreaInsets();
  const shareRef = useRef<View>(null);
  const [favorited, setFavorited] = useState(isFavorite ?? false);

  const insight: ProductInsight = useMemo(
    () => getProductInsightFromScan(result, savedAlternatives),
    [result, savedAlternatives],
  );

  const alternatives = insight.alternatives;

  return (
    <View style={[styles.root, { paddingTop: insets.top || 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={onDismiss} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={ScanResultColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Result</Text>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              setFavorited(true);
              onSave();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={favorited || saved ? "heart" : "heart-outline"}
              size={16}
              color={ScanResultColors.heart}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        <ProductInfoCard
          insight={insight}
          bloatScore={result.bloat_score}
          skinScore={result.skin_score}
          digestionScore={result.digestion_score}
          energyScore={result.energy_score}
          impactDetails={result.analysis.impactDetails}
        />
        <View style={styles.gap} />
        <AtAGlanceCard atAGlance={insight.atAGlance} />
        <View style={styles.gap} />
        {(insight.ingredients.length > 0 || (result.ingredients?.length ?? 0) > 0) ? (
          <>
            <IngredientAnalysisCard
              ingredients={insight.ingredients}
              rawLabelIngredients={result.ingredients}
            />
            <View style={styles.gap} />
          </>
        ) : null}
        <HealthFlagsCard flags={insight.healthFlags} />
        <View style={styles.gap} />
        <BetterAlternativesCard
          alternatives={alternatives}
          loading={alternativesLoading}
          onSelectAlternative={onSelectAlternative}
          onScanToCompare={onScanAgain}
        />
        <View style={styles.gap} />
        <ScanResultCTAs
          onShare={() => onShare(shareRef)}
          onScanAgain={onScanAgain}
          onSave={() => {
            setFavorited(true);
            onSave();
          }}
          saving={saving}
          saved={saved || favorited}
          sharing={sharing}
        />
        <Text style={styles.disclaimer}>
          Gutsy provides wellness and nutrition insights for informational
          purposes only. This is not medical advice.
        </Text>
      </ScrollView>

      <View style={styles.offscreen} pointerEvents="none">
        <View ref={shareRef} collapsable={false}>
          <ShareCard insight={insight} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ScanResultColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: H_PAD,
    paddingBottom: 8,
    minHeight: 44,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ScanResultColors.card,
    borderWidth: 1,
    borderColor: ScanResultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: ScanResultColors.textPrimary,
  },
  headerRight: { flexDirection: "row", gap: 8 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 6,
  },
  gap: { height: SECTION_GAP },
  disclaimer: {
    fontSize: 11,
    color: ScanResultColors.textMuted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: SECTION_GAP,
  },
  offscreen: {
    position: "absolute",
    left: -SHARE_CARD_WIDTH - 40,
    top: 0,
    opacity: 1,
  },
});
