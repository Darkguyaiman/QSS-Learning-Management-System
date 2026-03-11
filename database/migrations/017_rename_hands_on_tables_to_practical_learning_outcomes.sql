-- Migration: Rename hands-on tables to practical learning outcomes
RENAME TABLE
  hands_on_aspects_settings TO practical_learning_outcomes_settings,
  hands_on_aspects TO practical_learning_outcomes,
  hands_on_scores TO practical_learning_outcome_scores;