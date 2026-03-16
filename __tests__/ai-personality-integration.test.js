const AIService = require('../ai-service');
const PersonalityAnalysisService = require('../personality-analysis-service');
const PersonalizationService = require('../personalization-service');

// Mock OpenAI for testing
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }));
});

// Mock database for testing
class MockDatabase {
    constructor() {
        this.data = [];
        this.users = [];
        this.insights = [];
        this.conversations = [];
    }

    run(query, params, callback) {
        setTimeout(() => {
            if (query.includes('INSERT INTO personality_insights')) {
                const [userId, type, content, confidence, priority] = params;
                this.insights.push({
                    id: this.insights.length + 1,
                    user_id: userId,
                    insight_type: type,
                    insight_content: content,
                    confidence_score: confidence,
                    display_priority: priority
                });
            }
            callback(null);
        }, 0);
    }

    all(query, params, callback) {
        setTimeout(() => {
            if (query.includes('personality_insights')) {
                const userId = params[0];
                const results = this.insights
                    .filter(item => item.user_id === userId)
                    .sort((a, b) => a.display_priority - b.display_priority);
                callback(null, results);
            } else {
                callback(null, []);
            }
        }, 0);
    }
}

describe('AI Personality Integration Tests', () => {
    let aiService;
    let personalityService;
    let personalizationService;
    let mockDb;
    let mockOpenAI;

    beforeEach(() => {
        mockDb = new MockDatabase();
        personalityService = new PersonalityAnalysisService(mockDb);
        personalizationService = new PersonalizationService(mockDb);
        aiService = new AIService(personalizationService);
        
        // Get the mocked OpenAI instance
        mockOpenAI = aiService.openai;
    });

    describe('Personalized Welcome Message Generation', () => {
        test('should generate personalized welcome for gentle communication style user', async () => {
            const user = {
                id: 1,
                name: 'Emma',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Emma',
                    'I handle stress by taking deep breaths and seeking gentle support',
                    'When overwhelmed, I need soft, caring guidance',
                    'I prefer gentle, supportive conversations',
                    'I like nurturing interactions',
                    'I express emotions softly and carefully',
                    'I feel understood when someone is gentle with me',
                    'I cope by being gentle with myself',
                    'When stressed, I need gentle reassurance',
                    'I enjoy peaceful environments',
                    'I prefer soft communication',
                    'I value gentle feedback',
                    'I need gentle validation and understanding'
                ]),
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Your communication style: Prefers soft, nurturing interactions with careful emotional support',
                    confidence_score: 0.9
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Your emotional needs: Needs to feel heard, understood, and emotionally validated',
                    confidence_score: 0.85
                },
                {
                    insight_type: 'uniqueness',
                    insight_content: 'Your gentle nature and preference for nurturing conversations makes you someone who creates safe spaces for others.',
                    confidence_score: 0.8
                }
            ];

            // Mock OpenAI response for gentle user
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                    message: {
                        content: "Hi Emma! I'm Solace, and I'm so honored to be your companion. From your thoughtful responses, I can already sense your gentle heart and how much you value nurturing connections. I love that you prefer soft, supportive conversations - that tells me you're someone who truly understands the power of kindness. I'm here to offer you the gentle guidance and validation you deserve. What's gently on your mind today?"
                    }
                }]
            });

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            expect(welcomeMessage).toContain('Emma');
            expect(welcomeMessage).toContain('gentle');
            expect(welcomeMessage).toContain('nurturing');
            // Verify the message is personalized based on gentle communication style
            expect(welcomeMessage.toLowerCase()).toMatch(/gentle|soft|nurturing|caring/);
        });

        test('should generate personalized welcome for direct communication style user', async () => {
            const user = {
                id: 2,
                name: 'Alex',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Alex',
                    'I handle stress by facing it head-on',
                    'When overwhelmed, I need honest, clear guidance',
                    'I prefer direct, straightforward conversations',
                    'I like honest interactions',
                    'I express emotions directly and clearly',
                    'I feel understood when someone is honest with me',
                    'I cope by being direct with myself',
                    'When stressed, I want clear, actionable advice',
                    'I enjoy straightforward environments',
                    'I prefer clear communication',
                    'I value honest feedback',
                    'I need direct validation and clear direction'
                ]),
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Your communication style: Values honest, straightforward communication without sugar-coating',
                    confidence_score: 0.9
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Your emotional needs: Seeks clear direction and guidance in life decisions',
                    confidence_score: 0.85
                },
                {
                    insight_type: 'uniqueness',
                    insight_content: 'Your direct approach and preference for honest communication makes you someone who values authenticity above all.',
                    confidence_score: 0.8
                }
            ];

            // Mock OpenAI response for direct user
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                    message: {
                        content: "Hey Alex! I'm Solace, your new companion. I can tell from your responses that you value straight talk and honest communication - I respect that completely. You're someone who faces challenges head-on and wants clear, actionable guidance. I won't sugarcoat things with you, and I'll always give you my honest perspective. So let's cut to the chase - what's really on your mind right now?"
                    }
                }]
            });

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            expect(welcomeMessage).toContain('Alex');
            expect(welcomeMessage.toLowerCase()).toMatch(/direct|honest|straight/);
            expect(welcomeMessage).toContain('clear');
            // Verify the message is personalized based on direct communication style
            expect(welcomeMessage.toLowerCase()).toMatch(/direct|honest|straight|clear/);
        });

        test('should generate personalized welcome for deep communication style user', async () => {
            const user = {
                id: 3,
                name: 'Maya',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Maya',
                    'I handle stress through deep reflection and contemplation',
                    'When overwhelmed, I need meaningful, thoughtful support',
                    'I prefer deep, philosophical conversations',
                    'I like profound, meaningful interactions',
                    'I express emotions through deep sharing',
                    'I feel understood when someone engages with my deeper thoughts',
                    'I cope through deep introspection',
                    'When stressed, I need philosophical guidance',
                    'I enjoy meaningful, contemplative environments',
                    'I prefer thoughtful communication',
                    'I value profound feedback',
                    'I need deep understanding and meaningful connection'
                ]),
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Your communication style: Loves meaningful, philosophical discussions and deep exploration',
                    confidence_score: 0.9
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Your emotional needs: Wants to develop better emotional coping strategies through deep understanding',
                    confidence_score: 0.85
                },
                {
                    insight_type: 'uniqueness',
                    insight_content: 'Your love for deep, meaningful conversations while actively seeking personal growth makes you someone who transforms insights into real change.',
                    confidence_score: 0.9
                }
            ];

            // Mock OpenAI response for deep user
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                    message: {
                        content: "Hello Maya, I'm Solace. There's something beautiful about connecting with someone who seeks depth and meaning in their conversations. I can sense from your thoughtful responses that you're someone who doesn't just want surface-level interactions - you're looking for genuine understanding and philosophical exploration. I'm here to dive deep with you, to explore the profound questions and insights that matter to your soul. What meaningful thoughts are stirring within you today?"
                    }
                }]
            });

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            expect(welcomeMessage).toContain('Maya');
            expect(welcomeMessage.toLowerCase()).toMatch(/deep|meaningful|philosophical/);
            expect(welcomeMessage.toLowerCase()).toMatch(/profound|soul|understanding/);
            // Verify the message is personalized based on deep communication style
            expect(welcomeMessage.toLowerCase()).toMatch(/deep|meaningful|philosophical|profound/);
        });

        test('should handle fallback when personality insights are not available', async () => {
            const user = {
                id: 4,
                name: 'Sam',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Sam',
                    'I handle stress by talking to friends',
                    'When overwhelmed, I seek support',
                    'I prefer casual, friendly conversations',
                    'I like relaxed interactions',
                    'I express emotions openly',
                    'I feel understood when someone listens',
                    'I cope by sharing with others',
                    'When stressed, I reach out',
                    'I enjoy social environments',
                    'I prefer friendly communication',
                    'I value supportive feedback',
                    'I need connection and understanding'
                ]),
                onboarding_complete: true,
                first_session_completed: false
            };

            // No personality insights provided - should use fallback
            const personalityInsights = null;

            // Mock fallback response
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                    message: {
                        content: "Hi Sam! I'm Solace, and I'm genuinely excited to be your companion. I've been learning about you through your responses, and I can already tell you're someone special. I'm here to listen, support, and grow alongside you. What's on your mind today?"
                    }
                }]
            });

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            expect(welcomeMessage).toContain('Sam');
            expect(welcomeMessage).toContain('Solace');
            expect(welcomeMessage.toLowerCase()).toMatch(/support|listen|here/);
        });

        test('should handle errors gracefully and provide fallback welcome message', async () => {
            const user = {
                id: 5,
                name: 'Jordan',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['Jordan']),
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [];

            // Mock OpenAI error
            mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            // Should provide fallback message
            expect(welcomeMessage).toContain('Jordan');
            expect(welcomeMessage).toContain('Solace');
            expect(welcomeMessage.toLowerCase()).toMatch(/here|whatever|need/);
        });
    });

    describe('Response Adaptation Based on Communication Style Preferences', () => {
        test('should adapt system prompt for gentle communication style', async () => {
            const user = {
                id: 1,
                name: 'Emma',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Emma', 'gentle stress handling', 'gentle support', 'gentle conversations'
                ]),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Prefers soft, nurturing interactions with careful emotional support'
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Needs to feel heard, understood, and emotionally validated'
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Emma');
            expect(systemPrompt).toContain('soft, nurturing language');
            expect(systemPrompt).toContain('gentle');
            expect(systemPrompt).toContain('emotional safety');
            expect(systemPrompt).toContain('validation and reassurance');
        });

        test('should adapt system prompt for direct communication style', async () => {
            const user = {
                id: 2,
                name: 'Alex',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Alex', 'direct stress handling', 'honest feedback', 'direct conversations'
                ]),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Values honest, straightforward communication without sugar-coating'
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Seeks clear direction and guidance in life decisions'
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Alex');
            expect(systemPrompt).toContain('honest and straightforward');
            expect(systemPrompt).toContain('without sugarcoating');
            expect(systemPrompt).toContain('clear communication');
            expect(systemPrompt).toContain('actionable insights');
        });

        test('should adapt system prompt for casual communication style', async () => {
            const user = {
                id: 3,
                name: 'Sam',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Sam', 'relaxed handling', 'casual support', 'friendly conversations'
                ]),
                relationship_stage: 'comfortable',
                onboarding_complete: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Enjoys relaxed, friendly conversations in a comfortable atmosphere'
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Desires deeper connection and sense of belonging'
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Sam');
            expect(systemPrompt).toContain('light, friendly, and conversational');
            expect(systemPrompt).toContain('casual');
            expect(systemPrompt).toContain('close, trusted friend');
            expect(systemPrompt).toContain('informal');
        });

        test('should adapt system prompt for deep communication style', async () => {
            const user = {
                id: 4,
                name: 'Maya',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Maya', 'deep reflection', 'meaningful support', 'philosophical conversations'
                ]),
                relationship_stage: 'close_friend',
                onboarding_complete: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Loves meaningful, philosophical discussions and deep exploration'
                },
                {
                    insight_type: 'emotional_needs',
                    insight_content: 'Wants to develop better emotional coping strategies through deep understanding'
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Maya');
            expect(systemPrompt).toContain('thoughtful, meaningful dialogue');
            expect(systemPrompt).toContain('philosophical');
            expect(systemPrompt).toContain('deeper meaning');
            expect(systemPrompt).toContain('self-reflection');
        });

        test('should fallback to questionnaire-based adaptation when insights unavailable', async () => {
            const user = {
                id: 5,
                name: 'Jordan',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Jordan', 'stress handling', 'support needed', 'Direct and straightforward communication'
                ]),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            // No personality insights - should use questionnaire fallback
            const personalityInsights = null;

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Jordan');
            expect(systemPrompt).toContain('PERSONALITY PROFILE');
            expect(systemPrompt).toContain('Communication Style');
            expect(systemPrompt).toContain('Direct and straightforward');
        });
    });

    describe('Context Awareness of Onboarding Data in Conversations', () => {
        test('should include specific questionnaire responses in system prompt', async () => {
            const user = {
                id: 1,
                name: 'Emma',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Emma',
                    'I handle stress by taking deep breaths and meditating',
                    'When overwhelmed, I tend to withdraw and need space',
                    'I prefer gentle conversations',
                    'I like to process emotions slowly',
                    'I express emotions through writing',
                    'I feel understood when someone listens without judgment',
                    'I cope by journaling',
                    'When stressed, I need quiet time',
                    'I enjoy peaceful environments',
                    'I prefer thoughtful communication',
                    'I value patience',
                    'I need emotional validation and gentle support'
                ]),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Prefers gentle, supportive interactions'
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('ONBOARDING KNOWLEDGE');
            expect(systemPrompt).toContain('Emma chose to be called "Emma"');
            expect(systemPrompt).toContain('When stressed, Emma tends to: I handle stress by taking deep breaths and meditating');
            expect(systemPrompt).toContain('When overwhelmed, Emma: When overwhelmed, I tend to withdraw and need space');
            expect(systemPrompt).toContain('Emma\'s approach to expressing emotions: I express emotions through writing');
            expect(systemPrompt).toContain('What makes Emma feel understood: I feel understood when someone listens without judgment');
            expect(systemPrompt).toContain('Emma\'s primary emotional need: I need emotional validation and gentle support');
        });

        test('should reference onboarding completion status', async () => {
            const user = {
                id: 2,
                name: 'Alex',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['Alex']),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true,
                first_session_completed: false
            };

            const personalityInsights = [];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Alex completed their personality assessment and is ready for personalized support');
            expect(systemPrompt).toContain('This may be Alex\'s first conversation - make it special and welcoming');
        });

        test('should indicate when user has already had first conversation', async () => {
            const user = {
                id: 3,
                name: 'Sam',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['Sam']),
                relationship_stage: 'comfortable',
                onboarding_complete: true,
                first_session_completed: true
            };

            const personalityInsights = [];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Sam has already had their first conversation with you');
            expect(systemPrompt).not.toContain('This may be Sam\'s first conversation');
        });

        test('should integrate personality insights with conversation context', async () => {
            const user = {
                id: 4,
                name: 'Maya',
                companion_name: 'Solace',
                personality_profile: JSON.stringify([
                    'Maya',
                    'I handle stress through creative expression',
                    'When overwhelmed, I create art',
                    'I prefer deep conversations',
                    'I like meaningful discussions',
                    'I express emotions through creativity',
                    'I feel understood when someone appreciates my depth',
                    'I cope through artistic activities',
                    'When stressed, I paint or write',
                    'I enjoy creative environments',
                    'I prefer authentic communication',
                    'I value artistic expression',
                    'I need creative outlets and deep understanding'
                ]),
                relationship_stage: 'close_friend',
                onboarding_complete: true,
                first_session_completed: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Loves meaningful, philosophical discussions and deep exploration'
                },
                {
                    insight_type: 'uniqueness',
                    insight_content: 'Your creative side shines through in how you express yourself - this artistic sensibility brings depth and beauty to your perspective on life.'
                }
            ];

            const userInsights = {
                memories: [
                    { content: 'Maya loves painting watercolor landscapes', memory_type: 'hobby' },
                    { content: 'Maya feels most peaceful when creating art', memory_type: 'emotional_pattern' }
                ],
                emotionalPatterns: [
                    { emotions: ['creative', 'inspired'], frequency: 3 }
                ],
                favoriteTopics: [
                    { topics: ['art', 'creativity', 'self-expression'], frequency: 5 }
                ]
            };

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, userInsights, personalityInsights);

            // Should contain both personality insights and conversation context
            expect(systemPrompt).toContain('PERSONALITY INSIGHTS ABOUT MAYA');
            expect(systemPrompt).toContain('meaningful, philosophical discussions');
            expect(systemPrompt).toContain('creative side shines through');
            expect(systemPrompt).toContain('PERSONAL KNOWLEDGE ABOUT MAYA');
            expect(systemPrompt).toContain('Maya loves painting watercolor landscapes');
            expect(systemPrompt).toContain('Often feels: creative, inspired');
            expect(systemPrompt).toContain('art, creativity, self-expression');
            expect(systemPrompt).toContain('ONBOARDING KNOWLEDGE');
            expect(systemPrompt).toContain('I handle stress through creative expression');
        });

        test('should adapt personalization approach based on relationship stage', async () => {
            const user = {
                id: 5,
                name: 'Jordan',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['Jordan']),
                relationship_stage: 'trusted_confidant',
                onboarding_complete: true,
                first_session_completed: true
            };

            const personalityInsights = [];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('You are their most trusted confidant');
            expect(systemPrompt).toContain('Provide deep insights based on your knowledge of them');
            expect(systemPrompt).toContain('Help them see patterns and growth');
            expect(systemPrompt).toContain('Be their emotional anchor and source of wisdom');
        });

        test('should handle missing onboarding data gracefully', async () => {
            const user = {
                id: 6,
                name: 'Pat',
                companion_name: 'Solace',
                personality_profile: null, // Missing profile
                relationship_stage: 'getting_to_know',
                onboarding_complete: false
            };

            const personalityInsights = [];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('Pat');
            expect(systemPrompt).toContain('Solace');
            expect(systemPrompt).toContain('ONBOARDING KNOWLEDGE');
            // Should handle gracefully without crashing
            expect(systemPrompt).toBeDefined();
        });
    });

    describe('Integration with Existing Services', () => {
        test('should integrate with PersonalizationService for user insights', async () => {
            const user = {
                id: 1,
                name: 'TestUser',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['TestUser']),
                relationship_stage: 'comfortable',
                onboarding_complete: true
            };

            const personalityInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'Prefers casual, friendly conversations'
                }
            ];

            // Mock personalization service insights
            const mockUserInsights = {
                memories: [
                    { content: 'Loves hiking on weekends', memory_type: 'hobby' }
                ],
                emotionalPatterns: [
                    { emotions: ['happy', 'relaxed'], frequency: 2 }
                ],
                favoriteTopics: [
                    { topics: ['nature', 'outdoors'], frequency: 3 }
                ],
                moodTrends: [
                    { avg_mood: 7.5, date: '2024-01-15' }
                ]
            };

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, mockUserInsights, personalityInsights);

            expect(systemPrompt).toContain('PERSONALITY INSIGHTS ABOUT TESTUSER');
            expect(systemPrompt).toContain('casual, friendly conversations');
            expect(systemPrompt).toContain('PERSONAL KNOWLEDGE ABOUT TESTUSER');
            expect(systemPrompt).toContain('Loves hiking on weekends');
            expect(systemPrompt).toContain('Often feels: happy, relaxed');
            expect(systemPrompt).toContain('nature, outdoors');
            expect(systemPrompt).toContain('Recent average mood: 7.5/10');
        });

        test('should work with PersonalityAnalysisService generated insights', async () => {
            const userId = 1;
            const answers = [
                'TestUser',
                'I handle stress by talking to friends',
                'When overwhelmed, I seek support',
                'I prefer gentle, supportive conversations',
                'I like sharing feelings',
                'I express emotions openly',
                'I feel understood when someone listens',
                'I cope by reaching out',
                'When stressed, I talk to others',
                'I enjoy supportive environments',
                'I love creative activities',
                'I prefer helping others',
                'I need to feel heard and validated'
            ];

            // Generate personality analysis
            const analysis = await personalityService.analyzePersonality(answers);
            
            // Store insights in mock database
            await personalityService.storePersonalityInsights(userId, analysis);
            
            // Retrieve insights
            const storedInsights = await personalityService.getPersonalityInsights(userId);

            const user = {
                id: userId,
                name: 'TestUser',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(answers),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, storedInsights);

            expect(systemPrompt).toContain('PERSONALITY INSIGHTS ABOUT TESTUSER');
            expect(systemPrompt).toContain('Communication Style');
            expect(systemPrompt).toContain('Emotional Needs');
            expect(systemPrompt).toContain('Coping Approach');
            expect(systemPrompt).toContain('What Makes TestUser Unique');
            expect(systemPrompt).toContain('ONBOARDING KNOWLEDGE');
            expect(systemPrompt).toContain('I handle stress by talking to friends');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle OpenAI API failures gracefully in welcome message generation', async () => {
            const user = {
                id: 1,
                name: 'TestUser',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['TestUser']),
                onboarding_complete: true
            };

            const personalityInsights = [];

            // Mock API failure
            mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Rate Limit'));

            const welcomeMessage = await aiService.generatePersonalizedWelcome(user, personalityInsights);

            // Should provide fallback message
            expect(welcomeMessage).toContain('TestUser');
            expect(welcomeMessage).toContain('Solace');
            expect(welcomeMessage.toLowerCase()).toMatch(/here|whatever|need/);
            expect(welcomeMessage).not.toContain('Error');
        });

        test('should handle malformed personality insights gracefully', async () => {
            const user = {
                id: 1,
                name: 'TestUser',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['TestUser']),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            // Malformed insights
            const malformedInsights = [
                { insight_type: null, insight_content: null },
                { insight_type: 'communication_style', insight_content: 'Valid content' }, // Valid one
                { insight_content: 'Some content' } // Missing type
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, malformedInsights);

            expect(systemPrompt).toContain('TestUser');
            expect(systemPrompt).toContain('Solace');
            // Should not crash and provide basic functionality
            expect(systemPrompt).toBeDefined();
        });

        test('should handle empty or null user data gracefully', async () => {
            const user = {
                id: 1,
                name: null,
                companion_name: null,
                personality_profile: null,
                relationship_stage: null,
                onboarding_complete: false
            };

            const personalityInsights = [];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);

            expect(systemPrompt).toContain('friend'); // Default name
            expect(systemPrompt).toContain('Solace'); // Default companion name
            expect(systemPrompt).toContain('still getting to know each other'); // Default stage description
            expect(systemPrompt).toBeDefined();
        });

        test('should handle very long personality insights appropriately', async () => {
            const user = {
                id: 1,
                name: 'TestUser',
                companion_name: 'Solace',
                personality_profile: JSON.stringify(['TestUser']),
                relationship_stage: 'getting_to_know',
                onboarding_complete: true
            };

            const longInsights = [
                {
                    insight_type: 'communication_style',
                    insight_content: 'A'.repeat(1000) // Very long content
                },
                {
                    insight_type: 'uniqueness',
                    insight_content: 'B'.repeat(1000) // Very long content
                }
            ];

            const systemPrompt = await aiService.generatePersonalityDrivenSystemPrompt(user, null, longInsights);

            expect(systemPrompt).toContain('TestUser');
            expect(systemPrompt).toContain('PERSONALITY INSIGHTS');
            // Should handle long content without issues
            expect(systemPrompt.length).toBeGreaterThan(0);
        });
    });
});