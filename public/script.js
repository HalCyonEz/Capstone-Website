// ES Module imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Your Firebase config
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

// Firebase init with error handling
let app, analytics, db;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  db = getFirestore(app);
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
  alert("Failed to connect to database. Please refresh the page.");
}

document.addEventListener('DOMContentLoaded', function() {

  // --- SIDEBAR AUTO-HIGHLIGHT ---
  const sidebarLinks = document.querySelectorAll('nav a');
  sidebarLinks.forEach(link => {
    link.classList.remove('bg-blue-50', 'text-blue-700');
    link.classList.add('text-gray-600');
    const href = link.getAttribute('href');
    if (
      window.location.pathname.endsWith(href) ||
      (href === "dashboard.html" && (window.location.pathname === "/" || window.location.pathname.endsWith("index.html")))
    ) {
      link.classList.add('bg-blue-50', 'text-blue-700');
      link.classList.remove('text-gray-600');
    }
  });

  // Toggle password visibility
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) {
    const passwordInput = document.getElementById('password');
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const icon = this.querySelector('i');
      icon.setAttribute('data-feather', type === 'password' ? 'eye' : 'eye-off');
      feather.replace();
    });
  }

  // Logout functionality
  const logoutButtons = Array.from(document.querySelectorAll('button')).filter(button =>
    button.querySelector('svg.feather-log-out')
  );
  logoutButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const confirmLogout = confirm('Are you sure you want to log out?');
      if (confirmLogout) window.location.href = 'index.html';
    });
  });

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const mobileSidebar = document.getElementById('mobile-sidebar');
  if (sidebarToggle && mobileSidebar) {
    sidebarToggle.addEventListener('click', function() {
      mobileSidebar.style.display = mobileSidebar.style.display === 'none' ? 'flex' : 'none';
      feather.replace();
    });
    mobileSidebar.addEventListener('click', function(e) {
      if (e.target === mobileSidebar) {
        mobileSidebar.style.display = 'none';
      }
    });
  }

  // ------- FIRESTORE: Display Pending Applications -------
  if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('applications.html')) {
    const tbody = document.querySelector('tbody');
    
    async function loadPendingApplications() {
      if (!tbody) {
        console.error('❌ tbody not found');
        return;
      }

      if (!db) {
        console.error('❌ Firebase not initialized');
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="px-6 py-8 text-center text-red-500">
              Database connection error. Please refresh the page.
            </td>
          </tr>
        `;
        return;
      }
      
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading applications...</td></tr>';
      
      try {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        
        if (querySnapshot.size === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                No pending applications found.
              </td>
            </tr>
          `;
          return;
        }
        
        querySnapshot.forEach(docSnapshot => {
          const data = docSnapshot.data();
          
          const row = document.createElement('tr');
          row.className = 'hover:bg-gray-50';
          row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
              <input type="checkbox" class="rounded text-blue-600 focus:ring-blue-500">
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="flex-shrink-0 h-10 w-10">
                  <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span class="text-sm font-medium text-blue-600">${(data.firstName || data.name || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">${data.firstName || data.name || 'Unknown'} ${data.lastName || ''}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">${data.email || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">${data.createdAt ? new Date(data.createdAt.seconds*1000).toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', year: 'numeric'}) : 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">pending</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div class="flex justify-end items-center space-x-3">
                <button data-action="approve" data-id="${docSnapshot.id}" class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                  Approve
                </button>
                <button data-action="reject" data-id="${docSnapshot.id}" class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                  Reject
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
        
        // Add event listeners to dynamically created buttons
        const approveButtons = tbody.querySelectorAll('[data-action="approve"]');
        const rejectButtons = tbody.querySelectorAll('[data-action="reject"]');
        
        approveButtons.forEach(btn => {
          btn.addEventListener('click', () => approve(btn.dataset.id));
        });
        
        rejectButtons.forEach(btn => {
          btn.addEventListener('click', () => reject(btn.dataset.id));
        });
        
        // Replace feather icons if any were added
        feather.replace();
        
      } catch (error) {
        console.error('❌ Error loading applications:', error);
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="px-6 py-8 text-center text-red-500">
              Error loading applications: ${error.message}
            </td>
          </tr>
        `;
      }
    }
    
    async function approve(docId) {
      if (!confirm('Are you sure you want to approve this application?')) return;
      try {
        await updateDoc(doc(db, "users", docId), { status: "approved" });
        alert('✅ Application approved successfully!');
        loadPendingApplications();
      } catch (error) {
        console.error('❌ Error approving:', error);
        alert('Error approving application: ' + error.message);
      }
    }
    
    async function reject(docId) {
      if (!confirm('Are you sure you want to reject this application?')) return;
      try {
        await updateDoc(doc(db, "users", docId), { status: "rejected" });
        alert('✅ Application rejected.');
        loadPendingApplications();
      } catch (error) {
        console.error('❌ Error rejecting:', error);
        alert('Error rejecting application: ' + error.message);
      }
    }
    
    // Initial load
    loadPendingApplications();
  }
});