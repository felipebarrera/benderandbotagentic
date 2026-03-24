// src/captacion/calculadora.js
const TARIFAS = {
  psicologo:     { sesion: 35000, porHora: 1,   label: 'sesión' },
  medico:        { sesion: 45000, porHora: 1,   label: 'consulta' },
  dentista:      { sesion: 55000, porHora: 1,   label: 'atención' },
  abogado:       { sesion: 85000, porHora: 1,   label: 'hora profesional' },
  gasfiter:      { sesion: 35000, porHora: 0.5, label: 'trabajo' },
  mecanico:      { sesion: 45000, porHora: 0.3, label: 'servicio' },
  profesor:      { sesion: 20000, porHora: 1,   label: 'clase' },
  nutricionista: { sesion: 30000, porHora: 1,   label: 'consulta' },
  kinesiologo:   { sesion: 30000, porHora: 1,   label: 'sesión' },
  fonoaudiologo: { sesion: 30000, porHora: 1,   label: 'sesión' },
};

/**
 * Calcula el ingreso estimado basado en la profesión y horas disponibles.
 * @param {string} profesion 
 * @param {number} horasLibres 
 * @returns {object|null}
 */
export function calcular(profesion, horasLibres) {
  const norm = profesion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const t = TARIFAS[norm];
  if (!t) return null;
  
  const sesiones = Math.floor(horasLibres * t.porHora);
  const semana   = sesiones * t.sesion;
  
  return {
    sesiones,
    semana,
    mes:  semana * 4,
    anio: semana * 48,
    label: t.label,
    tarifaReferencia: t.sesion
  };
}
