# Pruebas

Responsabilidad: verificar el comportamiento observable del paquete Julia. `runtests.jl` comprueba hoy que el módulo carga y conserva su identidad.

Contenido permitido: pruebas deterministas del paquete y, cuando existan componentes, de sus límites. Límite: no alojar lógica de producción ni depender de servicios o credenciales reales. Ejecute `julia --project=backend backend/test/runtests.jl` desde la raíz.
