/**
 * Demo script for RetentionService
 * This demonstrates how the retention service works with intelligent notifications
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const RetentionService = require('./retention-service');
const PersonalityAnalysisService = require('./personality-analysis-service');
const AIService = require('./ai-service');

// Create a temporary in-memory database for demo
const db = new sqlite3.Database(':memory:');

async function setupDemoDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create required tables
            db.run(`CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                onboarding_complete INTEGER DEFAULT 0,
                personality_profile TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                message TEXT,
                response TEXT,
                mood_score INTEGER DEFAULT 7,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE personality_insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                insight_type TEXT,
                insight_content TEXT,
                confidence_score REAL,
                display_priority INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE user_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                achieved_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE companion_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                communication_style TEXT,
                response_tone TEXT,
                relationship_stage TEXT DEFAULT 'getting_to_know'
            )`);

            // Insert demo users
            db.run(`INSERT INTO users (id, name, email, onboarding_complete, personality_profile) VALUES 
                (1, 'Alice', 'alice@example.com', 1, '["Alice", "talk to friends", "someone to listen", "gentle"]'),
                (2, 'Bob', 'bob@example.com', 1, '["Bob", "work through alone", "practical solutions", "direct"]'),
                (3, 'Charlie', 'charlie@example.com', 0, NULL)`);

            // Insert some personality insights
            db.run(`INSERT INTO personality_insights (user_id, insight_type, insight_content, confidence_score, display_priority) VALUES
                (1, 'communication_style', 'You prefer gentle, supportive conversations that feel safe and nurturing', 0.85, 1),
                (1, 'emotional_needs', 'You need to feel heard and understood above all else', 0.90, 2),
                (2, 'communication_style', 'You value honest, straightforward communication without sugar-coating', 0.88, 1),
                (2, 'emotional_needs', 'You seek clarity and direction in life decisions', 0.82, 2)`);

            // Insert companion settings
            db.run(`INSERT INTO companion_settings (user_id, communication_style, response_tone, relationship_stage) VALUES
                (1, 'gentle', 'supportive', 'comfortable'),
                (2, 'direct', 'clear', 'getting_to_know')`);

            // Insert some conversations (Alice has conversations, Bob doesn't)
            db.run(`INSERT INTO conversations (user_id, message, response, timestamp) VALUES
                (1, 'Hi there!', 'Hello Alice! Great to meet you.', datetime('now', '-2 days')),
                (1, 'How are you?', 'I am doing well, thank you for asking!', datetime('now', '-2 days')),
                (1, 'I had a tough day', 'I am sorry to hear that. Would you like to talk about it?', datetime('now', '-1 day'))`);

            resolve();
        });
    });
}

async function demonstrateRetentionService() {
    console.log('🚀 RetentionService Demo Starting...\n');

    // Setup database
    await setupDemoDatabase();

    // Initialize services
    const personalityService = new PersonalityAnalysisService(db);
    
    // Mock AI service for demo (simpler version)
    const mockAIService = {
        openai: {
            chat: {
                completions: {
                    create: async () => ({
                        choices: [{
                            message: {
                                content: "Hi! I've been thinking about our conversation and wanted to check in. How are you doing today?"
                            }
                        }]
                    })
                }
            }
        }
    };
    
    const retentionService = new RetentionService(db, personalityService, mockAIService);

    console.log('✅ Services initialized\n');

    // Demo 1: Schedule notifications for different user scenarios
    console.log('📅 Demo 1: Scheduling Notifications\n');

    // Alice - completed onboarding, has conversations, but hasn't chatted recently
    console.log('👩 Alice: Active user who hasn\'t chatted recently');
    await retentionService.checkUserActivityAndScheduleNotifications(1);

    // Bob - completed onboarding but no conversations yet
    console.log('\n👨 Bob: Completed onboarding but no conversations');
    await retentionService.checkUserActivityAndScheduleNotifications(2);

    // Charlie - hasn't completed onboarding
    console.log('\n👤 Charlie: Hasn\'t completed onboarding');
    await retentionService.checkUserActivityAndScheduleNotifications(3);

    // Demo 2: Generate personalized messages
    console.log('\n\n💬 Demo 2: Personalized Message Generation\n');

    // Get user data for Alice
    const aliceData = await retentionService.getUserDataForNotification(1);
    console.log('📊 Alice\'s data:', {
        name: aliceData.user?.name,
        conversationCount: aliceData.conversationCount,
        relationshipStage: aliceData.relationshipStage,
        personalityInsights: aliceData.personalityInsights?.length || 0
    });

    // Generate personalized message for Alice
    const aliceMessage = await retentionService.generatePersonalizedMessage('weeklyCheckIn', aliceData);
    console.log('💌 Personalized message for Alice:', aliceMessage);

    // Get user data for Bob
    const bobData = await retentionService.getUserDataForNotification(2);
    console.log('\n📊 Bob\'s data:', {
        name: bobData.user?.name,
        conversationCount: bobData.conversationCount,
        relationshipStage: bobData.relationshipStage,
        personalityInsights: bobData.personalityInsights?.length || 0
    });

    // Generate personalized message for Bob
    const bobMessage = await retentionService.generatePersonalizedMessage('firstSession', bobData);
    console.log('💌 Personalized message for Bob:', bobMessage);

    // Demo 3: Show notification history
    console.log('\n\n📋 Demo 3: Notification Management\n');

    const aliceHistory = await retentionService.getUserNotificationHistory(1, 5);
    console.log(`📜 Alice's notification history (${aliceHistory.length} notifications):`);
    aliceHistory.forEach(notification => {
        console.log(`  - ${notification.notification_type} (${notification.status}) - ${new Date(notification.created_at).toLocaleString()}`);
    });

    const bobHistory = await retentionService.getUserNotificationHistory(2, 5);
    console.log(`\n📜 Bob's notification history (${bobHistory.length} notifications):`);
    bobHistory.forEach(notification => {
        console.log(`  - ${notification.notification_type} (${notification.status}) - ${new Date(notification.created_at).toLocaleString()}`);
    });

    // Demo 4: Show different notification types
    console.log('\n\n🔔 Demo 4: Different Notification Types\n');

    console.log('Available notification types:');
    Object.keys(retentionService.notificationTriggers).forEach(type => {
        const trigger = retentionService.notificationTriggers[type];
        console.log(`  - ${type}: ${trigger.delay / (1000 * 60 * 60)} hours delay`);
    });

    console.log('\n🎯 Demo Complete! The RetentionService is ready to help keep users engaged.\n');

    // Close database
    db.close();
}

// Run the demo
if (require.main === module) {
    demonstrateRetentionService().catch(console.error);
}

module.exports = { demonstrateRetentionService };