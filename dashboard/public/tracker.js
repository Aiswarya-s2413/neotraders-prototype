// tracker.js - Drop-in event tracker script for neotraders prototypes

window.Tracker = {
    email: '',
    apiEndpoint: (function() {
        if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
            try {
                const url = new URL(document.currentScript.src);
                return `${url.origin}/api/tracker-events`;
            } catch (e) {}
        }
        return '/api/tracker-events';
    })(),
    _autoTrackingSetup: false,
    _routeTrackingSetup: false,

    // Initialize with the user's email ID
    init(email, endpoint) {
        this.email = email;
        if (endpoint) this.apiEndpoint = endpoint;
        console.log('Tracker initialized for user:', this.email);
        
        // Setup automatic click tracking for elements with an ID
        this.setupAutoTracking();
        // Setup automatic SPA page tracking
        this.setupRouteTracking();
    },

    // Setup automatic route/page tracking for SPAs
    setupRouteTracking() {
        if (this._routeTrackingSetup) return;
        this._routeTrackingSetup = true;

        const trackPageVisit = () => {
            if (!this.email) {
                this.detectUser();
            }
            if (this.email) {
                this.track('page_visited', `User navigated to: ${window.location.pathname}${window.location.search}`, {
                    category_a: true
                }).catch(() => {});
            }
        };

        // Track current page on route tracking setup
        trackPageVisit();

        // Intercept pushState
        const originalPushState = history.pushState;
        if (originalPushState) {
            history.pushState = function() {
                originalPushState.apply(this, arguments);
                trackPageVisit();
            };
        }

        // Intercept replaceState
        const originalReplaceState = history.replaceState;
        if (originalReplaceState) {
            history.replaceState = function() {
                originalReplaceState.apply(this, arguments);
                trackPageVisit();
            };
        }

        window.addEventListener('popstate', trackPageVisit);
        window.addEventListener('hashchange', trackPageVisit);
    },

    // Setup automatic click tracking for interactive elements with an HTML ID
    setupAutoTracking() {
        if (this._autoTrackingSetup) return;
        this._autoTrackingSetup = true;

        console.log('Tracker auto-tracking active: capturing clicks on elements with an "id" attribute.');
        document.addEventListener('click', (event) => {
            // Fallback: dynamic detection on click in case email element loaded later
            if (!this.email) {
                this.detectUser();
            }

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
                        ).catch(() => {});
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
    },

    // Detect user email dynamically from browser storage or DOM
    detectUser() {
        if (this.email) return true;

        // 1. Try to read from standard localStorage / sessionStorage keys
        const storageKeys = ['user_email', 'email', 'user', 'currentUser'];
        for (const key of storageKeys) {
            try {
                const val = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (val && val.includes('@')) {
                    this.init(val.trim());
                    console.log('Tracker auto-detected user from browser storage:', val);
                    return true;
                }
            } catch (e) {}
        }

        // 2. Try to read from standard DOM element selectors (like the display ID they provide)
        const selectors = [
            '#user-email-display',
            '.user-email-display',
            '#username',
            '.username',
            '.user-email',
            '.user-profile-name',
            '#user-profile-email'
        ];
        
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                if (text && text.includes('@')) {
                    this.init(text);
                    console.log('Tracker auto-detected user from DOM (' + selector + '):', text);
                    return true;
                }
            }
        }
        return false;
    }
};

// Automatically attempt to detect logged-in users on load (zero-code integration support)
window.addEventListener('DOMContentLoaded', () => {
    // Set up auto click tracking immediately so that click events are captured even before login
    window.Tracker.setupAutoTracking();

    let checkAttempts = 0;
    const maxAttempts = 20; // Check periodically for up to 10 seconds

    const autoDetectUser = () => {
        if (window.Tracker.detectUser()) return; // Successfully detected

        // Retry in case Angular is still rendering elements
        checkAttempts++;
        if (checkAttempts < maxAttempts) {
            setTimeout(autoDetectUser, 500);
        }
    };

    autoDetectUser();
});

