import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  goal: "onboarding_goal",
  skinConcern: "onboarding_skin_concern",
  skinType: "onboarding_skin_type",
  water: "onboarding_water",
  trigger: "onboarding_trigger",
  skinFeel: "onboarding_skin_feel",
  bloating: "onboarding_bloating",
  digestion: "onboarding_digestion",
  energyMood: "onboarding_energy_mood",
  processedFood: "onboarding_processed_food",
} as const;

export type OnboardingProfile = {
  goal: string | null;
  skinConcern: string | null;
  skinType: string | null;
  water: string | null;
  trigger: string | null;
  skinFeel: string | null;
  bloating: string | null;
  digestion: string | null;
  energyMood: string | null;
  processedFood: string | null;
};

export async function saveOnboardingGoal(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.goal, label);
}

export async function saveOnboardingSkinConcern(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.skinConcern, label);
}

export async function saveOnboardingSkinType(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.skinType, label);
}

export async function saveOnboardingWater(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.water, label);
}

export async function saveOnboardingTrigger(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.trigger, label);
}

export async function saveOnboardingSkinFeel(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.skinFeel, label);
}

export async function saveOnboardingBloating(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.bloating, label);
}

export async function saveOnboardingDigestion(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.digestion, label);
}

export async function saveOnboardingEnergyMood(label: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.energyMood, label);
}

export async function saveOnboardingProcessedFood(
  label: string,
): Promise<void> {
  await AsyncStorage.setItem(KEYS.processedFood, label);
}

export async function getOnboardingProfile(): Promise<OnboardingProfile> {
  const [
    goal,
    skinConcern,
    skinType,
    water,
    trigger,
    skinFeel,
    bloating,
    digestion,
    energyMood,
    processedFood,
  ] = await Promise.all([
    AsyncStorage.getItem(KEYS.goal),
    AsyncStorage.getItem(KEYS.skinConcern),
    AsyncStorage.getItem(KEYS.skinType),
    AsyncStorage.getItem(KEYS.water),
    AsyncStorage.getItem(KEYS.trigger),
    AsyncStorage.getItem(KEYS.skinFeel),
    AsyncStorage.getItem(KEYS.bloating),
    AsyncStorage.getItem(KEYS.digestion),
    AsyncStorage.getItem(KEYS.energyMood),
    AsyncStorage.getItem(KEYS.processedFood),
  ]);
  return {
    goal,
    skinConcern,
    skinType,
    water,
    trigger,
    skinFeel,
    bloating,
    digestion,
    energyMood,
    processedFood,
  };
}
