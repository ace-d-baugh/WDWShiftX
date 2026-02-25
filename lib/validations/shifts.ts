import { z } from 'zod'

export const shiftSchema = z.object({
  shift_title: z.string().min(1, 'Shift title is required'),
  property_id: z.string().uuid('Please select a property'),
  location_id: z.string().uuid('Please select a location'),
  role_id: z.string().uuid('Please select a role'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  is_trade: z.boolean().default(false),
  is_giveaway: z.boolean().default(false),
  is_overtime_approved: z.boolean().default(false),
  comments: z.string().optional(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'End time must be after start time',
  path: ['end_time'],
}).refine(data => data.is_trade || data.is_giveaway, {
  message: 'Must select Trade or Giveaway (or both)',
  path: ['is_trade'],
})

export const requestSchema = z.object({
  property_id: z.string().uuid('Please select a property'),
  location_id: z.string().uuid('Please select a location'),
  role_id: z.string().uuid('Please select a role'),
  requested_date: z.string().min(1, 'Date is required'),
  preferred_times: z.array(z.enum(['morning', 'afternoon', 'evening', 'late'])).min(1, 'Select at least one time preference'),
  comments: z.string().optional(),
})

export type ShiftInput = z.infer<typeof shiftSchema>
export type RequestInput = z.infer<typeof requestSchema>
