/*
  # Add Chat-to-Plan Integration

  ## Description
  This migration adds support for linking training plans to chat sessions,
  allowing users to generate plans from conversational context and track
  which chat discussions informed each plan.

  ## Changes

  ### 1. New Columns in `training_plans`
  - `source_chat_session_id` (uuid, nullable) - Links to the chat session that generated this plan
  - `chat_context_snapshot` (jsonb, nullable) - Stores extracted context from chat including:
    - goals: array of stated training goals
    - constraints: time availability, equipment, injuries
    - preferences: workout types, intensity preferences
    - key_messages: array of relevant message excerpts with IDs
    - confidence_scores: object mapping fields to confidence (0-100)
    - extracted_at: timestamp of context extraction

  ### 2. Indexes
  - Index on `source_chat_session_id` for efficient lookup of plans by chat session
  - GIN index on `chat_context_snapshot` for JSON queries

  ## Notes
  - Foreign key uses ON DELETE SET NULL to preserve plans if chat is deleted
  - JSONB allows flexible storage of extracted context without schema changes
  - Existing plans will have null values (plans created manually, not from chat)
*/

-- Add chat session relationship columns to training_plans
ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS source_chat_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_context_snapshot jsonb;

-- Create index for efficient chat-to-plan lookups
CREATE INDEX IF NOT EXISTS idx_training_plans_chat_session
  ON training_plans(source_chat_session_id)
  WHERE source_chat_session_id IS NOT NULL;

-- Create GIN index for JSONB queries on context snapshot
CREATE INDEX IF NOT EXISTS idx_training_plans_chat_context
  ON training_plans USING GIN (chat_context_snapshot);

-- No RLS policy changes needed - existing policies cover these columns
