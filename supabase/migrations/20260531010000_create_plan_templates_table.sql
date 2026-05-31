-- Migration: Create Plan Templates Table
-- Stores pre-built training plan templates and seeds standard templates

CREATE TABLE IF NOT EXISTS plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  goal text NOT NULL,
  duration_weeks integer NOT NULL,
  workouts jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;

-- Create read policy for authenticated users
CREATE POLICY "Anyone can read templates" ON plan_templates
  FOR SELECT TO authenticated USING (true);

-- Seed Plan Templates
INSERT INTO plan_templates (name, description, goal, duration_weeks, workouts) VALUES
(
  'Active Recovery Week',
  'A single-week active recovery schedule designed to reduce training fatigue, improve joint mobility, and restore energy levels. Ideal after a heavy block of training or event.',
  'Active Recovery',
  1,
  '[
    {
      "week": 1,
      "dayOfWeek": 2,
      "name": "Vinyasa Yoga & Mobility",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Follow a gentle yoga session focusing on hip openers, hamstring flexibility, and upper body release. Keep movements slow and controlled.",
      "activity_metadata": { "yoga_style": "vinyasa" }
    },
    {
      "week": 1,
      "dayOfWeek": 3,
      "name": "Active Recovery Spin",
      "type": "bike",
      "duration": 45,
      "intensity": "recovery",
      "description": "Keep the gears light and spin at a high cadence (85-95 RPM) on flat terrain. Heart rate should stay strictly in Zone 1 (Active Recovery)."
    },
    {
      "week": 1,
      "dayOfWeek": 5,
      "name": "Restorative Yoga & Core",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Restorative postures held for longer durations (2-3 mins) combined with light core activation.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 1,
      "dayOfWeek": 6,
      "name": "Easy Aerobic Run",
      "type": "run",
      "duration": 40,
      "intensity": "easy",
      "description": "A relaxed, conversational-pace run. Focus on light foot strikes and deep breathing.",
      "activity_metadata": { "pace_zone": "Zone 2 conversational pace" }
    }
  ]'::jsonb
),
(
  '4-Week Base Builder',
  'A foundational 4-week base building plan. Volume builds up progressively during weeks 1 to 3, followed by a scheduled recovery week in week 4 to consolidate fitness gains.',
  'Aerobic Base Fitness',
  4,
  '[
    {
      "week": 1,
      "dayOfWeek": 2,
      "name": "Easy Endurance Ride",
      "type": "bike",
      "duration": 60,
      "intensity": "easy",
      "description": "Easy endurance ride. Maintain steady pacing."
    },
    {
      "week": 1,
      "dayOfWeek": 4,
      "name": "Full Body Strength Foundation",
      "type": "strength",
      "duration": 45,
      "intensity": "easy",
      "description": "Full body strength foundation. Focus on form and control.",
      "activity_metadata": { "sets_reps": "3x10 squats, deadlifts, and overhead press" }
    },
    {
      "week": 1,
      "dayOfWeek": 6,
      "name": "Long Base Run",
      "type": "run",
      "duration": 45,
      "intensity": "easy",
      "description": "Long base run. Keep effort steady and conversational.",
      "activity_metadata": { "pace_zone": "Zone 2 aerobic base" }
    },
    {
      "week": 2,
      "dayOfWeek": 2,
      "name": "Aerobic Endurance Ride",
      "type": "bike",
      "duration": 75,
      "intensity": "easy",
      "description": "Aerobic endurance ride. Add 15 mins to last week."
    },
    {
      "week": 2,
      "dayOfWeek": 4,
      "name": "Full Body Strength Progression",
      "type": "strength",
      "duration": 45,
      "intensity": "easy",
      "description": "Full body strength progression. Focus on compound lifts.",
      "activity_metadata": { "sets_reps": "3x10 squats, chest press, and rows" }
    },
    {
      "week": 2,
      "dayOfWeek": 5,
      "name": "Mobility & Recovery Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Mobility and recovery. Stretch out major lower body muscle groups.",
      "activity_metadata": { "yoga_style": "vinyasa" }
    },
    {
      "week": 2,
      "dayOfWeek": 6,
      "name": "Base Run",
      "type": "run",
      "duration": 45,
      "intensity": "easy",
      "description": "Base run. Steady pace.",
      "activity_metadata": { "pace_zone": "Zone 2 aerobic base" }
    },
    {
      "week": 3,
      "dayOfWeek": 2,
      "name": "Long Base Ride",
      "type": "bike",
      "duration": 90,
      "intensity": "easy",
      "description": "Long base ride. Maintain steady cadence."
    },
    {
      "week": 3,
      "dayOfWeek": 4,
      "name": "Full Body Strength",
      "type": "strength",
      "duration": 45,
      "intensity": "easy",
      "description": "Full body strength. Maintain base volumes.",
      "activity_metadata": { "sets_reps": "3x10 squats, deadlifts, and pull-downs" }
    },
    {
      "week": 3,
      "dayOfWeek": 5,
      "name": "Recovery Yoga Session",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Recovery yoga session.",
      "activity_metadata": { "yoga_style": "yin" }
    },
    {
      "week": 3,
      "dayOfWeek": 6,
      "name": "Long Base Run Progression",
      "type": "run",
      "duration": 60,
      "intensity": "easy",
      "description": "Long base run progression. Gradually increase duration.",
      "activity_metadata": { "pace_zone": "Zone 2 aerobic base" }
    },
    {
      "week": 4,
      "dayOfWeek": 2,
      "name": "Light Active Recovery Ride",
      "type": "bike",
      "duration": 45,
      "intensity": "recovery",
      "description": "Light active recovery ride."
    },
    {
      "week": 4,
      "dayOfWeek": 4,
      "name": "Gentle Restorative Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Gentle restorative yoga.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 4,
      "dayOfWeek": 6,
      "name": "Short Easy Run",
      "type": "run",
      "duration": 30,
      "intensity": "easy",
      "description": "Short easy run.",
      "activity_metadata": { "pace_zone": "Zone 2 conversational pace" }
    }
  ]'::jsonb
),
(
  '8-Week Gran Fondo Prep',
  'An 8-week structured progression designed for cycling endurance events. Progresses through Base, Build, Peak, and Taper phases with intervals and long weekend rides.',
  'Gran Fondo Preparation',
  8,
  '[
    {
      "week": 1,
      "dayOfWeek": 2,
      "name": "Endurance Ride",
      "type": "bike",
      "duration": 60,
      "intensity": "easy",
      "description": "Keep effort steady in Zone 2. Focus on pedal stroke efficiency."
    },
    {
      "week": 1,
      "dayOfWeek": 4,
      "name": "Base Ride with Sprints",
      "type": "bike",
      "duration": 45,
      "intensity": "easy",
      "description": "Zone 2 ride with 3x15-second high cadence spin-ups on flats."
    },
    {
      "week": 1,
      "dayOfWeek": 6,
      "name": "Long Endurance Ride",
      "type": "bike",
      "duration": 120,
      "intensity": "easy",
      "description": "The key ride of the week. Steady endurance pacing. Practice fueling."
    },
    {
      "week": 1,
      "dayOfWeek": 7,
      "name": "Post-Ride Mobility Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Stretch out calves, hamstrings, glutes, and lower back.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 2,
      "dayOfWeek": 2,
      "name": "Endurance Ride",
      "type": "bike",
      "duration": 75,
      "intensity": "easy",
      "description": "Slightly longer mid-week endurance ride in Zone 2."
    },
    {
      "week": 2,
      "dayOfWeek": 4,
      "name": "Base Ride with Sprints",
      "type": "bike",
      "duration": 45,
      "intensity": "easy",
      "description": "Zone 2 ride with 4x15-second high cadence spin-ups."
    },
    {
      "week": 2,
      "dayOfWeek": 6,
      "name": "Long Endurance Ride",
      "type": "bike",
      "duration": 135,
      "intensity": "easy",
      "description": "Build endurance volume. Practice Event-day nutrition strategy."
    },
    {
      "week": 2,
      "dayOfWeek": 7,
      "name": "Post-Ride Mobility Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Post-ride lower body stretch session.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 3,
      "dayOfWeek": 2,
      "name": "Endurance Ride",
      "type": "bike",
      "duration": 90,
      "intensity": "easy",
      "description": "Peak base week mid-week endurance ride."
    },
    {
      "week": 3,
      "dayOfWeek": 4,
      "name": "Base Ride with Sprints",
      "type": "bike",
      "duration": 45,
      "intensity": "easy",
      "description": "Zone 2 ride with 5x15-second high cadence spin-ups."
    },
    {
      "week": 3,
      "dayOfWeek": 6,
      "name": "Long Endurance Ride",
      "type": "bike",
      "duration": 150,
      "intensity": "easy",
      "description": "Peak base week long ride. Try to hit target climbing volume."
    },
    {
      "week": 3,
      "dayOfWeek": 7,
      "name": "Post-Ride Mobility Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Deep restorative stretches for cyclists.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 4,
      "dayOfWeek": 2,
      "name": "Sweet Spot Intervals",
      "type": "bike",
      "duration": 60,
      "intensity": "hard",
      "description": "Warm up 10 mins, then perform 2x15-minute intervals at Sweet Spot (88-93% FTP) with 5 mins recovery in between."
    },
    {
      "week": 4,
      "dayOfWeek": 4,
      "name": "Strength and Core",
      "type": "strength",
      "duration": 45,
      "intensity": "moderate",
      "description": "Lower body strength and core stability workout. Squats and planks.",
      "activity_metadata": { "sets_reps": "3x10 squats, lunges, and side planks" }
    },
    {
      "week": 4,
      "dayOfWeek": 6,
      "name": "Long Endurance Ride",
      "type": "bike",
      "duration": 150,
      "intensity": "moderate",
      "description": "Steady endurance ride containing 3x10-minute efforts at tempo pace."
    },
    {
      "week": 4,
      "dayOfWeek": 7,
      "name": "Deep Recovery Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Yin yoga focusing on deep hamstring releases.",
      "activity_metadata": { "yoga_style": "yin" }
    },
    {
      "week": 5,
      "dayOfWeek": 2,
      "name": "Sweet Spot Progression",
      "type": "bike",
      "duration": 70,
      "intensity": "hard",
      "description": "Warm up, then perform 2x18-minute intervals at Sweet Spot (88-93% FTP). 5 mins recovery."
    },
    {
      "week": 5,
      "dayOfWeek": 4,
      "name": "Strength and Core",
      "type": "strength",
      "duration": 45,
      "intensity": "moderate",
      "description": "Core stability and leg strength reinforcement.",
      "activity_metadata": { "sets_reps": "3x10 kettlebell swings, step-ups, and planks" }
    },
    {
      "week": 5,
      "dayOfWeek": 6,
      "name": "Long Endurance Ride",
      "type": "bike",
      "duration": 165,
      "intensity": "moderate",
      "description": "Long endurance ride. Include 3x15-minute tempo pacing efforts."
    },
    {
      "week": 5,
      "dayOfWeek": 7,
      "name": "Deep Recovery Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Slow restorative yoga stretching.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 6,
      "dayOfWeek": 2,
      "name": "Threshold Intervals",
      "type": "bike",
      "duration": 60,
      "intensity": "hard",
      "description": "Warm up, then perform 3x10-minute intervals at threshold (95-100% FTP) with 5 mins recovery."
    },
    {
      "week": 6,
      "dayOfWeek": 4,
      "name": "Strength and Core",
      "type": "strength",
      "duration": 45,
      "intensity": "moderate",
      "description": "Functional strength maintenance.",
      "activity_metadata": { "sets_reps": "3x10 single-leg squats, planks, and rows" }
    },
    {
      "week": 6,
      "dayOfWeek": 6,
      "name": "Long Build Ride",
      "type": "bike",
      "duration": 180,
      "intensity": "moderate",
      "description": "Long endurance ride. Target 4x15-minute tempo efforts in the final half."
    },
    {
      "week": 6,
      "dayOfWeek": 7,
      "name": "Deep Recovery Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Restorative stretch to reset after the peak week.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 7,
      "dayOfWeek": 2,
      "name": "Climbing Intervals",
      "type": "bike",
      "duration": 75,
      "intensity": "hard",
      "description": "Warm up, then perform 3x10-minute hill intervals (or low-cadence flats at 95-105% FTP). 5 mins recovery."
    },
    {
      "week": 7,
      "dayOfWeek": 4,
      "name": "Active Recovery Ride",
      "type": "bike",
      "duration": 45,
      "intensity": "easy",
      "description": "Spin light in Zone 1-2. Keep muscles loose."
    },
    {
      "week": 7,
      "dayOfWeek": 6,
      "name": "Event Simulation Ride",
      "type": "bike",
      "duration": 180,
      "intensity": "hard",
      "description": "Long ride matching target race pace. Include 2x30-minute blocks at tempo/sweet spot."
    },
    {
      "week": 7,
      "dayOfWeek": 7,
      "name": "Deep Recovery Yoga",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Yin yoga focusing on hip flexors and lower back release.",
      "activity_metadata": { "yoga_style": "yin" }
    },
    {
      "week": 8,
      "dayOfWeek": 2,
      "name": "Taper Tune-Up",
      "type": "bike",
      "duration": 45,
      "intensity": "hard",
      "description": "Warm up, then perform 3x1-minute fast spin efforts in Zone 4/5 to keep systems primed. 2 mins recovery between."
    },
    {
      "week": 8,
      "dayOfWeek": 4,
      "name": "Taper Mobility Session",
      "type": "yoga",
      "duration": 30,
      "intensity": "recovery",
      "description": "Light, gentle stretching. Focus on breathing and relaxation.",
      "activity_metadata": { "yoga_style": "restorative" }
    },
    {
      "week": 8,
      "dayOfWeek": 6,
      "name": "Light Open Ride",
      "type": "bike",
      "duration": 60,
      "intensity": "easy",
      "description": "Short, easy spin with a few 15-second light accelerations to keep legs fresh."
    }
  ]'::jsonb
);
