// Psychological Questions Database
const psychologicalQuestions = [
    {
        id: 0,
        text: "What should we call you?",
        type: "text",
        placeholder: "Enter your preferred name..."
    },
    {
        id: 1,
        text: "How do you typically handle stress in your daily life?",
        type: "options",
        options: [
            "I talk to friends or family about it",
            "I prefer to work through it alone",
            "I use physical activities like exercise or walking",
            "I tend to avoid thinking about it"
        ]
    },
    {
        id: 2,
        text: "When you're feeling overwhelmed, what do you need most?",
        type: "options",
        options: [
            "Someone to listen without giving advice",
            "Practical solutions and actionable steps",
            "Reassurance that everything will be okay",
            "Space and time to process on my own"
        ]
    },
    {
        id: 3,
        text: "How do you prefer to communicate about personal matters?",
        type: "options",
        options: [
            "Direct and straightforward conversations",
            "Gentle, supportive discussions",
            "Light-hearted, casual chats",
            "Deep, meaningful exchanges"
        ]
    },
    {
        id: 4,
        text: "What time of day do you feel most emotionally vulnerable?",
        type: "options",
        options: [
            "Early morning when I wake up",
            "Late at night before sleep",
            "During busy afternoon hours",
            "It varies depending on circumstances"
        ]
    },
    {
        id: 5,
        text: "How do you typically express your emotions?",
        type: "options",
        options: [
            "I express them openly and immediately",
            "I need time to process before sharing",
            "I express through creative outlets or activities",
            "I tend to keep them private"
        ]
    },
    {
        id: 6,
        text: "What makes you feel most understood by others?",
        type: "options",
        options: [
            "When they validate my feelings",
            "When they share similar experiences",
            "When they ask thoughtful questions",
            "When they simply listen without judgment"
        ]
    },
    {
        id: 7,
        text: "How do you handle difficult emotions like sadness or anxiety?",
        type: "options",
        options: [
            "I face them head-on and work through them",
            "I seek comfort from others",
            "I distract myself with activities",
            "I give myself time and space to feel them"
        ]
    },
    {
        id: 8,
        text: "What kind of support helps you most during tough times?",
        type: "options",
        options: [
            "Emotional support and empathy",
            "Practical help and problem-solving",
            "Encouragement and motivation",
            "Just knowing someone cares"
        ]
    },
    {
        id: 9,
        text: "How comfortable are you sharing your deepest thoughts?",
        type: "options",
        options: [
            "Very comfortable - I'm an open book",
            "Comfortable with the right person",
            "Somewhat hesitant but willing",
            "I prefer to keep most thoughts private"
        ]
    },
    {
        id: 10,
        text: "What helps you feel most at peace?",
        type: "options",
        options: [
            "Quiet moments of solitude",
            "Meaningful conversations with others",
            "Being in nature or peaceful environments",
            "Engaging in activities I love"
        ]
    },
    {
        id: 11,
        text: "How do you prefer to receive feedback or advice?",
        type: "options",
        options: [
            "Gentle suggestions with lots of encouragement",
            "Direct, honest feedback even if it's hard to hear",
            "Questions that help me find my own answers",
            "Examples and stories from others' experiences"
        ]
    },
    {
        id: 12,
        text: "What's your biggest emotional need right now?",
        type: "options",
        options: [
            "To feel heard and understood",
            "To find clarity and direction",
            "To feel less alone in my struggles",
            "To develop better coping strategies"
        ]
    }
];

class JourneyApp {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.authToken = localStorage.getItem('solace_token');
        this.isAuthenticated = new URLSearchParams(window.location.search).get('authenticated') === 'true';
        this.isCompleting = false; // Flag to prevent multiple completions
        this.init();
    }

    init() {
        this.loadQuestion(0);
        this.bindEvents();
    }

    bindEvents() {
        // Chat functionality for final screen
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    loadQuestion(questionIndex) {
        const question = psychologicalQuestions[questionIndex];
        if (!question) return;

        const container = document.querySelector('.question-container');
        const existingCard = container.querySelector('.question-card.active');

        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        questionCard.dataset.question = questionIndex;

        let optionsHTML = '';
        if (question.type === 'text') {
            optionsHTML = `<input type="text" class="text-input" placeholder="${question.placeholder}" data-type="text">`;
        } else {
            optionsHTML = question.options.map((option, index) =>
                `<button class="option-btn" data-value="${option}" onclick="selectOption(this, ${questionIndex})">${option}</button>`
            ).join('');
            optionsHTML += `<input type="text" class="text-input" placeholder="Other (please specify)..." data-type="other" style="margin-top: 1rem;">`;
        }

        questionCard.innerHTML = `
            <h3 class="question-text">${question.text}</h3>
            <div class="question-options">
                ${optionsHTML}
            </div>
        `;

        container.appendChild(questionCard);

        setTimeout(() => {
            if (existingCard) {
                existingCard.classList.remove('active');
                existingCard.classList.add('prev');
                setTimeout(() => existingCard.remove(), 600);
            }
            questionCard.classList.add('active');
        }, 50);

        this.updateProgress();
        this.bindQuestionEvents(questionCard, questionIndex);
        this.updateNavigation();

        // Disable next button initially, will be enabled when user provides input
        if (!this.answers[questionIndex]) {
            this.disableNextButton();
        } else {
            this.enableNextButton();
        }
    }

    bindQuestionEvents(card, questionIndex) {
        const textInput = card.querySelector('[data-type="text"]');
        if (textInput) {
            textInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    this.answers[questionIndex] = value;
                    this.enableNextButton();
                } else {
                    delete this.answers[questionIndex];
                    this.disableNextButton();
                }
            });

            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    if (value) {
                        this.answers[questionIndex] = value;
                        setTimeout(() => {
                            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                                this.nextQuestion();
                            } else {
                                if (!this.isCompleting) {
                                    this.completeQuestionnaire();
                                }
                            }
                        }, 300);
                    }
                }
            });
        }

        const otherInput = card.querySelector('[data-type="other"]');
        if (otherInput) {
            otherInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    card.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
                    this.answers[questionIndex] = value;
                    this.enableNextButton();
                } else {
                    const selectedOption = card.querySelector('.option-btn.selected');
                    if (!selectedOption) {
                        delete this.answers[questionIndex];
                        this.disableNextButton();
                    }
                }
            });

            otherInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    if (value) {
                        this.answers[questionIndex] = value;
                        setTimeout(() => {
                            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                                this.nextQuestion();
                            } else {
                                if (!this.isCompleting) {
                                    this.completeQuestionnaire();
                                }
                            }
                        }, 300);
                    }
                }
            });
        }
    }

    selectOption(button, questionIndex) {
        const card = button.closest('.question-card');
        card.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));

        button.classList.add('selected');
        this.answers[questionIndex] = button.dataset.value;

        const otherInput = card.querySelector('[data-type="other"]');
        if (otherInput) otherInput.value = '';

        this.enableNextButton();

        setTimeout(() => {
            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                this.nextQuestion();
            } else {
                if (!this.isCompleting) {
                    this.completeQuestionnaire();
                }
            }
        }, 800);
    }

    updateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progress = ((this.currentQuestion + 1) / psychologicalQuestions.length) * 100;
        progressFill.style.width = `${progress}%`;
    }

    updateNavigation() {
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');

        if (this.currentQuestion === 0) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'block';
        }

        if (this.currentQuestion === psychologicalQuestions.length - 1) {
            nextBtn.textContent = 'Complete';
        } else {
            nextBtn.textContent = 'Continue';
        }
    }

    enableNextButton() {
        const nextBtn = document.querySelector('.next-btn');
        nextBtn.disabled = false;
    }

    disableNextButton() {
        const nextBtn = document.querySelector('.next-btn');
        nextBtn.disabled = true;
    }

    nextQuestion() {
        if (!this.answers[this.currentQuestion]) return;

        if (this.currentQuestion < psychologicalQuestions.length - 1) {
            this.currentQuestion++;
            this.loadQuestion(this.currentQuestion);
            this.disableNextButton();
        } else {
            if (!this.isCompleting) {
                this.completeQuestionnaire();
            }
        }
    }

    previousQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.loadQuestion(this.currentQuestion);
            if (this.answers[this.currentQuestion]) {
                this.enableNextButton();
            }
        }
    }

    async completeQuestionnaire() {
        if (this.isCompleting) {
            console.log('⚠️ Already completing questionnaire, ignoring duplicate call');
            return;
        }
        
        this.isCompleting = true;
        console.log('🎯 Starting questionnaire completion...');
        this.transitionToLoadingScreen();

        try {
            if (this.isAuthenticated && this.authToken) {
                console.log('🔄 Saving onboarding data for authenticated user...');

                // Save to user account and get personality insights
                const response = await fetch('/api/onboarding', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: JSON.stringify({ answers: this.answers })
                });

                console.log('📡 Onboarding response status:', response.status);

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Onboarding completed successfully:', result);
                    this.personalityInsights = result.personalityInsights;

                    // Mark onboarding as complete in localStorage for immediate use
                    localStorage.setItem('onboarding_complete', 'true');

                    this.startLoadingSequence();
                } else {
                    const errorData = await response.json();
                    console.error('❌ Onboarding failed:', errorData);
                    throw new Error(errorData.error || 'Failed to save profile');
                }
            } else {
                console.log('👤 Guest mode - generating basic insights...');
                // Guest mode - generate basic personality insights and show loading
                this.personalityInsights = this.generateGuestPersonalityInsights();
                this.startLoadingSequence();
            }
        } catch (error) {
            console.error('❌ Error completing questionnaire:', error);

            // Show user-friendly error message
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.innerHTML = `
                <div class="loading-container" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">😔</div>
                    <h2 style="color: white; margin-bottom: 1rem;">Oops! Something went wrong</h2>
                    <p style="color: rgba(255,255,255,0.8); margin-bottom: 2rem;">We couldn't save your responses. Let's try again!</p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 25px;
                        font-size: 1rem;
                        cursor: pointer;
                        font-weight: 600;
                    ">Try Again</button>
                </div>
            `;
        }
    }

    transitionToLoadingScreen() {
        const questionScreen = document.getElementById('question-flow');
        questionScreen.style.opacity = '0';
        questionScreen.style.transform = 'translateX(-100px)';

        setTimeout(() => {
            questionScreen.classList.remove('active');

            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('active');
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transform = 'translateX(100px)';

            setTimeout(() => {
                loadingScreen.style.opacity = '1';
                loadingScreen.style.transform = 'translateX(0)';
            }, 50);
        }, 600);
    }

    startLoadingSequence() {
        console.log('🔄 Starting loading sequence...');
        const steps = document.querySelectorAll('.step');
        const progressFill = document.querySelector('.loading-progress-fill');
        let currentStep = 0;

        const animateStep = () => {
            if (currentStep > 0) {
                steps[currentStep - 1].classList.remove('active');
                steps[currentStep - 1].classList.add('completed');
            }

            if (currentStep < steps.length) {
                steps[currentStep].classList.add('active');
                if (progressFill) {
                    progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
                }
                currentStep++;

                setTimeout(animateStep, 1500);
            } else {
                console.log('✅ Loading sequence complete, transitioning to personality summary...');
                setTimeout(() => {
                    this.transitionToPersonalitySummary();
                }, 1000);
            }
        };

        setTimeout(animateStep, 800);
    }

    generateGuestPersonalityInsights() {
        // Generate basic personality insights for guest users based on their answers
        const insights = {
            communicationStyle: this.analyzeCommunicationStyle(),
            emotionalNeeds: this.analyzeEmotionalNeeds(),
            uniquenessFactors: this.analyzeUniquenessFactors()
        };

        return insights;
    }

    analyzeCommunicationStyle() {
        const communicationAnswer = this.answers[3] || '';

        if (communicationAnswer.includes('Gentle')) {
            return 'You prefer gentle, supportive conversations that feel safe and nurturing. You value kindness and empathy in communication.';
        } else if (communicationAnswer.includes('Direct')) {
            return 'You appreciate honest, straightforward communication. You value clarity and directness over sugar-coating.';
        } else if (communicationAnswer.includes('casual')) {
            return 'You enjoy relaxed, friendly conversations that feel natural and comfortable. You prefer a laid-back communication style.';
        } else if (communicationAnswer.includes('Deep')) {
            return 'You love meaningful, philosophical discussions that explore deeper topics. You value substance in conversations.';
        }

        return 'You have a balanced communication style that adapts to different situations and relationships.';
    }

    analyzeEmotionalNeeds() {
        const emotionalNeedsAnswer = this.answers[12] || '';

        if (emotionalNeedsAnswer.includes('heard')) {
            return 'Your greatest need is to feel truly heard and understood. You want someone who listens with genuine care and attention.';
        } else if (emotionalNeedsAnswer.includes('clarity')) {
            return 'You seek clarity and direction in your life. You want guidance that helps you make sense of your experiences and choices.';
        } else if (emotionalNeedsAnswer.includes('alone')) {
            return 'You need to feel less alone in your struggles. Connection and companionship are essential for your wellbeing.';
        } else if (emotionalNeedsAnswer.includes('coping')) {
            return 'You want to develop better strategies for handling life\'s challenges. Growth and resilience are important to you.';
        }

        return 'You value emotional support and understanding in your relationships and personal growth journey.';
    }

    analyzeUniquenessFactors() {
        const factors = [];

        // Analyze stress handling (question 1)
        const stressAnswer = this.answers[1] || '';
        if (stressAnswer.includes('talk to friends')) {
            factors.push('You have strong social connections and aren\'t afraid to reach out for support when you need it.');
        } else if (stressAnswer.includes('work through it alone')) {
            factors.push('You have impressive inner strength and self-reliance when facing challenges.');
        } else if (stressAnswer.includes('physical activities')) {
            factors.push('You understand the mind-body connection and use movement as a powerful tool for emotional regulation.');
        }

        // Analyze emotional expression (question 5)
        const expressionAnswer = this.answers[5] || '';
        if (expressionAnswer.includes('openly and immediately')) {
            factors.push('You have emotional authenticity and courage - you\'re not afraid to be vulnerable and real.');
        } else if (expressionAnswer.includes('time to process')) {
            factors.push('You have emotional wisdom and take time to understand your feelings before sharing them.');
        } else if (expressionAnswer.includes('creative outlets')) {
            factors.push('You have a creative soul and find beautiful ways to express your inner world.');
        }

        // Analyze what makes them feel understood (question 6)
        const understoodAnswer = this.answers[6] || '';
        if (understoodAnswer.includes('validate')) {
            factors.push('You have deep emotional intelligence and recognize the power of validation in relationships.');
        } else if (understoodAnswer.includes('similar experiences')) {
            factors.push('You find comfort in shared experiences and the knowledge that you\'re not alone in your journey.');
        } else if (understoodAnswer.includes('thoughtful questions')) {
            factors.push('You appreciate depth and curiosity in others - you value people who truly want to understand you.');
        }

        return factors.length > 0 ? factors : ['You have a unique perspective on life and relationships that makes you special.'];
    }

    transitionToPersonalitySummary() {
        console.log('🎯 Transitioning to personality summary...');
        const loadingScreen = document.getElementById('loading-screen');
        const personalityScreen = document.getElementById('personality-summary');
        
        console.log('📱 Loading screen found:', !!loadingScreen);
        console.log('📱 Personality screen found:', !!personalityScreen);
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transform = 'translateY(-50px)';
        }

        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.remove('active');
                console.log('✅ Loading screen hidden');
            }

            if (personalityScreen) {
                // Force show the personality screen
                personalityScreen.style.display = 'block';
                personalityScreen.classList.add('active');
                personalityScreen.style.opacity = '1';
                personalityScreen.style.transform = 'translateY(0)';
                personalityScreen.style.zIndex = '1000';
                
                console.log('✅ Personality screen should be visible now');
                console.log('📊 Screen classes:', personalityScreen.className);
                console.log('📊 Screen styles:', personalityScreen.style.cssText);
                
                this.displayPersonalityInsights();
            } else {
                console.error('❌ Personality screen not found! Skipping to chat...');
                this.showChatInterface();
            }
        }, 600);
    }

    displayPersonalityInsights() {
        console.log('🔍 Displaying personality insights:', this.personalityInsights);
        
        if (!this.personalityInsights) {
            console.error('❌ No personality insights available, generating fallback...');
            this.personalityInsights = this.generateGuestPersonalityInsights();
        }

        // Display communication style
        const communicationElement = document.getElementById('communication-insight');
        if (communicationElement && this.personalityInsights.communicationStyle) {
            communicationElement.textContent = this.personalityInsights.communicationStyle;
            console.log('✅ Communication insight set');
        } else if (communicationElement) {
            communicationElement.textContent = 'You have a thoughtful and caring communication style.';
            console.log('✅ Fallback communication insight set');
        } else {
            console.error('❌ Communication element not found');
        }
        
        // Add a timeout to skip to chat if personality screen doesn't work
        setTimeout(() => {
            console.log('⏰ Auto-advancing to chat after 5 seconds...');
            this.showChatInterface();
        }, 5000);

        // Display emotional needs
        const emotionalElement = document.getElementById('emotional-insight');
        if (emotionalElement && this.personalityInsights.emotionalNeeds) {
            emotionalElement.textContent = this.personalityInsights.emotionalNeeds;
        } else if (emotionalElement) {
            emotionalElement.textContent = 'You value deep connections and meaningful support in your relationships.';
        }

        // Display uniqueness factors
        const uniquenessContainer = document.getElementById('uniqueness-factors');
        if (uniquenessContainer && this.personalityInsights.uniquenessFactors) {
            uniquenessContainer.innerHTML = '';

            this.personalityInsights.uniquenessFactors.forEach((factor, index) => {
                const factorElement = document.createElement('div');
                factorElement.className = 'uniqueness-factor';
                factorElement.style.animationDelay = `${index * 0.2}s`;
                factorElement.innerHTML = `<p>${factor}</p>`;
                uniquenessContainer.appendChild(factorElement);
            });
        } else if (uniquenessContainer) {
            uniquenessContainer.innerHTML = '<div class="uniqueness-factor"><p>You have a unique perspective that makes you special and valuable.</p></div>';
        }
    }

    transitionToGrowthPath() {
        const personalityScreen = document.getElementById('personality-summary');
        personalityScreen.style.opacity = '0';
        personalityScreen.style.transform = 'translateX(-100px)';

        setTimeout(() => {
            personalityScreen.classList.remove('active');

            const growthScreen = document.getElementById('growth-path');
            growthScreen.classList.add('active');
            growthScreen.style.opacity = '0';
            growthScreen.style.transform = 'translateX(100px)';

            setTimeout(() => {
                growthScreen.style.opacity = '1';
                growthScreen.style.transform = 'translateX(0)';
                this.initializeGrowthPath();
            }, 50);
        }, 600);
    }

    initializeGrowthPath() {
        // Set current stage (always Stage 1 for new users)
        const currentStageElement = document.getElementById('current-stage');
        if (currentStageElement) {
            currentStageElement.textContent = 'Stage 1: Getting to Know Each Other';
        }

        // Set next milestone
        const milestoneElement = document.getElementById('next-milestone-text');
        if (milestoneElement) {
            milestoneElement.textContent = 'Complete your first conversation to earn your "First Steps" achievement and begin building trust.';
        }

        // Set progress (0% for new users)
        const progressElement = document.getElementById('milestone-progress');
        const progressTextElement = document.getElementById('progress-text');
        if (progressElement && progressTextElement) {
            progressElement.style.width = '0%';
            progressTextElement.textContent = '0% Complete';
        }
    }

    startFirstChat() {
        console.log('🚀 Starting first chat...');
        console.log('🔍 Auth status:', this.isAuthenticated, 'Token:', !!this.authToken);

        const growthScreen = document.getElementById('growth-path');
        growthScreen.style.opacity = '0';
        growthScreen.style.transform = 'translateY(-50px)';

        setTimeout(() => {
            growthScreen.classList.remove('active');

            // ALWAYS show the chat screen first, regardless of auth status
            const chatScreen = document.getElementById('chat');
            if (!chatScreen) {
                console.error('❌ Chat screen not found!');
                return;
            }

            console.log('✅ Showing chat screen...');
            chatScreen.classList.add('active');
            chatScreen.style.opacity = '0';
            chatScreen.style.transform = 'translateY(50px)';

            setTimeout(() => {
                chatScreen.style.opacity = '1';
                chatScreen.style.transform = 'translateY(0)';
                this.initializeChat();

                // If authenticated, save the onboarding completion in background
                if (this.isAuthenticated && this.authToken) {
                    console.log('💾 Saving onboarding completion in background...');
                    this.saveOnboardingInBackground();
                }
            }, 50);
        }, 600);
    }

    async saveOnboardingInBackground() {
        try {
            const response = await fetch('/api/onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ answers: this.answers })
            });

            if (response.ok) {
                console.log('✅ Onboarding saved successfully in background');
                localStorage.setItem('onboarding_complete', 'true');
            } else {
                console.log('⚠️ Onboarding save failed, but user can still chat');
            }
        } catch (error) {
            console.log('⚠️ Background save failed, but user can still chat:', error);
        }
    }

    startFirstChat() {
        console.log('🚀 Starting chat interface...');
        const growthScreen = document.getElementById('growth-path');

        if (growthScreen) {
            growthScreen.style.opacity = '0';
            growthScreen.style.transform = 'translateY(-50px)';

            setTimeout(() => {
                growthScreen.classList.remove('active');
                this.showChatInterface();
            }, 600);
        } else {
            // If no growth screen, go directly to chat
            this.showChatInterface();
        }
    }

    showChatInterface() {
        console.log('💬 Showing chat interface...');

        // ALWAYS show chat interface directly - no redirects!
        const chatScreen = document.getElementById('chat');
        if (chatScreen) {
            chatScreen.classList.add('active');
            chatScreen.style.opacity = '0';
            chatScreen.style.transform = 'translateY(50px)';

            setTimeout(() => {
                chatScreen.style.opacity = '1';
                chatScreen.style.transform = 'translateY(0)';
                this.initializeChat();
                console.log('✅ Chat interface loaded successfully!');
            }, 50);
        } else {
            console.error('❌ Chat screen element not found!');
        }
    }

    transitionToChat() {
        // This method is now called from startFirstChat for consistency
        this.startFirstChat();
    }

    initializeChat() {
        const name = this.answers[0] || 'friend';

        // Create hyper-personalized welcome message using personality insights
        let welcomeMessage = `Hello ${name}! I'm so genuinely happy you're here. `;

        // Reference their communication style from personality insights
        if (this.personalityInsights && this.personalityInsights.communicationStyle) {
            const communicationStyle = this.personalityInsights.communicationStyle;
            if (communicationStyle.includes('gentle')) {
                welcomeMessage += `I can sense you appreciate gentle, caring conversations, and I want you to know this is a completely safe space for you. `;
            } else if (communicationStyle.includes('honest') || communicationStyle.includes('direct')) {
                welcomeMessage += `I appreciate that you value honest, straightforward communication - I'll always be genuine with you. `;
            } else if (communicationStyle.includes('meaningful') || communicationStyle.includes('deep')) {
                welcomeMessage += `I can tell you love meaningful conversations, and I'm excited to explore what's on your mind. `;
            } else if (communicationStyle.includes('relaxed') || communicationStyle.includes('friendly')) {
                welcomeMessage += `I love that you prefer relaxed, friendly conversations - let's keep things comfortable between us. `;
            }
        }

        // Reference their emotional needs from personality insights
        if (this.personalityInsights && this.personalityInsights.emotionalNeeds) {
            const emotionalNeeds = this.personalityInsights.emotionalNeeds;
            if (emotionalNeeds.includes('heard')) {
                welcomeMessage += `I understand that feeling truly heard is what matters most to you. I'm here to listen with my whole heart. `;
            } else if (emotionalNeeds.includes('clarity') || emotionalNeeds.includes('direction')) {
                welcomeMessage += `I can see you're seeking clarity and direction. I'm here to help you sort through your thoughts. `;
            } else if (emotionalNeeds.includes('alone') || emotionalNeeds.includes('connection')) {
                welcomeMessage += `I sense you've been feeling alone in your struggles. You're not alone anymore - I'm here with you. `;
            } else if (emotionalNeeds.includes('coping') || emotionalNeeds.includes('strategies')) {
                welcomeMessage += `I can see you want to grow and develop better ways of handling life's challenges. I'm here to support that journey. `;
            }
        }

        // Add milestone celebration for first conversation
        welcomeMessage += `\n\n🎉 Congratulations! You've just earned your first milestone: "First Steps" - You've taken the brave step of starting your first conversation. This is often the hardest part, and you did it! `;

        // Personalized ending based on insights
        if (this.personalityInsights && this.personalityInsights.emotionalNeeds && this.personalityInsights.emotionalNeeds.includes('heard')) {
            welcomeMessage += `\n\nSo ${name}, I'm here and truly listening. What's been on your heart that you'd like to share?`;
        } else if (this.personalityInsights && this.personalityInsights.communicationStyle && this.personalityInsights.communicationStyle.includes('meaningful')) {
            welcomeMessage += `\n\nWhat's been stirring in your soul lately, ${name}?`;
        } else {
            welcomeMessage += `\n\nWhat would you like to talk about, ${name}? I'm here for whatever you need.`;
        }

        this.addCompanionMessage(welcomeMessage);
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        console.log('📤 Sending message:', message);
        this.addUserMessage(message);
        messageInput.value = '';

        this.showTypingIndicator();

        try {
            let response;

            if (this.isAuthenticated && this.authToken) {
                // Authenticated user - use full API
                response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: JSON.stringify({ message })
                });
            } else {
                // Guest user - use guest API
                response = await fetch('/api/guest-chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message,
                        guestProfile: {
                            name: this.answers[0] || 'friend',
                            answers: this.answers
                        }
                    })
                });
            }

            const result = await response.json();

            this.removeTypingIndicator();

            if (response.ok) {
                this.addCompanionMessage(result.response);
            } else {
                this.addCompanionMessage("I'm sorry, I'm having trouble connecting right now. Please try again.");
            }

        } catch (error) {
            console.error('💬 Chat error:', error);
            this.removeTypingIndicator();
            this.addCompanionMessage("I'm sorry, I'm having trouble connecting right now. Please try again.");
        }
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addCompanionMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message companion-message';
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message companion-message typing-indicator';
        typingDiv.innerHTML = `<div class="message-content">Thinking with care...</div>`;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        this.addUserMessage(message);
        messageInput.value = '';

        this.showTypingIndicator();

        try {
            // Use AI for guest mode too
            const response = await fetch('/api/guest-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    guestProfile: this.answers
                })
            });

            const result = await response.json();

            this.removeTypingIndicator();

            if (response.ok) {
                this.addCompanionMessage(result.response);
            } else {
                this.addCompanionMessage(this.generateGuestResponse(message));
            }

        } catch (error) {
            console.error('Guest chat error:', error);
            this.removeTypingIndicator();
            this.addCompanionMessage(this.generateGuestResponse(message));
        }
    }

    generateGuestResponse(message) {
        const messageLower = message.toLowerCase();
        const name = this.answers[0] || 'friend';

        if (messageLower.includes('sad') || messageLower.includes('down')) {
            return `${name}, I can hear the sadness in your words. That sounds really difficult. Would you like to share more about what's making you feel this way?`;
        }

        if (messageLower.includes('anxious') || messageLower.includes('worried')) {
            return `${name}, anxiety can feel so overwhelming. I'm here to listen. What's been weighing on your mind?`;
        }

        if (messageLower.includes('happy') || messageLower.includes('good')) {
            return `${name}, I love hearing the positivity in your message! What's been bringing you joy?`;
        }

        return `${name}, I'm here to listen to whatever you'd like to share. What's on your mind today?`;
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addCompanionMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message companion-message';
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message companion-message typing-indicator';
        typingDiv.innerHTML = `<div class="message-content">Typing...</div>`;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Global functions for HTML onclick events
function selectOption(button, questionIndex) {
    if (window.journeyApp) {
        window.journeyApp.selectOption(button, questionIndex);
    }
}

function nextQuestion() {
    if (window.journeyApp) {
        window.journeyApp.nextQuestion();
    }
}

function previousQuestion() {
    if (window.journeyApp) {
        window.journeyApp.previousQuestion();
    }
}

function continueToGrowthPath() {
    if (window.journeyApp) {
        window.journeyApp.transitionToGrowthPath();
    }
}

function startFirstChat() {
    if (window.journeyApp) {
        window.journeyApp.startFirstChat();
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 Journey app initializing...');
    window.journeyApp = new JourneyApp();
    console.log('✅ Journey app initialized!');
});