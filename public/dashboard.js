class Dashboard {
    constructor() {
        this.authToken = localStorage.getItem('solace_token');
        this.init();
    }

    async init() {
        if (!this.authToken) {
            window.location.href = 'landing.html';
            return;
        }

        try {
            await this.loadDashboardData();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            localStorage.removeItem('solace_token');
            window.location.href = 'landing.html';
        }
    }

    async loadDashboardData() {
        // Load all dashboard data in parallel
        const [profile, insights, milestones, conversations, personalityInsights, milestoneProgress, engagementAnalytics, privacyInfo, consent] = await Promise.all([
            this.fetchUserProfile(),
            this.fetchInsights(),
            this.fetchMilestones(),
            this.fetchConversations(),
            this.fetchPersonalityInsights(),
            this.fetchMilestoneProgress(),
            this.fetchEngagementAnalytics(),
            this.fetchPrivacyInfo(),
            this.fetchUserConsent()
        ]);

        this.renderStats(profile, insights, conversations, milestones);
        this.renderInsights(insights);
        this.renderMilestones(milestones);
        this.renderPersonalityInsights(personalityInsights);
        this.renderRelationshipProgress(milestoneProgress);
        this.renderMilestoneHistory(milestoneProgress);
        this.renderEngagementAnalytics(engagementAnalytics);
        this.loadSettings(profile);
        this.renderPrivacyControls(privacyInfo, consent);
    }

    async fetchUserProfile() {
        const response = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch profile');
        return await response.json();
    }

    async fetchInsights() {
        const response = await fetch('/api/insights', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch insights');
        return await response.json();
    }

    async fetchMilestones() {
        const response = await fetch('/api/milestones', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch milestones');
        return await response.json();
    }

    async fetchConversations() {
        const response = await fetch('/api/conversations?limit=100', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch conversations');
        return await response.json();
    }

    async fetchPersonalityInsights() {
        const response = await fetch('/api/personality-insights', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch personality insights');
        return await response.json();
    }

    async fetchMilestoneProgress() {
        const response = await fetch('/api/milestone-progress', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch milestone progress');
        return await response.json();
    }

    async fetchEngagementAnalytics() {
        const response = await fetch('/api/engagement-analytics', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch engagement analytics');
        return await response.json();
    }

    async fetchPrivacyInfo() {
        const response = await fetch('/api/privacy/info', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch privacy info');
        return await response.json();
    }

    async fetchUserConsent() {
        const response = await fetch('/api/privacy/consent', {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch user consent');
        return await response.json();
    }

    renderStats(profile, insights, conversations, milestones) {
        // Total conversations
        document.getElementById('total-conversations').textContent = 
            conversations.conversations?.length || 0;

        // Average mood
        const avgMood = insights.insights?.moodTrends?.length > 0 
            ? (insights.insights.moodTrends.reduce((sum, day) => sum + day.avg_mood, 0) / insights.insights.moodTrends.length).toFixed(1)
            : 'N/A';
        document.getElementById('avg-mood').textContent = avgMood !== 'N/A' ? `${avgMood}/10` : avgMood;

        // Relationship stage
        const stage = profile.user?.companionName ? 
            this.formatRelationshipStage(profile.user.relationshipStage || 'getting_to_know') : 'New';
        document.getElementById('relationship-stage').textContent = stage;

        // Milestones count
        document.getElementById('milestones-count').textContent = milestones.milestones?.length || 0;
    }

    formatRelationshipStage(stage) {
        const stages = {
            'getting_to_know': 'Getting to Know',
            'comfortable': 'Comfortable',
            'close_friend': 'Close Friend',
            'trusted_confidant': 'Trusted Confidant',
            'life_companion': 'Life Companion'
        };
        return stages[stage] || 'New';
    }

    renderInsights(insights) {
        this.renderEmotionalPatterns(insights.insights?.emotionalPatterns || []);
        this.renderFavoriteTopics(insights.insights?.favoriteTopics || []);
        this.renderMoodTrends(insights.insights?.moodTrends || []);
        this.renderPersonalMemories(insights.insights?.memories || []);
    }

    renderEmotionalPatterns(patterns) {
        const container = document.getElementById('emotional-patterns');
        
        if (patterns.length === 0) {
            container.innerHTML = '<p class="no-data">Start chatting to see your emotional patterns!</p>';
            return;
        }

        const html = patterns.slice(0, 5).map(pattern => {
            const emotions = pattern.emotions.filter(e => e).join(', ');
            return `
                <div class="pattern-item">
                    <div class="pattern-emotions">${emotions}</div>
                    <div class="pattern-frequency">${pattern.frequency} times</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderFavoriteTopics(topics) {
        const container = document.getElementById('favorite-topics');
        
        if (topics.length === 0) {
            container.innerHTML = '<p class="no-data">Your favorite topics will appear here as we chat!</p>';
            return;
        }

        const html = topics.slice(0, 5).map(topic => {
            const topicNames = topic.topics.filter(t => t).join(', ');
            return `
                <div class="topic-item">
                    <div class="topic-name">${topicNames}</div>
                    <div class="topic-frequency">${topic.frequency} discussions</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderMoodTrends(trends) {
        const container = document.getElementById('mood-trends');
        
        if (trends.length === 0) {
            container.innerHTML = '<p class="no-data">Your mood trends will appear here as we have more conversations!</p>';
            return;
        }

        // Create a simple mood chart
        const recentTrends = trends.slice(0, 14).reverse(); // Last 14 days
        const html = `
            <div class="mood-chart">
                ${recentTrends.map(day => `
                    <div class="mood-bar">
                        <div class="mood-fill" style="height: ${(day.avg_mood / 10) * 100}%"></div>
                        <div class="mood-date">${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                `).join('')}
            </div>
            <div class="mood-legend">
                <span>😔 1</span>
                <span>😐 5</span>
                <span>😊 10</span>
            </div>
        `;

        container.innerHTML = html;
    }

    renderPersonalMemories(memories) {
        const container = document.getElementById('personal-memories');
        
        if (memories.length === 0) {
            container.innerHTML = '<p class="no-data">I\'ll remember important things about you as we chat!</p>';
            return;
        }

        const html = memories.slice(0, 8).map(memory => `
            <div class="memory-item">
                <div class="memory-type">${this.formatMemoryType(memory.memory_type)}</div>
                <div class="memory-content">${memory.content}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    formatMemoryType(type) {
        const types = {
            'name_mention': '👤 Name',
            'age': '🎂 Age',
            'location': '📍 Location',
            'job': '💼 Work',
            'hobby': '🎨 Hobby',
            'fear': '😰 Fear',
            'goal': '🎯 Goal',
            'relationship': '💕 Relationship'
        };
        return types[type] || '💭 Memory';
    }

    renderMilestones(milestones) {
        const container = document.getElementById('milestones');
        
        if (milestones.milestones.length === 0) {
            container.innerHTML = '<p class="no-data">Your milestones will appear here as you grow!</p>';
            return;
        }

        const html = milestones.milestones.slice(0, 5).map(milestone => `
            <div class="milestone-item">
                <div class="milestone-icon">${this.getMilestoneIcon(milestone.milestone_type)}</div>
                <div class="milestone-content">
                    <div class="milestone-title">${milestone.title}</div>
                    <div class="milestone-date">${new Date(milestone.achieved_date).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    getMilestoneIcon(type) {
        const icons = {
            'relationship': '💕',
            'conversation': '💬',
            'emotional': '🌱',
            'personal': '⭐',
            'growth': '🚀',
            'onboarding': '🎯',
            'engagement': '🔥',
            'connection': '🤝'
        };
        return icons[type] || '🏆';
    }

    renderPersonalityInsights(personalityData) {
        const container = document.getElementById('personality-insights');
        
        if (!personalityData.insights || personalityData.insights.length === 0) {
            container.innerHTML = '<p class="no-data">Complete your onboarding to see personality insights!</p>';
            return;
        }

        const insights = personalityData.insights.slice(0, 4); // Show top 4 insights
        const html = insights.map(insight => `
            <div class="personality-insight-item">
                <div class="insight-type">${this.formatInsightType(insight.insight_type)}</div>
                <div class="insight-text">${insight.insight_content}</div>
                <div class="insight-confidence">
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${(insight.confidence_score * 100)}%"></div>
                    </div>
                    <span class="confidence-text">${Math.round(insight.confidence_score * 100)}% confidence</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    formatInsightType(type) {
        const types = {
            'communication_style': '💬 Communication Style',
            'emotional_needs': '❤️ Emotional Needs',
            'coping_style': '🛡️ Coping Style',
            'uniqueness': '✨ What Makes You Unique'
        };
        return types[type] || '🧩 Insight';
    }

    renderRelationshipProgress(progressData) {
        const container = document.getElementById('relationship-progress');
        
        if (!progressData.currentStage) {
            container.innerHTML = '<p class="no-data">Start chatting to track your relationship progress!</p>';
            return;
        }
        const stages = [
            { key: 'getting_to_know', name: 'Getting to Know', icon: '👋' },
            { key: 'comfortable', name: 'Comfortable', icon: '😊' },
            { key: 'close_friend', name: 'Close Friend', icon: '🤗' },
            { key: 'trusted_confidant', name: 'Trusted Confidant', icon: '💝' },
            { key: 'life_companion', name: 'Life Companion', icon: '🌟' }
        ];

        const currentStageIndex = stages.findIndex(stage => stage.key === progressData.currentStage);
        
        const html = `
            <div class="relationship-stages">
                ${stages.map((stage, index) => {
                    const isActive = index === currentStageIndex;
                    const isCompleted = index < currentStageIndex;
                    const statusClass = isActive ? 'active' : (isCompleted ? 'completed' : 'upcoming');
                    
                    return `
                        <div class="stage-item ${statusClass}">
                            <div class="stage-icon">${stage.icon}</div>
                            <div class="stage-name">${stage.name}</div>
                            ${isActive ? `<div class="stage-progress">${progressData.stageProgress || 0}%</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="progress-summary">
                <div class="current-stage">Currently: ${stages[currentStageIndex]?.name || 'Getting Started'}</div>
                <div class="next-milestone">${progressData.nextMilestones?.[0]?.title || 'Keep chatting to unlock the next milestone!'}</div>
                <div class="engagement-score">Total Points: ${progressData.totalPoints || 0}</div>
            </div>
        `;

        container.innerHTML = html;
    }

    renderMilestoneHistory(progressData) {
        const container = document.getElementById('milestone-history');
        
        if (!progressData.achievedMilestones || progressData.achievedMilestones.length === 0) {
            container.innerHTML = '<p class="no-data">Your milestone achievements will appear here as you progress!</p>';
            return;
        }

        const milestones = progressData.achievedMilestones.slice(0, 10); // Show last 10 milestones
        const milestonesByCategory = this.groupMilestonesByCategory(milestones);
        
        const html = `
            <div class="milestone-timeline">
                ${Object.entries(milestonesByCategory).map(([category, categoryMilestones]) => `
                    <div class="milestone-category">
                        <h4 class="category-title">
                            ${this.getMilestoneIcon(category)} ${this.formatMilestoneCategory(category)}
                        </h4>
                        <div class="category-milestones">
                            ${categoryMilestones.map(milestone => `
                                <div class="milestone-timeline-item">
                                    <div class="milestone-date">${new Date(milestone.achieved_date).toLocaleDateString()}</div>
                                    <div class="milestone-details">
                                        <div class="milestone-title">${milestone.title}</div>
                                        <div class="milestone-description">${milestone.description || ''}</div>
                                        ${milestone.points ? `<div class="milestone-points">+${milestone.points} points</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    groupMilestonesByCategory(milestones) {
        return milestones.reduce((groups, milestone) => {
            const category = milestone.category || 'general';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(milestone);
            return groups;
        }, {});
    }

    formatMilestoneCategory(category) {
        const categories = {
            'onboarding': 'Getting Started',
            'engagement': 'Engagement',
            'growth': 'Personal Growth',
            'connection': 'Connection Building',
            'general': 'General Achievements'
        };
        return categories[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    renderEngagementAnalytics(analyticsData) {
        const container = document.getElementById('engagement-analytics');
        
        if (!analyticsData.analytics) {
            container.innerHTML = '<p class="no-data">Analytics will appear as you have more conversations!</p>';
            return;
        }

        const analytics = analyticsData.analytics;
        const recentSessions = analytics.recentSessions || [];
        
        // Calculate averages
        const avgMessagesPerSession = analytics.averageMessagesPerSession || 0;
        const avgEmotionalDepth = analytics.averageEmotionalDepth || 0;
        const avgSessionLength = analytics.averageSessionDuration || 0;

        const html = `
            <div class="analytics-summary">
                <div class="analytics-metric">
                    <div class="metric-value">${Math.round(avgMessagesPerSession)}</div>
                    <div class="metric-label">Avg Messages/Session</div>
                </div>
                <div class="analytics-metric">
                    <div class="metric-value">${Math.round(avgEmotionalDepth * 100)}%</div>
                    <div class="metric-label">Emotional Depth</div>
                </div>
                <div class="analytics-metric">
                    <div class="metric-value">${Math.round(avgSessionLength)}m</div>
                    <div class="metric-label">Avg Session Length</div>
                </div>
            </div>
            <div class="engagement-trend">
                <h5>Recent Session Engagement</h5>
                <div class="engagement-chart">
                    ${recentSessions.slice(0, 7).map((session, index) => `
                        <div class="engagement-bar">
                            <div class="engagement-fill" style="height: ${(session.emotional_depth_score || 0) * 100}%"></div>
                            <div class="engagement-label">S${index + 1}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    loadSettings(profile) {
        const companionName = profile.user?.companionName || 'Solace';
        const conversationDepth = profile.user?.conversationDepthPreference || 5;

        document.getElementById('companion-name').value = companionName;
        document.getElementById('conversation-depth').value = conversationDepth;
    }

    async saveSettings() {
        const companionName = document.getElementById('companion-name').value;
        const conversationDepth = document.getElementById('conversation-depth').value;

        try {
            const response = await fetch('/api/companion-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    companionName,
                    conversationDepth: parseInt(conversationDepth)
                })
            });

            if (response.ok) {
                this.showNotification('Settings saved successfully!', 'success');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }

    renderPrivacyControls(privacyInfo, consent) {
        this.renderConsentControls(consent);
        this.renderPrivacyInformation(privacyInfo);
    }

    renderConsentControls(consentData) {
        const container = document.getElementById('consent-controls');
        
        if (!consentData.success) {
            container.innerHTML = '<p class="error">Failed to load consent preferences</p>';
            return;
        }

        const consent = consentData.consent;
        const html = `
            <div class="consent-item">
                <label class="consent-label">
                    <input type="checkbox" id="personality-consent" ${consent.personalityAnalysis ? 'checked' : ''}>
                    <span class="consent-text">
                        <strong>Personality Analysis</strong><br>
                        Allow analysis of your questionnaire responses to generate personalized insights
                    </span>
                </label>
            </div>
            <div class="consent-item">
                <label class="consent-label">
                    <input type="checkbox" id="analytics-consent" ${consent.dataAnalytics ? 'checked' : ''}>
                    <span class="consent-text">
                        <strong>Data Analytics</strong><br>
                        Allow analysis of your conversation patterns for mood tracking and insights
                    </span>
                </label>
            </div>
            <div class="consent-item">
                <label class="consent-label">
                    <input type="checkbox" id="notifications-consent" ${consent.retentionNotifications ? 'checked' : ''}>
                    <span class="consent-text">
                        <strong>Retention Notifications</strong><br>
                        Allow personalized reminders and re-engagement messages
                    </span>
                </label>
            </div>
            <button class="save-consent-btn" onclick="saveConsentPreferences()">
                Save Consent Preferences
            </button>
            ${consent.lastUpdated ? `<p class="consent-updated">Last updated: ${new Date(consent.lastUpdated).toLocaleDateString()}</p>` : ''}
        `;

        container.innerHTML = html;
    }

    renderPrivacyInformation(privacyData) {
        const container = document.getElementById('privacy-details');
        
        if (!privacyData.success) {
            container.innerHTML = '<p class="error">Failed to load privacy information</p>';
            return;
        }

        const info = privacyData.privacyInfo;
        const html = `
            <div class="privacy-section">
                <h4>🗄️ Data Storage</h4>
                <ul>
                    <li><strong>Location:</strong> ${info.dataStorage.location}</li>
                    <li><strong>Encryption:</strong> ${info.dataStorage.encryption}</li>
                    <li><strong>Retention:</strong> ${info.dataStorage.retention}</li>
                </ul>
            </div>
            
            <div class="privacy-section">
                <h4>⚖️ Your Rights</h4>
                <ul>
                    <li><strong>Access:</strong> ${info.userRights.access}</li>
                    <li><strong>Rectification:</strong> ${info.userRights.rectification}</li>
                    <li><strong>Erasure:</strong> ${info.userRights.erasure}</li>
                    <li><strong>Portability:</strong> ${info.userRights.portability}</li>
                    <li><strong>Objection:</strong> ${info.userRights.objection}</li>
                </ul>
            </div>
            
            <div class="privacy-section">
                <h4>📊 Data Categories</h4>
                <ul>
                    <li><strong>Conversations:</strong> ${info.dataCategories.conversations}</li>
                    <li><strong>Personality:</strong> ${info.dataCategories.personality}</li>
                    <li><strong>Milestones:</strong> ${info.dataCategories.milestones}</li>
                    <li><strong>Memories:</strong> ${info.dataCategories.memories}</li>
                    <li><strong>Analytics:</strong> ${info.dataCategories.analytics}</li>
                </ul>
            </div>
            
            <div class="privacy-section">
                <h4>✅ Compliance</h4>
                <ul>
                    <li><strong>GDPR:</strong> ${info.compliance.gdpr}</li>
                    <li><strong>CCPA:</strong> ${info.compliance.ccpa}</li>
                    <li><strong>Local Storage:</strong> ${info.compliance.localStorage}</li>
                </ul>
            </div>
        `;

        container.innerHTML = html;
    }

    async saveConsentPreferences() {
        try {
            const personalityAnalysis = document.getElementById('personality-consent').checked;
            const dataAnalytics = document.getElementById('analytics-consent').checked;
            const retentionNotifications = document.getElementById('notifications-consent').checked;

            const response = await fetch('/api/privacy/consent', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    personalityAnalysis,
                    dataAnalytics,
                    retentionNotifications
                })
            });

            if (response.ok) {
                this.showNotification('Consent preferences updated successfully!', 'success');
            } else {
                throw new Error('Failed to update consent preferences');
            }
        } catch (error) {
            console.error('Error saving consent preferences:', error);
            this.showNotification('Failed to update consent preferences', 'error');
        }
    }

    async exportUserData() {
        try {
            this.showNotification('Preparing your data export...', 'info');
            
            const response = await fetch('/api/privacy/export', {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            if (!response.ok) {
                throw new Error('Failed to export data');
            }

            const result = await response.json();
            
            // Create and download the file
            const dataStr = JSON.stringify(result.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `solace-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            this.showNotification('Data export downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }

    async deleteDataCategory(category) {
        const categoryNames = {
            conversations: 'conversation history',
            personality: 'personality insights',
            milestones: 'milestones and achievements',
            memories: 'personal memories',
            analytics: 'engagement analytics'
        };

        const categoryName = categoryNames[category] || category;
        
        if (!confirm(`Are you sure you want to permanently delete your ${categoryName}? This action cannot be undone.`)) {
            return;
        }

        // Additional confirmation for sensitive data
        if (['conversations', 'personality'].includes(category)) {
            if (!confirm(`This will delete all your ${categoryName}. Are you absolutely sure?`)) {
                return;
            }
        }

        try {
            const response = await fetch(`/api/privacy/delete/${category}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    confirmation: ['conversations', 'personality'].includes(category)
                })
            });

            if (response.ok) {
                this.showNotification(`${categoryName} deleted successfully`, 'success');
                // Reload dashboard to reflect changes
                setTimeout(() => window.location.reload(), 2000);
            } else {
                throw new Error(`Failed to delete ${categoryName}`);
            }
        } catch (error) {
            console.error(`Error deleting ${category}:`, error);
            this.showNotification(`Failed to delete ${categoryName}`, 'error');
        }
    }

    async deleteAllUserData() {
        if (!confirm('⚠️ WARNING: This will permanently delete ALL your data and close your account. This action cannot be undone.')) {
            return;
        }

        if (!confirm('Are you absolutely certain? Type "DELETE" in the next prompt to confirm.')) {
            return;
        }

        const confirmation = prompt('Type "DELETE_ALL_MY_DATA" to confirm complete data deletion:');
        if (confirmation !== 'DELETE_ALL_MY_DATA') {
            this.showNotification('Deletion cancelled - confirmation text did not match', 'info');
            return;
        }

        try {
            const response = await fetch('/api/privacy/delete-all', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    confirmation: 'DELETE_ALL_MY_DATA'
                })
            });

            if (response.ok) {
                this.showNotification('All data deleted successfully. Redirecting...', 'success');
                // Clear local storage and redirect
                localStorage.removeItem('solace_token');
                setTimeout(() => {
                    window.location.href = 'landing.html';
                }, 3000);
            } else {
                throw new Error('Failed to delete all data');
            }
        } catch (error) {
            console.error('Error deleting all data:', error);
            this.showNotification('Failed to delete all data', 'error');
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function logout() {
    localStorage.removeItem('solace_token');
    window.location.href = 'landing.html';
}

function saveSettings() {
    dashboard.saveSettings();
}

function saveConsentPreferences() {
    dashboard.saveConsentPreferences();
}

function exportUserData() {
    dashboard.exportUserData();
}

function deleteDataCategory(category) {
    dashboard.deleteDataCategory(category);
}

function deleteAllUserData() {
    dashboard.deleteAllUserData();
}

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});