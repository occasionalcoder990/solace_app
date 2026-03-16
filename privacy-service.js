/**
 * Privacy Service - Handles data export, deletion, and consent management
 * Implements GDPR/CCPA compliance features for user data control
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EncryptionService = require('./encryption-service');

class PrivacyService {
    constructor(db) {
        this.db = db;
        this.encryptionService = new EncryptionService();
    }

    /**
     * Export all user data in JSON format for GDPR compliance
     * Decrypts encrypted data for export
     */
    async exportUserData(userId) {
        try {
            const userData = {
                exportDate: new Date().toISOString(),
                userId: userId,
                profile: await this.getUserProfile(userId),
                conversations: await this.getUserConversations(userId),
                personalityInsights: await this.getPersonalityInsights(userId),
                milestones: await this.getUserMilestones(userId),
                memories: await this.getUserMemories(userId),
                emotionalPatterns: await this.getEmotionalPatterns(userId),
                companionSettings: await this.getCompanionSettings(userId),
                engagementAnalytics: await this.getEngagementAnalytics(userId),
                userProgress: await this.getUserProgress(userId)
            };

            // Decrypt sensitive data for export
            userData.profile = this.decryptUserProfile(userData.profile);
            userData.conversations = this.decryptConversations(userData.conversations);
            userData.personalityInsights = this.decryptPersonalityInsights(userData.personalityInsights);
            userData.companionSettings = this.decryptCompanionSettings(userData.companionSettings);

            return userData;
        } catch (error) {
            console.error('Error exporting user data:', error);
            throw new Error('Failed to export user data');
        }
    }

    /**
     * Decrypt user profile data for export
     */
    decryptUserProfile(profile) {
        if (!profile) return profile;
        
        try {
            // Decrypt personality-related fields
            if (profile.personality_insights) {
                profile.personality_insights = this.encryptionService.decryptPersonalityData(profile.personality_insights);
            }
            if (profile.communication_preferences) {
                profile.communication_preferences = this.encryptionService.decryptPersonalityData(profile.communication_preferences);
            }
            if (profile.emotional_profile) {
                profile.emotional_profile = this.encryptionService.decryptPersonalityData(profile.emotional_profile);
            }
            if (profile.personality_profile) {
                profile.personality_profile = this.encryptionService.decryptQuestionnaireData(profile.personality_profile);
            }
        } catch (error) {
            console.error('Error decrypting user profile:', error);
        }
        
        return profile;
    }

    /**
     * Decrypt conversations for export
     */
    decryptConversations(conversations) {
        if (!conversations || !Array.isArray(conversations)) return conversations;
        
        return conversations.map(conversation => {
            try {
                if (conversation.message && this.encryptionService.isEncrypted(conversation.message)) {
                    conversation.message = this.encryptionService.decryptConversationData(conversation.message);
                }
                if (conversation.response && this.encryptionService.isEncrypted(conversation.response)) {
                    conversation.response = this.encryptionService.decryptConversationData(conversation.response);
                }
            } catch (error) {
                console.error('Error decrypting conversation:', error);
            }
            return conversation;
        });
    }

    /**
     * Decrypt personality insights for export
     */
    decryptPersonalityInsights(insights) {
        if (!insights || !Array.isArray(insights)) return insights;
        
        return insights.map(insight => {
            try {
                if (insight.insight_content && this.encryptionService.isEncrypted(insight.insight_content)) {
                    insight.insight_content = this.encryptionService.decryptPersonalityData(insight.insight_content);
                }
            } catch (error) {
                console.error('Error decrypting personality insight:', error);
            }
            return insight;
        });
    }

    /**
     * Decrypt companion settings for export
     */
    decryptCompanionSettings(settings) {
        if (!settings) return settings;
        
        try {
            if (settings.onboarding_based_personality && this.encryptionService.isEncrypted(settings.onboarding_based_personality)) {
                settings.onboarding_based_personality = this.encryptionService.decryptPersonalityData(settings.onboarding_based_personality);
            }
        } catch (error) {
            console.error('Error decrypting companion settings:', error);
        }
        
        return settings;
    }

    /**
     * Get user profile data
     */
    async getUserProfile(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id, email, name, personality_profile, onboarding_complete, 
                       personality_insights, communication_preferences, emotional_profile,
                       onboarding_completion_time, first_session_completed, created_at, last_login
                FROM users WHERE id = ?
            `, [userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    /**
     * Get all user conversations
     */
    async getUserConversations(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT message, response, emotion_detected, topics, mood_score, timestamp
                FROM conversations WHERE user_id = ?
                ORDER BY timestamp ASC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get personality insights
     */
    async getPersonalityInsights(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT insight_type, insight_content, confidence_score, display_priority, created_at
                FROM personality_insights WHERE user_id = ?
                ORDER BY display_priority ASC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get user milestones
     */
    async getUserMilestones(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT milestone_type, title, description, category, points, 
                       unlock_criteria, celebration_message, achieved_date
                FROM user_milestones WHERE user_id = ?
                ORDER BY achieved_date DESC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get user memories
     */
    async getUserMemories(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT memory_type, content, importance_score, last_referenced, created_at
                FROM user_memories WHERE user_id = ?
                ORDER BY importance_score DESC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get emotional patterns
     */
    async getEmotionalPatterns(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT pattern_type, pattern_data, confidence_score, created_at
                FROM emotional_patterns WHERE user_id = ?
                ORDER BY created_at DESC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get companion settings
     */
    async getCompanionSettings(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT companion_name, companion_personality, communication_style, response_tone,
                       memory_enabled, relationship_stage, inside_jokes, personal_rituals,
                       favorite_topics, conversation_depth_preference, onboarding_based_personality,
                       growth_stage_preferences, milestone_celebration_style, created_at, updated_at
                FROM companion_settings WHERE user_id = ?
            `, [userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    /**
     * Get engagement analytics
     */
    async getEngagementAnalytics(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT session_start, session_end, messages_sent, emotional_depth_score,
                       milestone_achieved, retention_risk_score, next_engagement_prediction, created_at
                FROM engagement_analytics WHERE user_id = ?
                ORDER BY session_start DESC
            `, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });
    }

    /**
     * Get user progress
     */
    async getUserProgress(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT current_stage, stage_progress, next_milestone, engagement_score,
                       last_activity, created_at, updated_at
                FROM user_progress WHERE user_id = ?
            `, [userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    /**
     * Delete all user data (GDPR Right to be Forgotten)
     */
    async deleteAllUserData(userId) {
        try {
            // Delete from all tables in correct order (respecting foreign key constraints)
            const tables = [
                'engagement_analytics',
                'user_progress', 
                'personality_insights',
                'user_milestones',
                'user_memories',
                'emotional_patterns',
                'companion_settings',
                'conversations',
                'user_sessions',
                'users'
            ];

            for (const table of tables) {
                await new Promise((resolve, reject) => {
                    this.db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            console.log(`✅ Successfully deleted all data for user ${userId}`);
            return { success: true, message: 'All user data has been permanently deleted' };

        } catch (error) {
            console.error('Error deleting user data:', error);
            throw new Error('Failed to delete user data');
        }
    }

    /**
     * Delete specific data categories
     */
    async deleteDataCategory(userId, category) {
        try {
            switch (category) {
                case 'conversations':
                    await this.deleteConversations(userId);
                    break;
                case 'personality':
                    await this.deletePersonalityData(userId);
                    break;
                case 'milestones':
                    await this.deleteMilestones(userId);
                    break;
                case 'memories':
                    await this.deleteMemories(userId);
                    break;
                case 'analytics':
                    await this.deleteAnalytics(userId);
                    break;
                default:
                    throw new Error('Invalid data category');
            }

            return { success: true, message: `${category} data has been deleted` };
        } catch (error) {
            console.error(`Error deleting ${category} data:`, error);
            throw new Error(`Failed to delete ${category} data`);
        }
    }

    /**
     * Delete conversation history
     */
    async deleteConversations(userId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM conversations WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Delete personality insights and related data
     */
    async deletePersonalityData(userId) {
        const queries = [
            'DELETE FROM personality_insights WHERE user_id = ?',
            'UPDATE users SET personality_insights = NULL, communication_preferences = NULL, emotional_profile = NULL WHERE id = ?',
            'UPDATE companion_settings SET onboarding_based_personality = NULL WHERE user_id = ?'
        ];

        for (const query of queries) {
            await new Promise((resolve, reject) => {
                this.db.run(query, [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }

    /**
     * Delete milestones
     */
    async deleteMilestones(userId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM user_milestones WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Delete memories
     */
    async deleteMemories(userId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM user_memories WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Delete analytics data
     */
    async deleteAnalytics(userId) {
        const queries = [
            'DELETE FROM engagement_analytics WHERE user_id = ?',
            'DELETE FROM emotional_patterns WHERE user_id = ?'
        ];

        for (const query of queries) {
            await new Promise((resolve, reject) => {
                this.db.run(query, [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }

    /**
     * Get user consent preferences
     */
    async getUserConsent(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT personality_analysis_consent, data_analytics_consent, 
                       retention_notifications_consent, created_at, updated_at
                FROM user_consent WHERE user_id = ?
            `, [userId], (err, result) => {
                if (err) reject(err);
                else resolve(result || {
                    personality_analysis_consent: true,
                    data_analytics_consent: true,
                    retention_notifications_consent: true
                });
            });
        });
    }

    /**
     * Update user consent preferences
     */
    async updateUserConsent(userId, consentData) {
        try {
            // Create user_consent table if it doesn't exist
            await new Promise((resolve, reject) => {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS user_consent (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER UNIQUE NOT NULL,
                        personality_analysis_consent INTEGER DEFAULT 1,
                        data_analytics_consent INTEGER DEFAULT 1,
                        retention_notifications_consent INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update or insert consent preferences
            await new Promise((resolve, reject) => {
                this.db.run(`
                    INSERT OR REPLACE INTO user_consent 
                    (user_id, personality_analysis_consent, data_analytics_consent, 
                     retention_notifications_consent, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    userId,
                    consentData.personalityAnalysis ? 1 : 0,
                    consentData.dataAnalytics ? 1 : 0,
                    consentData.retentionNotifications ? 1 : 0
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            return { success: true, message: 'Consent preferences updated successfully' };
        } catch (error) {
            console.error('Error updating consent:', error);
            throw new Error('Failed to update consent preferences');
        }
    }

    /**
     * Create audit log entry for privacy actions with enhanced security
     */
    async logPrivacyAction(userId, action, details = null, request = null) {
        try {
            // Create audit_log table if it doesn't exist
            await new Promise((resolve, reject) => {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS audit_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        action TEXT NOT NULL,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        session_token_hash TEXT,
                        audit_token TEXT,
                        data_hash TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Extract request information if available
            let ipAddress = null;
            let userAgent = null;
            let sessionTokenHash = null;

            if (request) {
                ipAddress = request.ip || request.connection?.remoteAddress || null;
                userAgent = request.get('User-Agent') || null;
                
                // Hash session token for audit trail (don't store actual token)
                const authHeader = request.get('Authorization');
                if (authHeader) {
                    const token = authHeader.split(' ')[1];
                    sessionTokenHash = this.encryptionService.hashForAudit(token);
                }
            }

            // Generate audit token and hash sensitive details
            const auditToken = this.encryptionService.generateAuditToken();
            const dataHash = details ? this.encryptionService.hashForAudit(JSON.stringify(details)) : null;

            // Encrypt sensitive details if present
            const encryptedDetails = details ? this.encryptionService.encrypt(JSON.stringify(details), 'audit') : null;

            // Insert audit log entry
            await new Promise((resolve, reject) => {
                this.db.run(`
                    INSERT INTO audit_log (user_id, action, details, ip_address, user_agent, 
                                         session_token_hash, audit_token, data_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [userId, action, encryptedDetails, ipAddress, userAgent, sessionTokenHash, auditToken, dataHash], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`🔍 Audit log: User ${userId} performed ${action} (Token: ${auditToken})`);

        } catch (error) {
            console.error('Error logging privacy action:', error);
            // Don't throw error for audit logging failures
        }
    }

    /**
     * Create specialized audit log entry for personality data access
     */
    async logPersonalityDataAccess(userId, action, dataType, accessContext = null, request = null) {
        try {
            // Extract request information if available
            let ipAddress = null;
            let userAgent = null;
            let sessionTokenHash = null;

            if (request) {
                ipAddress = request.ip || request.connection?.remoteAddress || null;
                userAgent = request.get('User-Agent') || null;
                
                // Hash session token for audit trail
                const authHeader = request.get('Authorization');
                if (authHeader) {
                    const token = authHeader.split(' ')[1];
                    sessionTokenHash = this.encryptionService.hashForAudit(token);
                }
            }

            // Generate audit token and create encryption metadata
            const auditToken = this.encryptionService.generateAuditToken();
            const encryptionMetadata = {
                algorithm: 'aes-256-gcm',
                context: dataType,
                access_time: new Date().toISOString()
            };

            // Hash the access context for audit trail
            const dataHash = accessContext ? this.encryptionService.hashForAudit(accessContext) : null;

            // Insert personality-specific audit log entry
            await new Promise((resolve, reject) => {
                this.db.run(`
                    INSERT INTO personality_audit_log 
                    (user_id, action, data_type, access_context, ip_address, user_agent, 
                     session_token_hash, audit_token, data_hash, encryption_metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId, 
                    action, 
                    dataType, 
                    accessContext, 
                    ipAddress, 
                    userAgent, 
                    sessionTokenHash, 
                    auditToken, 
                    dataHash,
                    JSON.stringify(encryptionMetadata)
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`🔐 Personality audit: User ${userId} ${action} ${dataType} (Token: ${auditToken})`);

        } catch (error) {
            console.error('Error logging personality data access:', error);
            // Don't throw error for audit logging failures
        }
    }

    /**
     * Get personality data audit log for a user
     */
    async getPersonalityAuditLog(userId, limit = 50) {
        try {
            return new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT action, data_type, access_context, ip_address, 
                           audit_token, timestamp
                    FROM personality_audit_log 
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                `, [userId, limit], (err, results) => {
                    if (err) reject(err);
                    else resolve(results || []);
                });
            });
        } catch (error) {
            console.error('Error getting personality audit log:', error);
            return [];
        }
    }

    /**
     * Get audit log for a user (for transparency)
     */
    async getUserAuditLog(userId) {
        try {
            return new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT action, ip_address, user_agent, audit_token, timestamp
                    FROM audit_log 
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT 100
                `, [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results || []);
                });
            });
        } catch (error) {
            console.error('Error getting audit log:', error);
            return [];
        }
    }

    /**
     * Generate downloadable data export file
     */
    async generateDataExportFile(userId) {
        try {
            const userData = await this.exportUserData(userId);
            const filename = `solace-data-export-${userId}-${Date.now()}.json`;
            const filepath = path.join(__dirname, 'exports', filename);

            // Ensure exports directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            // Write data to file
            await fs.writeFile(filepath, JSON.stringify(userData, null, 2));

            // Log the export action
            await this.logPrivacyAction(userId, 'data_export', { filename });

            return {
                success: true,
                filename,
                filepath,
                message: 'Data export file generated successfully'
            };

        } catch (error) {
            console.error('Error generating export file:', error);
            throw new Error('Failed to generate data export file');
        }
    }
}

module.exports = PrivacyService;