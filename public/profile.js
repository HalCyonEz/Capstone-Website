import { db } from "./firebase-config.js";
import { initSidebar, initLogout, CODE_TO_DESCRIPTION_MAP, approveUser, rejectUser } from "./utils.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

async function initProfilePage() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id');
    if (!userId) return;
    
    const printBtn = document.getElementById('print-profile-btn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (!docSnap.exists()) return;
        const user = docSnap.data();
        
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || 'N/A'; };
        const setDoc = (id, url) => { const link = document.getElementById(`doc-link-${id}`); const img = document.getElementById(`doc-img-${id}`); const error = document.getElementById(`doc-error-${id}`); if (url) { if (link) link.href = url; if (img) img.src = url; } else { if (link) link.style.display = 'none'; if (error) error.classList.remove('hidden'); } };
        
        document.getElementById('profile-avatar').src = user.profileImageUrl || `https://placehold.co/128x128/EBF4FF/7F9CF5?text=${user.firstName?.charAt(0) || 'A'}&font=inter`;
        setText('profile-name', `${user.firstName} ${user.lastName}`);
        setText('profile-category', CODE_TO_DESCRIPTION_MAP[user.category] || user.category);
        setText('profile-email', user.email);
        setText('profile-contact', user.contact);
        // --- FIX: Combine Address Fields ---
        const addressParts = [
            user.houseNumber,
            user.street,
            user.barangay,
            user.municipality // (Optional) Include this if you have it in DB
        ].filter(part => part && part.trim() !== ""); // Remove empty values

        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';

        setText('profile-address', fullAddress);
        // -----------------------------------
        setText('profile-sp-id', user.soloParentIdNumber);
        
        const statusBadge = document.getElementById('profile-status-badge');
        const approveBtn = document.getElementById('profile-approve-btn');
        const rejectBtn = document.getElementById('profile-reject-btn');
        
        if (user.status === 'approved') { statusBadge.textContent = 'Approved'; statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800'; approveBtn.style.display = 'none'; rejectBtn.style.display = 'none'; }
        else if (user.status === 'pending') { statusBadge.textContent = 'Pending'; statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800'; approveBtn.style.display = 'flex'; rejectBtn.style.display = 'flex'; }
        else { statusBadge.textContent = 'Rejected'; statusBadge.className = 'px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800'; approveBtn.style.display = 'flex'; rejectBtn.style.display = 'none'; }
        
        setText('detail-full-name', `${user.firstName} ${user.lastName}`);
        setText('detail-email', user.email);
        setText('detail-dob', user.dateOfBirth);
        setText('detail-age', user.age);
        setText('detail-sex', user.sex);
        setText('detail-pob', user.placeOfBirth);
        setText('detail-civil-status', user.civilStatus);
        setText('detail-ethnicity', user.ethnicity);
        setText('detail-religion', user.religion);
        setText('detail-created-at', user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A');
        setText('detail-occupation', user.occupation);
        setText('detail-company', user.companyAgency);
        setText('detail-income', user.monthlyIncome);
        setText('detail-num-children', user.numberOfChildren);
        setText('detail-children-ages', user.childrenAges ? user.childrenAges.join(', ') : 'N/A');
        setText('detail-has-philhealth', user.hasPhilhealth ? 'Yes' : 'No');
        setText('detail-philhealth-id', user.philhealthIdNumber);
        
        setDoc('valid-id', user.proofIdUrl);
        setDoc('proof', user.proofSoloParentUrl);
        setDoc('philhealth', user.philhealthIdUrl);
        
        approveBtn.addEventListener('click', () => approveUser(userId));
        rejectBtn.addEventListener('click', () => rejectUser(userId));
        
        feather.replace();
    } catch (error) { console.error("❌ Error fetching user profile:", error); }
}

document.addEventListener('DOMContentLoaded', initProfilePage);