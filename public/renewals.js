// public/renewals.js - FULL FIXED VERSION

console.log("🎯 renewals.js loaded!");

let cachedRenewals = {};
let rejectTargetId = null;
let rejectTargetUserId = null;
let pendingRejectReason = "";

document.addEventListener('DOMContentLoaded', async function() {
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-blue-500">Loading Renewals...</td></tr>';

        const firebaseConfig = {
            apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
            authDomain: "solo-parent-app.firebaseapp.com",
            databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "solo-parent-app",
            storageBucket: "solo-parent-app.firebasestorage.app",
            messagingSenderId: "292578110807",
            appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212"
        };
        
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        const db = firebase.firestore();
        console.log("✅ Firebase initialized");

        // Load Data - Try 'renewal_status' first
        let snapshot = await db.collection("renewalSubmissions").where("renewal_status", "==", "pending").get();

        // Fallback for older data
        if (snapshot.empty) {
            snapshot = await db.collection("renewalSubmissions").where("status", "==", "pending").get();
        }

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-yellow-500">ℹ️ No pending renewals.</td></tr>`;
            return;
        }

        displayRenewals(snapshot, tbody);

    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
});

function displayRenewals(snapshot, tbody) {
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        cachedRenewals[doc.id] = data;
        const name = `${data.firstName || ''} ${data.middleInitial ? data.middleInitial + '.' : ''} ${data.lastName || ''}`.trim() || 'Unknown';
        const date = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString() : 'N/A';

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 border-b";
        row.innerHTML = `
            <td class="px-6 py-4 font-bold text-gray-900">${name}</td>
            <td class="px-6 py-4 text-sm text-gray-600">ID Renewal</td>
            <td class="px-6 py-4 text-sm text-gray-500">${date}</td>
            <td class="px-6 py-4"><span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">Pending</span></td>
            <td class="px-6 py-4 text-right">
                <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs mr-2 hover:bg-blue-700" onclick="handleView('${doc.id}')">View</button>
                <button class="bg-green-600 text-white px-3 py-1 rounded text-xs mr-2 hover:bg-green-700" onclick="handleApprove('${doc.id}', '${data.userId}')">Approve</button>
                <button class="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700" onclick="openRejectModal('${doc.id}', '${data.userId}')">Reject</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- ACTIONS ---

// FULL View Modal Logic
window.handleView = function(id) {
    const data = cachedRenewals[id];
    if (!data) return;

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
    
    // 1. Address Logic
    let addressParts = [data.houseNumber, data.streetName, data.subdivision].filter(Boolean).join(' ');
    if (data.barangay) addressParts += (addressParts ? ', ' : '') + data.barangay;
    if (data.municipality || data.city) addressParts += ', ' + (data.municipality || data.city);
    // Fallback
    if (!addressParts && data.address) addressParts = data.address;
    
    setText('m-address', addressParts);

    // 2. Personal Info
    const fullName = `${data.firstName || ''} ${data.middleInitial ? data.middleInitial + '.' : ''} ${data.lastName || ''}`.trim();
    setText('m-fullname', fullName);
    setText('m-email', data.email);
    setText('m-dob', data.dateOfBirth);
    setText('m-age', data.age);
    setText('m-sex', data.sex);
    setText('m-pob', data.placeOfBirth);
    setText('m-civil', data.civilStatus);
    setText('m-ethnicity', data.ethnicity);
    setText('m-religion', data.religion);

    // 3. Family & Employment
    setText('m-occupation', data.occupation);
    setText('m-company', data.companyAgency);
    setText('m-income', data.monthlyIncome);
    setText('m-numChildren', data.numberOfChildren);
    
    let kidsAges = "None";
    if (Array.isArray(data.childrenAges) && data.childrenAges.length > 0) {
        kidsAges = data.childrenAges.join(', ');
    }
    setText('m-childrenAges', kidsAges);

    setText('m-hasPhilhealth', data.hasPhilhealth ? "Yes" : "No");
    setText('m-philId', data.philhealthIdNumber);

    // 4. Images
    setImg('img-validId', 'no-img-validId', data.proofIdUrl);
    setImg('img-soloParent', 'no-img-soloParent', data.proofSoloParentUrl);
    setImg('img-philhealth', 'no-img-philhealth', data.philhealthIdUrl);
    
    document.getElementById('viewModal').classList.remove('hidden');
};

window.closeModal = function() { document.getElementById('viewModal').classList.add('hidden'); };

// Approve Logic
window.handleApprove = async function(submissionId, userId) {
    if (!confirm("Approve this renewal?")) return;
    try {
        const db = firebase.firestore();
        const batch = db.batch();

        batch.update(db.collection("renewalSubmissions").doc(submissionId), { status: "approved", renewal_status: "approved", reviewedDate: firebase.firestore.FieldValue.serverTimestamp() });
        batch.update(db.collection("users").doc(userId), { renewal_status: "approved", lastRenewalDate: firebase.firestore.FieldValue.serverTimestamp() });

        await batch.commit();
        showSuccessModal("Renewal Approved!");
    } catch (error) { alert("Error: " + error.message); }
};

// Reject Modal Logic
window.openRejectModal = function(subId, userId) {
    rejectTargetId = subId;
    rejectTargetUserId = userId;
    document.getElementById('rejectModal').classList.remove('hidden');
};

window.closeRejectModal = function() { document.getElementById('rejectModal').classList.add('hidden'); };

window.updateRejectText = function() {
    const select = document.getElementById('reject-select');
    const text = document.getElementById('reject-reason-text');
    if(select.value === "Other") { text.value = ""; text.placeholder = "Type reason..."; } 
    else { text.value = select.value; }
};

window.confirmRejectSubmission = function() {
    pendingRejectReason = document.getElementById('reject-reason-text').value;
    if(!pendingRejectReason) { alert("Please enter a reason"); return; }
    
    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('confirm-title').innerText = "Confirm Rejection";
    document.getElementById('confirm-message').innerText = "Are you sure you want to reject this renewal?";
    document.getElementById('confirm-btn-action').onclick = finalizeRejection;
    document.getElementById('confirmModal').classList.remove('hidden');
};

window.closeConfirmModal = function() {
    document.getElementById('confirmModal').classList.add('hidden');
    document.getElementById('rejectModal').classList.remove('hidden');
};

window.finalizeRejection = async function() {
    try {
        const db = firebase.firestore();
        const batch = db.batch();

        batch.update(db.collection("renewalSubmissions").doc(rejectTargetId), { 
            status: "rejected", renewal_status: "rejected", rejectionReason: pendingRejectReason, reviewedDate: firebase.firestore.FieldValue.serverTimestamp() 
        });
        batch.update(db.collection("users").doc(rejectTargetUserId), { 
            renewal_status: "rejected" 
        });
        
        await batch.commit();
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Renewal Rejected Successfully.");
    } catch (error) { alert("Error: " + error.message); }
};

// Success Modal Logic
window.showSuccessModal = function(msg) {
    document.getElementById('success-message').innerText = msg;
    document.getElementById('successModal').classList.remove('hidden');
};
window.closeSuccessModal = function() { location.reload(); };