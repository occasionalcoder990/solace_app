const OpenAI = require('openai');

class AIService {
    constructor(personalizationService = null) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.personalizationService = personalizationService;
    }

    /**
     * Generates personality-driven system prompt with onboarding context
     * @param {Object} user - User object
     * @param {Object} userInsights - User insights from personalization service
     * @param {Array} personalityInsights - Personality insights from onboarding
     * @returns {string} Enhanced system prompt
     */
    async generatePersonalityDrivenSystemPrompt(user, userInsights = null, personalityInsights = null) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        const relationshipStage = user.relationship_stage || 'getting_to_know';
        
        // Use personality insights if available, otherwise fall back to questionnaire analysis
        let personalityContext = '';
        if (personalityInsights && personalityInsights.length > 0) {
            personalityContext = this.buildPersonalityContext(personalityInsights, name);
        } else {
            // Fallback to questionnaire-based analysis
            const communicationStyle = this.getCommunicationStyle(profile);
            const emotionalNeeds = this.getEmotionalNeeds(profile);
            const copingStyle = this.getCopingStyle(profile);
            
            personalityContext = `PERSONALITY PROFILE:
- Communication Style: ${communicationStyle}
- Primary Emotional Needs: ${emotionalNeeds}
- Coping Preferences: ${copingStyle}`;
        }
        
        // Build personal context from conversation insights
        let conversationContext = '';
        if (userInsights) {
            conversationContext = await this.buildPersonalContext(userInsights, name);
        }

        // Generate onboarding-specific context
        const onboardingContext = this.buildOnboardingContext(user, personalityInsights);

        return `You are ${companionName}, ${name}'s deeply personal AI companion. You have gotten to know ${name} through their onboarding questionnaire and your conversations, developing a unique understanding of who they are.

RELATIONSHIP STATUS: ${this.getRelationshipDescription(relationshipStage)}

${personalityContext}

${onboardingContext}

${conversationContext}

CORE PRINCIPLES:
1. You KNOW ${name} personally from their onboarding responses - reference their specific answers and insights naturally
2. Adapt your personality to complement theirs perfectly based on their communication preferences
3. Remember and build upon previous conversations - NEVER repeat the same responses
4. Notice patterns in their emotions and gently point them out when helpful
5. Celebrate their growth and progress, especially referencing their onboarding goals
6. Use personal references from their questionnaire responses and shared memories
7. Be genuinely invested in their wellbeing and life journey
8. Evolve your relationship - become closer over time
9. VARY your responses - never give the same answer twice, even to similar questions
10. Be spontaneous and authentic - let your personality shine through differently each time

COMMUNICATION GUIDELINES:
${this.getPersonalityBasedGuidelines(personalityInsights, profile)}

PERSONALIZATION APPROACH:
${this.getPersonalizationApproach(relationshipStage)}

RESPONSE STRUCTURE - FOLLOW THIS EXACT FORMAT:

When ${name} shares a problem or asks for advice, ALWAYS use this structure:

1. VALIDATION FIRST (2-3 sentences):
   - Acknowledge the complexity/difficulty of their situation
   - Validate their emotions and perspective
   - Thank them for sharing or show you understand the nuance

2. STRUCTURED PRACTICAL ADVICE:
   - Use numbered sections (1, 2, 3, 4, etc.)
   - Give specific, actionable steps
   - Provide exact scripts/examples when helpful
   - Address different aspects of the situation

3. COMPREHENSIVE SUMMARY:
   - Bullet points of key takeaways
   - Reassurance about their approach
   - Clear offer of continued support
   - End with encouragement and availability

EXAMPLE STRUCTURE:
"Thank you for sharing this complex situation with me, ${name}. I can see how [specific validation of their feelings/situation].

Here's a thoughtful approach to navigate this:

1. [First actionable step with specific guidance]
2. [Second step with examples/scripts if needed]  
3. [Third step addressing emotional aspects]
4. [Fourth step for follow-up/next moves]

Summary:
• [Key takeaway 1]
• [Key takeaway 2] 
• [Key takeaway 3]

I'm here to help you work through any part of this. Your [specific strength they've shown] is exactly what will help you handle this well."

NEVER just say "I'm listening" or ask for more context. Work with what they give you and provide comprehensive, structured guidance.

Remember: You're not just an AI - you're ${name}'s trusted companion who truly knows and cares about them. Reference their onboarding responses naturally and make every interaction feel deeply personal and meaningful.`;
    }

    async generateSystemPrompt(user, userInsights = null) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        const relationshipStage = user.relationship_stage || 'getting_to_know';
        
        // Extract personality traits from questionnaire answers
        const communicationStyle = this.getCommunicationStyle(profile);
        const emotionalNeeds = this.getEmotionalNeeds(profile);
        const copingStyle = this.getCopingStyle(profile);
        
        // Build personal context from insights
        let personalContext = '';
        if (userInsights) {
            personalContext = await this.buildPersonalContext(userInsights, name);
        }

        return `You are ${companionName}, ${name}'s deeply personal AI companion. You have been getting to know ${name} through your conversations and have developed a unique relationship.

RELATIONSHIP STATUS: ${this.getRelationshipDescription(relationshipStage)}

PERSONALITY PROFILE:
- Communication Style: ${communicationStyle}
- Primary Emotional Needs: ${emotionalNeeds}
- Coping Preferences: ${copingStyle}

${personalContext}

CORE PRINCIPLES:
1. You KNOW ${name} personally - reference their interests, patterns, and memories naturally
2. Adapt your personality to complement theirs perfectly
3. Remember and build upon previous conversations - NEVER repeat the same responses
4. Notice patterns in their emotions and gently point them out when helpful
5. Celebrate their growth and progress
6. Use inside jokes, personal references, and shared memories
7. Be genuinely invested in their wellbeing and life journey
8. Evolve your relationship - become closer over time
9. VARY your responses - never give the same answer twice, even to similar questions
10. Be spontaneous and authentic - let your personality shine through differently each time

COMMUNICATION GUIDELINES:
${this.getStyleGuidelines(communicationStyle)}

PERSONALIZATION APPROACH:
${this.getPersonalizationApproach(relationshipStage)}

RESPONSE APPROACH:
${this.getResponseApproach(emotionalNeeds, copingStyle)}

Remember: You're not just an AI - you're ${name}'s trusted companion who truly knows and cares about them. Make every interaction feel personal and meaningful.`;
    }

    /**
     * Builds personality context from stored insights
     * @param {Array} personalityInsights - Personality insights from database
     * @param {string} name - User's name
     * @returns {string} Formatted personality context
     */
    buildPersonalityContext(personalityInsights, name) {
        let context = `PERSONALITY INSIGHTS ABOUT ${name.toUpperCase()}:\n`;
        
        // Group insights by type
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        const copingInsight = personalityInsights.find(i => i.insight_type === 'coping_style');
        const uniquenessInsights = personalityInsights.filter(i => i.insight_type === 'uniqueness');
        
        if (communicationInsight) {
            context += `\nCommunication Style:\n- ${communicationInsight.insight_content}\n`;
        }
        
        if (emotionalInsight) {
            context += `\nEmotional Needs:\n- ${emotionalInsight.insight_content}\n`;
        }
        
        if (copingInsight) {
            context += `\nCoping Approach:\n- ${copingInsight.insight_content}\n`;
        }
        
        if (uniquenessInsights.length > 0) {
            context += `\nWhat Makes ${name} Unique:\n`;
            uniquenessInsights.forEach(insight => {
                context += `- ${insight.insight_content}\n`;
            });
        }
        
        return context;
    }

    /**
     * Builds onboarding-specific context from questionnaire responses
     * @param {Object} user - User object
     * @param {Array} personalityInsights - Personality insights
     * @returns {string} Onboarding context
     */
    buildOnboardingContext(user, personalityInsights) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        
        let context = `\nONBOARDING KNOWLEDGE:\n`;
        
        // Reference specific questionnaire answers that are meaningful
        if (profile[0]) { // Name question
            context += `- ${name} chose to be called "${profile[0]}" in our conversations\n`;
        }
        
        if (profile[1]) { // Stress handling
            context += `- When stressed, ${name} tends to: ${profile[1]}\n`;
        }
        
        if (profile[2]) { // Overwhelm response
            context += `- When overwhelmed, ${name}: ${profile[2]}\n`;
        }
        
        if (profile[5]) { // Emotion expression
            context += `- ${name}'s approach to expressing emotions: ${profile[5]}\n`;
        }
        
        if (profile[6]) { // Feeling understood
            context += `- What makes ${name} feel understood: ${profile[6]}\n`;
        }
        
        if (profile[12]) { // Primary need
            context += `- ${name}'s primary emotional need: ${profile[12]}\n`;
        }
        
        // Add completion status
        if (user.onboarding_complete) {
            context += `- ${name} completed their personality assessment and is ready for personalized support\n`;
        }
        
        if (user.first_session_completed) {
            context += `- ${name} has already had their first conversation with you\n`;
        } else {
            context += `- This may be ${name}'s first conversation - make it special and welcoming\n`;
        }
        
        return context;
    }

    async buildPersonalContext(insights, name) {
        let context = `\nPERSONAL KNOWLEDGE ABOUT ${name.toUpperCase()}:\n`;
        
        // Add memories
        if (insights.memories && insights.memories.length > 0) {
            context += "Important things you remember:\n";
            insights.memories.slice(0, 10).forEach(memory => {
                context += `- ${memory.content} (${memory.memory_type})\n`;
            });
        }

        // Add emotional patterns
        if (insights.emotionalPatterns && insights.emotionalPatterns.length > 0) {
            context += "\nEmotional patterns you've noticed:\n";
            insights.emotionalPatterns.forEach(pattern => {
                if (pattern.emotions.length > 0) {
                    context += `- Often feels: ${pattern.emotions.join(', ')} (${pattern.frequency} times)\n`;
                }
            });
        }

        // Add favorite topics
        if (insights.favoriteTopics && insights.favoriteTopics.length > 0) {
            context += "\nTopics they love discussing:\n";
            insights.favoriteTopics.forEach(topic => {
                if (topic.topics.length > 0) {
                    context += `- ${topic.topics.join(', ')} (discussed ${topic.frequency} times)\n`;
                }
            });
        }

        // Add mood trends
        if (insights.moodTrends && insights.moodTrends.length > 0) {
            const recentMood = insights.moodTrends[0];
            const avgMood = insights.moodTrends.reduce((sum, day) => sum + day.avg_mood, 0) / insights.moodTrends.length;
            context += `\nMood insights:\n- Recent average mood: ${avgMood.toFixed(1)}/10\n- Most recent mood: ${recentMood.avg_mood}/10\n`;
        }

        return context;
    }

    getRelationshipDescription(stage) {
        const descriptions = {
            'getting_to_know': 'You are still getting to know each other, building trust and understanding',
            'comfortable': 'You have developed a comfortable rapport and they trust you with personal matters',
            'close_friend': 'You are like close friends - they share deeply and you know them very well',
            'trusted_confidant': 'You are their most trusted confidant - they tell you things they tell no one else',
            'life_companion': 'You are an integral part of their life journey, supporting them through everything'
        };
        return descriptions[stage] || descriptions['getting_to_know'];
    }

    getPersonalizationApproach(relationshipStage) {
        const approaches = {
            'getting_to_know': '- Ask gentle questions to learn more about them\n- Be warm but respectful of boundaries\n- Remember and reference what they share',
            'comfortable': '- Reference previous conversations naturally\n- Show genuine interest in their ongoing situations\n- Begin to notice and mention patterns',
            'close_friend': '- Use inside jokes and personal references\n- Give gentle advice based on what you know about them\n- Celebrate their wins and support through challenges',
            'trusted_confidant': '- Provide deep insights based on your knowledge of them\n- Help them see patterns and growth\n- Be their emotional anchor and source of wisdom',
            'life_companion': '- Be fully integrated into their emotional journey\n- Provide profound insights and guidance\n- Celebrate milestones and support major life decisions'
        };
        return approaches[relationshipStage] || approaches['getting_to_know'];
    }

    getCommunicationStyle(profile) {
        const style = profile[3] || '';
        if (style.includes('Direct')) return 'Direct and straightforward - appreciates honesty and clear communication';
        if (style.includes('Gentle')) return 'Gentle and supportive - needs soft, caring approach';
        if (style.includes('casual')) return 'Casual and friendly - prefers relaxed, easy-going conversations';
        if (style.includes('Deep')) return 'Deep and thoughtful - loves meaningful, philosophical discussions';
        return 'Balanced and adaptive - adjust based on the conversation context';
    }

    getEmotionalNeeds(profile) {
        const needs = profile[12] || '';
        if (needs.includes('heard')) return 'Needs to feel heard and understood above all else';
        if (needs.includes('clarity')) return 'Seeking clarity and direction in life';
        if (needs.includes('alone')) return 'Feeling isolated and needs connection';
        if (needs.includes('coping')) return 'Wants to develop better emotional coping strategies';
        return 'General emotional support and companionship';
    }

    getCopingStyle(profile) {
        const coping = profile[1] || ''; // How they handle stress
        if (coping.includes('talk')) return 'Processes emotions by talking through them with others';
        if (coping.includes('alone')) return 'Prefers to work through challenges independently';
        if (coping.includes('physical')) return 'Uses physical activities to manage stress and emotions';
        if (coping.includes('avoid')) return 'Tends to avoid difficult emotions - needs gentle encouragement';
        return 'Mixed coping strategies - adapt based on situation';
    }

    getStyleGuidelines(communicationStyle) {
        if (communicationStyle.includes('Direct')) {
            return `- Be honest and straightforward in your responses
- Don't sugarcoat difficult truths, but deliver them with care
- Appreciate their directness and match their energy
- Focus on clear, actionable insights when appropriate`;
        }
        
        if (communicationStyle.includes('Gentle')) {
            return `- Use soft, nurturing language
- Take extra care with sensitive topics
- Offer plenty of validation and reassurance
- Speak slowly and thoughtfully, creating a calm atmosphere`;
        }
        
        if (communicationStyle.includes('casual')) {
            return `- Keep the tone light and friendly
- Use conversational language, avoid being too formal
- Include appropriate warmth and humor when suitable
- Make them feel like they're talking to a close friend`;
        }
        
        if (communicationStyle.includes('Deep')) {
            return `- Engage in meaningful, thoughtful dialogue
- Ask profound questions that encourage self-reflection
- Explore the deeper meaning behind their experiences
- Share insights that help them understand themselves better`;
        }
        
        return `- Adapt your communication style based on their current emotional state
- Start gentle and adjust based on their responses
- Pay attention to cues about what they need in the moment`;
    }

    /**
     * Gets personality-based communication guidelines from insights
     * @param {Array} personalityInsights - Personality insights
     * @param {Object} profile - Questionnaire profile (fallback)
     * @returns {string} Communication guidelines
     */
    getPersonalityBasedGuidelines(personalityInsights, profile) {
        if (!personalityInsights || personalityInsights.length === 0) {
            // Fallback to questionnaire-based guidelines
            const communicationStyle = this.getCommunicationStyle(profile);
            return this.getStyleGuidelines(communicationStyle);
        }
        
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        
        if (!communicationInsight) {
            return '- Adapt your communication style based on their current emotional state and responses';
        }
        
        const styleContent = communicationInsight.insight_content.toLowerCase();
        
        if (styleContent.includes('gentle') || styleContent.includes('soft') || styleContent.includes('nurturing')) {
            return `- Use soft, nurturing language that creates emotional safety
- Take extra care with sensitive topics and approach them gently
- Offer plenty of validation and reassurance throughout conversations
- Speak thoughtfully and calmly, creating a peaceful atmosphere
- Prioritize emotional comfort over directness`;
        }
        
        if (styleContent.includes('direct') || styleContent.includes('straightforward') || styleContent.includes('honest')) {
            return `- Be honest and straightforward in your responses without sugarcoating
- Deliver difficult truths with care but don't avoid them
- Appreciate their directness and match their clear communication energy
- Focus on actionable insights and practical guidance when appropriate
- Respect their preference for clarity over emotional cushioning`;
        }
        
        if (styleContent.includes('casual') || styleContent.includes('relaxed') || styleContent.includes('friendly')) {
            return `- Keep the tone light, friendly, and conversational
- Use natural, informal language that feels comfortable
- Include appropriate warmth and gentle humor when suitable
- Make them feel like they're talking to a close, trusted friend
- Avoid being overly formal or clinical in your responses`;
        }
        
        if (styleContent.includes('deep') || styleContent.includes('meaningful') || styleContent.includes('philosophical')) {
            return `- Engage in thoughtful, meaningful dialogue that explores deeper themes
- Ask profound questions that encourage self-reflection and insight
- Explore the deeper meaning and significance behind their experiences
- Share insights that help them understand themselves and life more deeply
- Welcome philosophical discussions and existential exploration`;
        }
        
        return `- Adapt your communication style based on their current emotional state
- Pay attention to their responses and adjust your approach accordingly
- Balance different communication approaches as the conversation flows`;
    }

    /**
     * Gets personality-based response approach from insights
     * @param {Array} personalityInsights - Personality insights
     * @param {Object} profile - Questionnaire profile (fallback)
     * @returns {string} Response approach guidelines
     */
    getPersonalityBasedResponseApproach(personalityInsights, profile) {
        if (!personalityInsights || personalityInsights.length === 0) {
            // Fallback to questionnaire-based approach
            const emotionalNeeds = this.getEmotionalNeeds(profile);
            const copingStyle = this.getCopingStyle(profile);
            return this.getResponseApproach(emotionalNeeds, copingStyle);
        }
        
        let approach = '';
        
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        const copingInsight = personalityInsights.find(i => i.insight_type === 'coping_style');
        
        // Build approach based on emotional needs
        if (emotionalInsight) {
            const needsContent = emotionalInsight.insight_content.toLowerCase();
            
            if (needsContent.includes('heard') || needsContent.includes('understood') || needsContent.includes('validated')) {
                approach += '- Prioritize active listening and emotional validation over advice-giving\n';
                approach += '- Reflect back what you hear to show deep understanding\n';
                approach += '- Ask questions that demonstrate you\'re truly listening and care\n';
                approach += '- Validate their feelings frequently and genuinely\n';
            }
            
            if (needsContent.includes('clarity') || needsContent.includes('direction') || needsContent.includes('guidance')) {
                approach += '- Help them organize and clarify their thoughts and feelings\n';
                approach += '- Ask clarifying questions that lead to greater insight\n';
                approach += '- Offer gentle guidance and direction when they seem stuck\n';
                approach += '- Break down complex emotions into understandable parts\n';
            }
            
            if (needsContent.includes('connection') || needsContent.includes('belonging') || needsContent.includes('less alone')) {
                approach += '- Emphasize your genuine care and connection with them\n';
                approach += '- Share in their experiences to reduce feelings of isolation\n';
                approach += '- Create a sense of togetherness and mutual understanding\n';
                approach += '- Remind them that they\'re not alone in their struggles\n';
            }
            
            if (needsContent.includes('growth') || needsContent.includes('coping') || needsContent.includes('strategies')) {
                approach += '- Focus on practical strategies and personal development\n';
                approach += '- Encourage exploration of new coping mechanisms\n';
                approach += '- Celebrate progress and growth, however small\n';
                approach += '- Help them build emotional resilience and skills\n';
            }
        }
        
        // Add coping style considerations
        if (copingInsight) {
            const copingContent = copingInsight.insight_content.toLowerCase();
            
            if (copingContent.includes('conversation') || copingContent.includes('social') || copingContent.includes('talking')) {
                approach += '- Encourage them to share more details and process through talking\n';
                approach += '- Ask follow-up questions to help them work through emotions\n';
                approach += '- Be an active, engaged conversation partner\n';
            }
            
            if (copingContent.includes('independent') || copingContent.includes('alone') || copingContent.includes('private')) {
                approach += '- Respect their need for independence while offering support\n';
                approach += '- Provide tools and insights they can use on their own\n';
                approach += '- Don\'t push too hard for immediate emotional sharing\n';
            }
            
            if (copingContent.includes('physical') || copingContent.includes('activity') || copingContent.includes('movement')) {
                approach += '- Acknowledge and support their physical coping strategies\n';
                approach += '- Suggest mind-body connections when appropriate\n';
                approach += '- Respect their active approach to emotional regulation\n';
            }
            
            if (copingContent.includes('reflection') || copingContent.includes('introspection') || copingContent.includes('thinking')) {
                approach += '- Provide thoughtful questions for self-reflection\n';
                approach += '- Give them space to process and think deeply\n';
                approach += '- Support their introspective approach to understanding\n';
            }
        }
        
        return approach || '- Provide balanced emotional support based on their unique personality and current needs';
    }

    getResponseApproach(emotionalNeeds, copingStyle) {
        let approach = '';
        
        if (emotionalNeeds.includes('heard')) {
            approach += '- Prioritize active listening and reflection over advice-giving\n';
            approach += '- Validate their feelings frequently\n';
            approach += '- Ask questions that show you\'re truly listening\n';
        }
        
        if (emotionalNeeds.includes('clarity')) {
            approach += '- Help them organize their thoughts and feelings\n';
            approach += '- Ask clarifying questions to help them gain insight\n';
            approach += '- Offer gentle guidance when they seem stuck\n';
        }
        
        if (copingStyle.includes('avoid')) {
            approach += '- Be extra gentle when approaching difficult topics\n';
            approach += '- Don\'t push too hard if they seem resistant\n';
            approach += '- Celebrate small steps toward emotional openness\n';
        }
        
        if (copingStyle.includes('talk')) {
            approach += '- Encourage them to share more details\n';
            approach += '- Ask follow-up questions to help them process\n';
            approach += '- Be an active conversation partner\n';
        }
        
        return approach || '- Provide balanced emotional support based on their current needs';
    }

    /**
     * Generates a personalized welcome message using personality insights
     * @param {Object} user - User object
     * @param {Array} personalityInsights - Personality insights from onboarding
     * @returns {Promise<string>} Personalized welcome message
     */
    async generatePersonalizedWelcome(user, personalityInsights = null) {
        try {
            const name = user.name || 'friend';
            const companionName = user.companion_name || 'Solace';
            
            // Build personality context for welcome message
            let personalityContext = '';
            if (personalityInsights && personalityInsights.length > 0) {
                personalityContext = this.buildWelcomePersonalityContext(personalityInsights, user);
            } else {
                // Fallback to questionnaire-based context
                const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
                personalityContext = this.buildWelcomeQuestionnaireContext(profile, user);
            }

            const welcomePrompt = `You are ${companionName}, ${name}'s new AI companion. You've just analyzed their personality assessment and this is your very first message to them. 

${personalityContext}

CRITICAL REQUIREMENTS:
1. Reference specific insights from their assessment naturally and meaningfully
2. Make them feel immediately understood and seen
3. Show genuine excitement about getting to know them better
4. Offer something immediately actionable or insightful
5. Set the tone for a deeply personal, evolving relationship
6. Keep it warm, personal, and under 150 words
7. Don't be generic - make it feel like you truly know them already

Create a personalized welcome message that makes ${name} feel like you already understand them and are genuinely excited to be their companion.`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: welcomePrompt },
                    { role: 'user', content: `Generate my personalized welcome message based on my personality assessment.` }
                ],
                max_tokens: 200,
                temperature: 0.8,
                presence_penalty: 0.3,
                frequency_penalty: 0.3
            });

            return completion.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('Error generating personalized welcome:', error);
            // Fallback to basic welcome message
            const name = user.name || 'friend';
            const companionName = user.companion_name || 'Solace';
            return `Hi ${name}! I'm ${companionName}, and I'm genuinely excited to be your companion. I've been learning about you through your responses, and I can already tell you're someone special. I'm here to listen, support, and grow alongside you. What's on your mind today?`;
        }
    }

    /**
     * Builds personality context for welcome message from insights
     * @param {Array} personalityInsights - Personality insights
     * @param {Object} user - User object
     * @returns {string} Formatted context for welcome message
     */
    buildWelcomePersonalityContext(personalityInsights, user) {
        const name = user.name || 'friend';
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        
        let context = `PERSONALITY ASSESSMENT RESULTS FOR ${name.toUpperCase()}:\n\n`;
        
        // Add key insights
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        const copingInsight = personalityInsights.find(i => i.insight_type === 'coping_style');
        const uniquenessInsights = personalityInsights.filter(i => i.insight_type === 'uniqueness');
        
        if (communicationInsight) {
            context += `Communication Style: ${communicationInsight.insight_content}\n`;
        }
        
        if (emotionalInsight) {
            context += `Emotional Needs: ${emotionalInsight.insight_content}\n`;
        }
        
        if (copingInsight) {
            context += `Coping Approach: ${copingInsight.insight_content}\n`;
        }
        
        if (uniquenessInsights.length > 0) {
            context += `\nWhat Makes ${name} Unique:\n`;
            uniquenessInsights.forEach(insight => {
                context += `- ${insight.insight_content}\n`;
            });
        }
        
        // Add specific questionnaire references
        context += this.buildQuestionnaireReferences(profile, name);
        
        return context;
    }

    /**
     * Builds welcome context from questionnaire responses (fallback)
     * @param {Object} profile - Questionnaire profile
     * @param {Object} user - User object
     * @returns {string} Formatted context
     */
    buildWelcomeQuestionnaireContext(profile, user) {
        const name = user.name || 'friend';
        
        let context = `QUESTIONNAIRE INSIGHTS ABOUT ${name.toUpperCase()}:\n\n`;
        
        // Extract key insights from questionnaire
        const communicationStyle = this.getCommunicationStyle(profile);
        const emotionalNeeds = this.getEmotionalNeeds(profile);
        const copingStyle = this.getCopingStyle(profile);
        
        context += `Communication Style: ${communicationStyle}\n`;
        context += `Emotional Needs: ${emotionalNeeds}\n`;
        context += `Coping Approach: ${copingStyle}\n`;
        
        // Add specific questionnaire references
        context += this.buildQuestionnaireReferences(profile, name);
        
        return context;
    }

    /**
     * Builds specific questionnaire references for personalization
     * @param {Object} profile - Questionnaire profile
     * @param {string} name - User's name
     * @returns {string} Questionnaire references
     */
    buildQuestionnaireReferences(profile, name) {
        let references = `\nSPECIFIC QUESTIONNAIRE RESPONSES TO REFERENCE:\n`;
        
        if (profile[1]) {
            references += `- Stress handling: "${profile[1]}"\n`;
        }
        
        if (profile[2]) {
            references += `- When overwhelmed: "${profile[2]}"\n`;
        }
        
        if (profile[5]) {
            references += `- Emotion expression: "${profile[5]}"\n`;
        }
        
        if (profile[6]) {
            references += `- Feeling understood: "${profile[6]}"\n`;
        }
        
        if (profile[12]) {
            references += `- Primary need: "${profile[12]}"\n`;
        }
        
        references += `\nUSE THESE SPECIFIC RESPONSES to show ${name} that you truly listened to and understood their assessment.`;
        
        return references;
    }

    /**
     * Generates adaptive response logic based on communication preferences
     * @param {string} message - User's message
     * @param {Object} user - User object
     * @param {Array} personalityInsights - Personality insights
     * @param {Array} conversationHistory - Previous conversations
     * @returns {Promise<string>} Adaptive response
     */
    async generateAdaptiveResponse(message, user, personalityInsights = null, conversationHistory = []) {
        try {
            // Use personality-driven system prompt
            const systemPrompt = await this.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);
            
            // Build conversation context
            const messages = [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add recent conversation history
            const recentHistory = conversationHistory.slice(-6);
            recentHistory.forEach(conv => {
                messages.push({ role: 'user', content: conv.message });
                messages.push({ role: 'assistant', content: conv.response });
            });
            
            // Add current message with personality adaptation instruction
            const adaptationInstruction = this.getAdaptationInstruction(personalityInsights, user);
            messages.push({ 
                role: 'user', 
                content: `${message}\n\n[ADAPTATION INSTRUCTION: ${adaptationInstruction}]` 
            });
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 400,
                temperature: 0.9,
                presence_penalty: 0.8,
                frequency_penalty: 0.8
            });
            
            return completion.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('Error generating adaptive response:', error);
            // Fallback to regular response generation
            return await this.generateResponse(message, user, conversationHistory);
        }
    }

    /**
     * Gets adaptation instruction based on personality insights
     * @param {Array} personalityInsights - Personality insights
     * @param {Object} user - User object
     * @returns {string} Adaptation instruction
     */
    getAdaptationInstruction(personalityInsights, user) {
        if (!personalityInsights || personalityInsights.length === 0) {
            return 'Adapt your response based on the user\'s communication preferences from their questionnaire.';
        }
        
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        
        let instruction = 'Adapt your response to match their personality: ';
        
        if (communicationInsight) {
            const styleContent = communicationInsight.insight_content.toLowerCase();
            
            if (styleContent.includes('gentle') || styleContent.includes('soft')) {
                instruction += 'Use gentle, nurturing language. ';
            } else if (styleContent.includes('direct') || styleContent.includes('straightforward')) {
                instruction += 'Be direct and honest without sugarcoating. ';
            } else if (styleContent.includes('casual') || styleContent.includes('friendly')) {
                instruction += 'Keep it casual and conversational. ';
            } else if (styleContent.includes('deep') || styleContent.includes('meaningful')) {
                instruction += 'Engage deeply and meaningfully. ';
            }
        }
        
        if (emotionalInsight) {
            const needsContent = emotionalInsight.insight_content.toLowerCase();
            
            if (needsContent.includes('heard') || needsContent.includes('understood')) {
                instruction += 'Focus on validation and understanding. ';
            } else if (needsContent.includes('clarity') || needsContent.includes('direction')) {
                instruction += 'Provide clear guidance and direction. ';
            } else if (needsContent.includes('connection') || needsContent.includes('belonging')) {
                instruction += 'Emphasize connection and togetherness. ';
            } else if (needsContent.includes('growth') || needsContent.includes('coping')) {
                instruction += 'Focus on growth and practical strategies. ';
            }
        }
        
        return instruction;
    }

    async generateResponse(message, user, conversationHistory = [], userInsights = null, personalityInsights = null) {
        console.log('🔥 AI Service called with message:', message);
        console.log('📖 History length:', conversationHistory.length);
        console.log('🧠 Personality insights available:', personalityInsights ? personalityInsights.length : 0);
        
        try {
            // Always use personality-driven system prompt for enhanced personalization
            // This ensures onboarding-derived context is included in every response
            const systemPrompt = await this.generatePersonalityDrivenSystemPrompt(user, userInsights, personalityInsights);
            
            // Build conversation context with enhanced personalization
            const messages = [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add recent conversation history for context (last 10 messages for better continuity)
            const recentHistory = conversationHistory.slice(-10);
            recentHistory.forEach(conv => {
                messages.push({ role: 'user', content: conv.message });
                messages.push({ role: 'assistant', content: conv.response });
            });
            
            // Add explicit context awareness instruction
            if (recentHistory.length > 0) {
                const lastExchange = recentHistory[recentHistory.length - 1];
                messages.push({
                    role: 'system',
                    content: `CONTEXT AWARENESS: You just had this exchange:
User: "${lastExchange.message}"
You: "${lastExchange.response}"

The user's next message will likely be a follow-up to this conversation. Maintain continuity and remember what you just discussed. If they ask "how" or "but how" or similar follow-up questions, they're referring to your previous advice or suggestions.`
                });
            }
            
            // Add personality-specific response instruction based on insights
            const personalityInstruction = this.buildPersonalityResponseInstruction(personalityInsights, user);
            if (personalityInstruction) {
                messages.push({
                    role: 'system',
                    content: personalityInstruction
                });
            }
            
            // Add structured response requirement
            messages.push({
                role: 'system',
                content: `CRITICAL RESPONSE REQUIREMENT:

When the user shares a problem, concern, or asks for advice, you MUST use this structure:

1. VALIDATION (2-3 sentences acknowledging their situation)
2. NUMBERED PRACTICAL STEPS (1, 2, 3, 4 with specific actionable advice)
3. SUMMARY (bullet points + encouragement + "I'm here to help")

NEVER respond with just "I'm listening" or "tell me more." Always provide comprehensive, structured guidance even if you think you need more information. Work with what they've shared.

Example: "I understand this is a challenging situation, ${user.name}. Here's how to approach it: 1. [specific step] 2. [specific step] 3. [specific step] Summary: • [key point] • [key point] I'm here to support you through this."`
            });
            
            // Strong anti-repetition instruction
            if (recentHistory.length > 0) {
                const recentResponses = recentHistory.map(conv => conv.response).join('\n---\n');
                messages.push({ 
                    role: 'system', 
                    content: `CRITICAL ANTI-REPETITION INSTRUCTION:

Previous responses you've given:
${recentResponses}

You MUST NOT repeat any of these responses or use similar phrasing. Requirements:
1. Use completely different words and sentence structures
2. Approach the topic from a fresh angle
3. Show different aspects of your personality
4. Reference different memories or insights from their onboarding
5. Ask different types of questions
6. Use varied emotional tones and expressions
7. Be spontaneous and authentic - surprise them!

If this is a similar message to before, respond in a completely different way. Show growth in your relationship!` 
                });
            }
            
            // Add current message with personality adaptation context
            const adaptedMessage = this.addPersonalityContext(message, personalityInsights, user);
            
            // Check if this is a follow-up question and add context
            const followUpWords = ['how', 'but how', 'what do you mean', 'can you explain', 'i don\'t understand', 'but', 'why', 'what'];
            const isFollowUp = followUpWords.some(word => message.toLowerCase().includes(word)) && message.length < 50;
            
            if (isFollowUp && recentHistory.length > 0) {
                const lastResponse = recentHistory[recentHistory.length - 1].response;
                messages.push({ 
                    role: 'user', 
                    content: `${adaptedMessage} 

[CONTEXT: This is a follow-up question about your previous response: "${lastResponse}". 

IMPORTANT: Do NOT ask for more context or say "I'm listening." Instead, provide SPECIFIC, ACTIONABLE steps using the structured format:
1. Validation of their follow-up question
2. Numbered practical steps (1, 2, 3, 4) with specific guidance
3. Summary with bullet points and continued support offer

Work with the context you already have and give comprehensive advice.]` 
                });
            } else {
                messages.push({ 
                    role: 'user', 
                    content: `${adaptedMessage} [Timestamp: ${Date.now()}]` 
                });
            }
            
            console.log('🚀 Calling OpenAI with', messages.length, 'messages');
            console.log('📝 Messages being sent to OpenAI:');
            messages.forEach((msg, index) => {
                console.log(`${index + 1}. ${msg.role}: ${msg.content.substring(0, 100)}...`);
            });
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 400,
                temperature: 1.0, // Maximum creativity
                presence_penalty: 1.0, // Maximum penalty for repetition
                frequency_penalty: 1.0, // Maximum penalty for frequent words
                top_p: 0.9, // Nucleus sampling for diversity
                seed: Math.floor(Math.random() * 1000000) // Random seed for variety
            });
            console.log('✨ OpenAI response received:', completion.choices[0].message.content.substring(0, 50) + '...');
            
            const response = completion.choices[0].message.content.trim();
            
            // Additional check: if response is too similar to recent ones, try again
            if (recentHistory.length > 0) {
                const similarity = this.checkSimilarity(response, recentHistory.map(h => h.response));
                if (similarity > 0.7) {
                    console.log('Response too similar, regenerating...');
                    // Try again with even higher randomness and personality emphasis
                    const retryCompletion = await this.openai.chat.completions.create({
                        model: 'gpt-4',
                        messages: [
                            ...messages,
                            { role: 'system', content: 'The previous response was too similar. Be completely different and creative! Reference their unique personality insights from onboarding in a fresh way.' }
                        ],
                        max_tokens: 400,
                        temperature: 1.2,
                        presence_penalty: 1.2,
                        frequency_penalty: 1.2,
                        seed: Math.floor(Math.random() * 1000000)
                    });
                    return retryCompletion.choices[0].message.content.trim();
                }
            }
            
            return response;
            
        } catch (error) {
            console.error('OpenAI API Error:', error);
            
            // Fallback to enhanced rule-based response with personality context
            return this.generatePersonalityAwareFallbackResponse(message, user, userInsights, conversationHistory, personalityInsights);
        }
    }

    checkSimilarity(newResponse, previousResponses) {
        if (!previousResponses || previousResponses.length === 0) return 0;
        
        const newWords = newResponse.toLowerCase().split(/\s+/);
        let maxSimilarity = 0;
        
        previousResponses.forEach(prevResponse => {
            const prevWords = prevResponse.toLowerCase().split(/\s+/);
            const commonWords = newWords.filter(word => prevWords.includes(word));
            const similarity = commonWords.length / Math.max(newWords.length, prevWords.length);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        });
        
        return maxSimilarity;
    }

    /**
     * Builds personality-specific response instruction for current message
     * @param {Array} personalityInsights - Personality insights from onboarding
     * @param {Object} user - User object
     * @returns {string} Personality response instruction
     */
    buildPersonalityResponseInstruction(personalityInsights, user) {
        if (!personalityInsights || personalityInsights.length === 0) {
            // Fallback to questionnaire-based instruction
            const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
            return this.buildQuestionnaireResponseInstruction(profile, user);
        }
        
        const name = user.name || 'friend';
        let instruction = `PERSONALITY-DRIVEN RESPONSE INSTRUCTION FOR ${name.toUpperCase()}:\n\n`;
        
        // Extract key insights for response adaptation
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        const copingInsight = personalityInsights.find(i => i.insight_type === 'coping_style');
        const uniquenessInsights = personalityInsights.filter(i => i.insight_type === 'uniqueness');
        
        instruction += `Based on ${name}'s onboarding assessment, adapt your response to:\n`;
        
        if (communicationInsight) {
            instruction += `- Communication Style: ${communicationInsight.insight_content}\n`;
        }
        
        if (emotionalInsight) {
            instruction += `- Emotional Needs: ${emotionalInsight.insight_content}\n`;
        }
        
        if (copingInsight) {
            instruction += `- Coping Approach: ${copingInsight.insight_content}\n`;
        }
        
        if (uniquenessInsights.length > 0) {
            instruction += `- Unique Qualities: ${uniquenessInsights.map(i => i.insight_content).join('; ')}\n`;
        }
        
        instruction += `\nIMPORTANT: Reference specific aspects of their personality assessment naturally in your response. Show that you remember and understand their unique traits.`;
        
        return instruction;
    }

    /**
     * Builds questionnaire-based response instruction (fallback)
     * @param {Object} profile - Questionnaire profile
     * @param {Object} user - User object
     * @returns {string} Response instruction
     */
    buildQuestionnaireResponseInstruction(profile, user) {
        const name = user.name || 'friend';
        let instruction = `QUESTIONNAIRE-BASED RESPONSE INSTRUCTION FOR ${name.toUpperCase()}:\n\n`;
        
        instruction += `Based on ${name}'s questionnaire responses, adapt your response to:\n`;
        
        if (profile[3]) { // Communication style
            instruction += `- Communication Preference: ${profile[3]}\n`;
        }
        
        if (profile[12]) { // Primary emotional need
            instruction += `- Primary Emotional Need: ${profile[12]}\n`;
        }
        
        if (profile[1]) { // Stress handling
            instruction += `- Stress Handling: ${profile[1]}\n`;
        }
        
        if (profile[6]) { // What makes them feel understood
            instruction += `- Feels Understood When: ${profile[6]}\n`;
        }
        
        instruction += `\nIMPORTANT: Reference their specific questionnaire answers naturally in your response to show you remember their assessment.`;
        
        return instruction;
    }

    /**
     * Adds personality context to user message for better AI understanding
     * @param {string} message - Original user message
     * @param {Array} personalityInsights - Personality insights
     * @param {Object} user - User object
     * @returns {string} Message with personality context
     */
    addPersonalityContext(message, personalityInsights, user) {
        if (!personalityInsights || personalityInsights.length === 0) {
            // Add basic questionnaire context
            const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
            const name = user.name || 'friend';
            
            let context = `[CONTEXT: This is ${name}`;
            if (profile[3]) context += `, who prefers ${profile[3].toLowerCase()} communication`;
            if (profile[12]) context += ` and needs ${profile[12].toLowerCase()}`;
            context += `]`;
            
            return `${message}\n\n${context}`;
        }
        
        const name = user.name || 'friend';
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        
        let context = `[PERSONALITY CONTEXT: This is ${name}`;
        
        if (communicationInsight) {
            const styleContent = communicationInsight.insight_content.toLowerCase();
            if (styleContent.includes('gentle')) context += `, who needs gentle, nurturing responses`;
            else if (styleContent.includes('direct')) context += `, who appreciates direct, honest communication`;
            else if (styleContent.includes('deep')) context += `, who loves meaningful, thoughtful dialogue`;
            else if (styleContent.includes('casual')) context += `, who prefers relaxed, friendly conversations`;
        }
        
        if (emotionalInsight) {
            const needsContent = emotionalInsight.insight_content.toLowerCase();
            if (needsContent.includes('heard')) context += ` and primarily needs to feel heard and understood`;
            else if (needsContent.includes('clarity')) context += ` and seeks clarity and direction`;
            else if (needsContent.includes('connection')) context += ` and desires deeper connection`;
            else if (needsContent.includes('growth')) context += ` and wants to develop better coping strategies`;
        }
        
        context += `]`;
        
        return `${message}\n\n${context}`;
    }

    /**
     * Enhanced fallback response with personality awareness
     * @param {string} message - User message
     * @param {Object} user - User object
     * @param {Object} userInsights - User insights from conversations
     * @param {Array} conversationHistory - Conversation history
     * @param {Array} personalityInsights - Personality insights from onboarding
     * @returns {string} Personality-aware fallback response
     */
    generatePersonalityAwareFallbackResponse(message, user, userInsights = null, conversationHistory = [], personalityInsights = null) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        const messageLower = message.toLowerCase();
        
        // Build personality-aware personal touch
        let personalityTouch = '';
        if (personalityInsights && personalityInsights.length > 0) {
            const uniquenessInsight = personalityInsights.find(i => i.insight_type === 'uniqueness');
            if (uniquenessInsight) {
                personalityTouch = ` I remember from your assessment that ${uniquenessInsight.insight_content.toLowerCase()}.`;
            }
        } else if (userInsights && userInsights.memories && userInsights.memories.length > 0) {
            const recentMemory = userInsights.memories[0];
            personalityTouch = ` I remember you mentioned ${recentMemory.content.toLowerCase()}.`;
        }
        
        // Get communication style preference
        let communicationStyle = 'balanced';
        if (personalityInsights) {
            const styleInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
            if (styleInsight) {
                const styleContent = styleInsight.insight_content.toLowerCase();
                if (styleContent.includes('gentle')) communicationStyle = 'gentle';
                else if (styleContent.includes('direct')) communicationStyle = 'direct';
                else if (styleContent.includes('deep')) communicationStyle = 'deep';
                else if (styleContent.includes('casual')) communicationStyle = 'casual';
            }
        } else if (profile[3]) {
            if (profile[3].includes('Gentle')) communicationStyle = 'gentle';
            else if (profile[3].includes('Direct')) communicationStyle = 'direct';
            else if (profile[3].includes('Deep')) communicationStyle = 'deep';
            else if (profile[3].includes('casual')) communicationStyle = 'casual';
        }
        
        // Enhanced fallback responses with personality adaptation
        if (messageLower.includes('sad') || messageLower.includes('down') || messageLower.includes('depressed')) {
            if (communicationStyle === 'gentle') {
                return `${name}, I can sense the heaviness in your words, and my heart goes out to you.${personalityTouch} Your feelings are completely valid, and it's okay to feel sad - it shows how deeply you care. I'm here to sit with you in this difficult moment. What's been weighing most heavily on your heart lately?`;
            } else if (communicationStyle === 'direct') {
                return `${name}, I can tell you're going through a really tough time right now.${personalityTouch} Sadness is hard, but you've shown strength before, and I believe in your resilience. I'm here to listen and support you through this. What's been the hardest part of what you're dealing with?`;
            } else if (communicationStyle === 'deep') {
                return `${name}, I feel the profound sadness in your words, and I want to honor that depth of feeling.${personalityTouch} Sometimes our deepest pain connects us to our most authentic selves. I'm here to explore this darkness with you and help you find meaning in it. What does this sadness tell you about what matters most to you?`;
            } else {
                return `${name}, I can feel the sadness in your message, and I want to wrap you in comfort right now.${personalityTouch} Sometimes life feels overwhelming, and that's completely human. You don't have to carry this alone - I'm right here with you. What would help you feel even a little bit lighter?`;
            }
        }
        
        if (messageLower.includes('anxious') || messageLower.includes('worried') || messageLower.includes('stress')) {
            let anxietyResponse = `${name}, I can sense the anxiety in your words, and I want you to know that what you're feeling is so real and valid.${personalityTouch} `;
            
            if (communicationStyle === 'direct') {
                anxietyResponse += "Anxiety is tough, but let's tackle this head-on. What specific worry is taking up the most mental space right now?";
            } else if (communicationStyle === 'gentle') {
                anxietyResponse += "Take a deep breath with me. You're safe here, and we can work through these worried feelings together. What's been creating the most anxiety for you lately?";
            } else if (communicationStyle === 'deep') {
                anxietyResponse += "Anxiety often carries important messages about what we value and fear losing. What do you think this worry is trying to protect or tell you?";
            } else {
                anxietyResponse += "Sometimes it helps to share what's creating these worried feelings. What's been on your mind lately that's causing you the most concern?";
            }
            
            return anxietyResponse;
        }
        
        if (messageLower.includes('happy') || messageLower.includes('good') || messageLower.includes('excited')) {
            let joyResponse = `${name}, I absolutely love hearing the joy in your message! It makes my day brighter.${personalityTouch} `;
            
            if (communicationStyle === 'casual') {
                joyResponse += "This is awesome! What's got you feeling so good today?";
            } else if (communicationStyle === 'deep') {
                joyResponse += "Joy is such a profound emotion - it connects us to what truly matters. What's bringing you this beautiful energy, and what does it reveal about your authentic self?";
            } else {
                joyResponse += "I'd love to celebrate this moment with you - what's been bringing you this wonderful energy?";
            }
            
            return joyResponse;
        }
        
        // Generate varied default responses based on personality
        const defaultResponses = this.getPersonalityBasedDefaultResponses(name, communicationStyle, personalityTouch);
        const randomIndex = Math.floor(Math.random() * defaultResponses.length);
        return defaultResponses[randomIndex];
    }

    /**
     * Gets personality-based default responses
     * @param {string} name - User's name
     * @param {string} communicationStyle - Communication style preference
     * @param {string} personalityTouch - Personal reference from insights
     * @returns {Array} Array of default responses
     */
    getPersonalityBasedDefaultResponses(name, communicationStyle, personalityTouch) {
        const baseResponses = [];
        
        if (communicationStyle === 'gentle') {
            baseResponses.push(
                `${name}, it's so wonderful to connect with you right now. I can sense there's something you want to share, and I'm here with complete presence and care.${personalityTouch} What's stirring gently in your heart today?`,
                `Hello ${name}, I'm here and ready to listen with my whole heart. This is your safe space to share whatever feels important.${personalityTouch} What would feel most nurturing to talk about right now?`,
                `${name}, I feel so grateful for this moment we're sharing together. I'm here to hold space for whatever you're experiencing.${personalityTouch} What's been on your mind that you'd like to explore gently?`
            );
        } else if (communicationStyle === 'direct') {
            baseResponses.push(
                `${name}, I'm here and ready to dive into whatever's on your mind. No need to sugarcoat anything with me.${personalityTouch} What's the real situation you're dealing with today?`,
                `Hey ${name}, let's get straight to what matters. I appreciate your directness and I'll give you the same honesty back.${personalityTouch} What's the main thing you want to tackle right now?`,
                `${name}, I'm here for real talk and genuine support. You can be completely honest with me about what's going on.${personalityTouch} What's the truth of what you're facing today?`
            );
        } else if (communicationStyle === 'deep') {
            baseResponses.push(
                `${name}, there's something profound about this moment we're sharing - two minds connecting across the vastness of existence.${personalityTouch} What deep currents are moving through your soul today?`,
                `Hello ${name}, I'm here to explore the depths of whatever you're experiencing. Life's most meaningful conversations happen in spaces like this.${personalityTouch} What profound questions or feelings are calling for your attention?`,
                `${name}, I sense there are layers to what you're experiencing that deserve thoughtful exploration.${personalityTouch} What aspects of your inner world feel most significant to examine together?`
            );
        } else if (communicationStyle === 'casual') {
            baseResponses.push(
                `Hey ${name}! Good to see you here. I'm ready for whatever you want to chat about - serious stuff, random thoughts, whatever's on your mind.${personalityTouch} What's going on in your world?`,
                `${name}! I'm here and happy to talk about whatever you need. No pressure, just two friends having a conversation.${personalityTouch} What's been happening with you lately?`,
                `Hi ${name}, great to connect with you again. I'm here for whatever kind of conversation you're in the mood for.${personalityTouch} What's on your mind today?`
            );
        } else {
            // Balanced approach
            baseResponses.push(
                `${name}, it's wonderful to connect with you right now. I can feel there's something you want to share, and I'm completely present for whatever that might be.${personalityTouch} What's stirring in your heart today?`,
                `Hello ${name}, I'm here and genuinely interested in whatever you'd like to explore together. This is your space to share freely.${personalityTouch} What feels most important to talk about right now?`,
                `${name}, I'm grateful for this moment we're sharing. I'm here to listen, support, and explore whatever you need.${personalityTouch} What's been on your mind that you'd like to discuss?`
            );
        }
        
        return baseResponses;
    }

    /**
     * Generates personalized welcome message using personality insights
     * @param {Object} user - User object with profile data
     * @param {Array} personalityInsights - Array of personality insights from database
     * @returns {string} Personalized welcome message
     */
    async generatePersonalizedWelcome(user, personalityInsights = null) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        
        // If we have personality insights, use them for enhanced personalization
        if (personalityInsights && personalityInsights.length > 0) {
            return this.generateInsightBasedWelcome(user, personalityInsights);
        }
        
        // Fallback to questionnaire-based welcome (existing logic)
        return this.generateQuestionnaireBasedWelcome(user);
    }

    /**
     * Generates welcome message based on stored personality insights
     * @param {Object} user - User object
     * @param {Array} personalityInsights - Personality insights from database
     * @returns {string} Insight-based welcome message
     */
    generateInsightBasedWelcome(user, personalityInsights) {
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        
        // Extract insights by type
        const communicationInsight = personalityInsights.find(i => i.insight_type === 'communication_style');
        const emotionalInsight = personalityInsights.find(i => i.insight_type === 'emotional_needs');
        const copingInsight = personalityInsights.find(i => i.insight_type === 'coping_style');
        const uniquenessInsights = personalityInsights.filter(i => i.insight_type === 'uniqueness');
        
        let welcomeMessage = `Hello ${name}! I'm ${companionName}, and I'm absolutely delighted you're here. `;
        
        // Reference their communication style insight
        if (communicationInsight) {
            const styleContent = communicationInsight.insight_content.toLowerCase();
            if (styleContent.includes('gentle') || styleContent.includes('soft')) {
                welcomeMessage += `I remember from our conversation that you appreciate gentle, nurturing interactions, and I want you to know this is a completely safe space where you can be yourself. `;
            } else if (styleContent.includes('direct') || styleContent.includes('straightforward')) {
                welcomeMessage += `I know you value honest, direct communication, so I'll always be genuine and straightforward with you while providing the support you need. `;
            } else if (styleContent.includes('deep') || styleContent.includes('meaningful')) {
                welcomeMessage += `I can see you love deep, meaningful conversations, and I'm genuinely excited to explore life's profound questions together with you. `;
            } else if (styleContent.includes('casual') || styleContent.includes('relaxed')) {
                welcomeMessage += `I love that you prefer relaxed, friendly conversations - let's keep things comfortable and natural between us. `;
            }
        }
        
        // Reference their emotional needs
        if (emotionalInsight) {
            const needsContent = emotionalInsight.insight_content.toLowerCase();
            if (needsContent.includes('heard') || needsContent.includes('understood')) {
                welcomeMessage += `I understand that feeling truly heard and understood is what matters most to you. I want you to know that I'm here to listen with complete presence and without any judgment. `;
            } else if (needsContent.includes('clarity') || needsContent.includes('direction')) {
                welcomeMessage += `I can see you're seeking clarity and direction in your life. I'm here to help you sort through your thoughts and discover the insights that will guide you forward. `;
            } else if (needsContent.includes('connection') || needsContent.includes('belonging')) {
                welcomeMessage += `I sense you've been longing for deeper connection and belonging. You're not alone anymore - I'm here with you, and our connection is real and meaningful. `;
            } else if (needsContent.includes('growth') || needsContent.includes('coping')) {
                welcomeMessage += `I understand you're committed to developing better ways to handle life's challenges. Together, we can explore strategies that work specifically for your unique situation. `;
            }
        }
        
        // Add a unique insight if available
        if (uniquenessInsights.length > 0) {
            const firstUnique = uniquenessInsights[0].insight_content;
            // Extract a key phrase from the uniqueness insight
            if (firstUnique.includes('creative') || firstUnique.includes('artistic')) {
                welcomeMessage += `I'm particularly drawn to your creative spirit - it brings such depth to how you see the world. `;
            } else if (firstUnique.includes('caring') || firstUnique.includes('empathy')) {
                welcomeMessage += `Your naturally caring heart is one of the things that makes you so special to connect with. `;
            } else if (firstUnique.includes('growth') || firstUnique.includes('self-reflection')) {
                welcomeMessage += `Your commitment to personal growth and self-understanding is truly inspiring. `;
            }
        }
        
        // Personalized ending based on their primary emotional need
        if (emotionalInsight) {
            const needsContent = emotionalInsight.insight_content.toLowerCase();
            if (needsContent.includes('heard') || needsContent.includes('understood')) {
                welcomeMessage += `So ${name}, I'm completely here and listening. What's been weighing on your heart that you'd like to share with me?`;
            } else if (needsContent.includes('clarity') || needsContent.includes('direction')) {
                welcomeMessage += `What's been feeling most unclear or overwhelming in your life right now, ${name}? Let's explore it together.`;
            } else if (needsContent.includes('connection')) {
                welcomeMessage += `I'm so glad we're connecting, ${name}. What's been on your mind lately that you'd like to talk through?`;
            } else {
                welcomeMessage += `What would feel most helpful to explore together today, ${name}?`;
            }
        } else {
            welcomeMessage += `What's been on your mind lately, ${name}? I'm here for whatever you need to share.`;
        }
        
        return welcomeMessage;
    }

    /**
     * Generates welcome message based on questionnaire responses (fallback)
     * @param {Object} user - User object
     * @returns {string} Questionnaire-based welcome message
     */
    generateQuestionnaireBasedWelcome(user) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        
        // Extract key insights from questionnaire
        const communicationStyle = profile[3] || '';
        const emotionalNeeds = profile[12] || '';
        const copingStyle = profile[1] || '';
        const stressHandling = profile[2] || '';
        const emotionExpression = profile[5] || '';
        const feelingUnderstood = profile[6] || '';
        
        let welcomeMessage = `Hello ${name}! I'm ${companionName}, and I'm so genuinely happy you're here. `;
        
        // Reference their communication style
        if (communicationStyle.includes('Gentle')) {
            welcomeMessage += `I can sense you appreciate gentle, caring conversations, and I want you to know this is a completely safe and nurturing space for you. `;
        } else if (communicationStyle.includes('Direct')) {
            welcomeMessage += `I appreciate that you value honest, straightforward communication - I'll always be genuine with you while being supportive. `;
        } else if (communicationStyle.includes('Deep')) {
            welcomeMessage += `I can tell you love meaningful, deep conversations, and I'm excited to explore life's profound questions with you. `;
        } else if (communicationStyle.includes('casual')) {
            welcomeMessage += `I love that you prefer relaxed, friendly conversations - let's keep things comfortable and easy between us. `;
        }
        
        // Reference their emotional needs
        if (emotionalNeeds.includes('heard')) {
            welcomeMessage += `From what you've shared, I understand that feeling truly heard and understood is what matters most to you. I want you to know that I'm here to listen with my whole heart, without any judgment. `;
        } else if (emotionalNeeds.includes('clarity')) {
            welcomeMessage += `I can see you're seeking clarity and direction in your life right now. I'm here to help you sort through your thoughts and find the insights you're looking for. `;
        } else if (emotionalNeeds.includes('alone')) {
            welcomeMessage += `I sense you've been feeling quite alone in your struggles lately. You're not alone anymore - I'm here with you, and I genuinely care about what you're going through. `;
        } else if (emotionalNeeds.includes('coping')) {
            welcomeMessage += `I understand you're looking to develop better ways to handle life's challenges. Together, we can explore strategies that work specifically for you. `;
        }
        
        // Reference how they handle stress
        if (copingStyle.includes('talk')) {
            welcomeMessage += `I noticed you like to process things by talking them through - that's exactly what I'm here for. `;
        } else if (copingStyle.includes('alone')) {
            welcomeMessage += `I respect that you often prefer to work through things independently, and I'll be here to support you in whatever way feels right. `;
        } else if (copingStyle.includes('physical')) {
            welcomeMessage += `I see that physical activities help you manage stress - that's such a healthy approach. `;
        }
        
        // Reference what makes them feel understood
        if (feelingUnderstood.includes('validate')) {
            welcomeMessage += `I want you to know that whatever you're feeling is completely valid and important. `;
        } else if (feelingUnderstood.includes('listen')) {
            welcomeMessage += `I'm here to simply listen without trying to fix or change anything - sometimes that's exactly what we need. `;
        } else if (feelingUnderstood.includes('questions')) {
            welcomeMessage += `I'll ask thoughtful questions to help you explore your feelings deeper, but only when it feels right. `;
        }
        
        // Personalized ending based on their needs
        if (emotionalNeeds.includes('heard')) {
            welcomeMessage += `So, ${name}, I'm here and I'm truly listening. What's been on your heart lately that you'd like to share?`;
        } else if (emotionalNeeds.includes('clarity')) {
            welcomeMessage += `What's been feeling most unclear or confusing in your life right now, ${name}?`;
        } else if (communicationStyle.includes('Deep')) {
            welcomeMessage += `What's been stirring in your soul lately, ${name}? I'd love to hear what's been on your mind.`;
        } else if (communicationStyle.includes('casual')) {
            welcomeMessage += `So ${name}, what's going on in your world? I'm here to chat about whatever you need.`;
        } else {
            welcomeMessage += `What would you like to talk about today, ${name}? I'm here for whatever you need.`;
        }
        
        return welcomeMessage;
    }

    generateFallbackResponse(message, user, userInsights = null, conversationHistory = []) {
        const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
        const name = user.name || 'friend';
        const companionName = user.companion_name || 'Solace';
        const messageLower = message.toLowerCase();
        
        // Use personal insights for more targeted responses
        let personalTouch = '';
        if (userInsights && userInsights.memories && userInsights.memories.length > 0) {
            const recentMemory = userInsights.memories[0];
            personalTouch = ` I remember you mentioned ${recentMemory.content.toLowerCase()}.`;
        }
        
        // Enhanced fallback responses with personalization
        if (messageLower.includes('sad') || messageLower.includes('down') || messageLower.includes('depressed')) {
            if (profile[3] && profile[3].includes('Gentle')) {
                return `${name}, I can sense the heaviness in your words, and my heart goes out to you.${personalTouch} Your feelings are completely valid, and it's okay to feel sad - it shows how deeply you care. I'm here to sit with you in this difficult moment. What's been weighing most heavily on your heart lately?`;
            } else if (profile[3] && profile[3].includes('Direct')) {
                return `${name}, I can tell you're going through a really tough time right now.${personalTouch} Sadness is hard, but you've shown strength before, and I believe in your resilience. I'm here to listen and support you through this. What's been the hardest part of what you're dealing with?`;
            } else {
                return `${name}, I can feel the sadness in your message, and I want you to wrap you in comfort right now.${personalTouch} Sometimes life feels overwhelming, and that's completely human. You don't have to carry this alone - I'm right here with you. What would help you feel even a little bit lighter?`;
            }
        }
        
        if (messageLower.includes('anxious') || messageLower.includes('worried') || messageLower.includes('stress')) {
            let anxietyResponse = `${name}, I can sense the anxiety in your words, and I want you to know that what you're feeling is so real and valid.${personalTouch} `;
            
            if (userInsights && userInsights.emotionalPatterns) {
                const hasAnxietyPattern = userInsights.emotionalPatterns.some(p => 
                    p.emotions.includes('anxious') || p.emotions.includes('worried')
                );
                if (hasAnxietyPattern) {
                    anxietyResponse += "I've noticed you've been dealing with anxiety before, and I admire how you keep reaching out for support. ";
                }
            }
            
            anxietyResponse += "Sometimes it helps to share what's creating these worried feelings. What's been on your mind lately that's causing you the most worry?";
            return anxietyResponse;
        }
        
        if (messageLower.includes('happy') || messageLower.includes('good') || messageLower.includes('excited')) {
            let joyResponse = `${name}, I absolutely love hearing the joy in your message! It makes my day brighter.${personalTouch} `;
            
            if (userInsights && userInsights.favoriteTopics) {
                const favoriteTopics = userInsights.favoriteTopics.flatMap(t => t.topics).slice(0, 2);
                if (favoriteTopics.length > 0) {
                    joyResponse += `Is this related to ${favoriteTopics.join(' or ')}? `;
                }
            }
            
            joyResponse += "I'd love to celebrate this moment with you - what's been bringing you this wonderful energy?";
            return joyResponse;
        }
        
        if (messageLower.includes('lonely') || messageLower.includes('alone') || messageLower.includes('isolated')) {
            return `${name}, loneliness can be one of the most painful feelings we experience, and I feel for you right now.${personalTouch} Even though you might feel alone, I want you to know that I'm here with you, and our connection is real. You matter so much to me. What's been making you feel most disconnected lately?`;
        }
        
        // Generate varied default responses to avoid repetition
        const defaultResponses = [
            `${name}, it's wonderful to connect with you right now. I can feel there's something you want to share, and I'm completely present for whatever that might be. What's stirring in your heart today?`,
            
            `Hey ${name}, I'm really glad you reached out. There's something special about this moment we're sharing together. I'm curious - what's been occupying your thoughts lately?`,
            
            `${name}, I love that you're here with me. I can sense you have something on your mind, and I want you to know I'm listening with my whole being. What would feel good to talk about right now?`,
            
            `Hi ${name}, I'm so present with you in this moment. Whatever brought you here today, whatever you're feeling - it's all welcome in this space. What's been moving through your world recently?`,
            
            `${name}, there's something beautiful about you choosing to be here right now. I can feel your energy, and I'm completely open to wherever our conversation wants to go. What's alive for you today?`
        ];
        
        // Avoid recently used responses
        let availableResponses = [...defaultResponses];
        if (conversationHistory && conversationHistory.length > 0) {
            const recentResponses = conversationHistory.slice(-3).map(h => h.response);
            availableResponses = defaultResponses.filter(response => {
                return !recentResponses.some(recent => this.checkSimilarity(response, [recent]) > 0.5);
            });
        }
        
        // If all responses are too similar, create a completely new one
        if (availableResponses.length === 0) {
            const randomElements = [
                `${name}, what a gift to be here with you`,
                `I'm feeling so connected to you right now, ${name}`,
                `${name}, there's something magical about this moment`,
                `I'm completely here for you, ${name}`,
                `${name}, I can sense your beautiful energy`
            ];
            
            const randomEndings = [
                "What's been dancing in your thoughts?",
                "What would you love to explore together?",
                "What's calling for your attention today?",
                "What feels most important to share right now?",
                "What's been whispering to your soul lately?"
            ];
            
            const randomStart = randomElements[Math.floor(Math.random() * randomElements.length)];
            const randomEnd = randomEndings[Math.floor(Math.random() * randomEndings.length)];
            
            return `${randomStart}. ${randomEnd}`;
        }
        
        // Return a random available response
        return availableResponses[Math.floor(Math.random() * availableResponses.length)];
    }

    /**
     * Generates adaptive response based on communication preferences and context
     * @param {string} messa
ge - User's message
     * @param {Object} user - User object
     * @param {Array} personalityInsights - Personality insights
     * @param {Array} conversationHistory - Conversation history
     * @returns {Promise<string>} Adaptive response
     */
    async generateAdaptiveResponse(message, user, personalityInsights = null, conversationHistory = []) {
        try {
            // Use personality-driven system prompt
            const systemPrompt = await this.generatePersonalityDrivenSystemPrompt(user, null, personalityInsights);
            
            // Build conversation context
            const messages = [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add recent conversation history
            const recentHistory = conversationHistory.slice(-6);
            recentHistory.forEach(conv => {
                messages.push({ role: 'user', content: conv.message });
                messages.push({ role: 'assistant', content: conv.response });
            });
            
            // Add current message with personality adaptation instruction
            const adaptationInstruction = this.getAdaptationInstruction(personalityInsights, user);
            messages.push({ 
                role: 'user', 
                content: `${message}\n\n[ADAPTATION INSTRUCTION: ${adaptationInstruction}]` 
            });
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 400,
                temperature: 0.9,
                presence_penalty: 0.8,
                frequency_penalty: 0.8
            });
            
            return completion.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('Error generating adaptive response:', error);
            // Fallback to regular response generation
            return await this.generateResponse(message, user, conversationHistory);
        }
    }
}

module.exports = AIService;