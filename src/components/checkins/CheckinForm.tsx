'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Quarter } from '@/lib/types';
import { MessageSquarePlus } from 'lucide-react';

const quarters: Exclude<Quarter, 'Annual'>[] = ['Q1', 'Q2', 'Q3', 'Q4'];

interface CheckinFormProps {
  isSubmitting?: boolean;
  defaultQuarter?: Exclude<Quarter, 'Annual'>;
  onSubmit: (values: { quarter: Exclude<Quarter, 'Annual'>; comment: string }) => Promise<void>;
}

export function CheckinForm({ isSubmitting = false, defaultQuarter = 'Q1', onSubmit }: CheckinFormProps) {
  const [quarter, setQuarter] = useState<Exclude<Quarter, 'Annual'>>(defaultQuarter);
  const [comment, setComment] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ quarter, comment });
    setComment('');
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="grid gap-2">
          <Label>Quarter</Label>
          <Select value={quarter} onValueChange={(value) => setQuarter(value as Exclude<Quarter, 'Annual'>)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="checkin-comment">Comment</Label>
          <textarea
            id="checkin-comment"
            className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add coaching notes, risks, or next steps"
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting || comment.trim().length < 3}>
        <MessageSquarePlus className="h-4 w-4" />
        {isSubmitting ? 'Saving...' : 'Add Check-in'}
      </Button>
    </form>
  );
}
