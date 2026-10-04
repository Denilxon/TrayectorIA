from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import pyodbc
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware  # <--- 1. Importa esto
import pandas as pd
import io
from modelo.predictor import procesar_dataframe

app = FastAPI()

# --- 2. AGREGA ESTE BLOQUE DE CORS OBLIGATORIAMENTE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite peticiones desde cualquier origen (como Live Server)
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos los métodos (POST, GET, etc.)
    allow_headers=["*"],  # Permite todos los encabezados
)


# Configuración para encriptar contraseñas de forma segura con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Función para conectar a tu base de datos en SQL Server Express
def get_db_connection():
    try:
        conn = pyodbc.connect(
            "DRIVER={ODBC Driver 17 for SQL Server};"
            "SERVER=localhost\\SQLEXPRESS;"  # Tu instancia de SQL Server
            "DATABASE=TrayectoriaDB;"        # Tu base de datos en SSMS
            "Trusted_connection=yes;"        # Autenticación integrada de Windows
        )
        return conn
    except Exception as e:
        print(f"Error al conectar con SQL Server: {e}")
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")

# Función para inicializar la tabla de usuarios automáticamente si no existe
def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL UNIQUE,
                password NVARCHAR(255) NOT NULL
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Aviso en la creación de la tabla: {e}")

init_db()

# Modelos Pydantic para validar peticiones
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str




# ENDPOINT DE REGISTRO
@app.post("/register")
def register(user: UserCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar si el correo ya existe
    cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Cifrar la contraseña antes de guardarla
    hashed_password = pwd_context.hash(user.password)
    
    # Insertar usuario
    cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (user.email, hashed_password))
    conn.commit()
    conn.close()
    
    return {"message": "Usuario registrado exitosamente"}



# ENDPOINT DE INICIO DE SESIÓN
@app.post("/login")
def login(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT password FROM users WHERE email = ?", (user.email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not pwd_context.verify(user.password, row[0]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
        
    return {"message": "Inicio de sesión exitoso", "email": user.email}

COLUMNAS_REQUERIDAS = [
    "Estado civil",
    "Modo de postulación",
    "Orden de postulación",
    "Carrera",
    "Jornada de asistencia",
    "Formación previa",
    "Promedio de formación previa",
    "Nacionalidad",
    "Nivel educativo de la madre",
    "Nivel educativo del padre",
    "Ocupación de la madre",
    "Ocupación del padre",
    "Puntaje de admisión",
    "Desplazado/a",
    "Necesidades educativas especiales",
    "Deudor/a",
    "Aranceles al día",
    "Género",
    "Beneficiario/a de beca",
    "Edad al momento de la matrícula",
    "Estudiante internacional",

    "Asignaturas del 1.er semestre (convalidadas)",
    "Asignaturas del 1.er semestre (inscritas)",
    "Asignaturas del 1.er semestre (evaluaciones)",
    "Asignaturas del 1.er semestre (aprobadas)",
    "Promedio del 1.er semestre",
    "Asignaturas del 1.er semestre (sin evaluaciones)",

    "Asignaturas del 2.º semestre (convalidadas)",
    "Asignaturas del 2.º semestre (inscritas)",
    "Asignaturas del 2.º semestre (evaluaciones)",
    "Asignaturas del 2.º semestre (aprobadas)",
    "Promedio del 2.º semestre",
    "Asignaturas del 2.º semestre (sin evaluaciones)",

    "Tasa de desempleo",
    "Tasa de inflación",
    "PIB"
]

@app.post("/validar-archivo")
async def validar_archivo(file: UploadFile = File(...)):

    nombre_archivo = file.filename.lower()

    # Comprobar extensión
    if not nombre_archivo.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser CSV o XLSX."
        )

    try:
        contenido = await file.read()

        # Leer CSV
        if nombre_archivo.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenido))

        # Leer Excel
        else:
            df = pd.read_excel(io.BytesIO(contenido))

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo."
        )


    # Obtener columnas recibidas
    columnas_recibidas = list(df.columns)


    # Buscar columnas faltantes
    columnas_faltantes = [
        columna
        for columna in COLUMNAS_REQUERIDAS
        if columna not in columnas_recibidas
    ]


    # Buscar columnas adicionales
    columnas_extra = [
        columna
        for columna in columnas_recibidas
        if columna not in COLUMNAS_REQUERIDAS
    ]


    # Si encontramos problemas
    if columnas_faltantes or columnas_extra:

        return {
            "valido": False,
            "columnas_faltantes": columnas_faltantes,
            "columnas_extra": columnas_extra
        }


    # Archivo correcto
    return {
        "valido": True,
        "filas": len(df),
        "columnas": len(df.columns)
    }

@app.post("/analizar")
async def analizar_archivo(file: UploadFile = File(...)):

    nombre_archivo = file.filename.lower()

    # -----------------------------------------
    # 1. Comprobar extensión
    # -----------------------------------------

    if not nombre_archivo.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser CSV o XLSX."
        )


    # -----------------------------------------
    # 2. Leer archivo
    # -----------------------------------------

    try:

        contenido = await file.read()

        if nombre_archivo.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenido))

        else:
            df = pd.read_excel(io.BytesIO(contenido))

    except Exception as e:

        print("Error leyendo archivo:", e)

        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo."
        )


    # -----------------------------------------
    # 3. Validar columnas
    # -----------------------------------------

    columnas_recibidas = list(df.columns)

    columnas_faltantes = [
        columna
        for columna in COLUMNAS_REQUERIDAS
        if columna not in columnas_recibidas
    ]

    columnas_extra = [
        columna
        for columna in columnas_recibidas
        if columna not in COLUMNAS_REQUERIDAS
    ]


    if columnas_faltantes or columnas_extra:

        raise HTTPException(
            status_code=400,
            detail={
                "mensaje": "El archivo no cumple con el formato requerido.",
                "columnas_faltantes": columnas_faltantes,
                "columnas_extra": columnas_extra
            }
        )


    # -----------------------------------------
    # 4. Ejecutar modelo
    # -----------------------------------------

    try:

        resultado = procesar_dataframe(df)

    except ValueError as e:

        # Errores esperables en los datos:
        # categorías inválidas, nulos, etc.
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print("Error ejecutando modelo:", e)

        raise HTTPException(
            status_code=500,
            detail="Ocurrió un error al ejecutar el modelo."
        )


    # -----------------------------------------
    # 5. Preparar resumen
    # -----------------------------------------

    resumen = {
        "total_estudiantes": len(resultado),

        "riesgo_bajo": int(
            (resultado["nivel_riesgo"] == "Bajo").sum()
        ),

        "riesgo_medio": int(
            (resultado["nivel_riesgo"] == "Medio").sum()
        ),

        "riesgo_alto": int(
            (resultado["nivel_riesgo"] == "Alto").sum()
        ),

        "estudiantes_en_riesgo": int(
            (resultado["en_riesgo"] == "Sí").sum()
        )
    }


    # -----------------------------------------
    # 6. Convertir resultados a JSON
    # -----------------------------------------

    resultados = resultado[
        [
            "probabilidad_desercion",
            "porcentaje_riesgo",
            "nivel_riesgo",
            "en_riesgo",
            "cluster",
            "perfil",
            "factores_perfil",
            "intervencion_sugerida"
        ]
    ].copy()

    # pd.NA no puede enviarse directamente como JSON
    resultados["cluster"] = (
        resultados["cluster"]
        .astype(object)
        .where(resultados["cluster"].notna(), None)
    )


    # -----------------------------------------
    # 7. Respuesta
    # -----------------------------------------

    return {
        "valido": True,
        "resumen": resumen,
        "resultados": resultados.to_dict(
            orient="records"
        )
    }