import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

function handlePasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        const passwordInput = document.getElementById('password');
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = this.querySelector('i');
            icon.setAttribute('data-feather', type === 'password' ? 'eye' : 'eye-off');
            feather.replace();
        });
    }
}

function handleLogin() {
    const loginForm = document.getElementById('loginForm');
    const errorText = document.getElementById('login-error');
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const emailInput = document.getElementById('email').value.trim();
            const passwordInput = document.getElementById('password').value;

            // UI Feedback during loading
            submitBtn.textContent = "Authenticating...";
            submitBtn.disabled = true;
            errorText.classList.add('hidden');

            try {
                // Firebase Authentication Call
                await signInWithEmailAndPassword(auth, emailInput, passwordInput);
                
                // PANEL FIX: Use replace() instead of href so they can't click 'Back' to return here
                window.location.replace("dashboard.html");
                
            } catch (error) {
                // Fail: Show error message
                console.error("Login failed:", error.code);
                submitBtn.textContent = "Login";
                submitBtn.disabled = false;
                
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorText.textContent = "Invalid email or password.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorText.textContent = "Account temporarily locked due to many failed attempts. Try again later.";
                } else {
                    errorText.textContent = "An error occurred. Please try again.";
                }
                errorText.classList.remove('hidden');
            }
        });
    }
}

// ==========================================
// INITIALIZATION & REVERSE AUTH GUARD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if the user is ALREADY logged in before showing the form
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is already authenticated. Kick them forward to the dashboard!
            // This prevents the "Back" button from showing the login page.
            window.location.replace("dashboard.html");
        } else {
            // No user is logged in. It is safe to load the login form logic.
            handlePasswordToggle();
            handleLogin(); 
            if(typeof feather !== 'undefined') feather.replace();
        }
    });
});