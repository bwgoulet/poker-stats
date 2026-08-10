import { z } from 'zod';
export const playerSchema=z.object({id:z.string().min(1),displayName:z.string().min(1),aliases:z.array(z.string())});
export const nightSchema=z.object({id:z.string().min(1),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),title:z.string(),seasonId:z.string().regex(/^[a-z][a-z0-9-]*-\d{4}$/),nightType:z.enum(['10','20','50','one-off']),notes:z.string().optional()});
export const resultSchema=z.object({nightId:z.string(),playerId:z.string(),buyIn:z.number().finite().nonnegative(),cashOut:z.number().finite().nonnegative(),profit:z.number().finite(),placement:z.number().int().positive().optional(),sourceName:z.string()});
