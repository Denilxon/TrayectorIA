import pandas as pd
import numpy as np
import joblib
from pathlib import Path


# =========================================================
# RUTA DEL MODELO
# =========================================================

RUTA_MODELO = (
    Path(__file__).resolve().parent
    / "trayectoria_pipeline_v2.pkl"
)


# =========================================================
# CARGAR MODELO
# =========================================================

artefacto = joblib.load(RUTA_MODELO)


# =========================================================
# CONVERTIR DATOS DE LA PLATAFORMA AL FORMATO DEL MODELO
# =========================================================

def convertir_entrada_a_uci(df_entrada, artefacto):
    """
    Convierte el DataFrame recibido desde la página al formato
    numérico exacto utilizado para entrenar el modelo UCI.

    La página realiza la validación principal.
    Aquí se realizan comprobaciones adicionales antes de predecir.
    """

    df = df_entrada.copy()

    columnas_esperadas = list(
        artefacto["columnas_pagina_a_uci"].keys()
    )

    # 1. Comprobar columnas necesarias
    faltantes = [
        col for col in columnas_esperadas
        if col not in df.columns
    ]

    if faltantes:
        raise ValueError(
            f"Faltan columnas obligatorias: {faltantes}"
        )

    # Trabajar solamente con las columnas necesarias
    # y en el orden esperado
    df = df[columnas_esperadas].copy()

    # 2. Comprobar valores faltantes
    if df.isna().any().any():

        errores = {}

        for columna in df.columns:
            filas = df.index[df[columna].isna()].tolist()

            if filas:
                errores[columna] = filas[:10]

        raise ValueError(
            "El dataset contiene valores faltantes. "
            f"Columnas y filas afectadas: {errores}"
        )

    # 3. Convertir categorías de texto a códigos UCI
    for columna, mapa in artefacto[
        "mapas_texto_a_codigo"
    ].items():

        valores_validos = set(mapa.keys())

        valores_recibidos = set(
            df[columna].dropna().astype(str)
        )

        desconocidos = sorted(
            valores_recibidos - valores_validos
        )

        if desconocidos:
            raise ValueError(
                f"Valores no reconocidos en '{columna}': "
                f"{desconocidos[:10]}"
            )

        df[columna] = df[columna].map(mapa)

    # 4. Cambiar nombres españoles por nombres originales UCI
    df = df.rename(
        columns=artefacto["columnas_pagina_a_uci"]
    )

    # 5. Comprobar que todas las variables sean numéricas
    for columna in df.columns:

        try:
            df[columna] = pd.to_numeric(
                df[columna],
                errors="raise"
            )

        except Exception:
            raise ValueError(
                f"La columna '{columna}' contiene "
                "valores que no pueden convertirse a número."
            )

    # 6. Orden exacto utilizado durante entrenamiento
    df = df[artefacto["features_modelo"]]

    # Comprobación final
    if df.isna().any().any():
        raise ValueError(
            "Se generaron valores nulos durante "
            "la transformación de los datos."
        )

    return df


# =========================================================
# NIVEL DE RIESGO
# =========================================================

def nivel_riesgo(probabilidad):

    if probabilidad < 0.30:
        return "Bajo"

    elif probabilidad < 0.50:
        return "Medio"

    return "Alto"


# =========================================================
# REALIZAR PREDICCIONES
# =========================================================

def enriquecer_dataframe(df_entrada, artefacto):
    """
    Predice riesgo y asigna perfil a los alumnos en riesgo.
    Conserva las columnas originales de entrada.
    """

    X_nuevo = convertir_entrada_a_uci(
        df_entrada,
        artefacto
    )

    modelo = artefacto["modelo_riesgo"]

    probas = modelo.predict_proba(
        X_nuevo
    )[:, 1]


    # Copiar datos originales
    salida = df_entrada.copy()


    # Resultados del modelo
    salida["probabilidad_desercion"] = (
        probas.round(6)
    )

    salida["porcentaje_riesgo"] = (
        probas * 100
    ).round(2)

    salida["nivel_riesgo"] = [
        nivel_riesgo(p)
        for p in probas
    ]

    salida["en_riesgo"] = np.where(
        probas >= artefacto["umbral_riesgo"],
        "Sí",
        "No"
    )


    # Información de perfiles
    salida["cluster"] = pd.Series(
        pd.NA,
        index=salida.index,
        dtype="Int64"
    )

    salida["perfil"] = "Sin perfil de riesgo"
    salida["factores_perfil"] = ""
    salida["intervencion_sugerida"] = ""


    # Estudiantes considerados en riesgo
    mascara = (
        probas >= artefacto["umbral_riesgo"]
    )


    # Aplicar clustering solamente a estudiantes en riesgo
    if mascara.any():

        Xc = X_nuevo.loc[
            mascara,
            artefacto["cols_cluster"]
        ]

        Xc_scaled = (
            artefacto["scaler_cluster"]
            .transform(Xc)
        )

        clusters = (
            artefacto["kmeans_perfiles"]
            .predict(Xc_scaled)
        )


        idxs = salida.index[mascara]

        salida.loc[
            idxs,
            "cluster"
        ] = clusters


        # Asignar descripción de cada perfil
        for idx, cluster in zip(
            idxs,
            clusters
        ):

            config = artefacto[
                "config_perfiles"
            ][int(cluster)]

            salida.at[
                idx,
                "perfil"
            ] = config["perfil"]

            salida.at[
                idx,
                "factores_perfil"
            ] = config["factores_perfil"]

            salida.at[
                idx,
                "intervencion_sugerida"
            ] = config[
                "intervencion_sugerida"
            ]


    return salida


# =========================================================
# FUNCIÓN PRINCIPAL PARA FASTAPI
# =========================================================

def procesar_dataframe(df_entrada):
    """
    Recibe un DataFrame validado por FastAPI
    y devuelve el DataFrame enriquecido
    con las predicciones del modelo.
    """

    resultado = enriquecer_dataframe(
        df_entrada,
        artefacto
    )

    return resultado