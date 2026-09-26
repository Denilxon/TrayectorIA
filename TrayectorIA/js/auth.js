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


    // =========================================================
    // MOSTRAR INTERFAZ PRIVADA DESPUÉS DEL LOGIN
    // =========================================================

    function showPrivateUI(email) {

        // Mostrar opciones privadas del menú lateral
        const privateItems = document.querySelectorAll('.private-only');

        privateItems.forEach(item => {
            item.style.display = 'block';
        });


        // Mostrar sección de análisis predictivo
        const dashboardAnalisis =
            document.getElementById('dashboard-analisis');

        if (dashboardAnalisis) {
            dashboardAnalisis.style.display = 'block';
        }


        // Mostrar correo del usuario en la barra superior
        if (userEmailDisplay) {
            userEmailDisplay.textContent = email;
            userEmailDisplay.style.display = 'inline';
        }
    }


    // =========================================================
    // 1. ABRIR Y CERRAR MODAL
    // =========================================================

    if (openAuthModalBtn && authModal) {

        openAuthModalBtn.addEventListener('click', (e) => {

            // Si ya hay un usuario mostrado, no abrir nuevamente el login
            if (userEmailDisplay.style.display === 'inline') {
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


    // Cerrar haciendo clic fuera del modal
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

            // Quitar estado activo
            tabBtns.forEach(b => {
                b.classList.remove('active');
            });

            authForms.forEach(form => {
                form.classList.remove('active');
            });


            // Activar pestaña seleccionada
            btn.classList.add('active');

            const targetForm =
                document.getElementById(btn.getAttribute('data-target'));

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

            const email =
                document.getElementById('register-email').value;

            const password =
                document.getElementById('register-password').value;


            try {

                const response = await fetch(
                    'http://127.0.0.1:8000/register',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type': 'application/json'
                        },

                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );


                const data = await response.json();


                // Si el registro falla
                if (!response.ok) {

                    if (typeof showToast === 'function') {
                        showToast(
                            data.detail || 'Error en el registro.',
                            'error'
                        );
                    }

                    return;
                }


                // Registro exitoso
                if (typeof showToast === 'function') {
                    showToast(
                        '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.',
                        'success'
                    );
                }


                // Limpiar formulario
                registerForm.reset();


                // Volver automáticamente a la pestaña de login
                tabBtns.forEach(btn => {
                    btn.classList.remove('active');
                });

                authForms.forEach(form => {
                    form.classList.remove('active');
                });


                const loginTab =
                    document.querySelector(
                        '.tab-btn[data-target="login-form"]'
                    );

                if (loginTab) {
                    loginTab.classList.add('active');
                }

                if (loginForm) {
                    loginForm.classList.add('active');
                }


            } catch (error) {

                console.error(
                    'Error al conectar con el servidor:',
                    error
                );


                if (typeof showToast === 'function') {
                    showToast(
                        'No se pudo conectar con el servidor backend.',
                        'error'
                    );
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


            const email =
                document.getElementById('login-email').value;

            const password =
                document.getElementById('login-password').value;


            try {

                // Enviar credenciales al backend
                const response = await fetch(
                    'http://127.0.0.1:8000/login',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type': 'application/json'
                        },

                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );


                const data = await response.json();


                // Credenciales rechazadas por FastAPI
                if (!response.ok) {

                    if (typeof showToast === 'function') {
                        showToast(
                            data.detail ||
                            'Correo o contraseña incorrectos.',
                            'error'
                        );
                    }

                    return;
                }


                // =================================================
                // LOGIN CORRECTO
                // Solo llegamos aquí si FastAPI aceptó las credenciales
                // =================================================

                showPrivateUI(email);


                // Cerrar ventana de login
                authModal.classList.remove('active');


                // Limpiar formulario
                loginForm.reset();


                if (typeof showToast === 'function') {
                    showToast(
                        'Sesión iniciada correctamente.',
                        'success'
                    );
                }


            } catch (error) {

                console.error(
                    'Error al conectar con el servidor:',
                    error
                );


                // Si FastAPI está apagado, llegamos aquí
                if (typeof showToast === 'function') {
                    showToast(
                        'No se pudo conectar con el servidor. Inténtalo nuevamente.',
                        'error'
                    );
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

            // Por ahora recargamos la página para limpiar
            // el estado visual de la sesión.
            window.location.reload();
        });
    }

});