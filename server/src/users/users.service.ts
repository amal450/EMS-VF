import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../db/database.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) 
    private db: NodePgDatabase<typeof schema>
  ) {}

  async findAll() {
    return await this.db.select().from(schema.users);
  }

  async create(data: any) {
    const { id, permissions, ...userData } = data; 
    try {
      const newUser = await this.db.insert(schema.users).values({
        username: userData.username,
        email: userData.email,
        password: userData.password, 
        role: userData.role || 'AGENT'
      }).returning();

      if (permissions && permissions.length > 0 && newUser[0]) {
        await this.assignPermissions(newUser[0].id, permissions);
      }

      return newUser;
    } catch (error: any) {
      const code = error?.cause?.code || error?.code;
      if (code === '23505' || /duplicate key value/.test(error?.message || '')) {
        throw new BadRequestException('Cet email est déjà utilisé par un autre compte.');
      }
      throw error;
    }
  }

  async assignPermissions(userId: number, permissionIds: number[]) {
    if (!permissionIds || permissionIds.length === 0) return;
    
    // Delete existing permissions
    await this.db.delete(schema.user_permissions).where(eq(schema.user_permissions.userId, userId));
    
    // Insert new permissions
    for (const permId of permissionIds) {
      await this.db.insert(schema.user_permissions).values({
        userId,
        permissionId: permId
      });
    }
  }

  async getUserPermissions(userId: number) {
    const result = await this.db
      .select({
        id: schema.permissions.id,
        code: schema.permissions.code,
        name: schema.permissions.name,
        description: schema.permissions.description
      })
      .from(schema.user_permissions)
      .innerJoin(schema.permissions, eq(schema.user_permissions.permissionId, schema.permissions.id))
      .where(eq(schema.user_permissions.userId, userId));
    
    return result;
  }

  async getAllPermissions() {
    try {
      const perms = await this.db.select().from(schema.permissions);
      console.log('[DEBUG] getAllPermissions returned:', perms);
      return perms;
    } catch (error) {
      console.error('[ERROR] getAllPermissions failed:', error);
      return [];
    }
  }

  async update(id: number, data: any) {
    const { id: _, permissions, password, ...updateData } = data;
    
    if (password) {
      updateData.password = password;
    }

    try {
      const updated = await this.db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning();

      if (permissions) {
        await this.assignPermissions(id, permissions);
      }

      return Array.isArray(updated) && updated.length > 0 ? updated[0] : updated;
    } catch (error: any) {
      const code = error?.cause?.code || error?.code;
      if (code === '23505' || /duplicate key value/.test(error?.message || '')) {
        throw new BadRequestException('Cet email est déjà utilisé par un autre compte.');
      }
      throw error;
    }
  }

  async remove(id: number) {
    return await this.db
      .delete(schema.users)
      .where(eq(schema.users.id, id));
  }

  async findByEmail(email: string) {
    return await this.db.query.users.findFirst({
      where: eq(schema.users.email, email)
    });
  }

  // Comparaison directe (string === string)
  async validatePassword(plain: string, stored: string): Promise<boolean> {
    return plain.trim() === stored.trim();
  }
  
  async updatePassword(id: number, password: string) {
    return await this.db.update(schema.users)
      .set({ password })
      .where(eq(schema.users.id, id))
      .returning();
  }

  async hasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const result = await this.db
      .select({ id: schema.permissions.id })
      .from(schema.user_permissions)
      .innerJoin(schema.permissions, eq(schema.user_permissions.permissionId, schema.permissions.id))
      .where(
        inArray(schema.user_permissions.userId, [userId]) 
      );

    // Filter by code in application
    const permissions = await this.getUserPermissions(userId);
    return permissions.some(p => p.code === permissionCode);
  }
}
