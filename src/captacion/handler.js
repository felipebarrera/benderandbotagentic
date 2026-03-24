// src/captacion/handler.js
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { detectarPerfil } from './perfilDetector.js';
import { manejarFlujoProfesional } from './flujos/profesional.js';
import { manejarFlujoNegocio } from './flujos/negocio.js';

/**
 * Orquestador principal de captación.
 * Clasifica prospectos nuevos y dirige la conversación según el estado.
 */
export async function handleCaptacion(canal, canalId, texto, metadata = {}) {
  try {
    // 1. Buscar o crear prospecto
    let prospecto = await prisma.prospecto.findFirst({
      where: { canal, canalId }
    });

    if (!prospecto) {
      prospecto = await prisma.prospecto.create({
        data: {
          canal,
          canalId,
          refTenantSlug: metadata.start && metadata.start.startsWith('ref_') 
                           ? metadata.start.replace('ref_', '') 
                           : null,
          estado: 'nuevo'
        }
      });
      logger.info('Nuevo prospecto creado', { canal, canalId, id: prospecto.id });
    }

    // 2. Guardar mensaje entrante
    await prisma.conversacionCaptacion.create({
      data: {
        prospectoId: prospecto.id,
        canal,
        rol: 'user',
        contenido: texto,
        timestamp: new Date()
      }
    });

    // 3. Obtener historial reciente para el LLM
    const historialRaw = await prisma.conversacionCaptacion.findMany({
      where: { prospectoId: prospecto.id },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    const historial = historialRaw.reverse().map(m => `${m.rol === 'bot' ? 'Bot' : 'Usuario'}: ${m.contenido}`).join('\n');

    // 4. Si es "nuevo", detectar perfil
    if (prospecto.estado === 'nuevo') {
      const { perfil, rubro } = await detectarPerfil(texto);
      prospecto = await prisma.prospecto.update({
        where: { id: prospecto.id },
        data: { 
          perfil, 
          rubroDetectado: rubro,
          estado: (perfil === 'REFERIDO') ? 'demo' : 'calculadora'
        }
      });
    }

    // 5. Delegar al flujo correspondiente
    let respuesta = "";
    
    switch (prospecto.perfil) {
      case 'PROFESIONAL':
        respuesta = await manejarFlujoProfesional(prospecto, texto, historial);
        break;
      case 'NEGOCIO':
        respuesta = await manejarFlujoNegocio(prospecto, texto, historial);
        break;
      case 'REFERIDO':
        // Lógica simple de referido inline por ahora
        if (texto.toLowerCase().includes('profe') || texto.toLowerCase().includes('inde')) {
           await prisma.prospecto.update({ where: { id: prospecto.id }, data: { perfil: 'PROFESIONAL', estado: 'demo' } });
           respuesta = "¡Excelente! Como vienes referido, tienes 45 días de prueba gratis. Cuéntame, ¿cuál es tu mayor dolor hoy manejando tus clientes?";
        } else if (texto.toLowerCase().includes('nego') || texto.toLowerCase().includes('local')) {
           await prisma.prospecto.update({ where: { id: prospecto.id }, data: { perfil: 'NEGOCIO', estado: 'demo' } });
           respuesta = "¡Perfecto! Al ser referido, tu prueba gratis es de 45 días. ¿Cómo llevas hoy el control de stock y ventas en tu negocio?";
        } else {
           respuesta = "¡Bienvenido! Vienes recomendado por un usuario de BenderAnd. Para darte tus 45 días de regalo, cuéntame: ¿Eres profesional independiente o tienes un negocio?";
        }
        break;
      default:
        respuesta = "¡Hola! Cuéntame un poco más sobre lo que haces para poder ayudarte mejor.";
    }


    // 5. Guardar y retornar respuesta del bot
    await prisma.conversacionCaptacion.create({
      data: {
        prospectoId: prospecto.id,
        canal,
        rol: 'bot',
        contenido: respuesta,
        timestamp: new Date()
      }
    });

    return respuesta;

  } catch (error) {
    logger.error('Error en handleCaptacion', { error: error.message, stack: error.stack });
    return "Hola, disculpa. Estoy teniendo un problema técnico momentáneo. ¿Podrías escribirme de nuevo en un minuto?";
  }
}
