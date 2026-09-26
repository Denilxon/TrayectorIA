// --- CARGA DE ARCHIVOS PARA ANÁLISIS ---

const fileInput = document.getElementById('file-input');
const selectFileBtn = document.querySelector('.select-file-btn');
const analyzeBtn = document.querySelector('.analyze-btn');
const uploadCard = document.querySelector('.upload-card');

const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');

const formatBtn = document.querySelector('.format-btn');
const formatModal = document.getElementById('format-modal');
const closeFormatModal = document.getElementById('close-format-modal');

let archivoSeleccionado = null;


// --- PROCESAR Y VALIDAR ARCHIVO ---
function procesarArchivo(file) {

    if (!file) {
        return;
    }

    // Obtener extensión
    const extension = file.name.split('.').pop().toLowerCase();

    // Validar formato
    if (extension !== 'csv' && extension !== 'xlsx') {
        showToast('El archivo debe ser CSV o XLSX.', 'error');

        fileInput.value = '';
        fileInfo.hidden = true;
        analyzeBtn.disabled = true;

        return;
    }

// Guardar el archivo válido seleccionado
    archivoSeleccionado = file;

    // Mostrar información del archivo
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    fileInfo.hidden = false;
    analyzeBtn.disabled = false;

    showToast(`Archivo seleccionado: ${file.name}`, 'success');
}


// --- SELECCIÓN MEDIANTE BOTÓN ---

selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];

    procesarArchivo(file);
});


// --- ARRASTRAR Y SOLTAR ---

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

    const file = e.dataTransfer.files[0];

    procesarArchivo(file);
});

// --- BOTÓN ANALIZAR ---

analyzeBtn.addEventListener('click', async () => {

    if (!archivoSeleccionado) {
        showToast(
            'Primero debes seleccionar un archivo.',
            'error'
        );
        return;
    }


    // Crear formulario para enviar el archivo
    const formData = new FormData();

    formData.append(
        'file',
        archivoSeleccionado
    );


    try {

        const response = await fetch(
            'http://127.0.0.1:8000/validar-archivo',
            {
                method: 'POST',
                body: formData
            }
        );


        const data = await response.json();


        if (!response.ok) {
            showToast(
                data.detail || 'No se pudo validar el archivo.',
                'error'
            );
            return;
        }


        // Archivo con columnas incorrectas
        if (!data.valido) {

            console.log(
                'Columnas faltantes:',
                data.columnas_faltantes
            );

            console.log(
                'Columnas adicionales:',
                data.columnas_extra
            );


            showToast(
                'El archivo no cumple con el formato requerido.',
                'error'
            );

            return;
        }


        // Archivo correcto
        showToast(
            `Archivo válido: ${data.filas} estudiantes encontrados.`,
            'success'
        );


        console.log(
            'Archivo validado correctamente:',
            data
        );


    } catch (error) {

        console.error(
            'Error al validar archivo:',
            error
        );


        showToast(
            'No se pudo conectar con el servidor.',
            'error'
        );
    }
});

// --- MODAL DE FORMATO REQUERIDO ---

// Abrir modal
formatBtn.addEventListener('click', () => {
    formatModal.classList.add('active');
});

// Cerrar modal con la X
closeFormatModal.addEventListener('click', () => {
    formatModal.classList.remove('active');
});

// Cerrar modal haciendo clic fuera de la ventana
formatModal.addEventListener('click', (e) => {
    if (e.target === formatModal) {
        formatModal.classList.remove('active');
    }
});

const formatTableBody = document.getElementById('format-table-body');

const columnasRequeridas = [
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
// Generar automáticamente la tabla de formato requerido
columnasRequeridas.forEach(columna => {
    const fila = document.createElement('tr');

    fila.innerHTML = `
        <td>${columna.nombre}</td>
        <td>${columna.tipo}</td>
    `;

    formatTableBody.appendChild(fila);
});