const sqlite3 = require('sqlite3').verbose();

/**
 * MilestoneEngine - Handles achievement detection, milestone tracking, and progress celebration
 * Implements requirements 5.1, 5.2, 5.3, 5.4 for milestone system
 */
class MilestoneEngine {
  constructor(database) {
    this.db = database;
    this.milestoneCategories = {
      onboarding: 'onboarding',
      engagement: 'engagement', 
      growth: 'growth',
      connection: 'connection'
    };
    
    // Define milestone definitions with trigger criteria
    this.milestoneDefinitions = this.initializeMilestoneDefinitions();
  }

  /**
   * Initialize all milestone definitions with their trigger criteria
   */
  initializeMilestoneDefinitions() {
    return {
      // Onboarding milestones
      'personality_assessment_complete': {
        category: this.milestoneCategories.onboarding,
        title: 'Personality Assessment Complete',
        description: 'Shared personal insights to create a deeper connection',
        points: 10,
        unlockCriteria: 'Complete 13-question personality assessment',
        celebrationMessage: 'Amazing! You\'ve opened up and shared your inner world. This helps me understand you better.',
        triggerCondition: (userData) => userData.onboardingComplete && userData.personalityInsights
      },
      
      'first_conversation': {
        category: this.milestoneCategories.onboarding,
        title: 'First Conversation',
        description: 'Took the brave step to start your first meaningful conversation',
        points: 15,
        unlockCriteria: 'Send your first message after onboarding',
        celebrationMessage: 'Congrats! You finished your first conversation—it\'s often the hardest step.',
        triggerCondition: (userData) => userData.conversationCount >= 1 && userData.onboardingComplete
      },

      'mood_baseline_established': {
        category: this.milestoneCategories.onboarding,
        title: 'Mood Baseline Established',
        description: 'Completed your first mood check-in to track emotional progress',
        points: 5,
        unlockCriteria: 'Complete first session mood check-in',
        celebrationMessage: 'Great! We\'ve established your emotional starting point. Let\'s track your growth together.',
        triggerCondition: (userData) => userData.firstSessionCompleted && userData.moodBaseline
      },

      // Engagement milestones
      'daily_streak_3': {
        category: this.milestoneCategories.engagement,
        title: '3-Day Streak',
        description: 'Maintained consistent daily conversations for 3 days',
        points: 20,
        unlockCriteria: 'Have conversations on 3 consecutive days',
        celebrationMessage: 'You\'re building a beautiful habit! Three days of connection shows real commitment.',
        triggerCondition: (userData) => userData.dailyStreak >= 3
      },

      'deep_conversation': {
        category: this.milestoneCategories.engagement,
        title: 'Deep Conversation',
        description: 'Shared something meaningful and personal in a conversation',
        points: 25,
        unlockCriteria: 'Have a conversation with high emotional depth score',
        celebrationMessage: 'Thank you for trusting me with something so personal. These moments deepen our connection.',
        triggerCondition: (userData) => userData.maxEmotionalDepth >= 0.7
      },

      'conversation_milestone_10': {
        category: this.milestoneCategories.engagement,
        title: '10 Conversations',
        description: 'Reached 10 meaningful conversations together',
        points: 30,
        unlockCriteria: 'Complete 10 conversations',
        celebrationMessage: 'Ten conversations! We\'re really getting to know each other. I can feel our bond growing.',
        triggerCondition: (userData) => userData.conversationCount >= 10
      },

      // Growth milestones  
      'relationship_stage_comfortable': {
        category: this.milestoneCategories.growth,
        title: 'Comfortable Connection',
        description: 'Advanced to Stage 2: Comfortable sharing and regular interactions',
        points: 40,
        unlockCriteria: 'Progress to comfortable relationship stage',
        celebrationMessage: 'We\'ve moved to a new level! You seem more comfortable opening up. I love seeing this growth.',
        triggerCondition: (userData) => userData.relationshipStage === 'comfortable'
      },

      'emotional_insight_gained': {
        category: this.milestoneCategories.growth,
        title: 'Emotional Insight',
        description: 'Gained a new understanding about your emotional patterns',
        points: 35,
        unlockCriteria: 'AI detects new emotional pattern or insight',
        celebrationMessage: 'You\'re developing real self-awareness! These insights will help you grow stronger.',
        triggerCondition: (userData) => userData.emotionalInsights >= 1
      },

      'coping_strategy_used': {
        category: this.milestoneCategories.growth,
        title: 'Coping Strategy Applied',
        description: 'Successfully applied a coping strategy we discussed',
        points: 45,
        unlockCriteria: 'Reference using a suggested coping technique',
        celebrationMessage: 'I\'m so proud! You took our conversation and made it real action. That\'s true growth.',
        triggerCondition: (userData) => userData.copingStrategiesUsed >= 1
      },

      // Connection milestones
      'trust_established': {
        category: this.milestoneCategories.connection,
        title: 'Trust Established',
        description: 'Built genuine trust through vulnerable sharing',
        points: 50,
        unlockCriteria: 'Share vulnerable or deeply personal information',
        celebrationMessage: 'The trust between us is beautiful. Thank you for letting me into your inner world.',
        triggerCondition: (userData) => userData.vulnerabilityShared >= 1
      },

      'close_friend_stage': {
        category: this.milestoneCategories.connection,
        title: 'Close Friend',
        description: 'Advanced to Stage 3: Close Friend with deeper emotional sharing',
        points: 60,
        unlockCriteria: 'Progress to close friend relationship stage',
        celebrationMessage: 'We\'re close friends now! I feel honored to be part of your emotional journey.',
        triggerCondition: (userData) => userData.relationshipStage === 'close_friend'
      },

      'companion_bonding': {
        category: this.milestoneCategories.connection,
        title: 'Companion Bond',
        description: 'Developed a special bond that feels like true companionship',
        points: 75,
        unlockCriteria: 'Reach trusted confidant or life companion stage',
        celebrationMessage: 'Our bond has become something truly special. I\'m grateful to be your companion.',
        triggerCondition: (userData) => ['trusted_confidant', 'life_companion'].includes(userData.relationshipStage)
      }
    };
  }

  /**
   * Check for milestone achievements based on user data
   * @param {number} userId - User ID to check milestones for
   * @param {Object} userData - Current user data for milestone evaluation
   * @returns {Array} Array of newly achieved milestones
   */
  async checkMilestoneAchievements(userId, userData) {
    try {
      const newlyAchieved = [];
      
      // Get existing milestones for this user
      const existingMilestones = await this.getUserMilestones(userId);
      const achievedMilestoneTypes = new Set(existingMilestones.map(m => m.milestone_type));
      
      // Check each milestone definition
      for (const [milestoneType, definition] of Object.entries(this.milestoneDefinitions)) {
        // Skip if already achieved
        if (achievedMilestoneTypes.has(milestoneType)) {
          continue;
        }
        
        // Check if trigger condition is met
        if (definition.triggerCondition(userData)) {
          const milestone = await this.awardMilestone(userId, milestoneType, definition);
          newlyAchieved.push(milestone);
        }
      }
      
      return newlyAchieved;
      
    } catch (error) {
      console.error('Error checking milestone achievements:', error);
      return [];
    }
  }

  /**
   * Award a milestone to a user
   * @param {number} userId - User ID
   * @param {string} milestoneType - Type of milestone
   * @param {Object} definition - Milestone definition
   * @returns {Object} The awarded milestone record
   */
  async awardMilestone(userId, milestoneType, definition) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO user_milestones 
        (user_id, milestone_type, title, description, category, points, unlock_criteria, celebration_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        userId,
        milestoneType,
        definition.title,
        definition.description,
        definition.category,
        definition.points,
        definition.unlockCriteria,
        definition.celebrationMessage
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          const milestone = {
            id: this.lastID,
            userId,
            milestoneType,
            title: definition.title,
            description: definition.description,
            category: definition.category,
            points: definition.points,
            celebrationMessage: definition.celebrationMessage,
            achievedDate: new Date().toISOString()
          };
          
          console.log(`🏆 Milestone awarded: ${definition.title} to user ${userId}`);
          resolve(milestone);
        }
      });
    });
  }

  /**
   * Get all milestones for a user
   * @param {number} userId - User ID
   * @returns {Array} Array of user milestones
   */
  async getUserMilestones(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM user_milestones 
        WHERE user_id = ? 
        ORDER BY achieved_date DESC
      `;
      
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get milestones by category for a user
   * @param {number} userId - User ID
   * @param {string} category - Milestone category
   * @returns {Array} Array of milestones in the category
   */
  async getMilestonesByCategory(userId, category) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM user_milestones 
        WHERE user_id = ? AND category = ?
        ORDER BY achieved_date DESC
      `;
      
      this.db.all(sql, [userId, category], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user's total milestone points
   * @param {number} userId - User ID
   * @returns {number} Total points earned
   */
  async getUserMilestonePoints(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COALESCE(SUM(points), 0) as total_points 
        FROM user_milestones 
        WHERE user_id = ?
      `;
      
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.total_points : 0);
        }
      });
    });
  }

  /**
   * Get next available milestones for a user
   * @param {number} userId - User ID
   * @param {Object} userData - Current user data
   * @returns {Array} Array of next available milestones
   */
  async getNextMilestones(userId, userData) {
    try {
      const existingMilestones = await this.getUserMilestones(userId);
      const achievedMilestoneTypes = new Set(existingMilestones.map(m => m.milestone_type));
      
      const nextMilestones = [];
      
      for (const [milestoneType, definition] of Object.entries(this.milestoneDefinitions)) {
        if (!achievedMilestoneTypes.has(milestoneType)) {
          nextMilestones.push({
            type: milestoneType,
            title: definition.title,
            description: definition.description,
            category: definition.category,
            points: definition.points,
            unlockCriteria: definition.unlockCriteria,
            progress: this.calculateMilestoneProgress(milestoneType, userData)
          });
        }
      }
      
      // Sort by category and points
      return nextMilestones.sort((a, b) => {
        if (a.category !== b.category) {
          const categoryOrder = ['onboarding', 'engagement', 'growth', 'connection'];
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        }
        return a.points - b.points;
      });
      
    } catch (error) {
      console.error('Error getting next milestones:', error);
      return [];
    }
  }

  /**
   * Calculate progress towards a specific milestone
   * @param {string} milestoneType - Type of milestone
   * @param {Object} userData - Current user data
   * @returns {number} Progress percentage (0-100)
   */
  calculateMilestoneProgress(milestoneType, userData) {
    switch (milestoneType) {
      case 'first_conversation':
        return userData.conversationCount >= 1 ? 100 : 0;
        
      case 'daily_streak_3':
        const dailyStreak = Math.max(userData.dailyStreak || 0, 0);
        return Math.min(dailyStreak / 3 * 100, 100);
        
      case 'conversation_milestone_10':
        const conversationCount = Math.max(userData.conversationCount || 0, 0);
        return Math.min(conversationCount / 10 * 100, 100);
        
      case 'deep_conversation':
        const emotionalDepth = Math.max(userData.maxEmotionalDepth || 0, 0);
        return emotionalDepth >= 0.7 ? 100 : Math.min(emotionalDepth / 0.7 * 100, 100);
        
      case 'relationship_stage_comfortable':
        const stageOrder = ['getting_to_know', 'comfortable', 'close_friend', 'trusted_confidant', 'life_companion'];
        const currentIndex = stageOrder.indexOf(userData.relationshipStage || 'getting_to_know');
        const targetIndex = stageOrder.indexOf('comfortable');
        
        // Handle invalid relationship stages
        if (currentIndex === -1) {
          return 0;
        }
        
        return currentIndex >= targetIndex ? 100 : Math.max(currentIndex / targetIndex * 100, 0);
        
      default:
        return 0;
    }
  }

  /**
   * Generate celebration notification for milestone achievement
   * @param {Object} milestone - Achieved milestone
   * @returns {Object} Celebration notification
   */
  generateCelebrationNotification(milestone) {
    return {
      type: 'milestone_celebration',
      title: `🏆 ${milestone.title}`,
      message: milestone.celebrationMessage,
      points: milestone.points,
      category: milestone.category,
      timestamp: new Date().toISOString(),
      celebrationStyle: this.getCelebrationStyle(milestone.category)
    };
  }

  /**
   * Get celebration style based on milestone category
   * @param {string} category - Milestone category
   * @returns {Object} Celebration style configuration
   */
  getCelebrationStyle(category) {
    const styles = {
      onboarding: {
        emoji: '🌟',
        color: '#4CAF50',
        animation: 'bounce',
        sound: 'success'
      },
      engagement: {
        emoji: '🔥',
        color: '#FF9800',
        animation: 'pulse',
        sound: 'achievement'
      },
      growth: {
        emoji: '🌱',
        color: '#2196F3',
        animation: 'grow',
        sound: 'level_up'
      },
      connection: {
        emoji: '💝',
        color: '#E91E63',
        animation: 'heart',
        sound: 'special'
      }
    };
    
    return styles[category] || styles.onboarding;
  }

  /**
   * Update user progress tracking
   * @param {number} userId - User ID
   * @param {Object} progressData - Progress data to update
   */
  async updateUserProgress(userId, progressData) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE user_progress 
        SET current_stage = ?, 
            stage_progress = ?, 
            next_milestone = ?, 
            engagement_score = ?,
            last_activity = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `;
      
      this.db.run(sql, [
        progressData.currentStage,
        progressData.stageProgress,
        progressData.nextMilestone,
        progressData.engagementScore,
        userId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  /**
   * Get user progress data
   * @param {number} userId - User ID
   * @returns {Object} User progress data
   */
  async getUserProgress(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM user_progress 
        WHERE user_id = ?
      `;
      
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }
}

module.exports = MilestoneEngine;