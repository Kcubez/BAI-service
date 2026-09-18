import * as z from "zod";

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email({ message: "Valid email required" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Valid email required" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(/[A-Z]/, { message: "Must contain at least one uppercase letter" })
      .regex(/[0-9]/, { message: "Must contain at least one number" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Admin / User Management Schemas ────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Valid email required" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  role: z.enum(["user", "admin"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Valid email required" }),
  role: z.enum(["user", "admin"]),
});

// ─── Finance ───────────────────────────────────────────────────────────────

export const financeEntrySchema = z.object({
  entryDate: z.coerce.date(),
  type: z.enum(["salary", "cogs", "operating_expense", "payment", "receivable", "debt", "voucher", "owner_capital"]),
  title: z.string().trim().min(1, "Title is required").max(160),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  status: z.enum(["recorded", "pending", "paid", "settled", "overdue"]).default("recorded"),
  counterparty: z.string().trim().max(160).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  voucherNumber: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ─── Customers ───────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateCustomerSchema = z.object({
  id: z.string().min(1, { message: "ID is required" }),
  name: z.string().optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  company: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.string().trim().max(40).optional(),
});

// ─── Demand Records ──────────────────────────────────────────────────────────

const optionalNumberInput = z
  .union([z.number(), z.string().trim().max(40), z.null()])
  .optional()
  .nullable();

export const createDemandRecordSchema = z.object({
  customerName: z.string().trim().max(200).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  customerCompany: z.string().trim().max(200).optional().nullable(),
  serviceName: z.string().trim().max(200).optional().nullable(),
  serviceAmount: optionalNumberInput,
  serviceQty: optionalNumberInput,
  followUpDate: z.union([z.string().trim().max(40), z.null()]).optional().nullable(),
  priority: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  note: z.string().max(5000).optional().nullable(),
  reportType: z.string().trim().max(40).optional(),
});

// ─── Staff Senders ───────────────────────────────────────────────────────────

export const createSenderSchema = z.object({
  email: z.string().trim().min(1, { message: "Email is required" }),
  allowedDepartments: z.array(z.string()).optional(),
});

export const updateSenderSchema = z.object({
  isAuthorized: z.boolean().optional(),
  allowedDepartments: z.array(z.string()).optional(),
});

// ─── Bot Settings ────────────────────────────────────────────────────────────

export const updateBotSettingsSchema = z.object({
  botToken: z.string().max(500).optional().nullable(),
  geminiApiKey: z.string().max(500).optional().nullable(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
export type FinanceEntryFormValues = z.infer<typeof financeEntrySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateDemandRecordInput = z.infer<typeof createDemandRecordSchema>;
export type CreateSenderInput = z.infer<typeof createSenderSchema>;
export type UpdateSenderInput = z.infer<typeof updateSenderSchema>;
export type UpdateBotSettingsInput = z.infer<typeof updateBotSettingsSchema>;
