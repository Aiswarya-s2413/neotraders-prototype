document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const tbody = document.getElementById('leadsTableBody');
    const powerUsersTbody = document.getElementById('powerUsersTableBody');
    let currentFilteredData = [];
    // Date filter state
    let activeDatePreset = 'all';
    let customDateFrom = null;
    let customDateTo = null;
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.getElementById('filterPills');
    const eventStreamContainer = document.getElementById('eventStreamContainer');
    const streamTime = document.getElementById('streamTime');
    const exportBtn = document.getElementById('exportBtn');

    // Live Triggers filter & export elements
    const exportTriggersExcelBtn = document.getElementById('exportTriggersExcelBtn');
    const triggerDateFrom = document.getElementById('triggerDateFrom');
    const triggerDateTo = document.getElementById('triggerDateTo');
    const triggerDateApplyBtn = document.getElementById('triggerDateApplyBtn');
    const triggerDateClearBtn = document.getElementById('triggerDateClearBtn');
    const triggersSubtitle = document.getElementById('triggersSubtitle');
    
    let recentEventsList = [];
    let triggerDateFromVal = null;
    let triggerDateToVal = null;

    // KPI Elements (Sales Triggers Page)
    const kpiTotalLeads = document.getElementById('kpiTotalLeads');
    const kpiHighConviction = document.getElementById('kpiHighConviction');
    const kpiUpgradeReady = document.getElementById('kpiUpgradeReady');
    const kpiChurnRisk = document.getElementById('kpiChurnRisk');
    
    // KPI Elements (Power Users Page)
    const kpiTotalPowerUsers = document.getElementById('kpiTotalPowerUsers');
    const kpiAvgConviction = document.getElementById('kpiAvgConviction');
    const kpiAvgValueGap = document.getElementById('kpiAvgValueGap');
    const kpiTopMissingFeature = document.getElementById('kpiTopMissingFeature');
    
    // Shared KPI Elements
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
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const filterParam = urlParams.get('filter');
        if (filterParam) {
            activeFilter = filterParam;
        }
    } catch(e) {}

    // Update Live Clock Time
    function updateClock() {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false };
        const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
        if (streamTime) streamTime.textContent = `${timeStr} IST`;
    }
    updateClock();
    setInterval(updateClock, 30000); // Update every 30s

    let serverIsHealthy = true;
    function updateSystemHealth(isHealthy) {
        serverIsHealthy = isHealthy;
        const sidebarPulseDot = document.getElementById('sidebarPulseDot') || document.querySelector('.pulse-dot');
        const sidebarStatusText = document.getElementById('sidebarStatusText') || document.querySelector('.status-text');
        const sidebarStatusRate = document.getElementById('sidebarStatusRate') || document.querySelector('.status-rate');
        const headerIndicatorDot = document.getElementById('headerIndicatorDot') || document.querySelector('.green-indicator-dot');
        const headerStreamText = document.getElementById('headerStreamText') || document.querySelector('.stream-text');

        if (isHealthy) {
            if (sidebarPulseDot) {
                sidebarPulseDot.style.backgroundColor = 'var(--accent-green)';
                sidebarPulseDot.style.boxShadow = '0 0 8px var(--accent-green)';
            }
            if (sidebarStatusText) {
                sidebarStatusText.textContent = 'prod ingest healthy';
            }
            if (headerIndicatorDot) {
                headerIndicatorDot.style.backgroundColor = 'var(--accent-green)';
            }
            if (headerStreamText) {
                headerStreamText.textContent = 'Live - stream healthy';
                headerStreamText.style.color = 'var(--accent-green)';
            }
        } else {
            if (sidebarPulseDot) {
                sidebarPulseDot.style.backgroundColor = 'var(--accent-red)';
                sidebarPulseDot.style.boxShadow = '0 0 8px var(--accent-red)';
            }
            if (sidebarStatusText) {
                sidebarStatusText.textContent = 'prod ingest offline';
            }
            if (sidebarStatusRate) {
                sidebarStatusRate.textContent = '0 ev/s';
            }
            if (headerIndicatorDot) {
                headerIndicatorDot.style.backgroundColor = 'var(--accent-red)';
            }
            if (headerStreamText) {
                headerStreamText.textContent = 'Stream disconnected';
                headerStreamText.style.color = 'var(--accent-red)';
            }
        }
    }

    // Periodically fluctuate the event rate slightly if healthy to show active streaming
    setInterval(() => {
        if (serverIsHealthy) {
            const sidebarStatusRate = document.getElementById('sidebarStatusRate') || document.querySelector('.status-rate');
            if (sidebarStatusRate) {
                const baseVal = 3.2;
                const randomOffset = (Math.random() * 0.4 - 0.2); // +/- 0.2
                const finalRate = (baseVal + randomOffset).toFixed(1);
                sidebarStatusRate.textContent = `${finalRate}k ev/s`;
            }
        }
    }, 3000);

    // Load leads from backend database
    async function loadLeads() {
        try {
            const response = await fetch('/api/leads');
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                allLeads = data.data;
                updateSystemHealth(true);
            } else {
                allLeads = [];
                updateSystemHealth(false);
            }
        } catch (error) {
            console.error("Error loading leads from database API:", error);
            allLeads = [];
            updateSystemHealth(false);
        }
        renderTable();
        updateKPIs();
        updateSidebarMetrics();
    }

    // Dynamic KPI summary logic calculated from database records
    function updateKPIs() {
        if (allLeads.length === 0) {
            if (kpiTotalLeads) kpiTotalLeads.textContent = "0";
            if (kpiHighConviction) kpiHighConviction.textContent = "0";
            if (kpiUpgradeReady) kpiUpgradeReady.textContent = "0";
            if (kpiChurnRisk) kpiChurnRisk.textContent = "0";
            if (kpiAvgProbability) kpiAvgProbability.textContent = "0%";
            
            if (kpiTotalPowerUsers) kpiTotalPowerUsers.textContent = "0";
            if (kpiAvgConviction) kpiAvgConviction.textContent = "0";
            if (kpiAvgValueGap) kpiAvgValueGap.textContent = "0%";
            if (kpiTopMissingFeature) kpiTopMissingFeature.textContent = "N/A";
            return;
        }

        // --- Sales Triggers Page KPIs ---
        if (kpiTotalLeads) {
            kpiTotalLeads.textContent = allLeads.length;
        }
        if (kpiHighConviction) {
            const hcCount = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50).length;
            kpiHighConviction.textContent = hcCount;
        }
        if (kpiUpgradeReady) {
            const urCount = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 50).length;
            kpiUpgradeReady.textContent = urCount;
        }
        if (kpiChurnRisk) {
            const crCount = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 50).length;
            kpiChurnRisk.textContent = crCount;
        }

        // --- Power Users Page KPIs ---
        const powerUsers = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50);
        
        if (kpiTotalPowerUsers) {
            kpiTotalPowerUsers.textContent = powerUsers.length;
        }
        if (kpiAvgConviction) {
            if (powerUsers.length > 0) {
                const totalConv = powerUsers.reduce((sum, u) => sum + parseFloat(u.high_conviction_score || 0), 0);
                kpiAvgConviction.textContent = (totalConv / powerUsers.length).toFixed(1);
            } else {
                kpiAvgConviction.textContent = "0";
            }
        }
        if (kpiAvgValueGap) {
            if (powerUsers.length > 0) {
                const totalGap = powerUsers.reduce((sum, u) => sum + parseFloat(u.value_gap_percentage || 0), 0);
                kpiAvgValueGap.textContent = `${(totalGap / powerUsers.length).toFixed(1)}%`;
            } else {
                kpiAvgValueGap.textContent = "0%";
            }
        }
        if (kpiTopMissingFeature) {
            if (powerUsers.length > 0) {
                const featureCounts = {};
                powerUsers.forEach(u => {
                    if (u.missing_key_feature && u.missing_key_feature !== 'N/A') {
                        featureCounts[u.missing_key_feature] = (featureCounts[u.missing_key_feature] || 0) + 1;
                    }
                });
                
                let topFeature = 'None';
                let maxCount = 0;
                for (const feature in featureCounts) {
                    if (featureCounts[feature] > maxCount) {
                        maxCount = featureCounts[feature];
                        topFeature = feature;
                    }
                }
                kpiTopMissingFeature.textContent = topFeature;
                kpiTopMissingFeature.title = topFeature; // tool tip if clipped
            } else {
                kpiTopMissingFeature.textContent = "N/A";
            }
        }

        // --- Shared KPIs ---
        if (kpiAvgProbability) {
            const targetLeads = kpiTotalPowerUsers ? powerUsers : allLeads;
            if (targetLeads.length > 0) {
                const validProbs = targetLeads.map(l => parseInt(l.conversion_probability || 0));
                const avgProb = validProbs.reduce((acc, val) => acc + val, 0) / validProbs.length;
                kpiAvgProbability.textContent = `${avgProb.toFixed(1)}%`;
            } else {
                kpiAvgProbability.textContent = "0%";
            }
        }
    }

    // Dynamic Sidebar counts calculated from database records
    function updateSidebarMetrics() {
        // Intelligence counts
        if (badgeSalesTriggers) badgeSalesTriggers.textContent = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 30 || parseFloat(l.high_conviction_score || 0) >= 30).length;
        if (badgePowerUsers) badgePowerUsers.textContent = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50).length;
        if (badgeRenewalRisk) badgeRenewalRisk.textContent = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 50).length;

        // Cohort counts
        if (countDailyRitual) countDailyRitual.textContent = allLeads.filter(l => l.habit_classification === 'Daily Ritual').length;
        if (countConsistent) countConsistent.textContent = allLeads.filter(l => l.habit_classification === 'Consistent User').length;
        if (countOccasional) countOccasional.textContent = allLeads.filter(l => l.habit_classification === 'Occasional Visitor').length;
    }

    // Unified render function
    function renderTable() {
        if (tbody) {
            renderLeadsTable();
        } else if (powerUsersTbody) {
            renderPowerUsersTable();
        }
    }

    // Render lead queue table
    function renderLeadsTable() {
        tbody.innerHTML = '';
        
        let filtered = allLeads;

        // Apply interactive filter logic
        if (activeFilter === 'upgrade') {
            filtered = allLeads.filter(l => parseFloat(l.evaluation_score || 0) >= 40);
        } else if (activeFilter === 'risk') {
            filtered = allLeads.filter(l => parseFloat(l.friction_score || 0) >= 40);
        } else if (activeFilter === 'high-value') {
            filtered = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 40);
        } else if (activeFilter === 'cohort-daily') {
            filtered = allLeads.filter(l => l.habit_classification === 'Daily Ritual');
        } else if (activeFilter === 'cohort-consistent') {
            filtered = allLeads.filter(l => l.habit_classification === 'Consistent User');
        } else if (activeFilter === 'cohort-occasional') {
            filtered = allLeads.filter(l => l.habit_classification === 'Occasional Visitor');
        } else if (activeFilter === 'prob-high') {
            filtered = allLeads.filter(l => parseInt(l.conversion_probability || 0) >= 70);
        }

        // Apply search query
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
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

            tr.addEventListener('click', () => {
                openCustomerDrawer(lead.user_id, lead);
            });

            tbody.appendChild(tr);
        });

        // Trigger progress bar fills
        setTimeout(() => {
            const fills = document.querySelectorAll('.score-bar-fill');
            fills.forEach(fill => {
                fill.style.width = fill.getAttribute('data-target');
            });
        }, 50);

        currentFilteredData = filtered;
    }

    // Render power users table
    function renderPowerUsersTable() {
        powerUsersTbody.innerHTML = '';
        
        let filtered = allLeads.filter(l => parseFloat(l.high_conviction_score || 0) >= 50);

        // Apply dynamic interactive filters for KPI / sidebar clicks on power users page
        if (activeFilter === 'cohort-daily') {
            filtered = filtered.filter(l => l.habit_classification === 'Daily Ritual');
        } else if (activeFilter === 'cohort-consistent') {
            filtered = filtered.filter(l => l.habit_classification === 'Consistent User');
        } else if (activeFilter === 'cohort-occasional') {
            filtered = filtered.filter(l => l.habit_classification === 'Occasional Visitor');
        } else if (activeFilter === 'risk') {
            filtered = filtered.filter(l => parseFloat(l.friction_score || 0) >= 40);
        } else if (activeFilter === 'upgrade') {
            filtered = filtered.filter(l => parseFloat(l.evaluation_score || 0) >= 40);
        } else if (activeFilter === 'conviction-above-avg') {
            if (filtered.length > 0) {
                const total = filtered.reduce((sum, u) => sum + parseFloat(u.high_conviction_score || 0), 0);
                const avg = total / filtered.length;
                filtered = filtered.filter(l => parseFloat(l.high_conviction_score || 0) > avg);
            }
        } else if (activeFilter === 'value-gap-above-avg') {
            if (filtered.length > 0) {
                const total = filtered.reduce((sum, u) => sum + parseFloat(u.value_gap_percentage || 0), 0);
                const avg = total / filtered.length;
                filtered = filtered.filter(l => parseFloat(l.value_gap_percentage || 0) > avg);
            }
        } else if (activeFilter === 'top-gap-feature') {
            if (filtered.length > 0) {
                const featureCounts = {};
                filtered.forEach(u => {
                    if (u.missing_key_feature && u.missing_key_feature !== 'N/A') {
                        featureCounts[u.missing_key_feature] = (featureCounts[u.missing_key_feature] || 0) + 1;
                    }
                });
                let topFeature = null;
                let maxCount = 0;
                for (const feature in featureCounts) {
                    if (featureCounts[feature] > maxCount) {
                        maxCount = featureCounts[feature];
                        topFeature = feature;
                    }
                }
                if (topFeature) {
                    filtered = filtered.filter(l => l.missing_key_feature === topFeature);
                }
            }
        } else if (activeFilter === 'probability-above-avg') {
            if (filtered.length > 0) {
                const total = filtered.reduce((sum, u) => sum + parseInt(u.conversion_probability || 0), 0);
                const avg = total / filtered.length;
                filtered = filtered.filter(l => parseInt(l.conversion_probability || 0) > avg);
            }
        }

        // Apply search query
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (term) {
            filtered = filtered.filter(l => 
                l.user_id.toLowerCase().includes(term) ||
                (l.habit_classification && l.habit_classification.toLowerCase().includes(term)) ||
                (l.trigger_reason && l.trigger_reason.toLowerCase().includes(term)) ||
                (l.missing_key_feature && l.missing_key_feature.toLowerCase().includes(term))
            );
        }

        // Apply date filter
        const now = new Date();
        let dateFrom = customDateFrom;
        let dateTo = customDateTo;

        if (activeDatePreset === 'today') {
            dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (activeDatePreset === '7d') {
            dateFrom = new Date(now - 7 * 24 * 60 * 60 * 1000);
            dateTo = now;
        } else if (activeDatePreset === '30d') {
            dateFrom = new Date(now - 30 * 24 * 60 * 60 * 1000);
            dateTo = now;
        }

        if (dateFrom || dateTo) {
            filtered = filtered.filter(l => {
                if (!l.last_calculated_at) return false;
                const d = new Date(l.last_calculated_at);
                if (dateFrom && d < dateFrom) return false;
                if (dateTo && d > dateTo) return false;
                return true;
            });
        }

        // Update result badge
        const resultEl = document.getElementById('dateFilterResult');
        if (resultEl) {
            if (activeDatePreset !== 'all' || dateFrom || dateTo) {
                resultEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''} found`;
                resultEl.style.display = 'inline-flex';
            } else {
                resultEl.style.display = 'none';
            }
        }

        if (filtered.length === 0) {
            powerUsersTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 4rem;">No power users matching the selected date range.</td></tr>`;
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
            const valueGapVal = Math.round(parseFloat(lead.value_gap_percentage || 0));

            // Format timestamp nicely
            let lastAnalyzed = 'N/A';
            if (lead.last_calculated_at) {
                const date = new Date(lead.last_calculated_at);
                lastAnalyzed = date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }

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
                    <div class="score-cell" style="width: 100px;">
                        <span class="score-value">${valueGapVal}%</span>
                        <div class="score-bar-bg">
                            <div class="score-bar-fill fill-intent" style="background: var(--accent-orange); width: 0%" data-target="${valueGapVal}%"></div>
                        </div>
                    </div>
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
                <td>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${lastAnalyzed}</span>
                </td>
            `;

            tr.addEventListener('click', () => {
                openCustomerDrawer(lead.user_id, lead);
            });

            powerUsersTbody.appendChild(tr);
        });

        // Trigger progress bar fills
        setTimeout(() => {
            const fills = document.querySelectorAll('.score-bar-fill');
            fills.forEach(fill => {
                fill.style.width = fill.getAttribute('data-target');
            });
        }, 50);

        currentFilteredData = filtered;
    }

    function syncFilterPillsUI() {
        if (!filterPills) return;
        
        // Remove active class from all static pills
        filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        
        // Remove any temporary custom pills
        const tempPill = document.getElementById('tempFilterPill');
        if (tempPill) tempPill.remove();

        // Highlight matching static pill
        const matchingPill = filterPills.querySelector(`.pill[data-filter="${activeFilter}"]`);
        if (matchingPill) {
            matchingPill.classList.add('active');
        } else if (activeFilter !== 'all') {
            // It's a custom/cohort filter, let's create a temporary active pill so they can clear it!
            let label = activeFilter;
            if (activeFilter === 'cohort-daily') label = 'Daily Ritual';
            else if (activeFilter === 'cohort-consistent') label = 'Consistent';
            else if (activeFilter === 'cohort-occasional') label = 'Occasional';
            else if (activeFilter === 'prob-high') label = 'Prob. >= 70%';
            else if (activeFilter === 'conviction-above-avg') label = 'Conviction > Avg';
            else if (activeFilter === 'value-gap-above-avg') label = 'Value Gap > Avg';
            else if (activeFilter === 'top-gap-feature') label = 'Top Gap Feature';
            else if (activeFilter === 'probability-above-avg') label = 'Prob. > Avg';
            else if (activeFilter === 'risk') label = 'Churn Risk';
            else if (activeFilter === 'upgrade') label = 'Upgrade-ready';
            
            const pill = document.createElement('button');
            pill.id = 'tempFilterPill';
            pill.className = 'pill active';
            pill.style.background = 'rgba(99,102,241,0.22)';
            pill.style.borderColor = '#6366f1';
            pill.style.color = '#c7d2fe';
            pill.innerHTML = `${label} <span style="margin-left: 6px; font-weight: bold; opacity: 0.7;">&times;</span>`;
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                activeFilter = 'all';
                syncFilterPillsUI();
                renderTable();
            });
            filterPills.appendChild(pill);
        }
    }

    // Filter pills selection handler
    if (filterPills) {
        filterPills.addEventListener('click', (e) => {
            const btn = e.target.closest('.pill');
            if (!btn || btn.id === 'tempFilterPill') return;

            activeFilter = btn.dataset.filter;
            syncFilterPillsUI();
            renderTable();
        });
    }

    // --- KPI CARDS CLICK HANDLERS (SALES TRIGGERS PAGE) ---
    const kpiCardTotalLeads = document.getElementById('kpiCardTotalLeads');
    const kpiCardHighConviction = document.getElementById('kpiCardHighConviction');
    const kpiCardUpgradeReady = document.getElementById('kpiCardUpgradeReady');
    const kpiCardChurnRisk = document.getElementById('kpiCardChurnRisk');
    const kpiCardAvgProbability = document.getElementById('kpiCardAvgProbability');

    if (kpiCardTotalLeads) {
        kpiCardTotalLeads.addEventListener('click', () => {
            activeFilter = 'all';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardHighConviction) {
        kpiCardHighConviction.addEventListener('click', () => {
            activeFilter = 'high-value';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardUpgradeReady) {
        kpiCardUpgradeReady.addEventListener('click', () => {
            activeFilter = 'upgrade';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardChurnRisk) {
        kpiCardChurnRisk.addEventListener('click', () => {
            activeFilter = 'risk';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardAvgProbability && !powerUsersTbody) {
        kpiCardAvgProbability.addEventListener('click', () => {
            activeFilter = 'prob-high';
            syncFilterPillsUI();
            renderTable();
        });
    }

    // --- KPI CARDS CLICK HANDLERS (POWER USERS PAGE) ---
    const kpiCardTotalPowerUsers = document.getElementById('kpiCardTotalPowerUsers');
    const kpiCardAvgConviction = document.getElementById('kpiCardAvgConviction');
    const kpiCardAvgValueGap = document.getElementById('kpiCardAvgValueGap');
    const kpiCardTopMissingFeature = document.getElementById('kpiCardTopMissingFeature');

    if (kpiCardTotalPowerUsers) {
        kpiCardTotalPowerUsers.addEventListener('click', () => {
            activeFilter = 'all';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardAvgConviction) {
        kpiCardAvgConviction.addEventListener('click', () => {
            activeFilter = 'conviction-above-avg';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardAvgValueGap) {
        kpiCardAvgValueGap.addEventListener('click', () => {
            activeFilter = 'value-gap-above-avg';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardTopMissingFeature) {
        kpiCardTopMissingFeature.addEventListener('click', () => {
            activeFilter = 'top-gap-feature';
            syncFilterPillsUI();
            renderTable();
        });
    }
    if (kpiCardAvgProbability && powerUsersTbody) {
        kpiCardAvgProbability.addEventListener('click', () => {
            activeFilter = 'probability-above-avg';
            syncFilterPillsUI();
            renderTable();
        });
    }

    // --- SIDEBAR NAVIGATION INTERACTIVITY ---
    const sidebarRenewalRisk = document.getElementById('sidebarRenewalRisk');
    const sidebarDailyRitual = document.getElementById('sidebarDailyRitual');
    const sidebarConsistent = document.getElementById('sidebarConsistent');
    const sidebarOccasional = document.getElementById('sidebarOccasional');

    if (sidebarRenewalRisk) {
        sidebarRenewalRisk.addEventListener('click', (e) => {
            e.preventDefault();
            if (tbody) { // on triggers page
                activeFilter = 'risk';
                syncFilterPillsUI();
                renderTable();
            } else { // on power users page, redirect to triggers with filter param
                window.location.href = 'index.html?filter=risk';
            }
        });
    }

    if (sidebarDailyRitual) {
        sidebarDailyRitual.addEventListener('click', (e) => {
            e.preventDefault();
            activeFilter = 'cohort-daily';
            syncFilterPillsUI();
            renderTable();
        });
    }

    if (sidebarConsistent) {
        sidebarConsistent.addEventListener('click', (e) => {
            e.preventDefault();
            activeFilter = 'cohort-consistent';
            syncFilterPillsUI();
            renderTable();
        });
    }

    if (sidebarOccasional) {
        sidebarOccasional.addEventListener('click', (e) => {
            e.preventDefault();
            activeFilter = 'cohort-occasional';
            syncFilterPillsUI();
            renderTable();
        });
    }

    // Search input change handler
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderTable();
        });
    }

    // Export handler
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            window.location.href = '/api/export';
        });
    }

    function handleExcelExport() {
        if (typeof XLSX === 'undefined') {
            alert("Excel export library is still loading. Please try again in a moment.");
            return;
        }

        if (!currentFilteredData || currentFilteredData.length === 0) {
            alert("No data available to export.");
            return;
        }

        const isPowerUsersPage = !!powerUsersTbody;
        const filename = isPowerUsersPage ? 'neotrader_power_users.xlsx' : 'neotrader_sales_triggers.xlsx';
        
        // Map data to user-friendly column names
        const exportRows = currentFilteredData.map(lead => {
            const row = {
                "User ID": lead.user_id,
                "Conversion Probability (%)": lead.conversion_probability || 0,
                "Reason to Call": lead.trigger_reason || "Routine Check-in",
                "Missing Key Feature": lead.missing_key_feature || "N/A",
                "Conviction Score": Math.round(parseFloat(lead.high_conviction_score || 0)),
                "Evaluation Score": Math.round(parseFloat(lead.evaluation_score || 0)),
                "Friction Score": Math.round(parseFloat(lead.friction_score || 0))
            };
            
            if (isPowerUsersPage) {
                row["Value Gap (%)"] = Math.round(parseFloat(lead.value_gap_percentage || 0));
                row["Habit Classification"] = lead.habit_classification || "N/A";
                row["Last Analyzed"] = lead.last_calculated_at ? new Date(lead.last_calculated_at).toLocaleString() : "N/A";
            }
            
            return row;
        });

        // Use SheetJS to write binary XLSX
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        
        // Adjust column widths automatically for clean styling
        const colWidths = Object.keys(exportRows[0] || {}).map(key => {
            let maxLen = key.length;
            exportRows.forEach(row => {
                const val = String(row[key] || '');
                if (val.length > maxLen) maxLen = val.length;
            });
            return { wch: maxLen + 2 };
        });
        worksheet['!cols'] = colWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, isPowerUsersPage ? "Power Users" : "Sales Triggers");
        XLSX.writeFile(workbook, filename);
    }

    // Excel Export handler
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', handleExcelExport);
    }

    // Date preset pills handler (Power Users page)
    const datePresetsEl = document.getElementById('datePresets');
    if (datePresetsEl) {
        datePresetsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.date-preset-btn');
            if (!btn) return;
            datePresetsEl.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeDatePreset = btn.dataset.preset;
            // Clear custom range when a preset is chosen
            customDateFrom = null;
            customDateTo = null;
            const dfEl = document.getElementById('dateFrom');
            const dtEl = document.getElementById('dateTo');
            if (dfEl) dfEl.value = '';
            if (dtEl) dtEl.value = '';
            renderPowerUsersTable();
        });
    }

    // Custom date range – Apply
    const dateApplyBtn = document.getElementById('dateApplyBtn');
    if (dateApplyBtn) {
        dateApplyBtn.addEventListener('click', () => {
            const dfEl = document.getElementById('dateFrom');
            const dtEl = document.getElementById('dateTo');
            customDateFrom = dfEl && dfEl.value ? new Date(dfEl.value) : null;
            customDateTo   = dtEl && dtEl.value ? new Date(dtEl.value + 'T23:59:59') : null;
            // Deselect presets when custom range applied
            activeDatePreset = 'custom';
            datePresetsEl && datePresetsEl.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
            renderPowerUsersTable();
        });
    }

    // Custom date range – Clear
    const dateClearBtn = document.getElementById('dateClearBtn');
    if (dateClearBtn) {
        dateClearBtn.addEventListener('click', () => {
            customDateFrom = null;
            customDateTo = null;
            activeDatePreset = 'all';
            const dfEl = document.getElementById('dateFrom');
            const dtEl = document.getElementById('dateTo');
            if (dfEl) dfEl.value = '';
            if (dtEl) dtEl.value = '';
            datePresetsEl && datePresetsEl.querySelectorAll('.date-preset-btn').forEach((b, i) => {
                b.classList.toggle('active', i === 0); // "All Time" is first
            });
            renderPowerUsersTable();
        });
    }

    // --- 3. DYNAMIC LIVE EVENTS STREAM ---
    function mapDatabaseEvent(evt) {
        const source = evt.source || 'api';
        const endpoint = evt.endpoint || '';
        const status = evt.status_code;
        
        let type = 'evaluating';
        let title = `Accessed endpoint ${endpoint}`;
        
        if (source === 'tracker' || source === 'prototype') {
            const notesText = evt.notes ? `: ${evt.notes}` : '';
            if (source === 'tracker') {
                title = `${endpoint}${notesText}`;
            } else {
                title = `[Prototype] ${endpoint}${notesText}`;
            }
            
            if (evt.category_c) {
                type = 'combo';     // Alert/Deep Engagement → High-Value Combo
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
        }
        
        return {
            type,
            title,
            user: evt.user_id,
            plan: detailText,
            time: timeStr
        };
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function renderEventCard(evt) {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-header-row">
                <span class="event-time">${evt.time}</span>
            </div>
            <span class="event-desc">${escapeHtml(evt.title)}</span>
            <span class="event-user-detail">${escapeHtml(evt.user)} &bull; ${escapeHtml(evt.plan)}</span>
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
            let url = '/api/recent-events';
            const params = [];
            if (triggerDateFromVal) params.push(`start_date=${triggerDateFromVal}`);
            if (triggerDateToVal) params.push(`end_date=${triggerDateToVal}`);
            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'success' && data.data) {
                recentEventsList = data.data; // Store full list for export
                eventStreamContainer.innerHTML = '';
                
                if (recentEventsList.length > 0) {
                    // Show up to 50 when filtered, or 12 for live stream
                    const limit = (triggerDateFromVal || triggerDateToVal) ? 50 : 12;
                    const mappedEvents = recentEventsList.map(evt => mapDatabaseEvent(evt));
                    
                    mappedEvents.slice(0, limit).forEach(evt => {
                        eventStreamContainer.appendChild(renderEventCard(evt));
                    });
                } else {
                    eventStreamContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">No events match the selected dates.</div>';
                }

                if (triggersSubtitle) {
                    if (triggerDateFromVal || triggerDateToVal) {
                        triggersSubtitle.innerHTML = 'Filtered stream &bull; auto-refreshing';
                    } else {
                        triggersSubtitle.innerHTML = 'Stream from instrumentation layer &bull; auto-refreshing';
                    }
                }
                updateSystemHealth(true);
            } else {
                recentEventsList = [];
                eventStreamContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">No recent events recorded.</div>';
                updateSystemHealth(false);
            }
        } catch (error) {
            console.error("Error loading recent events:", error);
            eventStreamContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">Failed to load live triggers.</div>';
            updateSystemHealth(false);
        }
    }

    // Live Triggers Date Filtering Event Listeners
    if (triggerDateApplyBtn) {
        triggerDateApplyBtn.addEventListener('click', () => {
            triggerDateFromVal = triggerDateFrom ? triggerDateFrom.value : null;
            triggerDateToVal = triggerDateTo ? triggerDateTo.value : null;
            loadRecentEvents();
        });
    }

    if (triggerDateClearBtn) {
        triggerDateClearBtn.addEventListener('click', () => {
            if (triggerDateFrom) triggerDateFrom.value = '';
            if (triggerDateTo) triggerDateTo.value = '';
            triggerDateFromVal = null;
            triggerDateToVal = null;
            loadRecentEvents();
        });
    }

    // Live Triggers Excel Export Function
    function handleTriggersExcelExport() {
        if (typeof XLSX === 'undefined') {
            alert("Excel export library is still loading. Please try again in a moment.");
            return;
        }

        if (!recentEventsList || recentEventsList.length === 0) {
            alert("No event data available to export.");
            return;
        }

        const filename = 'neotrader_live_triggers.xlsx';
        
        // Map data to user-friendly column names
        const exportRows = recentEventsList.map(evt => {
            const dateStr = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'N/A';
            return {
                "Timestamp": dateStr,
                "User ID / Email": evt.user_id || 'anonymous',
                "Source": evt.source ? evt.source.toUpperCase() : 'UNKNOWN',
                "Event Name / Endpoint": evt.endpoint || '',
                "HTTP Method": evt.method || '',
                "Status Code": evt.status_code || '',
                "Notes / Details": evt.notes || '',
                "HTML Element ID": evt.element_id || '',
                "Auth Tag (A)": evt.category_a ? 'Yes' : 'No',
                "Intent Tag (B)": evt.category_b ? 'Yes' : 'No',
                "Alert Tag (C)": evt.category_c ? 'Yes' : 'No'
            };
        });

        // Use SheetJS to write binary XLSX
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        
        // Adjust column widths automatically for clean styling
        const colWidths = Object.keys(exportRows[0] || {}).map(key => {
            let maxLen = key.length;
            exportRows.forEach(row => {
                const val = String(row[key] || '');
                if (val.length > maxLen) maxLen = val.length;
            });
            return { wch: maxLen + 2 };
        });
        worksheet['!cols'] = colWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Live Triggers");
        XLSX.writeFile(workbook, filename);
    }

    if (exportTriggersExcelBtn) {
        exportTriggersExcelBtn.addEventListener('click', handleTriggersExcelExport);
    }

    // Init
    syncFilterPillsUI();
    loadLeads().then(() => {
        loadRecentEvents();
    });

    // Poll for new database events and scores every 15 seconds
    setInterval(() => {
        loadLeads().then(() => {
            loadRecentEvents();
        });
    }, 15000);

    // ==========================================================================
    // CUSTOMER PROFILE DRAWER (CRM-STYLE SLIDE-OUT)
    // ==========================================================================
    const customerDrawer = document.getElementById('customerDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const drawerContent = document.getElementById('drawerContent');

    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', closeCustomerDrawer);
    }
    
    // Close drawer when clicking outside it (and not on interactive elements)
    document.addEventListener('click', (e) => {
        if (customerDrawer && customerDrawer.classList.contains('open')) {
            const clickedInsideDrawer = customerDrawer.contains(e.target);
            const clickedTableRow = e.target.closest('tbody tr');
            const clickedToast = e.target.closest('#copyToast');
            if (!clickedInsideDrawer && !clickedTableRow && !clickedToast) {
                closeCustomerDrawer();
            }
        }
    });

    function closeCustomerDrawer() {
        if (customerDrawer) {
            customerDrawer.classList.remove('open');
        }
    }

    async function openCustomerDrawer(userId, leadData) {
        if (!customerDrawer || !drawerContent) return;
        
        customerDrawer.classList.add('open');
        
        // Render Skeleton Loader
        drawerContent.innerHTML = `
            <div class="drawer-profile-summary">
                <div class="skeleton-circle"></div>
                <div class="skeleton-text short" style="margin-top: 0.5rem;"></div>
                <div class="skeleton-text medium"></div>
            </div>
            
            <div class="drawer-card">
                <div class="drawer-card-title">Contact Information</div>
                <div class="skeleton-text long"></div>
                <div class="skeleton-text long"></div>
            </div>
            
            <div class="drawer-card">
                <div class="drawer-card-title">Telemetry & Conversion</div>
                <div class="skeleton-text long"></div>
                <div class="skeleton-text short"></div>
            </div>
        `;
        
        try {
            const response = await fetch(`/api/customers/${encodeURIComponent(userId)}`);
            const resData = await response.json();
            
            if (resData.status === 'success' && resData.data) {
                const customer = resData.data;
                
                const colors = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];
                let charCodeSum = 0;
                const nameForAvatar = customer.full_name || userId;
                for (let i = 0; i < nameForAvatar.length; i++) charCodeSum += nameForAvatar.charCodeAt(i);
                const avatarBg = colors[charCodeSum % colors.length];
                
                const initials = nameForAvatar.split(' ')
                    .map(word => word[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U';
                
                let creationDate = 'N/A';
                if (customer.created_at) {
                    const d = new Date(customer.created_at);
                    creationDate = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                }
                
                const planName = customer.subscription_plan || 'Free Account';
                const statusName = customer.subscription_status || 'Unsubscribed';
                const is_active = customer.is_active;
                
                let planColor = '#64748b';
                if (planName.includes('Pro')) planColor = 'var(--accent-teal)';
                if (planName.includes('Enterprise')) planColor = 'var(--accent-blue)';
                
                let statusColor = '#ef4444';
                if (statusName === 'Active' || statusName === 'Trialing' || is_active) statusColor = 'var(--accent-green)';
                if (statusName === 'Past Due') statusColor = 'var(--accent-yellow)';
                
                const convictionVal = Math.round(parseFloat(leadData.high_conviction_score || 0));
                const evaluationVal = Math.round(parseFloat(leadData.evaluation_score || 0));
                const frictionVal = Math.round(parseFloat(leadData.friction_score || 0));
                const valueGapVal = leadData.value_gap_percentage !== undefined ? Math.round(parseFloat(leadData.value_gap_percentage || 0)) : null;
                const prob = leadData.conversion_probability || 0;
                
                let probClass = 'prob-low';
                if (prob > 70) probClass = 'prob-high';
                else if (prob > 40) probClass = 'prob-med';
                
                drawerContent.innerHTML = `
                    <div class="drawer-profile-summary">
                        <div class="drawer-avatar" style="background-color: ${avatarBg}">${initials}</div>
                        <h3 class="drawer-name">${customer.full_name || 'Anonymous User'}</h3>
                        <span class="drawer-email-sub">${customer.email}</span>
                        <div style="margin-top: 0.25rem; display: flex; gap: 0.5rem; justify-content: center;">
                            <span class="pill" style="font-size: 0.65rem; background: ${planColor}15; color: ${planColor}; border: 1px solid ${planColor}40; padding: 2px 8px; border-radius: 20px;">${planName}</span>
                            <span class="pill" style="font-size: 0.65rem; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 2px 8px; border-radius: 20px;">${statusName}</span>
                        </div>
                    </div>
                    
                    <div class="drawer-card">
                        <div class="drawer-card-title">Contact Information</div>
                        <div class="drawer-info-row">
                            <span class="drawer-info-label">Phone Number</span>
                            <div class="drawer-info-value copyable" onclick="navigator.clipboard.writeText('${customer.phone || ''}').then(() => showCopyToast('Phone number copied!'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span>${customer.phone || 'No phone record'}</span>
                            </div>
                        </div>
                        <div class="drawer-info-row">
                            <span class="drawer-info-label">Customer Since</span>
                            <span class="drawer-info-value">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span>${creationDate}</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="drawer-card">
                        <div class="drawer-card-title">Telemetry & Conversion</div>
                        
                        <div class="drawer-metric-grid">
                            <div class="drawer-metric-box">
                                <div class="drawer-metric-val" style="color: var(--accent-blue);">${convictionVal}</div>
                                <div class="drawer-metric-lbl">Conviction</div>
                            </div>
                            <div class="drawer-metric-box">
                                <div class="drawer-metric-val" style="color: var(--accent-teal);">${evaluationVal}</div>
                                <div class="drawer-metric-lbl">Evaluation</div>
                            </div>
                            <div class="drawer-metric-box">
                                <div class="drawer-metric-val" style="color: var(--accent-red);">${frictionVal}</div>
                                <div class="drawer-metric-lbl">Friction</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="drawer-info-label">Conversion Probability</span>
                                <span class="prob-badge ${probClass}" style="font-size: 0.8rem; padding: 3px 10px;">${prob}%</span>
                            </div>
                            ${valueGapVal !== null ? `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="drawer-info-label">Value Gap</span>
                                <span style="font-weight: 600; color: var(--accent-orange); font-size: 0.9rem;">${valueGapVal}%</span>
                            </div>
                            ` : ''}
                            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <span class="drawer-info-label">Habit Classification</span>
                                <span style="font-size: 0.9rem; font-weight: 500;">${leadData.habit_classification || 'Occasional Visitor'}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <span class="drawer-info-label">Trigger Insight</span>
                                <span style="font-size: 0.85rem; line-height: 1.25rem; color: var(--text-primary); background: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border-left: 3px solid ${leadData.trigger_reason && (leadData.trigger_reason.includes('Upgrade') || leadData.trigger_reason.includes('Upsell')) ? 'var(--accent-teal)' : leadData.trigger_reason && (leadData.trigger_reason.includes('Churn') || leadData.trigger_reason.includes('Drop') || leadData.trigger_reason.includes('Risk')) ? 'var(--accent-red)' : 'var(--text-muted)'}; font-family: var(--font-sans);">
                                    ${leadData.trigger_reason || 'Routine Check-in: Stable usage pattern.'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                throw new Error(resData.message || "Failed to load customer profile details");
            }
        } catch (error) {
            console.error("Error loading customer profile:", error);
            drawerContent.innerHTML = `
                <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p style="font-size: 0.9rem; line-height: 1.4rem;">Could not fetch profile details for this customer.</p>
                    <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">Check backend log or try refreshing the dashboard.</p>
                </div>
            `;
        }
    }
    
    window.showCopyToast = function(msg) {
        let toast = document.getElementById('copyToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copyToast';
            toast.className = 'copy-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
});
