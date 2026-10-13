// Contraseñas desechables generadas al vuelo para servidores temporales de
// validación, simulación y pruebas. Nunca hay contraseñas escritas en el código.
import { randomBytes } from 'node:crypto';

export const randomSecret = () => randomBytes(18).toString('base64url');
