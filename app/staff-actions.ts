'use server';
import type {ManualSeriesCreateResult} from '../lib/outing-series';
import * as session from "./actions/session";
import * as administration from "./actions/administration";
import * as communications from "./actions/communications";
import * as registrations from "./actions/registrations";
import * as outings from "./actions/outings";
import * as series from "./actions/series";
import * as volunteers from "./actions/volunteers";
import type {ProfileField} from "../lib/profile-validation";
import type {FormResult} from "../lib/form-result";

/** Compatibility for published callers. New UI imports functional action modules. */
export async function login(form: FormData) {
  return session.login(form);
}

export async function logout() {
  return session.logout();
}

export async function grant(form: FormData):Promise<FormResult> {
  return administration.grant(form);
}

export async function createOuting(form: FormData): Promise<FormResult & {target?:string}> {
  return outings.createOuting(form);
}

export async function manageOuting(id: string, form: FormData) {
  return outings.manageOuting(id,form);
}

export async function splitOutingGroup(id: string, start: string, end: string, form: FormData): Promise<FormResult> {
  return outings.splitOutingGroup(id,start,end,form);
}

export async function manageEntry(id: string, fromList: boolean, filter: string, form: FormData) {
  return registrations.manageEntry(id,fromList,filter,form);
}

export async function verifyPolicy(form: FormData):Promise<FormResult> {
  return volunteers.verifyPolicy(form);
}

export async function importPreview(csv:string){
  return volunteers.importPreview(csv);
}

export async function applyImportRows(form:FormData):Promise<FormResult>{
  return volunteers.applyImportRows(form);
}

export async function editProfile(id: string, form: FormData): Promise<FormResult<ProfileField>> {
  return volunteers.editProfile(id,form);
}

export async function updateVolunteerUnits(id:string,form:FormData):Promise<FormResult>{
  return volunteers.updateVolunteerUnits(id,form);
}

export async function previewPolicies(csv:string){
  return volunteers.previewPolicies(csv);
}

export async function applyPolicyRows(form:FormData):Promise<FormResult>{
  return volunteers.applyPolicyRows(form);
}

export async function recordVolunteerIncident(id:string,form:FormData):Promise<FormResult>{
  return volunteers.recordVolunteerIncident(id,form);
}

export async function createOutingCollection(_previous: FormResult, form: FormData):Promise<ManualSeriesCreateResult> {
  return series.createOutingCollection(_previous,form);
}

export async function createOutingInvitation(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  return communications.createOutingInvitation(id,_previous,form);
}

export async function updateAutomaticCollection(id: string, form: FormData) {
  return series.updateAutomaticCollection(id,form);
}

export async function saveAutomaticCollection(id: string, form: FormData): Promise<FormResult> {
  return series.saveAutomaticCollection(id,form);
}

export async function setHomepageFeature(kind: 'outing' | 'request', id: string, form: FormData) {
  return series.setHomepageFeature(kind,id,form);
}
