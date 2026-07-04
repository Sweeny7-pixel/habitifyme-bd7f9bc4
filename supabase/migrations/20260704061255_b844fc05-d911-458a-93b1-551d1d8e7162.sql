ALTER TABLE public.workout_days ADD COLUMN IF NOT EXISTS workout_date date;
CREATE INDEX IF NOT EXISTS workout_days_user_date_idx ON public.workout_days (user_id, workout_date);
UPDATE public.workout_days wd
SET workout_date = (w.start_date + (wd.day_index - 1))::date
FROM public.weeks w
WHERE wd.week_id = w.id AND wd.workout_date IS NULL;