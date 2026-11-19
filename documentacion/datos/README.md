# Datos

Esta categoría reúne las definiciones de estructura y calidad de los datos de mercado utilizados en MarkovLab. Incluye el diccionario de columnas para archivos CSV en [`diccionario-datos.md`](diccionario-datos.md).

Las series históricas ingresan a `precios_historicos` mediante importación CSV (`backend/scripts/import_prices.jl` o `/admin/importaciones`) o mediante sincronización con Apify (`backend/scripts/sync_prices.jl`, que también actualiza `tipos_cambio`). No incluya credenciales ni conjuntos privados en esta carpeta; para los requisitos de calidad e importación consulte la [especificación de requisitos](../contexto/SRS.md) y la [guía de importación CSV](../tecnica/IMPORTACION_CSV.md).
