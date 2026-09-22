   // --- LÓGICA PARA EL REGISTRO (CON TOAST) ---
    const registerForm = document.getElementById('register-form');
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
                    showToast("¡Cuenta creada exitosamente!", "success");
                    authModal.classList.remove('active');
                    registerForm.reset(); // Limpia los campos del formulario
                } else {
                    showToast(data.detail || "Error en el registro", "error");
                }
            } catch (error) {
                showToast("No se pudo conectar con el servidor backend.", "error");
            }
        });
    }

    // --- LÓGICA PARA EL LOGIN (CON TOAST) ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('http://127.0.0.1:8000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    showToast(`¡Bienvenido de nuevo, ${data.email}!`, "success");
                    authModal.classList.remove('active');
                    loginForm.reset(); // Limpia los campos del formulario
                } else {
                    showToast(data.detail || "Correo o contraseña incorrectos", "error");
                }
            } catch (error) {
                showToast("No se pudo conectar con el servidor backend.", "error");
            }
        });
    }