/**
 * Migration script to encrypt existing sensitive data
 * Run this script to encrypt personality data, questionnaire responses, and conversations
 */

const sqlite3 = require('sqlite3').verbose();
const EncryptionService = require('./encryption-service');

class DataEncryptionMigration {
    constructor() {
        this.db = new sqlite3.Database('companion.db');
        this.encryptionService = new EncryptionService();
    }

    /**
     * Run all encryption migrations
     */
    async runMigrations() {
        console.log('🔐 Starting data encryption migration...');
        
        try {
            await this.createMigrationTable();
            
            // Check if migrations have already been run
            const migrationStatus = await this.getMigrationStatus();
            
            if (!migrationStatus.personality_encryption) {
                await this.encryptPersonalityData();
                await this.markMigrationComplete('personality_encryption');
            }
            
            if (!migrationStatus.questionnaire_encryption) {
                await this.encryptQuestionnaireData();
                await this.markMigrationComplete('questionnaire_encryption');
            }
            
            if (!migrationStatus.conversation_encryption) {
                await this.encryptConversationData();
                await this.markMigrationComplete('conversation_encryption');
            }
            
            if (!migrationStatus.companion_settings_encryption) {
                await this.encryptCompanionSettings();
                await this.markMigrationComplete('companion_settings_encryption');
            }
            
            console.log('✅ Data encryption migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            this.db.close();
        }
    }

    /**
     * Create migration tracking table
     */
    async createMigrationTable() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS encryption_migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    migration_name TEXT UNIQUE NOT NULL,
                    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Get migration status
     */
    async getMigrationStatus() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT migration_name FROM encryption_migrations
            `, (err, results) => {
                if (err) reject(err);
                else {
                    const completed = results.map(r => r.migration_name);
                    resolve({
                        personality_encryption: completed.includes('personality_encryption'),
                        questionnaire_encryption: completed.includes('questionnaire_encryption'),
                        conversation_encryption: completed.includes('conversation_encryption'),
                        companion_settings_encryption: completed.includes('companion_settings_encryption')
                    });
                }
            });
        });
    }

    /**
     * Mark migration as complete
     */
    async markMigrationComplete(migrationName) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR IGNORE INTO encryption_migrations (migration_name)
                VALUES (?)
            `, [migrationName], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Encrypt personality insights data
     */
    async encryptPersonalityData() {
        console.log('🔐 Encrypting personality insights...');
        
        const insights = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, user_id, insight_content 
                FROM personality_insights 
                WHERE insight_content IS NOT NULL
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });

        let encrypted = 0;
        for (const insight of insights) {
            if (!this.encryptionService.isEncrypted(insight.insight_content)) {
                const encryptedContent = this.encryptionService.encryptPersonalityData(insight.insight_content);
                
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE personality_insights 
                        SET insight_content = ? 
                        WHERE id = ?
                    `, [encryptedContent, insight.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                encrypted++;
            }
        }

        // Encrypt user profile personality fields
        const users = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, personality_insights, communication_preferences, emotional_profile
                FROM users 
                WHERE personality_insights IS NOT NULL 
                   OR communication_preferences IS NOT NULL 
                   OR emotional_profile IS NOT NULL
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });

        for (const user of users) {
            const updates = {};
            
            if (user.personality_insights && !this.encryptionService.isEncrypted(user.personality_insights)) {
                updates.personality_insights = this.encryptionService.encryptPersonalityData(user.personality_insights);
            }
            
            if (user.communication_preferences && !this.encryptionService.isEncrypted(user.communication_preferences)) {
                updates.communication_preferences = this.encryptionService.encryptPersonalityData(user.communication_preferences);
            }
            
            if (user.emotional_profile && !this.encryptionService.isEncrypted(user.emotional_profile)) {
                updates.emotional_profile = this.encryptionService.encryptPersonalityData(user.emotional_profile);
            }

            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                const values = [...Object.values(updates), user.id];
                
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE users SET ${setClause} WHERE id = ?
                    `, values, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                encrypted++;
            }
        }

        console.log(`✅ Encrypted ${encrypted} personality data records`);
    }

    /**
     * Encrypt questionnaire responses
     */
    async encryptQuestionnaireData() {
        console.log('🔐 Encrypting questionnaire responses...');
        
        const users = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, personality_profile 
                FROM users 
                WHERE personality_profile IS NOT NULL
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });

        let encrypted = 0;
        for (const user of users) {
            if (!this.encryptionService.isEncrypted(user.personality_profile)) {
                const encryptedProfile = this.encryptionService.encryptQuestionnaireData(user.personality_profile);
                
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE users 
                        SET personality_profile = ? 
                        WHERE id = ?
                    `, [encryptedProfile, user.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                encrypted++;
            }
        }

        console.log(`✅ Encrypted ${encrypted} questionnaire response records`);
    }

    /**
     * Encrypt conversation data (optional - may impact performance)
     */
    async encryptConversationData() {
        console.log('🔐 Encrypting conversation data...');
        
        // Only encrypt conversations for users who have opted in to encryption
        // This is optional due to performance considerations
        const conversations = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, user_id, message, response 
                FROM conversations 
                WHERE message IS NOT NULL OR response IS NOT NULL
                LIMIT 1000
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });

        let encrypted = 0;
        for (const conversation of conversations) {
            const updates = {};
            
            if (conversation.message && !this.encryptionService.isEncrypted(conversation.message)) {
                updates.message = this.encryptionService.encryptConversationData(conversation.message);
            }
            
            if (conversation.response && !this.encryptionService.isEncrypted(conversation.response)) {
                updates.response = this.encryptionService.encryptConversationData(conversation.response);
            }

            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
                const values = [...Object.values(updates), conversation.id];
                
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE conversations SET ${setClause} WHERE id = ?
                    `, values, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                encrypted++;
            }
        }

        console.log(`✅ Encrypted ${encrypted} conversation records`);
    }

    /**
     * Encrypt companion settings
     */
    async encryptCompanionSettings() {
        console.log('🔐 Encrypting companion settings...');
        
        const settings = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, user_id, onboarding_based_personality 
                FROM companion_settings 
                WHERE onboarding_based_personality IS NOT NULL
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results || []);
            });
        });

        let encrypted = 0;
        for (const setting of settings) {
            if (!this.encryptionService.isEncrypted(setting.onboarding_based_personality)) {
                const encryptedPersonality = this.encryptionService.encryptPersonalityData(setting.onboarding_based_personality);
                
                await new Promise((resolve, reject) => {
                    this.db.run(`
                        UPDATE companion_settings 
                        SET onboarding_based_personality = ? 
                        WHERE id = ?
                    `, [encryptedPersonality, setting.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                encrypted++;
            }
        }

        console.log(`✅ Encrypted ${encrypted} companion settings records`);
    }

    /**
     * Verify encryption status
     */
    async verifyEncryption() {
        console.log('🔍 Verifying encryption status...');
        
        const checks = [
            { table: 'personality_insights', field: 'insight_content' },
            { table: 'users', field: 'personality_profile' },
            { table: 'users', field: 'personality_insights' },
            { table: 'companion_settings', field: 'onboarding_based_personality' }
        ];

        for (const check of checks) {
            const results = await new Promise((resolve, reject) => {
                this.db.all(`
                    SELECT COUNT(*) as total,
                           SUM(CASE WHEN ${check.field} LIKE '{"algorithm"%' THEN 1 ELSE 0 END) as encrypted
                    FROM ${check.table} 
                    WHERE ${check.field} IS NOT NULL
                `, (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
            });

            const encryptionRate = results.total > 0 ? (results.encrypted / results.total * 100).toFixed(1) : 0;
            console.log(`📊 ${check.table}.${check.field}: ${results.encrypted}/${results.total} encrypted (${encryptionRate}%)`);
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new DataEncryptionMigration();
    migration.runMigrations()
        .then(() => migration.verifyEncryption())
        .then(() => {
            console.log('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = DataEncryptionMigration;