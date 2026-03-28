import { ReservationService } from '../../services/reservationService.ts';
import type { GraphState } from '../graph.ts';
import { z } from 'zod/v3';

const CancelRequiredFieldsSchema = z.object({
  guestName: z.string({ required_error: 'Guest name is required' }),
  datetime: z.string({ required_error: 'Reservation datetime is required' }),
});

export function createCancellationNode(reservationService: ReservationService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🗑️  Cancelling reservation...`);

    try {
      const validation = CancelRequiredFieldsSchema.safeParse(state);

      if (validation.error) {
        const errorMessages = validation.error.errors.map(e => e.message).join(', ');
        console.log(`⚠️  Validation failed: ${errorMessages}`);
        return {
          actionSuccess: false,
          actionError: errorMessages,
        };
      }

      reservationService.cancelReservation(
        validation.data.guestName,
        new Date(validation.data.datetime),
      );

      console.log(`✅ Reservation cancelled successfully`);

      return {
        actionSuccess: true,
      };

    } catch (error) {
      console.log(`❌ Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        actionSuccess: false,
        actionError: error instanceof Error ? error.message : 'Cancellation failed',
      };
    }
  };
}
