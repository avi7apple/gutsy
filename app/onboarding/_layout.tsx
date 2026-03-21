import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF8F3" },
        animation: "slide_from_right",
        gestureEnabled: route.name !== "creating-profile",
      })}
    />
  );
}
