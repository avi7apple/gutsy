-- Learn per-user ingredient portion patterns from confirmation adjustments

CREATE TABLE IF NOT EXISTS public.portion_learning_stats (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ingredient_key text NOT NULL,
  ingredient_name text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  mean_grams numeric NOT NULL DEFAULT 0,
  m2 numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ingredient_key)
);

ALTER TABLE public.portion_learning_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own portion learning"
ON public.portion_learning_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own portion learning"
ON public.portion_learning_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portion learning"
ON public.portion_learning_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_portion_learning_user_samples
ON public.portion_learning_stats (user_id, sample_count DESC);

COMMENT ON TABLE public.portion_learning_stats IS 'Per-user running stats for ingredient portion corrections';
COMMENT ON COLUMN public.portion_learning_stats.m2 IS 'Welford running variance accumulator';
