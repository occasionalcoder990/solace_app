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

class CompanionApp {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.userId = null;
        this.authToken = localStorage.getItem('solace_token');
        this.user = null;
        this.init();
    }
    
    async init() {
        // Always show homepage first for new visitors
        // Check if user is already authenticated in background
        if (this.authToken) {
            try {
                await this.loadUserProfile();
                if (this.user.onboardingComplete) {
                    this.showScreen('chat');
                    this.initializeChat();
                    return;
                } else {
                    this.showScreen('homepage');
                    return;
                }
            } catch (error) {
                // Token is invalid, clear it and show homepage
                localStorage.removeItem('solace_token');
                this.authToken = null;
            }
        }
        
        // Show homepage for new visitors
        this.showScreen('homepage');
        
        this.bindEvents();
        this.loadQuestion(0);
    }
    
    bindEvents() {
        // Chat functionality
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
        
        // Create new question card
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
        
        // Animate transition
        setTimeout(() => {
            if (existingCard) {
                existingCard.classList.remove('active');
                existingCard.classList.add('prev');
                setTimeout(() => existingCard.remove(), 600);
            }
            questionCard.classList.add('active');
        }, 50);
        
        // Update progress
        this.updateProgress();
        
        // Bind input events
        this.bindQuestionEvents(questionCard, questionIndex);
        
        // Update navigation
        this.updateNavigation();
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
            
            // Auto-advance on Enter key for text inputs
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    if (value) {
                        this.answers[questionIndex] = value;
                        setTimeout(() => {
                            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                                this.nextQuestion();
                            } else {
                                this.completeQuestionnaire();
                            }
                        }, 300);
                    }
                }
            });
        }
        
        // Handle "Other" text input
        const otherInput = card.querySelector('[data-type="other"]');
        if (otherInput) {
            otherInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    // Clear any selected option buttons
                    card.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
                    this.answers[questionIndex] = value;
                    this.enableNextButton();
                } else {
                    // Only delete if no option is selected
                    const selectedOption = card.querySelector('.option-btn.selected');
                    if (!selectedOption) {
                        delete this.answers[questionIndex];
                        this.disableNextButton();
                    }
                }
            });
            
            // Auto-advance on Enter for "Other" input
            otherInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = e.target.value.trim();
                    if (value) {
                        this.answers[questionIndex] = value;
                        setTimeout(() => {
                            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                                this.nextQuestion();
                            } else {
                                this.completeQuestionnaire();
                            }
                        }, 300);
                    }
                }
            });
        }
    }
    
    selectOption(button, questionIndex) {
        // Remove previous selections
        const card = button.closest('.question-card');
        card.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
        
        // Select current option
        button.classList.add('selected');
        this.answers[questionIndex] = button.dataset.value;
        
        // Clear other input if option is selected
        const otherInput = card.querySelector('[data-type="other"]');
        if (otherInput) otherInput.value = '';
        
        this.enableNextButton();
        
        // Auto-advance after a short delay for better UX
        setTimeout(() => {
            if (this.currentQuestion < psychologicalQuestions.length - 1) {
                this.nextQuestion();
            } else {
                // This is the last question - automatically complete questionnaire
                this.completeQuestionnaire();
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
    
    async nextQuestion() {
        if (!this.answers[this.currentQuestion]) return;
        
        if (this.currentQuestion < psychologicalQuestions.length - 1) {
            this.currentQuestion++;
            this.loadQuestion(this.currentQuestion);
            this.disableNextButton();
        } else {
            // Complete questionnaire
            await this.completeQuestionnaire();
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
        // Transition to loading screen with smooth animation
        this.transitionToLoadingScreen();
        
        try {
            // Send data to backend
            const response = await fetch('/api/onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    answers: this.answers
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.userId = result.userId;
                // Start loading animation sequence
                this.startLoadingSequence();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error completing questionnaire:', error);
            alert('Something went wrong. Please try again.');
        }
    }
    
    transitionToLoadingScreen() {
        // Fade out question screen
        const questionScreen = document.getElementById('question-flow');
        questionScreen.style.opacity = '0';
        questionScreen.style.transform = 'translateX(-100px)';
        
        setTimeout(() => {
            questionScreen.classList.remove('active');
            
            // Show loading screen with slide-in animation
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
                progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
                currentStep++;
                
                setTimeout(animateStep, 1500);
            } else {
                // All steps completed, transition to chat
                setTimeout(() => {
                    this.transitionToChat();
                }, 1000);
            }
        };
        
        // Start the sequence after a brief delay
        setTimeout(animateStep, 800);
    }
    
    transitionToChat() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transform = 'translateY(-50px)';
        
        setTimeout(() => {
            loadingScreen.classList.remove('active');
            
            const chatScreen = document.getElementById('chat');
            chatScreen.classList.add('active');
            chatScreen.style.opacity = '0';
            chatScreen.style.transform = 'translateY(50px)';
            
            setTimeout(() => {
                chatScreen.style.opacity = '1';
                chatScreen.style.transform = 'translateY(0)';
                this.initializeChat();
            }, 50);
        }, 600);
    }
    
    initializeChat() {
        const name = this.answers[0] || 'friend';
        const personalizedMessage = this.generatePersonalizedWelcome(name);
        this.addCompanionMessage(personalizedMessage);
    }
    
    generatePersonalizedWelcome(name) {
        const communicationStyle = this.answers[3] || '';
        const emotionalNeed = this.answers[12] || '';
        
        let message = `Hello ${name}! I'm so glad we've connected. `;
        
        if (communicationStyle.includes('gentle')) {
            message += "I can see you appreciate gentle, supportive conversations, and I want you to know this is a completely safe space for you. ";
        } else if (communicationStyle.includes('direct')) {
            message += "I appreciate that you value direct, honest communication - I'll always be straightforward with you while remaining supportive. ";
        }
        
        if (emotionalNeed.includes('heard')) {
            message += "I'm here to truly listen and understand you. ";
        } else if (emotionalNeed.includes('clarity')) {
            message += "I'm here to help you find the clarity you're seeking. ";
        }
        
        message += "What's on your mind today?";
        
        return message;
    }
    
    async loadUserProfile() {
        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user profile');
        }
        
        const result = await response.json();
        this.user = result.user;
        this.userId = result.user.id;
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        this.addUserMessage(message);
        messageInput.value = '';
        
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId,
                    message: message
                })
            });
            
            const result = await response.json();
            
            this.removeTypingIndicator();
            this.addCompanionMessage(result.response);
            
        } catch (error) {
            console.error('Chat error:', error);
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
function showAuthScreen(mode = 'login') {
    document.getElementById('homepage').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
    
    if (mode === 'register') {
        showRegister();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
}

function showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            localStorage.setItem('solace_token', result.token);
            app.authToken = result.token;
            app.user = result.user;
            
            if (result.user.onboardingComplete) {
                app.showScreen('chat');
                app.initializeChat();
            } else {
                app.showScreen('question-flow');
            }
        } else {
            showError(result.error);
        }
    } catch (error) {
        showError('Something went wrong. Please try again.');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            localStorage.setItem('solace_token', result.token);
            app.authToken = result.token;
            app.user = result.user;
            
            // Go to questionnaire for new users
            app.showScreen('question-flow');
        } else {
            showError(result.error);
        }
    } catch (error) {
        showError('Something went wrong. Please try again.');
    }
}

function showError(message) {
    // Remove existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Insert at the top of the active form
    const activeForm = document.querySelector('.auth-form.active .form');
    activeForm.insertBefore(errorDiv, activeForm.firstChild);
}

function startJourney() {
    // This function is now replaced by showAuthScreen('register')
    showAuthScreen('register');
}

function selectOption(button, questionIndex) {
    app.selectOption(button, questionIndex);
}

function nextQuestion() {
    app.nextQuestion();
}

function previousQuestion() {
    app.previousQuestion();
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CompanionApp();
});