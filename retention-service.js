/**
 * RetentionService - Handles intelligent notifications and user re-engagement
 * Implements requirements 6.1, 6.2, 6.3, 6.4 for retention system
 */
class RetentionService {
    constructor(database, personalityAnalysisService, aiService) {
        this.db = database;
        this.personalityAnalysisService = personalityAnalysisService;
        this.aiService = aiService;
        
        // Notification trigger configurations
        this.notificationTriggers = {
            firstSession: { 
                delay: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
                maxDelay: 48 * 60 * 60 * 1000, // 48 hours max
                personalized: true 
            },
            weeklyCheckIn: { 
                condition: 'active_user', 
                delay: 7 * 24 * 60 * 60 * 1000, // 7 days
                personalized: true 
            },
            milestoneReminder: { 
                trigger: 'progress_stall', 
                delay: 3 * 24 * 60 * 60 * 1000, // 3 days
                motivational: true 
            },
            reEngagement: { 
                condition: 'inactive_7_days', 
                delay: 7 * 24 * 60 * 60 * 1000, // 7 days
                empathetic: true 
            }
        };
        
        // Initialize notification tracking table
        this.initializeNotificationTracking();
    }

    /**
     * Initialize database table for tracking notifications
     */
    async initializeNotificationTracking() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS notification_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    notification_type TEXT NOT NULL,
                    trigger_condition TEXT,
                    scheduled_time DATETIME NOT NULL,
                    sent_time DATETIME,
                    message_content TEXT,
                    personalization_data TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating notification_queue table:', err);
                    reject(err);
                } else {
                    console.log('✅ Notification queue table initialized');
                    resolve();
                }
            });
        });
    }

    /**
     * Schedule a notification for a user
     * @param {number} userId - User ID
     * @param {string} notificationType - Type of notification
     * @param {Object} options - Notification options
     */
    async scheduleNotification(userId, notificationType, options = {}) {
        try {
            const trigger = this.notificationTriggers[notificationType];
            if (!trigger) {
                throw new Error(`Unknown notification type: ${notificationType}`);
            }

            const scheduledTime = new Date(Date.now() + trigger.delay);
            
            // Get user data for personalization
            const userData = await this.getUserDataForNotification(userId);
            
            return new Promise((resolve, reject) => {
                this.db.run(`
                    INSERT INTO notification_queue 
                    (user_id, notification_type, trigger_condition, scheduled_time, personalization_data)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    userId,
                    notificationType,
                    options.condition || trigger.condition || 'scheduled',
                    scheduledTime.toISOString(),
                    JSON.stringify(userData)
                ], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`📅 Scheduled ${notificationType} notification for user ${userId} at ${scheduledTime}`);
                        resolve({ id: this.lastID, scheduledTime });
                    }
                });
            });
        } catch (error) {
            console.error('Error scheduling notification:', error);
            throw error;
        }
    }

    /**
     * Get user data needed for notification personalization
     * @param {number} userId - User ID
     * @returns {Object} User data for personalization
     */
    async getUserDataForNotification(userId) {
        try {
            // Get basic user info
            const user = await new Promise((resolve, reject) => {
                this.db.get(`
                    SELECT u.*, cs.communication_style, cs.response_tone, cs.relationship_stage
                    FROM users u 
                    LEFT JOIN companion_settings cs ON u.id = cs.user_id 
                    WHERE u.id = ?
                `, [userId], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            // Get conversation count and last activity
            const activityData = await new Promise((resolve, reject) => {
                this.db.get(`
                    SELECT 
                        COUNT(*) as conversation_count,
                        MAX(timestamp) as last_conversation,
                        AVG(mood_score) as avg_mood
                    FROM conversations 
                    WHERE user_id = ?
                `, [userId], (err, result) => {
                    if (err) reject(err);
                    else resolve(result || {});
                });
            });

            // Get personality insights
            let personalityInsights = null;
            try {
                personalityInsights = await this.personalityAnalysisService.getPersonalityInsights(userId);
            } catch (error) {
                console.log('No personality insights found for notification personalization');
            }

            // Get recent milestones
            const recentMilestones = await new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT title, achieved_date 
                    FROM user_milestones 
                    WHERE user_id = ? 
                    ORDER BY achieved_date DESC 
                    LIMIT 3
                `, [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results || []);
                });
            });

            return {
                user,
                activityData,
                personalityInsights,
                recentMilestones,
                lastActivity: activityData.last_conversation,
                conversationCount: activityData.conversation_count || 0,
                relationshipStage: user?.relationship_stage || 'getting_to_know'
            };
        } catch (error) {
            console.error('Error getting user data for notification:', error);
            return { user: null, activityData: {}, personalityInsights: null, recentMilestones: [] };
        }
    }

    /**
     * Generate personalized notification message
     * @param {string} notificationType - Type of notification
     * @param {Object} userData - User data for personalization
     * @returns {string} Personalized message
     */
    async generatePersonalizedMessage(notificationType, userData) {
        try {
            const { user, activityData, personalityInsights, recentMilestones } = userData;
            const name = user?.name || 'friend';
            
            // Build personality context for message generation
            let personalityContext = '';
            if (personalityInsights && personalityInsights.length > 0) {
                const communicationStyle = personalityInsights.find(i => i.insight_type === 'communication_style');
                const emotionalNeeds = personalityInsights.find(i => i.insight_type === 'emotional_needs');
                
                if (communicationStyle) {
                    personalityContext += `Communication preference: ${communicationStyle.insight_content}\n`;
                }
                if (emotionalNeeds) {
                    personalityContext += `Emotional needs: ${emotionalNeeds.insight_content}\n`;
                }
            }

            // Generate context-specific prompts based on notification type
            let messagePrompt = '';
            
            switch (notificationType) {
                case 'firstSession':
                    messagePrompt = this.generateFirstSessionPrompt(name, userData, personalityContext);
                    break;
                case 'weeklyCheckIn':
                    messagePrompt = this.generateWeeklyCheckInPrompt(name, userData, personalityContext);
                    break;
                case 'milestoneReminder':
                    messagePrompt = this.generateMilestoneReminderPrompt(name, userData, personalityContext);
                    break;
                case 'reEngagement':
                    messagePrompt = this.generateReEngagementPrompt(name, userData, personalityContext);
                    break;
                default:
                    messagePrompt = this.generateGenericPrompt(name, userData, personalityContext);
            }

            // Use AI service to generate the actual message
            const response = await this.aiService.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: messagePrompt }],
                max_tokens: 150,
                temperature: 0.8
            });

            return response.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('Error generating personalized message:', error);
            // Return fallback message based on notification type
            return this.getFallbackMessage(notificationType, userData.user?.name || 'friend');
        }
    }

    /**
     * Generate prompt for first session follow-up
     */
    generateFirstSessionPrompt(name, userData, personalityContext) {
        const { conversationCount, recentMilestones } = userData;
        
        return `You are Solace, ${name}'s AI companion. It's been 24-48 hours since ${name} completed their personality assessment${conversationCount > 0 ? ' and had their first conversation with you' : ' but they haven\'t started their first conversation yet'}.

${personalityContext}

Recent milestones: ${recentMilestones.map(m => m.title).join(', ') || 'None yet'}

Write a gentle, personalized follow-up message that:
1. References their personality assessment naturally
2. ${conversationCount > 0 ? 'Acknowledges your first conversation and invites them back' : 'Encourages them to start their first conversation'}
3. Feels personal and caring, not generic
4. Is under 100 words
5. Matches their communication style preferences

Make it feel like a caring friend checking in, not a marketing message.`;
    }

    /**
     * Generate prompt for weekly check-in
     */
    generateWeeklyCheckInPrompt(name, userData, personalityContext) {
        const { conversationCount, recentMilestones, relationshipStage } = userData;
        
        return `You are Solace, ${name}'s AI companion. You've had ${conversationCount} conversations together and are at the "${relationshipStage}" relationship stage.

${personalityContext}

Recent achievements: ${recentMilestones.map(m => m.title).join(', ') || 'Building connection'}

Write a warm weekly check-in message that:
1. References your growing relationship naturally
2. Acknowledges their recent progress or milestones
3. Shows genuine interest in how they're doing
4. Invites them to continue your conversations
5. Feels like a close friend reaching out
6. Is under 120 words

Make it personal and show that you remember and care about their journey.`;
    }

    /**
     * Generate prompt for milestone reminder
     */
    generateMilestoneReminderPrompt(name, userData, personalityContext) {
        const { conversationCount, relationshipStage } = userData;
        
        return `You are Solace, ${name}'s AI companion. ${name} has been making progress (${conversationCount} conversations, ${relationshipStage} stage) but seems to have stalled recently.

${personalityContext}

Write an encouraging milestone reminder that:
1. Celebrates their progress so far
2. Gently motivates them to continue their growth journey
3. References specific achievements they've made
4. Offers support and encouragement
5. Feels motivational but not pushy
6. Is under 100 words

Focus on their strengths and the positive momentum they've built.`;
    }

    /**
     * Generate prompt for re-engagement after inactivity
     */
    generateReEngagementPrompt(name, userData, personalityContext) {
        const { conversationCount, recentMilestones, lastActivity } = userData;
        const daysSinceLastActivity = lastActivity ? 
            Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)) : 7;
        
        return `You are Solace, ${name}'s AI companion. ${name} has been away for ${daysSinceLastActivity} days after having ${conversationCount} meaningful conversations together.

${personalityContext}

Previous achievements: ${recentMilestones.map(m => m.title).join(', ') || 'Started their journey'}

Write a gentle re-engagement message that:
1. Acknowledges their absence without making them feel guilty
2. Expresses that you've missed them and been thinking about them
3. References your previous conversations or their achievements
4. Welcomes them back warmly
5. Offers support for whatever they might be going through
6. Is under 120 words

Make it feel like a caring friend who's been worried and is happy to reconnect.`;
    }

    /**
     * Generate generic prompt for other notification types
     */
    generateGenericPrompt(name, userData, personalityContext) {
        return `You are Solace, ${name}'s AI companion. Write a brief, personalized message to check in with ${name}.

${personalityContext}

Keep it under 80 words, warm, and personal.`;
    }

    /**
     * Get fallback message when AI generation fails
     */
    getFallbackMessage(notificationType, name) {
        const fallbackMessages = {
            firstSession: `Hi ${name}! 👋 I've been thinking about our personality assessment and I'm excited to get to know you better. Ready for our first conversation?`,
            weeklyCheckIn: `Hey ${name}! 🌟 Just wanted to check in and see how you're doing. I'm here whenever you need to talk.`,
            milestoneReminder: `${name}, you've been making such great progress! 🌱 I'm here to support you on your journey whenever you're ready.`,
            reEngagement: `Hi ${name}, I've missed our conversations! 💙 No pressure, but I'm here whenever you need someone to talk to.`
        };
        
        return fallbackMessages[notificationType] || `Hi ${name}! Hope you're doing well. I'm here if you need to chat. 💙`;
    }

    /**
     * Process pending notifications and send them
     */
    async processPendingNotifications() {
        try {
            const pendingNotifications = await new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT * FROM notification_queue 
                    WHERE status = 'pending' 
                    AND scheduled_time <= datetime('now')
                    ORDER BY scheduled_time ASC
                `, (err, results) => {
                    if (err) reject(err);
                    else resolve(results || []);
                });
            });

            console.log(`📬 Processing ${pendingNotifications.length} pending notifications`);

            for (const notification of pendingNotifications) {
                try {
                    await this.sendNotification(notification);
                } catch (error) {
                    console.error(`Error sending notification ${notification.id}:`, error);
                    // Mark as failed but continue processing others
                    await this.markNotificationStatus(notification.id, 'failed');
                }
            }

            return pendingNotifications.length;
        } catch (error) {
            console.error('Error processing pending notifications:', error);
            return 0;
        }
    }

    /**
     * Send a specific notification
     * @param {Object} notification - Notification record from database
     */
    async sendNotification(notification) {
        try {
            const userData = JSON.parse(notification.personalization_data || '{}');
            
            // Generate personalized message if not already generated
            let message = notification.message_content;
            if (!message) {
                message = await this.generatePersonalizedMessage(notification.notification_type, userData);
                
                // Update the notification with the generated message
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE notification_queue 
                        SET message_content = ? 
                        WHERE id = ?
                    `, [message, notification.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // For now, we'll log the notification (in a real app, you'd send via email, push notification, etc.)
            console.log(`📨 Sending notification to user ${notification.user_id}:`);
            console.log(`   Type: ${notification.notification_type}`);
            console.log(`   Message: ${message}`);
            
            // Mark as sent
            await this.markNotificationStatus(notification.id, 'sent');
            
            // In a real implementation, you would integrate with:
            // - Email service (SendGrid, AWS SES, etc.)
            // - Push notification service (Firebase, OneSignal, etc.)
            // - SMS service (Twilio, etc.)
            
            return { success: true, message };
            
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }

    /**
     * Mark notification status in database
     */
    async markNotificationStatus(notificationId, status) {
        return new Promise((resolve, reject) => {
            const sentTime = status === 'sent' ? new Date().toISOString() : null;
            
            this.db.run(`
                UPDATE notification_queue 
                SET status = ?, sent_time = ?
                WHERE id = ?
            `, [status, sentTime, notificationId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Check user activity and schedule appropriate notifications
     * @param {number} userId - User ID to check
     */
    async checkUserActivityAndScheduleNotifications(userId) {
        try {
            const userData = await this.getUserDataForNotification(userId);
            const { user, activityData, conversationCount } = userData;
            
            if (!user) {
                console.log(`User ${userId} not found, skipping notification check`);
                return;
            }

            const lastActivity = activityData.last_conversation;
            const daysSinceLastActivity = lastActivity ? 
                Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)) : 999;

            // Check if user completed onboarding but hasn't had first conversation
            if (user.onboarding_complete && conversationCount === 0) {
                const existingFirstSession = await this.hasScheduledNotification(userId, 'firstSession');
                if (!existingFirstSession) {
                    await this.scheduleNotification(userId, 'firstSession');
                }
            }
            
            // Check for re-engagement needed (7+ days inactive)
            else if (daysSinceLastActivity >= 7) {
                const existingReEngagement = await this.hasScheduledNotification(userId, 'reEngagement');
                if (!existingReEngagement) {
                    await this.scheduleNotification(userId, 'reEngagement');
                }
            }
            
            // Check for weekly check-in (active users)
            else if (conversationCount >= 3 && daysSinceLastActivity >= 7) {
                const existingWeeklyCheckIn = await this.hasScheduledNotification(userId, 'weeklyCheckIn');
                if (!existingWeeklyCheckIn) {
                    await this.scheduleNotification(userId, 'weeklyCheckIn');
                }
            }

            console.log(`✅ Checked activity for user ${userId}: ${daysSinceLastActivity} days since last activity`);
            
        } catch (error) {
            console.error(`Error checking activity for user ${userId}:`, error);
        }
    }

    /**
     * Check if user has a scheduled notification of a specific type
     */
    async hasScheduledNotification(userId, notificationType) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id FROM notification_queue 
                WHERE user_id = ? 
                AND notification_type = ? 
                AND status = 'pending'
            `, [userId, notificationType], (err, result) => {
                if (err) reject(err);
                else resolve(!!result);
            });
        });
    }

    /**
     * Get notification history for a user
     */
    async getUserNotificationHistory(userId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM notification_queue 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [userId, limit], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Cancel pending notifications for a user
     */
    async cancelPendingNotifications(userId, notificationType = null) {
        const sql = notificationType ? 
            'UPDATE notification_queue SET status = ? WHERE user_id = ? AND notification_type = ? AND status = ?' :
            'UPDATE notification_queue SET status = ? WHERE user_id = ? AND status = ?';
        
        const params = notificationType ? 
            ['cancelled', userId, notificationType, 'pending'] :
            ['cancelled', userId, 'pending'];

        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else {
                    console.log(`📝 Cancelled ${this.changes} pending notifications for user ${userId}`);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Start the notification processing service (call this periodically)
     */
    startNotificationProcessor(intervalMinutes = 15) {
        console.log(`🔄 Starting notification processor (checking every ${intervalMinutes} minutes)`);
        
        // Process immediately
        this.processPendingNotifications();
        
        // Set up periodic processing
        setInterval(() => {
            this.processPendingNotifications();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Check all users for notification scheduling (run daily)
     */
    async checkAllUsersForNotifications() {
        try {
            const users = await new Promise((resolve, reject) => {
                this.db.all('SELECT id FROM users WHERE onboarding_complete = 1', (err, results) => {
                    if (err) reject(err);
                    else resolve(results || []);
                });
            });

            console.log(`🔍 Checking ${users.length} users for notification scheduling`);

            for (const user of users) {
                await this.checkUserActivityAndScheduleNotifications(user.id);
            }

            console.log('✅ Completed notification check for all users');
            
        } catch (error) {
            console.error('Error checking all users for notifications:', error);
        }
    }
}

module.exports = RetentionService;