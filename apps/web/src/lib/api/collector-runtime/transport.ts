import { z } from "zod";

export const NonEmptyStringSchema = z.string().min(1);

export const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();
