// src/captacion/reactivacion.js
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { sendTextMessage } from '../whatsapp/sender.js';
import config from '../config/index.js';
import { subDays } from 'date-fns';

/**
 * Busca prospectos estancados en estado 'demo' y les envía un mensaje de seguimiento.
 */
export async function procesarReactivaciones() {
  const diasReactivacion = parseInt(process.env.CAPTACION_REACTIVACION_DIAS || '7');
  const fechaLimite = subDays(new Date(), diasReactivacion);

  try {
    const prospectosEstancados = await prisma.prospecto.findMany({
      where: {
        estado: 'demo',
        ultimoMensaje: { lt: fechaLimite }
      }
    });

    logger.info(`Iniciando reactivación para ${prospectosEstancados.length} prospectos`);

    for (const p of prospectosEstancados) {
      const mensaje = `¡Hola ${p.nombre || ''}! 👋 Pasaba por aquí para ver si pudiste probar el sistema. ` +
                     `¿Te quedó alguna duda con los números que calculamos? Estoy aquí para ayudarte a empezar.`;

      if (p.canal === 'whatsapp') {
        await sendTextMessage(p.canalId, mensaje, config.whatsapp.phoneId, config.whatsapp.token);
      }
      
      // Actualizamos para no volver a reactivar inmediatamente
      await prisma.prospecto.update({
        where: { id: p.id },
        data: { ultimoMensaje: new Date() }
      });
      
      logger.info('Prospecto reactivado', { id: p.id, canalId: p.canalId });
    }
  } catch (error) {
    logger.error('Error en job de reactivación', { error: error.message });
  }
}
