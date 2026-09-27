import {sqliteTable,text,primaryKey} from 'drizzle-orm/sqlite-core';
export const companyMembers=sqliteTable('company_members',{companyId:text('company_id').notNull(),email:text('email').notNull(),role:text('role',{enum:['admin','member']}).notNull(),addedBy:text('added_by').notNull(),updatedAt:text('updated_at').notNull()},table=>[primaryKey({columns:[table.companyId,table.email]})]);
export const companyAudit=sqliteTable('company_audit',{id:text('id').primaryKey(),companyId:text('company_id').notNull(),actor:text('actor').notNull(),action:text('action').notNull(),target:text('target').notNull(),createdAt:text('created_at').notNull()});

export const companyBrands=sqliteTable('company_brands',{id:text('id').notNull(),companyId:text('company_id').notNull(),name:text('name').notNull(),website:text('website').notNull(),createdAt:text('created_at').notNull()},table=>[primaryKey({columns:[table.companyId,table.id]})]);
