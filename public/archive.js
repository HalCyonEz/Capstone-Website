console.log("🎯 archive.js loaded - Soft Delete / Restoration Active");
feather.replace();

let archivedMembersCache = []; 
let filteredArchives = []; 
let searchTimeout = null;

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

    fetchArchivedMembers();
});

// =============================================
// 1. DATA FETCHING (Only Archived)
// =============================================
function fetchArchivedMembers() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<div class="col-span-2 text-center py-10 text-red-500"><i data-feather="loader" class="animate-spin inline w-5 h-5 mr-2"></i> Syncing Archived Records...</div>';
    feather.replace();
    
    // We explicitly query ONLY documents flagged as archived
    window.db.collection("solo_parent_records")
        .where("isArchived", "==", true)
        .onSnapshot((snapshot) => {
            archivedMembersCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            console.log("📡 Archive database update. Total records:", archivedMembersCache.length);
            applyArchiveSearch(); 
        }, (error) => {
            console.error("Firebase Sync Error:", error);
            grid.innerHTML = `<div class="col-span-2 text-center py-10 text-red-500">Sync interrupted: ${error.message}</div>`;
        });
}

// =============================================
// 2. SEARCH & RENDER LOGIC
// =============================================
window.applyArchiveSearch = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchTerm = document.getElementById('f-search').value.trim().toLowerCase();
        
        filteredArchives = archivedMembersCache.filter(user => {
            if (!searchTerm) return true;
            const fName = (user.firstName || "").toLowerCase();
            const lName = (user.lastName || "").toLowerCase();
            const idNum = (user.soloParentIdNumber || user.id || "").toLowerCase();
            return fName.includes(searchTerm) || lName.includes(searchTerm) || idNum.includes(searchTerm);
        });

        filteredArchives.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
        renderArchives();
    }, 300);
};

function renderArchives() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = "";

    if (filteredArchives.length === 0) {
        grid.innerHTML = '<div class="col-span-2 text-center py-10 text-gray-500">No archived members found.</div>';
        return;
    }

    filteredArchives.forEach(user => { 
        grid.appendChild(createArchiveCard(user.id, user)); 
    });
}

// =============================================
// 3. CARD CREATION & RESTORE FUNCTIONALITY
// =============================================
function createArchiveCard(id, data) {
    const div = document.createElement('div');
    // Changed to flex-col to stack the profile info on top of the reason box
    div.className = "bg-white p-4 rounded-lg shadow-sm border border-red-100 flex flex-col gap-3 opacity-90 hover:opacity-100 transition";
    
    const name = `${data.firstName || ''} ${data.lastName || ''}`;
    const initial = (data.firstName || "U").charAt(0).toUpperCase();
    const archiveBadge = `<span class="bg-red-50 text-red-700 border border-red-200 text-[10px] px-2 py-0.5 rounded-full ml-2 whitespace-nowrap shadow-sm font-semibold">Archived</span>`;
    
    // Safely pull the reason, or show a fallback if an old record doesn't have one
    const reason = data.archiveReason || "No specific reason provided.";

    div.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
                <span class="text-lg font-bold text-red-500">${initial}</span>
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-gray-900 truncate flex items-center">${name} ${archiveBadge}</h3>
                <p class="text-xs text-gray-500 truncate font-mono mt-0.5">ID: ${data.soloParentIdNumber || id}</p>
            </div>
            <button onclick="restoreAccount('${id}')" class="px-3 py-1.5 bg-green-50 border border-green-600 text-green-700 rounded text-xs font-bold hover:bg-green-600 hover:text-white transition flex items-center gap-1 shadow-sm">
                <i data-feather="refresh-ccw" class="w-3 h-3"></i> Restore
            </button>
        </div>
        
        <div class="bg-red-50 rounded p-3 border border-red-100 mt-1">
            <span class="font-bold uppercase tracking-wide text-[10px] text-red-500 block mb-0.5">Reason for Deactivation</span>
            <p class="text-xs text-red-800 font-medium italic">"${reason}"</p>
        </div>
    `;
    return div;
}

window.restoreAccount = async function(id) {
    if(confirm("Are you sure you want to restore this account? They will regain mobile app access immediately.")) {
        try {
            // Setup a batch write (using Firebase v8 Compat syntax for archive.js)
            const batch = window.db.batch();
            
            // The data we are reverting to normal
            const restoreData = {
                isArchived: false,
                status: 'approved', // 🔴 Overwrites the 'Archived' status
                archiveReason: firebase.firestore.FieldValue.delete(), // Completely removes the reason field
                archivedAt: firebase.firestore.FieldValue.delete()     // Completely removes the timestamp
            };

            // 1. Get the official record reference
            const officialRef = window.db.collection("solo_parent_records").doc(id);
            
            // We need to fetch the document first to see if they have a linked mobile app account
            const docSnap = await officialRef.get();
            
            if (docSnap.exists) {
                // Update the main LGU record
                batch.update(officialRef, restoreData);
                
                // 2. If they have a linked mobile app account, update that too!
                const data = docSnap.data();
                if (data.auth_uid) {
                    const userRef = window.db.collection("users").doc(data.auth_uid);
                    batch.update(userRef, restoreData);
                } else if (!data.isOfficialRecord && !data.soloParentIdNumber) {
                     // Fallback just in case this ID *is* the mobile app ID
                     const userRef = window.db.collection("users").doc(id);
                     batch.update(userRef, restoreData);
                }
                
                // 3. Commit both updates at the exact same time
                await batch.commit();
                console.log(`✅ Account ${id} successfully restored across all databases.`);
            }

        } catch (error) {
            console.error("Error restoring account:", error);
            alert("Failed to restore the account. Please check your connection.");
        }
    }
};