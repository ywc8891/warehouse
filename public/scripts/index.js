// public/scripts/index.js

// Import shared modules
import { auth } from './firebase-init.js';
import { handleGoogleSignIn, handleSignOut } from './auth.js';
// import { updateUIForSignedInUser, updateUIForSignedOutUser } from './ui.js';

// Import page-specific modules
import { clearInput, playSound } from './utils.js';
import { couriers, regex, API_URL } from './constants.js';

// Import Bootstrap JavaScript
import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js';

let shopeeHandler, posHandler;

// Initialize Bootstrap modals (if used on this page)
let selectCourierModal;
let selectCourierManualModal;

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded'); // Debug log

    // Check if the modal elements exist
    const ambiguousCourierModalElement = document.querySelector("#selectAmbiguousCourier");
    const courierModalElement = document.querySelector("#selectCourier");

    // Initialize modals only if the elements exist
    if (ambiguousCourierModalElement) {
        selectCourierModal = new bootstrap.Modal(ambiguousCourierModalElement);
        console.log('selectCourierModal initialized'); // Debug log
    }

    if (courierModalElement) {
        selectCourierManualModal = new bootstrap.Modal(courierModalElement);
        console.log('selectCourierManualModal initialized'); // Debug log
    }

    // Set up event listeners for authentication
    const signInButton = document.getElementById('signInButton');
    const signOutButton = document.getElementById('signOutButton');

    if (signInButton) {
        signInButton.addEventListener('click', handleGoogleSignIn);
    }

    if (signOutButton) {
        signOutButton.addEventListener('click', handleSignOut);
    }

    // Set up event listeners for form submission
    const form = document.getElementById('inputForm');
    if (form) {
        form.addEventListener('submit', submit); // Form submission handler
    }
});


export async function submit(e) {
    e.preventDefault();

    const trackingNumber = document.getElementById('trackingNumberInput').value;

    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
        console.error('User not signed in');
        // You might want to show a sign-in prompt here
        alert('Please sign in to use this feature');
        return;
    }

    try {
        // Get the ID token for the authenticated user
        const idToken = await user.getIdToken(true);
        console.log(idToken)

        if (regex.test(trackingNumber)) {
            selectCourierModal.show();
            courierSelectionHandlerSetup(trackingNumber);
        } else {
            console.log(JSON.stringify({ trackingNumber }));
            
            // Call Firebase Cloud Function with authentication
            const response = await fetch(`${API_URL}/categorise`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` // Add the auth token
                },
                body: JSON.stringify({ trackingNumber }),
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                logInput(trackingNumber, result.courier);
                playSound();
            }
            else {
                throw new Error(result.message);
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
        manualSelectHandlerSetup(trackingNumber);
    }

    clearInput();
}

export function courierSelectionHandlerSetup(trackingNumber) {
    shopeeHandler = courierSelectionHandler(trackingNumber, 'Shopee Express');
    posHandler = courierSelectionHandler(trackingNumber, 'POS Malaysia');
    document.getElementById('selectedShopee').addEventListener('click', shopeeHandler);
    document.getElementById('selectedPos').addEventListener('click', posHandler);
}

export async function courierSelectionHandler(trackingNumber, selectedCourier) {
    return async function curried_func(e) {
        courierSelectionHandlerRemove();
        selectCourierModal.hide();
        // Call Firebase Cloud Function instead of google.script.run
        await logInput(trackingNumber, selectedCourier);
        playSound();
        clearInput();
    };
}

export function courierSelectionHandlerRemove() {
    document.getElementById('selectedShopee').removeEventListener('click', shopeeHandler);
    document.getElementById('selectedPos').removeEventListener('click', posHandler);
}

export function manualSelectHandlerSetup(trackingNumber) {
    selectCourierManualModal.show();
    couriers.forEach((courier) => {
        const element = document.getElementById(courier.id);
        element.addEventListener('click', manualSelectHandler(trackingNumber, courier.name));
    });
}

export function manualSelectHandler(trackingNumber, manualCourier) {
    return async function curried_func(e) {
        manualSelectHandlerRemove();
        selectCourierManualModal.hide();
        if (manualCourier == 'Skip') {
            return;
        }
        // Call Firebase Cloud Function instead of google.script.run
        playSound();
        await logInput(trackingNumber, manualCourier);
        clearInput();
    };
}

export function manualSelectHandlerRemove() {
    couriers.forEach((courier) => {
        const element = document.getElementById(courier.id);
        element.removeEventListener('click', () => manualSelectHandler(trackingNumber, courier.name));
    });
}

// Helper function to call Firebase Cloud Function
async function logInput(trackingNumber, courier) {
    console.log('Logging input:', { trackingNumber, courier }); // Debug log

    try {
        // Get the current user's ID token
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not signed in');
        }

        const idToken = await user.getIdToken(true); // Force refresh
        console.log('ID Token:', idToken); // Debug log

        // Send the request with the ID token in the Authorization header
        const response = await fetch(`${API_URL}/logInput`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`, // Include the ID token
            },
            body: JSON.stringify({ trackingNumber, courier }),
        });

        // Log the raw response text
        const rawResponse = await response.text();
        console.log('Raw response:', rawResponse); // Debug log

        // Parse the response as JSON
        const result = JSON.parse(rawResponse);
        console.log('Parsed result:', result); // Debug log

        if (result.status !== 'success') {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error logging input:', error); // Debug log
    }
}