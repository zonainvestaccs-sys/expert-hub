require('dotenv').config()

const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrado no .env')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  const email = 'admin@experthub.local'
  const password = 'admin123'

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Admin criado/atualizado:', email)
  console.log('Senha:', password)
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
