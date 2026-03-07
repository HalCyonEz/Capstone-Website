import { db } from "./firebase-config.js";
import { initSidebar, initLogout } from "./utils.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Initialize UI
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
    "c": "Unmarried", "d": "Legal Guardian", 
    "e": "Relative (4th Degree)",
    "f": "Pregnant"
};

// ==========================================
// 1. DATA FETCHING (COMBINED DATABASES)
// ==========================================
async function fetchAllUsers() {
    if (!db) return;
    try {
        allUsersData = []; 
        
        // 1. Get Pending & Rejected from Mobile App
        const usersSnapshot = await getDocs(collection(db, "users"));
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === "pending" || data.status === "rejected") {
                allUsersData.push({ ...data, id: doc.id });
            }
        });

        // 2. Get Official Records
        const recordsSnapshot = await getDocs(collection(db, "solo_parent_records"));
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            allUsersData.push({
                ...data,
                id: doc.id,
                status: data.status || "approved",
                createdAt: data.registrationDate || data.createdAt 
            });
        });
    } catch (error) {
        console.error("❌ Error fetching combined users:", error);
    }
}

// ==========================================
// 2. CHART INITIALIZERS
// ==========================================
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

// ==========================================
// 3. LOGIC FUNCTIONS
// ==========================================
function updateCategoryChart(users, filterType) {
    if (!categoryChartInstance || !users) return;

    const totalUsers = users.length;
    const counts = {};

    users.forEach(user => {
        let label = CATEGORY_MAP[user.category] || user.category || "Unspecified";
        counts[label] = (counts[label] || 0) + 1;
    });

    const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const sortedData = sortedLabels.map(label => counts[label]);

    categoryChartInstance.data.labels = sortedLabels;
    categoryChartInstance.data.datasets[0].data = sortedData;
    categoryChartInstance.update();

    const descEl = document.getElementById('demographics-description');
    if (descEl) {
        if (totalUsers === 0) {
            descEl.textContent = "No data available for this time period.";
            return;
        }
        const textParts = sortedLabels.map(label => {
            const count = counts[label];
            const percentage = Math.round((count / totalUsers) * 100);
            return `<strong>${percentage}% (${count})</strong> ${label}`;
        });

        let dateContext = "";
        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();

        if (filterType === 'this_month') dateContext = `this ${monthName} ${year}`;
        else if (filterType === 'this_year') dateContext = `this year (${year})`;
        else if (filterType === 'all') dateContext = `of all time`;
        else if (filterType === 'custom') {
            const startInput = document.getElementById('start-date').value;
            const endInput = document.getElementById('end-date').value;
            if (startInput && endInput) {
                const sDate = new Date(startInput).toLocaleDateString();
                const eDate = new Date(endInput).toLocaleDateString();
                dateContext = `from ${sDate} to ${eDate}`;
            } else dateContext = `in the selected range`;
        } else dateContext = `in the selected range`;

        let sentence = textParts.length > 0 ? textParts.slice(0, 3).join(', ') + (textParts.length > 3 ? '...' : '') : "No categories found";
        descEl.innerHTML = `There are ${sentence} applied ${dateContext}.`;
    }
}

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
            const date = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
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

    generateSmartAnalytics(dataPoints);
}

function generateSmartAnalytics(forecastCounts) {
    if (!forecastCounts || forecastCounts.length < 4) forecastCounts = [10, 12, 15, 20, 25, 30];

    const summaryEl = document.getElementById('predictive-summary-text');
    const forecastDescEl = document.getElementById('forecast-description');
    const actionContent = document.getElementById('prescriptive-actions-content');
    const optContent = document.getElementById('prescriptive-opt-content');
    const actionBox = document.getElementById('prescriptive-action-box');

    // 1. Forecast Logic
    const currentVal = forecastCounts[3]; 
    const futureVal = forecastCounts[5];  
    const percentChange = currentVal > 0 ? Math.round(((futureVal - currentVal) / currentVal) * 100) : 100;
    
    let predictiveTitle = "";
    let predictiveDesc = "";

    if (percentChange > 10) {
        predictiveTitle = "📈 Rising Applicant Trend";
        predictiveDesc = `We expect <strong>${Math.abs(percentChange)}% more</strong> applicants next month.`;
    } else if (percentChange < -5) {
        predictiveTitle = "📉 Declining Trend";
        predictiveDesc = `We expect <strong>${Math.abs(percentChange)}% fewer</strong> applicants next month.`;
    } else {
        predictiveTitle = "⚖️ Steady Trend";
        predictiveDesc = `Applicant volume is expected to remain stable.`;
    }

    if (summaryEl) {
        summaryEl.innerHTML = `
            <strong class="block text-blue-800 mb-1" style="font-size: 14px;">${predictiveTitle}</strong>
            <p style="margin-top: 5px; line-height: 1.4;">${predictiveDesc}</p>
        `;
    }

    if (forecastDescEl) {
        forecastDescEl.innerHTML = `Based on current registration trends, we anticipate <strong>${futureVal} new applicants</strong> in the next 2 months. Please prepare resources accordingly.`;
    }

    // 2. Recommendations
    const counts = {};
    allUsersData.forEach(user => {
        let code = user.category || "unknown";
        counts[code] = (counts[code] || 0) + 1;
    });

    const sortedCodes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const topCategoryCode = sortedCodes[0] || "default";
    const secondCategoryCode = sortedCodes[1];

    function getRecommendation(code) {
        const name = CATEGORY_MAP[code] || "General";
        switch (code) {
            case 'f': return { label: name, action: `Prioritize <strong>Health Assistance & Maternal Kits</strong>.`, tip: `Coordinate with Health Centers.` };
            case 'a2': return { label: name, action: `Prioritize <strong>Educational Scholarships</strong>.`, tip: `Offer psychosocial support.` };
            case 'b1': case 'b2': return { label: name, action: `Focus on <strong>Livelihood Assistance</strong>.`, tip: `Check for legal support needs.` };
            case 'a1': case 'a3': return { label: name, action: `Provide <strong>Legal & Psychological Support</strong>.`, tip: `Ensure privacy and cash aid.` };
            case 'a5': case 'a6': case 'a7': return { label: name, action: `Prioritize <strong>Crisis Intervention (CIU)</strong>.`, tip: `Verify custody for scholarships.` };
            case 'c': return { label: name, action: `Focus on <strong>Job Placement & Skills Training</strong>.`, tip: `Encourage TESDA programs.` };
            case 'e': return { label: name, action: `Verify <strong>Guardianship/Dependency</strong> documents.`, tip: `Check for specific needs of the dependent.` };
            
            default: return { label: "General", action: `Provide standard <strong>Monthly Cash Subsidy</strong>.`, tip: `Review renewal requirements.` };
        }
    }

    const topRec = getRecommendation(topCategoryCode);
    
    if (actionBox) {
        actionBox.className = "bg-blue-50 p-4 rounded-lg border border-blue-200";
        actionBox.querySelector('h3').className = "font-medium text-blue-800 mb-2";
    }

    const actionsHTML = `
        <li class="flex items-start">
            <div class="mr-2 mt-0.5"><i data-feather="star" class="text-yellow-500 w-4 h-4"></i></div>
            <span><strong>Top Category (${topRec.label}):</strong><br>${topRec.action}</span>
        </li>
    `;

    let optsHTML = "";
    if (secondCategoryCode) {
        const secondRec = getRecommendation(secondCategoryCode);
        optsHTML = `
            <li class="flex items-start">
                <div class="mr-2 mt-0.5"><i data-feather="trending-up" class="text-blue-500 w-4 h-4"></i></div>
                <span><strong>Also High (${secondRec.label}):</strong><br>${secondRec.tip}</span>
            </li>
        `;
    } else {
        optsHTML = `<li>No secondary data available yet.</li>`;
    }

    if (actionContent) actionContent.innerHTML = actionsHTML;
    if (optContent) optContent.innerHTML = optsHTML;
    feather.replace();
}

function updateRecentActivity(users) {
    const tableBody = document.getElementById('recent-activity-table');
    if (!tableBody) return;
    tableBody.innerHTML = users.length === 0 ? `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No recent activity.</td></tr>` : "";
    users.forEach(user => {
        const name = `${user.firstName || ''} ${user.lastName || ''}`;
        
        let date = 'N/A';
        if (user.createdAt && typeof user.createdAt.toDate === 'function') date = user.createdAt.toDate().toLocaleDateString();
        else if (user.createdAt) date = new Date(user.createdAt).toLocaleDateString();
        
        const statusClass = user.status === 'approved' ? 'bg-green-100 text-green-800' : (user.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800');
        const statusText = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "Unknown";
        tableBody.innerHTML += `<tr><td class="px-6 py-4 text-sm font-medium text-gray-900">${name}</td><td class="px-6 py-4 text-sm text-gray-500">Application</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-sm text-gray-500">${date}</td></tr>`;
    });
}

function updateDashboardStats(filter) {
    let startDate, endDate;
    const now = new Date();
    
    if (filter === 'this_week') { 
        startDate = new Date(); startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0,0,0,0);
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
    } else if (filter === 'this_month') { 
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); 
        endDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0); 
    } else if (filter === 'this_year') { 
        startDate = new Date(new Date().getFullYear(), 0, 1); 
        endDate = new Date(new Date().getFullYear(), 11, 31); 
    } else if (filter === 'custom') {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        if (startVal && endVal) { startDate = new Date(startVal); endDate = new Date(endVal); } 
        else { startDate = new Date(0); endDate = new Date(); }
    } else {
        startDate = new Date(0); endDate = new Date();
    }
    
    let registered = 0, pending = 0, approved = 0, rejected = 0;
    
    const filteredUsers = allUsersData.filter(u => {
        const d = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
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

    const statusDescEl = document.getElementById('status-description');
    if (statusDescEl) {
        if (pending > 0) {
            statusDescEl.innerHTML = `You have <strong>${pending} pending applications</strong> waiting for review.`;
        } else {
            statusDescEl.innerHTML = `Great job! You have <strong>no pending applications</strong>. The system has processed <strong>${registered}</strong> records in this range.`;
        }
    }

    updateRecentActivity(filteredUsers.slice(0, 5));
    updateCategoryChart(filteredUsers, filter);
    updateForecastWithRealData(); 
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Attach the button listener FIRST before any other logic can potentially fail
    const reportBtn = document.getElementById('generate-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', handleGenerateReport);
    }

    // 2. Wrap initializers in try/catch so if an HTML element is missing, it doesn't break the whole page
    try { initDonutChart(); } catch (e) { console.warn("Donut chart skipped"); }
    try { initPredictiveChart(); } catch (e) { console.warn("Predictive chart skipped"); }
    try { initCategoryChart(); } catch (e) { console.warn("Category chart skipped"); }
    
    const dateSelect = document.getElementById('date-range-select');
    const customRangeDiv = document.getElementById('custom-date-range');
    
    if(dateSelect && customRangeDiv) {
        dateSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customRangeDiv.classList.remove('hidden');
                customRangeDiv.classList.add('flex');
            } else {
                customRangeDiv.classList.add('hidden');
                customRangeDiv.classList.remove('flex');
                updateDashboardStats(this.value);
            }
        });
    }
    
    const applyBtn = document.getElementById('apply-custom-date');
    if(applyBtn) applyBtn.addEventListener('click', function() { updateDashboardStats('custom'); });

    await fetchAllUsers();
    updateDashboardStats('this_month');
    
    try { feather.replace(); } catch (e) {}
});

// ==========================================
// 🖨️ IMPROVED REPORT GENERATION
// ==========================================
function handleGenerateReport() {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer) return;
    
    const date = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Get Selected Range Text
    const dateSelect = document.getElementById('date-range-select');
    const filterType = dateSelect ? dateSelect.value : 'all';
    let rangeLabel = "All Time";
    const now = new Date();
    
    if (filterType === 'this_week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); 
        const end = new Date(start);
        end.setDate(start.getDate() + 6); 
        rangeLabel = `This Week (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
    } 
    else if (filterType === 'this_month') rangeLabel = `This Month (${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()})`;
    else if (filterType === 'this_year') rangeLabel = `This Year (${now.getFullYear()})`;
    else if (filterType === 'custom') {
        const s = document.getElementById('start-date')?.value;
        const e = document.getElementById('end-date')?.value;
        if (s && e) rangeLabel = `${new Date(s).toLocaleDateString()} - ${new Date(e).toLocaleDateString()}`;
    }

    // Get current stats
    const registered = document.getElementById('registered-count')?.textContent || "0";
    const pending = document.getElementById('pending-count')?.textContent || "0";
    const approved = document.getElementById('approved-count')?.textContent || "0";

    // Get descriptive texts
    const statusDesc = document.getElementById('status-description')?.innerHTML || "No status data available.";
    const demoText = document.getElementById('demographics-description')?.innerHTML || "No demographic data available.";
    const forecastDesc = document.getElementById('forecast-description')?.innerHTML || "No forecast data available.";
    const predictiveText = document.getElementById('predictive-summary-text')?.innerHTML || "<p>Forecast data not available.</p>";
    
    // Get recommendation content
    const actionsContent = document.getElementById('prescriptive-actions-content');
    const optContent = document.getElementById('prescriptive-opt-content');
    
    let actionsText = "<li>No primary recommendations available</li>";
    let optsText = "<li>No secondary recommendations available</li>";
    
    if (actionsContent) {
        actionsText = actionsContent.innerHTML;
    }
    if (optContent) {
        optsText = optContent.innerHTML;
    }

    // Get recent activity data
    const activityTable = document.getElementById('recent-activity-table');
    let activityRows = '';
    if (activityTable) {
        const rows = activityTable.querySelectorAll('tr');
        if (rows.length > 0 && !rows[0].textContent.includes('Loading') && !rows[0].textContent.includes('No recent activity')) {
            rows.forEach(row => {
                activityRows += row.outerHTML;
            });
        }
    }

    // Get chart data if available
    let demographicsTable = '';
    if (window.categoryChartInstance && window.categoryChartInstance.data) {
        const labels = window.categoryChartInstance.data.labels || [];
        const data = window.categoryChartInstance.data.datasets[0]?.data || [];
        demographicsTable = labels.map((label, index) => 
            `<tr><td style="border: 1px solid #ddd; padding: 8px;">${label}</td><td style="border: 1px solid #ddd; padding: 8px;">${data[index] || 0}</td><td style="border: 1px solid #ddd; padding: 8px;">${Math.round((data[index] / registered) * 100) || 0}%</td></tr>`
        ).join('');
    }

    let statusTable = '';
    if (window.donutChartInstance && window.donutChartInstance.data) {
        const labels = window.donutChartInstance.data.labels || ['Approved', 'Pending', 'Rejected'];
        const data = window.donutChartInstance.data.datasets[0]?.data || [approved, pending, 0];
        statusTable = labels.map((label, index) => 
            `<tr><td style="border: 1px solid #ddd; padding: 8px;">${label}</td><td style="border: 1px solid #ddd; padding: 8px;">${data[index] || 0}</td><td style="border: 1px solid #ddd; padding: 8px;">${Math.round((data[index] / registered) * 100) || 0}%</td></tr>`
        ).join('');
    }

    // Build the complete report HTML
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>SPDA Analytics Report - ${date}</title>
        <style>
            body {
                font-family: 'Inter', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 30px;
                background: white;
            }
            .report-container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .letterhead {
                display: flex;
                align-items: center;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .letterhead h1 {
                margin: 0;
                font-size: 28px;
                font-weight: bold;
                color: #1e3a8a;
            }
            .letterhead p {
                margin: 5px 0 0 0;
                color: #666;
            }
            .report-section {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .section-title {
                font-size: 18px;
                font-weight: bold;
                text-transform: uppercase;
                color: #1e3a8a;
                border-bottom: 2px solid #3b82f6;
                padding-bottom: 8px;
                margin-bottom: 15px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-box {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
            }
            .stat-value {
                font-size: 36px;
                font-weight: bold;
                color: #3b82f6;
                margin: 10px 0;
            }
            .stat-label {
                font-size: 14px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            th {
                background: #3b82f6;
                color: white;
                font-weight: 600;
                padding: 12px;
                text-align: left;
            }
            td {
                border: 1px solid #e2e8f0;
                padding: 10px;
            }
            tr:nth-child(even) {
                background: #f8fafc;
            }
            .recommendation-box {
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 15px;
            }
            .recommendation-title {
                font-size: 16px;
                font-weight: bold;
                color: #0369a1;
                margin-bottom: 10px;
            }
            .insight-text {
                background: #f8fafc;
                border-left: 4px solid #3b82f6;
                padding: 15px;
                margin: 15px 0;
                font-style: italic;
            }
            .footer {
                margin-top: 50px;
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
            }
            @media print {
                body { padding: 0.5in; }
                .stat-box { break-inside: avoid; }
                table { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <!-- Letterhead -->
            <div class="letterhead">
                <div style="flex: 1;">
                    <h1>SPDA Analytics Report</h1>
                    <p>Official Executive Summary • Generated: ${date}</p>
                    <p style="font-size: 14px; color: #3b82f6; margin-top: 10px;"><strong>Reporting Period: ${rangeLabel}</strong></p>
                </div>
            </div>

            <!-- Executive Summary -->
            <div class="report-section">
                <div class="section-title">Executive Summary</div>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-label">Total Registered</div>
                        <div class="stat-value">${registered}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Pending Review</div>
                        <div class="stat-value">${pending}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Approved</div>
                        <div class="stat-value">${approved}</div>
                    </div>
                </div>
            </div>

            <!-- 1. Descriptive Analytics -->
            <div class="report-section">
                <div class="section-title">1. Descriptive Analytics (Status Overview)</div>
                <div class="insight-text">
                    ${statusDesc}
                </div>
                
                <h3 style="margin: 20px 0 10px 0;">Application Status Breakdown</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Count</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statusTable || `
                            <tr><td>Approved</td><td>${approved}</td><td>${Math.round((approved/registered)*100) || 0}%</td></tr>
                            <tr><td>Pending</td><td>${pending}</td><td>${Math.round((pending/registered)*100) || 0}%</td></tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- 2. Applicant Demographics -->
            <div class="report-section">
                <div class="section-title">2. Applicant Demographics</div>
                <div class="insight-text">
                    ${demoText}
                </div>
                
                <h3 style="margin: 20px 0 10px 0;">Demographic Breakdown</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Count</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${demographicsTable || '<tr><td colspan="3" style="text-align: center;">No demographic data available</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- 3. Forecast Analysis -->
            <div class="report-section">
                <div class="section-title">3. Applicant Forecast & Trends</div>
                <div class="recommendation-box">
                    ${predictiveText}
                </div>
                <div class="insight-text">
                    ${forecastDesc}
                </div>
            </div>

            <!-- 4. Recommendations -->
            <div class="report-section">
                <div class="section-title">4. Benefit Recommendations</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div class="recommendation-box">
                        <div class="recommendation-title">🎯 Primary Action Items</div>
                        <ul style="margin: 10px 0 0 20px; padding-left: 0;">
                            ${actionsText}
                        </ul>
                    </div>
                    <div class="recommendation-box" style="background: #fff7ed; border-color: #fed7aa;">
                        <div class="recommendation-title" style="color: #9a3412;">📋 Secondary Focus Areas</div>
                        <ul style="margin: 10px 0 0 20px;">
                            ${optsText}
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 5. Recent Activity -->
            ${activityRows ? `
            <div class="report-section">
                <div class="section-title">5. Recent Activity Log</div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Activity</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activityRows}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
                <p>This report was automatically generated by the SPDA System on ${date}.</p>
                <p>For official use only. All data is confidential and should be handled accordingly.</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    // Create a new iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);
    
    // Write the report to the iframe
    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    
    // Print the iframe content
    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        
        // Remove the iframe after printing
        setTimeout(() => {
            document.body.removeChild(printFrame);
        }, 1000);
    }, 250);
}

// Make function globally available
window.handleGenerateReport = handleGenerateReport;
window.printDashboard = handleGenerateReport;