// index.js

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

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            // Prevent the form from refreshing the page
            e.preventDefault();

            // Get the typed values
            const emailInput = document.getElementById('email').value;
            const passwordInput = document.getElementById('password').value;

            // === YOUR HARDCODED CREDENTIALS ===
            const validEmail = "admin@spda.com";
            const validPassword = "admin";

            // Check if they match
            if (emailInput === validEmail && passwordInput === validPassword) {
                // Success: Hide error and redirect to Dashboard
                errorText.classList.add('hidden');
                window.location.href = "dashboard.html";
            } else {
                // Fail: Show error message
                errorText.classList.remove('hidden');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    handlePasswordToggle();
    handleLogin(); // Initialize the login checker
    feather.replace();
});