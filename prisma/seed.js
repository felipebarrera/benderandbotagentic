import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const tenant = await prisma.tenant.upsert({
        where: { whatsapp_number: '+56900000001' },
        update: {},
        create: {
            nombre: 'Motel Test',
            whatsapp_number: '+56900000001',
            whatsapp_phone_id: 'TEST_PHONE_ID',
            modo_bot: true,
        },
    });

    const password_hash = await bcrypt.hash('admin123', 10);

    await prisma.agente.upsert({
        where: { email: 'admin@test.cl' },
        update: {},
        create: {
            tenant_id: tenant.id,
            email: 'admin@test.cl',
            password_hash,
            nombre: 'Admin Test',
            rol: 'ADMIN',
        },
    });

    console.log('Seed exitoso');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
