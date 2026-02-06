// public/renewals.js - FINAL UPDATED VERSION WITH CUSTOM CONFIRMATION

console.log("🎯 renewals.js loaded!");

let cachedRenewals = {};
let rejectTargetId = null; 
let rejectTargetUserId = null;
let pendingRejectReason = ""; // To store reason while confirming

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

// --- INITIALIZATION ---
async function initRenewalsPage() {
    console.log("🚀 Initializing Renewals Page...");
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody) return;
    
    try {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-blue-500">Loading Firebase...</td></tr>';
        await loadFirebaseScripts();
        await waitForFirebase();
        
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
        
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        const db = firebase.firestore();
        console.log("✅ Firebase initialized");
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-green-500">✅ Connected! Loading renewals...</td></tr>';
        await loadRenewals(db, tbody);
        
    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
}

function loadFirebaseScripts() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined') { resolve(); return; }
        const script1 = document.createElement('script');
        script1.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
        const script2 = document.createElement('script');
        script2.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js";
        
        script1.onload = () => { script2.onload = () => resolve(); script2.onerror = reject; document.head.appendChild(script2); };
        script1.onerror = reject; document.head.appendChild(script1);
    });
}

async function loadRenewals(db, tbody) {
    try {
        cachedRenewals = {};
        const pendingSnapshot = await db.collection("renewalSubmissions").where("renewal_status", "==", "pending").get();
            
        if (pendingSnapshot.size === 0) {
            const statusSnapshot = await db.collection("renewalSubmissions").where("status", "==", "pending").get();
            if (statusSnapshot.size === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-yellow-500">ℹ️ No pending renewal requests found.</td></tr>`;
                return;
            } else { displayRenewals(statusSnapshot, tbody); }
        } else { displayRenewals(pendingSnapshot, tbody); }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Firestore Error: ${error.message}</td></tr>`;
    }
}

function displayRenewals(snapshot, tbody) {
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        cachedRenewals[doc.id] = data;
        
        const name = `${data.firstName || ''} ${data.middleInitial ? data.middleInitial + '.' : ''} ${data.lastName || ''}`.trim() || 'Unknown Name';
        const date = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString() : (data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A');
        
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
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex justify-end space-x-2">
                    <button class="view-btn px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700" data-id="${doc.id}">View</button>
                    <button class="approve-btn px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700" data-id="${doc.id}" data-userid="${data.userId}">Approve</button>
                    <button class="reject-btn px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700" onclick="openRejectModal('${doc.id}', '${data.userId}')">Reject</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    tbody.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', function() { handleView(this.dataset.id); }));
    tbody.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', function() { handleApprove(this.dataset.id, this.dataset.userid); }));
}

function handleView(id) {
    const data = cachedRenewals[id];
    if (!data) return;
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val || "N/A"; };
    const setImg = (imgId, noImgId, url) => {
        const imgEl = document.getElementById(imgId);
        const txtEl = document.getElementById(noImgId);
        if (url && url.length > 5) { imgEl.src = url; imgEl.classList.remove('hidden'); txtEl.classList.add('hidden'); } 
        else { imgEl.classList.add('hidden'); txtEl.classList.remove('hidden'); }
    };

    let addressParts = [];
    const streetPart = [data.houseNumber || data.houseNo, data.streetName || data.street, data.subdivision].filter(Boolean).join(' '); 
    if (streetPart) addressParts.push(streetPart);
    if (data.barangay) addressParts.push(data.barangay);
    let fullAddress = addressParts.join(', ');
    if (data.municipality || data.city) { fullAddress += (fullAddress ? ", and " : "") + (data.municipality || data.city); }
    if (!fullAddress && data.address) { fullAddress = data.address; }
    setText('m-address', fullAddress);

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
    setText('m-occupation', data.occupation);
    setText('m-company', data.companyAgency);
    setText('m-income', data.monthlyIncome);
    setText('m-numChildren', data.numberOfChildren);
    let kidsAges = "None"; if (Array.isArray(data.childrenAges)) { kidsAges = data.childrenAges.join(', '); }
    setText('m-childrenAges', kidsAges);
    setText('m-hasPhilhealth', data.hasPhilhealth ? "Yes" : "No");
    setText('m-philId', data.philhealthIdNumber);
    setImg('img-validId', 'no-img-validId', data.proofIdUrl);
    setImg('img-soloParent', 'no-img-soloParent', data.proofSoloParentUrl);
    setImg('img-philhealth', 'no-img-philhealth', data.philhealthIdUrl);
    document.getElementById('viewModal').classList.remove('hidden');
}

window.closeModal = function() { document.getElementById('viewModal').classList.add('hidden'); }

async function handleApprove(submissionId, userId) {
    // We can also use the new modal for Approve later, but keeping confirm() here for now as requested for Reject flow.
    if (!confirm("Approve this renewal?")) return; 
    try {
        const db = firebase.firestore();
        const submissionDoc = await db.collection("renewalSubmissions").doc(submissionId).get();
        const submissionData = submissionDoc.data();
        const updateData = {};
        const systemFields = ['id', 'userId', 'submittedAt', 'renewal_status', 'status', 'createdAt', 'submissionId', 'reviewedDate'];
        for (const [key, value] of Object.entries(submissionData)) { if (!systemFields.includes(key)) updateData[key] = value; }
        
        updateData.renewal_status = "approved";
        updateData.lastRenewalDate = firebase.firestore.FieldValue.serverTimestamp();
        
        const batch = db.batch();
        batch.update(db.collection("users").doc(userId), updateData);
        batch.update(db.collection("renewalSubmissions").doc(submissionId), { status: "approved", renewal_status: "approved", reviewedDate: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
        alert("✅ Renewal approved!"); location.reload();
    } catch (error) { console.error(error); alert("Error: " + error.message); }
}

// --- REJECT MODAL LOGIC ---

// 1. Open Reject Modal
window.openRejectModal = function(submissionId, userId) {
    rejectTargetId = submissionId;
    rejectTargetUserId = userId;
    document.getElementById('reject-select').value = "";
    document.getElementById('reject-reason-text').value = "";
    document.getElementById('rejectModal').classList.remove('hidden');
}

// 2. Close Reject Modal
window.closeRejectModal = function() {
    document.getElementById('rejectModal').classList.add('hidden');
    rejectTargetId = null;
    rejectTargetUserId = null;
    pendingRejectReason = "";
}

// 3. Auto-fill Text
window.updateRejectText = function() {
    const selectVal = document.getElementById('reject-select').value;
    const textArea = document.getElementById('reject-reason-text');
    if (selectVal && selectVal !== "Other") {
        textArea.value = selectVal;
    } else if (selectVal === "Other") {
        textArea.value = "";
        textArea.placeholder = "Please type the specific reason here...";
        textArea.focus();
    }
}

// 4. Trigger Confirmation (Opens the new small modal)
window.confirmRejectSubmission = function() {
    const reason = document.getElementById('reject-reason-text').value.trim();
    if (!reason) { alert("Please select or type a reason."); return; }
    
    pendingRejectReason = reason; // Store it for the next step

    // Hide Reject Modal & Show Confirmation Modal
    document.getElementById('rejectModal').classList.add('hidden');
    
    // Setup Confirmation Modal Content
    document.getElementById('confirm-title').innerText = "Confirm Rejection";
    document.getElementById('confirm-message').innerText = "Are you sure you want to reject this application? This action cannot be undone.";
    
    // Assign the action to the button
    const confirmBtn = document.getElementById('confirm-btn-action');
    confirmBtn.onclick = finalizeRejection; // Bind the function
    
    document.getElementById('confirmModal').classList.remove('hidden');
}

// 5. Close Confirmation
window.closeConfirmModal = function() {
    document.getElementById('confirmModal').classList.add('hidden');
    // Re-open the previous modal in case they want to edit the reason
    if (rejectTargetId) {
        document.getElementById('rejectModal').classList.remove('hidden');
    }
}

// 6. Finalize (Send to Firebase)
async function finalizeRejection() {
    const confirmBtn = document.getElementById('confirm-btn-action');
    const originalText = confirmBtn.innerText;
    confirmBtn.innerText = "Processing...";
    confirmBtn.disabled = true;

    try {
        const db = firebase.firestore();
        const batch = db.batch();
        
        batch.update(db.collection("renewalSubmissions").doc(rejectTargetId), { 
            status: "rejected", 
            renewal_status: "rejected", 
            rejectionReason: pendingRejectReason, 
            reviewedDate: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        batch.update(db.collection("users").doc(rejectTargetUserId), { renewal_status: "rejected" });
        
        await batch.commit();
        
        // Success
        document.getElementById('confirmModal').classList.add('hidden');
        alert("✅ Application rejected successfully.");
        location.reload();
        
    } catch (error) {
        console.error("❌ Rejection error:", error);
        alert("❌ Error: " + error.message);
        confirmBtn.innerText = originalText;
        confirmBtn.disabled = false;
        closeConfirmModal(); // Go back
    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initRenewalsPage); } else { initRenewalsPage(); }