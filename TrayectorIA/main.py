from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import pyodbc
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import json
from modelo.predictor import procesar_dataframe

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- CONEXIÓN A SQL SERVER ---
def get_db_connection():
    try:
        conn = pyodbc.connect(
            "DRIVER={ODBC Driver 17 for SQL Server};"
            "SERVER=localhost\\SQLEXPRESS01;"
            "DATABASE=TrayectoriaDB;"
            "Trusted_connection=yes;"
        )
        return conn
    except Exception as e:
        print(f"Error al conectar con SQL Server: {e}")
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")

# --- INICIALIZACIÓN DE TABLAS ---
def init_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Tabla de Usuarios
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                email NVARCHAR(255) NOT NULL UNIQUE,
                password NVARCHAR(255) NOT NULL
            )
        """)
        
        # 2. Tabla de Historial de Análisis
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='historial_analisis' and xtype='U')
            CREATE TABLE historial_analisis (
                id INT IDENTITY(1,1) PRIMARY KEY,
                usuario_email NVARCHAR(255) NOT NULL,
                nombre_archivo NVARCHAR(255) NOT NULL,
                fecha_analisis DATETIME DEFAULT GETDATE(),
                total_estudiantes INT NOT NULL,
                riesgo_bajo INT NOT NULL,
                riesgo_medio INT NOT NULL,
                riesgo_alto INT NOT NULL,
                datos_json NVARCHAR(MAX) NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Aviso en la creación de las tablas: {e}")

init_db()

# --- MODELOS PYDANTIC ---
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

DOMINIOS_PERMITIDOS = [
    "gmail.com",
    "outlook.com",
    "outlook.cl",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "duocuc.cl",
    "duoc.cl",
    "profesor.duoc.cl"
]

COLUMNAS_REQUERIDAS = [
    "ID estudiante",
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

# --- ENDPOINTS DE AUTENTICACIÓN ---
@app.post("/register")
def register(user: UserCreate):
    email_limpio = user.email.strip().lower()

    if "@" not in email_limpio:
        raise HTTPException(status_code=400, detail="Formato de correo no válido.")

    partes = email_limpio.split("@")
    if len(partes) != 2:
        raise HTTPException(status_code=400, detail="Formato de correo no válido.")

    dominio = partes[1]

    if dominio not in DOMINIOS_PERMITIDOS:
        raise HTTPException(
            status_code=400, 
            detail=f"El dominio '@{dominio}' no está permitido. Usa un correo institucional o comercial válido."
        )

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE email = ?", (email_limpio,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")
    
    hashed_password = pwd_context.hash(user.password)
    cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email_limpio, hashed_password))
    conn.commit()
    conn.close()
    
    return {"message": "Usuario registrado exitosamente"}

@app.post("/login")
def login(user: UserLogin):
    email_limpio = user.email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT password FROM users WHERE email = ?", (email_limpio,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not pwd_context.verify(user.password, row[0]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
        
    return {"message": "Inicio de sesión exitoso", "email": email_limpio}

# --- ENDPOINTS DE ANÁLISIS E HISTORIAL ---
@app.post("/validar-archivo")
async def validar_archivo(file: UploadFile = File(...)):
    nombre_archivo = file.filename.lower()

    if not nombre_archivo.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser CSV o XLSX."
        )

    try:
        contenido = await file.read()
        if nombre_archivo.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenido), dtype={"ID estudiante": "string"}, encoding="utf-8-sig")
        else:
            df = pd.read_excel(io.BytesIO(contenido), dtype={"ID estudiante": "string"})
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo.")

    columnas_recibidas = list(df.columns)
    columnas_faltantes = [col for col in COLUMNAS_REQUERIDAS if col not in columnas_recibidas]
    columnas_extra = [col for col in columnas_recibidas if col not in COLUMNAS_REQUERIDAS]

    if columnas_faltantes or columnas_extra:
        return {
            "valido": False,
            "columnas_faltantes": columnas_faltantes,
            "columnas_extra": columnas_extra
        }

    return {
        "valido": True,
        "filas": len(df),
        "columnas": len(df.columns)
    }

@app.post("/analizar")
async def analizar_archivo(
    file: UploadFile = File(...),
    usuario_email: str = Form("usuario@trayectoria.com")
):
    nombre_archivo = file.filename

    if not nombre_archivo.lower().endswith((".csv", ".xlsx")):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV o XLSX.")

    try:
        contenido = await file.read()
        if nombre_archivo.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contenido))
        else:
            df = pd.read_excel(io.BytesIO(contenido))
    except Exception as e:
        print("Error leyendo archivo:", e)
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo.")

    columnas_recibidas = list(df.columns)
    columnas_faltantes = [col for col in COLUMNAS_REQUERIDAS if col not in columnas_recibidas]
    columnas_extra = [col for col in columnas_recibidas if col not in COLUMNAS_REQUERIDAS]

    if columnas_faltantes or columnas_extra:
        raise HTTPException(
            status_code=400,
            detail={
                "mensaje": "El archivo no cumple con el formato requerido.",
                "columnas_faltantes": columnas_faltantes,
                "columnas_extra": columnas_extra
            }
        )

    try:
        resultado = procesar_dataframe(df)

        columnas_filtros = [
            "Carrera",
            "Género",
            "Beneficiario/a de beca",
            "Edad al momento de la matrícula",
            "Promedio del 1.er semestre",
            "Promedio del 2.º semestre"
        ]

        for columna in columnas_filtros:
            if columna in df.columns:
                resultado[columna] = df[columna].to_numpy()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("Error ejecutando modelo:", e)
        raise HTTPException(status_code=500, detail="Ocurrió un error al ejecutar el modelo.")

    resumen = {
        "total_estudiantes": len(resultado),
        "riesgo_bajo": int((resultado["nivel_riesgo"] == "Bajo").sum()),
        "riesgo_medio": int((resultado["nivel_riesgo"] == "Medio").sum()),
        "riesgo_alto": int((resultado["nivel_riesgo"] == "Alto").sum()),
        "estudiantes_en_riesgo": int((resultado["en_riesgo"] == "Sí").sum())
    }

    columnas_exportar = [
        "ID estudiante",
        "Carrera",
        "Género",
        "Beneficiario/a de beca",
        "Edad al momento de la matrícula",
        "Promedio del 1.er semestre",
        "Promedio del 2.º semestre",
        "probabilidad_desercion",
        "porcentaje_riesgo",
        "nivel_riesgo",
        "en_riesgo",
        "cluster",
        "perfil",
        "factores_perfil",
        "intervencion_sugerida",
        "alertas_individuales",
        "recomendaciones_individuales"
    ]
    
    cols_existentes = [c for c in columnas_exportar if c in resultado.columns]
    resultados = resultado[cols_existentes].copy()

    if "cluster" in resultados.columns:
        resultados["cluster"] = (
            resultados["cluster"]
            .astype(object)
            .where(resultados["cluster"].notna(), None)
        )

    payload_respuesta = {
        "valido": True,
        "resumen": resumen,
        "resultados": resultados.to_dict(orient="records")
    }

    # Persistencia en SQL Server vinculada al usuario
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO historial_analisis 
            (usuario_email, nombre_archivo, total_estudiantes, riesgo_bajo, riesgo_medio, riesgo_alto, datos_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            usuario_email.strip().lower(),
            nombre_archivo,
            resumen["total_estudiantes"],
            resumen["riesgo_bajo"],
            resumen["riesgo_medio"],
            resumen["riesgo_alto"],
            json.dumps(payload_respuesta)
        ))
        conn.commit()
        conn.close()
    except Exception as db_err:
        print(f"Error al guardar historial en BD: {db_err}")

    return payload_respuesta

@app.get("/historial/{usuario_email}")
def obtener_historial(usuario_email: str):
    email_limpio = usuario_email.strip().lower()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, nombre_archivo, CONVERT(VARCHAR, fecha_analisis, 120) AS fecha,
                   total_estudiantes, riesgo_bajo, riesgo_medio, riesgo_alto, datos_json
            FROM historial_analisis
            WHERE usuario_email = ?
            ORDER BY fecha_analisis DESC
        """, (email_limpio,))
        
        rows = cursor.fetchall()
        conn.close()

        historial = []
        for row in rows:
            historial.append({
                "id": row[0],
                "nombre_archivo": row[1],
                "fecha": row[2],
                "total_estudiantes": row[3],
                "riesgo_bajo": row[4],
                "riesgo_medio": row[5],
                "riesgo_alto": row[6],
                "datos": json.loads(row[7])
            })
        return historial
    except Exception as e:
        print(f"Error al consultar historial: {e}")
        raise HTTPException(status_code=500, detail="Error al recuperar el historial.")