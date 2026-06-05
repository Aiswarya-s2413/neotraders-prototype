document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const tbody = document.getElementById('leadsTableBody');
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.getElementById('filterPills');
    const eventStreamContainer = document.getElementById('eventStreamContainer');
    const streamTime = document.getElementById('streamTime');
    const exportBtn = document.getElementById('exportBtn');

    // KPI Elements
    const kpiTotalLeads = document.getElementById('kpiTotalLeads');
    const kpiHighConviction = document.getElementById('kpiHighConviction');
    const kpiUpgradeReady = document.getElementById('kpiUpgradeReady');
    const kpiChurnRisk = document.getElementById('kpiChurnRisk');
    const kpiAvgProbability = document.getElementById('kpiAvgProbability');

    // Sidebar Badges / Counts
    const badgeSalesTriggers = document.getElementById('badgeSalesTriggers');
    const badgePowerUsers = document.getElementById('badgePowerUsers');
    const badgeRenewalRisk = document.getElementById('badgeRenewalRisk');
    const countDailyRitual = document.getElementById('countDailyRitual');
    const countConsistent = document.getElementById('countConsistent');
    const countOccasional = document.getElementById('countOccasional');

    let allLeads = [];
    let activeFilter = 'all';

    // Update Live Clock Time
    function updateClock() {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false };
        const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
        streamTime.textContent = `${timeStr} IST`;
    }
    updateClock();
    setInterval(updateClock, 30000); // Update every 30s

    // Load leads from backend database
    async function loadLeads() {
        try {
            const response = await fetch('/api/leads');
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                allLeads = data.data;
            } else {
                allLeads = [];
            }
        } catch (error) {
            console.error("Error loading leads from database API:", error);
            allLeads = [];
        }
        renderTable();
        updateKPIs();
        updateSidebarMetrics();
    }

    // Dynamic KPI summary logic calculated from database records
    function updateKPIs() {
        if (allLeads.length === 0) {
            kpiTotalLeads.textContent = "0";
            kpiHighConviction.textContent = "0";
            kpiUpgradeReady.textContent = "0";
            kpiChurnRisk.textContent = "0";
            kpiAvgProbability.textContent = "0%";
            return;
        }

        // 1. Total Leads
        kpiTotalLeads.textContent = allLeads.length;

        // 2. High Conviction: conviction_score >= 50
        const hcCount = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50).length;
        kpiHighConviction.textContent = hcCount;

        // 3. Upgrade Ready: evaluation_score >= 50
        const urCount = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 50).length;
        kpiUpgradeReady.textContent = urCount;

        // 4. Churn Risk: friction_score >= 50
        const crCount = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 50).length;
        kpiChurnRisk.textContent = crCount;

        // 5. Avg Probability: Average conversion probability of all active database users
        const validProbs = allLeads.map(l => parseInt(l.conversion_probability || 0));
        const avgProb = validProbs.reduce((acc, val) => acc + val, 0) / validProbs.length;
        kpiAvgProbability.textContent = `${avgProb.toFixed(1)}%`;
    }

    // Dynamic Sidebar counts calculated from database records
    function updateSidebarMetrics() {
        // Intelligence counts
        badgeSalesTriggers.textContent = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 30 || parseFloat(l.high_conviction_score || 0) >= 30).length;
        badgePowerUsers.textContent = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50).length;
        badgeRenewalRisk.textContent = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 50).length;

        // Cohort counts
        countDailyRitual.textContent = allLeads.filter(l => l.habit_classification === 'Daily Ritual').length;
        countConsistent.textContent = allLeads.filter(l => l.habit_classification === 'Consistent User').length;
        countOccasional.textContent = allLeads.filter(l => l.habit_classification === 'Occasional Visitor').length;
    }

    // Render lead queue table
    function renderTable() {
        tbody.innerHTML = '';
        
        let filtered = allLeads;

        // Apply interactive filter logic
        if (activeFilter === 'upgrade') {
            filtered = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 40);
        } else if (activeFilter === 'risk') {
            filtered = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 40);
        } else if (activeFilter === 'high-value') {
            filtered = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 40);
        }

        // Apply search query
        const term = searchInput.value.toLowerCase().trim();
        if (term) {
            filtered = filtered.filter(l => 
                l.user_id.toLowerCase().includes(term) ||
                (l.habit_classification && l.habit_classification.toLowerCase().includes(term)) ||
                (l.trigger_reason && l.trigger_reason.toLowerCase().includes(term)) ||
                (l.missing_key_feature && l.missing_key_feature.toLowerCase().includes(term))
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 4rem;">No leads matching criteria in database.</td></tr>`;
            return;
        }

        filtered.forEach((lead, index) => {
            const tr = document.createElement('tr');
            tr.className = 'table-row-animate';
            tr.style.animationDelay = `${0.05 + (index * 0.04)}s`;

            // Avatar Color based on User ID hash
            const colors = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];
            let charCodeSum = 0;
            for (let i = 0; i < lead.user_id.length; i++) charCodeSum += lead.user_id.charCodeAt(i);
            const avatarBg = colors[charCodeSum % colors.length];

            // Initials from user_id (e.g. user_1002 -> "U2")
            const cleanNum = lead.user_id.replace(/\D/g, '');
            const initials = 'U' + (cleanNum.slice(-1) || lead.user_id[0] || 'X');

            // Probability Badge styling
            const prob = parseInt(lead.conversion_probability || 0);
            let probClass = 'prob-low';
            if (prob > 70) probClass = 'prob-high';
            else if (prob > 40) probClass = 'prob-med';

            // Reason coloring
            let reasonClass = '';
            const reason = lead.trigger_reason || "Routine Check-in: Stable usage pattern.";
            if (reason.includes('Upgrade') || reason.includes('Upsell')) reasonClass = 'reason-upgrade';
            if (reason.includes('Churn') || reason.includes('Drop') || reason.includes('Risk')) reasonClass = 'reason-churn';

            const convictionVal = Math.round(parseFloat(lead.high_conviction_score || 0));
            const evaluationVal = Math.round(parseFloat(lead.evaluation_score || 0));
            const frictionVal = Math.round(parseFloat(lead.friction_score || 0));

            tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-circle" style="background-color: ${avatarBg}">${initials}</div>
                        <div class="user-info">
                            <span class="user-name">${lead.user_id}</span>
                            <span class="user-meta-sub">${lead.habit_classification || 'Consistent User'}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="prob-badge ${probClass}">${prob}%</span>
                </td>
                <td class="reason-text ${reasonClass}">
                    ${reason}
                </td>
                <td>
                    <span style="color: rgba(255,255,255,0.7)">${lead.missing_key_feature || 'N/A'}</span>
                </td>
                <td>
                    <div class="score-cell">
                        <span class="score-value">${convictionVal}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill fill-conviction" style="width: 0%" data-target="${convictionVal}%"></div></div>
                    </div>
                </td>
                <td>
                    <div class="score-cell">
                        <span class="score-value">${evaluationVal}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill fill-intent" style="width: 0%" data-target="${evaluationVal}%"></div></div>
                    </div>
                </td>
                <td>
                    <div class="score-cell">
                        <span class="score-value">${frictionVal}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill fill-intent" style="background-color: var(--accent-red); width: 0%" data-target="${frictionVal}%"></div></div>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Trigger progress bar fills
        setTimeout(() => {
            const fills = document.querySelectorAll('.score-bar-fill');
            fills.forEach(fill => {
                fill.style.width = fill.getAttribute('data-target');
            });
        }, 50);
    }

    // Filter pills selection handler
    filterPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill');
        if (!btn) return;

        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        activeFilter = btn.dataset.filter;
        renderTable();
    });

    // Search input change handler
    searchInput.addEventListener('input', () => {
        renderTable();
    });

    // Export handler
    exportBtn.addEventListener('click', () => {
        window.location.href = '/api/export';
    });

    // --- 3. DYNAMIC LIVE EVENTS STREAM ---
    function mapDatabaseEvent(evt) {
        const source = evt.source || 'api';
        const endpoint = evt.endpoint || '';
        const status = evt.status_code;
        
        let type = 'evaluating';
        let title = `Accessed endpoint ${endpoint}`;
        
        if (source === 'tracker' || source === 'prototype') {
            const prefix = source === 'tracker' ? 'Tracker' : 'Prototype';
            const notesText = evt.notes ? `: ${evt.notes}` : '';
            title = `[${prefix}] ${endpoint}${notesText}`;
            
            if (evt.category_c) {
                type = 'renewal';   // Alert → Renewal Risk
            } else if (evt.category_b) {
                type = 'upgrade';   // Intent → Upgrade Ready
            } else if (evt.category_a) {
                type = 'evaluating'; // Auth/Nav → Evaluating
            } else {
                type = 'evaluating';
            }
        } else {
            if (status >= 400) {
                type = 'drift';
                title = `Encountered error ${status} on ${endpoint}`;
            } else if (endpoint.startsWith('/subscription') || endpoint.startsWith('/payment')) {
                type = 'upgrade';
                title = `Visited subscription/payment portal: ${endpoint}`;
            } else if (endpoint.startsWith('/wisdom') || endpoint.startsWith('/candlestick_pattern') || endpoint.startsWith('/pivots')) {
                type = 'combo';
                title = `Triggered feature analysis: ${endpoint}`;
            } else if (endpoint.startsWith('/trades') || endpoint.startsWith('/dashboard') || endpoint.startsWith('/market')) {
                type = 'evaluating';
                title = `Inspected trading console: ${endpoint}`;
            } else if (endpoint.startsWith('/profile') || endpoint.startsWith('/utils')) {
                type = 'renewal';
                title = `Updated user settings: ${endpoint}`;
            }
        }
        
        // Calculate elapsed time from ISO timestamp
        let timeStr = 'just now';
        if (evt.timestamp) {
            const diffMs = new Date() - new Date(evt.timestamp);
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) {
                timeStr = 'just now';
            } else if (diffMins < 60) {
                timeStr = `${diffMins}m ago`;
            } else {
                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) {
                    timeStr = `${diffHours}h ago`;
                } else {
                    const diffDays = Math.floor(diffHours / 24);
                    timeStr = `${diffDays}d ago`;
                }
            }
        }
        
        let detailText = `Method: ${evt.method || 'GET'}`;
        if (source === 'tracker' || source === 'prototype') {
            const activeCats = [];
            if (evt.category_a) activeCats.push('Auth');
            if (evt.category_b) activeCats.push('Intent');
            if (evt.category_c) activeCats.push('Alert');
            detailText = activeCats.length > 0 ? `Tags: ${activeCats.join(', ')}` : 'No tags';
            if (evt.element_id) {
                detailText += ` | Element: ${evt.element_id}`;
            }
        }
        
        return {
            type,
            title,
            user: evt.user_id,
            plan: detailText,
            time: timeStr
        };
    }

    function renderEventCard(evt) {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-header-row">
                <span class="event-badge badge-${evt.type}">${getBadgeText(evt.type)}</span>
                <span class="event-time">${evt.time}</span>
            </div>
            <span class="event-desc">${evt.title}</span>
            <span class="event-user-detail">${evt.user} &bull; ${evt.plan}</span>
        `;
        return card;
    }

    function getBadgeText(type) {
        if (type === 'upgrade') return 'UPGRADE READY';
        if (type === 'combo') return 'HIGH-VALUE COMBO';
        if (type === 'drift') return 'DRIFT DETECTED';
        if (type === 'evaluating') return 'EVALUATING';
        if (type === 'renewal') return 'RENEWAL RISK';
        return 'TRIGGER';
    }

    // Load recent events dynamically from database
    async function loadRecentEvents() {
        try {
            const response = await fetch('/api/recent-events');
            const data = await response.json();
            
            if (data.status === 'success' && data.data && data.data.length > 0) {
                eventStreamContainer.innerHTML = '';
                const mappedEvents = data.data.map(evt => mapDatabaseEvent(evt));
                
                // Show up to 12 most recent events
                mappedEvents.slice(0, 12).forEach(evt => {
                    eventStreamContainer.appendChild(renderEventCard(evt));
                });
            } else {
                eventStreamContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">No recent events recorded.</div>';
            }
        } catch (error) {
            console.error("Error loading recent events:", error);
            eventStreamContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">Failed to load live triggers.</div>';
        }
    }

    // Init
    loadLeads().then(() => {
        loadRecentEvents();
    });

    // Poll for new database events and scores every 15 seconds
    setInterval(() => {
        loadLeads().then(() => {
            loadRecentEvents();
        });
    }, 15000);
});
