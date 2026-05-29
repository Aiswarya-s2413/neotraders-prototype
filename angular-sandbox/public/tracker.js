// tracker.js - Drop-in event tracker script for neotraders prototypes

window.Tracker = {
    email: '',
    apiEndpoint: '/api/test-events',

    // Initialize with the user's email ID
    init(email, endpoint) {
        this.email = email;
        if (endpoint) this.apiEndpoint = endpoint;
        console.log('Tracker initialized for user:', this.email);
    },

    // Fire event tracking
    track(eventName, notes = '', categories = {}) {
        if (!this.email) {
            console.error('Tracker Error: Tracker must be initialized with an email ID first using Tracker.init(email).');
            return;
        }

        const payload = {
            name: eventName,
            category_a: !!categories.category_a,
            category_b: !!categories.category_b,
            category_c: !!categories.category_c,
            notes: notes || `Auto-tracked event via Tracker.js`
        };

        console.log('Dispatching event via Tracker:', eventName, payload);

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
