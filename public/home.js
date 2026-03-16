class Dashboard {
    constructor() {
        this.authToken = localStorage.getItem('solace_token');
        this.user = null;
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
            await this.loadDashboardData();
            this.updateUI();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
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
    
    async loadDashboardData() {
        try {
            // Load conversation stats
            const statsResponse = await fetch('/api/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (statsResponse.ok) {
                this.stats = await statsResponse.json();
            } else {
                // Default stats if API fails
                this.stats = {
                    totalMessages: 0,
                    daysActive: 1,
                    currentMood: 'Peaceful',
                    connectionLevel: 'Growing'
                };
            }
            
            // Load recent activity
            const activityResponse = await fetch('/api/dashboard/activity', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (activityResponse.ok) {
                this.activity = await activityResponse.json();
            } else {
                this.activity = { activities: [] };
            }
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Set default values
            this.stats = {
                totalMessages: 0,
                daysActive: 1,
                currentMood: 'Peaceful',
                connectionLevel: 'Growing'
            };
            this.activity = { activities: [] };
        }
    }
    
    updateUI() {
        // Update user name
        const userName = this.user?.name || 'friend';
        document.getElementById('user-name').textContent = userName;
        
        // Update stats
        if (this.stats) {
            document.getElementById('total-messages').textContent = this.stats.totalMessages || 0;
            document.getElementById('days-active').textContent = this.stats.daysActive || 1;
            document.getElementById('current-mood').textContent = this.stats.currentMood || 'Peaceful';
            document.getElementById('connection-level').textContent = this.stats.connectionLevel || 'Growing';
        }
        
        // Update companion name
        const companionName = this.user?.companion_name || 'Solace';
        document.getElementById('companion-name-display').textContent = companionName;
        
        // Update communication style
        const profile = this.user?.personality_profile ? JSON.parse(this.user.personality_profile) : {};
        const commStyle = this.getCommunicationStyleDisplay(profile[3] || '');
        document.getElementById('communication-style-display').textContent = commStyle;
        
        // Update activity feed
        this.updateActivityFeed();
    }
    
    getCommunicationStyleDisplay(style) {
        if (style.includes('Gentle')) return 'Gentle & Caring';
        if (style.includes('Direct')) return 'Direct & Honest';
        if (style.includes('casual')) return 'Casual & Friendly';
        if (style.includes('Deep')) return 'Deep & Thoughtful';
        return 'Balanced & Adaptive';
    }
    
    updateActivityFeed() {
        const feed = document.getElementById('activity-feed');
        
        if (this.activity && this.activity.activities && this.activity.activities.length > 0) {
            feed.innerHTML = '';
            this.activity.activities.slice(0, 3).forEach(activity => {
                const item = document.createElement('div');
                item.className = 'activity-item';
                item.innerHTML = `
                    <div class="activity-icon">${activity.icon || '✨'}</div>
                    <div class="activity-content">
                        <p class="activity-text">${activity.text}</p>
                        <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
                    </div>
                `;
                feed.appendChild(item);
            });
        }
    }
    
    formatTime(timestamp) {
        if (!timestamp) return 'Just now';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }
}

// Navigation functions
function goToChat() {
    window.location.href = 'app.html';
}

function goToInsights() {
    window.location.href = 'dashboard.html';
}

function updateCompanionName() {
    const newName = prompt('What would you like to call your companion?', document.getElementById('companion-name-display').textContent);
    if (newName && newName.trim()) {
        // Update companion name via API
        fetch('/api/companion/update-name', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('solace_token')}`
            },
            body: JSON.stringify({ companionName: newName.trim() })
        }).then(response => {
            if (response.ok) {
                document.getElementById('companion-name-display').textContent = newName.trim();
            }
        }).catch(error => {
            console.error('Error updating companion name:', error);
        });
    }
}

function updateCommunicationStyle() {
    alert('Communication style can be updated by retaking the questionnaire. This feature will be enhanced soon!');
}

function logout() {
    localStorage.removeItem('solace_token');
    window.location.href = 'landing.html';
}

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});