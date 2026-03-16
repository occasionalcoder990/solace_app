#!/usr/bin/env node

const DatabaseMigrations = require('./database-migrations');
const fs = require('fs');

async function runMigrations() {
  console.log('🚀 Starting Enhanced Onboarding Database Migrations...\n');
  
  // Check if database file exists
  if (!fs.existsSync('companion.db')) {
    console.log('⚠️  Database file not found. Creating new database...');
  }
  
  try {
    const migrations = new DatabaseMigrations();
    await migrations.runAllMigrations();
    
    console.log('\n🎉 Enhanced onboarding database schema is ready!');
    console.log('\nNew tables created:');
    console.log('  • personality_insights - Stores user personality analysis results');
    console.log('  • user_progress - Tracks relationship stages and milestones');
    console.log('  • engagement_analytics - Records user engagement patterns');
    console.log('\nEnhanced existing tables:');
    console.log('  • users - Added personality and onboarding completion fields');
    console.log('  • companion_settings - Added onboarding-based personality preferences');
    console.log('  • user_milestones - Added categories and celebration features');
    console.log('\nPerformance indexes created for optimized querying.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nPlease check the error above and try again.');
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };