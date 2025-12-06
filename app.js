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
    } catch (error) {
        console.error("Error submitting pushups: ", error);
        submitStatus.textContent = 'Error submitting. Please try again.';
        submitStatus.className = 'error';
    }
});


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

// --- 7. AI COACH LOGIC ---
function updateAICoach(pushupData, userId, yearMonth) {
    const feedbackContainer = document.getElementById('ai-coach-feedback');
    const userPushups = pushupData[userId] || {};

    // Convert data to array of objects for easier processing
    // [{ date: '2023-12-01', count: 20 }, ...] sorted by date
    const entries = Object.keys(userPushups).sort().map(date => ({
        date: date,
        count: userPushups[date]
    }));

    if (entries.length === 0) {
        feedbackContainer.innerHTML = `<p>👋 Hi there! I'm your AI Coach. I don't see any push-ups for this month yet. 
        <br><strong>Tip:</strong> Start small! Even 5 push-ups today is better than 0.</p>`;
        return;
    }

    // Calculate metrics
    const totalPushups = entries.reduce((sum, entry) => sum + entry.count, 0);
    const activeDays = entries.length;
    const average = Math.round(totalPushups / activeDays);

    // Calculate Streak
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    // Check backwards from today (or the last entry date if we want to be lenient, but strict streak means relative to today)
    // Let's be lenient: streak is consecutive days ending at the last recorded entry, 
    // AND that last entry must be today or yesterday to be "current".

    const lastEntryDate = entries[entries.length - 1].date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let isStreakActive = (lastEntryDate === today || lastEntryDate === yesterday);

    if (isStreakActive) {
        streak = 1;
        for (let i = entries.length - 2; i >= 0; i--) {
            const curr = new Date(entries[i + 1].date);
            const prev = new Date(entries[i].date);
            const diffTime = Math.abs(curr - prev);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak++;
            } else {
                break;
            }
        }
    }

    // Determine Trend (Last 3 entries vs Previous 3)
    let trendMessage = "";
    if (entries.length >= 6) {
        const recent = entries.slice(-3).reduce((sum, e) => sum + e.count, 0) / 3;
        const previous = entries.slice(-6, -3).reduce((sum, e) => sum + e.count, 0) / 3;

        if (recent > previous * 1.1) {
            trendMessage = "📈 You're getting stronger! Your recent average is higher than before.";
        } else if (recent < previous * 0.9) {
            trendMessage = "📉 A slight dip recently. Focus on consistency over intensity right now.";
        } else {
            trendMessage = "➡️ You're maintaining a steady pace. Consistency builds habit!";
        }
    } else if (entries.length >= 3) {
        trendMessage = "📊 Keep logging data to see detailed trends!";
    }

    // Generate Feedback
    let feedbackHTML = `
        <div class="coach-stats">
            <span><strong>Total:</strong> ${totalPushups}</span>
            <span><strong>Avg/Day:</strong> ${average}</span>
            <span><strong>Streak:</strong> ${streak} days 🔥</span>
        </div>
        <p class="coach-message">`;

    if (streak >= 3) {
        feedbackHTML += `You're on fire! ${streak} days in a row. Don't break the chain! ⛓️<br>`;
    } else if (streak === 0) {
        feedbackHTML += `Let's get back on track! A push-up a day keeps the weakness away. 💪<br>`;
    }

    if (trendMessage) {
        feedbackHTML += `${trendMessage}<br>`;
    }

    // Random tip
    const tips = [
        "Remember to keep your back straight and core engaged.",
        "Quality over quantity! Full range of motion yields better results.",
        "Breathe in on the way down, breathe out on the way up.",
        "Rest days are important too, but active recovery is better.",
        "Try varying your hand width to target different muscles."
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    feedbackHTML += `<br><strong>💡 Coach's Tip:</strong> ${randomTip}</p>`;

    feedbackContainer.innerHTML = feedbackHTML;
}
