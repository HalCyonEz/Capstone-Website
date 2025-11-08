// ES Module imports from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { 
    getFirestore, collection, getDocs, query, 
    where, doc, updateDoc, Timestamp, orderBy, limit,
    addDoc, deleteDoc // ✅ ADDED addDoc and deleteDoc for events
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Your Firebase config (this was correct)
const firebaseConfig = {
  apiKey: "AIzaSyBjO4P1-Ir_iJSkLScTiyshEd28GdskN24",
  authDomain: "solo-parent-app.firebaseapp.com",
  databaseURL: "https://solo-parent-app-default-rtdb.asia-southeast1.firebasedabase.app",
  projectId: "solo-parent-app",
  storageBucket: "solo-parent-app.firebasestorage.app",
  messagingSenderId: "292578110807",
  appId: "1:292578110807:web:9f5e5c0dcd73c9975e6212",
  measurementId: "G-QZ9EYD02ZV"
};

// Firebase init
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

// --------------------------------------------------------------------------
// UTILITY FUNCTIONS (Run on all pages)
// --------------------------------------------------------------------------

function isPage(pageName) {
  return window.location.pathname.endsWith(pageName);
}

function handleSidebarHighlight() {
  const sidebarLinks = document.querySelectorAll('nav a');
  const currentPath = window.location.pathname;

  sidebarLinks.forEach(link => {
    link.classList.remove('bg-blue-50', 'text-blue-700');
    link.classList.add('text-gray-600');
    const href = link.getAttribute('href');

    if (currentPath.endsWith(href)) {
      link.classList.add('bg-blue-50', 'text-blue-700');
      link.classList.remove('text-gray-600');
    }
  });
}

function handleMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    
    if (sidebarToggle && mobileSidebar) {
        sidebarToggle.addEventListener('click', function() {
            mobileSidebar.style.display = mobileSidebar.style.display === 'none' ? 'flex' : 'none';
        });
        mobileSidebar.addEventListener('click', function(e) {
            if (e.target === mobileSidebar) {
                mobileSidebar.style.display = 'none';
            }
        });
    }
}

function handleLogout() {
  const logoutButtons = Array.from(document.querySelectorAll('button')).filter(button =>
    button.textContent.includes('Log Out') || button.querySelector('i[data-feather="log-out"]')
  );
  
  logoutButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        window.location.href = 'index.html'; 
      }
    });
  });
}

function handlePasswordToggle() {
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
}

// --------------------------------------------------------------------------
// DASHBOARD PAGE LOGIC (`dashboard.html`)
// --------------------------------------------------------------------------
async function initDashboardPage() {
    console.log("🚀 Initializing Dashboard...");
    
    async function fetchStatCards() {
        try {
            const usersCollection = collection(db, "users");
            
            // Query 1: Total Registered
            const registeredSnapshot = await getDocs(usersCollection);
            document.getElementById('registered-count').textContent = registeredSnapshot.size;

            // Query 2: Pending
            const pendingQuery = query(usersCollection, where("status", "==", "pending"));
            const pendingSnapshot = await getDocs(pendingQuery);
            document.getElementById('pending-count').textContent = pendingSnapshot.size;

            // Query 3: Approved This Month
            const now = new Date();
            const startOfMonth = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
            
            const approvedQuery = query(usersCollection, 
                where("status", "==", "approved"),
                where("approvedAt", ">=", startOfMonth) 
            );
            const approvedSnapshot = await getDocs(approvedQuery);
            document.getElementById('approved-count').textContent = approvedSnapshot.size;

            // Query 4: Upcoming Events
            // ✅ This query is now supported by the events page form
            const eventsQuery = query(collection(db, "events"), 
                where("eventDate", ">=", Timestamp.now()), 
                orderBy("eventDate", "asc"),
                limit(1)
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            document.getElementById('events-count').textContent = eventsSnapshot.size;

            if (!eventsSnapshot.empty) {
                const nextEvent = eventsSnapshot.docs[0].data();
                document.getElementById('next-event-text').textContent = `Next: ${nextEvent.eventName}`;
            } else {
                document.getElementById('next-event-text').textContent = "No upcoming events";
            }

        } catch (error) {
            console.error("❌ Error fetching stat cards:", error);
            if (error.code === 'failed-precondition') {
                console.warn("Firestore index missing. Check console (F12) for a link to create it.");
            }
        }
    }

    async function loadRecentActivity() {
        const tableBody = document.getElementById('recent-activity-table');
        if (!tableBody) return;

        try {
            const activityQuery = query(collection(db, "users"),
                where("status", "==", "pending"),
                orderBy("createdAt", "desc"), // Your `createdAt` field
                limit(5)
            );
            const snapshot = await getDocs(activityQuery);

            if (snapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No new pending applications.</td></tr>`;
                return;
            }

            tableBody.innerHTML = ""; // Clear "Loading..."
            snapshot.forEach(doc => {
                const user = doc.data();
                const name = `${user.firstName} ${user.lastName}`;
                const date = user.createdAt.toDate().toLocaleDateString();
                
                const row = `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <div class="ml-4">
                                    <div class="text-sm font-medium text-gray-900">${name}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">New Application</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });

        } catch (error) {
            console.error("❌ Error loading recent activity:", error);
            tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Error loading activity.</td></tr>`;
        }
    }

    async function initApplicationChart() {
        try {
            const approvedQuery = query(collection(db, "users"), where("status", "==", "approved"));
            const pendingQuery = query(collection(db, "users"), where("status", "==", "pending"));
            const rejectedQuery = query(collection(db, "users"), where("status", "==", "rejected"));

            const [approvedSnap, pendingSnap, rejectedSnap] = await Promise.all([
                getDocs(approvedQuery),
                getDocs(pendingQuery),
                getDocs(rejectedQuery)
            ]);

            const approvedCount = approvedSnap.size;
            const pendingCount = pendingSnap.size;
            const rejectedCount = rejectedSnap.size;
            const total = approvedCount + pendingCount + rejectedCount;

            const approvedPercent = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
            const pendingPercent = total === 0 ? 0 : Math.round((pendingCount / total) * 100);
            const rejectedPercent = total === 0 ? 0 : (100 - approvedPercent - pendingPercent);

            document.getElementById('chart-label-approved').textContent = `Approved ${approvedPercent}%`;
            document.getElementById('chart-label-pending').textContent = `Pending ${pendingPercent}%`;
            document.getElementById('chart-label-rejected').textContent = `Rejected ${rejectedPercent}%`;

            const ctx = document.getElementById('donutChart').getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Approved', 'Pending', 'Rejected'],
                    datasets: [{
                        data: [approvedCount, pendingCount, rejectedCount],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '70%',
                    plugins: { legend: { display: false } },
                    responsive: true,
                    maintainAspectRatio: false
                }
            });

        } catch (error) {
            console.error("❌ Error initializing donut chart:", error);
        }
    }

    async function loadUpcomingEvents() {
        const eventsList = document.getElementById('upcoming-events-list');
        if (!eventsList) return;

        try {
            // ✅ This query is now supported by the events page form
            const eventsQuery = query(collection(db, "events"), 
                where("eventDate", ">=", Timestamp.now()),
                orderBy("eventDate", "asc"),
                limit(2)
            );
            const snapshot = await getDocs(eventsQuery);

            if (snapshot.empty) {
                eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
                return;
            }

            eventsList.innerHTML = "";
            const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

            snapshot.forEach(doc => {
                const event = doc.data();
                const eventDate = event.eventDate.toDate(); 
                const day = eventDate.getDate();
                const month = monthNames[eventDate.getMonth()];
                
                const eventHtml = `
                    <div class="flex items-start">
                        <div class="bg-blue-100 text-blue-800 p-2 rounded-lg mr-4">
                            <div class="text-center">
                                <div class="font-bold">${day}</div>
                                <div class="text-xs">${month}</div>
                            </div>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">${event.eventName}</h3>
                            <p class="text-sm text-gray-500">${event.eventTime || ''} • ${event.eventLocation || ''}</p>
                        </div>
                    </div>
                `;
                eventsList.innerHTML += eventHtml;
            });

        } catch (error) {
            console.error("❌ Error loading upcoming events:", error);
            eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
        }
    }

    // Call all dashboard functions
    fetchStatCards();
    loadRecentActivity();
    initApplicationChart();
    loadUpcomingEvents();
}


// --------------------------------------------------------------------------
// APPLICATIONS PAGE LOGIC (`applications.html`)
// --------------------------------------------------------------------------
function initApplicationsPage() {
    console.log("🚀 Initializing Applications Page...");
    
    const tbody = document.getElementById('applications-table-body');
    
    if (!tbody) {
        console.error('❌ Table body "#applications-table-body" not found.');
        return;
    }

    async function loadPendingApplications() {
      if (!db) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Database connection error.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading applications...</td></tr>';
      
      try {
        const q = query(collection(db, "users"), where("status", "==", "pending"));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        
        if (querySnapshot.size === 0) {
          tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No pending applications found.</td></tr>`;
          return;
        }
        
        querySnapshot.forEach(docSnapshot => {
          const data = docSnapshot.data();
          const name = `${data.firstName} ${data.lastName}`;
          
          const row = document.createElement('tr');
          row.className = 'hover:bg-gray-50';
          row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
              <input type="checkbox" class="rounded text-blue-600 focus:ring-blue-500">
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900">${name}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">${data.email || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div class="flex justify-end items-center space-x-3">
                <button data-action="approve" data-id="${docSnapshot.id}" class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">
                  Approve
                </button>
                <button data-action="reject" data-id="${docSnapshot.id}" class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">
                  Reject
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
        
        tbody.querySelectorAll('[data-action="approve"]').forEach(btn => {
          btn.addEventListener('click', () => approve(btn.dataset.id));
        });
        
        tbody.querySelectorAll('[data-action="reject"]').forEach(btn => {
          btn.addEventListener('click', () => reject(btn.dataset.id));
        });
        
      } catch (error) {
        console.error('❌ Error loading applications:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
      }
    }
    
    async function approve(docId) {
      if (!confirm('Are you sure you want to approve this application?')) return;
      try {
        await updateDoc(doc(db, "users", docId), { 
            status: "approved",
            approvedAt: Timestamp.now() // Adds the required timestamp!
        });
        alert('✅ Application approved successfully!');
        loadPendingApplications(); // Refresh the list
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
        loadPendingApplications(); // Refresh the list
      } catch (error) {
        console.error('❌ Error rejecting:', error);
        alert('Error rejecting application: ' + error.message);
      }
    }
    
    // Initial load
    loadPendingApplications();
}

// --------------------------------------------------------------------------
// MEMBERS PAGE LOGIC (`members.html`)
// --------------------------------------------------------------------------
function initMembersPage() {
    console.log("🚀 Initializing Members Page...");

    const tableBody = document.getElementById('members-table-body');
    if (!tableBody) {
        console.error('❌ Table body "#members-table-body" not found.');
        return;
    }

    async function loadVerifiedMembers() {
        if (!db) {
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Database connection error.</td></tr>`;
            return;
        }

        tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Loading members...</td></tr>';

        try {
            // Query for all "approved" members
            const q = query(collection(db, "users"), where("status", "==", "approved"));
            const querySnapshot = await getDocs(q);

            // Update the count card
            document.getElementById('total-verified-members').textContent = querySnapshot.size;
            document.getElementById('pagination-total').textContent = querySnapshot.size;
            document.getElementById('total-verified-percent').textContent = "Total"; // Placeholder

            tableBody.innerHTML = ""; // Clear loading row

            if (querySnapshot.size === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No verified members found.</td></tr>`;
                return;
            }

            querySnapshot.forEach(docSnapshot => {
                const data = docSnapshot.data();
                const name = `${data.firstName || ''} ${data.lastName || ''}`;
                const category = data.category || 'N/A';
                const address = data.address || 'N/A';
                const soloParentId = data.soloParentIdNumber || 'N/A';
                const project = data.projectReceived || 'N/A'; // For later

                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">${name}</div>
                                <div class="text-sm text-gray-500">${category}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${address}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${soloParentId}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${project}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Verified</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex justify-end space-x-2">
                            <a href="#" class="text-blue-600 hover:text-blue-900" title="View Details">
                                <i data-feather="eye" class="w-4 h-4"></i>
                            </a>
                            <a href="#" class="text-blue-600 hover:text-blue-900" title="Edit Member">
                                <i data-feather="edit" class="w-4 h-4"></i>
                            </a>
                        </div>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            feather.replace();

        } catch (error) {
            console.error('❌ Error loading members:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
        }
    }
    
    loadVerifiedMembers();
}


// --------------------------------------------------------------------------
// CATEGORIES PAGE LOGIC (`categories.html`)
// --------------------------------------------------------------------------
function initCategoriesPage() {
    console.log("🚀 Initializing Categories Page...");

    // --- Define your static lists ---
    const CATEGORY_LIST = [
        "Annulment", "Widow / Widower", "Child is Adopted",
        "Unmarried", "PWD", "OFW", "Other Cases"
    ];
    const MUNICIPALITY_LIST = [
        "Atok", "Bakun", "Bokod", "Buguias", "Itogon", "Kabayan",
        "Kapangan", "Kibungan", "La Trinidad", "Mankayan",
        "Sablan", "Tuba", "Tublay"
    ];

    // --- Get DOM elements ---
    const categoryListEl = document.getElementById('category-filter-list');
    const municipalitySelectEl = document.getElementById('municipality-filter-select');
    const memberGridEl = document.getElementById('member-profile-grid');
    const searchBoxEl = document.getElementById('search-box');
    const filterTagsEl = document.getElementById('filter-tags-container');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // --- State variables ---
    let allApprovedMembers = []; 
    let currentCategory = "All";
    let currentMunicipality = "All";
    let currentSearch = "";

    // --- Main function to fetch and process data ---
    async function loadAllData() {
        if (!db) {
            memberGridEl.innerHTML = `<p class="text-sm text-red-500">Database connection error.</p>`;
            return;
        }

        try {
            // 1. Fetch all approved members ONCE
            const q = query(collection(db, "users"), where("status", "==", "approved"));
            const snapshot = await getDocs(q);
            allApprovedMembers = snapshot.docs;

            // 2. Calculate counts
            const categoryCounts = {};
            const municipalityCounts = {};
            CATEGORY_LIST.forEach(c => categoryCounts[c] = 0);
            MUNICIPALITY_LIST.forEach(m => municipalityCounts[m] = 0);

            allApprovedMembers.forEach(doc => {
                const data = doc.data();
                
                if (categoryCounts[data.category] !== undefined) {
                    categoryCounts[data.category]++;
                }
                
                // ⚠️ ASSUMPTION: You have a "municipality" or "placeOfBirth" field
                const location = data.municipality || data.placeOfBirth;
                if (municipalityCounts[location] !== undefined) {
                    municipalityCounts[location]++;
                }
            });

            // 3. Render all components
            renderCategoryFilters(categoryCounts);
            renderMunicipalityFilters(municipalityCounts, allApprovedMembers.length);
            applyFiltersAndRender(); // Initial render of all profiles
            
            // 4. Add event listeners
            addFilterListeners();

        } catch (error) {
            console.error("❌ Error loading categories page:", error);
            memberGridEl.innerHTML = `<p class="text-sm text-red-500">Error loading data: ${error.message}</p>`;
        }
    }

    // --- Render Functions ---
    function renderCategoryFilters(counts) {
        categoryListEl.innerHTML = ""; // Clear "Loading..."
        
        let total = allApprovedMembers.length;
        categoryListEl.innerHTML += `
            <a href="#" data-category="All" class="flex justify-between items-center px-3 py-2 rounded-md bg-blue-50 text-blue-700 category-link">
                <span>All Categories</span>
                <span class="text-xs font-medium">${total}</span>
            </a>
        `;
        
        CATEGORY_LIST.forEach(category => {
            const count = counts[category] || 0;
            categoryListEl.innerHTML += `
                <a href="#" data-category="${category}" class="flex justify-between items-center px-3 py-2 rounded-md hover:bg-gray-50 category-link">
                    <span>${category}</span>
                    <span class="text-xs font-medium text-gray-500">${count}</span>
                </a>
            `;
        });
    }

    function renderMunicipalityFilters(counts, total) {
        municipalitySelectEl.innerHTML = ""; // Clear "Loading..."
        
        municipalitySelectEl.innerHTML += `<option value="All">All Municipalities (${total})</option>`;
        
        MUNICIPALITY_LIST.forEach(municipality => {
            const count = counts[municipality] || 0;
            municipalitySelectEl.innerHTML += `<option value="${municipality}">${municipality} (${count})</option>`;
        });
    }

    function renderMemberProfiles(members) {
        memberGridEl.innerHTML = ""; // Clear
        
        if (members.length === 0) {
            memberGridEl.innerHTML = `<p class="text-sm text-gray-500">No members found matching your filters.</p>`;
            return;
        }

        members.forEach(doc => {
            const data = doc.data();
            const name = `${data.firstName || ''} ${data.lastName || ''}`;
            const location = data.address || 'N/A'; 
            const soloParentId = data.soloParentIdNumber || 'N/A';

            memberGridEl.innerHTML += `
                <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 transition">
                    <div class="flex items-start gap-4">
                        <img src="${data.profileImageUrl || 'https://i.pravatar.cc/200'}" class="w-16 h-16 rounded-full object-cover">
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-800">${name}</h3>
                            <p class="text-sm text-gray-500">ID: ${soloParentId}</p>
                            <p class="text-sm text-gray-500 mt-1">${location}</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <a href="#" class="w-full block text-center py-2 px-4 border border-blue-600 text-blue-600 font-medium rounded-md hover:bg-blue-50 transition">
                            View Profile
                        </a>
                    </div>
                </div>
            `;
        });
    }

    // --- Filtering Logic ---
    function applyFiltersAndRender() {
        let filteredMembers = allApprovedMembers;

        // 1. Filter by Category
        if (currentCategory !== "All") {
            filteredMembers = filteredMembers.filter(doc => doc.data().category === currentCategory);
        }

        // 2. Filter by Municipality
        if (currentMunicipality !== "All") {
            const locationField = allApprovedMembers[0]?.data().municipality ? 'municipality' : 'placeOfBirth';
            filteredMembers = filteredMembers.filter(doc => doc.data()[locationField] === currentMunicipality);
        }
        
        // 3. Filter by Search Term
        if (currentSearch) {
            const lowerCaseSearch = currentSearch.toLowerCase();
            filteredMembers = filteredMembers.filter(doc => {
                const data = doc.data();
                const name = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
                const id = (data.soloParentIdNumber || '').toLowerCase();
                return name.includes(lowerCaseSearch) || id.includes(lowerCaseSearch);
            });
        }

        // 4. Render the final list
        renderMemberProfiles(filteredMembers);
        updateFilterTags();
    }
    
    function updateFilterTags() {
        filterTagsEl.innerHTML = "";
        let filtersActive = false;

        if (currentCategory !== "All") {
            filterTagsEl.innerHTML += `<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">${currentCategory}</span>`;
            filtersActive = true;
        }
        if (currentMunicipality !== "All") {
            filterTagsEl.innerHTML += `<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">${currentMunicipality}</span>`;
            filtersActive = true;
        }

        // Add reset button
        filterTagsEl.appendChild(resetFiltersBtn);
        resetFiltersBtn.style.display = filtersActive ? 'flex' : 'none';
    }

    // --- Event Listeners Setup ---
    function addFilterListeners() {
        // Category links
        categoryListEl.addEventListener('click', e => {
            e.preventDefault();
            const link = e.target.closest('.category-link');
            if (!link) return;

            // Update state
            currentCategory = link.dataset.category;
            
            // Update UI
            document.querySelectorAll('.category-link').forEach(l => {
                l.classList.remove('bg-blue-50', 'text-blue-700');
                l.classList.add('hover:bg-gray-50');
                l.querySelector('span:last-child').classList.add('text-gray-500');
            });
            link.classList.add('bg-blue-50', 'text-blue-700');
            link.classList.remove('hover:bg-gray-50');
            link.querySelector('span:last-child').classList.remove('text-gray-500');

            // Re-filter and render
            applyFiltersAndRender();
        });

        // Municipality dropdown
        municipalitySelectEl.addEventListener('change', e => {
            currentMunicipality = e.target.value;
            applyFiltersAndRender();
        });
        
        // Search box
        searchBoxEl.addEventListener('input', e => {
            currentSearch = e.target.value;
            applyFiltersAndRender();
        });

        // Reset button
        resetFiltersBtn.addEventListener('click', e => {
            e.preventDefault();
            currentCategory = "All";
            currentMunicipality = "All";
            currentSearch = "";
            
            searchBoxEl.value = "";
            municipalitySelectEl.value = "All";
            
            document.querySelectorAll('.category-link').forEach(l => {
                l.classList.remove('bg-blue-50', 'text-blue-700');
            });
            document.querySelector('.category-link[data-category="All"]').click(); 
            
            applyFiltersAndRender();
        });
    }

    // --- Initial Load ---
    loadAllData();
}


// --------------------------------------------------------------------------
// ✅ NEW: EVENTS PAGE LOGIC (`events.html`)
// --------------------------------------------------------------------------
function initEventsPage() {
    console.log("🚀 Initializing Events Page...");

    // --- Get DOM elements ---
    const eventForm = document.getElementById('create-event-form');
    const eventListEl = document.getElementById('active-events-list');

    // --- 1. Logic to LOAD events ---
    async function loadActiveEvents() {
        if (!db) {
            eventListEl.innerHTML = `<p class="text-sm text-red-500">Database connection error.</p>`;
            return;
        }

        eventListEl.innerHTML = `<p class="text-sm text-gray-500">Loading active events...</p>`;

        try {
            // Query for all events from now forward, ordered by date
            const q = query(collection(db, "events"), 
                where("eventDate", ">=", Timestamp.now()), 
                orderBy("eventDate", "asc")
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                eventListEl.innerHTML = `<p class="text-sm text-gray-500">No active events found.</p>`;
                return;
            }

            eventListEl.innerHTML = ""; // Clear loading text
            snapshot.forEach(doc => {
                const event = doc.data();
                const eventId = doc.id;
                
                // Format date and time
                const date = event.eventDate.toDate();
                const formattedDate = date.toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                const formattedTime = event.eventTime; // Using the simple time string

                eventListEl.innerHTML += `
                    <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <div class="flex justify-between items-start">
                            <div class="flex items-start gap-4">
                                <div class="bg-green-100 text-green-800 p-3 rounded-full">
                                    <i data-feather="calendar" class="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-gray-800">${event.eventName}</h3>
                                    <p class="text-sm text-gray-500 mt-1">${formattedDate} • ${formattedTime}</p>
                                    <p class="text-sm text-gray-700 mt-1">${event.eventLocation || 'No location specified'}</p>
                                    <p class="text-sm text-gray-600 mt-2">${event.eventDescription || ''}</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button data-id="${eventId}" class="edit-event-btn text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50" title="Edit Event">
                                    <i data-feather="edit" class="w-4 h-4 pointer-events-none"></i>
                                </button>
                                <button data-id="${eventId}" class="delete-event-btn text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50" title="Delete Event">
                                    <i data-feather="trash-2" class="w-4 h-4 pointer-events-none"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Add listeners for the new buttons
            addDynamicButtonListeners();
            feather.replace(); // Render new icons

        } catch (error) {
            console.error("❌ Error loading active events:", error);
            eventListEl.innerHTML = `<p class="text-sm text-red-500">Error loading events. ${error.message}</p>`;
            if (error.code === 'failed-precondition') {
                console.warn("Firestore index missing. Check console (F12) for a link to create it.");
            }
        }
    }

    // --- 2. Logic to CREATE events ---
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop form from reloading page

            // Get values
            const title = document.getElementById('event-title').value;
            const dateValue = document.getElementById('event-date').value;
            const timeValue = document.getElementById('event-time').value;
            const location = document.getElementById('event-location').value;
            const description = document.getElementById('event-description').value;

            // Basic validation
            if (!title || !dateValue || !timeValue) {
                alert("Please fill in at least the Event Title, Date, and Time.");
                return;
            }

            try {
                // Combine date and time into a single JS Date, then a Firebase Timestamp
                const combinedDate = new Date(dateValue + 'T' + timeValue);
                const eventTimestamp = Timestamp.fromDate(combinedDate);

                // Create data object
                const eventData = {
                    eventName: title,
                    eventDate: eventTimestamp,
                    eventTime: timeValue, // Store simple time string for display
                    eventLocation: location,
                    eventDescription: description,
                    createdAt: Timestamp.now()
                };
                
                // Save to Firestore
                await addDoc(collection(db, "events"), eventData);
                
                alert("✅ Event created successfully!");
                eventForm.reset(); // Clear the form
                loadActiveEvents(); // Refresh the event list

            } catch (error) {
                console.error("❌ Error creating event:", error);
                alert("Error creating event: " + error.message);
            }
        });
    }

    // --- 3. Logic to DELETE events ---
    async function deleteEvent(eventId) {
        if (!confirm("Are you sure you want to delete this event?")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "events", eventId));
            alert("Event deleted successfully.");
            loadActiveEvents(); // Refresh the list
        } catch (error) {
            console.error("❌ Error deleting event:", error);
            alert("Error: " + error.message);
        }
    }

    // --- 4. Add listeners for dynamic buttons (Edit/Delete) ---
    function addDynamicButtonListeners() {
        eventListEl.querySelectorAll('.delete-event-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteEvent(e.target.dataset.id));
        });

        eventListEl.querySelectorAll('.edit-event-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                alert("Edit functionality is not yet implemented.");
                console.log("Edit event ID:", e.target.dataset.id);
            });
        });
    }

    // --- Initial Load ---
    loadActiveEvents();
}


// --------------------------------------------------------------------------
// MAIN APP INITIALIZATION
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    if (!db) {
        console.error("Firebase DB not available. Aborting script execution.");
        return;
    }

    // Run common functions on all pages
    handleSidebarHighlight();
    handleMobileSidebar();
    handleLogout();

    // Run page-specific logic
    if (isPage('dashboard.html')) {
        initDashboardPage();
    } else if (isPage('applications.html')) {
        initApplicationsPage();
    } else if (isPage('members.html')) {
        initMembersPage();
    } else if (isPage('categories.html')) {
        initCategoriesPage();
    } else if (isPage('events.html')) { // ✅ ADDED THIS
        initEventsPage();
    } else if (isPage('index.html') || isPage('/')) {
        handlePasswordToggle(); // For login page
    }

    // Finally, replace all Feather icons
    feather.replace();
});