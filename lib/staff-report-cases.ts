import {allows} from "./auth";
import {field} from "./registration";
import {saveAttendanceResolution} from "./attendance-reconciliation";

export async function reconcileStaffAttendance(tx:import("./registration").Transaction,outingId:string,volunteerId:string,form:FormData,user:import("./authorization").StaffPrincipal){
    const [outing] = await tx`select unit from outings where id=${outingId} for update`;
    if (!outing || !user || !allows(user,'attendance.reconcile',{unit:outing.unit})) return {error:'No tenés permiso para conciliar esta salida.'};
    return saveAttendanceResolution(tx,outingId,volunteerId,field(form,'version'),field(form,'decision'),field(form,'reason'),user.subject);

}
