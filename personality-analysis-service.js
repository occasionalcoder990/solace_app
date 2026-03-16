class PersonalityAnalysisService {
    constructor(db, encryptionService = null, privacyService = null) {
        this.db = db;
        this.encryptionService = encryptionService || require('./encryption-service');
        this.privacyService = privacyService;
        this.personalityFramework = this.initializePersonalityFramework();
        
        // Initialize encryption service if passed as class
        if (typeof this.encryptionService === 'function') {
            this.encryptionService = new this.encryptionService();
        }
    }

    initializePersonalityFramework() {
        return {
            communicationStyles: {
                gentle: {
                    keywords: ['gentle', 'soft', 'careful', 'supportive', 'nurturing'],
                    description: 'Prefers soft, nurturing interactions with careful emotional support'
                },
                direct: {
                    keywords: ['direct', 'honest', 'straightforward', 'clear', 'upfront'],
                    description: 'Values honest, straightforward communication without sugar-coating'
                },
                casual: {
                    keywords: ['casual', 'relaxed', 'friendly', 'easy-going', 'informal'],
                    description: 'Enjoys relaxed, friendly conversations in a comfortable atmosphere'
                },
                deep: {
                    keywords: ['deep', 'meaningful', 'philosophical', 'profound', 'thoughtful'],
                    description: 'Loves meaningful, philosophical discussions and deep exploration'
                }
            },
            emotionalNeeds: {
                validation: {
                    keywords: ['heard', 'understood', 'validated', 'acknowledged', 'recognized'],
                    description: 'Needs to feel heard, understood, and emotionally validated'
                },
                clarity: {
                    keywords: ['clarity', 'direction', 'guidance', 'clear', 'focused'],
                    description: 'Seeks clear direction and guidance in life decisions'
                },
                connection: {
                    keywords: ['alone', 'lonely', 'isolated', 'connected', 'belonging'],
                    description: 'Desires deeper connection and sense of belonging'
                },
                growth: {
                    keywords: ['coping', 'strategies', 'better', 'improve', 'develop'],
                    description: 'Wants to develop better emotional coping strategies'
                }
            },
            copingStyles: {
                social: {
                    keywords: ['talk', 'share', 'discuss', 'others', 'friends'],
                    description: 'Processes emotions through conversation and social connection'
                },
                independent: {
                    keywords: ['alone', 'myself', 'independently', 'solo', 'private'],
                    description: 'Prefers to work through challenges independently'
                },
                active: {
                    keywords: ['exercise', 'physical', 'activity', 'movement', 'sports'],
                    description: 'Uses physical activities for emotional regulation'
                },
                reflective: {
                    keywords: ['think', 'reflect', 'journal', 'meditate', 'contemplate'],
                    description: 'Processes emotions through reflection and introspection'
                }
            },
            stressResponses: {
                seek_support: {
                    keywords: ['help', 'support', 'talk', 'reach out', 'others'],
                    description: 'Actively seeks support from others when overwhelmed'
                },
                withdraw: {
                    keywords: ['alone', 'space', 'withdraw', 'isolate', 'quiet'],
                    description: 'Tends to withdraw and need space when stressed'
                },
                problem_solve: {
                    keywords: ['solve', 'fix', 'action', 'plan', 'organize'],
                    description: 'Focuses on problem-solving and taking action'
                },
                emotional_process: {
                    keywords: ['feel', 'emotions', 'process', 'experience', 'accept'],
                    description: 'Focuses on processing and experiencing emotions fully'
                }
            }
        };
    }

    /**
     * Analyzes questionnaire responses and generates personality insights
     * @param {Array} answers - Array of questionnaire answers
     * @returns {Object} Analysis results with insights
     */
    async analyzePersonality(answers) {
        try {
            const analysis = {
                communicationStyle: this.analyzeCommunicationStyle(answers),
                emotionalNeeds: this.analyzeEmotionalNeeds(answers),
                copingStyle: this.analyzeCopingStyle(answers),
                stressResponse: this.analyzeStressResponse(answers),
                uniquenessFactors: this.generateUniquenessInsights(answers),
                confidence: 0.85 // Base confidence score
            };

            return analysis;
        } catch (error) {
            console.error('Error analyzing personality:', error);
            throw new Error('Failed to analyze personality profile');
        }
    }

    /**
     * Detects communication style from questionnaire responses
     * @param {Array} answers - Questionnaire answers
     * @returns {Object} Communication style analysis
     */
    analyzeCommunicationStyle(answers) {
        // Ensure answers is an array
        if (!Array.isArray(answers)) {
            answers = [];
        }
        
        // Question 3 typically asks about communication preferences
        const communicationAnswer = answers[3] || '';
        const allAnswers = answers.filter(Boolean).join(' ').toLowerCase();

        let detectedStyle = 'balanced';
        let confidence = 0.7;
        let description = 'Adapts communication style based on context and needs';

        // Analyze specific communication preference answer
        for (const [style, config] of Object.entries(this.personalityFramework.communicationStyles)) {
            const matchCount = config.keywords.filter(keyword => 
                communicationAnswer.toLowerCase().includes(keyword) ||
                allAnswers.includes(keyword)
            ).length;

            if (matchCount > 0) {
                detectedStyle = style;
                confidence = Math.min(0.95, 0.6 + (matchCount * 0.1));
                description = config.description;
                break;
            }
        }

        return {
            primary: detectedStyle,
            confidence: confidence,
            description: description,
            indicators: this.extractStyleIndicators(answers, detectedStyle)
        };
    }

    /**
     * Analyzes emotional needs from responses
     * @param {Array} answers - Questionnaire answers
     * @returns {Object} Emotional needs analysis
     */
    analyzeEmotionalNeeds(answers) {
        // Ensure answers is an array
        if (!Array.isArray(answers)) {
            answers = [];
        }
        
        // Question 12 typically asks about primary emotional needs
        const primaryNeedAnswer = answers[12] || '';
        const emotionalAnswers = [answers[2], answers[6], answers[12]].filter(Boolean).join(' ').toLowerCase();

        let primaryNeed = 'support';
        let confidence = 0.7;
        let description = 'Seeks general emotional support and understanding';

        // Analyze emotional needs patterns
        for (const [need, config] of Object.entries(this.personalityFramework.emotionalNeeds)) {
            const matchCount = config.keywords.filter(keyword => 
                primaryNeedAnswer.toLowerCase().includes(keyword) ||
                emotionalAnswers.includes(keyword)
            ).length;

            if (matchCount > 0) {
                primaryNeed = need;
                confidence = Math.min(0.95, 0.6 + (matchCount * 0.15));
                description = config.description;
                break;
            }
        }

        return {
            primary: primaryNeed,
            confidence: confidence,
            description: description,
            supportingEvidence: this.extractEmotionalEvidence(answers)
        };
    }

    /**
     * Analyzes coping style from stress-related responses
     * @param {Array} answers - Questionnaire answers
     * @returns {Object} Coping style analysis
     */
    analyzeCopingStyle(answers) {
        // Ensure answers is an array
        if (!Array.isArray(answers)) {
            answers = [];
        }
        
        // Question 1 typically asks about stress handling
        const stressAnswer = answers[1] || '';
        const copingAnswers = [answers[1], answers[4], answers[7]].filter(Boolean).join(' ').toLowerCase();

        let primaryCoping = 'mixed';
        let confidence = 0.7;
        let description = 'Uses a combination of coping strategies';

        // Analyze coping patterns
        for (const [style, config] of Object.entries(this.personalityFramework.copingStyles)) {
            const matchCount = config.keywords.filter(keyword => 
                stressAnswer.toLowerCase().includes(keyword) ||
                copingAnswers.includes(keyword)
            ).length;

            if (matchCount > 0) {
                primaryCoping = style;
                confidence = Math.min(0.95, 0.6 + (matchCount * 0.15));
                description = config.description;
                break;
            }
        }

        return {
            primary: primaryCoping,
            confidence: confidence,
            description: description,
            strategies: this.extractCopingStrategies(answers)
        };
    }

    /**
     * Analyzes stress response patterns
     * @param {Array} answers - Questionnaire answers
     * @returns {Object} Stress response analysis
     */
    analyzeStressResponse(answers) {
        // Ensure answers is an array
        if (!Array.isArray(answers)) {
            answers = [];
        }
        
        // Question 2 typically asks about overwhelm responses
        const overwhelmAnswer = answers[2] || '';
        const stressAnswers = [answers[1], answers[2], answers[8]].filter(Boolean).join(' ').toLowerCase();

        let primaryResponse = 'adaptive';
        let confidence = 0.7;
        let description = 'Shows adaptive responses to stress and overwhelm';

        // Analyze stress response patterns
        for (const [response, config] of Object.entries(this.personalityFramework.stressResponses)) {
            const matchCount = config.keywords.filter(keyword => 
                overwhelmAnswer.toLowerCase().includes(keyword) ||
                stressAnswers.includes(keyword)
            ).length;

            if (matchCount > 0) {
                primaryResponse = response;
                confidence = Math.min(0.95, 0.6 + (matchCount * 0.15));
                description = config.description;
                break;
            }
        }

        return {
            primary: primaryResponse,
            confidence: confidence,
            description: description,
            patterns: this.extractStressPatterns(answers)
        };
    }

    /**
     * Generates "what makes you unique" personalized insights
     * @param {Array} answers - Questionnaire answers
     * @returns {Array} Array of unique insights
     */
    generateUniquenessInsights(answers) {
        // Ensure answers is an array
        if (!Array.isArray(answers)) {
            answers = [];
        }
        
        const insights = [];
        
        // Extract name for personalization
        const name = answers[0] || 'You';
        
        // Analyze unique combinations of traits
        const communicationStyle = this.analyzeCommunicationStyle(answers);
        const emotionalNeeds = this.analyzeEmotionalNeeds(answers);
        const copingStyle = this.analyzeCopingStyle(answers);

        // Generate unique insight based on trait combination
        if (communicationStyle.primary === 'deep' && emotionalNeeds.primary === 'growth') {
            insights.push({
                type: 'trait_combination',
                content: `${name} has a rare combination of loving deep, meaningful conversations while actively seeking personal growth - this makes you someone who transforms insights into real change.`,
                confidence: 0.9
            });
        }

        if (copingStyle.primary === 'social' && communicationStyle.primary === 'gentle') {
            insights.push({
                type: 'interpersonal_strength',
                content: `Your gentle communication style combined with your preference for processing emotions through connection makes you naturally gifted at creating safe spaces for others.`,
                confidence: 0.85
            });
        }

        // Extract specific unique elements from answers
        const uniqueElements = this.extractUniqueElements(answers);
        insights.push(...uniqueElements);

        // Ensure we have at least 2-3 insights
        while (insights.length < 3) {
            if (insights.length === 0) {
                insights.push({
                    type: 'general_uniqueness',
                    content: `What makes you special is your thoughtful approach to self-reflection and your willingness to explore your inner world with curiosity and openness.`,
                    confidence: 0.8
                });
            } else if (insights.length === 1) {
                insights.push({
                    type: 'self_awareness',
                    content: `Your commitment to understanding yourself better shows remarkable emotional intelligence and personal growth mindset.`,
                    confidence: 0.75
                });
            } else if (insights.length === 2) {
                insights.push({
                    type: 'authenticity',
                    content: `You bring genuine authenticity to your interactions, which creates meaningful connections with others.`,
                    confidence: 0.7
                });
            }
        }

        return insights.slice(0, 3); // Return top 3 insights
    }

    /**
     * Extracts unique elements from specific answers
     * @param {Array} answers - Questionnaire answers
     * @returns {Array} Array of unique insights
     */
    extractUniqueElements(answers) {
        const insights = [];
        
        // Look for specific interests, values, or experiences mentioned
        const interestingAnswers = [answers[9], answers[10], answers[11]].filter(Boolean);
        
        interestingAnswers.forEach((answer, index) => {
            if (answer && answer.length > 10) {
                // Extract meaningful content from longer answers
                const lowerAnswer = answer.toLowerCase();
                
                if (lowerAnswer.includes('creative') || lowerAnswer.includes('art') || lowerAnswer.includes('music')) {
                    insights.push({
                        type: 'creative_nature',
                        content: `Your creative side shines through in how you express yourself - this artistic sensibility brings depth and beauty to your perspective on life.`,
                        confidence: 0.8
                    });
                }
                
                if (lowerAnswer.includes('help') || lowerAnswer.includes('others') || lowerAnswer.includes('care')) {
                    insights.push({
                        type: 'caring_nature',
                        content: `You have a naturally caring heart that thinks about others' wellbeing - this empathy is one of your greatest strengths.`,
                        confidence: 0.85
                    });
                }
            }
        });

        return insights;
    }

    /**
     * Helper methods for extracting supporting evidence
     */
    extractStyleIndicators(answers, style) {
        const indicators = [];
        const relevantAnswers = [answers[3], answers[5], answers[6]].filter(Boolean);
        
        relevantAnswers.forEach(answer => {
            if (answer.length > 5) {
                indicators.push(answer.substring(0, 100));
            }
        });
        
        return indicators;
    }

    extractEmotionalEvidence(answers) {
        const evidence = [];
        const emotionalAnswers = [answers[2], answers[6], answers[12]].filter(Boolean);
        
        emotionalAnswers.forEach(answer => {
            if (answer.length > 5) {
                evidence.push(answer.substring(0, 100));
            }
        });
        
        return evidence;
    }

    extractCopingStrategies(answers) {
        const strategies = [];
        const copingAnswers = [answers[1], answers[4], answers[7]].filter(Boolean);
        
        copingAnswers.forEach(answer => {
            if (answer.length > 5) {
                strategies.push(answer.substring(0, 100));
            }
        });
        
        return strategies;
    }

    extractStressPatterns(answers) {
        const patterns = [];
        const stressAnswers = [answers[1], answers[2], answers[8]].filter(Boolean);
        
        stressAnswers.forEach(answer => {
            if (answer.length > 5) {
                patterns.push(answer.substring(0, 100));
            }
        });
        
        return patterns;
    }

    /**
     * Stores personality insights in the database with encryption
     * @param {number} userId - User ID
     * @param {Object} analysis - Personality analysis results
     * @param {Object} request - Request object for audit logging
     * @returns {Promise} Database operation promise
     */
    async storePersonalityInsights(userId, analysis, request = null) {
        try {
            // Log personality data storage for audit
            if (this.privacyService) {
                await this.privacyService.logPersonalityDataAccess(
                    userId, 
                    'store_insights', 
                    'personality_analysis', 
                    'onboarding_completion',
                    request
                );
            }

            // Clear existing insights for this user
            await new Promise((resolve, reject) => {
                this.db.run('DELETE FROM personality_insights WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Store communication style insight with encryption
            await this.storeEncryptedInsight(userId, 'communication_style', 
                `Your communication style: ${analysis.communicationStyle.description}`, 
                analysis.communicationStyle.confidence, 1);

            // Store emotional needs insight with encryption
            await this.storeEncryptedInsight(userId, 'emotional_needs', 
                `Your emotional needs: ${analysis.emotionalNeeds.description}`, 
                analysis.emotionalNeeds.confidence, 2);

            // Store coping style insight with encryption
            await this.storeEncryptedInsight(userId, 'coping_style', 
                `Your coping approach: ${analysis.copingStyle.description}`, 
                analysis.copingStyle.confidence, 3);

            // Store uniqueness insights with encryption
            for (let i = 0; i < analysis.uniquenessFactors.length; i++) {
                const insight = analysis.uniquenessFactors[i];
                await this.storeEncryptedInsight(userId, 'uniqueness', 
                    insight.content, 
                    insight.confidence, 4 + i);
            }

            console.log(`✅ Stored ${3 + analysis.uniquenessFactors.length} encrypted personality insights for user ${userId}`);
            
        } catch (error) {
            console.error('Error storing personality insights:', error);
            throw new Error('Failed to store personality insights');
        }
    }

    /**
     * Helper method to store individual insight
     */
    async storeInsight(userId, type, content, confidence, priority) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO personality_insights (user_id, insight_type, insight_content, confidence_score, display_priority) VALUES (?, ?, ?, ?, ?)',
                [userId, type, content, confidence, priority],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Helper method to store individual insight with encryption
     */
    async storeEncryptedInsight(userId, type, content, confidence, priority) {
        try {
            // Encrypt the insight content
            const encryptedContent = this.encryptionService.encryptPersonalityData(content);
            
            return new Promise((resolve, reject) => {
                this.db.run(
                    'INSERT INTO personality_insights (user_id, insight_type, insight_content, confidence_score, display_priority) VALUES (?, ?, ?, ?, ?)',
                    [userId, type, encryptedContent, confidence, priority],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } catch (error) {
            console.error('Error storing encrypted insight:', error);
            throw new Error('Failed to store encrypted insight');
        }
    }

    /**
     * Retrieves stored personality insights for a user with decryption
     * @param {number} userId - User ID
     * @param {Object} request - Request object for audit logging
     * @returns {Promise<Array>} Array of decrypted personality insights
     */
    async getPersonalityInsights(userId, request = null) {
        try {
            // Log personality data access for audit
            if (this.privacyService) {
                await this.privacyService.logPersonalityDataAccess(
                    userId, 
                    'retrieve_insights', 
                    'personality_insights', 
                    'user_dashboard_access',
                    request
                );
            }

            const encryptedRows = await new Promise((resolve, reject) => {
                this.db.all(
                    'SELECT * FROM personality_insights WHERE user_id = ? ORDER BY display_priority ASC',
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            // Decrypt the insight content
            const decryptedRows = encryptedRows.map(row => {
                try {
                    // Check if data is encrypted first
                    if (this.encryptionService.isEncrypted(row.insight_content)) {
                        const decryptedContent = this.encryptionService.decryptPersonalityData(row.insight_content);
                        return {
                            ...row,
                            insight_content: decryptedContent || row.insight_content
                        };
                    } else {
                        // Data is not encrypted, return as-is
                        return row;
                    }
                } catch (decryptError) {
                    // Silently handle decryption errors in tests/development
                    if (process.env.NODE_ENV === 'test') {
                        return row; // Return original data in test environment
                    }
                    console.warn(`Failed to decrypt insight ${row.id} for user ${userId}:`, decryptError);
                    return row;
                }
            });

            return decryptedRows;
            
        } catch (error) {
            console.error('Error retrieving personality insights:', error);
            throw new Error('Failed to retrieve personality insights');
        }
    }

    /**
     * Generates a personality summary for display
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Formatted personality summary
     */
    async generatePersonalitySummary(userId) {
        try {
            const insights = await this.getPersonalityInsights(userId);
            
            const summary = {
                communicationStyle: null,
                emotionalNeeds: null,
                copingStyle: null,
                uniquenessFactors: [],
                overallConfidence: 0
            };

            let totalConfidence = 0;
            let insightCount = 0;

            insights.forEach(insight => {
                switch (insight.insight_type) {
                    case 'communication_style':
                        summary.communicationStyle = {
                            content: insight.insight_content,
                            confidence: insight.confidence_score
                        };
                        break;
                    case 'emotional_needs':
                        summary.emotionalNeeds = {
                            content: insight.insight_content,
                            confidence: insight.confidence_score
                        };
                        break;
                    case 'coping_style':
                        summary.copingStyle = {
                            content: insight.insight_content,
                            confidence: insight.confidence_score
                        };
                        break;
                    case 'uniqueness':
                        summary.uniquenessFactors.push({
                            content: insight.insight_content,
                            confidence: insight.confidence_score
                        });
                        break;
                }
                
                totalConfidence += insight.confidence_score;
                insightCount++;
            });

            summary.overallConfidence = insightCount > 0 ? totalConfidence / insightCount : 0;
            
            return summary;
            
        } catch (error) {
            console.error('Error generating personality summary:', error);
            throw new Error('Failed to generate personality summary');
        }
    }
}

module.exports = PersonalityAnalysisService;