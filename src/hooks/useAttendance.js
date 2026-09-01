import { useState, useCallback } from "react";
import * as attendanceService from "../services/attendanceService";

export function useAttendance() {
  const [records, setRecords] = useState(() => attendanceService.getAllAttendance());

  const refresh = useCallback(() => setRecords(attendanceService.getAllAttendance()), []);

  const clockIn = useCallback((staffId, date, location) => {
    const r = attendanceService.clockIn(staffId, date, location);
    refresh();
    return r;
  }, [refresh]);

  const clockOut = useCallback((staffId, date, location) => {
    const r = attendanceService.clockOut(staffId, date, location);
    refresh();
    return r;
  }, [refresh]);

  const markStatus = useCallback((staffId, date, status, note) => {
    const r = attendanceService.markStatus(staffId, date, status, note);
    refresh();
    return r;
  }, [refresh]);

  const correctRecord = useCallback((staffId, date, updates) => {
    const r = attendanceService.correctRecord(staffId, date, updates);
    refresh();
    return r;
  }, [refresh]);

  const remove = useCallback((id) => {
    attendanceService.deleteRecord(id);
    refresh();
  }, [refresh]);

  return { records, clockIn, clockOut, markStatus, correctRecord, remove, refresh };
}
