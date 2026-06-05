document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const form = document.getElementById('sandboxForm');
    const nameInput = document.getElementById('eventName');
    const catA = document.getElementById('catA');
    const catB = document.getElementById('catB');
    const catC = document.getElementById('catC');
    const notesInput = document.getElementById('eventNotes');
    const elementIdInput = document.getElementById('elementId');
    const statusMessage = document.getElementById('statusMessage');
    
    const tbody = document.getElementById('eventsTableBody');
    const searchInput = document.getElementById('eventSearchInput');

    let allEvents = [];

    // Format ISO string to readable localized date string
    function formatTimestamp(isoStr) {
        if (!isoStr) return 'N/A';
        try {
            const date = new Date(isoStr);
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return isoStr;
        }
    }

    // Fetch captured events from backend
    async function loadEvents() {
        try {
            const response = await fetch('/api/test-events');
            const data = await response.json();
            
            if (data.status === 'success') {
                allEvents = data.data;
                renderTable(allEvents);
            } else {
                showError("Failed to fetch events from database: " + data.message);
            }
        } catch (error) {
            console.error("Error loading events:", error);
            showError("Network/Server connection error.");
        }
    }

    function renderTable(events) {
        tbody.innerHTML = '';
        
        if (events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 4rem;">No sandbox events found in database. Use the form to submit one!</td></tr>`;
            return;
        }

        events.forEach((event, index) => {
            const tr = document.createElement('tr');
            tr.className = 'table-row-animate';
            tr.style.animationDelay = `${0.05 + (index * 0.03)}s`;

            // Build categories list
            let badgesHtml = '';
            if (event.category_a) badgesHtml += `<span class="category-badge badge-a">Auth</span>`;
            if (event.category_b) badgesHtml += `<span class="category-badge badge-b">Intent</span>`;
            if (event.category_c) badgesHtml += `<span class="category-badge badge-c">Alert</span>`;
            
            if (!badgesHtml) {
                badgesHtml = `<span class="category-badge badge-none">None</span>`;
            }

            tr.innerHTML = `
                <td><strong style="color: var(--accent-purple)">#${event.id}</strong></td>
                <td><strong>${escapeHtml(event.name)}</strong></td>
                <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${badgesHtml}</div></td>
                <td style="font-family: monospace; color: var(--accent-orange, #ff9f43); font-size: 0.9rem;">
                    ${event.element_id ? escapeHtml(event.element_id) : '<span style="color: var(--text-secondary)">N/A</span>'}
                </td>
                <td style="color: rgba(255,255,255,0.7); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(event.notes || '')}">
                    ${escapeHtml(event.notes || 'No description')}
                </td>
                <td style="font-size: 0.85rem; color: var(--text-secondary);">${formatTimestamp(event.created_at)}</td>
            `;
            tbody.appendChild(tr);
        });
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

    // Submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            name: nameInput.value.trim(),
            category_a: catA.checked,
            category_b: catB.checked,
            category_c: catC.checked,
            element_id: elementIdInput.value.trim() || null,
            notes: notesInput.value.trim() || null
        };

        showStatus("Dispatching event to database...", "info");

        try {
            const response = await fetch('/api/test-events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (data.status === 'success') {
                showStatus("Event successfully captured in database!", "success");
                // Reset form fields
                form.reset();
                // Reload DB records
                await loadEvents();
            } else {
                showStatus("Error: " + data.message, "error");
            }
        } catch (error) {
            console.error("Submission failed:", error);
            showStatus("Server submission failed. Ensure server is online.", "error");
        }
    });

    // Search filter
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allEvents.filter(event => 
            event.name.toLowerCase().includes(term) ||
            (event.notes && event.notes.toLowerCase().includes(term)) ||
            event.id.toString().includes(term)
        );
        renderTable(filtered);
    });

    // Helper to display submission status messages
    function showStatus(msg, type) {
        statusMessage.textContent = msg;
        statusMessage.className = 'status-message'; // Clear types
        statusMessage.style.display = 'block';

        if (type === 'success') {
            statusMessage.classList.add('status-success');
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        } else if (type === 'error') {
            statusMessage.classList.add('status-error');
        } else {
            // Loading/Info state style
            statusMessage.style.background = 'rgba(255,255,255,0.05)';
            statusMessage.style.color = 'white';
            statusMessage.style.border = '1px solid var(--border-glass)';
        }
    }

    // Display backend errors inside table
    function showError(msg) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-red); padding: 4rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 10px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><br>
            ${msg}
        </td></tr>`;
    }

    // Initialization
    loadEvents();
});
