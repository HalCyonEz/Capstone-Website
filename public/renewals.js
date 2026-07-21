console.log("🎯 renewals.js loaded - Modular v9/v12 Active");

// 1. IMPORT MODULAR FIREBASE & SECURITY GUARDS
import { db } from "./firebase-config.js";
import { initSidebar, requireAuth } from "./utils.js";
import { collection, query, where, getDocs, getDoc, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let cachedRenewals = {};
let rejectTargetId = null;
let rejectTargetUserId = null;
let approveId = null;
let approveUserId = null;
let pendingRejectReason = "";
let pendingRejectRemarks = ""; 

// ==========================================
// INITIALIZATION & AUTH GUARD
// ==========================================
document.addEventListener('DOMContentLoaded', async function() {
    initSidebar();
    requireAuth(); // <-- Locks down the pending renewals instantly

    if (typeof feather !== 'undefined') feather.replace();
    const tbody = document.getElementById('renewals-table-body');
    if (!tbody) return;

    try {
        // Modular Query: Fetching pending renewals
        let submissionsQuery = query(collection(db, "renewalSubmissions"), where("renewal_status", "==", "pending"));
        let snapshot = await getDocs(submissionsQuery);
        
        // Fallback for older records
        if (snapshot.empty) {
            submissionsQuery = query(collection(db, "renewalSubmissions"), where("status", "==", "pending"));
            snapshot = await getDocs(submissionsQuery);
        }

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-yellow-500">ℹ️ No pending renewals.</td></tr>`;
            return;
        }

        await displayRenewals(snapshot, tbody);

    } catch (error) {
        console.error("❌ Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
});

// ==========================================
// TABLE DISPLAY LOGIC (WITH ISSUE DATE CALCULATION)
// ==========================================
async function displayRenewals(snapshot, tbody) {
    tbody.innerHTML = "";
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        cachedRenewals[docSnap.id] = data;
        const name = `${data.firstName || ''} ${data.middleInitial ? data.middleInitial + '.' : ''} ${data.lastName || ''}`.trim() || 'Unknown';
        const submitDate = data.submittedAt ? data.submittedAt.toDate().toLocaleDateString() : 'N/A';

        let anchorDateObj = null;
        try {
            // Modular getDoc for the user
            const userDocRef = doc(db, "users", data.userId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.lastRenewalDate) {
                    anchorDateObj = userData.lastRenewalDate.toDate();
                } else if (userData.record_id) {
                    // Modular getDoc for the official record
                    const recordDoc = await getDoc(doc(db, "solo_parent_records", userData.record_id));
                    if (recordDoc.exists() && recordDoc.data().registrationDate) {
                        anchorDateObj = recordDoc.data().registrationDate.toDate();
                    }
                }
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
            const expDate = new Date(anchorDateObj);
            expDate.setFullYear(expDate.getFullYear() + 1);
            expDate.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            statusText = anchorDateObj.toLocaleDateString();

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
                <button class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition shadow-sm" onclick="handleView('${docSnap.id}')">Review Form</button>
            </td>
        `;
        tbody.appendChild(row);
    }
    if (typeof feather !== 'undefined') feather.replace();
}

// ==========================================
// HIGHLIGHT & SIMILARITY CHECKER
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

    if (safeApp === safeOld) {
        el.classList.add("text-gray-900");
        return;
    }

    if (safeOld === "") {
        el.classList.add("bg-orange-300", "text-orange-900", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: Blank / No Data`;
        return;
    }

    const matchType = calculateSimilarity(safeApp, safeOld);
    
    if (matchType === 'exact') {
        el.classList.add("text-gray-900");
    } else if (matchType === 'partial') {
        el.classList.add("bg-orange-100", "text-yellow-800", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: ${safeOld}`; 
    } else {
        el.classList.add("bg-orange-300", "text-orange-900", "px-1.5", "py-0.5", "rounded");
        el.title = `Previous Record: ${safeOld}`;
    }
}

// ==========================================
// VIEW MODAL LOGIC
// ==========================================
window.handleView = async function(id) {
    const newData = cachedRenewals[id];
    if (!newData) return;

    document.getElementById('viewModal').classList.remove('hidden');
    const loadingBox = document.getElementById('verification-status-box');
    if (loadingBox) loadingBox.classList.remove('hidden');

    let oldData = {};
    try {
        // Modular getDoc
        const userDoc = await getDoc(doc(db, "users", newData.userId));
        if (userDoc.exists()) oldData = userDoc.data();
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
    
    applyHighlight('r-email', newData.email, oldData.email);
    let newAddress = [newData.houseNumber, newData.streetName || newData.street, newData.subdivision, newData.barangay, newData.municipality || newData.city].filter(Boolean).join(', ');
    let oldAddress = [oldData.houseNumber, oldData.streetName || oldData.street, oldData.subdivision, oldData.barangay, oldData.municipality || oldData.city].filter(Boolean).join(', ');
    applyHighlight('r-address', newAddress || newData.address, oldAddress || oldData.address);

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

    applyHighlight('r-occupation', newData.occupation, oldData.occupation);
    applyHighlight('r-company', newData.companyAgency, oldData.companyAgency);
    applyHighlight('r-income', newData.monthlyIncome, oldData.monthlyIncome);
    applyHighlight('r-children-count', String(newData.numberOfChildren || ''), String(oldData.numberOfChildren || ''));
    
    let newKidsAges = Array.isArray(newData.childrenAges) && newData.childrenAges.length > 0 ? newData.childrenAges.join(', ') : "None";
    let oldKidsAges = Array.isArray(oldData.childrenAges) && oldData.childrenAges.length > 0 ? oldData.childrenAges.join(', ') : "None";
    applyHighlight('r-children-ages', newKidsAges, oldKidsAges);

    let newPhMember = newData.philhealthIdNumber ? "Yes" : "No";
    let oldPhMember = oldData.philhealthIdNumber ? "Yes" : "No";
    applyHighlight('r-philhealth-member', newPhMember, oldPhMember);
    applyHighlight('r-philhealth-id', newData.philhealthIdNumber, oldData.philhealthIdNumber);

    setImg('r-img-id', 'r-img-id-none', newData.proofIdUrl);
    setImg('r-img-sp', 'r-img-sp-none', newData.proofSoloParentUrl);
    setImg('r-img-ph', 'r-img-ph-none', newData.philhealthIdUrl);
    
    document.getElementById('btn-approve-view').onclick = () => { closeModal(); confirmApprove(id, newData.userId); };
    document.getElementById('btn-reject-view').onclick = () => { closeModal(); openRejectModal(id, newData.userId); };
};

window.closeModal = function() { document.getElementById('viewModal').classList.add('hidden'); };

// ==========================================
// APPROVE LOGIC (MODULAR BATCH WRITES)
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
        if (typeof feather !== 'undefined') feather.replace();

        try {
            // Modular batch initialization
            const batch = writeBatch(db);
            const newData = cachedRenewals[approveId];

            const userDocRef = doc(db, "users", approveUserId);
            const userDoc = await getDoc(userDocRef);
            const oldData = userDoc.exists() ? userDoc.data() : {};
            const officialRecordId = oldData.record_id;

            const safeVal = (newVal, existingVal, fallback = "") => {
                if (newVal !== undefined && newVal !== null && String(newVal).trim() !== "") return newVal;
                if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== "") return existingVal;
                return fallback;
            };

            const updatePayload = {
                renewal_status: "approved",
                lastRenewalDate: serverTimestamp(), // Modular Timestamp
                
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
                
                occupation: safeVal(newData.occupation, oldData.occupation), 
                monthlyIncome: safeVal(newData.monthlyIncome, oldData.monthlyIncome),
                company: safeVal(newData.companyAgency || newData.company, oldData.company || oldData.companyAgency),
                companyAgency: safeVal(newData.companyAgency || newData.company, oldData.companyAgency || oldData.company),
                
                houseNumber: safeVal(newData.houseNumber, oldData.houseNumber), 
                streetName: safeVal(newData.streetName || newData.street, oldData.streetName || oldData.street),
                subdivision: safeVal(newData.subdivision, oldData.subdivision), 
                barangay: safeVal(newData.barangay, oldData.barangay), 
                municipality: safeVal(newData.municipality || newData.city, oldData.municipality || oldData.city),
                
                numberOfChildren: safeVal(newData.numberOfChildren, oldData.numberOfChildren, 0), 
                childrenAges: newData.childrenAges || oldData.childrenAges || [],
                
                philhealthIdNumber: safeVal(newData.philhealthIdNumber, oldData.philhealthIdNumber),
                hasPhilhealth: (newData.philhealthIdNumber || oldData.philhealthIdNumber) ? true : false,
                proofIdUrl: safeVal(newData.proofIdUrl, oldData.proofIdUrl),
                proofSoloParentUrl: safeVal(newData.proofSoloParentUrl, oldData.proofSoloParentUrl),
                philhealthIdUrl: safeVal(newData.philhealthIdUrl, oldData.philhealthIdUrl)
            };

            // 1. Update the submission record
            batch.update(doc(db, "renewalSubmissions", approveId), { 
                status: "approved", 
                renewal_status: "approved", 
                reviewedDate: serverTimestamp() 
            });

            // 2. Update the Mobile App user account
            batch.update(userDocRef, updatePayload);

            // 3. Update the Official LGU master record
            if (officialRecordId) {
                let lguPayload = { ...updatePayload };
                delete lguPayload.renewal_status; 
                lguPayload.lastUpdated = serverTimestamp();
                batch.update(doc(db, "solo_parent_records", officialRecordId), lguPayload);
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
    if (typeof feather !== 'undefined') feather.replace();
};

// ==========================================
// REJECT LOGIC (MODULAR BATCH WRITES)
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
    const textVal = document.getElementById('reject-reason-text').value.trim();
    
    pendingRejectReason = selectVal;
    pendingRejectRemarks = textVal;

    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('confirm-title').innerText = "Confirm Rejection";
    document.getElementById('confirm-message').innerText = "Are you sure you want to reject this renewal?";
    
    const btn = document.getElementById('confirm-btn-action');
    btn.className = "px-5 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md text-sm font-bold shadow transition flex items-center";
    btn.innerHTML = '<i data-feather="x-circle" class="w-4 h-4 mr-2"></i> Yes, Reject';
    btn.onclick = executeRejection;

    document.getElementById('confirmModal').classList.remove('hidden');
    if (typeof feather !== 'undefined') feather.replace();
};

async function executeRejection() {
    const btn = document.getElementById('confirm-btn-action');
    btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2 inline"></i> Rejecting...';
    btn.disabled = true;
    if (typeof feather !== 'undefined') feather.replace();

    try {
        const batch = writeBatch(db);
        
        const safeReason = pendingRejectReason || "No reason provided";
        const safeRemarks = pendingRejectRemarks || "";

        batch.update(doc(db, "renewalSubmissions", rejectTargetId), { 
            status: "rejected", 
            renewal_status: "rejected", 
            rejectionReason: safeReason,
            rejectionRemarks: safeRemarks, 
            reviewedDate: serverTimestamp() 
        });
        
        batch.update(doc(db, "users", rejectTargetUserId), { 
            renewal_status: "rejected",
            renewalRejectReason: safeReason,
            renewalRejectRemarks: safeRemarks 
        });
        
        await batch.commit();
        
        document.getElementById('confirmModal').classList.add('hidden');
        showSuccessModal("Renewal Rejected.");
    } catch (e) {
        console.error("Rejection Error: ", e);
        alert("Error: " + e.message);
        document.getElementById('confirmModal').classList.add('hidden');
        btn.disabled = false; 
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
    if (typeof feather !== 'undefined') feather.replace(); 
};
window.closeSuccessModal = function() { location.reload(); };