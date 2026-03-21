-- Add meal-specific columns to meal_scans table for premium meal scanning feature
-- This supports the new meal detection system with ingredient analysis

-- Add meal-specific columns to existing meal_scans table
ALTER TABLE meal_scans 
ADD COLUMN is_meal BOOLEAN DEFAULT false,
ADD COLUMN meal_components JSONB DEFAULT '[]'::jsonb,
ADD COLUMN cooking_methods TEXT[] DEFAULT '{}'::text[],
ADD COLUMN portion_estimates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN ingredient_confirmations JSONB DEFAULT '{}'::jsonb,
ADD COLUMN cooking_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN portion_adjustments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN meal_confidence NUMERIC DEFAULT 0.5;

-- Add indexes for performance on meal-specific queries
CREATE INDEX idx_meal_scans_is_meal ON meal_scans(is_meal) WHERE is_meal = true;
CREATE INDEX idx_meal_scans_cooking_methods ON meal_scans USING GIN(cooking_methods);
CREATE INDEX idx_meal_scans_meal_confidence ON meal_scans(meal_confidence) WHERE meal_confidence > 0.75;

-- Add comments for documentation
COMMENT ON COLUMN meal_scans.is_meal IS 'Whether this scan was detected as a multi-ingredient meal vs single product';
COMMENT ON COLUMN meal_scans.meal_components IS 'Detailed breakdown of meal components with nutrition and gut impact';
COMMENT ON COLUMN meal_scans.cooking_methods IS 'Array of detected cooking methods (grilled, fried, boiled, etc.)';
COMMENT ON COLUMN meal_scans.portion_estimates IS 'AI-estimated portion sizes for each ingredient in grams';
COMMENT ON COLUMN meal_scans.ingredient_confirmations IS 'User confirmations for detected ingredients (true/false)';
COMMENT ON COLUMN meal_scans.cooking_analysis IS 'Analysis of cooking methods and their health impact';
COMMENT ON COLUMN meal_scans.portion_adjustments IS 'Portion adjustment options available to user';
COMMENT ON COLUMN meal_scans.meal_confidence IS 'AI confidence score for meal detection (0.0-1.0)';

-- RLS policies are already in place from the original meal_scans table
-- No additional policies needed as we're just adding columns
