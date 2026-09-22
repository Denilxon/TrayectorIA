    // --- FUNCIÓN REUTILIZABLE PARA MOSTRAR NOTIFICACIONES TOAST ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        
        // Crear elemento toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Icono según el tipo (éxito o error)
        const iconClass = type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line';
        
        toast.innerHTML = `
            <i class="${iconClass}"></i>
            <span>${message}</span>
        `;
        
        // Agregar al contenedor
        container.appendChild(toast);
        
        // Forzar reflow para activar la animación de entrada
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Eliminar el toast automáticamente después de 3.5 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300); // Espera a que termine la transición de salida
        }, 3500);
    }

    // --- Control de la barra lateral (Sidebar) ---
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        });
    }

    // --- Control de la ventana modal de Autenticación ---
    const authModal = document.getElementById('auth-modal');
    const openAuthBtn = document.getElementById('open-auth-modal');
    const closeAuthBtn = document.getElementById('close-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');

    if (openAuthBtn) {
        openAuthBtn.addEventListener('click', () => {
            authModal.classList.add('active');
        });
    }

    if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => {
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

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });