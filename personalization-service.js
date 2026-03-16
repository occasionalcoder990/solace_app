class PersonalizationService {
    constructor(db) {
        this.db = db;
    }

    // Analyze conversation for emotional patterns and memories
    async analyzeConversation(userId, message, response) {
        const analysis = {
            emotions: this.detectEmotions(message),
            topics: this.extractTopics(message),
            moodScore: this.calculateMoodScore(message),
            memories: this.extractMemories(message)
        };

        // Save emotional data
        await this.saveEmotionalData(userId, analysis);
        
        // Extract and save memories
        if (analysis.memories.length > 0) {
            await this.saveMemories(userId, analysis.memories);
        }

        // Update conversation patterns
        await this.updateConversationPatterns(userId, analysis);

        return analysis;
    }

    detectEmotions(message) {
        const emotions = [];
        const text = message.toLowerCase();

        const emotionKeywords = {
            sad: ['sad', 'depressed', 'down', 'upset', 'crying', 'tears', 'heartbroken', 'devastated'],
            happy: ['happy', 'excited', 'joy', 'amazing', 'wonderful', 'great', 'fantastic', 'thrilled'],
            anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'overwhelmed', 'scared'],
            angry: ['angry', 'mad', 'furious', 'frustrated', 'annoyed', 'irritated', 'rage'],
            lonely: ['lonely', 'alone', 'isolated', 'abandoned', 'disconnected', 'empty'],
            grateful: ['grateful', 'thankful', 'blessed', 'appreciate', 'lucky'],
            confused: ['confused', 'lost', 'uncertain', 'unclear', 'puzzled', 'don\'t understand'],
            hopeful: ['hopeful', 'optimistic', 'looking forward', 'excited about', 'can\'t wait']
        };

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                emotions.push(emotion);
            }
        }

        return emotions;
    }

    extractTopics(message) {
        const topics = [];
        const text = message.toLowerCase();

        const topicKeywords = {
            work: ['work', 'job', 'career', 'boss', 'colleague', 'office', 'meeting', 'project'],
            family: ['family', 'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'parents', 'kids', 'children'],
            relationships: ['boyfriend', 'girlfriend', 'partner', 'husband', 'wife', 'dating', 'relationship', 'love'],
            health: ['health', 'doctor', 'sick', 'pain', 'hospital', 'medicine', 'therapy', 'mental health'],
            school: ['school', 'college', 'university', 'student', 'exam', 'homework', 'teacher', 'class'],
            friends: ['friend', 'friends', 'buddy', 'pal', 'social', 'party', 'hangout'],
            hobbies: ['hobby', 'music', 'art', 'sports', 'reading', 'gaming', 'cooking', 'travel'],
            money: ['money', 'financial', 'budget', 'expensive', 'cheap', 'salary', 'debt', 'savings'],
            future: ['future', 'goals', 'dreams', 'plans', 'hope', 'aspire', 'want to be'],
            past: ['childhood', 'growing up', 'used to', 'remember when', 'back then', 'years ago']
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                topics.push(topic);
            }
        }

        return topics;
    }

    calculateMoodScore(message) {
        const text = message.toLowerCase();
        let score = 5; // Neutral baseline

        const positiveWords = ['happy', 'great', 'amazing', 'wonderful', 'excited', 'love', 'perfect', 'awesome'];
        const negativeWords = ['sad', 'terrible', 'awful', 'hate', 'worst', 'depressed', 'angry', 'frustrated'];

        positiveWords.forEach(word => {
            if (text.includes(word)) score += 1;
        });

        negativeWords.forEach(word => {
            if (text.includes(word)) score -= 1;
        });

        return Math.max(1, Math.min(10, score)); // Keep between 1-10
    }

    extractMemories(message) {
        const memories = [];
        const text = message.toLowerCase();

        // Look for personal information patterns
        const memoryPatterns = [
            { type: 'name_mention', pattern: /my name is (\w+)|call me (\w+)|i'm (\w+)/ },
            { type: 'age', pattern: /i'm (\d+) years old|i am (\d+)/ },
            { type: 'location', pattern: /i live in (\w+)|from (\w+)|in (\w+) city/ },
            { type: 'job', pattern: /i work as|my job is|i'm a (\w+)/ },
            { type: 'hobby', pattern: /i love (\w+)|i enjoy (\w+)|my hobby is/ },
            { type: 'fear', pattern: /i'm afraid of|scared of|fear (\w+)/ },
            { type: 'goal', pattern: /i want to|my goal is|hoping to (\w+)/ },
            { type: 'relationship', pattern: /my (\w+) and i|with my (\w+)/ }
        ];

        memoryPatterns.forEach(({ type, pattern }) => {
            const matches = text.match(pattern);
            if (matches) {
                memories.push({
                    type: type,
                    content: matches[0],
                    importance: this.calculateImportance(type, matches[0])
                });
            }
        });

        return memories;
    }

    calculateImportance(type, content) {
        const importanceMap = {
            name_mention: 10,
            age: 7,
            location: 6,
            job: 8,
            hobby: 6,
            fear: 9,
            goal: 9,
            relationship: 8
        };

        return importanceMap[type] || 5;
    }

    async saveEmotionalData(userId, analysis) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE conversations SET 
                 emotion_detected = ?, 
                 topics = ?, 
                 mood_score = ? 
                 WHERE user_id = ? AND id = (SELECT MAX(id) FROM conversations WHERE user_id = ?)`,
                [
                    JSON.stringify(analysis.emotions),
                    JSON.stringify(analysis.topics),
                    analysis.moodScore,
                    userId,
                    userId
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async saveMemories(userId, memories) {
        for (const memory of memories) {
            await new Promise((resolve, reject) => {
                this.db.run(
                    'INSERT INTO user_memories (user_id, memory_type, content, importance_score) VALUES (?, ?, ?, ?)',
                    [userId, memory.type, memory.content, memory.importance],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    }

    async updateConversationPatterns(userId, analysis) {
        // Update emotional patterns
        const patternData = {
            emotions: analysis.emotions,
            topics: analysis.topics,
            moodScore: analysis.moodScore,
            timestamp: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO emotional_patterns (user_id, pattern_type, pattern_data, confidence_score) VALUES (?, ?, ?, ?)',
                [userId, 'conversation_analysis', JSON.stringify(patternData), 0.8],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getUserInsights(userId) {
        const insights = {
            emotionalPatterns: await this.getEmotionalPatterns(userId),
            favoriteTopics: await this.getFavoriteTopics(userId),
            moodTrends: await this.getMoodTrends(userId),
            memories: await this.getImportantMemories(userId),
            conversationStyle: await this.getConversationStyle(userId)
        };

        return insights;
    }

    async getEmotionalPatterns(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT emotion_detected, COUNT(*) as frequency 
                 FROM conversations 
                 WHERE user_id = ? AND emotion_detected IS NOT NULL 
                 GROUP BY emotion_detected 
                 ORDER BY frequency DESC LIMIT 5`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const patterns = rows.map(row => ({
                            emotions: JSON.parse(row.emotion_detected || '[]'),
                            frequency: row.frequency
                        }));
                        resolve(patterns);
                    }
                }
            );
        });
    }

    async getFavoriteTopics(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT topics, COUNT(*) as frequency 
                 FROM conversations 
                 WHERE user_id = ? AND topics IS NOT NULL 
                 GROUP BY topics 
                 ORDER BY frequency DESC LIMIT 5`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const topics = rows.map(row => ({
                            topics: JSON.parse(row.topics || '[]'),
                            frequency: row.frequency
                        }));
                        resolve(topics);
                    }
                }
            );
        });
    }

    async getMoodTrends(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT mood_score, DATE(timestamp) as date, AVG(mood_score) as avg_mood
                 FROM conversations 
                 WHERE user_id = ? AND mood_score IS NOT NULL 
                 GROUP BY DATE(timestamp) 
                 ORDER BY date DESC LIMIT 30`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getImportantMemories(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM user_memories WHERE user_id = ? ORDER BY importance_score DESC, created_at DESC LIMIT 20',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getConversationStyle(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    AVG(LENGTH(message)) as avg_message_length,
                    COUNT(*) as total_conversations,
                    AVG(mood_score) as avg_mood
                 FROM conversations 
                 WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0] || {});
                }
            );
        });
    }

    async updateRelationshipStage(userId, stage) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE companion_settings SET relationship_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                [stage, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async addMilestone(userId, type, title, description) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO user_milestones (user_id, milestone_type, title, description) VALUES (?, ?, ?, ?)',
                [userId, type, title, description],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
}

module.exports = PersonalizationService;