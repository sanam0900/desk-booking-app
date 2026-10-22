# Desk Booking App — Project Specification

## Objective

A web application that allows users to reserve desks in a shared office space. Users can view desk availability, make bookings for specific time slots, and manage their own reservations. The system prevents double bookings and enforces booking rules.

## User Roles

- **Regular User** — can register, log in, view available desks, create and cancel own bookings
- **Admin** — can manage desks (add/remove), view all bookings, cancel any booking

## Main Scenarios

1. A user registers, logs in, views available desks for a chosen date/time, and books one
2. A user tries to book a desk already taken — system rejects it with an error
3. A user cancels their own booking — desk becomes available again
4. An admin adds a new desk to the system
5. A user tries to book a desk in the past — system rejects it

## Acceptance Criteria

1. **Successful booking** — When a logged-in user selects an available desk and a valid future time slot (start < end), the booking is saved and the desk appears as unavailable for that slot.

2. **Overlap prevention** — When a user attempts to book a desk that is already booked for an overlapping time slot, the system rejects the request and displays an error message.

3. **Back-to-back bookings allowed** — When booking B starts exactly when booking A ends for the same desk, the system accepts both bookings (consecutive, no gap required).

4. **Past booking rejected** — When a user attempts to book a desk with a start time in the past, the system rejects the request with an appropriate error message.

5. **Own booking cancellation** — When a logged-in user cancels one of their own bookings, the booking is removed and the desk becomes available again for that slot.

6. **Unauthorized cancellation blocked** — When a user attempts to cancel a booking that belongs to another user, the system rejects it. Admin can cancel any booking.

7. **Invalid input handling** — When a user submits a booking where start time >= end time, the system rejects it with a validation error before saving anything.

8. **Booking list accuracy** — When a user views their bookings, only their own bookings are shown, in chronological order.

## Significant Uncertainties & Resolutions

- **Timezone handling** — All times stored and displayed in local server timezone (UTC+1); no multi-timezone support in v1.
- **Desk capacity** — Each desk is a single-occupancy resource; no concept of room capacity beyond 1 person per desk.
- **Authentication** — Simple username/password auth with session tokens; OAuth out of scope for v1.

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-10-06 | Initial specification |
