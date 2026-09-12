import type { DatabaseSync } from "node:sqlite";
import { nowIso, id } from "../ids";
import { asRows } from "../db";
import { errValidation } from "@/domain/errors";
export type RatingRole = "BUYER" | "SELLER";
export interface RatingRow { rating_id:string; operation_id:string; author_id:string; target_id:string; role:RatingRole; stars:number; comment:string; state:string; created_at:string; published_at:string|null; }
export function listRatingsForOperation(db: DatabaseSync, operationId:string): RatingRow[] { return asRows<RatingRow>(db.prepare("SELECT * FROM rating WHERE operation_id=? ORDER BY created_at ASC").all(operationId)); }
export function listRatingsForTarget(db: DatabaseSync, targetId:string): RatingRow[] { return asRows<RatingRow>(db.prepare("SELECT * FROM rating WHERE target_id=? AND state='PUBLISHED' ORDER BY published_at DESC").all(targetId)); }
export function createRating(db: DatabaseSync, input:{operationId:string; authorId:string; targetId:string; role:RatingRole; stars:number; comment:string}): RatingRow {
  if (![1,2,3,4,5].includes(input.stars)) throw errValidation("La calificación debe tener entre 1 y 5 estrellas");
  if (input.authorId===input.targetId) throw errValidation("No podés calificarte a vos mismo");
  const comment=input.comment.trim(); if(comment.length<10) throw errValidation("El comentario debe tener al menos 10 caracteres");
  const op=db.prepare("SELECT state FROM operation WHERE operation_id=?").get(input.operationId) as {state:string}|undefined;
  if(!op || !["COMPLETED","REFUNDED"].includes(op.state)) throw errValidation("La operación todavía no está habilitada para calificar");
  const existing=db.prepare("SELECT rating_id FROM rating WHERE operation_id=? AND author_id=? AND role=?").get(input.operationId,input.authorId,input.role);
  if(existing) throw errValidation("Ya calificaste esta operación");
  const ratingId=id("rat"), now=nowIso();
  db.prepare("INSERT INTO rating (rating_id,operation_id,author_id,target_id,role,stars,comment,state,created_at) VALUES (?,?,?,?,?,?,?,'SUBMITTED_HIDDEN',?)").run(ratingId,input.operationId,input.authorId,input.targetId,input.role,input.stars,comment,now);
  const count=(db.prepare("SELECT COUNT(*) AS c FROM rating WHERE operation_id=?").get(input.operationId) as {c:number}).c;
  if(count>=2) db.prepare("UPDATE rating SET state='PUBLISHED', published_at=? WHERE operation_id=?").run(now,input.operationId);
  return db.prepare("SELECT * FROM rating WHERE rating_id=?").get(ratingId) as unknown as RatingRow;
}
