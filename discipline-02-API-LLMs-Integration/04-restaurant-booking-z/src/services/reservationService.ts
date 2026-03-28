// ─── Seating preferences ────────────────────────────────────────────────────
export type SeatingPreference = 'indoor' | 'outdoor' | 'bar' | 'private';

// ─── Tables ──────────────────────────────────────────────────────────────────
export const tables = [
    { id: 1, capacity: 2, section: 'indoor' as SeatingPreference },
    { id: 2, capacity: 2, section: 'indoor' as SeatingPreference },
    { id: 3, capacity: 4, section: 'indoor' as SeatingPreference },
    { id: 4, capacity: 4, section: 'outdoor' as SeatingPreference },
    { id: 5, capacity: 4, section: 'bar' as SeatingPreference },
    { id: 6, capacity: 8, section: 'private' as SeatingPreference },
];

// ─── Seed reservations ────────────────────────────────────────────────────────
const today = new Date();
const todayAtLunch = new Date(today);
todayAtLunch.setUTCHours(12, 0, 0, 0);

const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);
const tomorrowAtDinner = new Date(tomorrow);
tomorrowAtDinner.setUTCHours(19, 0, 0, 0);

export type Reservation = {
    tableId: number;
    guestName: string;
    partySize: number;
    datetime: string;
    seatingPreference: SeatingPreference;
    specialOccasion?: string;
};

const reservations: Reservation[] = [
    {
        tableId: 3,
        guestName: 'Família Silva',
        partySize: 4,
        datetime: todayAtLunch.toISOString(),
        seatingPreference: 'indoor',
    },
    {
        tableId: 1,
        guestName: 'Mariana Costa',
        partySize: 2,
        datetime: tomorrowAtDinner.toISOString(),
        seatingPreference: 'indoor',
        specialOccasion: 'aniversário',
    },
];

// ─── Service hours ────────────────────────────────────────────────────────────
const SERVICE_WINDOWS = [
    { label: 'lunch', startHour: 12, endHour: 15 },
    { label: 'dinner', startHour: 19, endHour: 23 },
];

// ─── ReservationService ───────────────────────────────────────────────────────
export class ReservationService {

    isWithinServiceHours(date: Date): boolean {
        const hour = date.getUTCHours();
        return SERVICE_WINDOWS.some(w => hour >= w.startHour && hour < w.endHour);
    }

    findAvailableTable(partySize: number, datetime: Date, preference?: SeatingPreference): typeof tables[number] | undefined {
        // Filter tables that fit the party and match preference (if given)
        const candidates = tables.filter(t => {
            const fitsParty = t.capacity >= partySize;
            const matchesPreference = !preference || t.section === preference;
            return fitsParty && matchesPreference;
        });

        // Return first table not already booked at that datetime
        return candidates.find(table => {
            const alreadyBooked = reservations.some(
                r => r.tableId === table.id && new Date(r.datetime).getTime() === datetime.getTime()
            );
            return !alreadyBooked;
        });
    }

    findReservationByGuest(guestName: string, datetime?: Date): Reservation | undefined {
        return reservations.find(r =>
            r.guestName.toLowerCase() === guestName.toLowerCase() &&
            (!datetime || new Date(r.datetime).getTime() === datetime.getTime())
        );
    }

    bookReservation(
        guestName: string,
        partySize: number,
        datetime: Date,
        seatingPreference: SeatingPreference,
        specialOccasion?: string,
    ): Reservation {
        if (!this.isWithinServiceHours(datetime)) {
            throw new Error(
                'Reservas são aceitas somente durante o almoço (12h–15h) ou jantar (19h–23h).'
            );
        }

        // Prevent same-name double booking on the same day
        const sameDay = reservations.find(r => {
            const sameGuest = r.guestName.toLowerCase() === guestName.toLowerCase();
            const sameDate = new Date(r.datetime).toDateString() === datetime.toDateString();
            return sameGuest && sameDate;
        });
        if (sameDay) {
            throw new Error(`Já existe uma reserva para "${guestName}" neste dia (${datetime.toDateString()}).`);
        }

        const table = this.findAvailableTable(partySize, datetime, seatingPreference);
        if (!table) {
            throw new Error(
                `Não há mesas disponíveis para ${partySize} pessoa(s) no horário solicitado com a preferência "${seatingPreference}".`
            );
        }

        const newReservation: Reservation = {
            tableId: table.id,
            guestName,
            partySize,
            datetime: datetime.toISOString(),
            seatingPreference,
            specialOccasion,
        };

        reservations.push(newReservation);
        return newReservation;
    }

    cancelReservation(guestName: string, datetime: Date): void {
        const reservation = this.findReservationByGuest(guestName, datetime);
        if (!reservation) {
            throw new Error('Reserva não encontrada. Verifique o nome e o horário informados.');
        }

        const index = reservations.indexOf(reservation);
        reservations.splice(index, 1);
    }
}
