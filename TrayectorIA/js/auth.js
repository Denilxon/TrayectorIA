document.addEventListener('DOMContentLoaded', () => {
    const authModal = document.getElementById('auth-modal');
    const openAuthModalBtn = document.getElementById('open-auth-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const userEmailDisplay = document.getElementById('user-email-display');
    const logoutBtn = document.getElementById('logout-btn');

    // --- 1. ABRIR Y CERRAR LA VENTANA MODAL ---
    if (openAuthModalBtn && authModal) {
        openAuthModalBtn.addEventListener('click', (e) => {
            if (userEmailDisplay.style.display === 'inline') return;
            e.preventDefault();
            authModal.classList.add('active');
        });
    }

    if (closeModalBtn && authModal) {
        closeModalBtn.addEventListener('click', () => {
            authModal.classList.remove('active');
        });
    }

    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.remove('active');
            }
        });
    }

    // --- 2. PESTAÑAS (LOGIN / REGISTRO) ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            authForms.forEach(f => f.classList.remove('active'));

            btn.classList.add('active');
            const targetForm = document.getElementById(btn.getAttribute('data-target'));
            if (targetForm) targetForm.classList.add('active');
        });
    });

    // --- 3. LÓGICA DE REGISTRO ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            try {
                const response = await fetch('http://127.0.0.1:8000/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    if (typeof showToast === 'function') showToast("¡Cuenta creada exitosamente!", "success");
                    authModal.classList.remove('active');
                    registerForm.reset();
                } else {
                    if (typeof showToast === 'function') showToast(data.detail || "Error en el registro", "error");
                }
            } catch (error) {
                if (typeof showToast === 'function') showToast("No se pudo conectar con el servidor backend.", "error");
            }
        });
    }

    // --- 4. LÓGICA DE INICIO DE SESIÓN ---
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('login-email').value;
            
            // Ocultar la modal
            authModal.classList.remove('active');

            // Revelar los elementos privados en el sidebar manteniendo los iconos originales
            const privateItems = document.querySelectorAll('.private-only');
            privateItems.forEach(item => {
                item.style.display = 'block';
            });

            // Mostrar la sección de análisis predictivo (pero sin hacer scroll automático)
            const dashboardAnalisis = document.getElementById('dashboard-analisis');
            if (dashboardAnalisis) dashboardAnalisis.style.display = 'block';

            // Mostrar el correo del usuario en la esquina superior derecha
            if (userEmailDisplay) {
                userEmailDisplay.textContent = emailInput;
                userEmailDisplay.style.display = 'inline';
            }
        });
    }

    // --- 5. LÓGICA PARA CERRAR SESIÓN ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.reload(); // Recarga para limpiar estados de forma limpia
        });
    }
});