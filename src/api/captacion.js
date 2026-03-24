// src/api/captacion.js
import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

export const captacionRouter = Router();

// Kanban pipeline de prospectos
captacionRouter.get('/pipeline', async (req, res) => {
  try {
    const prospectos = await prisma.prospecto.findMany({
      orderBy: { ultimoMensaje: 'desc' }
    });
    
    // Agrupar por estado
    const pipeline = prospectos.reduce((acc, p) => {
      acc[p.estado] = acc[p.estado] || [];
      acc[p.estado].push(p);
      return acc;
    }, {});

    res.json(pipeline);
  } catch (error) {
    logger.error('Error fetching pipeline', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Métricas de conversión
captacionRouter.get('/metricas', async (req, res) => {
  try {
    const total = await prisma.prospecto.count();
    const convertidos = await prisma.prospecto.count({ where: { estado: 'convertido' } });
    const perdidos = await prisma.prospecto.count({ where: { estado: 'perdido' } });

    res.json({
      total,
      convertidos,
      perdidos,
      tasaConversion: total > 0 ? (convertidos / total) * 100 : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Historial de un prospecto
captacionRouter.get('/prospectos/:id', async (req, res) => {
  try {
    const prospecto = await prisma.prospecto.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { conversaciones: { orderBy: { timestamp: 'asc' } } }
    });
    if (!prospecto) return res.status(404).json({ error: 'Prospecto no encontrado' });
    res.json(prospecto);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
