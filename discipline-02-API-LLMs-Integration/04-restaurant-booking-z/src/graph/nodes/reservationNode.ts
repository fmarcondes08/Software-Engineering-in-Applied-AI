import { ReservationService } from '../../services/reservationService.ts';
import type { GraphState } from '../graph.ts';
import { z } from 'zod/v3';

const ReserveRequiredFieldsSchema = z.object({
  guestName: z.string({ required_error: 'Guest name is required' }),
  partySize: z.number({ required_error: 'Party size is required' }),
  datetime: z.string({ required_error: 'Reservation datetime is required' }),
});

export function createReservationNode(reservationService: ReservationService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`🍽️  Creating reservation...`);

    try {
      const validation = ReserveRequiredFieldsSchema.safeParse(state);

      if (!validation.success) {
        const errorMessages = validation.error.errors.map(e => e.message).join(', ');
        console.log(`⚠️  Validation failed: ${errorMessages}`);
        return {
          actionSuccess: false,
          actionError: errorMessages,
        };
      }

      const reservation = reservationService.bookReservation(
        validation.data.guestName,
        validation.data.partySize,
        new Date(validation.data.datetime),
        state.seatingPreference ?? 'indoor',
        state.specialOccasion,
      );

      console.log(`✅ Reservation created successfully for table ${reservation.tableId}`);

      return {
        ...state,
        actionSuccess: true,
        reservationData: reservation,
      };

    } catch (error) {
      console.log(`❌ Reservation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        ...state,
        actionSuccess: false,
        actionError: error instanceof Error ? error.message : 'Reservation failed',
      };
    }
  };
}
