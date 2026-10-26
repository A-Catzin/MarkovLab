# Pruebas

Responsabilidad: verificar el comportamiento observable del paquete Julia. `runtests.jl` comprueba que el módulo carga e incluye las pruebas de cada capa; `domain/` verifica las métricas financieras y los invariantes de `PriceBar`; `infrastructure/` verifica la importación CSV; `fixtures/` guarda archivos de ejemplo pequeños y sin datos sensibles. Las pruebas nuevas se ubican en una carpeta con el nombre de la capa y se incluyen desde `runtests.jl`.

Contenido permitido: pruebas deterministas del paquete y, cuando existan componentes, de sus límites. Límite: no alojar lógica de producción ni depender de servicios o credenciales reales. Ejecute `julia --project=backend backend/test/runtests.jl` desde la raíz.
