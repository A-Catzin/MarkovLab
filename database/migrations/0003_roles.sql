-- =============================================================================
-- MarkovLab · Migración 0003: roles de usuario
--
-- Dos roles: 'usuario' (por defecto, todo el que entra con Google) y 'admin'
-- (además administra activos, importaciones y usuarios). Los usuarios existentes quedan
-- como 'usuario'; el primer admin se asigna una sola vez con:
--
--   UPDATE usuarios SET rol = 'admin' WHERE lower(correo) = lower('correo@ejemplo.com');
--
-- Después, los admins cambian roles desde /admin/usuarios.
-- =============================================================================

BEGIN;

CREATE TYPE rol_usuario AS ENUM ('usuario', 'admin');

-- Con valor por defecto constante, PostgreSQL no reescribe la tabla.
ALTER TABLE usuarios
    ADD COLUMN rol rol_usuario NOT NULL DEFAULT 'usuario';

COMMENT ON COLUMN usuarios.rol IS
    'usuario: acceso a /app. admin: además /admin (activos, importaciones y usuarios).';

COMMIT;
