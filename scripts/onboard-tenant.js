import inquirer from 'inquirer';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Moteland - Asistente de Onboarding de Tenants\n');

    try {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'nombre',
                message: 'Nombre del Tenant (Ej: Motel Paradiso):',
                validate: input => input.trim() !== '' ? true : 'El nombre es requerido'
            },
            {
                type: 'input',
                name: 'whatsapp_number',
                message: 'Número de WhatsApp registrado (formato +569XXXXXXXX):',
                validate: input => /^\+\d{10,14}$/.test(input) ? true : 'Formato inválido (ej: +56912345678)'
            },
            {
                type: 'input',
                name: 'whatsapp_phone_id',
                message: 'WhatsApp Phone ID oficial de Meta:',
                validate: input => input.trim() !== '' ? true : 'Phone ID es requerido'
            },
            {
                type: 'input',
                name: 'telegram_chat_id',
                message: 'Telegram Chat ID del Dueño (para alertas handover):'
            },
            {
                type: 'input',
                name: 'admin_nombre',
                message: 'Nombre del Agente Admin:',
                validate: input => input.trim() !== '' ? true : 'Nombre es requerido'
            },
            {
                type: 'input',
                name: 'admin_email',
                message: 'Email del Agente Admin:',
                validate: input => /\S+@\S+\.\S+/.test(input) ? true : 'Email inválido'
            },
            {
                type: 'password',
                name: 'admin_password',
                message: 'Contraseña del Agente Admin:',
                validate: input => input.length >= 6 ? true : 'Mínimo 6 caracteres'
            }
        ]);

        console.log('\n⏳ Creando tenant y cifrando credenciales...');

        const passwordHash = await bcrypt.hash(answers.admin_password, 12);
        const verifyToken = crypto.randomBytes(16).toString('hex'); // Token interno para verificar webhook si hay multiples PBs

        // Prisma Transaction para asegurar atomicidad
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear Tenant
            const newTenant = await tx.tenant.create({
                data: {
                    nombre: answers.nombre,
                    whatsapp_number: answers.whatsapp_number,
                    whatsapp_phone_id: answers.whatsapp_phone_id,
                    modo_bot: true,
                    activo: true,
                    telegram_chat_id: answers.telegram_chat_id || null,
                }
            });

            // 2. Crear Admin
            const newAdmin = await tx.agente.create({
                data: {
                    tenant_id: newTenant.id,
                    email: answers.admin_email,
                    password_hash: passwordHash,
                    nombre: answers.admin_nombre,
                    rol: 'ADMIN',
                    online: false
                }
            });

            return { tenant: newTenant, admin: newAdmin };
        });

        console.log('\n✅ ¡Tenant creado exitosamente!\n');
        console.log('--- DETALLES ---');
        console.log(`🏢 ID Tenant: ${result.tenant.id}`);
        console.log(`👤 ID Admin:  ${result.admin.id}`);
        console.log(`🌐 Acceso URL: https://admin.moteland.cl`);
        console.log(`📧 Login:     ${answers.admin_email}`);
        console.log('----------------\n');
        console.log('Para conectar el webhook a Meta, usa este comando y asegúrate de que Meta envíe al mismo servidor de API.');

    } catch (error) {
        console.error('\n❌ Hubo un error al crear el tenant:', error.message);
        if (error.code === 'P2002') {
            console.error('El número de WhatsApp o el email ya están registrados en otro tenant.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
