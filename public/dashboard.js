import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

initSidebar();
initLogout();

let allUsersData = [];
let donutChartInstance = null;
let predictiveChartInstance = null;
let categoryChartInstance = null;

// --- Helper: Category Map ---
const CATEGORY_MAP = {
    "a1": "Rape Victim", "a2": "Widow/er", "a3": "Spouse Detained",
    "a4": "Spouse Incapacitated", "a5": "Separated", "a6": "Annulled",
    "a7": "Abandoned", "b1": "Spouse OFW", "b2": "OFW Relative",
    "c": "Unmarried", "d": "Legal Guardian", "f": "Pregnant"
};

// --- 1. Fetch Data ---
async function fetchAllUsers() {
    if (!db) return;
    try {
        const usersCollection = collection(db, "users");
        const snapshot = await getDocs(usersCollection);
        allUsersData = snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("❌ Error fetching all users:", error);
    }
}

async function fetchUpcomingEvents() {
    const eventsList = document.getElementById('upcoming-events-list');
    const eventsCountEl = document.getElementById('events-count');
    
    if (!eventsList || !eventsCountEl) return;

    eventsList.innerHTML = `<p class="text-sm text-gray-500">Loading upcoming events...</p>`;
    try {
        const eventsQuery = query(collection(db, "events"),
            where("eventDate", ">=", Timestamp.now()),
            orderBy("eventDate", "asc")
        );
        const snapshot = await getDocs(eventsQuery);
        eventsCountEl.textContent = snapshot.size;

        if (snapshot.empty) {
            eventsList.innerHTML = `<p class="text-sm text-gray-500">No upcoming events found.</p>`;
            return;
        }

        eventsList.innerHTML = "";
        const topEvents = snapshot.docs.slice(0, 3);
        
        topEvents.forEach(doc => {
            const event = doc.data();
            const eventDate = event.eventDate.toDate();
            const eventHtml = `
            <div class="flex items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div class="bg-blue-100 p-2 rounded-lg mr-3 h-10 w-10 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    ${eventDate.getDate()}
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-800 truncate w-48">${event.eventName}</h3>
                    <p class="text-xs text-gray-500">${eventDate.toLocaleDateString()} • ${event.eventLocation || 'Online'}</p>
                </div>
            </div>`;
            eventsList.innerHTML += eventHtml;
        });
        feather.replace();
    } catch (error) {
        console.error("❌ Error loading events:", error);
        eventsList.innerHTML = `<p class="text-sm text-red-500">Error loading events.</p>`;
    }
}

// --- 2. Chart Initializers ---
function initDonutChart() {
    const ctx = document.getElementById('donutChart');
    if(!ctx) return;
    
    donutChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: { legend: { display: false } }
        }
    });
}

function initPredictiveChart() {
    const ctx = document.getElementById('predictiveChart');
    if (!ctx) return;
    
    predictiveChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Registered Solo Parents',
                data: [],
                backgroundColor: ['#93C5FD', '#93C5FD', '#93C5FD', '#3B82F6', '#8B5CF6', '#8B5CF6'],
                borderRadius: 4,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return context.raw + " Applicants"; } } }
            },
            scales: { 
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
}

// --- 3. Logic Functions ---
// ✅ UPDATED: Now shows specific dates for Custom Range
function updateCategoryChart(users, filterType) {
    if (!categoryChartInstance || !users) return;

    const totalUsers = users.length;
    const counts = {};

    // 1. Count categories
    users.forEach(user => {
        let label = CATEGORY_MAP[user.category] || user.category || "Unspecified";
        counts[label] = (counts[label] || 0) + 1;
    });

    // 2. Sort by count
    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const sortedData = sortedLabels.map(label => counts[label]);

    // 3. Update Chart Data
    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedData;
    categoryChartInstance.update();

    // 4. Generate Description Text
    const descEl = document.getElementById('demographics-description');
    if (descEl) {
        if (totalUsers === 0) {
            descEl.textContent = "No data available for this time period.";
            return;
        }

        // Build list parts: "50% (10) widows"
        const textParts = sortedLabels.map(label => {
            const count = counts[label];
            const percentage = Math.round((count / totalUsers) * 100);
            return `<strong>${percentage}% (${count})</strong> ${label}`;
        });

        // Join sentence with commas and "and"
        let sentence = "";
        if (textParts.length === 1) {
            sentence = textParts[0];
        } else if (textParts.length === 2) {
            sentence = textParts.join(' and ');
        } else {
            const lastPart = textParts.pop();
            sentence = textParts.join(', ') + ', and ' + lastPart;
        }

        // --- NEW DATE CONTEXT LOGIC ---
        let dateContext = "";
        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();

        if (filterType === 'this_month') {
            dateContext = `this ${monthName} ${year}`;
        } else if (filterType === 'this_year') {
            dateContext = `this year (${year})`;
        } else if (filterType === 'all') {
            dateContext = `of all time`;
        } else if (filterType === 'custom') {
            // ✅ Get the values directly from the inputs
            const startInput = document.getElementById('start-date').value;
            const endInput = document.getElementById('end-date').value;
            
            if (startInput && endInput) {
                // Format them to look good (e.g., 11/01/2025)
                // We use simple string replacement to ensure we don't get timezone shifts
                // or use new Date() if you prefer standard formatting
                const sDate = new Date(startInput).toLocaleDateString();
                const eDate = new Date(endInput).toLocaleDateString();
                dateContext = `from ${sDate} to ${eDate}`;
            } else {
                dateContext = `in the selected range`;
            }
        } else {
            dateContext = `in the selected range`;
        }

        descEl.innerHTML = `There are ${sentence} applied ${dateContext}.`;
    }
}

function calculateAvgProcessingTime() {
    const approvedUsers = allUsersData.filter(u => u.status === 'approved' && u.createdAt && u.approvedAt);
    let avgDays = 0;

    if (approvedUsers.length > 0) {
        let totalHours = 0;
        approvedUsers.forEach(user => {
            const created = user.createdAt.toDate();
            const approved = user.approvedAt.toDate();
            totalHours += (approved - created) / (1000 * 60 * 60);
        });
        avgDays = (totalHours / 24 / approvedUsers.length).toFixed(1);
        document.getElementById('avg-processing-time').textContent = `${avgDays} Days`;
    } else {
        document.getElementById('avg-processing-time').textContent = "N/A";
        avgDays = 0;
    }
    
    return Number(avgDays);
}

// --- REAL TIME FORECAST LOGIC ---
function updateForecastWithRealData() {
    if (!allUsersData || !predictiveChartInstance) return;

    const today = new Date();
    const pastMonths = 3;
    const futureMonths = 2;
    
    let labels = [];
    let dataPoints = [];
    let monthCounts = {};

    for (let i = pastMonths; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        monthCounts[monthKey] = 0;
        if (i === 0) labels.push(`${monthKey} (Current)`);
        else labels.push(monthKey);
    }

    allUsersData.forEach(user => {
        if (user.createdAt) {
            const date = user.createdAt.toDate();
            const monthKey = date.toLocaleString('default', { month: 'short' });
            if (monthCounts.hasOwnProperty(monthKey)) {
                monthCounts[monthKey]++;
            }
        }
    });

    let lastCount = 0;
    labels.forEach(label => {
        const key = label.split(' ')[0];
        const count = monthCounts[key];
        dataPoints.push(count);
        lastCount = count;
    });

    for (let i = 1; i <= futureMonths; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthName = d.toLocaleString('default', { month: 'short' });
        labels.push(`${monthName} (Forecast)`);
        let predictedVal = Math.ceil((lastCount || 5) * 1.15); 
        dataPoints.push(predictedVal);
        lastCount = predictedVal;
    }

    predictiveChartInstance.data.labels = labels;
    predictiveChartInstance.data.datasets[0].data = dataPoints;
    predictiveChartInstance.update();

    const avgDays = calculateAvgProcessingTime();
    generateSmartAnalytics(avgDays, dataPoints);
}

// --- SMART ANALYTICS ---
function generateSmartAnalytics(avgDays, forecastCounts) {
    if (!forecastCounts || forecastCounts.length < 4) forecastCounts = [10, 12, 15, 20, 25, 30];

    const summaryEl = document.getElementById('predictive-summary-text');
    const actionContent = document.getElementById('prescriptive-actions-content');
    const optContent = document.getElementById('prescriptive-opt-content');
    const actionBox = document.getElementById('prescriptive-action-box');

    const currentVal = forecastCounts[3]; 
    const futureVal = forecastCounts[5];  
    const percentChange = currentVal > 0 ? Math.round(((futureVal - currentVal) / currentVal) * 100) : 100;
    const isSlow = avgDays > 3.0; 

    let predictiveTitle = "";
    let predictiveDesc = "";

    if (percentChange > 10) {
        predictiveTitle = "📈 Expect More Applicants";
        predictiveDesc = `The system predicts <strong>${percentChange}% more applicants</strong> soon. It is going to get busy.`;
    } else if (percentChange < -5) {
        predictiveTitle = "📉 Fewer Applicants Expected";
        predictiveDesc = `Applicants are decreasing by ${Math.abs(percentChange)}%. Check if people know about the program.`;
    } else {
        predictiveTitle = "⚖️ Steady Number of Applicants";
        predictiveDesc = `Applicant numbers are stable. Good time to organize old files.`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = `
            <strong class="block text-blue-800 mb-1" style="font-size: 14px;">${predictiveTitle}</strong>
            <p style="margin-top: 5px; line-height: 1.4;">${predictiveDesc}</p>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                <span class="text-xs text-gray-500">Current Speed: <strong>${avgDays} Days per approval</strong></span>
            </div>
        `;
    }

    let actionsHTML = "";
    let optsHTML = "";

    if (percentChange > 10 && isSlow) {
        actionBox.className = "bg-red-50 p-4 rounded-lg border border-red-200";
        actionBox.querySelector('h3').className = "font-medium text-red-800 mb-2";
        actionsHTML = `<li class="flex items-start"><i data-feather="users" class="text-red-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Assign more staff</strong> to check documents.</span></li>`;
        optsHTML = `<li class="flex items-start"><i data-feather="check-square" class="text-orange-500 mr-2 mt-0.5 w-4 h-4"></i><span>Prioritize pending list.</span></li>`;
    } else if (percentChange > 10 && !isSlow) {
        actionBox.className = "bg-green-50 p-4 rounded-lg border border-green-200";
        actionBox.querySelector('h3').className = "font-medium text-green-800 mb-2";
        actionsHTML = `<li class="flex items-start"><i data-feather="thumbs-up" class="text-green-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Good job!</strong> The approval time is efficient.</span></li>`;
        optsHTML = `<li class="flex items-start"><i data-feather="printer" class="text-orange-500 mr-2 mt-0.5 w-4 h-4"></i><span>Prepare ID card materials.</span></li>`;
    } else if (percentChange < 0) {
        actionBox.className = "bg-blue-50 p-4 rounded-lg border border-blue-200";
        actionsHTML = `<li class="flex items-start"><i data-feather="mic" class="text-blue-500 mr-2 mt-0.5 w-4 h-4"></i><span><strong>Promote the program</strong> in the Barangay.</span></li>`;
        optsHTML = `<li class="flex items-start"><i data-feather="file-text" class="text-gray-500 mr-2 mt-0.5 w-4 h-4"></i><span>Review rejected applications.</span></li>`;
    } else {
        actionBox.className = "bg-green-50 p-4 rounded-lg border border-green-200";
        actionsHTML = `<li class="flex items-start"><i data-feather="check" class="text-green-500 mr-2 mt-0.5 w-4 h-4"></i><span>Operations are normal. Keep it up.</span></li>`;
        optsHTML = `<li class="flex items-start"><i data-feather="archive" class="text-blue-500 mr-2 mt-0.5 w-4 h-4"></i><span>Archive completed records.</span></li>`;
    }

    actionContent.innerHTML = actionsHTML;
    optContent.innerHTML = optsHTML;
    feather.replace();
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    tableBody.innerHTML = users.length === 0 ? `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity.</td></tr>` : "";
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
        const statusClass = user.status === 'approved' ? 'bg-green-100 text-green-800' : (user.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');
        const statusText = user.status.charAt(0).toUpperCase() + user.status.slice(1);
        tableBody.innerHTML += `<tr><td class="px-6 py-4 text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 text-sm text-gray-500">Application</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-sm text-gray-500">${date}</td></tr>`;
    });
}

// ✅ UPDATED: Dashboard Stats now calls updateCategoryChart with Filter Data
function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    
    if (filter === 'this_month') { 
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); 
    } else if (filter === 'this_year') { 
        startDate = new Date(now.getFullYear(), 0, 1); 
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59); 
    } else if (filter === 'custom') {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        if (startVal && endVal) {
            startDate = new Date(startVal + "T00:00:00");
            endDate = new Date(endVal + "T23:59:59");
        } else {
            startDate = new Date(0); endDate = new Date(); // Default All Time
        }
    } else {
        startDate = new Date(0); endDate = new Date(); // All Time
    }
    
    let registered = 0, pending = 0, approved = 0, rejected = 0;
    
    // Filter Users based on Date Range
    const filteredUsers = allUsersData.filter(u => {
        const d = u.createdAt?.toDate();
        return filter === 'all' || (d && d >= startDate && d <= endDate);
    });

    filteredUsers.forEach(u => {
        if (u.status === 'pending') pending++;
        else if (u.status === 'approved') approved++;
        else if (u.status === 'rejected') rejected++;
    });
    registered = filteredUsers.length;

    document.getElementById('registered-count').textContent = registered;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('approved-count').textContent = approved;

    if (donutChartInstance) {
        donutChartInstance.data.datasets[0].data = [approved, pending, rejected];
        donutChartInstance.update();
    }
    
    const pApproved = registered > 0 ? Math.round(approved/registered*100) : 0;
    const pPending = registered > 0 ? Math.round(pending/registered*100) : 0;
    const pRejected = registered > 0 ? Math.round(rejected/registered*100) : 0;

    document.getElementById('chart-label-approved').textContent = `Approved (${pApproved}%)`;
    document.getElementById('chart-label-pending').textContent = `Pending (${pPending}%)`;
    document.getElementById('chart-label-rejected').textContent = `Rejected (${pRejected}%)`;

    updateRecentActivity(filteredUsers.slice(0, 5));
    
    // ✅ Pass the filtered data AND filter type to update the chart text correctly
    updateCategoryChart(filteredUsers, filter);
    
    // Note: Forecast usually stays "All Time" for trend analysis, but re-calling it ensures freshness
    updateForecastWithRealData(); 
    
    calculateAvgProcessingTime();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initDonutChart();
    initPredictiveChart();
    initCategoryChart();
    
    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range'); // Get the hidden div
    
    // ✅ FIXED: Logic to show/hide the Custom Range inputs
    if (dateSelect && customRangeDiv) {
        dateSelect.addEventListener('change', function() {
            const filterValue = this.value;
            
            if (filterValue === 'custom') {
                // Show the inputs
                customRangeDiv.classList.remove('hidden');
                customRangeDiv.classList.add('flex'); // Use flex to align them
            } else {
                // Hide the inputs
                customRangeDiv.classList.add('hidden');
                customRangeDiv.classList.remove('flex');
                // Update stats immediately for non-custom filters
                updateDashboardStats(filterValue);
            }
        });
    }
    
    // Apply button for the custom range
    const applyBtn = document.getElementById('apply-custom-date');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() { 
            updateDashboardStats('custom'); 
        });
    }

    document.getElementById('generate-report-btn')?.addEventListener('click', handleGenerateReport);

    await fetchUpcomingEvents();
    await fetchAllUsers();
    updateDashboardStats('this_month');
    feather.replace();
});

// ✅ Report Generation (Includes Charts & Data)
function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    
    const date = new Date().toLocaleDateString();
    const registered = document.getElementById('registered-count').textContent;
    const pending = document.getElementById('pending-count').textContent;
    const approved = document.getElementById('approved-count').textContent;
    
    let forecastImg = '';
    const forecastCanvas = document.getElementById('predictiveChart');
    if (forecastCanvas) forecastImg = `<div style="text-align:center; margin: 20px 0;"><img src="${forecastCanvas.toDataURL()}" style="max-width:100%; height:auto; border:1px solid #eee;"></div>`;

    let demoImg = '';
    const demoCanvas = document.getElementById('categoryChart');
    if (demoCanvas) demoImg = `<div style="text-align:center; margin: 20px 0;"><img src="${demoCanvas.toDataURL()}" style="max-width:60%; height:auto; margin: 0 auto;"></div>`;

    const predictiveText = document.getElementById('predictive-summary-text').innerHTML;
    const actionsText = document.getElementById('prescriptive-actions-content').innerHTML;
    const optsText = document.getElementById('prescriptive-opt-content').innerHTML;
    
    // Look for the description text we added
    const demoText = document.getElementById('demographics-description') ? document.getElementById('demographics-description').innerHTML : "";

    let html = `
    <div class="letterhead">
        <h1>SPDA Analytics Report</h1>
        <p>Official Report • Generated: ${date}</p>
    </div>
    
    <h2 class="report-title">1. System Overview</h2>
    <table><thead><tr><th>Metric</th><th>Count</th></tr></thead><tbody>
    <tr><td>Registered Solo Parents</td><td>${registered}</td></tr>
    <tr><td>Pending Applications</td><td>${pending}</td></tr>
    <tr><td>Verified/Approved Members</td><td>${approved}</td></tr>
    </tbody></table>
    
    <h2 class="report-title">2. Applicant Demographics</h2>
    <p style="font-size:12px; color:#666; text-align:center; margin-bottom:10px;">${demoText}</p>
    ${demoImg}

    <h2 class="report-title">3. Applicant Forecast</h2>
    <div style="background:#f9fafb; padding:15px; border:1px solid #e5e7eb; margin-bottom:15px;">${predictiveText}</div>
    ${forecastImg}
    
    <h2 class="report-title">4. Recommendations</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div><h3 style="font-size:14px; border-bottom:2px solid #10B981;">Actions</h3><ul>${actionsText}</ul></div>
        <div><h3 style="font-size:14px; border-bottom:2px solid #F59E0B;">Tips</h3><ul>${optsText}</ul></div>
    </div>
    `;
    
    printContainer.innerHTML = html;
    printContainer.style.display = 'block';
    setTimeout(() => { window.print(); }, 500);
}