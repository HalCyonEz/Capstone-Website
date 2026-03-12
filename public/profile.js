// ==========================================
// 🚀 IMPORTS & CONSTANTS
// ==========================================
import { db } from "./firebase-config.js";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { DESCRIPTION_TO_CODE_MAP } from './utils.js';
import { storage } from "./firebase-config.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

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
        // 1. First, check if the URL ID is a direct official record ID (e.g., AG1247271)
        const lguRef = doc(db, "solo_parent_records", recordId);
        const lguSnap = await getDoc(lguRef);

        if (lguSnap.exists()) {
            currentProfileData = lguSnap.data();
            currentDocId = recordId;
            isOfficialRecord = true;
            linkedAuthUid = currentProfileData.auth_uid || null;
        } else {
            // 2. MERGE CHECK: The URL ID might be an auth_uid. 
            // Let's check if an official record is LINKED to this auth_uid.
            const qLinked = query(collection(db, "solo_parent_records"), where("auth_uid", "==", recordId));
            const qLinkedSnap = await getDocs(qLinked);

            if (!qLinkedSnap.empty) {
                // Found the merged official record! Prioritize this.
                currentProfileData = qLinkedSnap.docs[0].data();
                currentDocId = qLinkedSnap.docs[0].id;
                isOfficialRecord = true;
                linkedAuthUid = recordId;
            } else {
                // 3. Fallback to the users collection (An unmerged mobile app user)
                const mobileRef = doc(db, "users", recordId);
                const mobileSnap = await getDoc(mobileRef);
                
                if (mobileSnap.exists()) {
                    currentProfileData = mobileSnap.data();
                    currentDocId = recordId;
                    isOfficialRecord = false;
                    linkedAuthUid = recordId;
                } else {
                    // 4. Deep Fallback Query for custom typed ID numbers
                    const qId = query(collection(db, "solo_parent_records"), where("soloParentIdNumber", "==", recordId));
                    const qIdSnap = await getDocs(qId);
                    
                    if (!qIdSnap.empty) {
                        currentProfileData = qIdSnap.docs[0].data();
                        currentDocId = qIdSnap.docs[0].id;
                        isOfficialRecord = true;
                        linkedAuthUid = currentProfileData.auth_uid || null;
                    }
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

    const imgPhilContainer = document.getElementById('val-img-philhealth-container');
    const imgPhil = document.getElementById('val-img-philhealth');
    const imgPhilNone = document.getElementById('val-img-philhealth-none');

    if (data.philhealthIdUrl) {
        // If the URL exists, set the source and show the image container
        imgPhil.src = data.philhealthIdUrl;
        imgPhilContainer.classList.remove('hidden');
        imgPhilContainer.classList.add('flex'); // Apply flexbox for centering
        imgPhilNone.classList.add('hidden'); // Hide the fallback text
    } else {
        // If no URL, hide the image container and show the fallback text
        imgPhilContainer.classList.add('hidden');
        imgPhilContainer.classList.remove('flex');
        imgPhilNone.classList.remove('hidden');
    }
    for (const [htmlId, dbValue] of Object.entries(fieldsToMap)) {
        const element = document.getElementById(htmlId);
        if (element) { element.innerText = dbValue; }
    }

    // 💡 FIXED STATUS BADGE: Smarter check for mobile app users
    const badge = document.getElementById('val-status-badge');
    if (badge) {
        // A user is "App Registered" if:
        // 1. They have an explicit is_online flag set to true, OR
        // 2. The record was fetched directly from the mobile "users" collection (!isOfficialRecord), OR
        // 3. The official record has a linkedAuthUid (meaning they merged an app account).
        
        if (data.is_online === true || !isOfficialRecord || linkedAuthUid) {
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
        // 1. Grab any selected files from the DOM
        const fileId = document.getElementById('edit-img-id').files[0];
        const fileSp = document.getElementById('edit-img-sp').files[0];
        const filePhil = document.getElementById('edit-img-philhealth').files[0];

        // Change button state to indicate upload time (which takes longer than a database write)
        if (fileId || fileSp || filePhil) {
            btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2"></i> Uploading Images...';
            if (typeof feather !== 'undefined') feather.replace();
        }

        // Helper function for uploading to Cloud Storage
        const uploadImage = async (file, documentType) => {
            if (!file) return null;
            // THE FIX: Pointing exactly to your unverified_uploads folder
            // Format: unverified_uploads/user_id_documentType_timestamp
            const fileRef = ref(storage, `unverified_uploads/${currentDocId}_${documentType}_${Date.now()}`);
            
            await uploadBytes(fileRef, file);
            return await getDownloadURL(fileRef);
        };

        // 2. Upload files concurrently (if they exist) and get URLs
        const [newIdUrl, newSpUrl, newPhilUrl] = await Promise.all([
            uploadImage(fileId, 'valid_id'),
            uploadImage(fileSp, 'solo_parent_proof'),
            uploadImage(filePhil, 'philhealth_id')
        ]);

        // 3. Append new URLs to the Firestore updates object if an upload occurred
        if (newIdUrl) updates.proofIdUrl = newIdUrl;
        if (newSpUrl) updates.proofSoloParentUrl = newSpUrl;
        if (newPhilUrl) updates.philhealthIdUrl = newPhilUrl;

        // 4. Proceed with the standard Firestore Batch Write
        btn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2"></i> Saving Database...';
        if (typeof feather !== 'undefined') feather.replace();
        
        const batch = writeBatch(db);

        if (isOfficialRecord) {
            const officialRef = doc(db, "solo_parent_records", currentDocId);
            batch.set(officialRef, updates, { merge: true });

            if (linkedAuthUid) {
                const userRef = doc(db, "users", linkedAuthUid);
                batch.set(userRef, updates, { merge: true });
            }
        } else {
            const userRef = doc(db, "users", currentDocId);
            batch.set(userRef, updates, { merge: true });
        }

        await batch.commit();

        currentProfileData = { ...currentProfileData, ...updates }; 
        populateUI(currentDocId, currentProfileData);

        // Reset the file inputs so they are clear for the next time the modal opens
        document.getElementById('edit-img-id').value = "";
        document.getElementById('edit-img-sp').value = "";
        document.getElementById('edit-img-philhealth').value = "";

        closeModal('editProfileModal');
        showNotification("Update Successful", "The applicant's information and documents have been updated.", "success");

    } catch (error) {
        console.error("Error updating profile:", error);
        // Tip: If it still fails, check your console. It might be a Firestore Security Rules issue!
        showNotification("Save Failed", "Could not update the database. Please check the browser console for exact details.", "error");
    } finally {
        btn.innerHTML = '<i data-feather="save" class="w-4 h-4 mr-2"></i> Save Changes';
        btn.disabled = false;
        if (typeof feather !== 'undefined') feather.replace();
    }
};