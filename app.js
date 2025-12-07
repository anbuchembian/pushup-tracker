// --- 1. PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyCSyboEkTl5LBcAg-uOMnjKtdTobQ35ha8",
    authDomain: "dec-push-up-challenge.firebaseapp.com", // <-- removed "https://"
    projectId: "dec-push-up-challenge",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "1:35936487246:web:986ea2423cdf0a2c2fc01f"
};

// --- 2. INITIALIZE FIREBASE AND GET REFERENCES ---
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// --- 3. DOM ELEMENT REFERENCES ---
const authContainer = document.getElementById('auth-container');
const mainApp = document.getElementById('main-app');
const welcomeMessage = document.getElementById('welcome-message');
const authError = document.getElementById('auth-error');
const submitStatus = document.getElementById('submit-status');

// --- 4. AUTHENTICATION LOGIC ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        authContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        db.collection('users').doc(user.uid).get().then(doc => {
            const name = (doc.exists && doc.data().name) ? doc.data().name : (user.displayName || user.email || "User");
            welcomeMessage.textContent = `Welcome, ${name}!`;
        });
        setupApp();
    } else {
        // User is signed out
        authContainer.classList.remove('hidden');
        mainApp.classList.add('hidden');
        welcomeMessage.textContent = '';
    }
});

// Signup
document.getElementById('signup-btn').addEventListener('click', () => {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!name) {
        authError.textContent = 'Please enter your name for signup.';
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Update profile with display name
            userCredential.user.updateProfile({
                displayName: name
            }).catch(err => console.error("Error updating profile", err));

            // Store user's name in Firestore
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email
            });
        })
        .catch(error => {
            authError.textContent = error.message;
        });
});

// Login
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            authError.textContent = error.message;
        });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
});


// --- 5. MAIN APP LOGIC ---
function setupApp() {
    // Set current date for submission form
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    document.getElementById('pushup-date').value = dateString;

    // Hardcode summary to show December data.
    // Change "2023" to a different year if needed.
    const decemberMonth = "2025-12";
    renderSummary(decemberMonth);

    // Update global stats (Streak, Total, Average)
    const user = firebase.auth().currentUser;
    if (user) {
        updateGlobalStats(user.uid);
    }
}

// Submit push-ups
document.getElementById('submit-btn').addEventListener('click', async () => {
    const count = parseInt(document.getElementById('pushup-count').value, 10);
    const user = auth.currentUser;

    if (!user || isNaN(count) || count < 0) {
        submitStatus.textContent = 'Invalid count.';
        submitStatus.className = 'error';
        return;
    }

    const date = document.getElementById('pushup-date').value;
    const docId = `${user.uid}_${date}`; // Creates a predictable ID to prevent duplicate entries for the same day

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        // Check if user document exists and has a name, otherwise use a fallback.
        const userName = userDoc.exists && userDoc.data().name ? userDoc.data().name : "Unknown User";
        if (!userDoc.exists) {
            console.warn(`User document not found for UID: ${user.uid}. A 'users' document may need to be created in Firestore.`);
        }

        await db.collection('pushups').doc(docId).set({
            userId: user.uid,
            userName: userName,
            date: date,
            count: count,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const messages = [
            "Beast mode activated! Keep it up! 🦁",
            "Gravity who? You're crushing it! 🚀",
            "One step closer to becoming One Punch Man! 👊",
            "Your arms might hate you, but your mirror will love you! 💪",
            "Swole is the goal, size is the prize! 🏆",
            "Light weight, baby! 🏋️‍♂️",
            "You're a machine! Don't forget to oil your joints. 🤖",
            "Push-ups: The floor is lava, but you're pushing it away! 🌋",
            "Weakness leaving the body... one rep at a time. 😤",
            "Look at you go! The Hulk is shaking. 🤢"
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        submitStatus.textContent = randomMessage;
        submitStatus.className = 'success';
        document.getElementById('pushup-count').value = '';
        // Re-render summary to show new data
        renderSummary("2025-12");
        updateGlobalStats(user.uid);
    } catch (error) {
        console.error("Error submitting pushups: ", error);
        submitStatus.textContent = 'Error submitting. Please try again.';
        submitStatus.className = 'error';
    }
});


// --- 5.1. GLOBAL STATS LOGIC ---
async function updateGlobalStats(userId) {
    try {
        const snapshot = await db.collection('pushups')
            .where('userId', '==', userId)
            .get();

        const dates = [];
        let totalPushups = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            dates.push(data.date);
            totalPushups += (data.count || 0);
        });

        // 1. Total Push-ups
        document.getElementById('stat-total').textContent = totalPushups.toLocaleString();

        // 2. Daily Average (active days)
        const uniqueDays = new Set(dates).size;
        const average = uniqueDays > 0 ? Math.round(totalPushups / uniqueDays) : 0;
        document.getElementById('stat-average').textContent = average;

        // 3. Current Streak
        // Sort unique dates descending
        const sortedDates = [...new Set(dates)].sort().reverse();

        let streak = 0;
        if (sortedDates.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            // If the most recent entry is today or yesterday, the streak is alive
            if (sortedDates[0] === today || sortedDates[0] === yesterday) {
                streak = 1;
                // Check consecutive days backwards
                // Convert to Date objects for easier math
                let currentDate = new Date(sortedDates[0]);

                for (let i = 1; i < sortedDates.length; i++) {
                    const prevDate = new Date(sortedDates[i]);
                    const diffTime = Math.abs(currentDate - prevDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        streak++;
                        currentDate = prevDate;
                    } else {
                        break;
                    }
                }
            }
        }

        const streakEl = document.getElementById('stat-streak');
        streakEl.textContent = streak;

        // Visual flair for streak
        if (streak > 2) {
            streakEl.parentElement.classList.add('fire');
        } else {
            streakEl.parentElement.classList.remove('fire');
        }

    } catch (error) {
        console.error("Error updating stats:", error);
    }
}


// --- 6. SUMMARY TABLE LOGIC ---
async function renderSummary(yearMonth) { // e.g., "2023-12"
    const summaryContainer = document.getElementById('summary-table-container');
    summaryContainer.innerHTML = 'Loading...';

    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Get all pushup data for the selected month
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${daysInMonth}`;
    const pushupsSnapshot = await db.collection('pushups')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const pushupData = {}; // { userId: { 'YYYY-MM-DD': count, ... }, ... }
    const users = {}; // { userId: 'Name', ... }

    pushupsSnapshot.forEach(doc => {
        const data = doc.data();
        if (!pushupData[data.userId]) {
            pushupData[data.userId] = {};
        }
        pushupData[data.userId][data.date] = data.count;
        if (!users[data.userId]) {
            users[data.userId] = data.userName;
        }
    });

    // 2. Build the HTML table
    let tableHTML = '<table>';

    // Header Row
    tableHTML += '<thead><tr><th>Name</th>';
    for (let day = 1; day <= daysInMonth; day++) {
        tableHTML += `<th>${day}</th>`;
    }
    tableHTML += '<th>Total</th></tr></thead>';

    // Body Rows
    tableHTML += '<tbody>';
    for (const userId in users) {
        let total = 0;
        tableHTML += `<tr><td>${users[userId]}</td>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
            const count = pushupData[userId]?.[dateStr] || 0;
            tableHTML += `<td>${count || '-'}</td>`;
            total += count;
        }
        tableHTML += `<td>${total}</td></tr>`;
    }
    tableHTML += '</tbody></table>';

    summaryContainer.innerHTML = tableHTML;

    // 3. Update AI Coach
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        updateAICoach(pushupData, currentUser.uid, yearMonth);
    }
}

// --- 7. AI COACH LOGIC (POWERED BY GEMINI) ---
// ⚠️ IMPORTANT: Replace this with your actual Gemini API Key from https://aistudio.google.com/
const GEMINI_API_KEY = "AIzaSyBIaLf68QiqHUaV3kD9RllYA-z4wvwA8Tg";

async function updateAICoach(pushupData, userId, yearMonth) {
    const feedbackContainer = document.getElementById('ai-coach-feedback');
    const userPushups = pushupData[userId] || {};

    // Convert data to array of objects
    const entries = Object.keys(userPushups).sort().map(date => ({
        date: date,
        count: userPushups[date]
    }));

    if (entries.length === 0) {
        feedbackContainer.innerHTML = `<p>👋 Hi there! I'm your AI Coach. I don't see any push-ups for this month yet. 
        <br><strong>Tip:</strong> Start small! Even 5 push-ups today is better than 0.</p>`;
        return;
    }

    // Check if API key is set
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        feedbackContainer.innerHTML = `<p style="color: #d9534f;"><strong>⚠️ API Key Missing:</strong><br>
        To enable the AI Coach, please open <code>app.js</code> and replace <code>YOUR_GEMINI_API_KEY_HERE</code> with a valid Gemini API key.</p>`;
        return;
    }

    feedbackContainer.innerHTML = `<p>🤖 Analyzing your performance... <span class="loading-dots"></span></p>`;

    // Prepare data for the LLM
    const totalPushups = entries.reduce((sum, entry) => sum + entry.count, 0);
    const activeDays = entries.length;
    const average = Math.round(totalPushups / activeDays);
    const historyStr = entries.map(e => `${e.date}: ${e.count}`).join('\n');

    const prompt = `
    You are an enthusiastic and motivating fitness coach. 
    Analyze the following push-up data for the user for the month of ${yearMonth}.
    
    Data:
    ${historyStr}
    
    Summary:
    - Total Push-ups: ${totalPushups}
    - Active Days: ${activeDays}
    - Average per active day: ${average}
    
    Please provide:
    1. A brief analysis of their trend (are they consistent? improving?).
    2. A specific, encouraging compliment.
    3. Constructive advice for next week.
    4. A short, funny "tough love" comment.
    
    Keep the response concise (under 100 words) and use emojis. Format with bolding where applicable.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiText = data.candidates[0].content.parts[0].text;
        feedbackContainer.innerHTML = parseMarkdown(aiText);

    } catch (error) {
        console.error("Error fetching AI feedback:", error);

        // Try to list models to debug
        try {
            const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
            const modelsData = await modelsResponse.json();
            const availableModels = modelsData.models ? modelsData.models.map(m => m.name).join(', ') : "No models found";

            feedbackContainer.innerHTML = `<p class="error"><strong>Error:</strong> ${error.message}<br><br><strong>Available Models:</strong><br>${availableModels}</p>`;
        } catch (listError) {
            feedbackContainer.innerHTML = `<p class="error">Oops! My brain is tired. (Error: ${error.message})<br>Could not list models: ${listError.message}</p>`;
        }
    }
}

// Simple Markdown Parser for bolding and newlines
function parseMarkdown(text) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Italic
        .replace(/\n/g, '<br>');                           // Newlines
    return `<p class="coach-message">${html}</p>`;
}
