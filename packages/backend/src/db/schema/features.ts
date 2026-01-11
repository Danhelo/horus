import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Feature data structure stored as JSON
 */
export interface FeatureData {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  description?: string;
  explanations?: Array<{
    description: string;
    score: number;
  }>;
  topLogits?: Array<{
    token: string;
    value: number;
  }>;
}

/**
 * Feature cache table - stores Neuronpedia feature data
 */
export const features = sqliteTable(
  'features',
  {
    id: text('id').primaryKey(), // Format: modelId:layer:index
    modelId: text('model_id').notNull(),
    layer: integer('layer').notNull(),
    featureIndex: integer('feature_index').notNull(),
    data: text('data', { mode: 'json' }).$type<FeatureData>().notNull(),
    cachedAt: integer('cached_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    modelLayerIdx: index('features_model_layer_idx').on(table.modelId, table.layer),
    expiresIdx: index('features_expires_idx').on(table.expiresAt),
  })
);

export type Feature = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;
