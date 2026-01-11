/**
 * Zod schemas for validating graph JSON data
 * @module loaders/graphSchema
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive Schemas
// ---------------------------------------------------------------------------

/**
 * Position tuple: [x, y, z] coordinates
 */
export const positionSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

/**
 * Feature identifier within a model
 */
export const featureIdSchema = z.object({
  modelId: z.string().min(1, 'modelId cannot be empty'),
  layer: z.number().int().min(0).max(100, 'layer must be 0-100'),
  index: z.number().int().min(0, 'index must be non-negative'),
});

// ---------------------------------------------------------------------------
// Node Schema
// ---------------------------------------------------------------------------

/**
 * A node in the graph representing a single SAE feature
 */
export const graphNodeJSONSchema = z.object({
  id: z.string().min(1, 'node id cannot be empty'),
  featureId: featureIdSchema,
  position: positionSchema,
  label: z.string().optional(),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Edge Schema
// ---------------------------------------------------------------------------

/**
 * Valid edge types
 */
export const edgeTypeSchema = z.enum(['coactivation', 'attention', 'circuit']);

/**
 * A directional edge connecting two nodes
 */
export const graphEdgeJSONSchema = z.object({
  id: z.string().min(1, 'edge id cannot be empty'),
  source: z.string().min(1, 'source cannot be empty'),
  target: z.string().min(1, 'target cannot be empty'),
  weight: z.number().min(0).max(1, 'weight must be between 0 and 1'),
  type: edgeTypeSchema,
});

// ---------------------------------------------------------------------------
// Metadata Schema
// ---------------------------------------------------------------------------

/**
 * Graph metadata from JSON
 */
export const graphMetadataJSONSchema = z.object({
  modelId: z.string().min(1, 'modelId cannot be empty'),
  layers: z.array(z.number().int().min(0)).min(1, 'at least one layer required'),
  version: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Complete Graph Schema
// ---------------------------------------------------------------------------

/**
 * Complete graph JSON schema
 */
export const graphJSONSchema = z.object({
  metadata: graphMetadataJSONSchema,
  nodes: z.array(graphNodeJSONSchema).min(1, 'at least one node required'),
  edges: z.array(graphEdgeJSONSchema),
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type FeatureIdJSON = z.infer<typeof featureIdSchema>;
export type GraphNodeJSON = z.infer<typeof graphNodeJSONSchema>;
export type GraphEdgeJSON = z.infer<typeof graphEdgeJSONSchema>;
export type GraphMetadataJSON = z.infer<typeof graphMetadataJSONSchema>;
export type GraphJSONSchema = z.infer<typeof graphJSONSchema>;

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Format Zod errors into human-readable messages
 */
export function formatValidationErrors(errors: z.ZodError['errors']): string[] {
  return errors.map((error) => {
    const path = error.path.join('.');
    return path ? `${path}: ${error.message}` : error.message;
  });
}
