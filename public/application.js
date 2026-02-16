// public/applications.js
console.log("🎯 applications.js loaded!");

let cachedApps = {};
let rejectTargetId = null;
let approveTargetId = null;
let pendingRejectReason = "";

document.addEventListener('DOMContentLoaded', async function() {
    const tbody = document.getElementById('applications-table-body');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-blue-500">Loading applications...</td></tr>';

        // 1. Initialize Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
            authDomain: "solo-parent-app.firebaseapp.com",
            databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "solo-parent-app",
            storageBucket: "solo-parent-app.firebasestorage.app",
            messagingSenderId: "292578110807",
            appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212"
        };
        
        if (!firebase.apps.length) { 
            firebase.initializeApp(firebaseConfig); 
        }
        const db = firebase.firestore();
        console.log("✅ Firebase initialized");

        // 2. Fetch Users (Filter for pending only)
        const snapshot = await db.collection("users")
            .where("status", "==", "pending") // ONLY SHOW PENDING
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No pending applications found.</td></tr>`;
            return;
        }

        // 3. Render Rows
        tbody.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            cachedApps[doc.id] = data;
            renderRow(doc.id, data, tbody);
        });

    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
});

function renderRow(id, data, tbody) {
    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown';
    let dateDisplay = "N/A";
    
    if (data.createdAt && data.createdAt.toDate) {
        dateDisplay = data.createdAt.toDate().toLocaleDateString();
    } else if (data.createdAt) {
        dateDisplay = new Date(data.createdAt).toLocaleDateString();
    }

    const row = document.createElement('tr');
    row.className = "hover:bg-gray-50 border-b border-gray-100 last:border-0 transition";
    
    // Note: Status column removed as requested
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-bold text-gray-900">${name}</div>
            <div class="text-xs text-gray-500">ID: ${id}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">New Registration</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dateDisplay}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex justify-end gap-2">
                <button class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 shadow-sm" onclick="openViewModal('${id}')">View</button>
                <button class="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700 shadow-sm" onclick="confirmApprove('${id}')">Approve</button>
                <button class="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 shadow-sm" onclick="openRejectModal('${id}')">Reject</button>
            </div>
        </td>
    `;
    tbody.appendChild(row);
}

// ============================
//    VIEW MODAL LOGIC
// ============================
window.openViewModal = function(id) { 
    const data = cachedApps[id];
    if (!data) return;

    const setTxt = (elId, val) => { const el = document.getElementById(elId); if(el) el.textContent = val || "N/A"; };

    // Header
    setTxt('v-fullname-header', `${data.firstName} ${data.lastName}`);
    setTxt('v-avatar', (data.firstName || 'U').charAt(0).toUpperCase());
    setTxt('v-category-header', data.category || "Applicant");
    setTxt('v-email-card', data.email);
    setTxt('v-contact-card', data.contact);
    
    // Address Builder
    const address = [data.houseNumber, data.street, data.barangay, data.municipality].filter(Boolean).join(', ');
    setTxt('v-address-card', address || data.address);
    setTxt('v-id-card', id);

    // Personal Info
    setTxt('v-fullname-detail', `${data.firstName} ${data.lastName}`);
    setTxt('v-email-detail', data.email);
    setTxt('v-dob', data.dateOfBirth);
    setTxt('v-age', data.age);
    setTxt('v-sex', data.sex);
    setTxt('v-pob', data.placeOfBirth);
    setTxt('v-civil', data.civilStatus);
    setTxt('v-ethnicity', data.ethnicity);
    setTxt('v-religion', data.religion);
    setTxt('v-dateReg', data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : "N/A");

    // Family & Employment
    setTxt('v-occupation', data.occupation);
    setTxt('v-company', data.companyAgency);
    setTxt('v-income', data.monthlyIncome);
    setTxt('v-philhealth', data.philhealthId);
    
    if (Array.isArray(data.childrenAges)) {
        setTxt('v-children-count', data.childrenAges.length);
        setTxt('v-children-ages', data.childrenAges.join(', '));
    } else {
        setTxt('v-children-count', "0");
        setTxt('v-children-ages', "None");
    }

    // Images
    const setImg = (imgId, txtId, url) => {
        const img = document.getElementById(imgId);
        const txt = document.getElementById(txtId);
        if (url && url.length > 5) {
            img.src = url;
            img.classList.remove('hidden');
            txt.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            txt.classList.remove('hidden');
        }
    };
    // Note: Checking for variations in field names
    setImg('v-img-valid', 'v-txt-valid', data.proofIdUrl || data.validIdUrl);
    setImg('v-img-proof', 'v-txt-proof', data.proofSoloParentUrl || data.soloParentIdUrl);
    setImg('v-img-phil', 'v-txt-phil', data.philhealthIdUrl);

    // Bind Buttons in View Modal
    document.getElementById('btn-approve-view').onclick = () => { closeViewModal(); confirmApprove(id); };
    document.getElementById('btn-reject-view').onclick = () => { closeViewModal(); openRejectModal(id); };

    document.getElementById('viewModal').classList.remove('hidden');
};

window.closeViewModal = function() {
    document.getElementById('viewModal').classList.add('hidden');
};

// ============================
//    APPROVE LOGIC
// ============================
window.confirmApprove = function(userId) {
    approveTargetId = userId;
    
    document.getElementById('confirm-title').innerText = "Confirm Approval";
    document.getElementById('confirm-message').innerText = "Approve this user? Status will become 'approved'.";
    
    const btn = document.getElementById('confirm-btn-action');
    btn.className = "px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition";
    btn.innerText = "Yes, Approve";
    btn.onclick = finalizeApprove;

    document.getElementById('confirmModal').classList.remove('hidden');
};

window.finalizeApprove = async function() {
    const btn = document.getElementById('confirm-btn-action');
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const db = firebase.firestore();
        await db.collection("users").doc(approveTargetId).update({ 
            status: "approved", 
            isVerified: true, 
            verificationDate: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Application Approved!");
        
    } catch (error) { 
        alert("Error: " + error.message); 
        document.getElementById('confirmModal').classList.add('hidden');
        btn.disabled = false;
    }
};

// ============================
//    REJECT LOGIC (UPDATED UX)
// ============================

window.openRejectModal = function(id) { 
    rejectTargetId = id; 
    
    // Reset Form
    document.getElementById('reject-select').value = "";
    document.getElementById('reject-reason-text').value = "";
    
    // Initial Validation Check (This disables the button)
    handleRejectValidation();
    
    document.getElementById('rejectModal').classList.remove('hidden'); 
};

window.closeRejectModal = () => document.getElementById('rejectModal').classList.add('hidden');

// NEW: Validation Function
window.handleRejectValidation = function() {
    const selectVal = document.getElementById('reject-select').value;
    const textVal = document.getElementById('reject-reason-text').value.trim();
    const btn = document.getElementById('btn-reject-submit');

    let isValid = false;

    if (!selectVal) {
        // No selection made
        isValid = false;
    } else if (selectVal === "Other") {
        // If "Other", text box is MANDATORY
        isValid = textVal.length > 0;
        // Auto-focus text box if Other is picked
        if (!isValid && document.activeElement !== document.getElementById('reject-reason-text')) {
            document.getElementById('reject-reason-text').placeholder = "Please type the specific reason here...";
        }
    } else {
        // Standard option selected, text box is optional
        isValid = true;
        document.getElementById('reject-reason-text').placeholder = "Additional comments (Optional)...";
    }

    // Toggle Button State
    if (isValid) {
        btn.disabled = false;
        btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        btn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        btn.disabled = true;
        btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        btn.classList.remove('bg-red-600', 'hover:bg-red-700');
    }
};

window.confirmRejectSubmission = function() {
    const selectVal = document.getElementById('reject-select').value;
    const textVal = document.getElementById('reject-reason-text').value;
    
    if (selectVal === "Other") {
        pendingRejectReason = textVal;
    } else {
        // Combine standard reason with optional text
        pendingRejectReason = selectVal + (textVal ? `: ${textVal}` : "");
    }

    document.getElementById('rejectModal').classList.add('hidden');
    
    // Show Confirmation
    document.getElementById('confirm-title').innerText = "Confirm Rejection";
    document.getElementById('confirm-message').innerText = "Are you sure you want to reject this application?";
    const btn = document.getElementById('confirm-btn-action');
    btn.className = "px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700";
    btn.innerText = "Yes, Reject";
    btn.onclick = executeRejection;

    document.getElementById('confirmModal').classList.remove('hidden');
};

async function executeRejection() {
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(rejectTargetId).update({ 
            status: "rejected", 
            rejectionReason: pendingRejectReason 
        });
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Application Rejected.");
    } catch (e) {
        alert("Error: " + e.message);
        document.getElementById('confirmModal').classList.add('hidden');
    }
}

// ============================
//    SUCCESS MODAL
// ============================
window.showSuccessModal = function(msg) {
    if (document.getElementById('successModal')) {
        document.getElementById('success-message').innerText = msg;
        document.getElementById('successModal').classList.remove('hidden');
    } else { alert(msg); location.reload(); }
};

window.closeSuccessModal = function() {
    location.reload();
};