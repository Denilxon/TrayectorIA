// --- CARGA DE ARCHIVOS PARA ANÁLISIS ---

const fileInput = document.getElementById('file-input');
const selectFileBtn = document.querySelector('.select-file-btn');
const analyzeBtn = document.querySelector('.analyze-btn');
const uploadCard = document.querySelector('.upload-card');

const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');

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

analyzeBtn.addEventListener('click', () => {
    if (!archivoSeleccionado) {
        showToast('Primero debes seleccionar un archivo.', 'error');
        return;
    }

    console.log('Archivo listo para analizar:', archivoSeleccionado);
});