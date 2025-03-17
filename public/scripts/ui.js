export function updateUIForSignedInUser(user) {
    const signInButton = document.getElementById('signInButton');
    const userInfo = document.getElementById('userInfo');

    if (signInButton && userInfo) {
        signInButton.style.display = 'none';
        userInfo.style.display = 'block';

        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userName').textContent = user.displayName || 'User';
        document.getElementById('userPhoto').src = user.photoURL || 'default-avatar.png';
    }
}

export function updateUIForSignedOutUser() {
    const signInButton = document.getElementById('signInButton');
    const userInfo = document.getElementById('userInfo');

    if (signInButton && userInfo) {
        signInButton.style.display = 'block';
        userInfo.style.display = 'none';
    }
}