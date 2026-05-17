'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Goal, ThrustArea, UomType } from '@/lib/types';
import { MIN_GOAL_WEIGHTAGE } from '@/lib/validations';

const goalFormSchema = z
  .object({
    thrust_area_id: z.string().min(1, 'Select a thrust area.'),
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().optional(),
    uom_type: z.enum(['min', 'max', 'timeline', 'zero']),
    target_value: z.number().nullable(),
    target_date: z.string().nullable(),
    weightage: z
      .number({ message: 'Weightage is required.' })
      .min(MIN_GOAL_WEIGHTAGE, `Weightage must be at least ${MIN_GOAL_WEIGHTAGE}%.`)
      .max(100, 'Weightage cannot exceed 100%.'),
  })
  .superRefine((value, context) => {
    if (value.uom_type === 'timeline' && !value.target_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_date'],
        message: 'Target date is required for timeline goals.',
      });
    }

    if ((value.uom_type === 'min' || value.uom_type === 'max') && (!value.target_value || value.target_value <= 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_value'],
        message: 'Target value must be greater than 0.',
      });
    }
  });

export type GoalFormValues = z.infer<typeof goalFormSchema>;

interface GoalFormProps {
  thrustAreas: ThrustArea[];
  initialGoal?: Goal;
  isSubmitting?: boolean;
  serverError?: string | null;
  submitLabel?: string;
  sharedFieldsReadOnly?: boolean;
  onSubmit: (values: GoalFormValues) => Promise<void>;
  onCancel?: () => void;
}

function getDefaultValues(goal?: Goal): GoalFormValues {
  return {
    thrust_area_id: goal?.thrust_area_id ?? '',
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    uom_type: goal?.uom_type ?? 'min',
    target_value: goal?.target_value === null || goal?.target_value === undefined ? null : Number(goal.target_value),
    target_date: goal?.target_date ?? null,
    weightage: goal?.weightage ? Number(goal.weightage) : MIN_GOAL_WEIGHTAGE,
  };
}

export function GoalForm({
  thrustAreas,
  initialGoal,
  isSubmitting = false,
  serverError,
  submitLabel = initialGoal ? 'Save Goal' : 'Add Goal',
  sharedFieldsReadOnly = false,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: getDefaultValues(initialGoal),
  });

  const uomType = watch('uom_type');
  const descriptionId = initialGoal ? `goal-description-${initialGoal.id}` : 'goal-description-new';

  useEffect(() => {
    reset(getDefaultValues(initialGoal));
  }, [initialGoal, reset]);

  useEffect(() => {
    if (uomType === 'timeline') {
      setValue('target_value', null);
    } else {
      setValue('target_date', null);
    }
  }, [setValue, uomType]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {serverError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="grid gap-2">
        <Label>Thrust Area</Label>
        <Select
          value={watch('thrust_area_id')}
          onValueChange={(value) => setValue('thrust_area_id', value, { shouldValidate: true })}
          disabled={sharedFieldsReadOnly || isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select thrust area" />
          </SelectTrigger>
          <SelectContent>
            {thrustAreas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.thrust_area_id && <p className="text-xs text-destructive">{errors.thrust_area_id.message}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goal-title">Title</Label>
        <Input id="goal-title" disabled={sharedFieldsReadOnly || isSubmitting} {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={descriptionId}>Description</Label>
        <textarea
          id={descriptionId}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={sharedFieldsReadOnly || isSubmitting}
          {...register('description')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>UoM Type</Label>
          <Select
            value={uomType}
            onValueChange={(value) => setValue('uom_type', value as UomType, { shouldValidate: true })}
            disabled={sharedFieldsReadOnly || isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="min">Minimum target</SelectItem>
              <SelectItem value="max">Maximum limit</SelectItem>
              <SelectItem value="timeline">Timeline</SelectItem>
              <SelectItem value="zero">Zero tolerance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="goal-weightage">Weightage</Label>
          <Input
            id="goal-weightage"
            type="number"
            min={MIN_GOAL_WEIGHTAGE}
            max={100}
            disabled={isSubmitting}
            {...register('weightage', { valueAsNumber: true })}
          />
          {errors.weightage && <p className="text-xs text-destructive">{errors.weightage.message}</p>}
        </div>
      </div>

      {uomType !== 'timeline' && uomType !== 'zero' && (
        <div className="grid gap-2">
          <Label htmlFor="goal-target-value">Target Value</Label>
          <Input
            id="goal-target-value"
            type="number"
            step="0.01"
            disabled={sharedFieldsReadOnly || isSubmitting}
            {...register('target_value', {
              setValueAs: (value: string) => (value === '' ? null : Number(value)),
            })}
          />
          {errors.target_value && <p className="text-xs text-destructive">{errors.target_value.message}</p>}
        </div>
      )}

      {uomType === 'timeline' && (
        <div className="grid gap-2">
          <Label htmlFor="goal-target-date">Target Date</Label>
          <Input
            id="goal-target-date"
            type="date"
            disabled={sharedFieldsReadOnly || isSubmitting}
            {...register('target_date')}
          />
          {errors.target_date && <p className="text-xs text-destructive">{errors.target_date.message}</p>}
        </div>
      )}

      {uomType === 'zero' && (
        <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Zero tolerance goals succeed only when the actual value is 0.
        </div>
      )}

      {sharedFieldsReadOnly && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Shared goals allow only weightage edits. Goal details stay linked to the source goal.
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
