// public/renewals.js - FINAL PARITY VERSION (WITH FULL SAVING & HIGHLIGHT FIXES)

console.log("🎯 renewals.js loaded!");

let cachedRenewals = {};
let rejectTargetId = null;
let rejectTargetUserId = null;
let approveId = null;
let approveUserId = null;
let pendingRejectReason = "";

document.addEventListener('DOMContentLoaded', async function() {
    feather.replace();
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody) return;

    try {
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

        // Load Data
        let snapshot = await db.collection("renewalSubmissions").where("renewal_status", "==", "pending").get();
        if (snapshot.empty) snapshot = await db.collection("renewalSubmissions").where("status", "==", "pending").get();

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-yellow-500">ℹ️ No pending renewals.</td></tr>`;
            return;
        }

        // Await the display function since it now fetches nested user data
        await displayRenewals(snapshot, tbody, db);

    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
});

// Made async to fetch expiration dates from both collections
async function displayRenewals(snapshot, tbody, db) {
    tbody.innerHTML = "";
    
    for (const doc of snapshot.docs) {
        const data = doc.data();
        cachedRenewals[doc.id] = data;
        const name = `${data.firstName || ''} ${data.middleInitial ? data.middleInitial + '.' : ''} ${data.lastName || ''}`.trim() || 'Unknown';
        const submitDate = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString() : 'N/A';

        let anchorDateObj = null;
        try {
            // 1. Fetch the user's mobile app profile
            const userDoc = await db.collection("users").doc(data.userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // 2. Check if they have renewed before (users collection)
                if (userData.lastRenewalDate) {
                    anchorDateObj = userData.lastRenewalDate.toDate();
                } 
                // 3. If no renewal history, fetch original registration date (solo_parent_records collection)
                else if (userData.record_id) {
                    const recordDoc = await db.collection("solo_parent_records").doc(userData.record_id).get();
                    if (recordDoc.exists && recordDoc.data().registrationDate) {
                        anchorDateObj = recordDoc.data().registrationDate.toDate();
                    }
                }
                
                // 4. Absolute fallback just in case both are missing
                if (!anchorDateObj && userData.approvedAt) {
                    anchorDateObj = userData.approvedAt.toDate();
                }
            }
        } catch (e) {
            console.error("Could not fetch user anchor date", e);
        }

        let statusText = "Date Missing";
        let badgeClass = "bg-gray-100 text-gray-800 border-gray-200";

        if (anchorDateObj) {
            // Calculate Expiration: Anchor Date + 1 Year (Just for color coding!)
            const expDate = new Date(anchorDateObj);
            expDate.setFullYear(expDate.getFullYear() + 1);
            expDate.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Display the ACTUAL DATE ISSUED / RENEWED instead of the future date
            statusText = anchorDateObj.toLocaleDateString();

            // Color code based on urgency
            if (daysLeft < 0) {
                badgeClass = "bg-red-100 text-red-800 border-red-200 animate-pulse"; 
                statusText += ` (Expired)`;
            } else if (daysLeft <= 30) {
                badgeClass = "bg-orange-100 text-orange-800 border-orange-200"; 
                statusText += ` (Expiring Soon)`;
            } else {
                badgeClass = "bg-green-100 text-green-800 border-green-200"; 
                statusText += ` (Valid)`;
            }
        }

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 border-b";
        row.innerHTML = `
            <td class="p-4 font-bold text-gray-900">${name}</td>
            <td class="p-4 text-sm text-gray-600">ID Renewal</td>
            <td class="p-4 text-sm text-gray-500">${submitDate}</td>
            <td class="p-4">
                <span class="${badgeClass} text-xs px-2 py-1 rounded-full border font-bold">
                    ${statusText}
                </span>
            </td>
            <td class="p-4 text-right">
                <button class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition shadow-sm" onclick="handleView('${doc.id}')">Review Form</button>
            </td>
        `;
        tbody.appendChild(row);
    }
}

// ==========================================
// STRING COMPARISON ENGINE (Fixed Blank Value Handling)
// ==========================================
function calculateSimilarity(appStr, officialStr) {
    let s1 = String(appStr || "").trim().toLowerCase();
    let s2 = String(officialStr || "").trim().toLowerCase();

    if (s1 === s2) return 'exact';
    if (s1 === "" || s2 === "") return 'mismatch';

    if (s1.includes(s2) || s2.includes(s1)) return 'partial';

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    
    const distance = costs[s2.length];
    const maxLen = Math.max(s1.length, s2.length);
    
    if (distance <= 2 && maxLen >= 4) return 'partial'; 

    return 'mismatch';
}

function applyHighlight(elementId, appVal, officialVal) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    let safeApp = appVal !== undefined && appVal !== null ? String(appVal).trim() : "";
    let safeOld = officialVal !== undefined && officialVal !== null ? String(officialVal).trim() : "";

    el.innerText = safeApp || 'N/A';
    el.className = "font-medium transition-colors duration-200 cursor-default"; 
    el.removeAttribute("title"); 

    // If both are exact matches or both are blank, no highlight
    if (safeApp === safeOld) {
        el.classList.add("text-gray-900");
        return;
    }

    // If old was completely blank, it's a new input, highlight it heavily!
    if (safeOld === "") {
        el.classList.add("bg-orange-300", "text-orange-900", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: Blank / No Data`;
        return;
    }

    // Use similarity checker for typos vs entirely new information
    const matchType = calculateSimilarity(safeApp, safeOld);
    
    if (matchType === 'exact') {
        el.classList.add("text-gray-900");
    } 
    else if (matchType === 'partial') {
        el.classList.add("bg-orange-100", "text-yellow-800", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: ${safeOld}`; 
    } 
    else {
        el.classList.add("bg-orange-300", "text-orange-900", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: ${safeOld}`;
    }
}

// ==========================================
// FULL VIEW MODAL LOGIC
// ==========================================
window.handleView = async function(id) {
    const newData = cachedRenewals[id];
    if (!newData) return;

    document.getElementById('viewModal').classList.remove('hidden');
    const loadingBox = document.getElementById('verification-status-box');
    if (loadingBox) loadingBox.classList.remove('hidden');

    const db = firebase.firestore();
    let oldData = {};
    try {
        const userDoc = await db.collection("users").doc(newData.userId).get();
        if (userDoc.exists) oldData = userDoc.data();
    } catch (e) {
        console.error("Could not fetch user profile:", e);
    }
    
    if (loadingBox) loadingBox.classList.add('hidden');

    const setImg = (imgId, noImgId, url) => {
        const imgEl = document.getElementById(imgId);
        const txtEl = document.getElementById(noImgId);
        if (url && url.length > 5) {
            imgEl.src = url; imgEl.classList.remove('hidden'); txtEl.classList.add('hidden');
        } else {
            imgEl.classList.add('hidden'); txtEl.classList.remove('hidden');
        }
    };
    
    const fullName = `${newData.firstName || ''} ${newData.middleInitial ? newData.middleInitial + '.' : ''} ${newData.lastName || ''}`.trim();
    const oldFullName = `${oldData.firstName || ''} ${oldData.middleInitial ? oldData.middleInitial + '.' : ''} ${oldData.lastName || ''}`.trim();
    
    document.getElementById('r-name-side').textContent = fullName;
    document.getElementById('r-avatar').textContent = newData.firstName ? newData.firstName.charAt(0).toUpperCase() : "U";
    
    // Sidebar Highlighting
    applyHighlight('r-email', newData.email, oldData.email);
    let newAddress = [newData.houseNumber, newData.streetName || newData.street, newData.subdivision, newData.barangay, newData.municipality || newData.city].filter(Boolean).join(', ');
    let oldAddress = [oldData.houseNumber, oldData.streetName || oldData.street, oldData.subdivision, oldData.barangay, oldData.municipality || oldData.city].filter(Boolean).join(', ');
    applyHighlight('r-address', newAddress || newData.address, oldAddress || oldData.address);

    // Personal Information Highlighting
    applyHighlight('r-name', fullName, oldFullName);
    applyHighlight('r-email-right', newData.email, oldData.email);
    applyHighlight('r-dob', newData.dateOfBirth, oldData.dateOfBirth);
    applyHighlight('r-age', String(newData.age || ''), String(oldData.age || ''));
    applyHighlight('r-sex', newData.sex, oldData.sex);
    applyHighlight('r-birthplace', newData.placeOfBirth, oldData.placeOfBirth);
    applyHighlight('r-civil', newData.civilStatus, oldData.civilStatus);
    applyHighlight('r-ethnicity', newData.ethnicity, oldData.ethnicity);
    applyHighlight('r-religion', newData.religion, oldData.religion);

    const submitDate = newData.submittedAt ? newData.submittedAt.toDate().toLocaleDateString() : 'N/A';
    document.getElementById('r-registered').textContent = submitDate;

    // Family & Employment Highlighting
    applyHighlight('r-occupation', newData.occupation, oldData.occupation);
    applyHighlight('r-company', newData.companyAgency, oldData.companyAgency);
    applyHighlight('r-income', newData.monthlyIncome, oldData.monthlyIncome);
    applyHighlight('r-children-count', String(newData.numberOfChildren || ''), String(oldData.numberOfChildren || ''));
    
    let newKidsAges = Array.isArray(newData.childrenAges) && newData.childrenAges.length > 0 ? newData.childrenAges.join(', ') : "None";
    let oldKidsAges = Array.isArray(oldData.childrenAges) && oldData.childrenAges.length > 0 ? oldData.childrenAges.join(', ') : "None";
    applyHighlight('r-children-ages', newKidsAges, oldKidsAges);

    // Philhealth Fix: Base Member Status purely on whether an ID exists
    let newPhMember = newData.philhealthIdNumber ? "Yes" : "No";
    let oldPhMember = oldData.philhealthIdNumber ? "Yes" : "No";
    applyHighlight('r-philhealth-member', newPhMember, oldPhMember);
    applyHighlight('r-philhealth-id', newData.philhealthIdNumber, oldData.philhealthIdNumber);

    // Document Images
    setImg('r-img-id', 'r-img-id-none', newData.proofIdUrl);
    setImg('r-img-sp', 'r-img-sp-none', newData.proofSoloParentUrl);
    setImg('r-img-ph', 'r-img-ph-none', newData.philhealthIdUrl);
    
    document.getElementById('btn-approve-view').onclick = () => { closeModal(); confirmApprove(id, newData.userId); };
    document.getElementById('btn-reject-view').onclick = () => { closeModal(); openRejectModal(id, newData.userId); };
};

window.closeModal = function() { document.getElementById('viewModal').classList.add('hidden'); };

// ==========================================
// APPROVE LOGIC (Fully saves all profile data to BOTH databases)
// ==========================================
window.confirmApprove = function(subId, userId) {
    approveId = subId; approveUserId = userId;
    document.getElementById('confirm-title').innerText = "Confirm Approval";
    document.getElementById('confirm-message').innerText = "Approve renewal? This will UPDATE the user's profile and the official LGU database with the new details permanently.";
    
    const btn = document.getElementById('confirm-btn-action');
    btn.className = "px-5 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md text-sm font-bold shadow transition flex items-center";
    btn.innerHTML = '<i data-feather="check-circle" class="w-4 h-4 mr-2"></i> Yes, Approve';
    
    btn.onclick = async () => {
        btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2 inline"></i> Updating...';
        btn.disabled = true;
        feather.replace();

        try {
            const db = firebase.firestore();
            const batch = db.batch();
            const newData = cachedRenewals[approveId];

            // 1. Fetch existing user to get their official LGU record_id and fallback data
            const userDoc = await db.collection("users").doc(approveUserId).get();
            const oldData = userDoc.exists ? userDoc.data() : {};
            const officialRecordId = oldData.record_id;

            // Helper to prevent wiping data if the mobile app didn't send a specific field
            const safeVal = (newVal, existingVal, fallback = "") => {
                if (newVal !== undefined && newVal !== null && String(newVal).trim() !== "") return newVal;
                if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== "") return existingVal;
                return fallback;
            };

            const updatePayload = {
                renewal_status: "approved",
                lastRenewalDate: firebase.firestore.FieldValue.serverTimestamp(),
                
                // Personal Information
                firstName: safeVal(newData.firstName, oldData.firstName),
                lastName: safeVal(newData.lastName, oldData.lastName),
                middleInitial: safeVal(newData.middleInitial, oldData.middleInitial),
                dateOfBirth: safeVal(newData.dateOfBirth, oldData.dateOfBirth),
                age: safeVal(newData.age, oldData.age, 0),
                sex: safeVal(newData.sex, oldData.sex),
                placeOfBirth: safeVal(newData.placeOfBirth, oldData.placeOfBirth),
                religion: safeVal(newData.religion, oldData.religion),
                ethnicity: safeVal(newData.ethnicity, oldData.ethnicity),
                civilStatus: safeVal(newData.civilStatus, oldData.civilStatus),
                email: safeVal(newData.email, oldData.email),
                
                // Employment & Demographics
                occupation: safeVal(newData.occupation, oldData.occupation), 
                monthlyIncome: safeVal(newData.monthlyIncome, oldData.monthlyIncome),
                
                // FIX: Cross-map both 'company' and 'companyAgency' to handle schema mismatches
                company: safeVal(newData.companyAgency || newData.company, oldData.company || oldData.companyAgency),
                companyAgency: safeVal(newData.companyAgency || newData.company, oldData.companyAgency || oldData.company),
                
                // Address
                houseNumber: safeVal(newData.houseNumber, oldData.houseNumber), 
                streetName: safeVal(newData.streetName || newData.street, oldData.streetName || oldData.street),
                subdivision: safeVal(newData.subdivision, oldData.subdivision), 
                barangay: safeVal(newData.barangay, oldData.barangay), 
                municipality: safeVal(newData.municipality || newData.city, oldData.municipality || oldData.city),
                
                // Family
                numberOfChildren: safeVal(newData.numberOfChildren, oldData.numberOfChildren, 0), 
                childrenAges: newData.childrenAges || oldData.childrenAges || [],
                
                // Official IDs and Proofs
                philhealthIdNumber: safeVal(newData.philhealthIdNumber, oldData.philhealthIdNumber),
                hasPhilhealth: (newData.philhealthIdNumber || oldData.philhealthIdNumber) ? true : false,
                proofIdUrl: safeVal(newData.proofIdUrl, oldData.proofIdUrl),
                proofSoloParentUrl: safeVal(newData.proofSoloParentUrl, oldData.proofSoloParentUrl),
                philhealthIdUrl: safeVal(newData.philhealthIdUrl, oldData.philhealthIdUrl)
            };

            // 2. Mark Renewal as Approved
            batch.update(db.collection("renewalSubmissions").doc(approveId), { 
                status: "approved", 
                renewal_status: "approved", 
                reviewedDate: firebase.firestore.FieldValue.serverTimestamp() 
            });

            // 3. Overwrite User Profile (Mobile App Database)
            batch.update(db.collection("users").doc(approveUserId), updatePayload);

            // 4. Overwrite Official LGU Record (Admin Dashboard Database)
            if (officialRecordId) {
                let lguPayload = { ...updatePayload };
                delete lguPayload.renewal_status; // Keep LGU database clean
                lguPayload.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
                batch.update(db.collection("solo_parent_records").doc(officialRecordId), lguPayload);
            }

            await batch.commit();
            document.getElementById('confirmModal').classList.add('hidden');
            showSuccessModal("Approved & Both Profiles Updated!");
        } catch (e) {
            alert("Error: " + e.message);
            document.getElementById('confirmModal').classList.add('hidden');
            btn.disabled = false;
        }
    };
    document.getElementById('confirmModal').classList.remove('hidden');
    feather.replace();
};

// ==========================================
// REJECT LOGIC
// ==========================================
window.openRejectModal = function(subId, userId) { 
    rejectTargetId = subId; rejectTargetUserId = userId;
    document.getElementById('reject-select').value = ""; document.getElementById('reject-reason-text').value = "";
    handleRejectValidation();
    document.getElementById('rejectModal').classList.remove('hidden'); 
};
window.closeRejectModal = () => document.getElementById('rejectModal').classList.add('hidden');

window.handleRejectValidation = function() {
    const selectVal = document.getElementById('reject-select').value;
    const textVal = document.getElementById('reject-reason-text').value.trim();
    const btn = document.getElementById('btn-reject-submit');

    let isValid = false;
    if (!selectVal) isValid = false;
    else if (selectVal === "Other") { isValid = textVal.length > 0; if (!isValid) document.getElementById('reject-reason-text').placeholder = "Please explain the reason here..."; } 
    else { isValid = true; document.getElementById('reject-reason-text').placeholder = "Additional comments (Optional)..."; }

    if (isValid) { btn.disabled = false; btn.classList.remove('bg-gray-400', 'cursor-not-allowed'); btn.classList.add('bg-red-600', 'hover:bg-red-700', 'shadow'); } 
    else { btn.disabled = true; btn.classList.add('bg-gray-400', 'cursor-not-allowed'); btn.classList.remove('bg-red-600', 'hover:bg-red-700', 'shadow'); }
};

window.confirmRejectSubmission = function() {
    const selectVal = document.getElementById('reject-select').value;
    const textVal = document.getElementById('reject-reason-text').value;
    pendingRejectReason = selectVal === "Other" ? textVal : selectVal + (textVal ? `: ${textVal}` : "");

    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('confirm-title').innerText = "Confirm Rejection";
    document.getElementById('confirm-message').innerText = "Are you sure you want to reject this renewal?";
    
    const btn = document.getElementById('confirm-btn-action');
    btn.className = "px-5 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md text-sm font-bold shadow transition flex items-center";
    btn.innerHTML = '<i data-feather="x-circle" class="w-4 h-4 mr-2"></i> Yes, Reject';
    btn.onclick = executeRejection;

    document.getElementById('confirmModal').classList.remove('hidden');
    feather.replace();
};

async function executeRejection() {
    try {
        const batch = firebase.firestore().batch();
        batch.update(firebase.firestore().collection("renewalSubmissions").doc(rejectTargetId), { status: "rejected", renewal_status: "rejected", rejectionReason: pendingRejectReason, reviewedDate: firebase.firestore.FieldValue.serverTimestamp() });
        batch.update(firebase.firestore().collection("users").doc(rejectTargetUserId), { renewal_status: "rejected" });
        await batch.commit();
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Renewal Rejected.");
    } catch (e) {
        alert("Error: " + e.message);
        document.getElementById('confirmModal').classList.add('hidden');
    }
}

window.closeConfirmModal = function() {
    document.getElementById('confirmModal').classList.add('hidden');
    if (rejectTargetId && !approveId) document.getElementById('rejectModal').classList.remove('hidden');
};

// ==========================================
// NOTIFICATIONS
// ==========================================
window.showSuccessModal = function(msg) {
    document.getElementById('success-message').innerText = msg;
    document.getElementById('successModal').classList.remove('hidden');
    feather.replace(); 
};
window.closeSuccessModal = function() { location.reload(); };