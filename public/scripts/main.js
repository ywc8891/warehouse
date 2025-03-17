import { handleGoogleSignIn, handleSignOut } from './auth.js';

// Add event listeners
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');

if (signInButton) {
    signInButton.addEventListener('click', handleGoogleSignIn);
}

if (signOutButton) {
    signOutButton.addEventListener('click', handleSignOut);
}