// ==========================================
// 🚀 IMPORTS & CONSTANTS
// ==========================================
import { db } from "./firebase-config.js";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { DESCRIPTION_TO_CODE_MAP } from './utils.js';

// Automatically flip the map so we can look up by code (e.g., "a7" -> "Abandonment by the spouse")
const CODE_TO_DESCRIPTION_MAP = Object.entries(DESCRIPTION_TO_CODE_MAP).reduce((acc, [desc, code]) => {
    acc[code] = desc;
    return acc;
}, {});

console.log("🎯 profile.js loaded - Smart Badge & Legacy Category Cleaner Active");

// Global State Trackers
let currentProfileData = null;
let currentDocId = null;
let isOfficialRecord = false;
let linkedAuthUid = null;

// ==========================================
// 🚀 INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        alert("No profile ID found in URL.");
        window.location.href = 'members.html';
        return;
    }

    if (!db) {
        alert("Database connection failed. Please check your firebase-config.");
        return;
    }

    try {
        // 1. Search Official Database
        const lguRef = doc(db, "solo_parent_records", recordId);
        const lguSnap = await getDoc(lguRef);

        if (lguSnap.exists()) {
            currentProfileData = lguSnap.data();
            currentDocId = recordId;
            isOfficialRecord = true;
            linkedAuthUid = currentProfileData.auth_uid || null;
        } else {
            // 2. Fallback to Users Collection
            const mobileRef = doc(db, "users", recordId);
            const mobileSnap = await getDoc(mobileRef);
            
            if (mobileSnap.exists()) {
                currentProfileData = mobileSnap.data();
                currentDocId = recordId;
                isOfficialRecord = false;
                linkedAuthUid = recordId;
            } else {
                // 3. Deep Fallback Query
                const q = query(collection(db, "solo_parent_records"), where("soloParentIdNumber", "==", recordId));
                const querySnap = await getDocs(q);
                
                if (!querySnap.empty) {
                    currentProfileData = querySnap.docs[0].data();
                    currentDocId = querySnap.docs[0].id;
                    isOfficialRecord = true;
                    linkedAuthUid = currentProfileData.auth_uid || null;
                }
            }
        }

        if (currentProfileData) {
            populateUI(currentDocId, currentProfileData);
        } else {
            alert(`Error: Record [${recordId}] could not be found.`);
            window.location.href = 'members.html';
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
        alert("Failed to load profile. Please check console.");
    }
});

// ==========================================
// 🎨 UI INJECTION LOGIC
// ==========================================
function populateUI(recordId, data) {
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const avatarEl = document.getElementById('val-avatar-initial');
    if(avatarEl) avatarEl.innerText = (data.firstName || "U").charAt(0).toUpperCase();

    // 💡 SMART CATEGORY MAPPER: Handles both raw codes ("a2") and legacy strings ("a2 - Widow")
    let rawCategory = (data.category || '').trim();
    let displayCategory = 'Unspecified Category';
    
    if (rawCategory) {
        // Extract just the code (e.g., grabs 'a2' from 'a2 - Widow/widower')
        let code = rawCategory.split(/[\s-]/)[0].toLowerCase(); 
        
        if (CODE_TO_DESCRIPTION_MAP[code]) {
            displayCategory = `${code} - ${CODE_TO_DESCRIPTION_MAP[code]}`;
        } else if (CODE_TO_DESCRIPTION_MAP[rawCategory]) {
            displayCategory = `${rawCategory} - ${CODE_TO_DESCRIPTION_MAP[rawCategory]}`;
        } else {
            displayCategory = rawCategory; // Fallback for purely custom strings
        }
    }

    const sideCatEl = document.getElementById('val-side-category');
    if (sideCatEl) sideCatEl.innerText = displayCategory;

    const fieldsToMap = {
        'val-name': fullName,
        'val-side-name': fullName, 
        'val-email': data.email || 'N/A',
        'val-dob': data.dateOfBirth || 'N/A',
        'val-age': data.age || 'N/A',
        'val-sex': data.sex || 'N/A',
        'val-birthplace': data.placeOfBirth || 'N/A',
        'val-civil': data.civilStatus || 'N/A',
        'val-ethnicity': data.ethnicity || 'N/A',
        'val-religion': data.religion || 'N/A',
        'val-registered': data.registrationDate && data.registrationDate.toDate ? data.registrationDate.toDate().toLocaleDateString() : (data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A'),
        
        'val-side-email': data.email || 'N/A',
        'val-side-contact': data.contact || 'N/A',
        'val-side-address': `${data.barangay || ''}, ${data.municipality || ''}`.trim().replace(/^, | ,$/g, '') || 'N/A',
        'val-side-id': data.soloParentIdNumber || recordId,

        'val-occupation': data.occupation || 'N/A',
        'val-company': data.company || 'N/A',
        'val-income': data.monthlyIncome || 'N/A',
        'val-children-count': Array.isArray(data.childrenAges) ? data.childrenAges.length : '0',
        'val-children-ages': Array.isArray(data.childrenAges) ? data.childrenAges.join(', ') : 'N/A',
        
        'val-philhealth-member': data.philhealthIdNumber ? 'Yes' : 'No',
        'val-philhealth-id': data.philhealthIdNumber || 'N/A'
    };

    for (const [htmlId, dbValue] of Object.entries(fieldsToMap)) {
        const element = document.getElementById(htmlId);
        if (element) { element.innerText = dbValue; }
    }

    // 💡 FIXED STATUS BADGE: Strictly checks if they are online in the app
    const badge = document.getElementById('val-status-badge');
    if (badge) {
        if (data.is_online === true) {
            badge.innerHTML = `<i data-feather="check-circle" class="w-3 h-3 inline mr-1"></i> App Registered`;
            badge.className = "inline-block bg-blue-100 text-blue-800 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm";
        } else {
            badge.innerHTML = `<i data-feather="x-circle" class="w-3 h-3 inline mr-1"></i> App Unregistered`;
            badge.className = "inline-block bg-gray-100 text-gray-600 border border-gray-200 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm";
        }
    }
    
    if (typeof feather !== 'undefined') feather.replace();

    const imgId = document.getElementById('val-img-id');
    const imgIdNone = document.getElementById('val-img-id-none');
    if (data.proofIdUrl) { imgId.src = data.proofIdUrl; imgId.classList.remove('hidden'); imgIdNone.classList.add('hidden'); } 
    else { imgId.classList.add('hidden'); imgIdNone.classList.remove('hidden'); }

    const imgSp = document.getElementById('val-img-sp');
    const imgSpNone = document.getElementById('val-img-sp-none');
    if (data.proofSoloParentUrl) { imgSp.src = data.proofSoloParentUrl; imgSp.classList.remove('hidden'); imgSpNone.classList.add('hidden'); } 
    else { imgSp.classList.add('hidden'); imgSpNone.classList.remove('hidden'); }
}

// ==========================================
// ✏️ EDIT PROFILE LOGIC (Bound to Window)
// ==========================================
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

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
    
    if (typeof feather !== 'undefined') feather.replace();
    document.getElementById('notificationModal').classList.remove('hidden');
};

window.openEditModal = function() {
    if (!currentProfileData) return;

    document.getElementById('edit-fname').value = currentProfileData.firstName || '';
    document.getElementById('edit-lname').value = currentProfileData.lastName || '';
    document.getElementById('edit-contact').value = currentProfileData.contact || '';
    document.getElementById('edit-email').value = currentProfileData.email || '';
    document.getElementById('edit-dob').value = currentProfileData.dateOfBirth || '';
    document.getElementById('edit-age').value = currentProfileData.age || '';
    document.getElementById('edit-sex').value = currentProfileData.sex || 'Female';
    document.getElementById('edit-civil').value = currentProfileData.civilStatus || '';
    document.getElementById('edit-ethnicity').value = currentProfileData.ethnicity || '';
    document.getElementById('edit-religion').value = currentProfileData.religion || '';
    document.getElementById('edit-municipality').value = currentProfileData.municipality || '';
    document.getElementById('edit-barangay').value = currentProfileData.barangay || '';
    document.getElementById('edit-occupation').value = currentProfileData.occupation || '';
    document.getElementById('edit-company').value = currentProfileData.company || '';
    document.getElementById('edit-income').value = currentProfileData.monthlyIncome || '';
    document.getElementById('edit-philhealth').value = currentProfileData.philhealthIdNumber || '';

    const catSelect = document.getElementById('edit-category');
    
    // Smartly grab the code for the edit dropdown even if it's a legacy string
    let rawCat = (currentProfileData.category || "").toLowerCase();
    let code = rawCat.split(/[\s-]/)[0]; 
    
    if (CODE_TO_DESCRIPTION_MAP[code]) {
        catSelect.value = code;
    } else if (CODE_TO_DESCRIPTION_MAP[rawCat]) {
        catSelect.value = rawCat;
    } else {
        catSelect.selectedIndex = 0; 
    }

    document.getElementById('editProfileModal').classList.remove('hidden');
};

window.saveProfileEdits = async function() {
    const btn = document.getElementById('btn-save-edits');
    btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2"></i> Saving...';
    btn.disabled = true;
    if (typeof feather !== 'undefined') feather.replace();

    const updates = {
        firstName: document.getElementById('edit-fname').value.trim(),
        lastName: document.getElementById('edit-lname').value.trim(),
        contact: document.getElementById('edit-contact').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        dateOfBirth: document.getElementById('edit-dob').value.trim(),
        age: document.getElementById('edit-age').value.trim(),
        sex: document.getElementById('edit-sex').value,
        civilStatus: document.getElementById('edit-civil').value.trim(),
        ethnicity: document.getElementById('edit-ethnicity').value.trim(),
        religion: document.getElementById('edit-religion').value.trim(),
        municipality: document.getElementById('edit-municipality').value.trim(),
        barangay: document.getElementById('edit-barangay').value.trim(),
        occupation: document.getElementById('edit-occupation').value.trim(),
        company: document.getElementById('edit-company').value.trim(),
        monthlyIncome: document.getElementById('edit-income').value.trim(),
        philhealthIdNumber: document.getElementById('edit-philhealth').value.trim(),
        category: document.getElementById('edit-category').value, 
        lastUpdated: serverTimestamp()
    };

    try {
        const batch = writeBatch(db);

        if (isOfficialRecord) {
            const officialRef = doc(db, "solo_parent_records", currentDocId);
            batch.update(officialRef, updates);

            if (linkedAuthUid) {
                const userRef = doc(db, "users", linkedAuthUid);
                batch.update(userRef, updates);
            }
        } else {
            const userRef = doc(db, "users", currentDocId);
            batch.update(userRef, updates);
        }

        await batch.commit();

        currentProfileData = { ...currentProfileData, ...updates }; 
        populateUI(currentDocId, currentProfileData);

        closeModal('editProfileModal');
        showNotification("Update Successful", "The applicant's information has been successfully corrected.", "success");

    } catch (error) {
        console.error("Error updating profile:", error);
        showNotification("Save Failed", "Could not update the database. Please check console.", "error");
    } finally {
        btn.innerHTML = '<i data-feather="save" class="w-4 h-4 mr-2"></i> Save Changes';
        btn.disabled = false;
        if (typeof feather !== 'undefined') feather.replace();
    }
};