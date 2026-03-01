console.log("🎯 application.js loaded - Zero Native Pop-ups, Bug-Free Approval");

let pendingUsersCache = {};
let currentReviewingUid = null; 
let pendingApprovalType = null;
let pendingApprovalTargetId = null;

document.addEventListener('DOMContentLoaded', async function() {
    const firebaseConfig = { 
        apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24", 
        authDomain: "solo-parent-app.firebaseapp.com", 
        databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedatabase.app", 
        projectId: "solo-parent-app", 
        storageBucket: "solo-parent-app.firebasestorage.app", 
        messagingSenderId: "292578110807", 
        appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212" 
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore(); 
    loadPendingApplications();
});

// Helper to safely close modals
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

// ==========================================
// CUSTOM NOTIFICATION HELPER
// ==========================================
window.showNotification = function(title, message, type = 'success') {
    document.getElementById('notif-title').innerText = title;
    document.getElementById('notif-message').innerText = message;
    
    const iconContainer = document.getElementById('notif-icon-container');
    const icon = document.getElementById('notif-icon');
    
    if (type === 'success') {
        iconContainer.className = "mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mb-4";
        icon.setAttribute('data-feather', 'check');
        icon.className = "h-7 w-7 text-green-600";
    } else {
        iconContainer.className = "mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-4";
        icon.setAttribute('data-feather', 'x');
        icon.className = "h-7 w-7 text-red-600";
    }
    
    feather.replace();
    document.getElementById('notificationModal').classList.remove('hidden');
};

// ==========================================
// 1. LOAD PENDING APPLICATIONS
// ==========================================
async function loadPendingApplications() {
    const tableBody = document.getElementById('pending-table-body');
    if (!tableBody) return; 

    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading pending applications...</td></tr>';
    pendingUsersCache = {};

    try {
        const snapshot = await window.db.collection("users").where("status", "==", "pending").get();

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No pending applications.</td></tr>';
            return;
        }

        tableBody.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            pendingUsersCache[doc.id] = data; 
            
            tableBody.innerHTML += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3">${data.firstName || ''} ${data.lastName || ''}</td>
                    <td class="p-3 font-mono text-sm">${data.soloParentIdNumber || 'N/A'}</td>
                    <td class="p-3">${data.municipality || 'N/A'}</td>
                    <td class="p-3"><span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200">Pending</span></td>
                    <td class="p-3">
                        <button onclick='reviewApplication("${doc.id}")' class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition shadow-sm">
                            Review
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading applications:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. COMPREHENSIVE REVIEW & POPULATE UI
// ==========================================
window.reviewApplication = async function(authUid) {
    const userData = pendingUsersCache[authUid];
    if (!userData) { 
        showNotification("Error", "User data not found. Please refresh the page.", "error");
        return; 
    }
    currentReviewingUid = authUid;

    const modal = document.getElementById('reviewModal'); 
    modal.classList.remove('hidden');

    const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    document.getElementById('v-avatar').innerText = (userData.firstName || "U").charAt(0).toUpperCase();
    document.getElementById('v-name-side').innerText = fullName;
    document.getElementById('v-category').innerText = userData.category || 'N/A';
    document.getElementById('v-email').innerText = userData.email || 'N/A';
    document.getElementById('v-contact').innerText = userData.contact || 'N/A';
    document.getElementById('v-address').innerText = `${userData.barangay || ''}, ${userData.municipality || ''}`.replace(/^, | ,$/g, '') || 'N/A';
    document.getElementById('v-id-side').innerText = userData.soloParentIdNumber || 'N/A';

    document.getElementById('v-name').innerText = fullName;
    document.getElementById('v-email-right').innerText = userData.email || 'N/A';
    document.getElementById('v-dob').innerText = userData.dateOfBirth || 'N/A';
    document.getElementById('v-age').innerText = userData.age || 'N/A';
    document.getElementById('v-sex').innerText = userData.sex || 'N/A';
    document.getElementById('v-birthplace').innerText = userData.placeOfBirth || 'N/A';
    document.getElementById('v-civil').innerText = userData.civilStatus || 'N/A';
    document.getElementById('v-ethnicity').innerText = userData.ethnicity || 'N/A';
    document.getElementById('v-religion').innerText = userData.religion || 'N/A';
    document.getElementById('v-registered').innerText = userData.createdAt && userData.createdAt.toDate ? userData.createdAt.toDate().toLocaleDateString() : 'N/A';

    document.getElementById('v-occupation').innerText = userData.occupation || 'N/A';
    document.getElementById('v-company').innerText = userData.company || 'N/A';
    document.getElementById('v-income').innerText = userData.monthlyIncome || 'N/A';
    document.getElementById('v-children-count').innerText = Array.isArray(userData.childrenAges) ? userData.childrenAges.length : '0';
    document.getElementById('v-children-ages').innerText = Array.isArray(userData.childrenAges) ? userData.childrenAges.join(', ') : 'N/A';
    document.getElementById('v-philhealth-member').innerText = userData.philhealthIdNumber ? 'Yes' : 'No';
    document.getElementById('v-philhealth-id').innerText = userData.philhealthIdNumber || 'N/A';

    const imgId = document.getElementById('v-img-id');
    const imgIdNone = document.getElementById('v-img-id-none');
    if (userData.proofIdUrl) { imgId.src = userData.proofIdUrl; imgId.classList.remove('hidden'); imgIdNone.classList.add('hidden'); } 
    else { imgId.classList.add('hidden'); imgIdNone.classList.remove('hidden'); }

    const imgSp = document.getElementById('v-img-sp');
    const imgSpNone = document.getElementById('v-img-sp-none');
    if (userData.proofSoloParentUrl) { imgSp.src = userData.proofSoloParentUrl; imgSp.classList.remove('hidden'); imgSpNone.classList.add('hidden'); } 
    else { imgSp.classList.add('hidden'); imgSpNone.classList.remove('hidden'); }

    const vBox = document.getElementById('verification-status-box');
    const actionBtns = document.getElementById('modal-action-buttons');
    
    vBox.innerHTML = '<span class="text-gray-500 flex items-center text-sm"><i data-feather="loader" class="animate-spin mr-2 w-4 h-4"></i> Checking official database...</span>';
    actionBtns.innerHTML = ''; 
    feather.replace();

    const searchId = userData.soloParentIdNumber;

    try {
        let officialDoc = null;
        let officialData = null;

        if (searchId) {
            const idQuery = await window.db.collection("solo_parent_records").where("soloParentIdNumber", "==", searchId).get();
            if (!idQuery.empty) officialDoc = idQuery.docs[0];
        }
        if (!officialDoc && userData.firstName && userData.lastName) {
            const nameQuery = await window.db.collection("solo_parent_records").where("firstName", "==", userData.firstName).where("lastName", "==", userData.lastName).get();
            if (!nameQuery.empty) officialDoc = nameQuery.docs[0];
        }

        const btnReject = `<button onclick="openRejectModal()" class="w-full bg-red-100 text-red-700 py-2.5 rounded-md font-bold hover:bg-red-200 transition flex items-center justify-center shadow-sm"><i data-feather="x-circle" class="w-4 h-4 mr-2"></i> Reject App</button>`;

        if (officialDoc) {
            officialData = officialDoc.data();
            const officialDocId = officialDoc.id; 

            const appFirstName = (userData.firstName || "").trim().toLowerCase();
            const officialFirstName = (officialData.firstName || "").trim().toLowerCase();
            const appLastName = (userData.lastName || "").trim().toLowerCase();
            const officialLastName = (officialData.lastName || "").trim().toLowerCase();
            const appID = (searchId || "").trim().toLowerCase();
            const officialID = (officialData.soloParentIdNumber || "").trim().toLowerCase();

            const isNameMatch = (appFirstName === officialFirstName && appLastName === officialLastName);
            const isIdMatch = (appID === officialID);

            const dbSummaryHTML = `
                <div class="mt-3 bg-white border rounded p-3 text-sm">
                    <p class="text-xs text-gray-500 uppercase font-bold mb-1 border-b pb-1">Found Official LGU Record</p>
                    <p class="font-medium text-gray-800">${officialData.firstName} ${officialData.lastName}</p>
                    <p class="text-xs text-gray-500 font-mono mt-0.5">ID: ${officialData.soloParentIdNumber}</p>
                </div>
            `;

            if (isNameMatch && isIdMatch && officialData.is_online === false) {
                vBox.className = "bg-green-50 border border-green-200 p-5 rounded-lg shadow-sm";
                vBox.innerHTML = `<p class="text-green-800 font-bold flex items-center text-lg"><i data-feather="check-circle" class="mr-2"></i> Perfect Match Found</p><p class="text-green-700 text-sm mt-1">This applicant securely matches an offline record. You can safely merge the data.</p>${dbSummaryHTML}`;
                actionBtns.innerHTML = `
                    <button onclick="openConfirmModal('merge', '${officialDocId}')" class="w-full bg-green-600 text-white py-2.5 rounded-md font-bold hover:bg-green-700 shadow-md flex items-center justify-center transition"><i data-feather="check" class="w-4 h-4 mr-2"></i> Merge & Approve</button>
                    ${btnReject}
                `;
            } 
            else if (officialData.is_online === true) {
                vBox.className = "bg-yellow-50 border border-yellow-200 p-5 rounded-lg shadow-sm";
                vBox.innerHTML = `<p class="text-yellow-800 font-bold flex items-center text-lg"><i data-feather="alert-triangle" class="mr-2"></i> Record Already Claimed</p><p class="text-yellow-700 text-sm mt-1">This official record is already linked to a registered mobile user. Cannot merge.</p>${dbSummaryHTML}`;
                actionBtns.innerHTML = btnReject;
            }
            else {
                vBox.className = "bg-orange-50 border border-orange-200 p-5 rounded-lg shadow-sm";
                let warning = !isNameMatch ? "Name does not match." : "ID Number does not match exactly.";
                vBox.innerHTML = `<p class="text-orange-800 font-bold flex items-center text-lg"><i data-feather="alert-circle" class="mr-2"></i> Partial Match / Typo</p><p class="text-orange-700 text-sm mt-1"><b>Warning:</b> ${warning} Please verify carefully before overriding.</p>${dbSummaryHTML}`;
                actionBtns.innerHTML = `
                    <button onclick="openConfirmModal('merge', '${officialDocId}')" class="w-full bg-orange-500 text-white py-2.5 rounded-md font-bold hover:bg-orange-600 shadow-md flex items-center justify-center transition"><i data-feather="alert-octagon" class="w-4 h-4 mr-2"></i> Force Merge Override</button>
                    ${btnReject}
                `;
            }

        } else {
            vBox.className = "bg-blue-50 border border-blue-200 p-5 rounded-lg shadow-sm";
            vBox.innerHTML = `<p class="text-blue-800 font-bold flex items-center text-lg"><i data-feather="info" class="mr-2"></i> No Official Record Found</p><p class="text-blue-700 text-sm mt-1">We could not find this ID or Name in the LGU database. Approving will create a brand new official LGU record.</p>`;
            actionBtns.innerHTML = `
                <button onclick="openConfirmModal('new', '${searchId}')" class="w-full bg-blue-600 text-white py-2.5 rounded-md font-bold hover:bg-blue-700 shadow-md flex items-center justify-center transition"><i data-feather="user-plus" class="w-4 h-4 mr-2"></i> Approve New Member</button>
                ${btnReject}
            `;
        }
        feather.replace();

    } catch (error) {
        console.error("Database check failed:", error);
        vBox.innerHTML = `<p class="text-red-600 text-sm">Error checking database.</p>`;
    }
};

// ==========================================
// 3. CUSTOM APPROVAL MODAL LOGIC
// ==========================================
window.openConfirmModal = function(type, targetId) {
    pendingApprovalType = type;
    pendingApprovalTargetId = targetId;
    
    const title = document.getElementById('confirm-modal-title');
    const desc = document.getElementById('confirm-modal-desc');
    const btn = document.getElementById('final-approve-btn');

    // FIX 1: Explicitly unlock the button every time the modal opens
    btn.disabled = false;

    if (type === 'merge') {
        title.innerText = "Confirm Merge & Approval";
        title.className = "text-xl font-bold text-green-800 mb-2";
        desc.innerText = "This will permanently merge the mobile app submission with the official LGU database record. Are you sure you want to proceed?";
        btn.className = "px-5 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md text-sm font-bold shadow transition flex items-center";
        btn.innerHTML = '<i data-feather="check-circle" class="w-4 h-4 mr-2"></i> Confirm Merge';
    } else {
        title.innerText = "Confirm New Member Approval";
        title.className = "text-xl font-bold text-blue-800 mb-2";
        desc.innerText = "This will create a brand new official LGU record for this applicant and mark their status as approved. Are you sure?";
        btn.className = "px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-bold shadow transition flex items-center";
        btn.innerHTML = '<i data-feather="user-check" class="w-4 h-4 mr-2"></i> Confirm Approval';
    }
    
    document.getElementById('confirmApproveModal').classList.remove('hidden');
    feather.replace();
};

window.executeFinalApproval = async function() {
    const type = pendingApprovalType;
    const targetId = pendingApprovalTargetId;

    const confirmBtn = document.getElementById('final-approve-btn');
    confirmBtn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2 inline"></i> Processing...';
    confirmBtn.disabled = true;
    feather.replace();

    const btnContainer = document.getElementById('modal-action-buttons');
    btnContainer.innerHTML = '<span class="text-blue-600 font-bold px-4 py-2 flex justify-center"><i data-feather="loader" class="animate-spin mr-2"></i> Executing Data Write...</span>';
    feather.replace();

    try {
        const batch = window.db.batch();
        const mobileUserRef = window.db.collection("users").doc(currentReviewingUid);
        const userData = pendingUsersCache[currentReviewingUid];

        if (type === 'merge') {
            const officialRecordRef = window.db.collection("solo_parent_records").doc(targetId);
            batch.update(officialRecordRef, {
                auth_uid: currentReviewingUid,
                is_online: true,
                proofIdUrl: userData.proofIdUrl || null,
                proofSoloParentUrl: userData.proofSoloParentUrl || null,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.update(mobileUserRef, {
                status: "approved",
                record_id: targetId,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else if (type === 'new') {
            let cleanId = targetId ? targetId.trim() : null;
            const newOfficialRef = cleanId 
                ? window.db.collection("solo_parent_records").doc(cleanId) 
                : window.db.collection("solo_parent_records").doc(); 

            batch.set(newOfficialRef, {
                ...userData,
                status: "approved",
                is_online: true,
                auth_uid: currentReviewingUid,
                registrationDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.update(mobileUserRef, {
                status: "approved",
                record_id: newOfficialRef.id,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
        
        closeModal('confirmApproveModal');
        closeModal('reviewModal');
        
        loadPendingApplications(); 
        
        showNotification("Approval Successful", "The application was successfully approved and the database has been updated.", "success");
        
    } catch (error) {
        console.error("Action failed: ", error);
        closeModal('confirmApproveModal');
        showNotification("Error", "Failed to update database. Please check console for details.", "error");
    } finally {
        // FIX 2: Safely reset the button in case it fails or finishes processing
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }
};

// ==========================================
// 4. REJECTION FLOW WITH VALIDATION
// ==========================================
window.openRejectModal = function() {
    document.getElementById('reject-reason-select').value = "";
    document.getElementById('reject-reason-text').value = ""; 
    
    validateRejectForm();
    
    document.getElementById('rejectModal').classList.remove('hidden');
    document.getElementById('confirm-reject-btn').onclick = () => executeReject();
};

window.validateRejectForm = function() {
    const select = document.getElementById('reject-reason-select').value;
    const text = document.getElementById('reject-reason-text').value.trim();
    const btn = document.getElementById('confirm-reject-btn');

    let isValid = false;

    if (select && select !== 'Other') {
        isValid = true;
    } else if (select === 'Other' && text.length > 0) {
        isValid = true;
    }

    if (isValid) {
        btn.disabled = false;
        btn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        btn.classList.add('bg-red-600', 'hover:bg-red-700', 'shadow');
    } else {
        btn.disabled = true;
        btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        btn.classList.remove('bg-red-600', 'hover:bg-red-700', 'shadow');
    }
};

window.executeReject = async function() {
    const selectVal = document.getElementById('reject-reason-select').value;
    const textVal = document.getElementById('reject-reason-text').value.trim();
    
    let finalReason = selectVal;
    if (textVal) {
        finalReason += ` - ${textVal}`;
    }

    const confirmBtn = document.getElementById('confirm-reject-btn');
    confirmBtn.innerText = "Rejecting...";
    confirmBtn.disabled = true;

    try {
        await window.db.collection("users").doc(currentReviewingUid).update({
            status: "rejected",
            rejectReason: finalReason,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeModal('rejectModal');
        closeModal('reviewModal');
        loadPendingApplications();
        
        showNotification("Application Rejected", "The application has been securely rejected.", "success");
        
    } catch (error) {
        console.error("Reject failed:", error);
        showNotification("Error", "An error occurred while trying to reject the application.", "error");
    } finally {
        confirmBtn.innerText = "Submit Rejection";
        validateRejectForm(); 
    }
};