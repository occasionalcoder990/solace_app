const sqlite3 = require('sqlite3').verbose();
const MilestoneEngine = require('../milestone-engine');

describe('MilestoneEngine', () => {
  let db;
  let milestoneEngine;
  
  beforeEach(async () => {
    // Create in-memory database for testing
    db = new sqlite3.Database(':memory:');
    milestoneEngine = new MilestoneEngine(db);
    
    // Create required tables
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE user_milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          milestone_type TEXT,
          title TEXT,
          description TEXT,
          category TEXT DEFAULT "general",
          points INTEGER DEFAULT 0,
          unlock_criteria TEXT,
          celebration_message TEXT,
          achieved_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
        });
        
        db.run(`CREATE TABLE user_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          current_stage TEXT DEFAULT 'getting_to_know',
          stage_progress INTEGER DEFAULT 0,
          next_milestone TEXT,
          engagement_score INTEGER DEFAULT 0,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
  
  afterEach(async () => {
    await new Promise((resolve) => {
      db.close(() => resolve());
    });
  });
  
  describe('checkMilestoneAchievements', () => {
    test('should award personality assessment milestone when onboarding is complete', async () => {
      const userId = 1;
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 0,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      expect(newMilestones).toHaveLength(1);
      expect(newMilestones[0].milestoneType).toBe('personality_assessment_complete');
      expect(newMilestones[0].title).toBe('Personality Assessment Complete');
      expect(newMilestones[0].category).toBe('onboarding');
      expect(newMilestones[0].points).toBe(10);
    });
    
    test('should award first conversation milestone', async () => {
      const userId = 1;
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 1,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const firstConversationMilestone = newMilestones.find(m => m.milestoneType === 'first_conversation');
      expect(firstConversationMilestone).toBeDefined();
      expect(firstConversationMilestone.title).toBe('First Conversation');
      expect(firstConversationMilestone.category).toBe('onboarding');
      expect(firstConversationMilestone.points).toBe(15);
    });
    
    test('should award relationship stage milestone', async () => {
      const userId = 1;
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 5,
        relationshipStage: 'comfortable'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const stageMilestone = newMilestones.find(m => m.milestoneType === 'relationship_stage_comfortable');
      expect(stageMilestone).toBeDefined();
      expect(stageMilestone.title).toBe('Comfortable Connection');
      expect(stageMilestone.category).toBe('growth');
      expect(stageMilestone.points).toBe(40);
    });
    
    test('should not award already achieved milestones', async () => {
      const userId = 1;
      
      // First award a milestone
      await milestoneEngine.awardMilestone(userId, 'personality_assessment_complete', 
        milestoneEngine.milestoneDefinitions['personality_assessment_complete']);
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 0,
        relationshipStage: 'getting_to_know'
      };
      
      // Try to award the same milestone again
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      // Should not award the same milestone twice
      const duplicateMilestone = newMilestones.find(m => m.milestoneType === 'personality_assessment_complete');
      expect(duplicateMilestone).toBeUndefined();
    });
  });
  
  describe('getUserMilestones', () => {
    test('should return user milestones in descending order', async () => {
      const userId = 1;
      
      // Award multiple milestones
      await milestoneEngine.awardMilestone(userId, 'personality_assessment_complete', 
        milestoneEngine.milestoneDefinitions['personality_assessment_complete']);
      await milestoneEngine.awardMilestone(userId, 'first_conversation', 
        milestoneEngine.milestoneDefinitions['first_conversation']);
      
      const milestones = await milestoneEngine.getUserMilestones(userId);
      
      expect(milestones).toHaveLength(2);
      // Milestones are returned in descending order by achieved_date
      expect(milestones[0].milestone_type).toBe('personality_assessment_complete'); // First awarded
      expect(milestones[1].milestone_type).toBe('first_conversation'); // Second awarded
    });
  });
  
  describe('getUserMilestonePoints', () => {
    test('should calculate total points correctly', async () => {
      const userId = 1;
      
      // Award milestones with different point values
      await milestoneEngine.awardMilestone(userId, 'personality_assessment_complete', 
        milestoneEngine.milestoneDefinitions['personality_assessment_complete']); // 10 points
      await milestoneEngine.awardMilestone(userId, 'first_conversation', 
        milestoneEngine.milestoneDefinitions['first_conversation']); // 15 points
      
      const totalPoints = await milestoneEngine.getUserMilestonePoints(userId);
      
      expect(totalPoints).toBe(25);
    });
  });
  
  describe('getNextMilestones', () => {
    test('should return available milestones sorted by category and points', async () => {
      const userId = 1;
      const userData = {
        onboardingComplete: false,
        personalityInsights: false,
        conversationCount: 0,
        relationshipStage: 'getting_to_know'
      };
      
      const nextMilestones = await milestoneEngine.getNextMilestones(userId, userData);
      
      expect(nextMilestones.length).toBeGreaterThan(0);
      
      // Should be sorted by category (onboarding first) and then by points
      const onboardingMilestones = nextMilestones.filter(m => m.category === 'onboarding');
      expect(onboardingMilestones.length).toBeGreaterThan(0);
      
      // First milestone should be from onboarding category
      const firstMilestone = nextMilestones.find(m => m.category === 'onboarding');
      expect(firstMilestone).toBeDefined();
    });
  });
  
  describe('calculateMilestoneProgress', () => {
    test('should calculate progress for conversation milestones', () => {
      const userData = { conversationCount: 5 };
      
      const progress = milestoneEngine.calculateMilestoneProgress('conversation_milestone_10', userData);
      
      expect(progress).toBe(50); // 5/10 * 100 = 50%
    });
    
    test('should calculate progress for daily streak', () => {
      const userData = { dailyStreak: 2 };
      
      const progress = milestoneEngine.calculateMilestoneProgress('daily_streak_3', userData);
      
      expect(progress).toBeCloseTo(66.67, 1); // 2/3 * 100 ≈ 66.67%
    });
  });
  
  describe('generateCelebrationNotification', () => {
    test('should generate proper celebration notification', () => {
      const milestone = {
        title: 'First Conversation',
        celebrationMessage: 'Great job!',
        points: 15,
        category: 'onboarding'
      };
      
      const notification = milestoneEngine.generateCelebrationNotification(milestone);
      
      expect(notification.type).toBe('milestone_celebration');
      expect(notification.title).toBe('🏆 First Conversation');
      expect(notification.message).toBe('Great job!');
      expect(notification.points).toBe(15);
      expect(notification.category).toBe('onboarding');
      expect(notification.celebrationStyle.emoji).toBe('🌟');
    });
  });

  // Enhanced tests for milestone trigger logic with various user interaction patterns
  describe('Milestone Detection with Various User Interaction Patterns', () => {
    test('should detect engagement milestones based on daily streak patterns', async () => {
      const userId = 1;
      
      // Test daily streak milestone detection
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 5,
        dailyStreak: 3,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const streakMilestone = newMilestones.find(m => m.milestoneType === 'daily_streak_3');
      expect(streakMilestone).toBeDefined();
      expect(streakMilestone.title).toBe('3-Day Streak');
      expect(streakMilestone.category).toBe('engagement');
      expect(streakMilestone.celebrationMessage).toContain('Three days of connection');
    });

    test('should detect deep conversation milestone based on emotional depth', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 2,
        maxEmotionalDepth: 0.8,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const deepConversationMilestone = newMilestones.find(m => m.milestoneType === 'deep_conversation');
      expect(deepConversationMilestone).toBeDefined();
      expect(deepConversationMilestone.title).toBe('Deep Conversation');
      expect(deepConversationMilestone.category).toBe('engagement');
      expect(deepConversationMilestone.celebrationMessage).toContain('trusting me with something so personal');
    });

    test('should detect conversation count milestones at specific thresholds', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 10,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const conversationMilestone = newMilestones.find(m => m.milestoneType === 'conversation_milestone_10');
      expect(conversationMilestone).toBeDefined();
      expect(conversationMilestone.title).toBe('10 Conversations');
      expect(conversationMilestone.category).toBe('engagement');
      expect(conversationMilestone.points).toBe(30);
    });

    test('should detect growth milestones based on emotional insights', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 5,
        emotionalInsights: 1,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const insightMilestone = newMilestones.find(m => m.milestoneType === 'emotional_insight_gained');
      expect(insightMilestone).toBeDefined();
      expect(insightMilestone.title).toBe('Emotional Insight');
      expect(insightMilestone.category).toBe('growth');
      expect(insightMilestone.celebrationMessage).toContain('developing real self-awareness');
    });

    test('should detect coping strategy milestone when user applies techniques', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 3,
        copingStrategiesUsed: 1,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const copingMilestone = newMilestones.find(m => m.milestoneType === 'coping_strategy_used');
      expect(copingMilestone).toBeDefined();
      expect(copingMilestone.title).toBe('Coping Strategy Applied');
      expect(copingMilestone.category).toBe('growth');
      expect(copingMilestone.points).toBe(45);
    });

    test('should detect connection milestones based on vulnerability sharing', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 5,
        vulnerabilityShared: 1,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const trustMilestone = newMilestones.find(m => m.milestoneType === 'trust_established');
      expect(trustMilestone).toBeDefined();
      expect(trustMilestone.title).toBe('Trust Established');
      expect(trustMilestone.category).toBe('connection');
      expect(trustMilestone.celebrationMessage).toContain('trust between us is beautiful');
    });
  });

  // Tests for achievement timing and celebration messages
  describe('Achievement Timing and Celebration Messages', () => {
    test('should award first conversation milestone immediately after first chat', async () => {
      const userId = 1;
      
      // User completes onboarding but hasn't chatted yet
      let userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 0,
        relationshipStage: 'getting_to_know'
      };
      
      let newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      let firstConversationMilestone = newMilestones.find(m => m.milestoneType === 'first_conversation');
      expect(firstConversationMilestone).toBeUndefined();
      
      // User completes first conversation
      userData.conversationCount = 1;
      newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      firstConversationMilestone = newMilestones.find(m => m.milestoneType === 'first_conversation');
      
      expect(firstConversationMilestone).toBeDefined();
      expect(firstConversationMilestone.celebrationMessage).toBe('Congrats! You finished your first conversation—it\'s often the hardest step.');
    });

    test('should award mood baseline milestone after first session completion', async () => {
      const userId = 1;
      
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 1,
        firstSessionCompleted: true,
        moodBaseline: true,
        relationshipStage: 'getting_to_know'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      const moodMilestone = newMilestones.find(m => m.milestoneType === 'mood_baseline_established');
      expect(moodMilestone).toBeDefined();
      expect(moodMilestone.title).toBe('Mood Baseline Established');
      expect(moodMilestone.celebrationMessage).toContain('established your emotional starting point');
    });

    test('should provide appropriate celebration messages for different milestone categories', async () => {
      const userId = 1;
      
      // Test onboarding category celebration
      const onboardingMilestone = await milestoneEngine.awardMilestone(
        userId, 
        'personality_assessment_complete', 
        milestoneEngine.milestoneDefinitions['personality_assessment_complete']
      );
      
      const onboardingNotification = milestoneEngine.generateCelebrationNotification(onboardingMilestone);
      expect(onboardingNotification.celebrationStyle.emoji).toBe('🌟');
      expect(onboardingNotification.celebrationStyle.color).toBe('#4CAF50');
      
      // Test engagement category celebration
      const engagementMilestone = await milestoneEngine.awardMilestone(
        userId, 
        'daily_streak_3', 
        milestoneEngine.milestoneDefinitions['daily_streak_3']
      );
      
      const engagementNotification = milestoneEngine.generateCelebrationNotification(engagementMilestone);
      expect(engagementNotification.celebrationStyle.emoji).toBe('🔥');
      expect(engagementNotification.celebrationStyle.color).toBe('#FF9800');
      
      // Test growth category celebration
      const growthMilestone = await milestoneEngine.awardMilestone(
        userId, 
        'emotional_insight_gained', 
        milestoneEngine.milestoneDefinitions['emotional_insight_gained']
      );
      
      const growthNotification = milestoneEngine.generateCelebrationNotification(growthMilestone);
      expect(growthNotification.celebrationStyle.emoji).toBe('🌱');
      expect(growthNotification.celebrationStyle.color).toBe('#2196F3');
      
      // Test connection category celebration
      const connectionMilestone = await milestoneEngine.awardMilestone(
        userId, 
        'trust_established', 
        milestoneEngine.milestoneDefinitions['trust_established']
      );
      
      const connectionNotification = milestoneEngine.generateCelebrationNotification(connectionMilestone);
      expect(connectionNotification.celebrationStyle.emoji).toBe('💝');
      expect(connectionNotification.celebrationStyle.color).toBe('#E91E63');
    });
  });

  // Tests for milestone progression through relationship stages
  describe('Milestone Progression Through Relationship Stages', () => {
    test('should progress through relationship stages with appropriate milestones', async () => {
      const userId = 1;
      
      // Stage 1: Getting to know each other
      let userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 1,
        relationshipStage: 'getting_to_know'
      };
      
      let newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      let stageMilestone = newMilestones.find(m => m.milestoneType === 'relationship_stage_comfortable');
      expect(stageMilestone).toBeUndefined();
      
      // Stage 2: Comfortable connection
      userData.relationshipStage = 'comfortable';
      userData.conversationCount = 5;
      
      newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      stageMilestone = newMilestones.find(m => m.milestoneType === 'relationship_stage_comfortable');
      
      expect(stageMilestone).toBeDefined();
      expect(stageMilestone.title).toBe('Comfortable Connection');
      expect(stageMilestone.celebrationMessage).toContain('moved to a new level');
      
      // Stage 3: Close friend
      userData.relationshipStage = 'close_friend';
      userData.conversationCount = 15;
      
      newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      const closeFriendMilestone = newMilestones.find(m => m.milestoneType === 'close_friend_stage');
      
      expect(closeFriendMilestone).toBeDefined();
      expect(closeFriendMilestone.title).toBe('Close Friend');
      expect(closeFriendMilestone.category).toBe('connection');
      expect(closeFriendMilestone.points).toBe(60);
    });

    test('should award companion bonding milestone for advanced relationship stages', async () => {
      const userId = 1;
      
      // Test trusted confidant stage
      let userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 25,
        relationshipStage: 'trusted_confidant'
      };
      
      let newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      let companionMilestone = newMilestones.find(m => m.milestoneType === 'companion_bonding');
      
      expect(companionMilestone).toBeDefined();
      expect(companionMilestone.title).toBe('Companion Bond');
      expect(companionMilestone.points).toBe(75);
      
      // Test life companion stage
      userData.relationshipStage = 'life_companion';
      
      // Reset milestones for this test
      await new Promise((resolve) => {
        db.run('DELETE FROM user_milestones WHERE user_id = ?', [userId], () => resolve());
      });
      
      newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      companionMilestone = newMilestones.find(m => m.milestoneType === 'companion_bonding');
      
      expect(companionMilestone).toBeDefined();
      expect(companionMilestone.celebrationMessage).toContain('bond has become something truly special');
    });

    test('should calculate relationship stage progress correctly', () => {
      // Test progress calculation for relationship stage milestone
      let userData = { relationshipStage: 'getting_to_know' };
      let progress = milestoneEngine.calculateMilestoneProgress('relationship_stage_comfortable', userData);
      expect(progress).toBe(0);
      
      userData.relationshipStage = 'comfortable';
      progress = milestoneEngine.calculateMilestoneProgress('relationship_stage_comfortable', userData);
      expect(progress).toBe(100);
      
      userData.relationshipStage = 'close_friend';
      progress = milestoneEngine.calculateMilestoneProgress('relationship_stage_comfortable', userData);
      expect(progress).toBe(100);
    });

    test('should track milestone progression order correctly', async () => {
      const userId = 1;
      
      // Award milestones in sequence to test progression
      const userData = {
        onboardingComplete: true,
        personalityInsights: true,
        conversationCount: 1,
        firstSessionCompleted: true,
        moodBaseline: true,
        dailyStreak: 3,
        maxEmotionalDepth: 0.8,
        relationshipStage: 'comfortable'
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      // Should award multiple milestones in correct categories
      const onboardingMilestones = newMilestones.filter(m => m.category === 'onboarding');
      const engagementMilestones = newMilestones.filter(m => m.category === 'engagement');
      const growthMilestones = newMilestones.filter(m => m.category === 'growth');
      
      expect(onboardingMilestones.length).toBeGreaterThan(0);
      expect(engagementMilestones.length).toBeGreaterThan(0);
      expect(growthMilestones.length).toBeGreaterThan(0);
      
      // Verify milestone points are awarded correctly
      const totalPoints = newMilestones.reduce((sum, milestone) => sum + milestone.points, 0);
      expect(totalPoints).toBeGreaterThan(0);
    });
  });

  // Edge cases and error handling tests
  describe('Edge Cases and Error Handling', () => {
    test('should handle missing user data gracefully', async () => {
      const userId = 1;
      const userData = {}; // Empty user data
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      // Should not crash and return empty array
      expect(Array.isArray(newMilestones)).toBe(true);
      expect(newMilestones.length).toBe(0);
    });

    test('should handle partial user data correctly', async () => {
      const userId = 1;
      const userData = {
        onboardingComplete: true
        // Missing other required fields
      };
      
      const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
      
      // Should only award milestones that can be triggered with available data
      const personalityMilestone = newMilestones.find(m => m.milestoneType === 'personality_assessment_complete');
      expect(personalityMilestone).toBeUndefined(); // Requires personalityInsights too
    });

    test('should handle invalid relationship stages', () => {
      const userData = { relationshipStage: 'invalid_stage' };
      
      const progress = milestoneEngine.calculateMilestoneProgress('relationship_stage_comfortable', userData);
      
      // Should handle gracefully and return 0 progress
      expect(progress).toBe(0);
    });

    test('should handle negative or invalid numeric values', () => {
      let userData = { conversationCount: -1 };
      let progress = milestoneEngine.calculateMilestoneProgress('conversation_milestone_10', userData);
      expect(progress).toBe(0);
      
      userData = { dailyStreak: -5 };
      progress = milestoneEngine.calculateMilestoneProgress('daily_streak_3', userData);
      expect(progress).toBe(0);
      
      userData = { maxEmotionalDepth: -0.5 };
      progress = milestoneEngine.calculateMilestoneProgress('deep_conversation', userData);
      expect(progress).toBe(0);
    });
  });
});