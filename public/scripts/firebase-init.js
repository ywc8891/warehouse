import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyDRBOvsaruD_BLq5KqOicGFgBXr43MVSuU",
    authDomain: "warehouse-513c0.firebaseapp.com",
    projectId: "warehouse-513c0",
    storageBucket: "warehouse-513c0.firebasestorage.app",
    messagingSenderId: "762730806820",
    appId: "1:762730806820:web:7468d0afc0be9ccaee22b1",
    measurementId: "G-JXVCY111ZL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);