import { z } from "zod";

export const menuPriceSchema = z.object({
  label: z.string().min(1).nullable(),
  amount: z
    .string()
    .regex(/^\d+(?:[.,]\d{1,2})?$/)
    .nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
});

export const menuVariantSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).nullable(),
  amount: z
    .string()
    .regex(/^\d+(?:[.,]\d{1,2})?$/)
    .nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
});

export const menuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).nullable(),
  prices: z.array(menuPriceSchema),
  variants: z.array(menuVariantSchema),
});

export const generatedMenuSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().min(1),
      items: z.array(menuItemSchema),
    }),
  ),
});

export type MenuPrice = z.infer<typeof menuPriceSchema>;
export type MenuVariant = z.infer<typeof menuVariantSchema>;
export type GeneratedMenu = z.infer<typeof generatedMenuSchema>;
