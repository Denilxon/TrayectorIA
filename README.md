# TrayectorIA
Un Sistema De Machine Learning integrado en una pagina web.
Su Objetivo es Predecir Deserciones Estudiantiles con el fin de otorgar información útil de como ayudar 


<--Stack Tecnológico-->
Frontend: HTML5, CSS3, JavaScript
Backend: Python + FastAPI
Base de datos: SQL Server
Procesamiento de datos: Pandas + NumPy
Machine Learning: Scikit-learn
Persistencia del modelo: Joblib
Visualización y análisis: Chart.js
Visualización web: Chart.js


Integrantes del equipo y sus roles:
Benjamín Torres --> Líder Técnico / ML Engineer & Backend
Denilxon Azúa --> Frontend Developer / UX & Visualization Specialist
Juan Rebolledo --> Data Engineer / QA Continuo & Proyect Documentation


Metodología de Trabajo del equipo
Tradicional Hibrida

Instrucciones de ejecución Local

py -m uvicorn main:app --reload

Instalaciones necesarias:

pip install fastapi uvicorn pydantic passlib[bcrypt] pyodbc
pip install "bcrypt<4.0.0"
