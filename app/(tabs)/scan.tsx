import { useLocalSearchParams } from "expo-router";
import { ScanScreenContent } from "../scan-content";

export default function ScanScreen() {
  const { previousTab } = useLocalSearchParams<{ previousTab?: string }>();
  return (
    <ScanScreenContent
      variant="app"
      previousTab={previousTab ?? "index"}
    />
  );
}
