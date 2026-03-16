const PersonalityAnalysisService = require('../personality-analysis-service');

// Mock database for testing
class MockDatabase {
    constructor() {
        this.data = [];
        this.runCallback = null;
        this.allCallback = null;
    }

    run(query, params, callback) {
        // Simulate database operations
        setTimeout(() => {
            if (query.includes('DELETE')) {
                this.data = this.data.filter(item => item.user_id !== params[0]);
            } else if (query.includes('INSERT')) {
                const [userId, type, content, confidence, priority] = params;
                this.data.push({
                    id: this.data.length + 1,
                    user_id: userId,
                    insight_type: type,
                    insight_content: content,
                    confidence_score: confidence,
                    display_priority: priority,
                    created_at: new Date().toISOString()
                });
            }
            callback(null);
        }, 0);
    }

    all(query, params, callback) {
        setTimeout(() => {
            const userId = params[0];
            const results = this.data
                .filter(item => item.user_id === userId)
                .sort((a, b) => a.display_priority - b.display_priority);
            callback(null, results);
        }, 0);
    }
}

describe('PersonalityAnalysisService', () => {
    let service;
    let mockDb;

    beforeEach(() => {
        mockDb = new MockDatabase();
        service = new PersonalityAnalysisService(mockDb);
    });

    describe('Communication Style Detection', () => {
        test('should detect gentle communication style from keywords', () => {
            const answers = [
                'John',
                'I handle stress by taking deep breaths',
                'When overwhelmed, I need gentle support',
                'I prefer gentle, supportive conversations',
                'I like to process things carefully',
                'I value nurturing interactions',
                'I need soft emotional support',
                'I cope by being gentle with myself',
                'When stressed, I seek gentle guidance',
                'I enjoy supportive environments',
                'I prefer careful communication',
                'I value gentle feedback',
                'I need understanding and gentle validation'
            ];

            const result = service.analyzeCommunicationStyle(answers);

            expect(result.primary).toBe('gentle');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('soft, nurturing interactions');
        });

        test('should detect direct communication style from keywords', () => {
            const answers = [
                'Jane',
                'I handle stress directly',
                'When overwhelmed, I need honest feedback',
                'I prefer direct, straightforward communication',
                'I like clear, upfront discussions',
                'I value honest interactions',
                'I need clear emotional support',
                'I cope by being direct with myself',
                'When stressed, I want straightforward guidance',
                'I enjoy honest environments',
                'I prefer clear communication',
                'I value direct feedback',
                'I need honest and clear validation'
            ];

            const result = service.analyzeCommunicationStyle(answers);

            expect(result.primary).toBe('direct');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('honest, straightforward communication');
        });

        test('should detect casual communication style from keywords', () => {
            const answers = [
                'Mike',
                'I handle stress in a relaxed way',
                'When overwhelmed, I need casual support',
                'I prefer casual, friendly conversations',
                'I like relaxed, easy-going discussions',
                'I value informal interactions',
                'I need relaxed emotional support',
                'I cope by staying casual',
                'When stressed, I want friendly guidance',
                'I enjoy casual environments',
                'I prefer informal communication',
                'I value friendly feedback',
                'I need relaxed and friendly validation'
            ];

            const result = service.analyzeCommunicationStyle(answers);

            expect(result.primary).toBe('casual');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('relaxed, friendly conversations');
        });

        test('should detect deep communication style from keywords', () => {
            const answers = [
                'Sarah',
                'I handle stress through deep reflection',
                'When overwhelmed, I need meaningful support',
                'I prefer deep, philosophical conversations',
                'I like meaningful, thoughtful discussions',
                'I value profound interactions',
                'I need deep emotional support',
                'I cope through deep contemplation',
                'When stressed, I want philosophical guidance',
                'I enjoy meaningful environments',
                'I prefer thoughtful communication',
                'I value profound feedback',
                'I need deep and meaningful validation'
            ];

            const result = service.analyzeCommunicationStyle(answers);

            expect(result.primary).toBe('deep');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('meaningful, philosophical discussions');
        });

        test('should default to balanced style when no clear pattern is detected', () => {
            const answers = [
                'Alex',
                'I handle stress okay',
                'When overwhelmed, I manage',
                'I communicate normally',
                'I like regular discussions',
                'I value normal interactions',
                'I need regular support',
                'I cope normally',
                'When stressed, I manage',
                'I enjoy normal environments',
                'I prefer regular communication',
                'I value normal feedback',
                'I need regular validation'
            ];

            const result = service.analyzeCommunicationStyle(answers);

            expect(result.primary).toBe('balanced');
            expect(result.confidence).toBe(0.7);
            expect(result.description).toContain('Adapts communication style');
        });
    });

    describe('Emotional Needs Analysis', () => {
        test('should detect validation needs from keywords', () => {
            const answers = [
                'Emma',
                'I handle stress by seeking understanding',
                'When overwhelmed, I need to feel heard',
                'I communicate when I need validation',
                'I like to feel understood',
                'I value being acknowledged',
                'I need to feel heard and validated',
                'I cope by seeking recognition',
                'When stressed, I need understanding',
                'I enjoy being acknowledged',
                'I prefer validated communication',
                'I value being heard',
                'I need to feel understood and validated'
            ];

            const result = service.analyzeEmotionalNeeds(answers);

            expect(result.primary).toBe('validation');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('feel heard, understood, and emotionally validated');
        });

        test('should detect clarity needs from keywords', () => {
            const answers = [
                'David',
                'I handle stress by seeking direction',
                'When overwhelmed, I need clear guidance',
                'I communicate when I need clarity',
                'I like clear direction',
                'I value focused guidance',
                'I need clear emotional direction',
                'I cope by seeking clarity',
                'When stressed, I need focused help',
                'I enjoy clear environments',
                'I prefer clear communication',
                'I value focused feedback',
                'I need clear and focused guidance'
            ];

            const result = service.analyzeEmotionalNeeds(answers);

            expect(result.primary).toBe('clarity');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('clear direction and guidance');
        });

        test('should detect connection needs from keywords', () => {
            const answers = [
                'Lisa',
                'I handle stress but feel alone',
                'When overwhelmed, I feel lonely',
                'I communicate when I feel isolated',
                'I like to feel connected',
                'I value belonging',
                'I need connection when alone',
                'I cope but feel isolated',
                'When stressed, I feel lonely',
                'I enjoy connected environments',
                'I prefer connected communication',
                'I value belonging',
                'I need connection and belonging'
            ];

            const result = service.analyzeEmotionalNeeds(answers);

            expect(result.primary).toBe('connection');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('deeper connection and sense of belonging');
        });

        test('should detect growth needs from keywords', () => {
            const answers = [
                'Tom',
                'I handle stress but want better coping',
                'When overwhelmed, I want to improve',
                'I communicate to develop better strategies',
                'I like to improve my approach',
                'I value developing better skills',
                'I need better coping strategies',
                'I want to develop better methods',
                'When stressed, I want to improve',
                'I enjoy growth environments',
                'I prefer developing communication',
                'I value improving strategies',
                'I need to develop better coping skills'
            ];

            const result = service.analyzeEmotionalNeeds(answers);

            expect(result.primary).toBe('growth');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('develop better emotional coping strategies');
        });
    });

    describe('Coping Style Analysis', () => {
        test('should detect social coping style from keywords', () => {
            const answers = [
                'Anna',
                'I handle stress by talking to others',
                'When overwhelmed, I share with friends',
                'I communicate by discussing with others',
                'I like to talk through problems',
                'I value sharing with friends',
                'I need to discuss my feelings',
                'I cope by talking to people',
                'When stressed, I reach out to others',
                'I enjoy social environments',
                'I prefer discussing with friends',
                'I value talking through issues',
                'I need to share and discuss'
            ];

            const result = service.analyzeCopingStyle(answers);

            expect(result.primary).toBe('social');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('conversation and social connection');
        });

        test('should detect independent coping style from keywords', () => {
            const answers = [
                'Mark',
                'I handle stress alone',
                'When overwhelmed, I work through it myself',
                'I communicate independently',
                'I like to solve problems solo',
                'I value working independently',
                'I need private time to cope',
                'I cope by working alone',
                'When stressed, I handle it myself',
                'I enjoy private environments',
                'I prefer independent problem-solving',
                'I value solo reflection',
                'I need to work through things alone'
            ];

            const result = service.analyzeCopingStyle(answers);

            expect(result.primary).toBe('independent');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('work through challenges independently');
        });

        test('should detect active coping style from keywords', () => {
            const answers = [
                'Chris',
                'I handle stress through exercise',
                'When overwhelmed, I do physical activity',
                'I communicate after physical movement',
                'I like sports and activity',
                'I value physical exercise',
                'I need movement to cope',
                'I cope through physical activity',
                'When stressed, I exercise',
                'I enjoy active environments',
                'I prefer physical activities',
                'I value sports and movement',
                'I need exercise and physical activity'
            ];

            const result = service.analyzeCopingStyle(answers);

            expect(result.primary).toBe('active');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('physical activities for emotional regulation');
        });

        test('should detect reflective coping style from keywords', () => {
            const answers = [
                'Maya',
                'I handle stress by thinking deeply',
                'When overwhelmed, I reflect on things',
                'I communicate after contemplation',
                'I like to journal and meditate',
                'I value reflection and thought',
                'I need time to think and reflect',
                'I cope through contemplation',
                'When stressed, I meditate',
                'I enjoy reflective environments',
                'I prefer thoughtful consideration',
                'I value journaling and reflection',
                'I need to think and contemplate'
            ];

            const result = service.analyzeCopingStyle(answers);

            expect(result.primary).toBe('reflective');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('reflection and introspection');
        });
    });

    describe('Stress Response Analysis', () => {
        test('should detect seek_support stress response from keywords', () => {
            const answers = [
                'Rachel',
                'I handle stress by seeking help',
                'When overwhelmed, I reach out for support',
                'I communicate to get help',
                'I like to talk to others when stressed',
                'I value getting support',
                'I need help when overwhelmed',
                'I cope by reaching out',
                'When stressed, I ask for help',
                'I enjoy supportive environments',
                'I prefer getting help from others',
                'I value support and help',
                'I need others when overwhelmed'
            ];

            const result = service.analyzeStressResponse(answers);

            expect(result.primary).toBe('seek_support');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('seeks support from others');
        });

        test('should detect withdraw stress response from keywords', () => {
            const answers = [
                'Ben',
                'I handle stress by being alone',
                'When overwhelmed, I need space',
                'I communicate less when stressed',
                'I like quiet time when overwhelmed',
                'I value alone time',
                'I need space when stressed',
                'I cope by withdrawing',
                'When stressed, I isolate myself',
                'I enjoy quiet environments',
                'I prefer being alone when overwhelmed',
                'I value space and quiet',
                'I need to withdraw when stressed'
            ];

            const result = service.analyzeStressResponse(answers);

            expect(result.primary).toBe('withdraw');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('withdraw and need space');
        });

        test('should detect problem_solve stress response from keywords', () => {
            const answers = [
                'Jordan',
                'I handle stress by solving problems',
                'When overwhelmed, I take action',
                'I communicate to fix things',
                'I like to organize and plan',
                'I value solving problems',
                'I need to fix things when stressed',
                'I cope by taking action',
                'When stressed, I organize and plan',
                'I enjoy problem-solving environments',
                'I prefer fixing and organizing',
                'I value action and solutions',
                'I need to solve and fix problems'
            ];

            const result = service.analyzeStressResponse(answers);

            expect(result.primary).toBe('problem_solve');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('problem-solving and taking action');
        });

        test('should detect emotional_process stress response from keywords', () => {
            const answers = [
                'Sam',
                'I handle stress by feeling my emotions',
                'When overwhelmed, I process my feelings',
                'I communicate about my emotions',
                'I like to experience my feelings',
                'I value emotional processing',
                'I need to feel my emotions',
                'I cope by processing feelings',
                'When stressed, I accept my emotions',
                'I enjoy emotional environments',
                'I prefer feeling and processing',
                'I value emotional experience',
                'I need to process and feel emotions'
            ];

            const result = service.analyzeStressResponse(answers);

            expect(result.primary).toBe('emotional_process');
            expect(result.confidence).toBeGreaterThan(0.6);
            expect(result.description).toContain('processing and experiencing emotions');
        });
    });

    describe('Uniqueness Insights Generation', () => {
        test('should generate trait combination insights for deep + growth combination', () => {
            const answers = [
                'Alex',
                'I handle stress through deep reflection',
                'When overwhelmed, I process deeply',
                'I prefer deep, philosophical conversations',
                'I like meaningful discussions',
                'I value profound interactions',
                'I need deep emotional support',
                'I cope through contemplation',
                'When stressed, I reflect deeply',
                'I enjoy meaningful environments',
                'I prefer thoughtful communication',
                'I value growth and development',
                'I need to develop better coping strategies and grow'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result).toHaveLength(3);
            expect(result[0].type).toBe('trait_combination');
            expect(result[0].content).toContain('deep, meaningful conversations');
            expect(result[0].content).toContain('personal growth');
            expect(result[0].confidence).toBe(0.9);
        });

        test('should generate interpersonal strength insights for gentle + social combination', () => {
            const answers = [
                'Emma',
                'I handle stress by talking to others gently',
                'When overwhelmed, I seek gentle support',
                'I prefer gentle, supportive conversations',
                'I like to talk through problems',
                'I value nurturing interactions with others',
                'I need gentle emotional support from friends',
                'I cope by talking to people gently',
                'When stressed, I share with others',
                'I enjoy supportive social environments',
                'I prefer gentle discussions with friends',
                'I value soft communication',
                'I need gentle validation from others'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result).toHaveLength(3);
            expect(result[0].type).toBe('interpersonal_strength');
            expect(result[0].content).toContain('gentle communication style');
            expect(result[0].content).toContain('safe spaces');
            expect(result[0].confidence).toBe(0.85);
        });

        test('should generate creative nature insights when creative keywords are detected', () => {
            const answers = [
                'Maya',
                'I handle stress creatively',
                'When overwhelmed, I turn to art',
                'I communicate through creative expression',
                'I like artistic activities',
                'I value creative pursuits',
                'I need creative outlets',
                'I cope through music and art',
                'When stressed, I create',
                'I enjoy creative environments',
                'I express myself through art and music',
                'I value artistic expression',
                'I need creative and artistic outlets'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result.some(insight => insight.type === 'creative_nature')).toBe(true);
            const creativeInsight = result.find(insight => insight.type === 'creative_nature');
            expect(creativeInsight.content).toContain('creative side');
            expect(creativeInsight.content).toContain('artistic sensibility');
            expect(creativeInsight.confidence).toBe(0.8);
        });

        test('should generate caring nature insights when helping keywords are detected', () => {
            const answers = [
                'David',
                'I handle stress by helping others',
                'When overwhelmed, I still care for people',
                'I communicate to help others',
                'I like to care for people',
                'I value helping others',
                'I need to help and care',
                'I cope by caring for others',
                'When stressed, I still help people',
                'I enjoy caring environments',
                'I prefer helping and caring',
                'I value others\' wellbeing',
                'I need to help and care for others'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result.some(insight => insight.type === 'caring_nature')).toBe(true);
            const caringInsight = result.find(insight => insight.type === 'caring_nature');
            expect(caringInsight.content).toContain('caring heart');
            expect(caringInsight.content).toContain('empathy');
            expect(caringInsight.confidence).toBe(0.85);
        });

        test('should provide general uniqueness insight when no specific patterns are detected', () => {
            const answers = [
                'Pat',
                'I handle stress okay',
                'When overwhelmed, I manage',
                'I communicate normally',
                'I like regular activities',
                'I value normal things',
                'I need regular support',
                'I cope normally',
                'When stressed, I manage',
                'I enjoy normal environments',
                'I prefer regular activities',
                'I value normal interactions',
                'I need regular help'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result).toHaveLength(3); // Should have 3 insights including general ones
            expect(result.some(insight => insight.type === 'general_uniqueness')).toBe(true);
            const generalInsight = result.find(insight => insight.type === 'general_uniqueness');
            expect(generalInsight.content).toContain('thoughtful approach');
            expect(generalInsight.confidence).toBe(0.8);
        });

        test('should limit uniqueness insights to maximum of 3', () => {
            const answers = [
                'Multi',
                'I handle stress through creative art and helping others',
                'When overwhelmed, I create music and care for people',
                'I prefer deep, philosophical conversations about art',
                'I like meaningful discussions while helping others',
                'I value creative pursuits and caring for people',
                'I need artistic outlets and to help others',
                'I cope through art, music, and caring',
                'When stressed, I create and help people',
                'I enjoy creative, caring environments',
                'I prefer artistic expression and helping others',
                'I value growth, creativity, and caring',
                'I need to develop better creative coping and help others'
            ];

            const result = service.generateUniquenessInsights(answers);

            expect(result).toHaveLength(3); // Should be limited to 3 insights
        });
    });

    describe('Complete Personality Analysis', () => {
        test('should perform complete analysis with all components', async () => {
            const answers = [
                'TestUser',
                'I handle stress by talking to friends',
                'When overwhelmed, I seek support from others',
                'I prefer gentle, supportive conversations',
                'I like to share my feelings',
                'I value nurturing interactions',
                'I need emotional validation and understanding',
                'I cope by reaching out to people',
                'When stressed, I talk to others',
                'I enjoy supportive environments',
                'I love creative activities and art',
                'I prefer helping others when possible',
                'I need to feel heard and validated by others'
            ];

            const result = await service.analyzePersonality(answers);

            expect(result).toHaveProperty('communicationStyle');
            expect(result).toHaveProperty('emotionalNeeds');
            expect(result).toHaveProperty('copingStyle');
            expect(result).toHaveProperty('stressResponse');
            expect(result).toHaveProperty('uniquenessFactors');
            expect(result).toHaveProperty('confidence');

            expect(result.communicationStyle.primary).toBe('gentle');
            expect(result.emotionalNeeds.primary).toBe('validation');
            expect(result.copingStyle.primary).toBe('social');
            expect(result.stressResponse.primary).toBe('seek_support');
            expect(result.uniquenessFactors).toHaveLength(3);
            expect(result.confidence).toBe(0.85);
        });

        test('should handle analysis errors gracefully', async () => {
            // Test with invalid input - the service now handles null gracefully
            const invalidAnswers = null;

            const result = await service.analyzePersonality(invalidAnswers);
            
            // Should return default analysis instead of throwing
            expect(result).toHaveProperty('communicationStyle');
            expect(result).toHaveProperty('emotionalNeeds');
            expect(result).toHaveProperty('copingStyle');
            expect(result).toHaveProperty('stressResponse');
            expect(result.communicationStyle.primary).toBe('balanced');
        });
    });

    describe('Edge Cases and Invalid Input Handling', () => {
        test('should handle empty answers array', async () => {
            const emptyAnswers = [];

            const result = await service.analyzePersonality(emptyAnswers);

            expect(result.communicationStyle.primary).toBe('balanced');
            expect(result.emotionalNeeds.primary).toBe('support');
            expect(result.copingStyle.primary).toBe('mixed');
            expect(result.stressResponse.primary).toBe('adaptive');
            expect(result.uniquenessFactors).toHaveLength(3); // Should have 3 insights
        });

        test('should handle answers with only empty strings', async () => {
            const emptyStringAnswers = ['', '', '', '', '', '', '', '', '', '', '', '', ''];

            const result = await service.analyzePersonality(emptyStringAnswers);

            expect(result.communicationStyle.primary).toBe('balanced');
            expect(result.emotionalNeeds.primary).toBe('support');
            expect(result.copingStyle.primary).toBe('mixed');
            expect(result.stressResponse.primary).toBe('adaptive');
        });

        test('should handle answers with very short responses', async () => {
            const shortAnswers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

            const result = await service.analyzePersonality(shortAnswers);

            expect(result).toHaveProperty('communicationStyle');
            expect(result).toHaveProperty('emotionalNeeds');
            expect(result).toHaveProperty('copingStyle');
            expect(result).toHaveProperty('stressResponse');
            expect(result.confidence).toBe(0.85);
        });

        test('should handle answers with special characters and numbers', async () => {
            const specialAnswers = [
                'User123!@#',
                'I handle stress... sometimes??? 50/50',
                'When overwhelmed: I do things!!! (maybe)',
                'Communication = important & necessary',
                'I like... various things? 100%',
                'Values: respect + kindness = good',
                'Needs: support & understanding (always)',
                'Coping: methods vary... 75% effective',
                'Stress response: depends on situation!!!',
                'Environment: peaceful & calm spaces',
                'Preferences: flexible & adaptive approach',
                'Feedback: constructive & helpful please',
                'Validation: needed & appreciated always'
            ];

            const result = await service.analyzePersonality(specialAnswers);

            expect(result).toHaveProperty('communicationStyle');
            expect(result).toHaveProperty('emotionalNeeds');
            expect(result).toHaveProperty('copingStyle');
            expect(result).toHaveProperty('stressResponse');
            expect(result.uniquenessFactors).toHaveLength(3); // Should handle gracefully and return 3 insights
        });

        test('should handle mixed case keywords correctly', async () => {
            const mixedCaseAnswers = [
                'TestUser',
                'I handle stress by TALKING to others',
                'When overwhelmed, I Seek Support',
                'I prefer GENTLE conversations',
                'I like to Share feelings',
                'I value NURTURING interactions',
                'I need VALIDATION and understanding',
                'I cope by Reaching Out',
                'When stressed, I TALK to people',
                'I enjoy Supportive environments',
                'I love CREATIVE activities',
                'I prefer HELPING others',
                'I need to feel HEARD and validated'
            ];

            const result = await service.analyzePersonality(mixedCaseAnswers);

            expect(result.communicationStyle.primary).toBe('gentle');
            expect(result.emotionalNeeds.primary).toBe('validation');
            expect(result.copingStyle.primary).toBe('social');
            expect(result.stressResponse.primary).toBe('seek_support');
        });

        test('should handle undefined or null individual answers', async () => {
            const answersWithNulls = [
                'TestUser',
                null,
                undefined,
                'I prefer gentle conversations',
                '',
                'I value nurturing interactions',
                null,
                'I cope by reaching out',
                undefined,
                'I enjoy supportive environments',
                '',
                'I prefer helping others',
                'I need validation'
            ];

            const result = await service.analyzePersonality(answersWithNulls);

            expect(result).toHaveProperty('communicationStyle');
            expect(result).toHaveProperty('emotionalNeeds');
            expect(result).toHaveProperty('copingStyle');
            expect(result).toHaveProperty('stressResponse');
        });

        test('should handle extremely long answers', async () => {
            const longAnswer = 'I handle stress by talking to friends and family members who understand me and provide gentle, supportive, nurturing conversations that help me feel validated and heard in a caring environment where I can express my deep emotions and philosophical thoughts about life while seeking meaningful connections and personal growth through creative artistic expression and helping others in my community'.repeat(10);
            
            const longAnswers = [
                'TestUser',
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer,
                longAnswer
            ];

            const result = await service.analyzePersonality(longAnswers);

            expect(result.communicationStyle.primary).toBe('gentle');
            expect(result.emotionalNeeds.primary).toBe('validation');
            expect(result.copingStyle.primary).toBe('social');
            expect(result.confidence).toBeGreaterThan(0.8);
        });
    });

    describe('Database Integration', () => {
        test('should store personality insights in database', async () => {
            const userId = 1;
            const analysis = {
                communicationStyle: {
                    primary: 'gentle',
                    description: 'Prefers soft, nurturing interactions',
                    confidence: 0.9
                },
                emotionalNeeds: {
                    primary: 'validation',
                    description: 'Needs to feel heard and understood',
                    confidence: 0.85
                },
                copingStyle: {
                    primary: 'social',
                    description: 'Processes emotions through conversation',
                    confidence: 0.8
                },
                uniquenessFactors: [
                    {
                        type: 'creative_nature',
                        content: 'Your creative side shines through',
                        confidence: 0.8
                    },
                    {
                        type: 'caring_nature',
                        content: 'You have a naturally caring heart',
                        confidence: 0.85
                    }
                ]
            };

            await service.storePersonalityInsights(userId, analysis);

            // Verify data was stored
            const insights = await service.getPersonalityInsights(userId);
            expect(insights).toHaveLength(5); // 3 main insights + 2 uniqueness factors
            
            const communicationInsight = insights.find(i => i.insight_type === 'communication_style');
            expect(communicationInsight.insight_content).toContain('soft, nurturing interactions');
            expect(communicationInsight.confidence_score).toBe(0.9);
        });

        test('should generate personality summary from stored insights', async () => {
            const userId = 2;
            const analysis = {
                communicationStyle: {
                    primary: 'direct',
                    description: 'Values honest, straightforward communication',
                    confidence: 0.9
                },
                emotionalNeeds: {
                    primary: 'clarity',
                    description: 'Seeks clear direction and guidance',
                    confidence: 0.85
                },
                copingStyle: {
                    primary: 'independent',
                    description: 'Prefers to work through challenges independently',
                    confidence: 0.8
                },
                uniquenessFactors: [
                    {
                        type: 'problem_solver',
                        content: 'You have a natural problem-solving ability',
                        confidence: 0.9
                    }
                ]
            };

            await service.storePersonalityInsights(userId, analysis);
            const summary = await service.generatePersonalitySummary(userId);

            expect(summary.communicationStyle.content).toContain('honest, straightforward communication');
            expect(summary.emotionalNeeds.content).toContain('clear direction and guidance');
            expect(summary.copingStyle.content).toContain('work through challenges independently');
            expect(summary.uniquenessFactors).toHaveLength(1);
            expect(summary.overallConfidence).toBeGreaterThan(0.8);
        });

        test('should handle database errors gracefully', async () => {
            // Create a service with a mock database that throws errors
            const errorDb = {
                run: (query, params, callback) => {
                    callback(new Error('Database error'));
                },
                all: (query, params, callback) => {
                    callback(new Error('Database error'));
                }
            };

            const errorService = new PersonalityAnalysisService(errorDb);

            await expect(errorService.storePersonalityInsights(1, {})).rejects.toThrow('Failed to store personality insights');
            await expect(errorService.getPersonalityInsights(1)).rejects.toThrow();
            await expect(errorService.generatePersonalitySummary(1)).rejects.toThrow('Failed to generate personality summary');
        });
    });

    describe('Confidence Scoring', () => {
        test('should increase confidence with more keyword matches', () => {
            const highMatchAnswers = [
                'TestUser',
                'I handle stress by talking, sharing, discussing with others',
                'When overwhelmed, I reach out, seek help, get support',
                'I prefer gentle, soft, nurturing, supportive conversations',
                'I like to talk, share, discuss with friends and others',
                'I value gentle, nurturing, supportive interactions',
                'I need validation, understanding, to be heard',
                'I cope by talking, sharing, reaching out to others',
                'When stressed, I talk, discuss, share with people',
                'I enjoy supportive, nurturing, gentle environments',
                'I prefer talking, sharing, discussing with others',
                'I value gentle, supportive, nurturing feedback',
                'I need validation, understanding, to feel heard'
            ];

            const result = service.analyzeCommunicationStyle(highMatchAnswers);
            expect(result.confidence).toBeGreaterThan(0.8);
        });

        test('should have lower confidence with fewer keyword matches', () => {
            const lowMatchAnswers = [
                'TestUser',
                'I handle stress sometimes',
                'When overwhelmed, I do things',
                'I prefer okay conversations',
                'I like normal discussions',
                'I value regular interactions',
                'I need some support',
                'I cope in various ways',
                'When stressed, I manage',
                'I enjoy normal environments',
                'I prefer regular communication',
                'I value normal feedback',
                'I need regular help'
            ];

            const result = service.analyzeCommunicationStyle(lowMatchAnswers);
            expect(result.confidence).toBeLessThan(0.8);
        });
    });
});