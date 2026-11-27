"""Trayectoria V3.1 — inferencia actualizada para scikit-learn 1.9.1.

No entrena modelos ni descarga datos. Solo se debe cargar un .pkl del equipo.
Requisitos y documentación: requirements_inferencia.txt y LEEME_Trayectoria_V3_1.md.
"""
from functools import lru_cache
import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

ID_COLUMNA = 'ID estudiante'
ARTEFACTO_POR_DEFECTO = Path(__file__).resolve().parent / 'trayectoria_pipeline_v3_1.pkl'
VERSION_REQUERIDA = '1.9.1'
COLUMNAS_RESULTADO_ANTERIORES = (
    'probabilidad_desercion', 'porcentaje_riesgo', 'nivel_riesgo', 'en_riesgo',
    'cluster', 'perfil', 'factores_perfil', 'intervencion_sugerida'
)
COLUMNAS_RESULTADO_NUEVAS = ('alertas_individuales', 'recomendaciones_individuales')


@lru_cache(maxsize=4)
def cargar_artefacto(ruta_artefacto=None):
    """Reutiliza un modelo confiable y comprueba versión antes de cargar pickle."""
    ruta = Path(ruta_artefacto).resolve() if ruta_artefacto else ARTEFACTO_POR_DEFECTO
    if not ruta.is_file():
        raise FileNotFoundError(f'No se encontró el artefacto de Trayectoria: {ruta}')
    if sklearn.__version__ != VERSION_REQUERIDA:
        raise RuntimeError(
            f'Este módulo necesita scikit-learn {VERSION_REQUERIDA}; versión actual: '
            f'{sklearn.__version__}. Usa requirements_inferencia.txt.'
        )
    manifiesto = ruta.with_suffix('.manifest.json')
    if not manifiesto.is_file():
        raise FileNotFoundError(
            f'Falta el manifest de compatibilidad: {manifiesto}. '
            'No se acepta un .pkl antiguo sin metadatos.'
        )
    info = json.loads(manifiesto.read_text(encoding='utf-8'))
    version = info.get('scikit_learn')
    if version != VERSION_REQUERIDA:
        raise RuntimeError(
            f'El modelo fue guardado para scikit-learn {version!r} y se '
            f'requiere {VERSION_REQUERIDA}. Vuelve a entrenarlo; no basta con editar el manifest.'
        )
    esperado = info.get('archivo_sha256')
    if esperado:
        h = hashlib.sha256()
        with ruta.open('rb') as f:
            for bloque in iter(lambda: f.read(1024 * 1024), b''):
                h.update(bloque)
        if h.hexdigest() != esperado:
            raise RuntimeError('El .pkl no corresponde con su manifest (SHA-256 diferente).')
    # Nunca aceptar rutas de archivo desde parámetros proporcionados por visitantes.
    artefacto = joblib.load(ruta)
    version = artefacto.get('metadatos', {}).get('scikit_learn')
    if version and version != sklearn.__version__:
        raise RuntimeError(f'Incompatibilidad: modelo scikit-learn {version}; runtime {sklearn.__version__}.')
    if artefacto.get('version') != '3.1':
        raise ValueError('El modelo no pertenece a Trayectoria V3.1.')
    return artefacto


def _validar_ids(df):
    """Valida identificadores sin convertirlos en variables del modelo."""
    if ID_COLUMNA not in df.columns:
        raise ValueError(f"Falta la columna obligatoria '{ID_COLUMNA}'.")
    ids = df[ID_COLUMNA]
    # Nunca convertir ID desde float para evitar perder ceros iniciales.
    if ids.isna().any():
        filas = (np.flatnonzero(ids.isna().to_numpy()) + 2)[:10].tolist()
        raise ValueError(f"Hay ID estudiante vacíos (filas CSV: {filas}).")
    ids = ids.astype('string').str.strip()
    vacios = ids.isna() | ids.eq('')
    if vacios.any():
        filas = (np.flatnonzero(vacios.to_numpy()) + 2)[:10].tolist()
        raise ValueError(f"Hay ID estudiante vacíos (filas CSV: {filas}).")
    if ids.duplicated().any():
        repetidos = ids[ids.duplicated(keep=False)].unique().tolist()
        raise ValueError(f'Hay ID estudiante repetidos dentro del archivo: {repetidos[:8]}')
    return ids


def validar_y_convertir(df_entrada, artefacto):
    """Defensa mínima del modelo; la validación principal se hace en la página."""
    if not isinstance(df_entrada, pd.DataFrame):
        raise TypeError('La entrada debe ser un DataFrame de pandas.')
    if df_entrada.empty:
        raise ValueError('El archivo no contiene estudiantes.')
    if df_entrada.columns.duplicated().any():
        raise ValueError('El archivo contiene nombres de columna duplicados.')
    _validar_ids(df_entrada)
    columnas = list(artefacto['columnas_pagina_a_uci'])
    faltantes = [col for col in columnas if col not in df_entrada.columns]
    if faltantes:
        raise ValueError(f'Faltan columnas obligatorias: {faltantes}')
    colisiones = [c for c in (*COLUMNAS_RESULTADO_ANTERIORES, *COLUMNAS_RESULTADO_NUEVAS) if c in df_entrada.columns]
    if colisiones:
        raise ValueError(f'El archivo ya contiene columnas calculadas: {colisiones}. Usa el original.')

    df = df_entrada[columnas].copy()
    for col in columnas:
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
            df[col] = df[col].astype('string').str.strip().replace('', pd.NA)

    faltantes = {
        col: (np.flatnonzero(df[col].isna().to_numpy()) + 2)[:8].tolist()
        for col in columnas if df[col].isna().any()
    }
    if faltantes:
        raise ValueError(f'Hay valores faltantes; filas CSV (encabezado=1): {faltantes}')

    for columna, mapa in artefacto['mapas_texto_a_codigo'].items():
        desconocidos = sorted(set(df[columna].astype(str).unique()) - set(mapa))
        if desconocidos:
            raise ValueError(f"Valores desconocidos en '{columna}': {desconocidos[:8]}")
        df[columna] = df[columna].map(mapa)
    df.rename(columns=artefacto['columnas_pagina_a_uci'], inplace=True)
    for col in df:
        try:
            df[col] = pd.to_numeric(df[col], errors='raise')
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Valor numérico no válido en '{col}'.") from exc
    df = df[artefacto['features_modelo']]
    if df.isna().any().any() or not np.isfinite(df.to_numpy(dtype=float)).all():
        raise ValueError('Los datos contienen nulos o valores infinitos tras la conversión.')
    return df


def nivel_riesgo(probabilidad):
    """Tramos definidos por el proyecto (no probabilidades calibradas)."""
    return 'Bajo' if probabilidad < .30 else ('Medio' if probabilidad < .50 else 'Alto')


def _alertas_de_estudiante(fila):
    """Reglas orientativas explícitas. No establecen causas de deserción."""
    alertas = []
    recomendaciones = []

    def agregar(codigo, etiqueta, detalle, recomendacion):
        alertas.append({'codigo': codigo, 'etiqueta': etiqueta, 'detalle': detalle})
        if recomendacion not in recomendaciones:
            recomendaciones.append(recomendacion)

    ins1 = float(fila['Curricular units 1st sem (enrolled)'])
    ins2 = float(fila['Curricular units 2nd sem (enrolled)'])
    apr1 = float(fila['Curricular units 1st sem (approved)'])
    apr2 = float(fila['Curricular units 2nd sem (approved)'])
    nota1 = float(fila['Curricular units 1st sem (grade)'])
    nota2 = float(fila['Curricular units 2nd sem (grade)'])

    if ins1 > 0 and apr1 / ins1 < .50:
        agregar('baja_aprobacion_1s', 'Baja aprobación en primer semestre',
                f'{int(apr1)} de {int(ins1)} asignaturas inscritas aprobadas.',
                'Ofrecer tutorías y revisar obstáculos para aprobar asignaturas del primer semestre.')
    if ins2 > 0 and apr2 / ins2 < .50:
        agregar('baja_aprobacion_2s', 'Baja aprobación en segundo semestre',
                f'{int(apr2)} de {int(ins2)} asignaturas inscritas aprobadas.',
                'Revisar la progresión del segundo semestre y acordar un plan de apoyo académico.')
    # En el conjunto UCI portugués las calificaciones se expresan de 0 a 20;
    # un 0 con 0 aprobaciones podría ser ausencia de calificaciones y no una nota real.
    if 0 < nota1 < 10 and 0 < nota2 < 10:
        agregar('calificaciones_bajas', 'Calificaciones bajas en ambos semestres',
                f'Promedios registrados: {nota1:g} y {nota2:g} sobre escala 0–20.',
                'Ofrecer acompañamiento académico y revisar evaluaciones pendientes.')
    if int(fila['Tuition fees up to date']) == 0:
        agregar('arancel_pendiente', 'Aranceles no registrados al día',
                'El registro indica que el arancel no está al día.',
                'Ofrecer orientación sobre regularización y apoyos financieros disponibles.')
    if int(fila['Debtor']) == 1:
        agregar('deuda_registrada', 'Deuda registrada',
                'El registro indica la condición de deudor/a.',
                'Revisar con el área correspondiente opciones de apoyo financiero.')
    if int(fila['Displaced']) == 1:
        agregar('desplazamiento', 'Condición de desplazamiento registrada',
                'El estudiante figura como desplazado/a; esto no implica por sí solo una dificultad.',
                'Consultar, sin asumir problemas, si requiere apoyo de transporte o adaptación.')
    return alertas, recomendaciones


def enriquecer_dataframe(df_entrada, artefacto):
    datos_modelo = validar_y_convertir(df_entrada, artefacto)
    probabilidades = artefacto['modelo_riesgo'].predict_proba(datos_modelo)[:, 1]
    salida = df_entrada.copy().reset_index(drop=True)
    salida[ID_COLUMNA] = _validar_ids(df_entrada).reset_index(drop=True)
    salida['probabilidad_desercion'] = np.round(probabilidades, 6)
    salida['porcentaje_riesgo'] = np.round(probabilidades * 100, 2)
    salida['nivel_riesgo'] = [nivel_riesgo(p) for p in probabilidades]
    mascara = probabilidades >= artefacto['umbral_riesgo']
    salida['en_riesgo'] = np.where(mascara, 'Sí', 'No')
    salida['cluster'] = pd.Series(pd.NA, index=salida.index, dtype='Int64')
    salida['perfil'] = 'Sin perfil de riesgo'
    salida['factores_perfil'] = ''
    salida['intervencion_sugerida'] = ''
    if mascara.any():
        datos_cluster = datos_modelo.loc[mascara, artefacto['cols_cluster']]
        pred = artefacto['kmeans_perfiles'].predict(artefacto['scaler_cluster'].transform(datos_cluster))
        for pos, cluster in zip(np.flatnonzero(mascara), pred):
            perfil = artefacto['config_perfiles'][int(cluster)]
            salida.at[pos, 'cluster'] = int(cluster)
            for campo in ('perfil', 'factores_perfil', 'intervencion_sugerida'):
                salida.at[pos, campo] = perfil[campo]

    alertas = []
    recomendaciones = []
    for _, fila in datos_modelo.iterrows():
        avisos, sugerencias = _alertas_de_estudiante(fila)
        alertas.append(json.dumps(avisos, ensure_ascii=False))
        recomendaciones.append(json.dumps(sugerencias, ensure_ascii=False))
    salida['alertas_individuales'] = alertas
    salida['recomendaciones_individuales'] = recomendaciones
    return salida


def procesar_dataframe(df_entrada, ruta_artefacto=None):
    """Función que llama el backend cuando ya tiene un DataFrame validado."""
    return enriquecer_dataframe(df_entrada, cargar_artefacto(ruta_artefacto))


def procesar_csv(archivo_csv, ruta_artefacto=None, ruta_salida=None):
    """Recibe ruta o archivo binario. Conserva ceros iniciales de ID estudiante."""
    entrada = pd.read_csv(archivo_csv, sep=None, engine='python',
                          encoding='utf-8-sig', dtype={ID_COLUMNA: 'string'})
    salida = procesar_dataframe(entrada, ruta_artefacto)
    if ruta_salida is not None:
        salida.to_csv(ruta_salida, index=False, encoding='utf-8-sig')
    return salida


def obtener_ficha_estudiante(resultado, id_estudiante):
    """Consulta un CSV/DataFrame YA enriquecido; no consulta datos personales externos.

    El control de acceso y aislamiento por lote/sesión corresponde al backend.
    """
    if ID_COLUMNA not in resultado.columns or not set(COLUMNAS_RESULTADO_NUEVAS).issubset(resultado.columns):
        raise ValueError('Se necesita un DataFrame enriquecido V3.1.')
    if id_estudiante is None or not str(id_estudiante).strip():
        raise ValueError('Se debe proporcionar un ID estudiante.')
    coincidencias = resultado.loc[resultado[ID_COLUMNA].astype(str) == str(id_estudiante).strip()]
    if len(coincidencias) != 1:
        raise ValueError('No existe un estudiante único con ese ID en el análisis actual.')
    fila = coincidencias.iloc[0]
    indicadores = {
        'edad_matricula': fila['Edad al momento de la matrícula'],
        'carrera': fila['Carrera'],
        'asignaturas_inscritas_1s': fila['Asignaturas del 1.er semestre (inscritas)'],
        'asignaturas_aprobadas_1s': fila['Asignaturas del 1.er semestre (aprobadas)'],
        'promedio_1s': fila['Promedio del 1.er semestre'],
        'asignaturas_inscritas_2s': fila['Asignaturas del 2.º semestre (inscritas)'],
        'asignaturas_aprobadas_2s': fila['Asignaturas del 2.º semestre (aprobadas)'],
        'promedio_2s': fila['Promedio del 2.º semestre'],
        'aranceles_al_dia': fila['Aranceles al día'],
        'deudor': fila['Deudor/a'],
        'desplazado': fila['Desplazado/a'],
    }
    return {
        'id_estudiante': str(fila[ID_COLUMNA]),
        'porcentaje_riesgo': float(fila['porcentaje_riesgo']),
        'nivel_riesgo': str(fila['nivel_riesgo']),
        'en_riesgo': str(fila['en_riesgo']),
        'cluster': None if pd.isna(fila['cluster']) else int(fila['cluster']),
        'perfil': str(fila['perfil']),
        'factores_perfil': str(fila['factores_perfil']),
        'intervencion_sugerida': str(fila['intervencion_sugerida']),
        'alertas_individuales': json.loads(fila['alertas_individuales']),
        'recomendaciones_individuales': json.loads(fila['recomendaciones_individuales']),
        'indicadores': {k: (v.item() if isinstance(v, np.generic) else v) for k, v in indicadores.items()},
    }
