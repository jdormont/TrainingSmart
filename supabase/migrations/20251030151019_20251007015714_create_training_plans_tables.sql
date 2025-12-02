/*
  # Create Training Plans Tables

  ## Description
  This migration creates tables to store user training plans and workouts,
  allowing users to access their personalized training plans from any device.

  ## New Tables

  ### `training_plans`
  Stores the main training plan information:
  - `id` (uuid, primary key) - Unique plan identifier
  - `user_id` (uuid) - Foreign key to auth.users
  - `name` (text) - Plan name/title
  - `description` (text) - Detailed plan description
  - `goal` (text) - User's training goal
  - `start_date` (date) - Plan start date
  - `end_date` (date) - Plan end date
  - `created_at` (timestamptz) - When plan was created
  - `updated_at` (timestamptz) - When plan was last modified

  ### `workouts`
  Stores individual workout sessions within a plan:
  - `id` (uuid, primary key) - Unique workout identifier
  - `plan_id` (uuid) - Foreign key to training_plans
  - `user_id` (uuid) - Foreign key to auth.users
  - `name` (text) - Workout name
  - `type` (text) - Workout type (run, bike, swim, strength, rest)
  - `description` (text) - Detailed workout description
  - `duration` (integer) - Duration in minutes
  - `distance` (numeric) - Distance in meters (optional)
  - `intensity` (text) - Intensity level (easy, moderate, hard, recovery)
  - `scheduled_date` (date) - When workout is scheduled
  - `completed` (boolean) - Whether workout was completed
  - `created_at` (timestamptz) - When workout was created

  ## Security
  - RLS enabled on both tables
  - Users can only access their own plans and workouts
  - Separate policies for SELECT, INSERT, UPDATE, DELETE operations
*/

-- Create training_plans table
CREATE TABLE IF NOT EXISTS training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  goal text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES training_plans(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('run', 'bike', 'swim', 'strength', 'rest')),
  description text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 0,
  distance numeric,
  intensity text NOT NULL DEFAULT 'moderate' CHECK (intensity IN ('easy', 'moderate', 'hard', 'recovery')),
  scheduled_date date NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_training_plans_user_id ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_dates ON training_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_workouts_plan_id ON workouts(plan_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date ON workouts(scheduled_date);

-- Enable Row Level Security
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_plans

CREATE POLICY "Users can view their own training plans"
  ON training_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training plans"
  ON training_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training plans"
  ON training_plans
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training plans"
  ON training_plans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for workouts

CREATE POLICY "Users can view their own workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workouts"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
  ON workouts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
  ON workouts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);