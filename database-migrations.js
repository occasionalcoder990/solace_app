const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseMigrations {
  constructor(dbPath = 'companion.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Connected to database for migrations');
          resolve();
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('✅ Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    try {
      await this.runQuery(sql);
      console.log('✅ Migrations table created/verified');
    } catch (error) {
      console.error('❌ Error creating migrations table:', error);
      throw error;
    }
  }

  async isMigrationExecuted(migrationName) {
    try {
      const result = await this.getQuery(
        'SELECT id FROM migrations WHERE migration_name = ?',
        [migrationName]
      );
      return !!result;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  async recordMigration(migrationName) {
    try {
      await this.runQuery(
        'INSERT INTO migrations (migration_name) VALUES (?)',
        [migrationName]
      );
      console.log(`✅ Migration recorded: ${migrationName}`);
    } catch (error) {
      console.error(`❌ Error recording migration ${migrationName}:`, error);
      throw error;
    }
  }

  async runMigration(migrationName, migrationFunction) {
    try {
      const isExecuted = await this.isMigrationExecuted(migrationName);
      
      if (isExecuted) {
        console.log(`⏭️  Migration already executed: ${migrationName}`);
        return;
      }

      console.log(`🔄 Running migration: ${migrationName}`);
      await migrationFunction();
      await this.recordMigration(migrationName);
      console.log(`✅ Migration completed: ${migrationName}`);
      
    } catch (error) {
      console.error(`❌ Migration failed: ${migrationName}`, error);
      throw error;
    }
  }

  // Enhanced Onboarding Schema Migrations
  async migration_001_enhanced_user_schema() {
    console.log('Adding enhanced columns to users table...');
    
    // Add new columns to users table
    const userColumns = [
      'ALTER TABLE users ADD COLUMN personality_insights TEXT',
      'ALTER TABLE users ADD COLUMN communication_preferences TEXT',
      'ALTER TABLE users ADD COLUMN emotional_profile TEXT',
      'ALTER TABLE users ADD COLUMN onboarding_completion_time DATETIME',
      'ALTER TABLE users ADD COLUMN first_session_completed INTEGER DEFAULT 0'
    ];

    for (const sql of userColumns) {
      try {
        await this.runQuery(sql);
        console.log(`✅ Added column: ${sql.split(' ')[4]}`);
      } catch (error) {
        // Column might already exist, check if it's a duplicate column error
        if (error.message.includes('duplicate column name')) {
          console.log(`⏭️  Column already exists: ${sql.split(' ')[4]}`);
        } else {
          throw error;
        }
      }
    }
  }

  async migration_002_personality_insights_table() {
    console.log('Creating personality_insights table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS personality_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        insight_type TEXT NOT NULL,
        insight_content TEXT NOT NULL,
        confidence_score REAL DEFAULT 0.8,
        display_priority INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await this.runQuery(sql);
    console.log('✅ personality_insights table created');
  }

  async migration_003_user_progress_table() {
    console.log('Creating user_progress table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        current_stage TEXT DEFAULT 'getting_to_know',
        stage_progress INTEGER DEFAULT 0,
        next_milestone TEXT,
        engagement_score INTEGER DEFAULT 0,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await this.runQuery(sql);
    console.log('✅ user_progress table created');
  }

  async migration_004_engagement_analytics_table() {
    console.log('Creating engagement_analytics table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS engagement_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_start DATETIME NOT NULL,
        session_end DATETIME,
        messages_sent INTEGER DEFAULT 0,
        emotional_depth_score REAL DEFAULT 0.0,
        milestone_achieved TEXT,
        retention_risk_score REAL DEFAULT 0.0,
        next_engagement_prediction DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await this.runQuery(sql);
    console.log('✅ engagement_analytics table created');
  }

  async migration_005_enhanced_companion_settings() {
    console.log('Adding enhanced columns to companion_settings table...');
    
    const companionColumns = [
      'ALTER TABLE companion_settings ADD COLUMN onboarding_based_personality TEXT',
      'ALTER TABLE companion_settings ADD COLUMN growth_stage_preferences TEXT',
      'ALTER TABLE companion_settings ADD COLUMN milestone_celebration_style TEXT'
    ];

    for (const sql of companionColumns) {
      try {
        await this.runQuery(sql);
        console.log(`✅ Added column: ${sql.split(' ')[4]}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⏭️  Column already exists: ${sql.split(' ')[4]}`);
        } else {
          throw error;
        }
      }
    }
  }

  async migration_006_enhanced_milestones_schema() {
    console.log('Enhancing user_milestones table...');
    
    const milestoneColumns = [
      'ALTER TABLE user_milestones ADD COLUMN category TEXT DEFAULT "general"',
      'ALTER TABLE user_milestones ADD COLUMN points INTEGER DEFAULT 0',
      'ALTER TABLE user_milestones ADD COLUMN unlock_criteria TEXT',
      'ALTER TABLE user_milestones ADD COLUMN celebration_message TEXT'
    ];

    for (const sql of milestoneColumns) {
      try {
        await this.runQuery(sql);
        console.log(`✅ Added column: ${sql.split(' ')[4]}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⏭️  Column already exists: ${sql.split(' ')[4]}`);
        } else {
          throw error;
        }
      }
    }
  }

  async migration_007_create_indexes() {
    console.log('Creating performance indexes...');
    
    const indexes = [
      // Personality insights indexes
      'CREATE INDEX IF NOT EXISTS idx_personality_insights_user_id ON personality_insights(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_personality_insights_type ON personality_insights(insight_type)',
      'CREATE INDEX IF NOT EXISTS idx_personality_insights_priority ON personality_insights(display_priority)',
      
      // User progress indexes
      'CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_stage ON user_progress(current_stage)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_last_activity ON user_progress(last_activity)',
      
      // Engagement analytics indexes
      'CREATE INDEX IF NOT EXISTS idx_engagement_analytics_user_id ON engagement_analytics(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_engagement_analytics_session_start ON engagement_analytics(session_start)',
      'CREATE INDEX IF NOT EXISTS idx_engagement_analytics_retention_risk ON engagement_analytics(retention_risk_score)',
      
      // Enhanced milestones indexes
      'CREATE INDEX IF NOT EXISTS idx_user_milestones_category ON user_milestones(category)',
      'CREATE INDEX IF NOT EXISTS idx_user_milestones_user_category ON user_milestones(user_id, category)',
      
      // Existing table optimizations
      'CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp ON conversations(user_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_user_memories_user_type ON user_memories(user_id, memory_type)',
      'CREATE INDEX IF NOT EXISTS idx_emotional_patterns_user_type ON emotional_patterns(user_id, pattern_type)'
    ];

    for (const sql of indexes) {
      try {
        await this.runQuery(sql);
        const indexName = sql.split(' ')[5]; // Extract index name
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        console.error(`❌ Error creating index: ${sql}`, error);
        // Continue with other indexes even if one fails
      }
    }
  }

  async migration_008_populate_user_progress() {
    console.log('Populating user_progress for existing users...');
    
    // Get all existing users
    const users = await this.allQuery('SELECT id FROM users');
    
    for (const user of users) {
      try {
        // Check if progress record already exists
        const existingProgress = await this.getQuery(
          'SELECT id FROM user_progress WHERE user_id = ?',
          [user.id]
        );
        
        if (!existingProgress) {
          // Create initial progress record
          await this.runQuery(`
            INSERT INTO user_progress (user_id, current_stage, stage_progress, engagement_score)
            VALUES (?, 'getting_to_know', 0, 0)
          `, [user.id]);
          
          console.log(`✅ Created progress record for user ${user.id}`);
        }
      } catch (error) {
        console.error(`❌ Error creating progress for user ${user.id}:`, error);
      }
    }
  }

  async migration_009_retention_notifications_table() {
    console.log('Creating retention_notifications table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS retention_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        trigger_type TEXT NOT NULL,
        message_content TEXT NOT NULL,
        delivery_status TEXT DEFAULT 'pending',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        opened_at DATETIME,
        responded_at DATETIME,
        personalization_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await this.runQuery(sql);
    console.log('✅ retention_notifications table created');
    
    // Create indexes for retention notifications
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_retention_notifications_user_id ON retention_notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_retention_notifications_trigger_type ON retention_notifications(trigger_type)',
      'CREATE INDEX IF NOT EXISTS idx_retention_notifications_sent_at ON retention_notifications(sent_at)',
      'CREATE INDEX IF NOT EXISTS idx_retention_notifications_delivery_status ON retention_notifications(delivery_status)'
    ];

    for (const indexSql of indexes) {
      try {
        await this.runQuery(indexSql);
        const indexName = indexSql.split(' ')[5];
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        console.error(`❌ Error creating index: ${indexSql}`, error);
      }
    }
  }

  async migration_010_encrypt_personality_data() {
    console.log('Encrypting existing personality data...');
    
    const EncryptionService = require('./encryption-service');
    const encryptionService = new EncryptionService();
    
    try {
      // Get all users with personality data that needs encryption
      const users = await this.allQuery(`
        SELECT id, personality_profile, personality_insights, 
               communication_preferences, emotional_profile
        FROM users 
        WHERE personality_profile IS NOT NULL 
           OR personality_insights IS NOT NULL
           OR communication_preferences IS NOT NULL
           OR emotional_profile IS NOT NULL
      `);
      
      console.log(`Found ${users.length} users with personality data to encrypt`);
      
      for (const user of users) {
        try {
          const encryptedData = {};
          let hasChanges = false;
          
          // Encrypt personality_profile if not already encrypted
          if (user.personality_profile && !encryptionService.isEncrypted(user.personality_profile)) {
            try {
              const parsedProfile = JSON.parse(user.personality_profile);
              encryptedData.personality_profile = encryptionService.encryptQuestionnaireResponses(parsedProfile);
              hasChanges = true;
              console.log(`✅ Encrypted personality_profile for user ${user.id}`);
            } catch (parseError) {
              // If it's not JSON, encrypt as string
              encryptedData.personality_profile = encryptionService.encryptQuestionnaireResponses(user.personality_profile);
              hasChanges = true;
              console.log(`✅ Encrypted personality_profile (string) for user ${user.id}`);
            }
          }
          
          // Encrypt personality_insights if not already encrypted
          if (user.personality_insights && !encryptionService.isEncrypted(user.personality_insights)) {
            try {
              const parsedInsights = JSON.parse(user.personality_insights);
              encryptedData.personality_insights = encryptionService.encryptPersonalityInsights(parsedInsights);
              hasChanges = true;
              console.log(`✅ Encrypted personality_insights for user ${user.id}`);
            } catch (parseError) {
              encryptedData.personality_insights = encryptionService.encryptPersonalityInsights(user.personality_insights);
              hasChanges = true;
              console.log(`✅ Encrypted personality_insights (string) for user ${user.id}`);
            }
          }
          
          // Encrypt communication_preferences if not already encrypted
          if (user.communication_preferences && !encryptionService.isEncrypted(user.communication_preferences)) {
            encryptedData.communication_preferences = encryptionService.encryptCommunicationPreferences(user.communication_preferences);
            hasChanges = true;
            console.log(`✅ Encrypted communication_preferences for user ${user.id}`);
          }
          
          // Encrypt emotional_profile if not already encrypted
          if (user.emotional_profile && !encryptionService.isEncrypted(user.emotional_profile)) {
            encryptedData.emotional_profile = encryptionService.encryptEmotionalProfile(user.emotional_profile);
            hasChanges = true;
            console.log(`✅ Encrypted emotional_profile for user ${user.id}`);
          }
          
          // Update user record if there are changes
          if (hasChanges) {
            const updateFields = [];
            const updateValues = [];
            
            if (encryptedData.personality_profile) {
              updateFields.push('personality_profile = ?');
              updateValues.push(encryptedData.personality_profile);
            }
            if (encryptedData.personality_insights) {
              updateFields.push('personality_insights = ?');
              updateValues.push(encryptedData.personality_insights);
            }
            if (encryptedData.communication_preferences) {
              updateFields.push('communication_preferences = ?');
              updateValues.push(encryptedData.communication_preferences);
            }
            if (encryptedData.emotional_profile) {
              updateFields.push('emotional_profile = ?');
              updateValues.push(encryptedData.emotional_profile);
            }
            
            updateValues.push(user.id);
            
            await this.runQuery(
              `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
              updateValues
            );
            
            console.log(`✅ Updated encrypted data for user ${user.id}`);
          }
          
        } catch (userError) {
          console.error(`❌ Error encrypting data for user ${user.id}:`, userError);
          // Continue with other users
        }
      }
      
      // Encrypt personality_insights table data
      const personalityInsights = await this.allQuery(`
        SELECT id, insight_content 
        FROM personality_insights 
        WHERE insight_content IS NOT NULL
      `);
      
      console.log(`Found ${personalityInsights.length} personality insights to encrypt`);
      
      for (const insight of personalityInsights) {
        try {
          if (!encryptionService.isEncrypted(insight.insight_content)) {
            const encryptedContent = encryptionService.encryptPersonalityData(insight.insight_content);
            
            await this.runQuery(
              'UPDATE personality_insights SET insight_content = ? WHERE id = ?',
              [encryptedContent, insight.id]
            );
            
            console.log(`✅ Encrypted personality insight ${insight.id}`);
          }
        } catch (insightError) {
          console.error(`❌ Error encrypting personality insight ${insight.id}:`, insightError);
        }
      }
      
      // Encrypt companion_settings onboarding_based_personality
      const companionSettings = await this.allQuery(`
        SELECT user_id, onboarding_based_personality 
        FROM companion_settings 
        WHERE onboarding_based_personality IS NOT NULL
      `);
      
      console.log(`Found ${companionSettings.length} companion settings to encrypt`);
      
      for (const setting of companionSettings) {
        try {
          if (!encryptionService.isEncrypted(setting.onboarding_based_personality)) {
            const encryptedPersonality = encryptionService.encryptPersonalityData(setting.onboarding_based_personality);
            
            await this.runQuery(
              'UPDATE companion_settings SET onboarding_based_personality = ? WHERE user_id = ?',
              [encryptedPersonality, setting.user_id]
            );
            
            console.log(`✅ Encrypted companion settings for user ${setting.user_id}`);
          }
        } catch (settingError) {
          console.error(`❌ Error encrypting companion setting for user ${setting.user_id}:`, settingError);
        }
      }
      
      console.log('✅ Personality data encryption migration completed');
      
    } catch (error) {
      console.error('❌ Error during personality data encryption migration:', error);
      throw error;
    }
  }

  async migration_011_personality_audit_logging() {
    console.log('Creating personality data audit logging table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS personality_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        data_type TEXT NOT NULL,
        access_context TEXT,
        ip_address TEXT,
        user_agent TEXT,
        session_token_hash TEXT,
        audit_token TEXT UNIQUE NOT NULL,
        data_hash TEXT,
        encryption_metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;
    
    await this.runQuery(sql);
    console.log('✅ personality_audit_log table created');
    
    // Create indexes for personality audit log
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_personality_audit_user_id ON personality_audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_personality_audit_action ON personality_audit_log(action)',
      'CREATE INDEX IF NOT EXISTS idx_personality_audit_data_type ON personality_audit_log(data_type)',
      'CREATE INDEX IF NOT EXISTS idx_personality_audit_timestamp ON personality_audit_log(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_personality_audit_token ON personality_audit_log(audit_token)'
    ];

    for (const indexSql of indexes) {
      try {
        await this.runQuery(indexSql);
        const indexName = indexSql.split(' ')[5];
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        console.error(`❌ Error creating index: ${indexSql}`, error);
      }
    }
  }

  async runAllMigrations() {
    try {
      await this.connect();
      await this.createMigrationsTable();
      
      // Run migrations in order
      await this.runMigration('001_enhanced_user_schema', () => this.migration_001_enhanced_user_schema());
      await this.runMigration('002_personality_insights_table', () => this.migration_002_personality_insights_table());
      await this.runMigration('003_user_progress_table', () => this.migration_003_user_progress_table());
      await this.runMigration('004_engagement_analytics_table', () => this.migration_004_engagement_analytics_table());
      await this.runMigration('005_enhanced_companion_settings', () => this.migration_005_enhanced_companion_settings());
      await this.runMigration('006_enhanced_milestones_schema', () => this.migration_006_enhanced_milestones_schema());
      await this.runMigration('007_create_indexes', () => this.migration_007_create_indexes());
      await this.runMigration('008_populate_user_progress', () => this.migration_008_populate_user_progress());
      await this.runMigration('009_retention_notifications_table', () => this.migration_009_retention_notifications_table());
      await this.runMigration('010_encrypt_personality_data', () => this.migration_010_encrypt_personality_data());
      await this.runMigration('011_personality_audit_logging', () => this.migration_011_personality_audit_logging());
      
      console.log('🎉 All migrations completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

module.exports = DatabaseMigrations;

// If run directly, execute all migrations
if (require.main === module) {
  const migrations = new DatabaseMigrations();
  migrations.runAllMigrations()
    .then(() => {
      console.log('✅ Database migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database migration failed:', error);
      process.exit(1);
    });
}