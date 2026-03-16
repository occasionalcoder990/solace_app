const sqlite3 = require('sqlite3').verbose();
const RetentionService = require('../retention-service');
const EngagementAnalyticsService = require('../engagement-analytics-service');

describe('Retention and Engagement Services', () => {
  let db;
  let retentionService;
  let engagementService;

  beforeAll(async () => {
    // Create in-memory database for testing
    db = new sqlite3.Database(':memory:');
    
    // Create required tables
    await new Promise((resolve) => {
      db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          onboarding_complete INTEGER DEFAULT 0,
          onboarding_completion_time DATETIME,
          first_session_completed INTEGER DEFAULT 0,
          communication_preferences TEXT,
          emotional_profile TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Conversations table
        db.run(`CREATE TABLE conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          message TEXT,
          response TEXT,
          emotion_detected TEXT,
          mood_score INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // User progress table
        db.run(`CREATE TABLE user_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE,
          current_stage TEXT DEFAULT 'getting_to_know',
          stage_progress INTEGER DEFAULT 0,
          next_milestone TEXT,
          engagement_score INTEGER DEFAULT 0,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Engagement analytics table
        db.run(`CREATE TABLE engagement_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          session_start DATETIME,
          session_end DATETIME,
          messages_sent INTEGER DEFAULT 0,
          emotional_depth_score REAL DEFAULT 0.0,
          milestone_achieved TEXT,
          retention_risk_score REAL DEFAULT 0.0,
          next_engagement_prediction DATETIME
        )`);

        // Retention notifications table
        db.run(`CREATE TABLE retention_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          trigger_type TEXT,
          message_content TEXT,
          delivery_status TEXT DEFAULT 'pending',
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          personalization_data TEXT
        )`);

        // Personality insights table
        db.run(`CREATE TABLE personality_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          insight_type TEXT,
          insight_content TEXT,
          confidence_score REAL DEFAULT 0.8,
          display_priority INTEGER DEFAULT 1
        )`);

        // Companion settings table
        db.run(`CREATE TABLE companion_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE,
          communication_style TEXT,
          response_tone TEXT,
          onboarding_based_personality TEXT
        )`, resolve);
      });
    });

    retentionService = new RetentionService(db);
    engagementService = new EngagementAnalyticsService(db);
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.close(resolve);
    });
  });

  beforeEach(async () => {
    // Clear tables before each test
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM users');
        db.run('DELETE FROM conversations');
        db.run('DELETE FROM user_progress');
        db.run('DELETE FROM engagement_analytics');
        db.run('DELETE FROM retention_notifications');
        db.run('DELETE FROM personality_insights');
        db.run('DELETE FROM companion_settings', resolve);
      });
    });
  });

  describe('EngagementAnalyticsService', () => {
    test('should start and track engagement session', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email) VALUES (?, ?)', 
          ['Test User', 'test@example.com'], function() {
            resolve(this.lastID);
          });
      });

      // Start session
      const sessionId = await engagementService.startSession(userId);
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('number');

      // Check if session is active
      expect(engagementService.hasActiveSession(userId)).toBe(true);

      // Get active session
      const activeSession = engagementService.getActiveSession(userId);
      expect(activeSession).toBeDefined();
      expect(activeSession.sessionId).toBe(sessionId);
      expect(activeSession.messageCount).toBe(0);
    });

    test('should update session metrics', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email) VALUES (?, ?)', 
          ['Test User', 'test@example.com'], function() {
            resolve(this.lastID);
          });
      });

      // Start session
      await engagementService.startSession(userId);

      // Update metrics
      await engagementService.updateSessionMetrics(userId, {
        message: 'I feel really anxious about my upcoming presentation',
        response: 'I understand that presentations can be nerve-wracking...',
        emotion_detected: 'anxious',
        mood_score: 3
      });

      // Check session was updated
      const activeSession = engagementService.getActiveSession(userId);
      expect(activeSession.messageCount).toBe(1);
      expect(activeSession.emotionalDepthSum).toBeGreaterThan(0);
    });

    test('should calculate emotional depth score correctly', () => {
      const messageData1 = {
        message: 'Hi there',
        response: 'Hello!',
        emotion_detected: null,
        mood_score: null
      };

      const messageData2 = {
        message: 'I feel really sad and overwhelmed about my relationship problems',
        response: 'I hear your pain...',
        emotion_detected: 'sad',
        mood_score: 2
      };

      const depth1 = engagementService.calculateEmotionalDepth(messageData1);
      const depth2 = engagementService.calculateEmotionalDepth(messageData2);

      expect(depth1).toBeLessThan(depth2);
      expect(depth2).toBeGreaterThan(0.3); // Should be high emotional depth
    });

    test('should end session and calculate final metrics', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email) VALUES (?, ?)', 
          ['Test User', 'test@example.com'], function() {
            resolve(this.lastID);
          });
      });

      // Start session and add some activity
      await engagementService.startSession(userId);
      await engagementService.updateSessionMetrics(userId, {
        message: 'Test message',
        response: 'Test response'
      });

      // End session
      const finalMetrics = await engagementService.endSession(userId);

      expect(finalMetrics).toBeDefined();
      expect(finalMetrics.messageCount).toBe(1);
      expect(finalMetrics.duration).toBeGreaterThan(0);
      expect(finalMetrics.retentionRisk).toBeGreaterThanOrEqual(0);
      expect(finalMetrics.retentionRisk).toBeLessThanOrEqual(1);

      // Session should no longer be active
      expect(engagementService.hasActiveSession(userId)).toBe(false);
    });

    test('should get engagement analytics', async () => {
      // Create test user with some session data
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email) VALUES (?, ?)', 
          ['Test User', 'test@example.com'], function() {
            resolve(this.lastID);
          });
      });

      // Add some test session data
      await new Promise((resolve) => {
        db.run(`INSERT INTO engagement_analytics 
          (user_id, session_start, session_end, messages_sent, emotional_depth_score, retention_risk_score)
          VALUES (?, datetime('now', '-1 day'), datetime('now', '-1 day', '+30 minutes'), 5, 0.6, 0.3)`,
          [userId], resolve);
      });

      const analytics = await engagementService.getEngagementAnalytics(userId, 7);

      expect(analytics).toBeDefined();
      expect(analytics.totalSessions).toBe(1);
      expect(analytics.totalMessages).toBe(5);
      expect(analytics.avgEmotionalDepth).toBe(0.6);
      expect(analytics.avgRetentionRisk).toBe(0.3);
    });
  });

  describe('RetentionService', () => {
    test('should analyze user behavior', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email, onboarding_complete) VALUES (?, ?, ?)', 
          ['Test User', 'test@example.com', 1], function() {
            resolve(this.lastID);
          });
      });

      // Add some conversation history
      await new Promise((resolve) => {
        db.run(`INSERT INTO conversations (user_id, message, response, timestamp)
          VALUES (?, ?, ?, datetime('now', '-2 days'))`,
          [userId, 'Hello', 'Hi there!'], resolve);
      });

      // Add user progress
      await new Promise((resolve) => {
        db.run(`INSERT INTO user_progress (user_id, current_stage, engagement_score)
          VALUES (?, ?, ?)`,
          [userId, 'getting_to_know', 25], resolve);
      });

      const behaviorAnalysis = await retentionService.analyzeUserBehavior(userId);

      expect(behaviorAnalysis).toBeDefined();
      expect(behaviorAnalysis.conversationStats).toBeDefined();
      expect(behaviorAnalysis.retentionRisk).toBeGreaterThanOrEqual(0);
      expect(behaviorAnalysis.retentionRisk).toBeLessThanOrEqual(1);
      expect(behaviorAnalysis.recommendedAction).toBeDefined();
    });

    test('should calculate retention risk score', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email, onboarding_complete) VALUES (?, ?, ?)', 
          ['Test User', 'test@example.com', 1], function() {
            resolve(this.lastID);
          });
      });

      const behaviorData = {
        conversationStats: {
          totalConversations: 5,
          lastConversation: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          avgMoodScore: 4
        },
        engagementData: [
          { messages_sent: 3, emotional_depth_score: 0.2 },
          { messages_sent: 2, emotional_depth_score: 0.1 }
        ],
        milestoneProgress: {
          stage_progress: 20,
          next_milestone: 'First Deep Conversation'
        }
      };

      const riskScore = await retentionService.calculateRetentionRisk(userId, behaviorData);

      expect(riskScore).toBeGreaterThan(0.5); // Should be high risk due to 10 days inactivity
      expect(riskScore).toBeLessThanOrEqual(1);
    });

    test('should generate personalized reminder messages', async () => {
      // Create test user with personality data
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email, onboarding_complete) VALUES (?, ?, ?)', 
          ['Alice', 'alice@example.com', 1], function() {
            resolve(this.lastID);
          });
      });

      await new Promise((resolve) => {
        db.run(`INSERT INTO companion_settings (user_id, communication_style, response_tone)
          VALUES (?, ?, ?)`,
          [userId, 'gentle', 'supportive'], resolve);
      });

      await new Promise((resolve) => {
        db.run(`INSERT INTO personality_insights (user_id, insight_type, insight_content)
          VALUES (?, ?, ?)`,
          [userId, 'communication_style', 'prefers gentle, supportive communication'], resolve);
      });

      const behaviorAnalysis = {
        conversationStats: { totalConversations: 3, lastConversation: new Date().toISOString() },
        retentionRisk: 0.4,
        engagementTrend: 'stable',
        milestoneProgress: {
          current_stage: 'getting_to_know',
          stage_progress: 30,
          next_milestone: 'First Deep Conversation',
          engagement_score: 25
        }
      };

      const reminderData = await retentionService.generatePersonalizedReminder(
        userId, 
        'weeklyCheckIn', 
        behaviorAnalysis
      );

      expect(reminderData).toBeDefined();
      expect(reminderData.personalizedContent).toContain('Alice');
      expect(reminderData.emotionalTone).toBe('friendly');
      expect(reminderData.actionableSteps).toBeInstanceOf(Array);
      expect(reminderData.actionableSteps.length).toBeGreaterThan(0);
    });

    test('should create re-engagement flow', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email, onboarding_complete) VALUES (?, ?, ?)', 
          ['Test User', 'test@example.com', 1], function() {
            resolve(this.lastID);
          });
      });

      await new Promise((resolve) => {
        db.run(`INSERT INTO companion_settings (user_id, communication_style)
          VALUES (?, ?)`,
          [userId, 'gentle'], resolve);
      });

      const behaviorAnalysis = {
        retentionRisk: 0.8,
        conversationStats: { totalConversations: 5, lastConversation: new Date().toISOString() },
        milestoneProgress: {
          current_stage: 'getting_to_know',
          stage_progress: 20,
          next_milestone: 'Comfortable Connection',
          engagement_score: 15
        }
      };

      const reEngagementFlow = await retentionService.createReEngagementFlow(userId, behaviorAnalysis);

      expect(reEngagementFlow).toBeDefined();
      expect(reEngagementFlow.riskLevel).toBe('urgent_intervention');
      expect(reEngagementFlow.phases).toBeInstanceOf(Array);
      expect(reEngagementFlow.phases.length).toBeGreaterThan(0);
      
      // Should have multiple phases for high-risk users
      expect(reEngagementFlow.phases.length).toBeGreaterThanOrEqual(2);
    });

    test('should track notification delivery', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email) VALUES (?, ?)', 
          ['Test User', 'test@example.com'], function() {
            resolve(this.lastID);
          });
      });

      const notificationData = {
        triggerType: 'weeklyCheckIn',
        personalizedContent: 'Hi Test User! How are you doing?',
        emotionalTone: 'friendly',
        actionableSteps: ['Start a conversation']
      };

      await retentionService.trackNotificationDelivery(userId, notificationData, 'sent');

      // Verify notification was tracked
      const notifications = await new Promise((resolve) => {
        db.all('SELECT * FROM retention_notifications WHERE user_id = ?', [userId], (err, results) => {
          resolve(results);
        });
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].trigger_type).toBe('weeklyCheckIn');
      expect(notifications[0].delivery_status).toBe('sent');
    });
  });

  describe('Integration Tests', () => {
    test('should work together for complete user journey tracking', async () => {
      // Create test user
      const userId = await new Promise((resolve) => {
        db.run('INSERT INTO users (name, email, onboarding_complete) VALUES (?, ?, ?)', 
          ['Integration User', 'integration@example.com', 1], function() {
            resolve(this.lastID);
          });
      });

      // Start engagement session
      const sessionId = await engagementService.startSession(userId);
      expect(sessionId).toBeDefined();

      // Simulate conversation activity
      await engagementService.updateSessionMetrics(userId, {
        message: 'I feel anxious about my job interview tomorrow',
        response: 'Job interviews can definitely be nerve-wracking...',
        emotion_detected: 'anxious',
        mood_score: 3
      });

      // End session
      const finalMetrics = await engagementService.endSession(userId);
      expect(finalMetrics.retentionRisk).toBeDefined();

      // Analyze user behavior for retention
      const behaviorAnalysis = await retentionService.analyzeUserBehavior(userId);
      expect(behaviorAnalysis.retentionRisk).toBeDefined();

      // Generate retention notification if needed
      if (behaviorAnalysis.retentionRisk > 0.3) {
        const reminderData = await retentionService.generatePersonalizedReminder(
          userId, 
          'milestoneReminder', 
          behaviorAnalysis
        );
        expect(reminderData.personalizedContent).toContain('Integration User');
      }
    });
  });
});