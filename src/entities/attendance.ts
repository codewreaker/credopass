import type {  AttendanceType } from "./schemas";

export class Attendance implements AttendanceType {
    id: string;
    eventId: string;
    patronId: string;
    attended: boolean;
    checkInTime: Date | null;
    checkOutTime: Date | null;

    constructor(attended: boolean, patronId: string, eventId: string) {
        this.id = crypto.randomUUID();
        this.attended = attended;
        this.patronId = patronId;
        this.eventId = eventId;
        this.checkInTime = new Date();
        this.checkOutTime = null;
    }
}

