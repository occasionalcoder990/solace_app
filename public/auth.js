// Check URL parameters to determine which form to show
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');

// Check if user is already logged in
const token = localStorage.getItem('solace_token');
if (token) {
    window.location.href = 'app.html';
}

// Show appropriate form based on URL parameter
if (mode === 'register') {
    showRegister();
} else {
    showLogin();
}

function showLogin() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
}

function showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
    
    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('mode', 'register');
    window.history.replaceState({}, '', url);
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Signing In...</span>';
    submitBtn.disabled = true;
    
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
            
            // Show success message briefly
            showSuccess('Welcome back! Redirecting...');
            
            // Redirect after short delay
            setTimeout(() => {
                const redirectTo = result.redirectTo || (result.user.onboardingComplete ? 'home.html' : 'journey.html');
                window.location.href = redirectTo;
            }, 1000);
        } else {
            showError(result.error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        showError('Something went wrong. Please try again.');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
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
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Creating Account...</span>';
    submitBtn.disabled = true;
    
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
            
            // Show success message
            showSuccess('Account created! Let\'s personalize your experience...');
            
            // Redirect to questionnaire
            setTimeout(() => {
                window.location.href = 'journey.html?authenticated=true';
            }, 1000);
        } else {
            showError(result.error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        showError('Something went wrong. Please try again.');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function showError(message) {
    removeMessages();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const activeForm = document.querySelector('.auth-form.active .form');
    activeForm.insertBefore(errorDiv, activeForm.firstChild);
}

function showSuccess(message) {
    removeMessages();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    const activeForm = document.querySelector('.auth-form.active .form');
    activeForm.insertBefore(successDiv, activeForm.firstChild);
}

function removeMessages() {
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
}