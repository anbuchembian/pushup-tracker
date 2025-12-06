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
            if (doc.exists) {
                welcomeMessage.textContent = `Welcome, ${doc.data().name}!`;
            }
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

        submitStatus.textContent = 'Successfully submitted!';
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
}
