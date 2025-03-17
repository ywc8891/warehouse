import { auth } from './firebase-init.js';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { API_URL } from './constants.js';
import { updateUIForSignedInUser, updateUIForSignedOutUser } from './ui.js';

const provider = new GoogleAuthProvider();


// Function to handle Google Sign-In
export async function handleGoogleSignIn() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const idToken = await user.getIdToken();

        // Send the ID token to your backend for verification
        const response = await fetch(`${API_URL}/googleSignIn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
        });

        console.log(idToken)

        const data = await response.json();

        if (data.status === 'success') {
            console.log('Signed in successfully:', data.user);
            updateUIForSignedInUser(data.user);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error during Google Sign-In:', error);
        alert('Sign-In failed. Please try again.');
    }
}

// Function to handle sign-out
export function handleSignOut() {
    auth.signOut().then(() => {
        console.log('User signed out');
        updateUIForSignedOutUser();
    }).catch((error) => {
        console.error('Error during sign-out:', error);
    });
}

// Check if the user is already signed in on page load
onAuthStateChanged(auth, (user) => {
    if (user) {
        updateUIForSignedInUser(user);
    } else {
        updateUIForSignedOutUser();
    }
});