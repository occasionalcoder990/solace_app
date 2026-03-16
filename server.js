require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const OpenAI = require('openai');
const AIService = require('./ai-service');
const PersonalizationService = require('./personalization-service');
const PersonalityAnalysisService = require('./personality-analysis-service');
const MilestoneEngine = require('./milestone-engine');
const EngagementAnalyticsService = require('./engagement-analytics-service');
const RetentionService = require('./retention-service');
const PrivacyService = require('./privacy-service');
const EncryptionService = require('./encryption-service');

const app = express();
const PORT = process.env.PORT || 9999;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup with error handling
const DB_DIR = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/data' : __dirname;
const DB_PATH = path.join(DB_DIR, 'companion.db');
const SESSIONS_DB_PATH = path.join(DB_DIR, 'sessions.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to SQLite database at', DB_PATH);
  }
});

// Session middleware
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: DB_DIR
  }),
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Initialize services after database
let personalizationService;
let aiService;
let personalityAnalysisService;
let milestoneEngine;
let engagementAnalyticsService;
let retentionService;
let privacyService;
let encryptionService;

// Initialize database tables
db.serialize(() => {
  console.log('🔧 Initializing database tables...');
  
  // Users table with authentication
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    personality_profile TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating users table:', err);
    } else {
      console.log('✅ Users table created/verified');
    }
  });

  // User sessions table
  db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_token TEXT UNIQUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating user_sessions table:', err);
    } else {
      console.log('✅ User sessions table created/verified');
    }
  });

  // Conversations table with enhanced metadata
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT,
    response TEXT,
    emotion_detected TEXT,
    topics TEXT,
    mood_score INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating conversations table:', err);
    } else {
      console.log('✅ Conversations table created/verified');
    }
  });

  // Personal memories and insights
  db.run(`CREATE TABLE IF NOT EXISTS user_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    memory_type TEXT,
    content TEXT,
    importance_score INTEGER DEFAULT 1,
    last_referenced DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Emotional patterns and insights
  db.run(`CREATE TABLE IF NOT EXISTS emotional_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    pattern_type TEXT,
    pattern_data TEXT,
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Personal milestones and achievements
  db.run(`CREATE TABLE IF NOT EXISTS user_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    milestone_type TEXT,
    title TEXT,
    description TEXT,
    achieved_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Enhanced companion settings
  db.run(`CREATE TABLE IF NOT EXISTS companion_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    companion_name TEXT DEFAULT 'Your Companion',
    companion_personality TEXT,
    communication_style TEXT,
    response_tone TEXT,
    memory_enabled INTEGER DEFAULT 1,
    relationship_stage TEXT DEFAULT 'getting_to_know',
    inside_jokes TEXT,
    personal_rituals TEXT,
    favorite_topics TEXT,
    conversation_depth_preference INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
  
  // Initialize services after database tables are created
  console.log('🚀 Initializing AI and personalization services...');
  encryptionService = new EncryptionService();
  privacyService = new PrivacyService(db);
  personalizationService = new PersonalizationService(db);
  personalityAnalysisService = new PersonalityAnalysisService(db, encryptionService, privacyService);
  milestoneEngine = new MilestoneEngine(db);
  engagementAnalyticsService = new EngagementAnalyticsService(db);
  retentionService = new RetentionService(db, personalityAnalysisService, aiService);
  aiService = new AIService(personalizationService);
  
  // Start retention service notification processor
  setTimeout(() => {
    retentionService.startNotificationProcessor(15); // Check every 15 minutes
    
    // Schedule daily check for all users (run every 24 hours)
    setInterval(() => {
      retentionService.checkAllUsersForNotifications();
    }, 24 * 60 * 60 * 1000);
    
    console.log('🔔 Retention service started with notification processing');
  }, 5000); // Wait 5 seconds for all services to be ready
  
  console.log('✅ All services initialized successfully!');
});

// Helper functions for emotion detection and mood analysis

/**
 * Basic emotion detection from message content
 */
function detectBasicEmotion(message) {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // Define emotion keywords
  const emotionKeywords = {
    happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'fantastic', 'love', 'grateful', 'thankful', 'blessed'],
    sad: ['sad', 'depressed', 'down', 'upset', 'hurt', 'crying', 'tears', 'heartbroken', 'devastated', 'miserable'],
    angry: ['angry', 'mad', 'furious', 'rage', 'irritated', 'annoyed', 'frustrated', 'pissed', 'livid'],
    anxious: ['anxious', 'worried', 'nervous', 'scared', 'afraid', 'panic', 'stress', 'overwhelmed', 'tense'],
    confused: ['confused', 'lost', 'uncertain', 'unsure', 'puzzled', 'bewildered', 'perplexed'],
    hopeful: ['hope', 'hopeful', 'optimistic', 'positive', 'confident', 'determined', 'motivated'],
    lonely: ['lonely', 'alone', 'isolated', 'disconnected', 'abandoned', 'empty']
  };
  
  // Check for emotion keywords
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return emotion;
      }
    }
  }
  
  return null;
}

/**
 * Basic mood scoring from message sentiment (1-10 scale)
 */
function calculateBasicMoodScore(message) {
  if (!message) return 5; // Neutral default
  
  const lowerMessage = message.toLowerCase();
  let score = 5; // Start neutral
  
  // Positive indicators
  const positiveWords = ['good', 'great', 'happy', 'love', 'wonderful', 'amazing', 'fantastic', 'excited', 'grateful', 'thankful', 'blessed', 'hope', 'better', 'improving', 'progress'];
  const strongPositiveWords = ['incredible', 'outstanding', 'perfect', 'brilliant', 'extraordinary', 'phenomenal'];
  
  // Negative indicators
  const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'frustrated', 'worried', 'scared', 'hurt', 'upset', 'difficult', 'hard', 'struggle', 'problem'];
  const strongNegativeWords = ['devastating', 'horrible', 'nightmare', 'disaster', 'catastrophic', 'unbearable'];
  
  // Count positive words
  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) score += 0.5;
  });
  
  strongPositiveWords.forEach(word => {
    if (lowerMessage.includes(word)) score += 1;
  });
  
  // Count negative words
  negativeWords.forEach(word => {
    if (lowerMessage.includes(word)) score -= 0.5;
  });
  
  strongNegativeWords.forEach(word => {
    if (lowerMessage.includes(word)) score -= 1;
  });
  
  // Adjust for question marks (often indicate uncertainty/concern)
  const questionMarks = (message.match(/\?/g) || []).length;
  if (questionMarks > 2) score -= 0.3;
  
  // Adjust for exclamation marks (often indicate strong emotion)
  const exclamationMarks = (message.match(/!/g) || []).length;
  if (exclamationMarks > 0) {
    // Could be positive or negative, so check context
    if (score > 5) score += 0.3; // Amplify positive
    else if (score < 5) score -= 0.3; // Amplify negative
  }
  
  // Clamp score between 1 and 10
  return Math.max(1, Math.min(10, Math.round(score * 2) / 2)); // Round to nearest 0.5
}

// Helper functions for milestone system
async function buildUserDataForMilestones(userId, conversationCount, relationshipStage, user) {
  try {
    // Get user progress data
    const userProgress = await milestoneEngine.getUserProgress(userId);
    
    // Get conversation analytics
    const conversationAnalytics = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          COUNT(*) as total_conversations,
          MAX(emotion_detected) as max_emotion,
          AVG(mood_score) as avg_mood
        FROM conversations 
        WHERE user_id = ?
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0] || {});
      });
    });
    
    // Calculate daily streak (simplified - could be enhanced)
    const dailyStreak = await calculateDailyStreak(userId);
    
    return {
      conversationCount: conversationCount,
      relationshipStage: relationshipStage,
      onboardingComplete: user.onboarding_complete === 1,
      personalityInsights: !!user.personality_insights,
      firstSessionCompleted: user.first_session_completed === 1,
      moodBaseline: !!conversationAnalytics.avg_mood,
      dailyStreak: dailyStreak,
      maxEmotionalDepth: 0.5, // Placeholder - would be calculated from conversation analysis
      emotionalInsights: 0, // Placeholder - would be calculated from insights
      copingStrategiesUsed: 0, // Placeholder - would be tracked from conversations
      vulnerabilityShared: conversationCount >= 5 ? 1 : 0 // Simplified heuristic
    };
  } catch (error) {
    console.error('Error building user data for milestones:', error);
    return {
      conversationCount: conversationCount,
      relationshipStage: relationshipStage,
      onboardingComplete: false,
      personalityInsights: false,
      firstSessionCompleted: false,
      moodBaseline: false,
      dailyStreak: 0,
      maxEmotionalDepth: 0,
      emotionalInsights: 0,
      copingStrategiesUsed: 0,
      vulnerabilityShared: 0
    };
  }
}

async function calculateDailyStreak(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT DATE(timestamp) as conversation_date
      FROM conversations 
      WHERE user_id = ?
      GROUP BY DATE(timestamp)
      ORDER BY conversation_date DESC
    `, [userId], (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!results || results.length === 0) {
        resolve(0);
        return;
      }
      
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < results.length; i++) {
        const conversationDate = new Date(results[i].conversation_date);
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        
        if (conversationDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
      
      resolve(streak);
    });
  });
}

function calculateStageProgress(conversationCount, stage) {
  const stageThresholds = {
    'getting_to_know': { min: 0, max: 5 },
    'comfortable': { min: 5, max: 10 },
    'close_friend': { min: 10, max: 25 },
    'trusted_confidant': { min: 25, max: 50 },
    'life_companion': { min: 50, max: 100 }
  };
  
  const threshold = stageThresholds[stage] || stageThresholds['getting_to_know'];
  const progress = Math.min(((conversationCount - threshold.min) / (threshold.max - threshold.min)) * 100, 100);
  return Math.max(progress, 0);
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        console.error('❌ Database error during user check:', err);
        return res.status(500).json({ error: 'Database connection issue. Please try again.' });
      }
      
      console.log('✅ Database query successful, checking existing user...');
      
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }
      
      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Create user
      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [email, passwordHash, name],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          // Generate JWT token
          const token = jwt.sign(
            { userId: this.lastID, email: email },
            JWT_SECRET,
            { expiresIn: '30d' }
          );
          
          res.json({
            message: 'User created successfully',
            token: token,
            user: {
              id: this.lastID,
              email: email,
              name: name,
              onboardingComplete: false
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
      
      // Check password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
      
      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      res.json({
        message: 'Login successful',
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingComplete: user.onboarding_complete === 1
        },
        redirectTo: user.onboarding_complete === 1 ? 'home.html' : 'journey.html'
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', authenticateToken, (req, res) => {
  // In a more complex setup, you'd invalidate the token
  res.json({ message: 'Logged out successfully' });
});

// Privacy and audit endpoints
app.get('/api/personality-audit-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const auditLog = await privacyService.getPersonalityAuditLog(userId);
    
    res.json({
      success: true,
      auditLog: auditLog,
      message: 'Personality data audit log retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving personality audit log:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

app.get('/api/privacy/audit-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const auditLog = await privacyService.getUserAuditLog(userId);
    
    res.json({
      success: true,
      auditLog: auditLog,
      message: 'General audit log retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving general audit log:', error);
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// API Routes
app.post('/api/onboarding', authenticateToken, async (req, res) => {
  const { answers } = req.body;
  const userId = req.user.userId;
  
  // Encrypt questionnaire responses before storing
  const encryptedPersonalityProfile = encryptionService.encryptQuestionnaireResponses(answers);
  
  // Check if services are initialized
  if (!personalizationService || !personalityAnalysisService || !milestoneEngine) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    console.log(`🔄 Processing onboarding for user ${userId}...`);
    
    // Step 1: Analyze personality from questionnaire answers
    console.log('🧠 Analyzing personality insights...');
    const personalityAnalysis = await personalityAnalysisService.analyzePersonality(answers);
    
    // Step 2: Store personality insights in database with encryption and audit logging
    console.log('💾 Storing encrypted personality insights...');
    await personalityAnalysisService.storePersonalityInsights(userId, personalityAnalysis, req);
    
    // Step 3: Update user profile with encrypted completion data
    const completionTime = new Date().toISOString();
    
    // Encrypt communication preferences and emotional profile
    const encryptedCommunicationPreferences = encryptionService.encryptCommunicationPreferences({
      style: personalityAnalysis.communicationStyle.primary,
      description: personalityAnalysis.communicationStyle.description
    });
    
    const encryptedEmotionalProfile = encryptionService.encryptEmotionalProfile({
      needs: personalityAnalysis.emotionalNeeds.primary,
      coping: personalityAnalysis.copingStyle.primary,
      description: personalityAnalysis.emotionalNeeds.description
    });
    
    // Encrypt personality insights summary
    const encryptedPersonalityInsights = encryptionService.encryptPersonalityInsights(personalityAnalysis);
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET 
         personality_profile = ?, 
         onboarding_complete = 1, 
         onboarding_completion_time = ?,
         communication_preferences = ?,
         emotional_profile = ?,
         personality_insights = ?
         WHERE id = ?`,
        [
          encryptedPersonalityProfile, 
          completionTime,
          encryptedCommunicationPreferences,
          encryptedEmotionalProfile,
          encryptedPersonalityInsights,
          userId
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Log the onboarding data storage for audit
    await privacyService.logPersonalityDataAccess(
      userId, 
      'store_onboarding_data', 
      'questionnaire_responses', 
      'onboarding_completion',
      req
    );
    
    // Step 4: Create enhanced companion settings based on personality analysis with encryption
    const communicationStyle = personalityAnalysis.communicationStyle.primary;
    const responseTone = personalityAnalysis.emotionalNeeds.primary;
    
    // Encrypt the detailed personality data for companion settings
    const encryptedOnboardingPersonality = encryptionService.encryptPersonalityData({
      communicationStyle: personalityAnalysis.communicationStyle,
      emotionalNeeds: personalityAnalysis.emotionalNeeds,
      copingStyle: personalityAnalysis.copingStyle,
      uniqueness: personalityAnalysis.uniquenessFactors
    });
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO companion_settings 
         (user_id, communication_style, response_tone, onboarding_based_personality) 
         VALUES (?, ?, ?, ?)`,
        [userId, communicationStyle, responseTone, encryptedOnboardingPersonality],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Step 5: Initialize user progress tracking
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_progress 
         (user_id, current_stage, stage_progress, engagement_score, last_activity) 
         VALUES (?, 'getting_to_know', 10, 5, CURRENT_TIMESTAMP)`,
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Step 6: Extract and save initial memories from questionnaire (backward compatibility)
    const userName = answers[0];
    if (userName) {
      await personalizationService.saveMemories(userId, [{
        type: 'name_mention',
        content: `My name is ${userName}`,
        importance: 10
      }]);
    }
    
    // Save other important questionnaire insights as memories
    const importantAnswers = [
      { index: 1, type: 'coping_style', question: 'How they handle stress' },
      { index: 2, type: 'emotional_needs', question: 'What they need when overwhelmed' },
      { index: 3, type: 'communication_style', question: 'How they prefer to communicate' },
      { index: 12, type: 'primary_need', question: 'Their biggest emotional need' }
    ];
    
    for (const item of importantAnswers) {
      if (answers[item.index]) {
        await personalizationService.saveMemories(userId, [{
          type: item.type,
          content: `${item.question}: ${answers[item.index]}`,
          importance: 8
        }]);
      }
    }
    
    // Step 7: Check for onboarding milestones with enhanced milestone engine
    const userData = await buildUserDataForMilestones(userId, 0, 'getting_to_know', {
      onboarding_complete: 1,
      personality_insights: JSON.stringify(personalityAnalysis),
      first_session_completed: 0
    });
    
    const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
    console.log(`🏆 Awarded ${newMilestones.length} onboarding milestones`);
    
    // Add backward compatibility milestone
    await personalizationService.addMilestone(userId, 'onboarding', 'Completed Personality Assessment', 
      'Shared personal insights to create a deeper connection');
    
    // Generate personality summary for response
    const personalitySummary = await personalityAnalysisService.generatePersonalitySummary(userId);
    
    console.log(`✅ Onboarding completed successfully for user ${userId}`);
    
    // Schedule first session follow-up notification
    if (retentionService) {
      try {
        await retentionService.scheduleNotification(userId, 'firstSession');
        console.log(`📅 Scheduled first session follow-up for user ${userId}`);
      } catch (retentionError) {
        console.error('Error scheduling first session notification:', retentionError);
      }
    }
    
    // Return enhanced response with personality insights
    res.json({ 
      userId: userId, 
      message: 'Onboarding complete',
      personalityInsights: {
        communicationStyle: personalitySummary.communicationStyle?.content,
        emotionalNeeds: personalitySummary.emotionalNeeds?.content,
        copingStyle: personalitySummary.copingStyle?.content,
        uniquenessFactors: personalitySummary.uniquenessFactors.map(f => f.content),
        confidence: personalitySummary.overallConfidence
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing enhanced onboarding:', error);
    
    // Fallback to basic onboarding if personality analysis fails
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET personality_profile = ?, onboarding_complete = 1 WHERE id = ?',
          [encryptedPersonalityProfile, userId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      console.log(`⚠️  Fallback onboarding completed for user ${userId}`);
      res.json({ userId: userId, message: 'Onboarding complete (basic mode)' });
      
    } catch (fallbackError) {
      console.error('❌ Fallback onboarding also failed:', fallbackError);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  console.log('🔥 CHAT ENDPOINT HIT!');
  const { message } = req.body;
  const userId = req.user.userId;
  console.log('📝 Message received:', message);
  console.log('👤 User ID:', userId);
  
  // Check if services are initialized
  if (!aiService || !personalizationService || !milestoneEngine || !engagementAnalyticsService) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    // Start or continue engagement session tracking
    if (!engagementAnalyticsService.hasActiveSession(userId)) {
      await engagementAnalyticsService.startSession(userId);
    }

    // Get user profile and companion settings
    const user = await new Promise((resolve, reject) => {
      db.get(`
        SELECT u.*, cs.communication_style, cs.response_tone, cs.companion_name, cs.relationship_stage
        FROM users u 
        LEFT JOIN companion_settings cs ON u.id = cs.user_id 
        WHERE u.id = ?
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get recent conversation history for context
    const conversationHistory = await new Promise((resolve, reject) => {
      db.all(
        'SELECT message, response FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 15',
        [userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results.reverse()); // Reverse to get chronological order
        }
      );
    });
    
    console.log('📚 Retrieved conversation history:', conversationHistory.length, 'messages');
    if (conversationHistory.length > 0) {
      console.log('🔍 Last conversation:', {
        message: conversationHistory[conversationHistory.length - 1].message.substring(0, 50),
        response: conversationHistory[conversationHistory.length - 1].response.substring(0, 50)
      });
    }
    
    // Get user insights for personalization
    const userInsights = await personalizationService.getUserInsights(userId);
    
    // Get personality insights from onboarding for enhanced personalization with audit logging
    let personalityInsights = null;
    try {
      personalityInsights = await personalityAnalysisService.getPersonalityInsights(userId, req);
    } catch (error) {
      console.log('No personality insights found, using questionnaire fallback');
    }
    
    // Generate AI response with personality-driven personalization
    console.log('🤖 Generating AI response for:', message);
    console.log('📚 Conversation history length:', conversationHistory.length);
    console.log('🧠 Personality insights available:', personalityInsights ? personalityInsights.length : 0);
    
    let response;
    
    // Special case: First session after onboarding - use personalized welcome
    if (conversationHistory.length === 0 && user.onboarding_complete === 1 && user.first_session_completed !== 1) {
      console.log('🎉 Generating personalized welcome message for first session');
      response = await aiService.generatePersonalizedWelcome(user, personalityInsights);
    } else {
      // Use enhanced personality-integrated response generation for all conversations
      // The generateResponse method now always includes personality-driven context
      response = await aiService.generateResponse(message, user, conversationHistory, userInsights, personalityInsights);
    }
    
    console.log('✅ AI Response generated:', response.substring(0, 100) + '...');
    
    // Save conversation and check for milestones
    db.run(
      'INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)',
      [userId, message, response],
      async (err) => {
        if (err) {
          console.error('Error saving conversation:', err);
        } else {
          // Enhanced engagement analytics tracking with emotion and mood detection
          try {
            // Basic emotion detection from message content
            const detectedEmotion = detectBasicEmotion(message);
            
            // Basic mood scoring based on message sentiment
            const moodScore = calculateBasicMoodScore(message);
            
            // Enhanced engagement analytics tracking with comprehensive metrics
            await engagementAnalyticsService.updateSessionMetrics(userId, {
              message,
              response,
              emotion_detected: detectedEmotion,
              mood_score: moodScore,
              milestoneAchieved: null, // Will be updated if milestone is achieved
              messageLength: message.length,
              responseLength: response.length,
              sessionContext: {
                isFirstSession: conversationHistory.length === 0 && user.onboarding_complete === 1,
                conversationCount: conversationHistory.length + 1,
                relationshipStage: user.relationship_stage || 'getting_to_know'
              }
            });
            
            // Update conversation record with detected emotion and mood
            db.run(
              'UPDATE conversations SET emotion_detected = ?, mood_score = ? WHERE user_id = ? AND message = ? ORDER BY timestamp DESC LIMIT 1',
              [detectedEmotion, moodScore, userId, message],
              (updateErr) => {
                if (updateErr) {
                  console.error('Error updating conversation with emotion/mood:', updateErr);
                }
              }
            );
          } catch (engagementError) {
            console.error('Error updating engagement metrics:', engagementError);
          }

          // Analyze conversation for personalization insights
          try {
            await personalizationService.analyzeConversation(userId, message, response);
            
            // Update relationship stage based on conversation count
            const conversationCount = conversationHistory.length + 1;
            let newStage = user.relationship_stage || 'getting_to_know';
            
            if (conversationCount >= 50 && newStage === 'trusted_confidant') {
              newStage = 'life_companion';
            } else if (conversationCount >= 25 && newStage === 'close_friend') {
              newStage = 'trusted_confidant';
            } else if (conversationCount >= 10 && newStage === 'comfortable') {
              newStage = 'close_friend';
            } else if (conversationCount >= 5 && newStage === 'getting_to_know') {
              newStage = 'comfortable';
            }
            
            if (newStage !== user.relationship_stage) {
              await personalizationService.updateRelationshipStage(userId, newStage);
              
              // Add milestone for relationship progression
              const milestoneTitle = `Relationship evolved to ${newStage.replace('_', ' ')}`;
              await personalizationService.addMilestone(userId, 'relationship', milestoneTitle, 
                `After ${conversationCount} conversations, your bond has deepened`);
            }
            
            // Check for milestone achievements with enhanced milestone engine
            const userData = await buildUserDataForMilestones(userId, conversationCount, newStage, user);
            const newMilestones = await milestoneEngine.checkMilestoneAchievements(userId, userData);
            
            // Update engagement analytics with milestone achievements
            if (newMilestones.length > 0) {
              try {
                await engagementAnalyticsService.updateSessionMetrics(userId, {
                  message,
                  response,
                  milestoneAchieved: newMilestones[0].title // Use first milestone achieved
                });
              } catch (engagementError) {
                console.error('Error updating engagement with milestone:', engagementError);
              }
            }
            
            // Award first session milestone if this is the first conversation
            if (conversationCount === 1 && user.onboarding_complete === 1) {
              // Mark first session as completed
              await new Promise((resolve, reject) => {
                db.run(
                  'UPDATE users SET first_session_completed = 1 WHERE id = ?',
                  [userId],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
              
              console.log(`🎉 First session completed for user ${userId}`);
            }
            
            // Update user progress tracking
            if (newMilestones.length > 0 || newStage !== user.relationship_stage) {
              const nextMilestones = await milestoneEngine.getNextMilestones(userId, userData);
              const nextMilestone = nextMilestones.length > 0 ? nextMilestones[0].title : null;
              
              await milestoneEngine.updateUserProgress(userId, {
                currentStage: newStage,
                stageProgress: calculateStageProgress(conversationCount, newStage),
                nextMilestone: nextMilestone,
                engagementScore: Math.min(conversationCount * 2, 100)
              });
            }
            
            // Update retention service with user activity
            if (retentionService) {
              try {
                // Cancel any pending first session notifications since user is now active
                await retentionService.cancelPendingNotifications(userId, 'firstSession');
                
                // Check and schedule appropriate notifications based on new activity
                await retentionService.checkUserActivityAndScheduleNotifications(userId);
              } catch (retentionError) {
                console.error('Error updating retention service:', retentionError);
              }
            }
            
          } catch (analysisError) {
            console.error('Error analyzing conversation:', analysisError);
          }
        }
      }
    );
    
    res.json({ response });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.get(`
    SELECT u.id, u.email, u.name, u.onboarding_complete, u.created_at,
           cs.companion_name, cs.communication_style, cs.response_tone
    FROM users u 
    LEFT JOIN companion_settings cs ON u.id = cs.user_id 
    WHERE u.id = ?
  `, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingComplete: user.onboarding_complete === 1,
        companionName: user.companion_name || 'Your Companion',
        communicationStyle: user.communication_style,
        responseTone: user.response_tone,
        memberSince: user.created_at
      }
    });
  });
});

// Get conversation history
app.get('/api/conversations', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const limit = req.query.limit || 50;
  
  db.all(
    'SELECT message, response, timestamp FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
    [userId, limit],
    (err, conversations) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ conversations });
    }
  );
});

// Guest chat endpoint (no authentication required)
app.post('/api/guest-chat', async (req, res) => {
  const { message, guestProfile } = req.body;
  
  // Check if services are initialized
  if (!aiService) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    // Create a temporary user object for guest mode
    const guestUser = {
      name: guestProfile?.name || 'friend',
      personality_profile: guestProfile ? JSON.stringify(guestProfile) : null
    };
    
    // Generate AI response for guest
    const response = await aiService.generateResponse(message, guestUser, []);
    
    res.json({ response });
    
  } catch (error) {
    console.error('Guest chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Get user insights and analytics
app.get('/api/insights', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  // Check if services are initialized
  if (!personalizationService) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    const insights = await personalizationService.getUserInsights(userId);
    res.json({ insights });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// Get personality insights from onboarding
app.get('/api/personality-insights', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  // Check if services are initialized
  if (!personalityAnalysisService) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    const personalityInsights = await personalityAnalysisService.getPersonalityInsights(userId);
    const personalitySummary = await personalityAnalysisService.generatePersonalitySummary(userId);
    
    res.json({ 
      insights: personalityInsights,
      summary: personalitySummary
    });
  } catch (error) {
    console.error('Error getting personality insights:', error);
    res.status(500).json({ error: 'Failed to get personality insights' });
  }
});

// Get user milestones
app.get('/api/milestones', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    'SELECT * FROM user_milestones WHERE user_id = ? ORDER BY achieved_date DESC',
    [userId],
    (err, milestones) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ milestones });
    }
  );
});

// Get milestone progress and next milestones
app.get('/api/milestone-progress', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  if (!milestoneEngine) {
    return res.status(500).json({ error: 'Milestone engine not initialized' });
  }
  
  try {
    // Get user data for milestone calculations
    const user = await new Promise((resolve, reject) => {
      db.get(`
        SELECT u.*, cs.relationship_stage, up.current_stage, up.stage_progress, up.next_milestone
        FROM users u 
        LEFT JOIN companion_settings cs ON u.id = cs.user_id 
        LEFT JOIN user_progress up ON u.id = up.user_id
        WHERE u.id = ?
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get conversation count
    const conversationCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?', [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Build user data for milestone calculations
    const userData = await buildUserDataForMilestones(userId, conversationCount, user.relationship_stage || 'getting_to_know', user);
    
    // Get milestone data
    const [achievedMilestones, nextMilestones, totalPoints, userProgress] = await Promise.all([
      milestoneEngine.getUserMilestones(userId),
      milestoneEngine.getNextMilestones(userId, userData),
      milestoneEngine.getUserMilestonePoints(userId),
      milestoneEngine.getUserProgress(userId)
    ]);
    
    res.json({
      achievedMilestones,
      nextMilestones: nextMilestones.slice(0, 5), // Show next 5 milestones
      totalPoints,
      userProgress,
      currentStage: user.current_stage || 'getting_to_know',
      stageProgress: user.stage_progress || 0
    });
    
  } catch (error) {
    console.error('Error getting milestone progress:', error);
    res.status(500).json({ error: 'Failed to get milestone progress' });
  }
});

// Get milestones by category
app.get('/api/milestones/:category', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { category } = req.params;
  
  if (!milestoneEngine) {
    return res.status(500).json({ error: 'Milestone engine not initialized' });
  }
  
  try {
    const milestones = await milestoneEngine.getMilestonesByCategory(userId, category);
    res.json({ milestones, category });
  } catch (error) {
    console.error('Error getting milestones by category:', error);
    res.status(500).json({ error: 'Failed to get milestones' });
  }
});

// Update companion settings
app.put('/api/companion-settings', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { companionName, conversationDepth } = req.body;
  
  db.run(
    `UPDATE companion_settings 
     SET companion_name = ?, conversation_depth_preference = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE user_id = ?`,
    [companionName, conversationDepth, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update settings' });
      }
      
      if (this.changes === 0) {
        // Create new settings if none exist
        db.run(
          'INSERT INTO companion_settings (user_id, companion_name, conversation_depth_preference) VALUES (?, ?, ?)',
          [userId, companionName, conversationDepth],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to create settings' });
            }
            res.json({ message: 'Settings created successfully' });
          }
        );
      } else {
        res.json({ message: 'Settings updated successfully' });
      }
    }
  );
});

// Get mood trends
app.get('/api/mood-trends', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const moodTrends = await personalizationService.getMoodTrends(userId);
    res.json({ moodTrends });
  } catch (error) {
    console.error('Error getting mood trends:', error);
    res.status(500).json({ error: 'Failed to get mood trends' });
  }
});

// Add manual milestone
app.post('/api/milestones', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { type, title, description } = req.body;
  
  try {
    await personalizationService.addMilestone(userId, type, title, description);
    res.json({ message: 'Milestone added successfully' });
  } catch (error) {
    console.error('Error adding milestone:', error);
    res.status(500).json({ error: 'Failed to add milestone' });
  }
});

// Get personalized welcome message
// Clear conversation history for testing
app.delete('/api/conversations', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    db.run('DELETE FROM conversations WHERE user_id = ?', [userId], (err) => {
      if (err) {
        console.error('Error clearing conversations:', err);
        return res.status(500).json({ error: 'Failed to clear conversations' });
      }
      res.json({ message: 'Conversations cleared successfully' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard API endpoints
// Enhanced dashboard stats endpoint for requirement 12
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 30;
  
  try {
    // Get basic conversation metrics
    const conversationCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?', [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
    
    // Get user info and account age
    const userInfo = await new Promise((resolve, reject) => {
      db.get('SELECT created_at, onboarding_complete FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    const daysActive = userInfo ? Math.ceil((Date.now() - new Date(userInfo.created_at)) / (1000 * 60 * 60 * 24)) : 1;
    
    // Get engagement analytics
    let engagementAnalytics = {};
    if (engagementAnalyticsService) {
      try {
        engagementAnalytics = await engagementAnalyticsService.getEngagementAnalytics(userId, days);
      } catch (error) {
        console.error('Error getting engagement analytics for dashboard:', error);
      }
    }
    
    // Get mood trends
    const moodTrends = await getMoodTrends(userId, days);
    const currentMood = moodTrends.length > 0 ? moodTrends[moodTrends.length - 1].mood : '5.0';
    
    // Get conversation patterns
    const conversationPatterns = await getConversationPatterns(userId, days);
    
    // Get milestone progress
    const milestoneProgress = await getMilestoneProgress(userId);
    
    // Calculate connection level based on conversation count and engagement
    let connectionLevel = 'New';
    if (conversationCount >= 100) connectionLevel = 'Deep Bond';
    else if (conversationCount >= 50) connectionLevel = 'Trusted Confidant';
    else if (conversationCount >= 30) connectionLevel = 'Close Friend';
    else if (conversationCount >= 15) connectionLevel = 'Comfortable';
    else if (conversationCount >= 5) connectionLevel = 'Growing';
    
    // Generate growth insights
    const growthInsights = await generateGrowthInsights(userId, {
      conversationCount,
      daysActive,
      engagementAnalytics,
      moodTrends,
      milestoneProgress
    });
    
    res.json({
      // Basic stats
      totalMessages: conversationCount,
      daysActive: daysActive,
      currentMood: parseFloat(currentMood),
      connectionLevel: connectionLevel,
      
      // Enhanced analytics for requirement 12
      moodTrends: moodTrends,
      conversationPatterns: conversationPatterns,
      milestoneProgress: milestoneProgress,
      engagementMetrics: {
        totalSessions: engagementAnalytics.totalSessions || 0,
        avgSessionDuration: engagementAnalytics.avgSessionDuration || 0,
        avgEmotionalDepth: engagementAnalytics.avgEmotionalDepth || 0,
        engagementTrend: engagementAnalytics.engagementTrend || 'stable',
        retentionRisk: engagementAnalytics.avgRetentionRisk || 0
      },
      
      // Actionable insights
      growthInsights: growthInsights,
      
      // Progress indicators
      progressIndicators: {
        emotionalAwareness: Math.min((engagementAnalytics.avgEmotionalDepth || 0) * 100, 100),
        conversationDepth: Math.min(((conversationPatterns.avgMessageLength || 0) / 200) * 100, 100),
        consistency: Math.min(((engagementAnalytics.totalSessions || 0) / (days / 7)) * 20, 100),
        milestoneProgress: milestoneProgress.stageProgress || 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching enhanced dashboard stats:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

/**
 * Generates growth insights showing connection between user actions and improvement
 */
async function generateGrowthInsights(userId, data) {
  const insights = [];
  
  try {
    const { conversationCount, daysActive, engagementAnalytics, moodTrends, milestoneProgress } = data;
    
    // Insight 1: Conversation frequency impact
    const conversationsPerDay = conversationCount / daysActive;
    if (conversationsPerDay > 0.5) {
      insights.push({
        type: 'positive',
        category: 'consistency',
        title: 'Strong Engagement Pattern',
        message: `Your ${conversationsPerDay.toFixed(1)} conversations per day show commitment to growth.`,
        impact: 'This consistency helps build emotional awareness and self-reflection skills.',
        nextStep: 'Continue this pattern to deepen your insights and emotional intelligence.'
      });
    } else if (conversationsPerDay < 0.2) {
      insights.push({
        type: 'opportunity',
        category: 'consistency',
        title: 'Growth Through Consistency',
        message: 'More frequent conversations could accelerate your personal development.',
        impact: 'Regular reflection builds stronger emotional patterns and self-awareness.',
        nextStep: 'Try having 2-3 conversations per week to see faster progress.'
      });
    }
    
    // Insight 2: Mood trend analysis
    if (moodTrends.length >= 7) {
      const recentMoods = moodTrends.slice(-7);
      const earlierMoods = moodTrends.slice(0, 7);
      
      const recentAvg = recentMoods.reduce((sum, t) => sum + parseFloat(t.mood), 0) / recentMoods.length;
      const earlierAvg = earlierMoods.reduce((sum, t) => sum + parseFloat(t.mood), 0) / earlierMoods.length;
      
      if (recentAvg > earlierAvg + 0.5) {
        insights.push({
          type: 'celebration',
          category: 'emotional_growth',
          title: 'Mood Improvement Detected',
          message: `Your mood has improved by ${(recentAvg - earlierAvg).toFixed(1)} points recently.`,
          impact: 'This shows your conversations are having a positive emotional impact.',
          nextStep: 'Reflect on what topics or approaches have been most helpful.'
        });
      } else if (recentAvg < earlierAvg - 0.5) {
        insights.push({
          type: 'support',
          category: 'emotional_growth',
          title: 'Emotional Support Available',
          message: 'Your recent mood patterns suggest you might benefit from additional support.',
          impact: 'Addressing challenging emotions early can prevent deeper difficulties.',
          nextStep: 'Consider exploring what\'s been affecting your mood in conversations.'
        });
      }
    }
    
    // Insight 3: Milestone achievement impact
    if (milestoneProgress.recentAchievements && milestoneProgress.recentAchievements.length > 0) {
      const recentAchievement = milestoneProgress.recentAchievements[0];
      insights.push({
        type: 'celebration',
        category: 'achievement',
        title: 'Recent Achievement Impact',
        message: `Achieving "${recentAchievement.title}" shows your growth in ${recentAchievement.milestone_type}.`,
        impact: 'Milestones mark real progress in your emotional development journey.',
        nextStep: 'Build on this success by continuing the behaviors that led to this achievement.'
      });
    }
    
    // Insight 4: Emotional depth correlation
    if (engagementAnalytics.avgEmotionalDepth > 0.6) {
      insights.push({
        type: 'positive',
        category: 'emotional_depth',
        title: 'Deep Emotional Engagement',
        message: 'Your willingness to share emotions is accelerating your growth.',
        impact: 'Emotional openness directly correlates with better self-understanding.',
        nextStep: 'Continue exploring your emotional responses to build greater self-awareness.'
      });
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating growth insights:', error);
    return [];
  }
}

app.get('/api/dashboard/activity', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    // Get recent conversations for activity feed
    const recentConversations = await new Promise((resolve, reject) => {
      db.all(
        'SELECT message, response, timestamp FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5',
        [userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });
    
    const activities = recentConversations.map(conv => ({
      icon: '💬',
      text: `You shared: "${conv.message.substring(0, 50)}${conv.message.length > 50 ? '...' : ''}"`,
      timestamp: conv.timestamp
    }));
    
    // Add welcome activity if no conversations
    if (activities.length === 0) {
      activities.push({
        icon: '✨',
        text: 'Welcome to your personal space! Start a conversation to see your journey unfold.',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ activities });
    
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    res.json({ activities: [] });
  }
});

app.post('/api/companion/update-name', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { companionName } = req.body;
  
  if (!companionName || !companionName.trim()) {
    return res.status(400).json({ error: 'Companion name is required' });
  }
  
  try {
    // Update or insert companion settings
    db.run(
      `INSERT OR REPLACE INTO companion_settings 
       (user_id, companion_name, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, companionName.trim()],
      (err) => {
        if (err) {
          console.error('Error updating companion name:', err);
          return res.status(500).json({ error: 'Failed to update companion name' });
        }
        res.json({ message: 'Companion name updated successfully' });
      }
    );
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/personalized-welcome', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  // Check if services are initialized
  if (!aiService) {
    return res.status(500).json({ error: 'Services not initialized yet. Please try again.' });
  }
  
  try {
    // Get user profile with personality data
    const user = await new Promise((resolve, reject) => {
      db.get(`
        SELECT u.*, cs.communication_style, cs.response_tone, cs.companion_name, cs.relationship_stage
        FROM users u 
        LEFT JOIN companion_settings cs ON u.id = cs.user_id 
        WHERE u.id = ?
      `, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    if (!user || !user.personality_profile) {
      return res.status(404).json({ error: 'User profile not found or onboarding not complete' });
    }
    
    // Generate personalized welcome message
    const welcomeMessage = aiService.generatePersonalizedWelcome(user);
    
    res.json({ welcomeMessage });
    
  } catch (error) {
    console.error('Error generating personalized welcome:', error);
    res.status(500).json({ error: 'Failed to generate welcome message' });
  }
});

// Enhanced personalized response generator
function generatePersonalizedResponse(message, user) {
  const profile = user.personality_profile ? JSON.parse(user.personality_profile) : {};
  const communicationStyle = user.communication_style || 'supportive';
  const responseTone = user.response_tone || 'empathetic';
  const userName = user.name || 'friend';
  
  // Analyze message sentiment and content
  const messageLower = message.toLowerCase();
  let response = '';
  
  // Emotional responses based on user's communication preferences
  if (messageLower.includes('sad') || messageLower.includes('down') || messageLower.includes('depressed')) {
    if (communicationStyle.includes('gentle')) {
      response = `${userName}, I can sense you're going through a difficult time right now. Your feelings are completely valid, and I want you to know that it's okay to feel this way. `;
    } else if (communicationStyle.includes('direct')) {
      response = `${userName}, I hear that you're feeling down. That's tough, and I appreciate you sharing that with me. `;
    } else {
      response = `I'm really sorry you're feeling this way, ${userName}. It sounds like you're carrying some heavy emotions right now. `;
    }
    
    if (responseTone.includes('practical')) {
      response += "Would it help to talk through what's contributing to these feelings, or would you prefer we explore some ways to help you feel a bit better?";
    } else {
      response += "I'm here to listen and support you through this. What's been weighing most heavily on your heart?";
    }
  }
  
  else if (messageLower.includes('anxious') || messageLower.includes('worried') || messageLower.includes('stress')) {
    if (communicationStyle.includes('gentle')) {
      response = `${userName}, I can feel the worry in your words. Anxiety can be so overwhelming, and I want you to know you're not alone in this. `;
    } else {
      response = `${userName}, it sounds like anxiety is really affecting you right now. That's incredibly difficult to deal with. `;
    }
    
    response += "Sometimes it helps to share what's creating these worried feelings. What's been on your mind lately?";
  }
  
  else if (messageLower.includes('happy') || messageLower.includes('good') || messageLower.includes('excited') || messageLower.includes('great')) {
    response = `${userName}, I love hearing the joy in your message! It's wonderful that you're feeling good. What's been bringing you this happiness?`;
  }
  
  else if (messageLower.includes('angry') || messageLower.includes('frustrated') || messageLower.includes('mad')) {
    if (communicationStyle.includes('gentle')) {
      response = `${userName}, I can sense your frustration, and those feelings are completely understandable. `;
    } else {
      response = `${userName}, it sounds like something has really upset you. `;
    }
    response += "Sometimes anger is our way of protecting ourselves when we feel hurt or overwhelmed. What happened that's making you feel this way?";
  }
  
  else if (messageLower.includes('lonely') || messageLower.includes('alone') || messageLower.includes('isolated')) {
    response = `${userName}, feeling lonely can be one of the most painful experiences. I want you to know that even though you might feel alone, you're not - I'm here with you right now. What's been making you feel most isolated lately?`;
  }
  
  else if (messageLower.includes('tired') || messageLower.includes('exhausted') || messageLower.includes('drained')) {
    response = `${userName}, it sounds like you're really feeling the weight of everything right now. Being emotionally or physically drained is so hard. What's been taking the most energy out of you?`;
  }
  
  else if (messageLower.includes('confused') || messageLower.includes('lost') || messageLower.includes('don\'t know')) {
    response = `${userName}, feeling uncertain or confused is such a human experience. It's okay not to have all the answers right now. Sometimes talking through our thoughts can help bring clarity. What's been feeling most unclear to you?`;
  }
  
  else {
    // Default personalized response
    if (communicationStyle.includes('deep')) {
      response = `${userName}, I'm here and ready to listen to whatever you'd like to share. What's been on your mind or in your heart today?`;
    } else if (communicationStyle.includes('casual')) {
      response = `Hey ${userName}, what's going on? I'm here to chat about whatever you need.`;
    } else {
      response = `${userName}, I'm here for you. What would you like to talk about today?`;
    }
  }
  
  return response;
}

// Helper functions for enhanced engagement analytics

/**
 * Generates actionable insights about user engagement patterns
 */
async function generateEngagementInsights(userId, analytics) {
  const insights = [];
  
  try {
    // Insight 1: Engagement trend analysis
    if (analytics.engagementTrend === 'improving') {
      insights.push({
        type: 'positive',
        title: 'Growing Connection',
        message: 'Your conversations are becoming more meaningful over time. Keep exploring deeper topics!',
        actionable: 'Try sharing something personal in your next conversation.'
      });
    } else if (analytics.engagementTrend === 'declining') {
      insights.push({
        type: 'concern',
        title: 'Engagement Opportunity',
        message: 'Your recent conversations have been shorter. Consider exploring topics that interest you more.',
        actionable: 'Ask about something you\'ve been curious about or share a recent experience.'
      });
    }
    
    // Insight 2: Emotional depth analysis
    if (analytics.avgEmotionalDepth > 0.6) {
      insights.push({
        type: 'positive',
        title: 'Deep Emotional Connection',
        message: 'You\'re sharing meaningful emotions and experiences. This depth strengthens your growth.',
        actionable: 'Continue exploring your feelings and reactions to build self-awareness.'
      });
    } else if (analytics.avgEmotionalDepth < 0.3) {
      insights.push({
        type: 'suggestion',
        title: 'Opportunity for Deeper Connection',
        message: 'Your conversations could benefit from more emotional sharing.',
        actionable: 'Try describing how situations make you feel, not just what happened.'
      });
    }
    
    // Insight 3: Session frequency analysis
    const sessionsPerWeek = analytics.totalSessions / (analytics.dailyActivity.length / 7);
    if (sessionsPerWeek < 2) {
      insights.push({
        type: 'suggestion',
        title: 'Consistency Builds Growth',
        message: 'Regular conversations help build stronger emotional patterns and insights.',
        actionable: 'Try setting a reminder for 2-3 conversations per week.'
      });
    } else if (sessionsPerWeek > 5) {
      insights.push({
        type: 'positive',
        title: 'Highly Engaged',
        message: 'Your frequent conversations show strong commitment to personal growth.',
        actionable: 'Consider reflecting on patterns you\'ve noticed in your recent conversations.'
      });
    }
    
    // Insight 4: Milestone achievement analysis
    if (analytics.milestonesAchieved > 0) {
      insights.push({
        type: 'celebration',
        title: 'Achievement Unlocked',
        message: `You've achieved ${analytics.milestonesAchieved} milestone${analytics.milestonesAchieved > 1 ? 's' : ''} recently!`,
        actionable: 'Celebrate your progress and set intentions for continued growth.'
      });
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating engagement insights:', error);
    return [];
  }
}

/**
 * Gets mood trends over time for dashboard visualization
 */
async function getMoodTrends(userId, days) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        DATE(timestamp) as date,
        AVG(CASE 
          WHEN mood_score IS NOT NULL THEN mood_score 
          ELSE 5 
        END) as avg_mood,
        COUNT(*) as conversation_count
      FROM conversations 
      WHERE user_id = ? 
        AND timestamp > datetime('now', '-${days} days')
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `, [userId], (err, results) => {
      if (err) {
        console.error('Error getting mood trends:', err);
        resolve([]);
      } else {
        const trends = results.map(row => ({
          date: row.date,
          mood: parseFloat(row.avg_mood).toFixed(1),
          conversations: row.conversation_count
        }));
        resolve(trends);
      }
    });
  });
}

/**
 * Analyzes conversation patterns for insights
 */
async function getConversationPatterns(userId, days) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        strftime('%H', timestamp) as hour,
        strftime('%w', timestamp) as day_of_week,
        LENGTH(message) as message_length,
        emotion_detected,
        topics
      FROM conversations 
      WHERE user_id = ? 
        AND timestamp > datetime('now', '-${days} days')
      ORDER BY timestamp DESC
    `, [userId], (err, results) => {
      if (err) {
        console.error('Error getting conversation patterns:', err);
        resolve({});
      } else {
        // Analyze patterns
        const patterns = {
          preferredHours: {},
          preferredDays: {},
          avgMessageLength: 0,
          commonEmotions: {},
          commonTopics: {}
        };
        
        if (results.length > 0) {
          // Calculate preferred hours
          results.forEach(row => {
            const hour = parseInt(row.hour);
            patterns.preferredHours[hour] = (patterns.preferredHours[hour] || 0) + 1;
            
            const day = parseInt(row.day_of_week);
            patterns.preferredDays[day] = (patterns.preferredDays[day] || 0) + 1;
            
            if (row.emotion_detected) {
              patterns.commonEmotions[row.emotion_detected] = (patterns.commonEmotions[row.emotion_detected] || 0) + 1;
            }
          });
          
          patterns.avgMessageLength = results.reduce((sum, row) => sum + (row.message_length || 0), 0) / results.length;
          
          // Find most active hour and day
          patterns.mostActiveHour = Object.keys(patterns.preferredHours).reduce((a, b) => 
            patterns.preferredHours[a] > patterns.preferredHours[b] ? a : b
          );
          
          patterns.mostActiveDay = Object.keys(patterns.preferredDays).reduce((a, b) => 
            patterns.preferredDays[a] > patterns.preferredDays[b] ? a : b
          );
          
          // Convert day number to name
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          patterns.mostActiveDayName = dayNames[parseInt(patterns.mostActiveDay)];
        }
        
        resolve(patterns);
      }
    });
  });
}

/**
 * Gets milestone progress for dashboard
 */
async function getMilestoneProgress(userId) {
  try {
    if (!milestoneEngine) {
      return { currentStage: 'getting_to_know', progress: 0, nextMilestones: [] };
    }
    
    const userProgress = await milestoneEngine.getUserProgress(userId);
    const nextMilestones = await milestoneEngine.getNextMilestones(userId, userProgress);
    
    // Get recent milestone achievements
    const recentMilestones = await new Promise((resolve, reject) => {
      db.all(`
        SELECT title, description, achieved_date, milestone_type
        FROM user_milestones 
        WHERE user_id = ? 
        ORDER BY achieved_date DESC 
        LIMIT 5
      `, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results || []);
      });
    });
    
    return {
      currentStage: userProgress.currentStage || 'getting_to_know',
      stageProgress: userProgress.stageProgress || 0,
      engagementScore: userProgress.engagementScore || 0,
      nextMilestones: nextMilestones.slice(0, 3), // Show next 3 milestones
      recentAchievements: recentMilestones
    };
  } catch (error) {
    console.error('Error getting milestone progress:', error);
    return { currentStage: 'getting_to_know', progress: 0, nextMilestones: [] };
  }
}

/**
 * Assesses retention risk and provides recommendations
 */
async function getRetentionRiskAssessment(userId, analytics) {
  const assessment = {
    riskLevel: 'low', // low, medium, high
    riskScore: analytics.avgRetentionRisk || 0,
    riskFactors: analytics.riskFactors || [],
    recommendations: []
  };
  
  // Determine risk level
  if (assessment.riskScore > 0.7) {
    assessment.riskLevel = 'high';
  } else if (assessment.riskScore > 0.4) {
    assessment.riskLevel = 'medium';
  }
  
  // Generate recommendations based on risk factors
  if (assessment.riskFactors.includes('Low emotional engagement')) {
    assessment.recommendations.push({
      priority: 'high',
      action: 'Share more about your feelings',
      description: 'Try describing emotions behind your experiences to deepen conversations.'
    });
  }
  
  if (assessment.riskFactors.includes('Declining engagement pattern')) {
    assessment.recommendations.push({
      priority: 'high',
      action: 'Explore new conversation topics',
      description: 'Ask about areas you haven\'t discussed yet or share recent experiences.'
    });
  }
  
  if (assessment.riskFactors.includes('Infrequent usage pattern')) {
    assessment.recommendations.push({
      priority: 'medium',
      action: 'Set a conversation routine',
      description: 'Regular check-ins help build stronger emotional awareness and growth.'
    });
  }
  
  // Add positive reinforcement for low risk users
  if (assessment.riskLevel === 'low') {
    assessment.recommendations.push({
      priority: 'low',
      action: 'Continue your great progress',
      description: 'Your engagement patterns show strong commitment to personal growth.'
    });
  }
  
  return assessment;
}

// Engagement Analytics API Endpoints

// Get engagement analytics for dashboard
app.get('/api/engagement-analytics', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 30;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const analytics = await engagementAnalyticsService.getEngagementAnalytics(userId, days);
    
    // Enhance analytics with additional insights for requirement 12
    const enhancedAnalytics = {
      ...analytics,
      insights: await generateEngagementInsights(userId, analytics),
      moodTrends: await getMoodTrends(userId, days),
      conversationPatterns: await getConversationPatterns(userId, days),
      milestoneProgress: await getMilestoneProgress(userId),
      retentionRiskAssessment: await getRetentionRiskAssessment(userId, analytics)
    };
    
    res.json({ analytics: enhancedAnalytics });
  } catch (error) {
    console.error('Error getting engagement analytics:', error);
    res.status(500).json({ error: 'Failed to get engagement analytics' });
  }
});

// Get recent engagement sessions
app.get('/api/engagement-sessions', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 10;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const sessions = await engagementAnalyticsService.getRecentSessions(userId, limit);
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting engagement sessions:', error);
    res.status(500).json({ error: 'Failed to get engagement sessions' });
  }
});

// Get current active session
app.get('/api/engagement-session/current', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const activeSession = engagementAnalyticsService.getActiveSession(userId);
    res.json({ activeSession });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// End current engagement session
app.post('/api/engagement-session/end', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const finalMetrics = await engagementAnalyticsService.endSession(userId, req.body);
    res.json({ message: 'Session ended successfully', metrics: finalMetrics });
  } catch (error) {
    console.error('Error ending engagement session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Mood trends endpoint for requirement 12.1
app.get('/api/dashboard/mood-trends', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 30;
  
  try {
    const moodTrends = await getMoodTrends(userId, days);
    
    // Calculate mood statistics
    const moodStats = {
      trends: moodTrends,
      summary: {
        averageMood: 0,
        moodRange: { min: 10, max: 0 },
        trendDirection: 'stable',
        totalDataPoints: moodTrends.length
      }
    };
    
    if (moodTrends.length > 0) {
      const moods = moodTrends.map(t => parseFloat(t.mood));
      moodStats.summary.averageMood = moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
      moodStats.summary.moodRange.min = Math.min(...moods);
      moodStats.summary.moodRange.max = Math.max(...moods);
      
      // Calculate trend direction
      if (moodTrends.length >= 7) {
        const recentMoods = moods.slice(-7);
        const earlierMoods = moods.slice(0, 7);
        const recentAvg = recentMoods.reduce((sum, mood) => sum + mood, 0) / recentMoods.length;
        const earlierAvg = earlierMoods.reduce((sum, mood) => sum + mood, 0) / earlierMoods.length;
        
        if (recentAvg > earlierAvg + 0.3) {
          moodStats.summary.trendDirection = 'improving';
        } else if (recentAvg < earlierAvg - 0.3) {
          moodStats.summary.trendDirection = 'declining';
        }
      }
    }
    
    res.json(moodStats);
  } catch (error) {
    console.error('Error getting mood trends:', error);
    res.status(500).json({ error: 'Failed to get mood trends' });
  }
});

// Conversation patterns endpoint for requirement 12.1
app.get('/api/dashboard/conversation-patterns', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 30;
  
  try {
    const patterns = await getConversationPatterns(userId, days);
    
    // Add insights about patterns
    const patternInsights = [];
    
    if (patterns.mostActiveHour) {
      const hour = parseInt(patterns.mostActiveHour);
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      patternInsights.push({
        type: 'pattern',
        message: `You're most active in the ${timeOfDay} (around ${hour}:00).`,
        suggestion: `Consider scheduling regular ${timeOfDay} check-ins for consistency.`
      });
    }
    
    if (patterns.avgMessageLength > 100) {
      patternInsights.push({
        type: 'positive',
        message: 'Your messages show thoughtful, detailed communication.',
        suggestion: 'This depth helps build stronger emotional insights.'
      });
    } else if (patterns.avgMessageLength < 50) {
      patternInsights.push({
        type: 'opportunity',
        message: 'Longer messages could help you explore topics more deeply.',
        suggestion: 'Try elaborating on your feelings and thoughts for better insights.'
      });
    }
    
    res.json({
      patterns,
      insights: patternInsights
    });
  } catch (error) {
    console.error('Error getting conversation patterns:', error);
    res.status(500).json({ error: 'Failed to get conversation patterns' });
  }
});

// Milestone progress endpoint for requirement 12.1 and 12.3
app.get('/api/dashboard/milestone-progress', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const milestoneProgress = await getMilestoneProgress(userId);
    
    // Add celebration messages for recent achievements
    const celebrationMessages = milestoneProgress.recentAchievements.map(achievement => ({
      title: achievement.title,
      message: `🎉 You achieved "${achievement.title}"!`,
      description: achievement.description,
      date: achievement.achieved_date,
      type: achievement.milestone_type
    }));
    
    res.json({
      ...milestoneProgress,
      celebrations: celebrationMessages,
      progressVisualization: {
        currentStageIndex: getStageIndex(milestoneProgress.currentStage),
        totalStages: 5,
        stageNames: ['Getting to Know', 'Comfortable', 'Close Friend', 'Trusted Confidant', 'Life Companion']
      }
    });
  } catch (error) {
    console.error('Error getting milestone progress:', error);
    res.status(500).json({ error: 'Failed to get milestone progress' });
  }
});

/**
 * Helper function to get stage index for progress visualization
 */
function getStageIndex(stageName) {
  const stages = {
    'getting_to_know': 0,
    'comfortable': 1,
    'close_friend': 2,
    'trusted_confidant': 3,
    'life_companion': 4
  };
  return stages[stageName] || 0;
}

// Retention analytics endpoint
app.get('/api/retention-analytics', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    // Get recent sessions for retention analysis
    const recentSessions = await engagementAnalyticsService.getRecentSessions(userId, 10);
    
    // Calculate retention metrics
    const retentionMetrics = {
      averageRetentionRisk: 0,
      sessionFrequency: 0,
      engagementTrend: 'stable',
      lastActivity: null,
      riskFactors: []
    };
    
    if (recentSessions.length > 0) {
      retentionMetrics.averageRetentionRisk = recentSessions.reduce((sum, s) => 
        sum + (s.retention_risk_score || 0), 0) / recentSessions.length;
      
      retentionMetrics.lastActivity = recentSessions[0].session_start;
      
      // Calculate session frequency (sessions per week)
      const oldestSession = recentSessions[recentSessions.length - 1];
      const daysDiff = (new Date(recentSessions[0].session_start) - new Date(oldestSession.session_start)) / (1000 * 60 * 60 * 24);
      retentionMetrics.sessionFrequency = daysDiff > 0 ? (recentSessions.length / daysDiff) * 7 : 0;
      
      // Determine engagement trend
      const recentHalf = recentSessions.slice(0, Math.floor(recentSessions.length / 2));
      const olderHalf = recentSessions.slice(Math.floor(recentSessions.length / 2));
      
      if (recentHalf.length > 0 && olderHalf.length > 0) {
        const recentAvg = recentHalf.reduce((sum, s) => sum + (s.messages_sent || 0), 0) / recentHalf.length;
        const olderAvg = olderHalf.reduce((sum, s) => sum + (s.messages_sent || 0), 0) / olderHalf.length;
        
        if (recentAvg > olderAvg * 1.2) {
          retentionMetrics.engagementTrend = 'improving';
        } else if (recentAvg < olderAvg * 0.8) {
          retentionMetrics.engagementTrend = 'declining';
        }
      }
      
      // Identify risk factors
      if (retentionMetrics.averageRetentionRisk > 0.6) {
        retentionMetrics.riskFactors.push('High retention risk detected');
      }
      if (retentionMetrics.sessionFrequency < 1) {
        retentionMetrics.riskFactors.push('Low session frequency');
      }
      if (retentionMetrics.engagementTrend === 'declining') {
        retentionMetrics.riskFactors.push('Declining engagement pattern');
      }
    }
    
    res.json({ retentionMetrics });
  } catch (error) {
    console.error('Error getting retention analytics:', error);
    res.status(500).json({ error: 'Failed to get retention analytics' });
  }
});

// Cleanup inactive sessions (can be called periodically)
app.post('/api/engagement-sessions/cleanup', authenticateToken, async (req, res) => {
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const cleanedCount = await engagementAnalyticsService.cleanupInactiveSessions();
    res.json({ message: `Cleaned up ${cleanedCount} inactive sessions` });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

// Retention Service API Endpoints

// Get user's notification history
app.get('/api/notifications/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!retentionService) {
      return res.status(503).json({ error: 'Retention service not available' });
    }
    
    const history = await retentionService.getUserNotificationHistory(userId, limit);
    res.json({ notifications: history });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

// Manually trigger notification check for user (admin/testing)
app.post('/api/notifications/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!retentionService) {
      return res.status(503).json({ error: 'Retention service not available' });
    }
    
    await retentionService.checkUserActivityAndScheduleNotifications(userId);
    res.json({ message: 'Notification check completed' });
  } catch (error) {
    console.error('Error checking notifications:', error);
    res.status(500).json({ error: 'Failed to check notifications' });
  }
});

// Cancel pending notifications for user
app.delete('/api/notifications/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationType } = req.body;
    
    if (!retentionService) {
      return res.status(503).json({ error: 'Retention service not available' });
    }
    
    const cancelledCount = await retentionService.cancelPendingNotifications(userId, notificationType);
    res.json({ message: `Cancelled ${cancelledCount} pending notifications` });
  } catch (error) {
    console.error('Error cancelling notifications:', error);
    res.status(500).json({ error: 'Failed to cancel notifications' });
  }
});

// Process pending notifications manually (admin endpoint)
app.post('/api/admin/notifications/process', async (req, res) => {
  try {
    // Simple admin check - in production, add proper admin authentication
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'dev-admin-key') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (!retentionService) {
      return res.status(503).json({ error: 'Retention service not available' });
    }
    
    const processedCount = await retentionService.processPendingNotifications();
    res.json({ message: `Processed ${processedCount} notifications` });
  } catch (error) {
    console.error('Error processing notifications:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
});

// Check all users for notifications (admin endpoint)
app.post('/api/admin/notifications/check-all', async (req, res) => {
  try {
    // Simple admin check - in production, add proper admin authentication
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'dev-admin-key') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (!retentionService) {
      return res.status(503).json({ error: 'Retention service not available' });
    }
    
    await retentionService.checkAllUsersForNotifications();
    res.json({ message: 'Completed notification check for all users' });
  } catch (error) {
    console.error('Error checking all users for notifications:', error);
    res.status(500).json({ error: 'Failed to check all users for notifications' });
  }
});

/**
 * Generates actionable insights about user engagement patterns
 * Used by engagement analytics endpoints
 */
async function generateEngagementInsights(userId, analytics) {
  const insights = [];
  
  try {
    // Insight 1: Engagement trend analysis
    if (analytics.engagementTrend === 'improving') {
      insights.push({
        type: 'positive',
        title: 'Growing Connection',
        message: 'Your conversations are becoming more meaningful over time. Keep exploring deeper topics!',
        actionable: 'Try sharing something personal in your next conversation.'
      });
    } else if (analytics.engagementTrend === 'declining') {
      insights.push({
        type: 'concern',
        title: 'Engagement Opportunity',
        message: 'Your recent conversations have been shorter. Consider exploring topics that interest you more.',
        actionable: 'Ask about something you\'ve been curious about or share a recent experience.'
      });
    }
    
    // Insight 2: Emotional depth analysis
    if (analytics.avgEmotionalDepth > 0.6) {
      insights.push({
        type: 'positive',
        title: 'Deep Emotional Connection',
        message: 'You\'re sharing meaningful emotions and experiences. This depth strengthens your growth.',
        actionable: 'Continue exploring your feelings and reactions to build self-awareness.'
      });
    } else if (analytics.avgEmotionalDepth < 0.3) {
      insights.push({
        type: 'suggestion',
        title: 'Opportunity for Deeper Connection',
        message: 'Your conversations could benefit from more emotional sharing.',
        actionable: 'Try describing how situations make you feel, not just what happened.'
      });
    }
    
    // Insight 3: Session frequency analysis
    const sessionsPerWeek = analytics.totalSessions / (analytics.dailyActivity.length / 7);
    if (sessionsPerWeek < 2) {
      insights.push({
        type: 'suggestion',
        title: 'Consistency Builds Growth',
        message: 'Regular conversations help build stronger emotional patterns and insights.',
        actionable: 'Try setting a reminder for 2-3 conversations per week.'
      });
    } else if (sessionsPerWeek > 5) {
      insights.push({
        type: 'positive',
        title: 'Highly Engaged',
        message: 'Your frequent conversations show strong commitment to personal growth.',
        actionable: 'Consider reflecting on patterns you\'ve noticed in your recent conversations.'
      });
    }
    
    // Insight 4: Milestone achievement analysis
    if (analytics.milestonesAchieved > 0) {
      insights.push({
        type: 'celebration',
        title: 'Achievement Unlocked',
        message: `You've achieved ${analytics.milestonesAchieved} milestone${analytics.milestonesAchieved > 1 ? 's' : ''} recently!`,
        actionable: 'Celebrate your progress and set intentions for continued growth.'
      });
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating engagement insights:', error);
    return [];
  }
}

// Enhanced Engagement Analytics Dashboard Endpoints

/**
 * Get comprehensive engagement analytics for dashboard display
 * Requirement 12.1, 12.2, 12.3, 12.4
 */
app.get('/api/engagement-analytics', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 30;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    // Get comprehensive engagement analytics
    const analytics = await engagementAnalyticsService.getEngagementAnalytics(userId, days);
    
    // Generate actionable insights
    const insights = await generateEngagementInsights(userId, analytics);
    
    // Calculate retention risk factors
    const riskFactors = [];
    if (analytics.avgRetentionRisk > 0.6) {
      riskFactors.push({
        factor: 'High retention risk',
        severity: 'high',
        description: 'User engagement patterns suggest risk of dropping off',
        recommendation: 'Increase conversation frequency and emotional depth'
      });
    }
    
    if (analytics.avgEmotionalDepth < 0.3) {
      riskFactors.push({
        factor: 'Low emotional engagement',
        severity: 'medium',
        description: 'Conversations lack emotional depth',
        recommendation: 'Encourage sharing of feelings and personal experiences'
      });
    }
    
    if (analytics.engagementTrend === 'declining') {
      riskFactors.push({
        factor: 'Declining engagement',
        severity: 'medium',
        description: 'Recent conversations are shorter or less frequent',
        recommendation: 'Re-engage with personalized content and milestone celebrations'
      });
    }
    
    // Enhanced response with actionable insights
    res.json({
      ...analytics,
      insights,
      riskFactors,
      recommendations: {
        nextActions: insights.filter(i => i.actionable).map(i => i.actionable),
        focusAreas: riskFactors.map(r => r.recommendation)
      }
    });
    
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({ error: 'Failed to load engagement analytics' });
  }
});

/**
 * Get retention risk analysis for user
 * Requirement 12.2, 12.4
 */
app.get('/api/retention-analysis', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    // Get recent sessions for risk analysis
    const recentSessions = await engagementAnalyticsService.getRecentSessions(userId, 10);
    
    if (recentSessions.length === 0) {
      return res.json({
        riskScore: 0.5,
        riskLevel: 'medium',
        factors: ['No recent session data available'],
        recommendations: ['Start having regular conversations to build engagement patterns']
      });
    }
    
    // Calculate comprehensive risk score
    const avgRisk = recentSessions.reduce((sum, s) => sum + (s.retention_risk_score || 0), 0) / recentSessions.length;
    const avgMessages = recentSessions.reduce((sum, s) => sum + (s.messages_sent || 0), 0) / recentSessions.length;
    const avgDepth = recentSessions.reduce((sum, s) => sum + (s.emotional_depth_score || 0), 0) / recentSessions.length;
    
    // Determine risk level
    let riskLevel = 'low';
    if (avgRisk > 0.7) riskLevel = 'high';
    else if (avgRisk > 0.4) riskLevel = 'medium';
    
    // Identify specific risk factors
    const factors = [];
    const recommendations = [];
    
    if (avgMessages < 3) {
      factors.push('Short conversation sessions');
      recommendations.push('Encourage longer, more detailed conversations');
    }
    
    if (avgDepth < 0.3) {
      factors.push('Low emotional engagement');
      recommendations.push('Ask more personal and emotional questions');
    }
    
    const daysSinceLastSession = recentSessions.length > 0 ? 
      Math.ceil((Date.now() - new Date(recentSessions[0].session_start)) / (1000 * 60 * 60 * 24)) : 0;
    
    if (daysSinceLastSession > 7) {
      factors.push('Infrequent usage pattern');
      recommendations.push('Send personalized re-engagement messages');
    }
    
    // Check for declining pattern
    if (recentSessions.length >= 5) {
      const recentAvg = recentSessions.slice(0, 3).reduce((sum, s) => sum + (s.messages_sent || 0), 0) / 3;
      const olderAvg = recentSessions.slice(-3).reduce((sum, s) => sum + (s.messages_sent || 0), 0) / 3;
      
      if (recentAvg < olderAvg * 0.7) {
        factors.push('Declining engagement trend');
        recommendations.push('Implement milestone celebrations and achievement recognition');
      }
    }
    
    res.json({
      riskScore: avgRisk,
      riskLevel,
      factors,
      recommendations,
      sessionMetrics: {
        avgMessages,
        avgEmotionalDepth: avgDepth,
        daysSinceLastSession,
        totalRecentSessions: recentSessions.length
      }
    });
    
  } catch (error) {
    console.error('Error analyzing retention risk:', error);
    res.status(500).json({ error: 'Failed to analyze retention risk' });
  }
});

/**
 * Get session engagement metrics for real-time tracking
 * Requirement 12.1, 12.3
 */
app.get('/api/session-metrics', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    // Get current active session
    const activeSession = engagementAnalyticsService.getActiveSession(userId);
    
    if (!activeSession) {
      return res.json({
        hasActiveSession: false,
        message: 'No active session found'
      });
    }
    
    // Calculate session duration
    const sessionDuration = (Date.now() - activeSession.sessionStart) / 1000; // seconds
    const avgEmotionalDepth = activeSession.messageCount > 0 ? 
      activeSession.emotionalDepthSum / activeSession.messageCount : 0;
    
    // Predict session quality based on current metrics
    let sessionQuality = 'good';
    if (activeSession.messageCount < 2 && sessionDuration > 300) { // Less than 2 messages in 5 minutes
      sessionQuality = 'low_engagement';
    } else if (avgEmotionalDepth > 0.6 && activeSession.messageCount >= 3) {
      sessionQuality = 'high_quality';
    } else if (avgEmotionalDepth < 0.2) {
      sessionQuality = 'surface_level';
    }
    
    res.json({
      hasActiveSession: true,
      sessionId: activeSession.sessionId,
      duration: Math.round(sessionDuration),
      messageCount: activeSession.messageCount,
      avgEmotionalDepth: Math.round(avgEmotionalDepth * 100) / 100,
      sessionQuality,
      lastActivity: activeSession.lastActivity,
      milestoneAchieved: activeSession.milestoneAchieved,
      recommendations: {
        'low_engagement': 'Try asking a more personal question to deepen the conversation',
        'surface_level': 'Share how you\'re feeling about the topic being discussed',
        'good': 'You\'re having a meaningful conversation - keep exploring!',
        'high_quality': 'Excellent emotional engagement - this depth builds real growth'
      }[sessionQuality]
    });
    
  } catch (error) {
    console.error('Error fetching session metrics:', error);
    res.status(500).json({ error: 'Failed to load session metrics' });
  }
});

/**
 * End current engagement session manually
 * Requirement 12.1
 */
app.post('/api/session/end', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { feedback } = req.body;
  
  if (!engagementAnalyticsService) {
    return res.status(500).json({ error: 'Engagement analytics service not initialized' });
  }
  
  try {
    const sessionMetrics = await engagementAnalyticsService.endSession(userId, { 
      userFeedback: feedback,
      endReason: 'manual'
    });
    
    if (!sessionMetrics) {
      return res.json({ message: 'No active session to end' });
    }
    
    res.json({
      message: 'Session ended successfully',
      sessionSummary: {
        duration: `${Math.round(sessionMetrics.duration / 60)} minutes`,
        messageCount: sessionMetrics.messageCount,
        emotionalDepth: Math.round(sessionMetrics.avgEmotionalDepth * 100),
        milestoneAchieved: sessionMetrics.milestoneAchieved,
        nextEngagement: sessionMetrics.nextEngagementPrediction
      }
    });
    
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Privacy Control Endpoints

// Export user data (GDPR compliance)
app.get('/api/privacy/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    const userData = await privacyService.exportUserData(userId);
    
    // Log the export action with request details
    await privacyService.logPrivacyAction(userId, 'data_export_requested', null, req);
    
    res.json({
      success: true,
      data: userData,
      message: 'User data exported successfully'
    });
    
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Generate downloadable data export file
app.post('/api/privacy/export-file', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    const exportResult = await privacyService.generateDataExportFile(userId);
    
    res.json({
      success: true,
      filename: exportResult.filename,
      message: 'Data export file generated successfully. Check your downloads.'
    });
    
  } catch (error) {
    console.error('Error generating export file:', error);
    res.status(500).json({ error: 'Failed to generate export file' });
  }
});

// Delete all user data (Right to be Forgotten)
app.delete('/api/privacy/delete-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { confirmation } = req.body;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_MY_DATA') {
      return res.status(400).json({ 
        error: 'Confirmation required. Please send "DELETE_ALL_MY_DATA" in the confirmation field.' 
      });
    }

    // Log the deletion request before deleting
    await privacyService.logPrivacyAction(userId, 'complete_data_deletion_requested', { confirmation }, req);
    
    const result = await privacyService.deleteAllUserData(userId);
    
    res.json({
      success: true,
      message: 'All user data has been permanently deleted. Your account has been closed.'
    });
    
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

// Delete specific data category
app.delete('/api/privacy/delete/:category', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category } = req.params;
    const { confirmation } = req.body;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    // Validate category
    const validCategories = ['conversations', 'personality', 'milestones', 'memories', 'analytics'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: `Invalid category. Valid categories: ${validCategories.join(', ')}` 
      });
    }

    // Require confirmation for sensitive data
    if (['personality', 'conversations'].includes(category) && !confirmation) {
      return res.status(400).json({ 
        error: 'Confirmation required for deleting sensitive data. Send confirmation: true' 
      });
    }

    // Log the deletion request
    await privacyService.logPrivacyAction(userId, `${category}_deletion_requested`, { category, confirmation }, req);
    
    const result = await privacyService.deleteDataCategory(userId, category);
    
    res.json({
      success: true,
      message: `${category} data has been permanently deleted.`
    });
    
  } catch (error) {
    console.error(`Error deleting ${req.params.category} data:`, error);
    res.status(500).json({ error: `Failed to delete ${req.params.category} data` });
  }
});

// Get user consent preferences
app.get('/api/privacy/consent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    const consent = await privacyService.getUserConsent(userId);
    
    res.json({
      success: true,
      consent: {
        personalityAnalysis: consent.personality_analysis_consent === 1,
        dataAnalytics: consent.data_analytics_consent === 1,
        retentionNotifications: consent.retention_notifications_consent === 1,
        lastUpdated: consent.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error getting consent preferences:', error);
    res.status(500).json({ error: 'Failed to get consent preferences' });
  }
});

// Update user consent preferences
app.put('/api/privacy/consent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { personalityAnalysis, dataAnalytics, retentionNotifications } = req.body;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    // Validate input
    if (typeof personalityAnalysis !== 'boolean' || 
        typeof dataAnalytics !== 'boolean' || 
        typeof retentionNotifications !== 'boolean') {
      return res.status(400).json({ 
        error: 'All consent fields must be boolean values' 
      });
    }

    const consentData = {
      personalityAnalysis,
      dataAnalytics,
      retentionNotifications
    };

    // Log the consent update
    await privacyService.logPrivacyAction(userId, 'consent_updated', consentData, req);
    
    const result = await privacyService.updateUserConsent(userId, consentData);
    
    res.json({
      success: true,
      message: 'Consent preferences updated successfully',
      consent: consentData
    });
    
  } catch (error) {
    console.error('Error updating consent preferences:', error);
    res.status(500).json({ error: 'Failed to update consent preferences' });
  }
});

// Get privacy information and controls
app.get('/api/privacy/info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get basic privacy information
    const privacyInfo = {
      dataStorage: {
        location: 'Local SQLite database on your device',
        encryption: 'AES-256-GCM encryption for sensitive data',
        retention: 'Data is kept until you choose to delete it'
      },
      userRights: {
        access: 'You can export all your data at any time',
        rectification: 'You can modify your data through settings',
        erasure: 'You can delete specific data categories or all data',
        portability: 'You can export your data in JSON format',
        objection: 'You can opt out of data processing features'
      },
      dataCategories: {
        conversations: 'Your chat messages and AI responses (encrypted)',
        personality: 'Insights from your onboarding questionnaire (encrypted)',
        milestones: 'Your achievements and progress tracking',
        memories: 'Important facts the AI remembers about you',
        analytics: 'Engagement patterns and mood trends'
      },
      compliance: {
        gdpr: 'Compliant with EU General Data Protection Regulation',
        ccpa: 'Compliant with California Consumer Privacy Act',
        localStorage: 'All data stored locally, never shared with third parties'
      },
      encryption: {
        algorithm: 'AES-256-GCM with PBKDF2 key derivation',
        keyDerivation: 'PBKDF2 with 100,000 iterations',
        authentication: 'Authenticated encryption with integrity verification',
        saltGeneration: 'Cryptographically secure random salts'
      }
    };

    res.json({
      success: true,
      privacyInfo,
      message: 'Privacy information retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting privacy info:', error);
    res.status(500).json({ error: 'Failed to get privacy information' });
  }
});

// Get user audit log for transparency
app.get('/api/privacy/audit-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!privacyService) {
      return res.status(500).json({ error: 'Privacy service not initialized' });
    }

    const auditLog = await privacyService.getUserAuditLog(userId);
    
    res.json({
      success: true,
      auditLog,
      message: 'Audit log retrieved successfully'
    });
    
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

app.listen(PORT, () => {
  console.log(`Companion app running on port ${PORT}`);
});