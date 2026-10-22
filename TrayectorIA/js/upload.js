document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DEL DOM ---
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.querySelector('.select-file-btn');
    const analyzeBtn = document.querySelector('.analyze-btn');
    const uploadCard = document.querySelector('.upload-card');

    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file-btn');

    const formatBtn = document.querySelector('.format-btn');
    const formatModal = document.getElementById('format-modal');
    const closeFormatModal = document.getElementById('close-format-modal');

    // Elementos del Modal de Estudiante y Filtros
    const studentModal = document.getElementById('student-modal');
    const closeStudentModalBtn = document.getElementById('close-student-modal');
    const searchInput = document.getElementById('student-search');
    const filterRiskSelect = document.getElementById('filter-risk');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    let archivoSeleccionado = null;
    let listaEstudiantesGlobal = [];

    // Instancias de Chart.js
    let chartRiesgoInstance = null;
    let chartPerfilesInstance = null;

    // Estado inicial: asegurar que la caja de información empiece oculta
    if (fileInfo) {
        fileInfo.hidden = true;
        fileInfo.style.display = 'none';
    }

    // Notificaciones toast con fallback
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
        
        // Mostrar contenedor del archivo
        if (fileInfo) {
            fileInfo.hidden = false;
            fileInfo.style.display = 'flex';
        }

        // Habilitar botón de análisis
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }

        // Ocultar resultados previos si se carga un archivo nuevo
        const dashboardSection = document.getElementById('dashboard-results');
        if (dashboardSection) {
            dashboardSection.style.display = 'none';
        }

        notify(`Archivo cargado: ${file.name}`, 'success');
    }

    // --- SELECCIÓN POR BOTÓN O DRAG & DROP ---
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

    // --- QUITAR ARCHIVO SELECCIONADO ---
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            archivoSeleccionado = null;
            
            if (fileInput) fileInput.value = '';
            if (fileName) fileName.textContent = '';
            if (fileSize) fileSize.textContent = '';

            // Ocultar completamente el recuadro de información
            if (fileInfo) {
                fileInfo.hidden = true;
                fileInfo.style.display = 'none';
            }

            // Deshabilitar botón de análisis
            if (analyzeBtn) {
                analyzeBtn.disabled = true;
            }

            // Ocultar resultados del dashboard
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

    // --- APERTURA Y CIERRE DE LA FICHA INDIVIDUAL ---
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

    // --- TABLA Y FILTROS EN TIEMPO REAL ---
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

    function aplicarFiltros() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const nivelSeleccionado = filterRiskSelect ? filterRiskSelect.value : 'todos';

        const filtrados = listaEstudiantesGlobal.filter(est => {
            const id = String(est['ID estudiante'] || '').toLowerCase();
            const perfil = String(est.perfil || '').toLowerCase();
            const nivel = est.nivel_riesgo || '';

            const coincideTexto = id.includes(query) || perfil.includes(query);
            const coincideNivel = (nivelSeleccionado === 'todos') || (nivel === nivelSeleccionado);

            return coincideTexto && coincideNivel;
        });

        pintarTablaEstudiantes(filtrados);
    }

    if (searchInput) searchInput.addEventListener('input', aplicarFiltros);
    if (filterRiskSelect) filterRiskSelect.addEventListener('change', aplicarFiltros);

    // --- RENDERIZADO DEL DASHBOARD ---
    function renderizarDashboard(data) {
        const { resumen, resultados } = data;
        listaEstudiantesGlobal = resultados || [];

        // 1. Mostrar contenedor principal
        const dashboardSection = document.getElementById('dashboard-results');
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
            dashboardSection.scrollIntoView({ behavior: 'smooth' });
        }

        // 2. Cargar KPIs
        document.getElementById('kpi-total').textContent = resumen.total_estudiantes || 0;
        document.getElementById('kpi-bajo').textContent = resumen.riesgo_bajo || 0;
        document.getElementById('kpi-medio').textContent = resumen.riesgo_medio || 0;
        document.getElementById('kpi-alto').textContent = resumen.riesgo_alto || 0;

        // 3. Gráfico Dona de Riesgos
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
                    plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                }
            });
        }

        // 4. Gráfico Barras Horizontales de Perfiles / Clusters
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
                                    if (label.length > 28) {
                                        return label.substring(0, 26) + '...';
                                    }
                                    return label;
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

        // 5. Poblar tabla inicial
        if (searchInput) searchInput.value = '';
        if (filterRiskSelect) filterRiskSelect.value = 'todos';
        pintarTablaEstudiantes(listaEstudiantesGlobal);
    }

    // --- ACCIÓN BOTÓN ANALIZAR ---
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!archivoSeleccionado) {
                notify('Primero selecciona un archivo.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', archivoSeleccionado);

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
            
            if (!element) {
                notify('No hay datos en el dashboard para exportar.', 'error');
                return;
            }

            const options = {
                margin:       10,
                filename:     'Reporte_Analisis_TrayectorIA.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            notify('Generando PDF del dashboard, por favor espera...', 'info');

            html2pdf().from(element).set(options).save().then(() => {
                notify('¡PDF descargado exitosamente!', 'success');
            }).catch(err => {
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

    // Tabla de especificación de formato
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