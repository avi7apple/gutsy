-- Visual portion learning table for storing bounding box to weight relationships

CREATE TABLE IF NOT EXISTS public.visual_portion_learning (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ingredient_key text NOT NULL,
  ingredient_name text NOT NULL,
  bounding_box jsonb NOT NULL, -- Store the bounding box data
  item_count integer NOT NULL DEFAULT 1,
  image_dimensions jsonb NOT NULL, -- Store image dimensions for scaling
  visual_area numeric NOT NULL, -- Normalized visual area (width * height)
  corrected_grams numeric NOT NULL, -- User-corrected weight in grams
  conversion_factor numeric NOT NULL, -- grams per visual unit
  sample_count integer NOT NULL DEFAULT 1,
  mean_conversion_factor numeric NOT NULL,
  m2_conversion_factor numeric NOT NULL, -- Running variance for conversion factor
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ingredient_key)
);

ALTER TABLE public.visual_portion_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own visual portion learning"
ON public.visual_portion_learning
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own visual portion learning"
ON public.visual_portion_learning
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visual portion learning"
ON public.visual_portion_learning
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_visual_portion_learning_user_samples
ON public.visual_portion_learning (user_id, sample_count DESC);

CREATE INDEX IF NOT EXISTS idx_visual_portion_learning_ingredient
ON public.visual_portion_learning (ingredient_key, sample_count DESC);

COMMENT ON TABLE public.visual_portion_learning IS 'Per-user visual-to-weight conversion learning for ingredient portions';
COMMENT ON COLUMN public.visual_portion_learning.bounding_box IS 'Bounding box coordinates from vision detection';
COMMENT ON COLUMN public.visual_portion_learning.visual_area IS 'Normalized visual area (width * height)';
COMMENT ON COLUMN public.visual_portion_learning.conversion_factor IS 'Grams per visual unit for this ingredient';
COMMENT ON COLUMN public.visual_portion_learning.m2_conversion_factor IS 'Welford running variance accumulator for conversion factor';
