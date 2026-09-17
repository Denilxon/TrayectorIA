from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pyodbc
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware  # <--- 1. Importa esto

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
            "SERVER=localhost\\SQLEXPRESS01;"  # Tu instancia de SQL Server
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