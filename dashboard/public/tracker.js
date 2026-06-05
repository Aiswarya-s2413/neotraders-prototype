// tracker.js - Drop-in event tracker script for neotraders prototypes

window.Tracker = {
    email: '',
    apiEndpoint: '/api/tracker-events',
    _autoTrackingSetup: false,

    // Initialize with the user's email ID
    init(email, endpoint) {
        this.email = email;
        if (endpoint) this.apiEndpoint = endpoint;
        console.log('Tracker initialized for user:', this.email);
        
        // Setup automatic click tracking for elements with an ID
        this.setupAutoTracking();
    },

    // Setup automatic click tracking for interactive elements with an HTML ID
    setupAutoTracking() {
        if (this._autoTrackingSetup) return;
        this._autoTrackingSetup = true;

        console.log('Tracker auto-tracking active: capturing clicks on elements with an "id" attribute.');
        document.addEventListener('click', (event) => {
            let target = event.target;
            while (target && target !== document) {
                if (target.id) {
                    const tagName = target.tagName.toLowerCase();
                    const elementId = target.id;
                    
                    // Identify interactive elements
                    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'form'];
                    const hasRoleButton = target.getAttribute('role') === 'button';
                    const isInteractive = interactiveTags.includes(tagName) || hasRoleButton || (window.getComputedStyle && window.getComputedStyle(target).cursor === 'pointer');
                    
                    if (isInteractive) {
                        this.track(
                            'element_clicked',
                            `Auto-tracked click on <${tagName}> with ID: "${elementId}"`,
                            { category_b: true },
                            elementId
                        );
                        break;
                    }
                }
                target = target.parentNode;
            }
        }, true); // Use capture phase to intercept click events early
    },

    // Fire event tracking (supports positional arguments or single object payload)
    track(eventName, notes = '', categories = {}, elementId = null) {
        if (!this.email) {
            console.error('Tracker Error: Tracker must be initialized with an email ID first using Tracker.init(email).');
            return Promise.reject('Tracker not initialized');
        }

        let payload = {};
        
        if (typeof eventName === 'object' && eventName !== null) {
            // Handle single object payload (like from the Angular Router integration example)
            const obj = eventName;
            const name = obj.name || (obj.subscription && obj.subscription.plan_name) || 'object_event';
            const notesStr = obj.notes || (obj.subscription ? `Plan: ${obj.subscription.plan_name}, Status: ${(obj.payment && obj.payment.status)}` : JSON.stringify(obj));
            const cat = {
                category_a: !!(obj.category_a || (obj.subscription && obj.subscription.plan_mode === 'navigation')),
                category_b: !!(obj.category_b || (obj.subscription && obj.subscription.plan_mode === 'plan')),
                category_c: !!obj.category_c
            };
            const elId = obj.element_id || obj.elementId || null;
            
            payload = {
                name: name,
                category_a: cat.category_a,
                category_b: cat.category_b,
                category_c: cat.category_c,
                notes: notesStr,
                element_id: elId
            };
        } else {
            payload = {
                name: eventName,
                category_a: !!categories.category_a,
                category_b: !!categories.category_b,
                category_c: !!categories.category_c,
                notes: notes || `Auto-tracked event via Tracker.js`,
                element_id: elementId || null
            };
        }

        console.log('Dispatching event via Tracker:', payload.name, payload);

        // Send event to backend API, passing the user's email ID in the headers
        return fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': this.email
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Event tracked successfully:', data);
            return data;
        })
        .catch(err => {
            console.error('Failed to track event:', err);
            throw err;
        });
    }
};
