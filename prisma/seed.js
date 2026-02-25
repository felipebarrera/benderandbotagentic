import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding database with Multi-Tenant setup...');

    const passwordHash = await bcrypt.hash('admin123', 12);

    const tenantsData = [
        {
            nombre: 'Motel A (Premium)',
            whatsapp_number: '+56900000001',
            whatsapp_phone_id: 'TEST_PHONE_ID_A',
            modo_bot: true,
            prompt_personalizado: 'Eres el asistente del Motel A.',
            telegram_chat_id: '12345',
            activo: true,
            admin: { email: 'admin@motela.cl', nombre: 'Admin A' },
            conversations: [
                { contact: '+56911111111', name: 'Juan Pérez (A)', estado: 'CERRADA', handover: false },
                { contact: '+56922222222', name: 'María López (A)', estado: 'BOT', handover: false }
            ]
        },
        {
            nombre: 'Motel B (Express)',
            whatsapp_number: '+56900000002',
            whatsapp_phone_id: 'TEST_PHONE_ID_B',
            modo_bot: true,
            prompt_personalizado: 'Eres el asistente del Motel B. Responde rápido.',
            telegram_chat_id: '67890',
            activo: true,
            admin: { email: 'admin@motelb.cl', nombre: 'Admin B' },
            conversations: [
                { contact: '+56933333333', name: 'Carlos Ruiz (B)', estado: 'BOT', handover: false },
                { contact: '+56944444444', name: 'Ana Torres (B)', estado: 'HUMANO', handover: true }
            ]
        },
        {
            nombre: 'Repuestos C',
            whatsapp_number: '+56900000003',
            whatsapp_phone_id: 'TEST_PHONE_ID_C',
            modo_bot: false, // Solo atencion humana
            prompt_personalizado: 'Eres Repuestos C.',
            telegram_chat_id: '11111',
            activo: true,
            admin: { email: 'admin@repuestosc.cl', nombre: 'Admin C' },
            conversations: [
                { contact: '+56955555555', name: 'Pedro Soto (C)', estado: 'HUMANO', handover: false }
            ]
        }
    ];

    // Limpiar datos
    await prisma.mensaje.deleteMany();
    await prisma.colaEspera.deleteMany();
    await prisma.conversacion.deleteMany();
    await prisma.agente.deleteMany();
    await prisma.tenant.deleteMany();

    for (const tData of tenantsData) {
        const tenant = await prisma.tenant.create({
            data: {
                nombre: tData.nombre,
                whatsapp_number: tData.whatsapp_number,
                whatsapp_phone_id: tData.whatsapp_phone_id,
                modo_bot: tData.modo_bot,
                prompt_personalizado: tData.prompt_personalizado,
                telegram_chat_id: tData.telegram_chat_id,
                activo: tData.activo
            }
        });

        await prisma.agente.create({
            data: {
                tenant_id: tenant.id,
                email: tData.admin.email,
                password_hash: passwordHash,
                nombre: tData.admin.nombre,
                rol: 'ADMIN'
            }
        });

        for (const c of tData.conversations) {
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

            const msgs = [
                { dir: 'ENTRANTE', text: `Hola al ${tData.nombre}`, intent: 'SALUDO' },
                { dir: 'SALIENTE', text: `¡Hola! Bienvenido a ${tData.nombre}.`, intent: null }
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
    }

    console.log('✅ Seed completed: 3 isolated tenants seeded for data leak testing');
    await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
