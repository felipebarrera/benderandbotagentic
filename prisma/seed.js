import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding database...');

    // Create tenant
    const tenant = await prisma.tenant.upsert({
        where: { whatsapp_number: '+56900000001' },
        update: { telegram_chat_id: '12345' },
        create: {
            nombre: 'Motel Test',
            whatsapp_number: '+56900000001',
            whatsapp_phone_id: 'TEST_PHONE_ID',
            modo_bot: true,
            prompt_personalizado: 'Somos un motel ubicado en Santiago. Tenemos habitaciones estándar y suites.',
            telegram_chat_id: '12345',
            activo: true
        }
    });

    // Create admin agent
    const passwordHash = await bcrypt.hash('admin123', 12);
    const admin = await prisma.agente.upsert({
        where: { email: 'admin@test.cl' },
        update: { password_hash: passwordHash },
        create: {
            tenant_id: tenant.id,
            email: 'admin@test.cl',
            password_hash: passwordHash,
            nombre: 'Admin Test',
            rol: 'ADMIN'
        }
    });

    // Create sample conversations
    const convs = [
        { contact: '+56911111111', name: 'Juan Pérez', estado: 'CERRADA', handover: false },
        { contact: '+56922222222', name: 'María López', estado: 'CERRADA', handover: true },
        { contact: '+56933333333', name: 'Carlos Ruiz', estado: 'BOT', handover: false },
        { contact: '+56944444444', name: 'Ana Torres', estado: 'HUMANO', handover: true },
        { contact: '+56955555555', name: 'Pedro Soto', estado: 'CERRADA', handover: false }
    ];

    for (const c of convs) {
        const conv = await prisma.conversacion.create({
            data: {
                tenant_id: tenant.id,
                whatsapp_contact: c.contact,
                contact_name: c.name,
                estado: c.estado,
                ultimo_mensaje_at: new Date(),
                handover_at: c.handover ? new Date() : null,
                handover_resolved_at: c.estado === 'CERRADA' && c.handover ? new Date() : null,
                handover_resolution: c.estado === 'CERRADA' && c.handover ? 'tomado' : null
            }
        });

        // Add sample messages per conversation
        const intents = ['SALUDO', 'DISPONIBILIDAD', 'PRECIOS', 'DESCONOCIDO', 'SALUDO'];
        const msgs = [
            { dir: 'ENTRANTE', text: 'Hola buenas noches', intent: intents[convs.indexOf(c)] },
            { dir: 'SALIENTE', text: '¡Hola! Bienvenido/a a Motel Test. ¿En qué te puedo ayudar?', intent: null },
            { dir: 'ENTRANTE', text: 'Tienen pieza disponible?', intent: 'DISPONIBILIDAD' },
            { dir: 'SALIENTE', text: 'Sí, tenemos habitaciones disponibles esta noche.', intent: null }
        ];

        for (let i = 0; i < msgs.length; i++) {
            await prisma.mensaje.create({
                data: {
                    conversacion_id: conv.id,
                    tenant_id: tenant.id,
                    whatsapp_message_id: `seed_${conv.id}_${i}`,
                    direccion: msgs[i].dir,
                    tipo: 'TEXTO',
                    contenido: msgs[i].text,
                    intent_detected: msgs[i].intent,
                    created_at: new Date(Date.now() - (msgs.length - i) * 60000)
                }
            });
        }
    }

    console.log('✅ Seed completed: 1 tenant, 1 admin, 5 conversations with messages');
    await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
