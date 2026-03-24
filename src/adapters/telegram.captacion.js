// src/adapters/telegram.captacion.js
import TelegramBot from 'node-telegram-bot-api';
import { handleCaptacion } from '../captacion/handler.js';
import config from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Adaptador de Telegram para el flujo de captación.
 * El handler.js es canal-agnóstico, aquí solo manejamos el transporte.
 */
export function initTelegramCaptacion(token) {
  // Nota: Si el bot ya está siendo usado por otro servicio, 
  // hay que tener cuidado con las colisiones del webhook.
  // Aquí asumimos un bot dedicado o un dispatcher central.
  const bot = new TelegramBot(token, { polling: false });

  return async (req, res) => {
    try {
      const { message } = req.body;
      if (!message?.text) return res.sendStatus(200);

      const userId   = String(message.chat.id);
      const texto    = message.text;
      
      // Extraer metadata si viene de un link /start ref_XXX
      const metadata = { 
        start: message.text.startsWith('/start') 
               ? message.text.split(' ')[1] 
               : null,
        fromName: message.from?.first_name || 'Prospecto'
      };

      logger.info('Mensaje de captación recibido vía Telegram', { userId });

      const respuesta = await handleCaptacion('telegram', userId, texto, metadata);
      
      if (respuesta) {
        await bot.sendMessage(userId, respuesta);
      }
      
      res.sendStatus(200);
    } catch (error) {
      logger.error('Error en adapter Telegram captación', { error: error.message });
      res.sendStatus(500);
    }
  };
}
