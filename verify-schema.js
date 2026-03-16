const sqlite3 = require('sqlite3').verbose();

async function verifySchema() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('companion.db', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('🔍 Verifying Enhanced Onboarding Database Schema...\n');
      
      // Check new tables exist
      const tables = [
        'personality_insights',
        'user_progress', 
        'engagement_analytics',
        'migrations'
      ];
      
      let completed = 0;
      const total = tables.length + 3; // +3 for column checks
      
      tables.forEach(tableName => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
          if (err) {
            console.error(`❌ Error checking table ${tableName}:`, err);
          } else if (row) {
            console.log(`✅ Table exists: ${tableName}`);
          } else {
            console.log(`❌ Table missing: ${tableName}`);
          }
          
          completed++;
          if (completed === total) {
            checkColumns();
          }
        });
      });
      
      function checkColumns() {
        // Check enhanced columns in users table
        db.all(`PRAGMA table_info(users)`, (err, columns) => {
          if (err) {
            console.error('❌ Error checking users table:', err);
          } else {
            const columnNames = columns.map(col => col.name);
            const expectedColumns = [
              'personality_insights',
              'communication_preferences', 
              'emotional_profile',
              'onboarding_completion_time',
              'first_session_completed'
            ];
            
            console.log('\n📋 Users table enhanced columns:');
            expectedColumns.forEach(col => {
              if (columnNames.includes(col)) {
                console.log(`✅ ${col}`);
              } else {
                console.log(`❌ Missing: ${col}`);
              }
            });
          }
          
          completed++;
          if (completed === total) {
            checkCompanionSettings();
          }
        });
      }
      
      function checkCompanionSettings() {
        // Check enhanced columns in companion_settings table
        db.all(`PRAGMA table_info(companion_settings)`, (err, columns) => {
          if (err) {
            console.error('❌ Error checking companion_settings table:', err);
          } else {
            const columnNames = columns.map(col => col.name);
            const expectedColumns = [
              'onboarding_based_personality',
              'growth_stage_preferences',
              'milestone_celebration_style'
            ];
            
            console.log('\n📋 Companion settings enhanced columns:');
            expectedColumns.forEach(col => {
              if (columnNames.includes(col)) {
                console.log(`✅ ${col}`);
              } else {
                console.log(`❌ Missing: ${col}`);
              }
            });
          }
          
          completed++;
          if (completed === total) {
            checkMilestones();
          }
        });
      }
      
      function checkMilestones() {
        // Check enhanced columns in user_milestones table
        db.all(`PRAGMA table_info(user_milestones)`, (err, columns) => {
          if (err) {
            console.error('❌ Error checking user_milestones table:', err);
          } else {
            const columnNames = columns.map(col => col.name);
            const expectedColumns = [
              'category',
              'points',
              'unlock_criteria',
              'celebration_message'
            ];
            
            console.log('\n📋 User milestones enhanced columns:');
            expectedColumns.forEach(col => {
              if (columnNames.includes(col)) {
                console.log(`✅ ${col}`);
              } else {
                console.log(`❌ Missing: ${col}`);
              }
            });
          }
          
          // Check indexes
          db.all(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`, (err, indexes) => {
            if (err) {
              console.error('❌ Error checking indexes:', err);
            } else {
              console.log(`\n📊 Performance indexes created: ${indexes.length}`);
              indexes.forEach(index => {
                console.log(`✅ ${index.name}`);
              });
            }
            
            console.log('\n🎉 Schema verification completed!');
            db.close();
            resolve();
          });
        });
      }
    });
  });
}

verifySchema().catch(console.error);