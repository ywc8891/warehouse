// Import shared modules
import { auth } from './firebase-init.js';
import { handleGoogleSignIn, handleSignOut } from './auth.js';
import { clearInput, playSound } from './utils.js';
import { couriers, regex, API_URL } from './constants.js';

// Import Bootstrap JavaScript
import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js';

let shopeeHandler, posHandler;

// Initialize Bootstrap modals
let selectCourierModal;
let selectCourierManualModal;

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded'); // Debug log

    // Initialize modals
    const ambiguousCourierModalElement = document.querySelector("#selectAmbiguousCourier");
    const courierModalElement = document.querySelector("#selectCourier");

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
        form.addEventListener('submit', submit);
    }
});

export async function submit(e) {
    e.preventDefault();

    const trackingNumber = document.getElementById('trackingNumberInput').value;

    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
        console.error('User not signed in');
        alert('Please sign in to use this feature');
        return;
    }

    try {
        const idToken = await user.getIdToken(true);
        console.log(idToken);

        if (regex.test(trackingNumber)) {
            selectCourierModal.show();
            courierSelectionHandlerSetup(trackingNumber);
        } else {
            console.log(JSON.stringify({ trackingNumber }));

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
            } else {
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

    const shopeeButton = document.getElementById('selectedShopee');
    const posButton = document.getElementById('selectedPos');

    if (shopeeButton) {
        shopeeButton.addEventListener('click', shopeeHandler);
    }

    if (posButton) {
        posButton.addEventListener('click', posHandler);
    }
}

export function courierSelectionHandler(trackingNumber, selectedCourier) {
    return async function (e) {
        courierSelectionHandlerRemove();
        selectCourierModal.hide();
        await logInput(trackingNumber, selectedCourier);
        playSound();
        clearInput();
    };
}

export function courierSelectionHandlerRemove() {
    const shopeeButton = document.getElementById('selectedShopee');
    const posButton = document.getElementById('selectedPos');

    if (shopeeButton) {
        shopeeButton.removeEventListener('click', shopeeHandler);
    }

    if (posButton) {
        posButton.removeEventListener('click', posHandler);
    }
}

export function manualSelectHandlerSetup(trackingNumber) {
    selectCourierManualModal.show();
    couriers.forEach((courier) => {
        const element = document.getElementById(courier.id);
        if (element) {
            element.addEventListener('click', manualSelectHandler(trackingNumber, courier.name));
        }
    });
}

export function manualSelectHandler(trackingNumber, manualCourier) {
    return async function (e) {
        manualSelectHandlerRemove();
        selectCourierManualModal.hide();
        if (manualCourier === 'Skip') {
            return;
        }
        await logInput(trackingNumber, manualCourier);
        playSound();
        clearInput();
    };
}

export function manualSelectHandlerRemove() {
    couriers.forEach((courier) => {
        const element = document.getElementById(courier.id);
        if (element) {
            element.removeEventListener('click', manualSelectHandler);
        }
    });
}

async function logInput(trackingNumber, courier) {
    console.log('Logging input:', { trackingNumber, courier });

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not signed in');
        }

        const idToken = await user.getIdToken(true);
        console.log('ID Token:', idToken);

        const response = await fetch(`${API_URL}/logInput`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ trackingNumber, courier }),
        });

        const rawResponse = await response.text();
        console.log('Raw response:', rawResponse);

        const result = JSON.parse(rawResponse);
        console.log('Parsed result:', result);

        if (result.status !== 'success') {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error logging input:', error);
    }
}