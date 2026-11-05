document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DEL DOM: ARCHIVOS Y CONTENEDORES ---
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.querySelector('.select-file-btn');
    const analyzeBtn = document.querySelector('.analyze-btn');
    const uploadCard = document.querySelector('.upload-card');

    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file-btn');

    // Modales de formato y ficha individual
    const formatBtn = document.querySelector('.format-btn');
    const formatModal = document.getElementById('format-modal');
    const closeFormatModal = document.getElementById('close-format-modal');

    const studentModal = document.getElementById('student-modal');
    const closeStudentModalBtn = document.getElementById('close-student-modal');

    // Herramientas de filtrado, búsqueda y exportación
    const searchInput = document.getElementById('student-search');
    const filterRiskSelect = document.getElementById('filter-risk');
    const filterCareerSelect = document.getElementById('filter-career');
    const filterGenderSelect = document.getElementById('filter-gender');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    // Métricas KPI
    const kpiTotal = document.getElementById('kpi-total');
    const kpiBajo = document.getElementById('kpi-bajo');
    const kpiMedio = document.getElementById('kpi-medio');
    const kpiAlto = document.getElementById('kpi-alto');

    // Historial
    const historialSection = document.getElementById('historial-section');
    const historialTableBody = document.getElementById('historial-table-body');
    const refreshHistorialBtn = document.getElementById('refresh-historial-btn');

    let archivoSeleccionado = null;
    let listaEstudiantesGlobal = [];

    // Instancias de Chart.js
    let chartRiesgoInstance = null;
    let chartPerfilesInstance = null;

    // Obtener correo autenticado real
    function obtenerUsuarioActivo() {
        return localStorage.getItem('user_email') || 
               localStorage.getItem('trayectoria_user') || 
               sessionStorage.getItem('user_email') || 
               '';
    }

    if (fileInfo) {
        fileInfo.hidden = true;
        fileInfo.style.display = 'none';
    }

    function notify(msg, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(msg, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
        }
    }

    // --- PROCESAR ARCHIVO SELECCIONADO ---
    function procesarArchivo(file) {
        if (!file) return;

        const extension = file.name.split('.').pop().toLowerCase();
        if (extension !== 'csv' && extension !== 'xlsx') {
            notify('El archivo debe ser CSV o XLSX.', 'error');
            if (fileInput) fileInput.value = '';
            return;
        }

        archivoSeleccionado = file;

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        
        if (fileInfo) {
            fileInfo.hidden = false;
            fileInfo.style.display = 'flex';
        }

        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }

        const dashboardSection = document.getElementById('dashboard-results');
        if (dashboardSection) {
            dashboardSection.style.display = 'none';
        }

        notify(`Archivo cargado: ${file.name}`, 'success');
    }

    // --- EVENTOS DE SELECCIÓN Y DRAG & DROP ---
    if (selectFileBtn && fileInput) {
        selectFileBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                procesarArchivo(e.target.files[0]);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            archivoSeleccionado = null;
            if (fileInput) fileInput.value = '';
            if (fileName) fileName.textContent = '';
            if (fileSize) fileSize.textContent = '';

            if (fileInfo) {
                fileInfo.hidden = true;
                fileInfo.style.display = 'none';
            }

            if (analyzeBtn) {
                analyzeBtn.disabled = true;
            }

            const dashboardSection = document.getElementById('dashboard-results');
            if (dashboardSection) {
                dashboardSection.style.display = 'none';
            }

            notify('Archivo quitado de la selección.', 'info');
        });
    }

    if (uploadCard) {
        uploadCard.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadCard.classList.add('dragging');
        });

        uploadCard.addEventListener('dragleave', () => {
            uploadCard.classList.remove('dragging');
        });

        uploadCard.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadCard.classList.remove('dragging');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                procesarArchivo(e.dataTransfer.files[0]);
            }
        });
    }

    // --- MODAL DE FICHA INDIVIDUAL DE ESTUDIANTE ---
    function abrirFichaEstudiante(est) {
        if (!studentModal) return;

        const id = est['ID estudiante'] || 'Sin ID';
        const nivel = est.nivel_riesgo || 'Bajo';
        const prob = est.porcentaje_riesgo || (est.probabilidad_desercion ? `${(est.probabilidad_desercion * 100).toFixed(1)}%` : '-');

        document.getElementById('modal-student-id').textContent = `Estudiante #${id}`;
        
        const badge = document.getElementById('modal-student-badge');
        badge.textContent = nivel;
        badge.className = `badge-risk ${nivel.toLowerCase()}`;

        document.getElementById('modal-student-perfil').textContent = est.perfil || (est.cluster !== null ? `Cluster ${est.cluster}` : 'Perfil General');
        document.getElementById('modal-student-prob').textContent = prob;

        let alertas = 'Sin alertas registradas.';
        if (Array.isArray(est.alertas_individuales) && est.alertas_individuales.length > 0) {
            alertas = est.alertas_individuales.join(' • ');
        } else if (typeof est.alertas_individuales === 'string' && est.alertas_individuales.trim()) {
            alertas = est.alertas_individuales;
        }
        document.getElementById('modal-student-alertas').textContent = alertas;

        const intervencion = est.intervencion_sugerida || est.recomendaciones_individuales || 'Seguimiento general periódico.';
        document.getElementById('modal-student-intervencion').textContent = intervencion;

        studentModal.classList.add('active');
    }

    if (closeStudentModalBtn && studentModal) {
        closeStudentModalBtn.addEventListener('click', () => studentModal.classList.remove('active'));
        studentModal.addEventListener('click', (e) => {
            if (e.target === studentModal) studentModal.classList.remove('active');
        });
    }

    // --- RENDERIZADO DE LA TABLA DE ESTUDIANTES ---
    function pintarTablaEstudiantes(estudiantes) {
        const tableBody = document.getElementById('dashboard-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!estudiantes || estudiantes.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 25px;">No se encontraron estudiantes coincidentes.</td></tr>`;
            return;
        }

        estudiantes.forEach(est => {
            const tr = document.createElement('tr');
            const nivelRiesgo = est.nivel_riesgo || 'Bajo';
            const nivelClass = nivelRiesgo.toLowerCase();
            const idEstudiante = est['ID estudiante'] || '-';
            const porcentaje = est.porcentaje_riesgo || (est.probabilidad_desercion ? `${(est.probabilidad_desercion * 100).toFixed(1)}%` : '-');
            const perfil = est.perfil || (est.cluster !== null ? `Cluster ${est.cluster}` : 'General');

            tr.innerHTML = `
                <td><strong>#${idEstudiante}</strong></td>
                <td>${porcentaje}</td>
                <td><span class="badge-risk ${nivelClass}">${nivelRiesgo}</span></td>
                <td>${perfil}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn-view-detail" data-id="${idEstudiante}">
                        <i class="ri-eye-line"></i> Ver Ficha
                    </button>
                </td>
            `;

            tr.querySelector('.btn-view-detail').addEventListener('click', () => {
                abrirFichaEstudiante(est);
            });

            tableBody.appendChild(tr);
        });
    }

    // --- ACTUALIZACIÓN REACTIVA DE KPIS Y GRÁFICOS ---
    function actualizarVisualizaciones(filtrados) {
        let bajo = 0;
        let medio = 0;
        let alto = 0;

        filtrados.forEach(est => {
            const nivel = (est.nivel_riesgo || '').toLowerCase();
            if (nivel === 'bajo') bajo++;
            else if (nivel === 'medio') medio++;
            else if (nivel === 'alto') alto++;
        });

        if (kpiTotal) kpiTotal.textContent = filtrados.length;
        if (kpiBajo) kpiBajo.textContent = bajo;
        if (kpiMedio) kpiMedio.textContent = medio;
        if (kpiAlto) kpiAlto.textContent = alto;

        if (chartRiesgoInstance) {
            chartRiesgoInstance.data.datasets[0].data = [bajo, medio, alto];
            chartRiesgoInstance.update();
        }

        if (chartPerfilesInstance) {
            const conteoPerfiles = {};
            filtrados.forEach(est => {
                const nombre = est.perfil || `Cluster ${est.cluster ?? 'General'}`;
                conteoPerfiles[nombre] = (conteoPerfiles[nombre] || 0) + 1;
            });

            chartPerfilesInstance.data.labels = Object.keys(conteoPerfiles);
            chartPerfilesInstance.data.datasets[0].data = Object.values(conteoPerfiles);
            chartPerfilesInstance.update();
        }
    }

    // --- FILTRADO COMBINADO EN TIEMPO REAL ---
    function aplicarFiltros() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const nivelSeleccionado = filterRiskSelect ? filterRiskSelect.value : 'todos';
        const carreraSeleccionada = filterCareerSelect ? filterCareerSelect.value : 'todos';
        const generoSeleccionado = filterGenderSelect ? filterGenderSelect.value : 'todos';

        const filtrados = listaEstudiantesGlobal.filter(est => {
            const id = String(est['ID estudiante'] || '').toLowerCase();
            const perfil = String(est.perfil || '').toLowerCase();
            const nivel = est.nivel_riesgo || '';
            const carrera = String(est['Carrera'] ?? '');
            const genero = String(est['Género'] ?? '');

            const coincideTexto = id.includes(query) || perfil.includes(query);
            const coincideNivel = nivelSeleccionado === 'todos' || nivel === nivelSeleccionado;
            const coincideCarrera = carreraSeleccionada === 'todos' || carrera === carreraSeleccionada;
            const coincideGenero = generoSeleccionado === 'todos' || genero === generoSeleccionado;

            return coincideTexto && coincideNivel && coincideCarrera && coincideGenero;
        });

        pintarTablaEstudiantes(filtrados);
        actualizarVisualizaciones(filtrados);
    }

    // --- REINICIAR Y LIMPIAR FILTROS ---
    function limpiarFiltros() {
        if (searchInput) searchInput.value = '';
        if (filterRiskSelect) filterRiskSelect.value = 'todos';
        if (filterCareerSelect) filterCareerSelect.value = 'todos';
        if (filterGenderSelect) filterGenderSelect.value = 'todos';

        aplicarFiltros();
    }

    if (searchInput) searchInput.addEventListener('input', aplicarFiltros);
    if (filterRiskSelect) filterRiskSelect.addEventListener('change', aplicarFiltros);
    if (filterCareerSelect) filterCareerSelect.addEventListener('change', aplicarFiltros);
    if (filterGenderSelect) filterGenderSelect.addEventListener('change', aplicarFiltros);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', limpiarFiltros);

    // --- RENDERIZADO DEL DASHBOARD ---
    function renderizarDashboard(data) {
        const { resumen, resultados } = data;
        listaEstudiantesGlobal = resultados || [];

        // Poblar carreras dinámicas
        if (filterCareerSelect) {
            const carreras = [...new Set(
                listaEstudiantesGlobal
                    .map(est => est['Carrera'])
                    .filter(c => c !== null && c !== undefined && c !== '')
                    .map(String)
            )].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

            filterCareerSelect.innerHTML = '<option value="todos">Todas las carreras</option>';
            carreras.forEach(carrera => {
                const opt = document.createElement('option');
                opt.value = carrera;
                opt.textContent = carrera;
                filterCareerSelect.appendChild(opt);
            });
            filterCareerSelect.value = 'todos';
        }

        // Poblar géneros dinámicos
        if (filterGenderSelect) {
            const generos = [...new Set(
                listaEstudiantesGlobal
                    .map(est => est['Género'])
                    .filter(g => g !== null && g !== undefined && g !== '')
                    .map(String)
            )].sort();

            filterGenderSelect.innerHTML = '<option value="todos">Todos los géneros</option>';
            generos.forEach(genero => {
                const opt = document.createElement('option');
                opt.value = genero;
                opt.textContent = genero;
                filterGenderSelect.appendChild(opt);
            });
            filterGenderSelect.value = 'todos';
        }

        const dashboardSection = document.getElementById('dashboard-results');
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
            dashboardSection.scrollIntoView({ behavior: 'smooth' });
        }

        // Gráfico de Dona (Riesgos)
        const canvasRiesgo = document.getElementById('chart-riesgo');
        if (canvasRiesgo) {
            if (chartRiesgoInstance) chartRiesgoInstance.destroy();
            chartRiesgoInstance = new Chart(canvasRiesgo.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Riesgo Bajo', 'Riesgo Medio', 'Riesgo Alto'],
                    datasets: [{
                        data: [
                            resumen.riesgo_bajo || 0,
                            resumen.riesgo_medio || 0,
                            resumen.riesgo_alto || 0
                        ],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderColor: '#111b2e',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { 
                            position: 'bottom', 
                            labels: { color: '#cbd5e1' } 
                        } 
                    }
                }
            });
        }

        // Gráfico de Barras Horizontales (Perfiles)
        const canvasPerfiles = document.getElementById('chart-perfiles');
        if (canvasPerfiles) {
            const conteoPerfiles = {};
            listaEstudiantesGlobal.forEach(est => {
                const nombre = est.perfil || `Cluster ${est.cluster ?? 'General'}`;
                conteoPerfiles[nombre] = (conteoPerfiles[nombre] || 0) + 1;
            });

            if (chartPerfilesInstance) chartPerfilesInstance.destroy();

            chartPerfilesInstance = new Chart(canvasPerfiles.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Object.keys(conteoPerfiles),
                    datasets: [{
                        label: 'Estudiantes',
                        data: Object.values(conteoPerfiles),
                        backgroundColor: '#38bdf8',
                        borderRadius: 6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { 
                            ticks: { color: '#94a3b8', precision: 0 }, 
                            grid: { color: '#1e293b' } 
                        },
                        y: { 
                            ticks: { 
                                color: '#cbd5e1',
                                font: { size: 11 },
                                callback: function(value) {
                                    const label = this.getLabelForValue(value);
                                    return label.length > 28 ? label.substring(0, 26) + '...' : label;
                                }
                            }, 
                            grid: { display: false } 
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function(context) { return context[0].label; }
                            }
                        }
                    }
                }
            });
        }

        limpiarFiltros();
    }

    // --- CARGAR Y GESTIONAR HISTORIAL DE ANÁLISIS ---
    async function cargarHistorial() {
        const usuarioEmail = obtenerUsuarioActivo();

        // Si NO hay usuario autenticado, mantener la sección oculta
        if (!usuarioEmail) {
            if (historialSection) historialSection.style.display = 'none';
            return;
        }

        if (!historialTableBody) return;

        try {
            const response = await fetch(`http://127.0.0.1:8000/historial/${encodeURIComponent(usuarioEmail)}`);
            if (!response.ok) return;

            const listaHistorial = await response.json();
            historialTableBody.innerHTML = '';

            if (listaHistorial.length === 0) {
                historialTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 25px;">No registras análisis anteriores.</td></tr>`;
            } else {
                listaHistorial.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.fecha}</td>
                        <td><strong>${item.nombre_archivo}</strong></td>
                        <td>${item.total_estudiantes}</td>
                        <td><span class="badge-risk bajo">${item.riesgo_bajo}</span></td>
                        <td><span class="badge-risk medio">${item.riesgo_medio}</span></td>
                        <td><span class="badge-risk alto">${item.riesgo_alto}</span></td>
                        <td style="text-align: center;">
                            <button type="button" class="btn-view-detail btn-load-historic">
                                <i class="ri-folder-open-line"></i> Ver Dashboard
                            </button>
                        </td>
                    `;

                    tr.querySelector('.btn-load-historic').addEventListener('click', () => {
                        renderizarDashboard(item.datos);
                        notify(`Cargado análisis histórico: ${item.nombre_archivo}`, 'info');
                    });

                    historialTableBody.appendChild(tr);
                });
            }

            // Hacer visible solo si hay sesión activa
            if (historialSection) historialSection.style.display = 'block';

        } catch (err) {
            console.error("Error al cargar historial:", err);
        }
    }

    // Exponer la función globalmente para que auth.js la invoque tras el login
    window.cargarHistorial = cargarHistorial;

    if (refreshHistorialBtn) {
        refreshHistorialBtn.addEventListener('click', cargarHistorial);
    }

    // Comprobación inicial de ejecución
    if (obtenerUsuarioActivo()) {
        cargarHistorial();
    } else {
        if (historialSection) historialSection.style.display = 'none';
    }

    // --- ACCIÓN BOTÓN ANALIZAR ---
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!archivoSeleccionado) {
                notify('Primero selecciona un archivo.', 'error');
                return;
            }

            const usuarioEmail = obtenerUsuarioActivo();
            if (!usuarioEmail) {
                notify('Debes iniciar sesión para realizar un análisis.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', archivoSeleccionado);
            formData.append('usuario_email', usuarioEmail);

            analyzeBtn.disabled = true;
            const originalHTML = analyzeBtn.innerHTML;
            analyzeBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Analizando datos...';

            try {
                const response = await fetch('http://127.0.0.1:8000/analizar', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    let errorMsg = 'Error al procesar el archivo.';
                    if (typeof data.detail === 'string') {
                        errorMsg = data.detail;
                    } else if (data.detail?.mensaje) {
                        errorMsg = data.detail.mensaje;
                    }
                    notify(errorMsg, 'error');
                    return;
                }

                renderizarDashboard(data);
                cargarHistorial();
                notify(`¡Análisis completado! Se procesaron ${data.resumen.total_estudiantes} estudiantes.`, 'success');

            } catch (err) {
                console.error('Error al conectar con la API:', err);
                notify('No se pudo conectar con el servidor backend (revisa que uvicorn esté corriendo).', 'error');
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = originalHTML;
            }
        });
    }

    // --- LÓGICA DE DESCARGA DE PDF DEL DASHBOARD ---
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            const element = document.getElementById('dashboard-results');
            
            if (!element || element.style.display === 'none') {
                notify('No hay datos en el dashboard para exportar.', 'error');
                return;
            }

            const options = {
                margin:       [10, 10, 10, 10],
                filename:     'Reporte_Analisis_TrayectorIA.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2,
                    useCORS: true, 
                    scrollY: 0,
                    scrollX: 0,
                    backgroundColor: '#0b1120',
                    logging: false
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: 'a4', 
                    orientation: 'landscape' 
                }
            };

            notify('Generando PDF del dashboard, por favor espera...', 'info');

            html2pdf()
                .set(options)
                .from(element)
                .save()
                .then(() => {
                    notify('¡PDF descargado exitosamente!', 'success');
                })
                .catch(err => {
                    console.error('Error generando PDF:', err);
                    notify('Ocurrió un error al generar el archivo PDF.', 'error');
                });
        });
    }

    // --- MODAL DE FORMATO REQUERIDO ---
    if (formatBtn && formatModal) {
        formatBtn.addEventListener('click', () => formatModal.classList.add('active'));
    }
    if (closeFormatModal && formatModal) {
        closeFormatModal.addEventListener('click', () => formatModal.classList.remove('active'));
    }
    if (formatModal) {
        formatModal.addEventListener('click', (e) => {
            if (e.target === formatModal) formatModal.classList.remove('active');
        });
    }

    const formatTableBody = document.getElementById('format-table-body');
    if (formatTableBody) {
        const columnas = [
            { nombre: 'ID estudiante', tipo: 'string' },
            { nombre: 'Estado civil', tipo: 'string' },
            { nombre: 'Modo de postulación', tipo: 'string' },
            { nombre: 'Orden de postulación', tipo: 'integer' },
            { nombre: 'Carrera', tipo: 'string' },
            { nombre: 'Jornada de asistencia', tipo: 'string' },
            { nombre: 'Formación previa', tipo: 'string' },
            { nombre: 'Promedio de formación previa', tipo: 'float' },
            { nombre: 'Nacionalidad', tipo: 'string' },
            { nombre: 'Nivel educativo de la madre', tipo: 'string' },
            { nombre: 'Nivel educativo del padre', tipo: 'string' },
            { nombre: 'Ocupación de la madre', tipo: 'string' },
            { nombre: 'Ocupación del padre', tipo: 'string' },
            { nombre: 'Puntaje de admisión', tipo: 'float' },
            { nombre: 'Desplazado/a', tipo: 'string' },
            { nombre: 'Necesidades educativas especiales', tipo: 'string' },
            { nombre: 'Deudor/a', tipo: 'string' },
            { nombre: 'Aranceles al día', tipo: 'string' },
            { nombre: 'Género', tipo: 'string' },
            { nombre: 'Beneficiario/a de beca', tipo: 'string' },
            { nombre: 'Edad al momento de la matrícula', tipo: 'integer' },
            { nombre: 'Estudiante internacional', tipo: 'string' },
            { nombre: 'Asignaturas del 1.er semestre (convalidadas)', tipo: 'integer' },
            { nombre: 'Asignaturas del 1.er semestre (inscritas)', tipo: 'integer' },
            { nombre: 'Asignaturas del 1.er semestre (evaluaciones)', tipo: 'integer' },
            { nombre: 'Asignaturas del 1.er semestre (aprobadas)', tipo: 'integer' },
            { nombre: 'Promedio del 1.er semestre', tipo: 'float' },
            { nombre: 'Asignaturas del 1.er semestre (sin evaluaciones)', tipo: 'integer' },
            { nombre: 'Asignaturas del 2.º semestre (convalidadas)', tipo: 'integer' },
            { nombre: 'Asignaturas del 2.º semestre (inscritas)', tipo: 'integer' },
            { nombre: 'Asignaturas del 2.º semestre (evaluaciones)', tipo: 'integer' },
            { nombre: 'Asignaturas del 2.º semestre (aprobadas)', tipo: 'integer' },
            { nombre: 'Promedio del 2.º semestre', tipo: 'float' },
            { nombre: 'Asignaturas del 2.º semestre (sin evaluaciones)', tipo: 'integer' },
            { nombre: 'Tasa de desempleo', tipo: 'float' },
            { nombre: 'Tasa de inflación', tipo: 'float' },
            { nombre: 'PIB', tipo: 'float' }
        ];

        columnas.forEach(col => {
            const fila = document.createElement('tr');
            fila.innerHTML = `<td>${col.nombre}</td><td>${col.tipo}</td>`;
            formatTableBody.appendChild(fila);
        });
    }

});