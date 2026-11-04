# TrayectorIA
Un Sistema De Machine Learning integrado en una pagina web.
Su Objetivo es Predecir Deserciones Estudiantiles con el fin de otorgar información útil. 


<--Stack Tecnológico-->
Frontend: HTML5, CSS3, JavaScript
Backend: Python + FastAPI
Base de datos: SQL Server Express
Procesamiento de datos: Pandas + NumPy
Machine Learning: Scikit-learn
Persistencia del modelo: Joblib
Visualización y análisis: Chart.js
Visualización web: Chart.js


Integrantes del equipo y sus roles:
Benjamín Torres --> Líder Técnico / ML Engineer & Backend
Denilxon Azúa --> Frontend Developer / UX & Visualization Specialist
Juan Rebolledo --> Data Engineer / QA Continuo & Proyect Documentation


Metodología de Trabajo del equipo: Tradicional Hibrida

Instrucciones de ejecución Local:
winget install Python.python.3.12 

py -3.12 -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt

py -m uvicorn main:app --reload


Nombre de la base de datos: TrayectoriaDB
localhost\SQLEXPRESS
