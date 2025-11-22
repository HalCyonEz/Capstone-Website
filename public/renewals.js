// public/renewals.js - COMPLETE UPDATED VERSION

console.log("🎯 renewals.js loaded!");

// Global variable to store fetched data for the "View" modal
let cachedRenewals = {};

// Wait for Firebase to load
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined' && firebase.app) {
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

async function initRenewalsPage() {
    console.log("🚀 Initializing Renewals Page...");
    
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody) {
        console.error('❌ Table body not found');
        return;
    }
    
    try {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-blue-500">Loading Firebase...</td></tr>';
        
        // Load Firebase from CDN
        await loadFirebaseScripts();
        console.log("✅ Firebase scripts loaded");
        
        // Wait for Firebase to be ready
        await waitForFirebase();
        console.log("✅ Firebase is ready");
        
        // Initialize Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
            authDomain: "solo-parent-app.firebaseapp.com",
            databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "solo-parent-app",
            storageBucket: "solo-parent-app.firebasestorage.app",
            messagingSenderId: "292578110807",
            appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212",
            measurementId: "G-QZ9EYD02ZV"
        };
        
        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const db = firebase.firestore();
        
        console.log("✅ Firebase initialized");
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-green-500">✅ Connected! Loading renewals...</td></tr>';
        
        // Load renewals
        await loadRenewals(db, tbody);
        
    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

function loadFirebaseScripts() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof firebase !== 'undefined') {
            resolve();
            return;
        }
        
        // Load Firebase App
        const script1 = document.createElement('script');
        script1.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
        
        // Load Firestore
        const script2 = document.createElement('script');
        script2.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";
        
        script1.onload = () => {
            script2.onload = () => resolve();
            script2.onerror = reject;
            document.head.appendChild(script2);
        };
        script1.onerror = reject;
        document.head.appendChild(script1);
    });
}

async function loadRenewals(db, tbody) {
    try {
        console.log("🔍 Loading renewals from Firestore...");
        
        // Reset cache
        cachedRenewals = {};

        // FIXED: Query using renewal_status instead of status
        const pendingSnapshot = await db.collection("renewalSubmissions")
            .where("renewal_status", "==", "pending")
            .get();
            
        console.log(`📊 Pending renewals (using renewal_status): ${pendingSnapshot.size}`);
        
        if (pendingSnapshot.size === 0) {
            // Also try with 'status' field as fallback
            const statusSnapshot = await db.collection("renewalSubmissions")
                .where("status", "==", "pending")
                .get();
                
            console.log(`📊 Pending renewals (using status): ${statusSnapshot.size}`);
            
            if (statusSnapshot.size === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-8 text-center text-yellow-500">
                            ℹ️ No pending renewal requests found.
                        </td>
                    </tr>
                `;
                return;
            } else {
                // Use the status field results
                displayRenewals(statusSnapshot, tbody, 'status');
            }
        } else {
            // Use the renewal_status field results
            displayRenewals(pendingSnapshot, tbody, 'renewal_status');
        }
        
    } catch (error) {
        console.error("❌ Error loading renewals:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-red-500">
                    Firestore Error: ${error.message}
                </td>
            </tr>
        `;
    }
}

function displayRenewals(snapshot, tbody, fieldUsed) {
    tbody.innerHTML = "";
    
    snapshot.forEach(doc => {
        const data = doc.data();
        
        // 1. Store data in cache for the View Modal
        cachedRenewals[doc.id] = data;
        
        const name = `${data.firstName || ''} ${data.middleInitial || ''} ${data.lastName || ''}`.trim() || 'Unknown Name';
        const date = data.submittedAt ? 
            data.submittedAt.toDate().toLocaleDateString() : 
            (data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A');
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${name}</div>
                <div class="text-xs text-gray-500">User: ${data.userId || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">ID Renewal</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Pending
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex justify-end space-x-2">
                    <button class="view-btn px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700" 
                        data-id="${doc.id}">
                        View
                    </button>
                    
                    <button class="approve-btn px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700" 
                        data-id="${doc.id}" data-userid="${data.userId}">
                        Approve
                    </button>
                    
                    <button class="reject-btn px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700" 
                        data-id="${doc.id}" data-userid="${data.userId}">
                        Reject
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners
    tbody.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            handleView(this.dataset.id);
        });
    });

    tbody.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            handleApprove(this.dataset.id, this.dataset.userid);
        });
    });
    
    tbody.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            handleReject(this.dataset.id, this.dataset.userid);
        });
    });
}

// --- MODAL LOGIC ---

function handleView(id) {
    const data = cachedRenewals[id];
    if (!data) {
        alert("Error: Data not found in cache.");
        return;
    }

    console.log("👁️ Viewing data:", data);

    // Helper to safely set text
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val || "N/A";
    };

    // Helper to handle images
    const setImg = (imgId, noImgId, url) => {
        const imgEl = document.getElementById(imgId);
        const txtEl = document.getElementById(noImgId);
        
        if (url && url.length > 5) {
            imgEl.src = url;
            imgEl.classList.remove('hidden');
            txtEl.classList.add('hidden');
        } else {
            imgEl.classList.add('hidden');
            txtEl.classList.remove('hidden');
        }
    };

    // 1. Personal Info
    const fullName = `${data.firstName || ''} ${data.middleInitial || ''} ${data.lastName || ''}`.trim();
    setText('m-fullname', fullName);
    setText('m-email', data.email);
    setText('m-dob', data.dateOfBirth);
    setText('m-age', data.age);
    setText('m-sex', data.sex);
    setText('m-pob', data.placeOfBirth);
    setText('m-civil', data.civilStatus);
    setText('m-ethnicity', data.ethnicity);
    setText('m-religion', data.religion);

    // 2. Family & Employment
    setText('m-occupation', data.occupation);
    setText('m-company', data.companyAgency);
    setText('m-income', data.monthlyIncome);
    setText('m-numChildren', data.numberOfChildren);
    
    // Handle array of children ages
    let kidsAges = "None";
    if (Array.isArray(data.childrenAges) && data.childrenAges.length > 0) {
        kidsAges = data.childrenAges.join(', ');
    }
    setText('m-childrenAges', kidsAges);

    // Philhealth
    setText('m-hasPhilhealth', data.hasPhilhealth ? "Yes" : "No");
    setText('m-philId', data.philhealthIdNumber);

    // 3. Documents (Images)
    setImg('img-validId', 'no-img-validId', data.proofIdUrl);
    setImg('img-soloParent', 'no-img-soloParent', data.proofSoloParentUrl);
    setImg('img-philhealth', 'no-img-philhealth', data.philhealthIdUrl);

    // Show Modal
    document.getElementById('viewModal').classList.remove('hidden');
}

// Function to close modal (attached to window so onclick works)
window.closeModal = function() {
    document.getElementById('viewModal').classList.add('hidden');
}

// --- ACTIONS LOGIC ---

async function handleApprove(submissionId, userId) {
    if (!confirm("Approve this renewal? This will update the user's official record.")) return;
    
    try {
        const db = firebase.firestore();
        const submissionDoc = await db.collection("renewalSubmissions").doc(submissionId).get();
        const submissionData = submissionDoc.data();
        
        const updateData = {};
        const systemFields = ['id', 'userId', 'submittedAt', 'renewal_status', 'status', 'createdAt', 'submissionId', 'reviewedDate'];
        
        for (const [key, value] of Object.entries(submissionData)) {
            if (!systemFields.includes(key)) {
                updateData[key] = value;
            }
        }
        
        updateData.renewal_status = "approved";
        updateData.lastRenewalDate = firebase.firestore.FieldValue.serverTimestamp();
        
        const batch = db.batch();
        const userRef = db.collection("users").doc(userId);
        batch.update(userRef, updateData);
        
        const submissionRef = db.collection("renewalSubmissions").doc(submissionId);
        batch.update(submissionRef, {
            status: "approved",
            renewal_status: "approved",
            reviewedDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        alert("✅ Renewal approved successfully!");
        location.reload();
        
    } catch (error) {
        console.error("❌ Approval error:", error);
        alert("❌ Error approving renewal: " + error.message);
    }
}

async function handleReject(submissionId, userId) {
    const reason = prompt("Please provide a reason for rejection:", "Incomplete documentation");
    if (reason === null) return;

    if (!confirm(`Reject this renewal request? Reason: ${reason}`)) return;
    
    try {
        const db = firebase.firestore();
        const batch = db.batch();
        
        const submissionRef = db.collection("renewalSubmissions").doc(submissionId);
        batch.update(submissionRef, {
            status: "rejected",
            renewal_status: "rejected",
            rejectionReason: reason,
            reviewedDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const userRef = db.collection("users").doc(userId);
        batch.update(userRef, {
            renewal_status: "rejected"
        });
        
        await batch.commit();
        
        alert("Renewal rejected.");
        location.reload();
        
    } catch (error) {
        console.error("❌ Rejection error:", error);
        alert("❌ Error: " + error.message);
    }
}

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRenewalsPage);
} else {
    initRenewalsPage();
}