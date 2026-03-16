const sqlite3 = require('sqlite3').verbose();

/**
 * EngagementAnalyticsService - Tracks user engagement patterns and session metrics
 * 
 * This service monitors user interactions, calculates engagement scores, and provides
 * analytics data for retention analysis and dashboard visualization.
 */
class EngagementAnalyticsService {
  constructor(database) {
    this.db = database;
    this.activeSessions = new Map(); // Track active sessions in memory
  }

  /**
   * Starts a new engagement session for a user
   * @param {number} userId - User ID
   * @param {Object} sessionData - Initial session data
   * @returns {Promise<number>} Session ID
   */
  async startSession(userId, sessionData = {}) {
    try {
      const sessionStart = new Date().toISOString();
      
      const sessionId = await new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO engagement_analytics 
          (user_id, session_start, messages_sent, emotional_depth_score, retention_risk_score)
          VALUES (?, ?, 0, 0.0, 0.0)
        `, [userId, sessionStart], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      // Store session in memory for tracking
      this.activeSessions.set(userId, {
        sessionId,
        sessionStart: new Date(sessionStart),
        messageCount: 0,
        emotionalDepthSum: 0,
        lastActivity: new Date(),
        milestoneAchieved: null
      });

      console.log(`📊 Started engagement session ${sessionId} for user ${userId}`);
      return sessionId;
    } catch (error) {
      console.error('Error starting engagement session:', error);
      throw error;
    }
  }

  /**
   * Updates session metrics during conversation
   * @param {number} userId - User ID
   * @param {Object} messageData - Message analysis data
   * @returns {Promise<void>}
   */
  async updateSessionMetrics(userId, messageData) {
    try {
      const session = this.activeSessions.get(userId);
      
      if (!session) {
        // Start a new session if none exists
        await this.startSession(userId);
        return this.updateSessionMetrics(userId, messageData);
      }

      // Update session metrics
      session.messageCount++;
      session.lastActivity = new Date();
      
      // Calculate emotional depth score from message content
      const emotionalDepth = this.calculateEmotionalDepth(messageData);
      session.emotionalDepthSum += emotionalDepth;
      
      // Update milestone if achieved
      if (messageData.milestoneAchieved) {
        session.milestoneAchieved = messageData.milestoneAchieved;
      }

      // Update database with current metrics
      const avgEmotionalDepth = session.emotionalDepthSum / session.messageCount;
      
      await new Promise((resolve, reject) => {
        this.db.run(`
          UPDATE engagement_analytics 
          SET messages_sent = ?, 
              emotional_depth_score = ?,
              milestone_achieved = ?,
              session_end = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          session.messageCount,
          avgEmotionalDepth,
          session.milestoneAchieved,
          session.sessionId
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`📊 Updated session metrics for user ${userId}: ${session.messageCount} messages, depth: ${avgEmotionalDepth.toFixed(2)}`);
    } catch (error) {
      console.error('Error updating session metrics:', error);
    }
  }

  /**
   * Calculates emotional depth score from message content
   * @param {Object} messageData - Message analysis data
   * @returns {number} Emotional depth score (0.0 - 1.0)
   */
  calculateEmotionalDepth(messageData) {
    let depthScore = 0.0;
    
    const { 
      message, 
      response, 
      emotion_detected, 
      mood_score, 
      messageLength, 
      responseLength,
      sessionContext 
    } = messageData;
    
    // Factor 1: Message length and complexity (20% weight)
    if (message && message.length > 50) {
      depthScore += 0.1;
      if (message.length > 150) {
        depthScore += 0.1;
      }
    }
    
    // Factor 2: Emotional keywords and expressions (40% weight)
    const emotionalKeywords = [
      'feel', 'feeling', 'felt', 'emotion', 'emotional',
      'sad', 'happy', 'angry', 'frustrated', 'anxious', 'worried',
      'love', 'hate', 'fear', 'hope', 'dream', 'wish',
      'struggle', 'difficult', 'challenge', 'problem',
      'grateful', 'thankful', 'appreciate', 'blessed',
      'hurt', 'pain', 'healing', 'growth', 'change'
    ];
    
    const personalKeywords = [
      'I feel', 'I think', 'I believe', 'I want', 'I need',
      'my family', 'my relationship', 'my job', 'my life',
      'personally', 'for me', 'in my experience'
    ];
    
    if (message) {
      const lowerMessage = message.toLowerCase();
      
      // Count emotional keywords
      const emotionalMatches = emotionalKeywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      const personalMatches = personalKeywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      depthScore += Math.min(emotionalMatches * 0.05, 0.2);
      depthScore += Math.min(personalMatches * 0.08, 0.2);
    }
    
    // Factor 3: Detected emotion intensity (25% weight)
    if (emotion_detected) {
      const strongEmotions = ['sad', 'angry', 'anxious', 'excited', 'grateful'];
      if (strongEmotions.includes(emotion_detected.toLowerCase())) {
        depthScore += 0.15;
      } else {
        depthScore += 0.1;
      }
    }
    
    // Factor 4: Mood score impact (15% weight)
    if (mood_score !== null && mood_score !== undefined) {
      // Extreme mood scores (very low or very high) indicate emotional engagement
      const moodIntensity = Math.abs(mood_score - 5) / 5; // Normalize to 0-1
      depthScore += moodIntensity * 0.15;
    }
    
    // Factor 5: Message length and complexity (10% weight)
    if (messageLength && messageLength > 100) {
      depthScore += 0.05;
      if (messageLength > 300) {
        depthScore += 0.05;
      }
    }
    
    // Factor 6: Session context bonuses (10% weight)
    if (sessionContext) {
      // First session bonus for completing onboarding
      if (sessionContext.isFirstSession) {
        depthScore += 0.05;
      }
      
      // Relationship stage bonus for deeper stages
      const stageBonus = {
        'getting_to_know': 0,
        'comfortable': 0.02,
        'close_friend': 0.04,
        'trusted_confidant': 0.06,
        'life_companion': 0.08
      };
      depthScore += stageBonus[sessionContext.relationshipStage] || 0;
    }
    
    return Math.min(depthScore, 1.0); // Cap at 1.0
  }

  /**
   * Ends a session and calculates final metrics
   * @param {number} userId - User ID
   * @param {Object} endData - Session end data
   * @returns {Promise<Object>} Final session metrics
   */
  async endSession(userId, endData = {}) {
    try {
      const session = this.activeSessions.get(userId);
      
      if (!session) {
        console.log(`No active session found for user ${userId}`);
        return null;
      }

      const sessionDuration = (new Date() - session.sessionStart) / 1000; // Duration in seconds
      const avgEmotionalDepth = session.messageCount > 0 ? session.emotionalDepthSum / session.messageCount : 0;
      
      // Calculate retention risk score
      const retentionRisk = await this.calculateRetentionRiskScore(userId, {
        messageCount: session.messageCount,
        sessionDuration,
        emotionalDepth: avgEmotionalDepth,
        milestoneAchieved: session.milestoneAchieved
      });

      // Predict next engagement time
      const nextEngagementPrediction = await this.predictNextEngagement(userId);

      // Update final session data
      await new Promise((resolve, reject) => {
        this.db.run(`
          UPDATE engagement_analytics 
          SET session_end = CURRENT_TIMESTAMP,
              retention_risk_score = ?,
              next_engagement_prediction = ?
          WHERE id = ?
        `, [
          retentionRisk,
          nextEngagementPrediction,
          session.sessionId
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Remove from active sessions
      this.activeSessions.delete(userId);

      const finalMetrics = {
        sessionId: session.sessionId,
        duration: sessionDuration,
        messageCount: session.messageCount,
        avgEmotionalDepth,
        retentionRisk,
        milestoneAchieved: session.milestoneAchieved,
        nextEngagementPrediction
      };

      console.log(`📊 Ended session ${session.sessionId} for user ${userId}:`, finalMetrics);
      return finalMetrics;
    } catch (error) {
      console.error('Error ending engagement session:', error);
      throw error;
    }
  }

  /**
   * Calculates retention risk score based on session data
   * @param {number} userId - User ID
   * @param {Object} sessionData - Current session data
   * @returns {Promise<number>} Risk score (0.0 - 1.0)
   */
  async calculateRetentionRiskScore(userId, sessionData) {
    try {
      let riskScore = 0.0;
      
      const { messageCount, sessionDuration, emotionalDepth, milestoneAchieved } = sessionData;
      
      // Factor 1: Session engagement level (40% weight)
      if (messageCount < 2) {
        riskScore += 0.25; // Very short session
      } else if (messageCount < 5) {
        riskScore += 0.15; // Short session
      } else if (messageCount > 15) {
        riskScore -= 0.1; // Long session is good
      }
      
      if (sessionDuration < 120) { // Less than 2 minutes
        riskScore += 0.15;
      } else if (sessionDuration > 900) { // More than 15 minutes
        riskScore -= 0.1;
      }
      
      // Factor 2: Emotional engagement (30% weight)
      if (emotionalDepth < 0.2) {
        riskScore += 0.2; // Low emotional engagement
      } else if (emotionalDepth > 0.6) {
        riskScore -= 0.15; // High emotional engagement
      }
      
      // Factor 3: Milestone achievement (20% weight)
      if (milestoneAchieved) {
        riskScore -= 0.2; // Milestone achievement reduces risk
      }
      
      // Factor 4: Historical pattern (10% weight)
      const recentSessions = await this.getRecentSessions(userId, 5);
      if (recentSessions.length > 0) {
        const avgRecentMessages = recentSessions.reduce((sum, s) => sum + s.messages_sent, 0) / recentSessions.length;
        
        if (messageCount < avgRecentMessages * 0.5) {
          riskScore += 0.1; // Declining engagement pattern
        }
      }
      
      return Math.max(0.0, Math.min(riskScore, 1.0)); // Clamp between 0 and 1
    } catch (error) {
      console.error('Error calculating retention risk score:', error);
      return 0.5; // Default medium risk
    }
  }

  /**
   * Gets recent engagement sessions for a user
   * @param {number} userId - User ID
   * @param {number} limit - Number of sessions to retrieve
   * @returns {Promise<Array>} Recent sessions
   */
  async getRecentSessions(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM engagement_analytics 
        WHERE user_id = ? 
        ORDER BY session_start DESC 
        LIMIT ?
      `, [userId, limit], (err, results) => {
        if (err) reject(err);
        else resolve(results || []);
      });
    });
  }

  /**
   * Predicts next engagement time based on user patterns
   * @param {number} userId - User ID
   * @returns {Promise<string>} Predicted next engagement time (ISO string)
   */
  async predictNextEngagement(userId) {
    try {
      // Get user's conversation history to analyze patterns
      const conversationPattern = await new Promise((resolve, reject) => {
        this.db.all(`
          SELECT DATE(timestamp) as conversation_date, 
                 COUNT(*) as daily_messages,
                 strftime('%H', timestamp) as hour_of_day
          FROM conversations 
          WHERE user_id = ? 
            AND timestamp > datetime('now', '-30 days')
          GROUP BY DATE(timestamp), strftime('%H', timestamp)
          ORDER BY timestamp DESC
        `, [userId], (err, results) => {
          if (err) reject(err);
          else resolve(results || []);
        });
      });

      if (conversationPattern.length === 0) {
        // No pattern available, predict 24 hours from now
        const nextEngagement = new Date();
        nextEngagement.setHours(nextEngagement.getHours() + 24);
        return nextEngagement.toISOString();
      }

      // Analyze conversation frequency
      const uniqueDays = [...new Set(conversationPattern.map(p => p.conversation_date))];
      const avgDaysBetweenConversations = uniqueDays.length > 1 ? 30 / uniqueDays.length : 1;
      
      // Analyze preferred time of day
      const hourCounts = {};
      conversationPattern.forEach(p => {
        hourCounts[p.hour_of_day] = (hourCounts[p.hour_of_day] || 0) + 1;
      });
      
      const preferredHour = Object.keys(hourCounts).reduce((a, b) => 
        hourCounts[a] > hourCounts[b] ? a : b
      ) || 14; // Default to 2 PM

      // Predict next engagement
      const nextEngagement = new Date();
      nextEngagement.setDate(nextEngagement.getDate() + Math.ceil(avgDaysBetweenConversations));
      nextEngagement.setHours(parseInt(preferredHour), 0, 0, 0);

      return nextEngagement.toISOString();
    } catch (error) {
      console.error('Error predicting next engagement:', error);
      
      // Fallback: 24 hours from now
      const nextEngagement = new Date();
      nextEngagement.setHours(nextEngagement.getHours() + 24);
      return nextEngagement.toISOString();
    }
  }

  /**
   * Gets engagement analytics for dashboard display
   * @param {number} userId - User ID
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Analytics data
   */
  async getEngagementAnalytics(userId, days = 30) {
    try {
      const analytics = {
        totalSessions: 0,
        totalMessages: 0,
        avgSessionDuration: 0,
        avgEmotionalDepth: 0,
        avgRetentionRisk: 0,
        milestonesAchieved: 0,
        engagementTrend: 'stable',
        dailyActivity: [],
        riskFactors: []
      };

      // Get session data for the specified period
      const sessions = await new Promise((resolve, reject) => {
        this.db.all(`
          SELECT * FROM engagement_analytics 
          WHERE user_id = ? 
            AND session_start > datetime('now', '-${days} days')
          ORDER BY session_start DESC
        `, [userId], (err, results) => {
          if (err) reject(err);
          else resolve(results || []);
        });
      });

      if (sessions.length === 0) {
        return analytics;
      }

      // Calculate basic metrics
      analytics.totalSessions = sessions.length;
      analytics.totalMessages = sessions.reduce((sum, s) => sum + (s.messages_sent || 0), 0);
      
      const sessionsWithDuration = sessions.filter(s => s.session_start && s.session_end);
      if (sessionsWithDuration.length > 0) {
        const totalDuration = sessionsWithDuration.reduce((sum, s) => {
          const start = new Date(s.session_start);
          const end = new Date(s.session_end);
          return sum + (end - start) / 1000; // Duration in seconds
        }, 0);
        analytics.avgSessionDuration = totalDuration / sessionsWithDuration.length;
      }

      analytics.avgEmotionalDepth = sessions.reduce((sum, s) => sum + (s.emotional_depth_score || 0), 0) / sessions.length;
      analytics.avgRetentionRisk = sessions.reduce((sum, s) => sum + (s.retention_risk_score || 0), 0) / sessions.length;
      analytics.milestonesAchieved = sessions.filter(s => s.milestone_achieved).length;

      // Calculate engagement trend
      const recentSessions = sessions.slice(0, Math.floor(sessions.length / 2));
      const olderSessions = sessions.slice(Math.floor(sessions.length / 2));
      
      if (recentSessions.length > 0 && olderSessions.length > 0) {
        const recentAvgMessages = recentSessions.reduce((sum, s) => sum + (s.messages_sent || 0), 0) / recentSessions.length;
        const olderAvgMessages = olderSessions.reduce((sum, s) => sum + (s.messages_sent || 0), 0) / olderSessions.length;
        
        if (recentAvgMessages > olderAvgMessages * 1.2) {
          analytics.engagementTrend = 'improving';
        } else if (recentAvgMessages < olderAvgMessages * 0.8) {
          analytics.engagementTrend = 'declining';
        }
      }

      // Generate daily activity data
      const dailyData = {};
      sessions.forEach(session => {
        const date = session.session_start.split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { messages: 0, sessions: 0, avgDepth: 0 };
        }
        dailyData[date].messages += session.messages_sent || 0;
        dailyData[date].sessions += 1;
        dailyData[date].avgDepth += session.emotional_depth_score || 0;
      });

      analytics.dailyActivity = Object.keys(dailyData).map(date => ({
        date,
        messages: dailyData[date].messages,
        sessions: dailyData[date].sessions,
        avgDepth: dailyData[date].avgDepth / dailyData[date].sessions
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

      // Identify risk factors
      if (analytics.avgRetentionRisk > 0.6) {
        analytics.riskFactors.push('High retention risk detected');
      }
      if (analytics.avgEmotionalDepth < 0.3) {
        analytics.riskFactors.push('Low emotional engagement');
      }
      if (analytics.engagementTrend === 'declining') {
        analytics.riskFactors.push('Declining engagement pattern');
      }
      if (analytics.totalSessions < days / 7) {
        analytics.riskFactors.push('Infrequent usage pattern');
      }

      return analytics;
    } catch (error) {
      console.error('Error getting engagement analytics:', error);
      throw error;
    }
  }

  /**
   * Gets current active session for a user
   * @param {number} userId - User ID
   * @returns {Object|null} Active session data
   */
  getActiveSession(userId) {
    return this.activeSessions.get(userId) || null;
  }

  /**
   * Checks if user has an active session
   * @param {number} userId - User ID
   * @returns {boolean} True if user has active session
   */
  hasActiveSession(userId) {
    return this.activeSessions.has(userId);
  }

  /**
   * Cleans up inactive sessions (sessions older than 30 minutes with no activity)
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupInactiveSessions() {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      let cleanedCount = 0;

      for (const [userId, session] of this.activeSessions.entries()) {
        if (session.lastActivity < thirtyMinutesAgo) {
          await this.endSession(userId, { reason: 'timeout' });
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`📊 Cleaned up ${cleanedCount} inactive sessions`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error);
      return 0;
    }
  }
}

module.exports = EngagementAnalyticsService;