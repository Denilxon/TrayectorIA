document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DEL DOM ---
    const authModal = document.getElementById('auth-modal');
    const openAuthModalBtn = document.getElementById('open-auth-modal');
    const closeModalBtn = document.getElementById('close-modal');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const userEmailDisplay = document.getElementById('user-email-display');
    const logoutBtn = document.getElementById('logout-btn');

    // Dominios autorizados
    const DOMINIOS_PERMITIDOS = [
        'gmail.com',
        'outlook.com',
        'outlook.cl',
        'hotmail.com',
        'yahoo.com',
        'icloud.com',
        'duocuc.cl',
        'duoc.cl',
        'profesor.duoc.cl'
    ];

    function esCorreoValido(email) {
        const partes = email.trim().toLowerCase().split('@');
        if (partes.length !== 2) return false;
        return DOMINIOS_PERMITIDOS.includes(partes[1]);
    }

    // =========================================================
    // MOSTRAR U OCULTAR INTERFAZ PRIVADA
    // =========================================================

    function showPrivateUI(email) {
        // Mostrar todos los elementos marcados como privados (.private-only)
        const privateItems = document.querySelectorAll('.private-only');
        privateItems.forEach(item => {
            item.style.display = 'block';
        });

        // Mostrar correo del usuario en la barra superior fija
        if (userEmailDisplay) {
            userEmailDisplay.textContent = email;
            userEmailDisplay.style.display = 'inline';
        }

        // Si la función cargarHistorial existe en upload.js, invocarla
        if (typeof window.cargarHistorial === 'function') {
            window.cargarHistorial();
        }
    }

    function hidePrivateUI() {
        // Ocultar todos los elementos privados
        const privateItems = document.querySelectorAll('.private-only');
        privateItems.forEach(item => {
            item.style.display = 'none';
        });

        // Ocultar resultados previos del dashboard
        const dashboardResults = document.getElementById('dashboard-results');
        if (dashboardResults) {
            dashboardResults.style.display = 'none';
        }

        // Limpiar y ocultar correo en la barra
        if (userEmailDisplay) {
            userEmailDisplay.textContent = '';
            userEmailDisplay.style.display = 'none';
        }
    }

    // =========================================================
    // PERSISTENCIA: COMPROBAR SESIÓN GUARDADA AL CARGAR
    // =========================================================
    const usuarioGuardado = localStorage.getItem('trayectoria_user') || localStorage.getItem('user_email');
    if (usuarioGuardado) {
        // Sincronizar ambas claves de persistencia
        localStorage.setItem('trayectoria_user', usuarioGuardado);
        localStorage.setItem('user_email', usuarioGuardado);
        showPrivateUI(usuarioGuardado);
    } else {
        hidePrivateUI();
    }

    // =========================================================
    // 1. ABRIR Y CERRAR MODAL
    // =========================================================

    if (openAuthModalBtn && authModal) {
        openAuthModalBtn.addEventListener('click', (e) => {
            if (localStorage.getItem('trayectoria_user') || localStorage.getItem('user_email')) {
                return;
            }
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

    // =========================================================
    // 2. PESTAÑAS LOGIN / REGISTRO
    // =========================================================

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            authForms.forEach(form => form.classList.remove('active'));

            btn.classList.add('active');
            const targetForm = document.getElementById(btn.getAttribute('data-target'));
            if (targetForm) {
                targetForm.classList.add('active');
            }
        });
    });

    // =========================================================
    // 3. REGISTRO
    // =========================================================

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('register-email');
            const passwordInput = document.getElementById('register-password');

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!esCorreoValido(email)) {
                if (typeof showToast === 'function') {
                    showToast('Ingresa un correo con dominio válido (ej: @gmail.com, @duocuc.cl).', 'error');
                }
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:8000/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    if (typeof showToast === 'function') {
                        showToast(data.detail || 'Error en el registro.', 'error');
                    }
                    return;
                }

                if (typeof showToast === 'function') {
                    showToast('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.', 'success');
                }

                registerForm.reset();

                tabBtns.forEach(btn => btn.classList.remove('active'));
                authForms.forEach(form => form.classList.remove('active'));

                const loginTab = document.querySelector('.tab-btn[data-target="login-form"]');
                if (loginTab) loginTab.classList.add('active');
                if (loginForm) loginForm.classList.add('active');

            } catch (error) {
                console.error('Error al conectar con el servidor:', error);
                if (typeof showToast === 'function') {
                    showToast('No se pudo conectar con el servidor backend.', 'error');
                }
            }
        });
    }

    // =========================================================
    // 4. INICIO DE SESIÓN
    // =========================================================

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!esCorreoValido(email)) {
                if (typeof showToast === 'function') {
                    showToast('El dominio del correo no es válido.', 'error');
                }
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:8000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    if (typeof showToast === 'function') {
                        showToast(data.detail || 'Correo o contraseña incorrectos.', 'error');
                    }
                    return;
                }

                // Guardar usuario en almacenamiento persistente
                localStorage.setItem('trayectoria_user', email);
                localStorage.setItem('user_email', email);

                showPrivateUI(email);
                authModal.classList.remove('active');
                loginForm.reset();

                if (typeof showToast === 'function') {
                    showToast('Sesión iniciada correctamente.', 'success');
                }

            } catch (error) {
                console.error('Error al conectar con el servidor:', error);
                if (typeof showToast === 'function') {
                    showToast('No se pudo conectar con el servidor. Inténtalo nuevamente.', 'error');
                }
            }
        });
    }

    // =========================================================
    // 5. CERRAR SESIÓN
    // =========================================================

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            localStorage.removeItem('trayectoria_user');
            localStorage.removeItem('user_email');
            sessionStorage.clear();

            hidePrivateUI();

            if (typeof showToast === 'function') {
                showToast('Has cerrado sesión correctamente.', 'success');
            }

            window.location.hash = '#inicio';
        });
    }

});