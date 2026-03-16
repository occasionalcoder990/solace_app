class ChatApp {
    constructor() {
        this.authToken = localStorage.getItem('solace_token');
        this.user = null;
        this.currentMood = 'neutral';
        this.messageCount = 0;
        this.sessionStartTime = Date.now();
        this.memoryHighlights = [];
        this.connectionLevel = 'Growing';
        this.init();
    }
    
    async init() {
        // Check authentication
        if (!this.authToken) {
            window.location.href = 'landing.html';
            return;
        }
        
        try {
            await this.loadUserProfile();
            this.initializeChat();
            this.bindEvents();
        } catch (error) {
            console.error('Authentication failed:', error);
            localStorage.removeItem('solace_token');
            window.location.href = 'landing.html';
        }
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
    }
    
    bindEvents() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        
        console.log('🔗 Binding events...', { sendBtn, messageInput });
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                console.log('🖱️ Send button clicked');
                this.sendMessage();
            });
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                console.log('⌨️ Key pressed:', e.key);
                if (e.key === 'Enter' && !e.shiftKey) {
                    console.log('✅ Enter key detected, sending message');
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Also add keydown as backup
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    console.log('✅ Enter keydown detected, sending message');
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        } else {
            console.error('❌ Message input not found!');
        }
    }
    
    async initializeChat() {
        // Initialize mood and smart features
        this.initializeMoodSystem();
        this.initializeSmartFeatures();
        this.startSessionTimer();
        
        // Load conversation history
        await this.loadConversationHistory();
        
        // If no history, get personalized welcome message from server
        const messages = document.getElementById('messages');
        if (messages.children.length === 0) {
            try {
                const response = await fetch('/api/personalized-welcome', {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.addCompanionMessage(result.welcomeMessage);
                } else {
                    // Fallback welcome
                    const welcomeMessage = this.generatePersonalizedWelcome();
                    this.addCompanionMessage(welcomeMessage);
                }
            } catch (error) {
                console.error('Error getting personalized welcome:', error);
                const welcomeMessage = this.generatePersonalizedWelcome();
                this.addCompanionMessage(welcomeMessage);
            }
        }
        
        this.updateInsightsPanelStats();
    }
    
    async loadConversationHistory() {
        try {
            const response = await fetch('/api/conversations?limit=20', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                const messages = document.getElementById('messages');
                
                // Clear default message
                messages.innerHTML = '';
                
                // Add conversation history
                result.conversations.reverse().forEach(conv => {
                    this.addUserMessage(conv.message, false);
                    this.addCompanionMessage(conv.response, false);
                });
                
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    }
    
    generatePersonalizedWelcome() {
        const name = this.user.name || 'friend';
        return `Welcome back, ${name}! I'm so glad you're here. How are you feeling today?`;
    }
    
    async sendMessage() {
        console.log('📨 SendMessage function called!');
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        console.log('💬 Message content:', message);
        
        if (!message) return;
        
        // Detect mood from message
        const detectedMood = this.detectMoodFromMessage(message);
        console.log('🎭 Detected mood:', detectedMood);
        this.updateMood(detectedMood);
        
        this.addUserMessage(message);
        messageInput.value = '';
        this.messageCount++;
        
        this.showEnhancedTypingIndicator();
        
        try {
            console.log('🚀 Sending message to server:', message);
            console.log('🔑 Auth token:', this.authToken ? 'Present' : 'Missing');
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ message })
            });
            
            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);
            
            const result = await response.json();
            
            this.removeTypingIndicator();
            
            if (response.ok) {
                // Check if response references memory
                const hasMemoryReference = this.checkMemoryReference(result.response);
                this.addCompanionMessage(result.response, true, hasMemoryReference);
                
                // Show memory highlight if detected
                if (hasMemoryReference) {
                    this.showMemoryHighlight("I remember our previous conversations...");
                }
                
                // Update connection level based on conversation depth
                this.updateConnectionLevel();
            } else {
                this.addCompanionMessage("I'm sorry, I'm having trouble connecting right now. Please try again.");
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            console.error('Error details:', error.message);
            this.removeTypingIndicator();
            this.addCompanionMessage("I'm sorry, I'm having trouble connecting right now. Please try again.");
            
            // Show error in console for debugging
            alert('Error: ' + error.message + '. Check console for details.');
        }
        
        this.updateInsightsPanelStats();
    }
    
    addUserMessage(message, animate = true) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        if (animate) messageDiv.style.animation = 'messageSlideIn 0.4s ease-out';
        messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addCompanionMessage(message, animate = true) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message companion-message';
        if (animate) messageDiv.style.animation = 'messageSlideIn 0.4s ease-out';
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

function logout() {
    localStorage.removeItem('solace_token');
    window.location.href = 'landing.html';
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ChatApp();
});    // M
ood Detection and Response System
    initializeMoodSystem() {
        this.moodKeywords = {
            happy: ['happy', 'joy', 'excited', 'great', 'amazing', 'wonderful', 'fantastic', 'love', 'awesome', '😊', '😄', '🎉', '❤️'],
            sad: ['sad', 'depressed', 'down', 'upset', 'crying', 'hurt', 'lonely', 'empty', 'lost', '😢', '😭', '💔'],
            anxious: ['anxious', 'worried', 'nervous', 'stressed', 'panic', 'overwhelmed', 'scared', 'afraid', 'tense', '😰', '😨'],
            peaceful: ['calm', 'peaceful', 'relaxed', 'serene', 'content', 'tranquil', 'zen', 'balanced', 'centered', '😌', '🧘'],
            excited: ['excited', 'thrilled', 'pumped', 'energetic', 'motivated', 'inspired', 'enthusiastic', '🚀', '⚡', '🔥'],
            thoughtful: ['thinking', 'wondering', 'contemplating', 'reflecting', 'pondering', 'curious', 'philosophical', '🤔', '💭']
        };
        
        this.updateMood('peaceful'); // Default mood
    }
    
    detectMoodFromMessage(message) {
        const lowerMessage = message.toLowerCase();
        let moodScores = {};
        
        // Initialize scores
        Object.keys(this.moodKeywords).forEach(mood => {
            moodScores[mood] = 0;
        });
        
        // Score based on keywords
        Object.entries(this.moodKeywords).forEach(([mood, keywords]) => {
            keywords.forEach(keyword => {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    moodScores[mood] += 1;
                }
            });
        });
        
        // Find highest scoring mood
        let detectedMood = 'neutral';
        let highestScore = 0;
        
        Object.entries(moodScores).forEach(([mood, score]) => {
            if (score > highestScore) {
                highestScore = score;
                detectedMood = mood;
            }
        });
        
        return highestScore > 0 ? detectedMood : 'neutral';
    }
    
    updateMood(newMood) {
        console.log('🌈 Updating mood from', this.currentMood, 'to', newMood);
        if (newMood === this.currentMood) return;
        
        this.currentMood = newMood;
        
        // Update mood indicator
        const moodIndicator = document.getElementById('mood-indicator');
        const moodText = document.getElementById('mood-text');
        
        // Remove existing mood classes
        document.body.classList.remove('mood-peaceful', 'mood-happy', 'mood-sad', 'mood-anxious', 'mood-excited', 'mood-thoughtful', 'mood-neutral');
        
        // Add new mood class
        document.body.classList.add(`mood-${newMood}`);
        
        // Update mood indicator style
        moodIndicator.style.background = `var(--mood-${newMood})`;
        
        // Update mood text
        const moodLabels = {
            peaceful: 'Peaceful 🧘',
            happy: 'Happy 😊',
            sad: 'Reflective 💙',
            anxious: 'Supportive 🤗',
            excited: 'Energetic ⚡',
            thoughtful: 'Contemplative 💭',
            neutral: 'Balanced ⚖️'
        };
        
        moodText.textContent = moodLabels[newMood] || 'Balanced ⚖️';
        
        // Update insights panel
        document.getElementById('current-mood').textContent = moodLabels[newMood] || 'Balanced';
        
        // Add breathing animation for peaceful mood
        if (newMood === 'peaceful') {
            document.body.classList.add('breathing');
        } else {
            document.body.classList.remove('breathing');
        }
        
        // Trigger mood particles
        this.createMoodParticles(newMood);
    }
    
    createMoodParticles(mood) {
        const particlesContainer = document.querySelector('.mood-particles');
        if (!particlesContainer) return;
        
        const particles = ['✨', '💫', '🌟', '⭐', '💖', '🌸', '🦋', '🌈'];
        const moodParticles = {
            happy: ['😊', '🎉', '✨', '🌟'],
            peaceful: ['🧘', '🌸', '🍃', '💙'],
            excited: ['🚀', '⚡', '🔥', '💫'],
            thoughtful: ['💭', '🤔', '📚', '🔮']
        };
        
        const particleSet = moodParticles[mood] || particles;
        
        // Clear existing particles
        particlesContainer.innerHTML = '';
        
        // Create new particles
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.textContent = particleSet[Math.floor(Math.random() * particleSet.length)];
                particle.style.position = 'absolute';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = '0px';
                particle.style.fontSize = '1rem';
                particle.style.pointerEvents = 'none';
                particle.style.animation = 'particleFall 3s ease-out forwards';
                
                particlesContainer.appendChild(particle);
                
                setTimeout(() => particle.remove(), 3000);
            }, i * 500);
        }
    }
    
    // Smart Features System
    initializeSmartFeatures() {
        this.memoryKeywords = ['remember', 'mentioned', 'told me', 'said before', 'last time', 'previously', 'earlier'];
        this.connectionMilestones = [5, 15, 30, 50, 100]; // Message counts for connection levels
    }
    
    checkMemoryReference(response) {
        const lowerResponse = response.toLowerCase();
        return this.memoryKeywords.some(keyword => lowerResponse.includes(keyword));
    }
    
    showMemoryHighlight(message) {
        const popup = document.getElementById('memory-popup');
        const messageEl = popup.querySelector('.memory-message');
        
        messageEl.textContent = message;
        popup.classList.add('show');
        
        setTimeout(() => {
            popup.classList.remove('show');
        }, 3000);
        
        // Update memory highlight in insights
        const memoryHighlight = document.querySelector('.memory-text');
        memoryHighlight.textContent = message;
        
        // Add pulse animation to memory card
        const memoryCard = document.getElementById('memory-highlight');
        memoryCard.style.animation = 'memoryPulse 2s ease-in-out 3';
    }
    
    updateConnectionLevel() {
        const levels = ['New', 'Growing', 'Connected', 'Close', 'Deep Bond'];
        let levelIndex = 0;
        
        for (let i = 0; i < this.connectionMilestones.length; i++) {
            if (this.messageCount >= this.connectionMilestones[i]) {
                levelIndex = i + 1;
            }
        }
        
        this.connectionLevel = levels[Math.min(levelIndex, levels.length - 1)];
        document.getElementById('connection-level').textContent = this.connectionLevel;
    }
    
    startSessionTimer() {
        setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 60000);
            document.getElementById('session-time').textContent = elapsed + 'm';
        }, 60000);
    }
    
    updateInsightsPanelStats() {
        document.getElementById('message-count').textContent = this.messageCount;
    }
    
    // Enhanced Typing Indicator
    showEnhancedTypingIndicator() {
        const messagesContainer = document.getElementById('messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator show';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <div class="typing-text">Thinking with care...</div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    // Enhanced Message Methods
    addUserMessage(message, animate = true) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        if (animate) messageDiv.style.animation = 'messageSlideIn 0.4s ease-out';
        
        messageDiv.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-reactions">
                <button class="reaction-btn" onclick="app.addReaction(this, '💙')">💙</button>
                <button class="reaction-btn" onclick="app.addReaction(this, '🤗')">🤗</button>
                <button class="reaction-btn" onclick="app.addReaction(this, '✨')">✨</button>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addCompanionMessage(message, animate = true, hasMemoryReference = false) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message assistant${hasMemoryReference ? ' memory-reference' : ''}`;
        if (animate) messageDiv.style.animation = 'messageSlideIn 0.4s ease-out';
        
        messageDiv.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-reactions">
                <button class="reaction-btn" onclick="app.addReaction(this, '❤️')">❤️</button>
                <button class="reaction-btn" onclick="app.addReaction(this, '🙏')">🙏</button>
                <button class="reaction-btn" onclick="app.addReaction(this, '💫')">💫</button>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    addReaction(button, emoji) {
        button.style.background = '#667eea';
        button.style.color = 'white';
        button.style.transform = 'scale(1.2)';
        
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 200);
    }
}

// Enhanced Global Functions
function toggleInsights() {
    const panel = document.getElementById('insights-panel');
    panel.classList.toggle('active');
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emotion-picker');
    picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
}

function addEmotion(emoji) {
    const input = document.getElementById('message-input');
    input.value += emoji + ' ';
    input.focus();
    toggleEmojiPicker();
}

function sendQuickMessage(message) {
    const input = document.getElementById('message-input');
    input.value = message;
    app.sendMessage();
}

// Add CSS for particle animation
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(30px) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);