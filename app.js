// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDBFe-wSC7xuzcTjrr6sEDJo7q5dwNiq4s",
    authDomain: "loanify-208f8.firebaseapp.com",
    projectId: "loanify-208f8",
    storageBucket: "loanify-208f8.firebasestorage.app",
    messagingSenderId: "344946599669",
    appId: "1:344946599669:web:90c32f725866e1fb2d07bc",
    measurementId: "G-R9YD0TG0VR"
};

// 2. Import Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, collection, addDoc, onSnapshot, serverTimestamp, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 3. Initialize the Engine
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Toast Notification Logic ---
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    const color = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    toast.className = `${color} text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-in pointer-events-auto mb-3`;
    toast.innerHTML = `<i class="fas ${icon}"></i> <span class="text-sm font-bold">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- Analytics Chart Logic ---
let sseChart;
function updateAnalytics(transactions) {
    const ctx = document.getElementById('analyticsChart')?.getContext('2d');
    if (!ctx) return;
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    }).reverse();
    const credits = new Array(7).fill(0);
    const debits = new Array(7).fill(0);
    transactions.forEach(t => {
        const tDate = t.date ? t.date.toDate().toLocaleDateString('en-US', { weekday: 'short' }) : '';
        const index = last7Days.indexOf(tDate);
        if (index > -1) {
            if (t.type === "Credit") credits[index] += t.amount;
            else debits[index] += t.amount;
        }
    });
    if (sseChart) sseChart.destroy();
    sseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [
                { label: 'Inflow', data: credits, borderColor: '#10b981', tension: 0.4, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.05)' },
                { label: 'Outflow', data: debits, borderColor: '#6366f1', tension: 0.4, fill: true, backgroundColor: 'rgba(99, 102, 241, 0.05)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
    });
}

// 4. Navigation & Toggle Logic
let isLogin = false;
window.toggleAuth = function() {
    isLogin = !isLogin;
    const title = document.getElementById('formTitle');
    const sub = document.getElementById('formSub');
    const nameField = document.getElementById('nameContainer');
    const toggleText = document.getElementById('toggleText');
    const toggleBtn = document.getElementById('toggleBtn');

    if (title) {
        title.innerText = isLogin ? "Welcome Back" : "Create Account";
        sub.innerText = isLogin ? "Log in to access your secure vault." : "Start your journey with SSE Bank today.";
        nameField.style.display = isLogin ? "none" : "block";
        toggleText.innerText = isLogin ? "New to SSE Bank?" : "Already have an account?";
        toggleBtn.innerText = isLogin ? "Register here" : "Login here";
    }
};

// 5. Registration & Login Logic
const authForm = document.getElementById('authForm');
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const fullName = document.getElementById('fullName') ? document.getElementById('fullName').value : "";

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = "dashboard.html";
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000);

                await setDoc(doc(db, "users", user.uid), {
                    name: fullName,
                    email: email,
                    balance: 0,
                    accountNumber: accountNumber,
                    accountStatus: "Active",
                    accountTier: 1,
                    isVerified: false,
                    createdAt: serverTimestamp()
                });

                alert("Account Created! Redirecting to Dashboard...");
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
        }
    });
}

// 6. Dashboard Data & Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "users", user.uid);

        // Real-time listener for user data
        onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const currentBalance = userData.balance || 0;

                // Verification Check
                if (userData.isVerified === false) {
                    toggleModal('otpModal', true);
                } else {
                    toggleModal('otpModal', false);
                }

                // UI Updates
                if (document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = `Welcome, ${userData.name}`;
                if (document.getElementById('balanceDisplay')) document.getElementById('balanceDisplay').innerText = Number(currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 });
                if (document.getElementById('statusDisplay')) document.getElementById('statusDisplay').innerText = userData.accountStatus;
                
                const tierBadge = document.getElementById('tierBadge');
                if (tierBadge) {
                    const isTier2 = userData.accountTier === 2;
                    tierBadge.innerText = isTier2 ? "TIER 2 VERIFIED" : "LEVEL 1";
                    tierBadge.className = isTier2 ? "text-emerald-600 font-black" : "text-blue-600 font-black cursor-pointer hover:underline";
                    if (!isTier2) tierBadge.onclick = () => toggleModal('kycModal', true);
                }

                const accNo = userData.accountNumber || "Generating...";
                if (document.getElementById('accNumberDisplay')) document.getElementById('accNumberDisplay').innerText = accNo;
                if (document.getElementById('mainAccNo')) document.getElementById('mainAccNo').innerText = accNo;

                if (document.getElementById('pinStatus')) {
                    document.getElementById('pinStatus').innerText = userData.pin ? "SECURED" : "PIN NOT SET";
                    document.getElementById('pinStatus').className = userData.pin ? "text-green-600 font-bold" : "text-orange-500 font-bold italic";
                }

                // Trigger Pin Modal if missing
                if (!userData.pin) {
                    toggleModal('setPinModal', true);
                    const savePinBtn = document.getElementById('savePinBtn');
                    if(savePinBtn) {
                        savePinBtn.onclick = async () => {
                            const newPin = document.getElementById('newPin').value;
                            if (newPin.length !== 4 || isNaN(newPin)) return alert("PIN must be exactly 4 digits");
                            try {
                                await updateDoc(userRef, { pin: newPin });
                                toggleModal('setPinModal', false);
                                alert("Security PIN Set Successfully!");
                            } catch (err) {
                                alert("Error saving PIN: " + err.message);
                            }
                        };
                    }
                }

                // Always fetch transaction history when data changes
                renderTransactionHistory(user.uid);
            }
        });
    } else {
        if (window.location.pathname.includes("dashboard.html")) {
            window.location.href = "login.html";
        }
    }
});

// --- OTP VERIFICATION LOGIC ---
document.getElementById('otpVerifyBtn')?.addEventListener('click', async () => {
    const otpValue = document.getElementById('otpInput').value;
    const user = auth.currentUser;
    
    if (otpValue.length < 4) {
        showToast("Please enter a valid code", "error");
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { isVerified: true });
        showToast("Account Activated Successfully!");
        toggleModal('otpModal', false);
    } catch (err) {
        showToast("Verification Failed", "error");
    }
});

// --- KYC Tier Update Logic ---
document.getElementById('submitKyc')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    showToast("Processing Documents...", "success");
    setTimeout(async () => {
        await updateDoc(doc(db, "users", user.uid), { accountTier: 2 });
        toggleModal('kycModal', false);
        showToast("Account Upgraded to Tier 2!", "success");
    }, 2000);
});

// --- Transaction Search Filter ---
document.getElementById('txnSearch')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#transactionList > div[data-type="txn-item"]');
    items.forEach(item => {
        const desc = item.querySelector('.txn-desc').innerText.toLowerCase();
        item.style.display = desc.includes(term) ? 'flex' : 'none';
    });
});

// 7. Utility Functions
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => { window.location.href = "login.html"; });
    });
}

window.toggleModal = function(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
};

window.toggleDeposit = (show) => window.toggleModal('depositModal', show);
window.toggleTransfer = (show) => window.toggleModal('transferModal', show);

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'transferBtn') toggleModal('transferModal', true);
    if (e.target && e.target.id === 'depositBtn') toggleModal('depositModal', true);
});

// 8. Transfer Logic
const transferForm = document.getElementById('transferForm');
if (transferForm) {
    transferForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('tAmount').value);
        const recipientAcc = document.getElementById('tAccount').value;
        const user = auth.currentUser;

        if (user && amount > 0) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            if (!userData.pin) {
                toggleModal('transferModal', false);
                toggleModal('setPinModal', true);
                return;
            }

            document.getElementById('loadingText').innerText = "Searching for account...";
            toggleModal('loadingModal', true);

            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("accountNumber", "==", parseInt(recipientAcc)));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    toggleModal('loadingModal', false);
                    alert("❌ Recipient Account Not Found!");
                    return;
                }

                const recipientDoc = querySnapshot.docs[0];
                const recipientData = recipientDoc.data();
                const recipientId = recipientDoc.id;

                toggleModal('loadingModal', false);
                toggleModal('transferModal', false);
                toggleModal('pinModal', true);

                document.getElementById('confirmPinBtn').onclick = async () => {
                    const enteredPin = document.getElementById('txnPin').value;
                    if (enteredPin !== userData.pin) {
                        alert("Incorrect Transaction PIN!");
                        return;
                    }

                    toggleModal('pinModal', false);
                    document.getElementById('loadingText').innerText = `Sending funds to ${recipientData.name}...`;
                    toggleModal('loadingModal', true);

                    if (userData.balance < amount) {
                        toggleModal('loadingModal', false);
                        alert("Insufficient balance!");
                        return;
                    }

                    const refId = "REF-" + Math.floor(100000 + Math.random() * 900000) + "-SSE";

                    await updateDoc(userRef, { balance: increment(-amount) });
                    await updateDoc(doc(db, "users", recipientId), { balance: increment(amount) });

                    await addDoc(collection(db, "transactions"), {
                        userId: user.uid,
                        amount: amount,
                        type: "Debit",
                        ref: refId,
                        date: serverTimestamp(),
                        description: `Transfer to ${recipientData.name}`,
                        recipientName: recipientData.name
                    });

                    await addDoc(collection(db, "transactions"), {
                        userId: recipientId,
                        amount: amount,
                        type: "Credit",
                        ref: refId,
                        date: serverTimestamp(),
                        description: `Transfer from ${userData.name}`,
                        senderName: userData.name
                    });

                    toggleModal('loadingModal', false);
                    toggleModal('successModal', true);
                    setTimeout(() => location.reload(), 3000); 
                };
            } catch (error) {
                toggleModal('loadingModal', false);
                alert("Error: " + error.message);
            }
        }
    });
}

// --- DEPOSIT LOGIC ---
const depositForm = document.getElementById('depositForm');
if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('dAmount').value);
        const user = auth.currentUser;

        if (user && amount > 0) {
            try {
                showToast("Processing Deposit...", "success");
                const userRef = doc(db, "users", user.uid);
                const refId = "DEP-" + Math.floor(100000 + Math.random() * 900000) + "-SSE";

                await updateDoc(userRef, { balance: increment(amount) });

                await addDoc(collection(db, "transactions"), {
                    userId: user.uid,
                    amount: amount,
                    type: "Credit",
                    ref: refId,
                    description: "Wallet Deposit",
                    date: serverTimestamp()
                });

                showToast(`Success! $${amount.toLocaleString()} deposited.`);
                toggleModal('depositModal', false);
                setTimeout(() => location.reload(), 2000);
            } catch (err) {
                showToast("Deposit failed: " + err.message, "error");
            }
        }
    });
}

// 9. Profile Settings Logic
window.openSettings = async () => {
    const user = auth.currentUser;
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            document.getElementById('updateName').value = snap.data().name;
        }
        toggleModal('settingsModal', true);
    }
};

const saveSettingsBtn = document.getElementById('saveSettingsBtn');
if (saveSettingsBtn) {
    saveSettingsBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const newName = document.getElementById('updateName').value;
        const newPin = document.getElementById('updatePin').value;
        const updates = {};
        if (newName) updates.name = newName;
        if (newPin) {
            if (newPin.length !== 4 || isNaN(newPin)) return alert("PIN must be 4 digits");
            updates.pin = newPin;
        }
        if (Object.keys(updates).length === 0) return;
        try {
            await updateDoc(doc(db, "users", user.uid), updates);
            showToast("Profile updated successfully!");
            toggleModal('settingsModal', false);
        } catch (err) {
            alert("Error updating profile: " + err.message);
        }
    };
}

// 10. Render History
async function renderTransactionHistory(uid) {
    const container = document.getElementById('transactionList');
    if (!container) return;

    try {
        const q = query(collection(db, "transactions"), where("userId", "==", uid), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const transactions = [];

        if (querySnapshot.empty) {
            container.innerHTML = `<div class="py-10 text-center text-slate-400">No recent activity</div>`;
            return;
        }

        container.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const t = doc.data();
            transactions.push(t);
            const isCredit = t.type === "Credit";
            const dateObj = t.date ? t.date.toDate() : new Date();
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const txnItem = document.createElement('div');
            txnItem.setAttribute('data-type', 'txn-item');
            txnItem.className = "flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm mb-2 cursor-pointer hover:bg-slate-50 transition-all";
            txnItem.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                        <i class="fas ${isCredit ? 'fa-plus' : 'fa-minus'} text-xs"></i>
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 text-sm txn-desc">${t.description}</p>
                        <p class="text-[10px] text-slate-400 uppercase">${timeStr}</p>
                    </div>
                </div>
                <p class="font-black ${isCredit ? 'text-green-600' : 'text-red-600'}">${isCredit ? '+' : '-'}$${t.amount.toLocaleString()}</p>
            `;
            
            txnItem.onclick = () => {
                document.getElementById('detailAmount').innerText = `${isCredit ? '+' : '-'}$${t.amount.toLocaleString()}`;
                document.getElementById('detailDesc').innerText = t.description;
                document.getElementById('detailDate').innerText = dateObj.toLocaleString();
                document.getElementById('detailId').innerText = t.ref || "N/A"; 
                toggleModal('txnDetailModal', true);
            };
            container.appendChild(txnItem);
        });

        updateAnalytics(transactions);
    } catch (err) {
        console.error(err);
    }
}

// 11. Loan Request Logic (Fixed & Hardened)
const initLoanForm = () => {
    const loanForm = document.getElementById('loanForm');
    if (!loanForm) return;

    // Use onsubmit directly to avoid duplicate listeners if onAuthStateChanged fires multiple times
    loanForm.onsubmit = async (e) => {
        e.preventDefault();
        console.log("Submit triggered"); // Debugging

        const user = auth.currentUser;
        if (!user) return alert("Please login to apply");

        const amountInput = document.getElementById('lAmount');
        const durationInput = document.getElementById('lDuration');
        
        if (!amountInput || !durationInput) {
            console.error("Input fields missing!");
            return;
        }

        const amount = parseFloat(amountInput.value);
        const duration = durationInput.value;

        if (isNaN(amount) || amount <= 0) {
            showToast("Please enter a valid amount", "error");
            return;
        }

        showToast("Processing Loan Disbursement...", "success");

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            // 1. Update Balance
            await updateDoc(userRef, { balance: increment(amount) });

            // 2. Record Loan in Database
            await addDoc(collection(db, "loans"), {
                userId: user.uid,
                userName: userData.name,
                amount: amount,
                duration: duration,
                status: "Approved",
                requestDate: serverTimestamp()
            });

            // 3. Create Transaction Entry
            await addDoc(collection(db, "transactions"), {
                userId: user.uid,
                amount: amount,
                type: "Credit", 
                description: `Loan Disbursement: ${duration}`,
                ref: "LOAN-" + Math.floor(100000 + Math.random() * 900000),
                date: serverTimestamp()
            });

            showToast(`Success! $${amount.toLocaleString()} credited.`);
            toggleModal('loanModal', false);
            
            // Short delay so they see the success toast
            setTimeout(() => location.reload(), 1500);

        } catch (error) {
            console.error("Loan Error:", error);
            showToast("Error processing loan disbursement", "error");
        }
    };
};

// Initialize loan logic
initLoanForm();

