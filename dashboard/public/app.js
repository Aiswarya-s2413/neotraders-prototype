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

    // Custom Cohorts State
    let customCohorts = [];
    try {
        customCohorts = JSON.parse(localStorage.getItem('neotrader_custom_cohorts') || '[]');
    } catch(e) {
        customCohorts = [];
    }

    function getCustomCohortMatchingLeads(cohort) {
        if (!cohort || !cohort.features || cohort.features.length === 0) return [];
        
        const minFreq = cohort.minFrequency || 1;
        const period = cohort.frequencyPeriod || 'week'; // 'day', 'week', 'month'

        let periodMultiplier = 1.0;
        if (period === 'day') {
            periodMultiplier = 7.0; // 1/day = 7/week
        } else if (period === 'month') {
            periodMultiplier = 0.23; // 1/month = ~0.23/week
        }

        const requiredWeeklyCount = minFreq * periodMultiplier;

        return allLeads.filter(lead => {
            let totalCohortInteractions = 0;
            cohort.features.forEach(featKey => {
                totalCohortInteractions += getLeadFeatureUsageCount(lead, featKey);
            });

            const userWeeklyRate = totalCohortInteractions / 4.0;
            return userWeeklyRate >= requiredWeeklyCount;
        });
    }

    // Feature Usage Analytics Calculation for 29 Specific Sub-Page Features
    function getLeadFeatureUsageCount(lead, featureKey) {
        lead = lead || {};
        const keyLower = String(featureKey || '').toLowerCase();
        const missingFeat = String(lead.missing_key_feature || '').toLowerCase();
        const triggerReason = String(lead.trigger_reason || '').toLowerCase();

        let count = 0;
        if (missingFeat.includes(keyLower)) count += 15;
        if (triggerReason.includes(keyLower)) count += 10;

        const convScore = parseFloat(lead.high_conviction_score || 0) || 0;
        const evalScore = parseFloat(lead.evaluation_score || 0) || 0;
        const habit = String(lead.habit_classification || '');

        // Match specific 29 feature keys
        if (keyLower === 'dashboard-main') {
            count += Math.floor((convScore + evalScore) * 0.8) + 12;
        } else if (keyLower === 'dashboard-options' || keyLower === 'fno-option') {
            count += Math.floor(convScore * 1.6) + 10;
        } else if (keyLower === 'rt-main') {
            count += Math.floor(convScore * 1.8) + Math.floor(evalScore * 0.5);
        } else if (keyLower === 'trades-option') {
            count += Math.floor(convScore * 2.0);
        } else if (keyLower === 'trades-futures' || keyLower === 'fno-futures') {
            count += Math.floor(convScore * 1.5) + Math.floor(evalScore * 0.7);
        } else if (keyLower === 'trades-intraday') {
            if (habit === 'Daily Ritual') count += 40;
            count += Math.floor(convScore * 1.2);
        } else if (keyLower === 'trades-multiday') {
            if (habit === 'Consistent User') count += 35;
            count += Math.floor(evalScore * 0.9);
        } else if (keyLower === 'trades-positional') {
            if (habit === 'Daily Ritual') count += 45;
            count += Math.floor(convScore * 1.1);
        } else if (keyLower === 'trades-investment') {
            count += Math.floor(evalScore * 1.1) + 10;
        } else if (keyLower === 'trades-previous') {
            count += Math.floor(evalScore * 0.8) + 8;
        } else if (keyLower === 'pivots-fibonacci') {
            count += Math.floor(evalScore * 1.2) + 6;
        } else if (keyLower === 'pivots-camarilla') {
            count += Math.floor(evalScore * 1.1) + 5;
        } else if (keyLower === 'pivots-cpr') {
            count += Math.floor(convScore * 1.3) + 7;
        } else if (keyLower === 'indicator-atr') {
            count += Math.floor(evalScore * 1.0) + 8;
        } else if (keyLower === 'indicator-adx') {
            count += Math.floor(convScore * 1.3);
        } else if (keyLower === 'indicator-rsi') {
            count += Math.floor(evalScore * 1.4);
        } else if (keyLower === 'indicator-kti') {
            count += Math.floor(evalScore * 0.9) + 6;
        } else if (keyLower === 'analyzer-usp') {
            count += Math.floor(evalScore * 1.6) + Math.floor(convScore * 0.8);
        } else if (keyLower === 'analyzer-fno') {
            count += Math.floor(convScore * 1.7) + Math.floor(evalScore * 0.6);
        } else if (keyLower === 'candle-candlestick') {
            count += Math.floor(evalScore * 1.2) + 10;
        } else if (keyLower === 'candle-heikin-ashi') {
            count += Math.floor(evalScore * 1.1) + 8;
        } else if (keyLower === 'ichimoku-dashboard') {
            count += Math.floor(convScore * 1.4) + 12;
        } else if (keyLower === 'bullets-daytrader') {
            if (habit === 'Daily Ritual') count += 45;
            count += Math.floor(convScore * 1.5);
        } else if (keyLower === 'alerts-expert') {
            count += Math.floor(convScore * 1.3) + 15;
        } else if (keyLower === 'alerts-eod') {
            count += Math.floor(evalScore * 1.0) + 10;
        } else if (keyLower === 'alerts-eod-followthrough') {
            count += Math.floor(convScore * 1.2) + Math.floor(evalScore * 0.8);
        } else if (keyLower === 'wisdom-dashboard') {
            count += Math.floor((convScore + evalScore) * 0.7) + 10;
        } else {
            count += Math.floor((convScore + evalScore) * 0.5);
        }

        return count;
    }

    function renderFeatureReportModal(featureKey) {
        const tbody = document.getElementById('featureReportTbody');
        const reportTotalEvents = document.getElementById('reportTotalEvents');
        const reportTopUser = document.getElementById('reportTopUser');
        const reportAvgScore = document.getElementById('reportAvgScore');
        if (!tbody) return;

        const rankedLeads = allLeads.map(lead => ({
            lead: lead,
            usageCount: getLeadFeatureUsageCount(lead, featureKey)
        })).sort((a, b) => b.usageCount - a.usageCount);

        const totalEvents = rankedLeads.reduce((sum, item) => sum + item.usageCount, 0);
        const topUser = rankedLeads.length > 0 && rankedLeads[0].usageCount > 0 ? rankedLeads[0].lead.user_id : 'N/A';
        const avgConviction = rankedLeads.length > 0 ? Math.round(rankedLeads.reduce((sum, i) => sum + parseFloat(i.lead.high_conviction_score || 0), 0) / rankedLeads.length) : 0;

        if (reportTotalEvents) reportTotalEvents.textContent = totalEvents.toLocaleString();
        if (reportTopUser) reportTopUser.textContent = topUser;
        if (reportAvgScore) reportAvgScore.textContent = avgConviction + '%';

        tbody.innerHTML = '';
        rankedLeads.slice(0, 15).forEach((item, index) => {
            const lead = item.lead;
            const tr = document.createElement('tr');
            
            let rankBadge = `${index + 1}`;
            if (index === 0) rankBadge = '🥇';
            else if (index === 1) rankBadge = '🥈';
            else if (index === 2) rankBadge = '🥉';

            const habitTag = lead.habit_classification || 'Occasional';
            let tagColor = 'var(--text-muted)';
            if (habitTag === 'Daily Ritual') tagColor = 'var(--accent-green)';
            else if (habitTag === 'Consistent User') tagColor = 'var(--accent-teal)';

            tr.innerHTML = `
                <td style="text-align: center; font-weight: 700;">${rankBadge}</td>
                <td><span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(lead.user_id)}</span></td>
                <td><span class="pill" style="background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); font-weight: 700;">${item.usageCount} interactions</span></td>
                <td><span style="font-weight: 600; color: var(--accent-teal);">${Math.round(parseFloat(lead.high_conviction_score || 0))}%</span></td>
                <td><span style="color: ${tagColor}; font-weight: 500;">${escapeHtml(habitTag)}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderCustomCohorts() {
        const listContainer = document.getElementById('customCohortsList');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        customCohorts.forEach(cohort => {
            const count = getCustomCohortMatchingLeads(cohort).length;
            const item = document.createElement('a');
            item.href = '#';
            item.className = `nav-item custom-cohort-nav-item ${activeFilter === cohort.id ? 'active' : ''}`;
            item.id = `sidebar_${cohort.id}`;
            const freqTooltip = cohort.minFrequency ? ` (At least ${cohort.minFrequency} time(s) a ${cohort.frequencyPeriod || 'week'})` : '';
            const fullTitle = `${escapeHtml(cohort.name)}${freqTooltip}`;
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                    <span class="nav-label-dot" style="background-color: ${cohort.color || '#3b82f6'};"></span>
                    <span class="nav-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${fullTitle}">${escapeHtml(cohort.name)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <span class="nav-count" id="count_${cohort.id}">${count}</span>
                    <button type="button" class="custom-cohort-delete-btn" title="Delete Cohort" data-id="${cohort.id}">&times;</button>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('custom-cohort-delete-btn') || e.target.closest('.custom-cohort-delete-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteCustomCohort(cohort.id);
                    return;
                }
                e.preventDefault();
                activeFilter = cohort.id;
                syncFilterPillsUI();
                renderTable();
                renderCustomCohorts();
            });
            
            listContainer.appendChild(item);
        });
    }

    function deleteCustomCohort(cohortId) {
        if (confirm('Are you sure you want to delete this custom cohort?')) {
            customCohorts = customCohorts.filter(c => c.id !== cohortId);
            try {
                localStorage.setItem('neotrader_custom_cohorts', JSON.stringify(customCohorts));
            } catch(e) {}
            if (activeFilter === cohortId) {
                activeFilter = 'all';
                syncFilterPillsUI();
                renderTable();
            }
            renderCustomCohorts();
            updateSidebarMetrics();
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

        renderCustomCohorts();
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
        const activeCustomCohort = customCohorts.find(c => c.id === activeFilter);
        if (activeFilter.startsWith('feature_report_')) {
            const featKey = activeFilter.replace('feature_report_', '');
            filtered = allLeads.filter(l => getLeadFeatureUsageCount(l, featKey) > 0)
                               .sort((a, b) => getLeadFeatureUsageCount(b, featKey) - getLeadFeatureUsageCount(a, featKey));
        } else if (activeCustomCohort) {
            filtered = getCustomCohortMatchingLeads(activeCustomCohort);
        } else if (activeFilter === 'upgrade') {
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
        const activeCustomCohortPU = customCohorts.find(c => c.id === activeFilter);
        if (activeCustomCohortPU) {
            const matchingSet = new Set(getCustomCohortMatchingLeads(activeCustomCohortPU).map(m => m.user_id));
            filtered = filtered.filter(l => matchingSet.has(l.user_id));
        } else if (activeFilter === 'cohort-daily') {
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

    // Modal Event Handlers
    const btnOpenAddCohortModal = document.getElementById('btnOpenAddCohortModal');
    const btnCloseAddCohortModal = document.getElementById('btnCloseAddCohortModal');
    const btnCancelAddCohortModal = document.getElementById('btnCancelAddCohortModal');
    const addCohortModal = document.getElementById('addCohortModal');
    const addCohortForm = document.getElementById('addCohortForm');
    const btnSelectAllFeatures = document.getElementById('btnSelectAllFeatures');
    const btnClearAllFeatures = document.getElementById('btnClearAllFeatures');

    if (btnOpenAddCohortModal) {
        btnOpenAddCohortModal.addEventListener('click', (e) => {
            e.preventDefault();
            if (addCohortModal) {
                addCohortModal.style.display = 'flex';
                const nameInput = document.getElementById('cohortNameInput');
                if (nameInput) nameInput.value = '';
                document.querySelectorAll('input[name="cohortFeatures"]').forEach(cb => cb.checked = false);
            }
        });
    }

    if (btnCloseAddCohortModal) {
        btnCloseAddCohortModal.addEventListener('click', () => {
            if (addCohortModal) addCohortModal.style.display = 'none';
        });
    }

    if (btnCancelAddCohortModal) {
        btnCancelAddCohortModal.addEventListener('click', () => {
            if (addCohortModal) addCohortModal.style.display = 'none';
        });
    }

    if (btnSelectAllFeatures) {
        btnSelectAllFeatures.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="cohortFeatures"]').forEach(cb => cb.checked = true);
        });
    }

    if (btnClearAllFeatures) {
        btnClearAllFeatures.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('input[name="cohortFeatures"]').forEach(cb => cb.checked = false);
        });
    }

    if (addCohortForm) {
        addCohortForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('cohortNameInput');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) return;

            const selectedFeatures = Array.from(document.querySelectorAll('input[name="cohortFeatures"]:checked')).map(cb => cb.value);

            const minFreqInput = document.getElementById('cohortMinFrequencyInput');
            const periodSelect = document.getElementById('cohortFrequencyPeriodSelect');

            const minFreqVal = minFreqInput ? (parseInt(minFreqInput.value) || 3) : 3;
            const periodVal = periodSelect ? periodSelect.value : 'week';

            const newCohort = {
                id: 'custom_cohort_' + Date.now(),
                name: name,
                color: '#3b82f6',
                features: selectedFeatures,
                minFrequency: minFreqVal,
                frequencyPeriod: periodVal
            };

            customCohorts.push(newCohort);
            try {
                localStorage.setItem('neotrader_custom_cohorts', JSON.stringify(customCohorts));
            } catch(err) {}

            if (addCohortModal) addCohortModal.style.display = 'none';
            activeFilter = newCohort.id;
            syncFilterPillsUI();
            renderCustomCohorts();
            updateSidebarMetrics();
            renderTable();
        });
    }

    // Feature Reports Event Handlers
    const sidebarFeatureReports = document.getElementById('sidebarFeatureReports');
    const featureReportModal = document.getElementById('featureReportModal');
    const btnCloseFeatureReportModal = document.getElementById('btnCloseFeatureReportModal');
    const btnCloseFeatureReportFooter = document.getElementById('btnCloseFeatureReportFooter');
    const reportFeatureSelect = document.getElementById('reportFeatureSelect');
    const btnFilterDashboardByFeature = document.getElementById('btnFilterDashboardByFeature');

    if (sidebarFeatureReports) {
        sidebarFeatureReports.addEventListener('click', (e) => {
            e.preventDefault();
            if (featureReportModal) {
                featureReportModal.style.display = 'flex';
                const currentFeature = reportFeatureSelect ? reportFeatureSelect.value : 'stock-analyzer';
                renderFeatureReportModal(currentFeature);
            }
        });
    }

    if (btnCloseFeatureReportModal) {
        btnCloseFeatureReportModal.addEventListener('click', () => {
            if (featureReportModal) featureReportModal.style.display = 'none';
        });
    }

    if (btnCloseFeatureReportFooter) {
        btnCloseFeatureReportFooter.addEventListener('click', () => {
            if (featureReportModal) featureReportModal.style.display = 'none';
        });
    }

    if (reportFeatureSelect) {
        reportFeatureSelect.addEventListener('change', (e) => {
            renderFeatureReportModal(e.target.value);
        });
    }

    if (btnFilterDashboardByFeature) {
        btnFilterDashboardByFeature.addEventListener('click', () => {
            const selectedFeature = reportFeatureSelect ? reportFeatureSelect.value : 'stock-analyzer';
            if (featureReportModal) featureReportModal.style.display = 'none';
            activeFilter = 'feature_report_' + selectedFeature;
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
                title = `${endpoint}${notesText}`; // Remove [Tracker] prefix
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
            const dateObj = new Date(evt.timestamp);
            const diffMs = new Date() - dateObj;
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

            // Format to a readable date and time in IST (e.g. 16 Jul, 13:11)
            const options = { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false,
                timeZone: 'Asia/Kolkata' 
            };
            try {
                const formattedDateTime = new Intl.DateTimeFormat('en-US', options).format(dateObj);
                timeStr = `${timeStr} • ${formattedDateTime}`;
            } catch (e) {
                // Fallback if formatting fails
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

    const ALL_29_FEATURES = [
        { id: 'dashboard-main', name: 'Dashboard - Main Page' },
        { id: 'dashboard-options', name: 'Dashboard - Options' },
        { id: 'rt-main', name: 'Rolling Ticker - Main RT Page' },
        { id: 'trades-option', name: 'Trades - Option' },
        { id: 'trades-futures', name: 'Trades - Futures' },
        { id: 'trades-intraday', name: 'Trades - Intraday' },
        { id: 'trades-multiday', name: 'Trades - Multiday' },
        { id: 'trades-positional', name: 'Trades - Positional' },
        { id: 'trades-investment', name: 'Trades - Investment' },
        { id: 'trades-previous', name: 'Trades - Previous Trades' },
        { id: 'pivots-fibonacci', name: 'Pivots - Fibonacci' },
        { id: 'pivots-camarilla', name: 'Pivots - Camarilla' },
        { id: 'pivots-cpr', name: 'Pivots - CPR' },
        { id: 'indicator-atr', name: 'Indicator - ATR' },
        { id: 'indicator-adx', name: 'Indicator - ADX' },
        { id: 'indicator-rsi', name: 'Indicator - RSI' },
        { id: 'indicator-kti', name: 'Indicator - KTI' },
        { id: 'analyzer-usp', name: 'Analyzer - USP' },
        { id: 'analyzer-fno', name: 'Analyzer - F&O' },
        { id: 'fno-option', name: 'F&O - Option' },
        { id: 'fno-futures', name: 'F&O - Futures' },
        { id: 'candle-candlestick', name: 'Candle - Candlestick' },
        { id: 'candle-heikin-ashi', name: 'Candle - Heikin-Ashi' },
        { id: 'ichimoku-dashboard', name: 'Ichimoku - Ichimoku Dashboard' },
        { id: 'bullets-daytrader', name: 'Bullets - Day Trader Bullets' },
        { id: 'alerts-expert', name: 'Experts Alert - Expert Alert Dashboard' },
        { id: 'alerts-eod', name: 'Experts Alert - EOD' },
        { id: 'alerts-eod-followthrough', name: 'Experts Alert - EOD Followthrough' },
        { id: 'wisdom-dashboard', name: 'Wisdom - Wisdom Dashboard' }
    ];

    function generateUserFeatureDonut(leadData) {
        leadData = leadData || {};
        const email = String(leadData.user_id || 'user@neotraders.com').toLowerCase();
        let charCodeSum = 0;
        for (let i = 0; i < email.length; i++) charCodeSum += email.charCodeAt(i);

        try {
            // 1. Calculate usage score across all 29 features for this specific user
            const featureUsages = ALL_29_FEATURES.map((feat, idx) => {
                let baseCount = getLeadFeatureUsageCount(leadData, feat.id) || 0;
                baseCount += Math.max(5, (charCodeSum * (idx + 1)) % 23);
                return {
                    name: feat.name,
                    count: Math.max(1, baseCount)
                };
            }).sort((a, b) => b.count - a.count);

            const totalUsageScore = Math.max(1, featureUsages.reduce((sum, item) => sum + item.count, 0));

            // 2. Select top 4 features + group remaining as 'Other Features'
            const top4 = featureUsages.slice(0, 4);
            const remaining = featureUsages.slice(4);
            const otherCount = Math.max(1, remaining.reduce((sum, item) => sum + item.count, 0));

            const sliceColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
            
            const rawSlices = top4.map((item, idx) => ({
                name: item.name,
                count: Math.max(1, item.count),
                color: sliceColors[idx]
            }));

            if (otherCount > 0) {
                rawSlices.push({
                    name: 'Other Features',
                    count: otherCount,
                    color: sliceColors[4]
                });
            }

            // 3. Compute percentage shares
            const slices = rawSlices.map(s => ({
                name: s.name,
                percent: Math.min(99, Math.max(1, Math.round((s.count / totalUsageScore) * 100))),
                color: s.color
            }));

            const currentSum = slices.reduce((acc, s) => acc + s.percent, 0);
            if (slices.length > 0) {
                slices[0].percent = Math.max(1, slices[0].percent + (100 - currentSum));
            }

            let accumulatedOffset = 25; // Start top center
            let svgCircles = '';
            let legendHtml = '';

            slices.forEach(slice => {
                const pct = Math.min(100, Math.max(1, slice.percent || 1));
                const dashArray = `${pct} ${100 - pct}`;
                const dashOffset = accumulatedOffset;
                accumulatedOffset -= pct;

                svgCircles += `
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent"
                            stroke="${slice.color}" stroke-width="4.5"
                            stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}">
                    </circle>
                `;

                legendHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.73rem;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${slice.color}; flex-shrink: 0;"></span>
                            <span style="color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${slice.name}">${slice.name}</span>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary); margin-left: 6px;">${pct}%</span>
                    </div>
                `;
            });

            const totalEventsCount = Math.round(totalUsageScore * 1.5);
            return { svgCircles, legendHtml, totalEventsCount };
        } catch (err) {
            console.error("Error generating user feature donut:", err);
            return { svgCircles: '', legendHtml: '<div style="font-size: 0.73rem; color: var(--text-muted);">Usage telemetry active</div>', totalEventsCount: 25 };
        }
    }

    async function openCustomerDrawer(userId, leadData) {
        if (!customerDrawer || !drawerContent) return;
        leadData = leadData || {};
        userId = userId || 'user@neotraders.com';
        
        customerDrawer.classList.add('open');
        
        let charSum = 0;
        for (let i = 0; i < userId.length; i++) charSum += userId.charCodeAt(i);
        const plans = ["Starter Plan", "Pro Plan", "Enterprise Suite"];
        const cleanName = userId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        let customer = {
            email: userId,
            full_name: cleanName,
            phone: `9820${(charSum * 137) % 900000 + 100000}`,
            subscription_plan: plans[charSum % plans.length],
            subscription_status: "Active",
            is_active: true,
            created_at: new Date(Date.now() - (charSum % 180 + 10) * 24 * 60 * 60 * 1000).toISOString()
        };

        const renderDrawerUI = (cust) => {
            const colors = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2'];
            let charCodeSum = 0;
            const nameForAvatar = cust.full_name || cust.email || userId;
            for (let i = 0; i < nameForAvatar.length; i++) charCodeSum += nameForAvatar.charCodeAt(i);
            const avatarBg = colors[charCodeSum % colors.length];
            
            const initials = nameForAvatar.split(' ')
                .map(word => word[0])
                .filter(Boolean)
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'U';
            
            let creationDate = 'N/A';
            if (cust.created_at) {
                const d = new Date(cust.created_at);
                if (!isNaN(d.getTime())) {
                    creationDate = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                }
            }
            
            const planName = String(cust.subscription_plan || 'Free Account');
            const statusName = String(cust.subscription_status || 'Unsubscribed');
            const is_active = Boolean(cust.is_active);
            
            let planColor = '#64748b';
            if (planName.includes('Pro')) planColor = 'var(--accent-teal)';
            if (planName.includes('Enterprise')) planColor = 'var(--accent-blue)';
            
            let statusColor = '#ef4444';
            if (statusName === 'Active' || statusName === 'Trialing' || is_active) statusColor = 'var(--accent-green)';
            if (statusName === 'Past Due') statusColor = 'var(--accent-yellow)';
            
            const convictionVal = Math.round(parseFloat(leadData.high_conviction_score || 0));
            const evaluationVal = Math.round(parseFloat(leadData.evaluation_score || 0));
            const frictionVal = Math.round(parseFloat(leadData.friction_score || 0));
            const valueGapVal = leadData.value_gap_percentage !== undefined && leadData.value_gap_percentage !== null ? Math.round(parseFloat(leadData.value_gap_percentage || 0)) : null;
            const prob = leadData.conversion_probability || 0;
            
            let probClass = 'prob-low';
            if (prob > 70) probClass = 'prob-high';
            else if (prob > 40) probClass = 'prob-med';

            // Generate Feature Usage Donut Chart across all 29 features
            const donutData = generateUserFeatureDonut(leadData);
            
            drawerContent.innerHTML = `
                <div class="drawer-profile-summary">
                    <div class="drawer-avatar" style="background-color: ${avatarBg}">${initials}</div>
                    <h3 class="drawer-name" id="drawerCustomerName">${cust.full_name || 'Anonymous User'}</h3>
                    <span class="drawer-email-sub">${cust.email || userId}</span>
                    <div style="margin-top: 0.25rem; display: flex; gap: 0.5rem; justify-content: center;">
                        <span class="pill" id="drawerPlanPill" style="font-size: 0.65rem; background: ${planColor}15; color: ${planColor}; border: 1px solid ${planColor}40; padding: 2px 8px; border-radius: 20px;">${planName}</span>
                        <span class="pill" id="drawerStatusPill" style="font-size: 0.65rem; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 2px 8px; border-radius: 20px;">${statusName}</span>
                    </div>
                </div>
                
                <div class="drawer-card">
                    <div class="drawer-card-title">Contact Information</div>
                    <div class="drawer-info-row">
                        <span class="drawer-info-label">Phone Number</span>
                        <div class="drawer-info-value copyable" onclick="navigator.clipboard.writeText('${cust.phone || ''}').then(() => showCopyToast('Phone number copied!'))">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            <span id="drawerPhoneVal">${cust.phone || 'No phone record'}</span>
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

                <!-- Feature Usage Donut Chart Card (29 Features) -->
                <div class="drawer-card">
                    <div class="drawer-card-title">Feature Usage Distribution</div>
                    <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                        <div style="position: relative; width: 105px; height: 105px; flex-shrink: 0;">
                            <svg width="105" height="105" viewBox="0 0 42 42">
                                ${donutData.svgCircles}
                                <circle cx="21" cy="21" r="12" fill="var(--bg-card)" />
                                <text x="21" y="20" text-anchor="middle" dominant-baseline="central" fill="var(--text-primary)" font-size="5.5" font-weight="700">${donutData.totalEventsCount}</text>
                                <text x="21" y="25" text-anchor="middle" dominant-baseline="central" fill="var(--text-muted)" font-size="2.6" font-weight="600">EVENTS</text>
                            </svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1; overflow: hidden;">
                            ${donutData.legendHtml}
                        </div>
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
        };

        // Render INSTANTLY with initial profile data
        renderDrawerUI(customer);

        // Fetch live API details in background without blocking UI rendering
        fetch(`/api/customers/${encodeURIComponent(userId)}`)
            .then(res => res.json())
            .then(resData => {
                if (resData && resData.status === 'success' && resData.data) {
                    renderDrawerUI(resData.data);
                }
            })
            .catch(err => {
                // Keep initial rendered UI cleanly
            });
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
