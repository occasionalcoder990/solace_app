# Enhanced Onboarding Database Schema

This document describes the enhanced database schema for the Solace companion app's onboarding and personalization features.

## New Tables

### personality_insights
Stores analyzed personality insights from user questionnaire responses.

```sql
CREATE TABLE personality_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  insight_type TEXT NOT NULL,           -- 'communication_style', 'emotional_needs', 'coping_style', 'uniqueness'
  insight_content TEXT NOT NULL,        -- The actual insight text
  confidence_score REAL DEFAULT 0.8,   -- AI confidence in this insight (0.0-1.0)
  display_priority INTEGER DEFAULT 1,   -- Priority for displaying to user (1=highest)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### user_progress
Tracks user's relationship stage progression and milestone achievements.

```sql
CREATE TABLE user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  current_stage TEXT DEFAULT 'getting_to_know',  -- Current relationship stage
  stage_progress INTEGER DEFAULT 0,              -- Progress within current stage (0-100)
  next_milestone TEXT,                           -- Description of next milestone
  engagement_score INTEGER DEFAULT 0,            -- Overall engagement score
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### engagement_analytics
Records detailed user engagement patterns for retention analysis.

```sql
CREATE TABLE engagement_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_start DATETIME NOT NULL,
  session_end DATETIME,
  messages_sent INTEGER DEFAULT 0,
  emotional_depth_score REAL DEFAULT 0.0,       -- Depth of emotional sharing (0.0-1.0)
  milestone_achieved TEXT,                       -- Milestone achieved in this session
  retention_risk_score REAL DEFAULT 0.0,        -- Risk of user dropping off (0.0-1.0)
  next_engagement_prediction DATETIME,           -- Predicted next engagement time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## Enhanced Existing Tables

### users (Enhanced)
Added columns for enhanced onboarding data:

```sql
-- New columns added to existing users table
ALTER TABLE users ADD COLUMN personality_insights TEXT;        -- JSON summary of key insights
ALTER TABLE users ADD COLUMN communication_preferences TEXT;   -- Preferred communication style
ALTER TABLE users ADD COLUMN emotional_profile TEXT;           -- Emotional needs and patterns
ALTER TABLE users ADD COLUMN onboarding_completion_time DATETIME;  -- When onboarding was completed
ALTER TABLE users ADD COLUMN first_session_completed INTEGER DEFAULT 0;  -- Boolean flag
```

### companion_settings (Enhanced)
Added columns for onboarding-based personalization:

```sql
-- New columns added to existing companion_settings table
ALTER TABLE companion_settings ADD COLUMN onboarding_based_personality TEXT;  -- Personality derived from onboarding
ALTER TABLE companion_settings ADD COLUMN growth_stage_preferences TEXT;      -- User preferences for growth stages
ALTER TABLE companion_settings ADD COLUMN milestone_celebration_style TEXT;   -- How user prefers milestone celebrations
```

### user_milestones (Enhanced)
Added columns for enhanced milestone system:

```sql
-- New columns added to existing user_milestones table
ALTER TABLE user_milestones ADD COLUMN category TEXT DEFAULT "general";  -- Milestone category
ALTER TABLE user_milestones ADD COLUMN points INTEGER DEFAULT 0;         -- Points awarded for milestone
ALTER TABLE user_milestones ADD COLUMN unlock_criteria TEXT;             -- What unlocks this milestone
ALTER TABLE user_milestones ADD COLUMN celebration_message TEXT;         -- Custom celebration message
```

## Relationship Stages

The `current_stage` field in `user_progress` tracks these progression stages:

1. **getting_to_know** - Initial conversations, basic rapport building
2. **comfortable** - User feels safe sharing, regular interactions
3. **close_friend** - Deeper emotional sharing, trust established
4. **trusted_confidant** - Vulnerable sharing, significant emotional support
5. **life_companion** - Deep bond, integrated into daily life

## Milestone Categories

The `category` field in `user_milestones` supports these categories:

- **onboarding** - Completing assessment, first chat, profile setup
- **engagement** - Daily streaks, conversation depth, emotional openness
- **growth** - Relationship stage progression, emotional insights, coping improvements
- **connection** - Trust building, vulnerability sharing, companion bonding

## Performance Indexes

The following indexes are created for optimal query performance:

```sql
-- Personality insights indexes
CREATE INDEX idx_personality_insights_user_id ON personality_insights(user_id);
CREATE INDEX idx_personality_insights_type ON personality_insights(insight_type);
CREATE INDEX idx_personality_insights_priority ON personality_insights(display_priority);

-- User progress indexes
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_stage ON user_progress(current_stage);
CREATE INDEX idx_user_progress_last_activity ON user_progress(last_activity);

-- Engagement analytics indexes
CREATE INDEX idx_engagement_analytics_user_id ON engagement_analytics(user_id);
CREATE INDEX idx_engagement_analytics_session_start ON engagement_analytics(session_start);
CREATE INDEX idx_engagement_analytics_retention_risk ON engagement_analytics(retention_risk_score);

-- Enhanced milestones indexes
CREATE INDEX idx_user_milestones_category ON user_milestones(category);
CREATE INDEX idx_user_milestones_user_category ON user_milestones(user_id, category);

-- Existing table optimizations
CREATE INDEX idx_conversations_user_timestamp ON conversations(user_id, timestamp);
CREATE INDEX idx_user_memories_user_type ON user_memories(user_id, memory_type);
CREATE INDEX idx_emotional_patterns_user_type ON emotional_patterns(user_id, pattern_type);
```

## Data Migration

The migration system safely updates existing databases by:

1. Creating a `migrations` table to track completed migrations
2. Adding new columns with `ALTER TABLE` statements (safe for existing data)
3. Creating new tables with `IF NOT EXISTS` clauses
4. Populating initial data for existing users
5. Creating performance indexes

## Usage

To run the database migrations:

```bash
node run-migrations.js
```

Or programmatically:

```javascript
const DatabaseMigrations = require('./database-migrations');
const migrations = new DatabaseMigrations();
await migrations.runAllMigrations();
```

## Backup Recommendations

Before running migrations in production:

1. Create a backup of the existing `companion.db` file
2. Test migrations on a copy of the production database
3. Verify data integrity after migration
4. Monitor application performance after deployment