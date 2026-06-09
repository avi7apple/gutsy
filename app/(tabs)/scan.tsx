import { useLocalSearchParams } from "expo-router";
import { ScanScreenContent } from "../scan-content";

export default function ScanScreen() {
  const { previousTab, barcode } = useLocalSearchParams<{ previousTab?: string; barcode?: string }>();
  return (
    <ScanScreenContent
      variant="app"
      previousTab={previousTab ?? "index"}
      barcode={barcode}
    />
  );
}
