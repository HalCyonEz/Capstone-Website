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

document.addEventListener('DOMContentLoaded', () => {
    handlePasswordToggle();
    feather.replace();
});