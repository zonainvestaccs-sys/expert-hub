import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool

  constructor() {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não encontrado no .env')

    const pool = new Pool({ connectionString: url })
    const adapter = new PrismaPg(pool)

    super({ adapter })

    this.pool = pool
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
    await this.pool.end()
  }

  // ✅ teste simples pra forçar o TS a enxergar delegates
  __typecheck() {
    return [this.user, this.lead, this.deposit]
  }
}
