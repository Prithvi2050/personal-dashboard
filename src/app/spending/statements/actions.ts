"use server";
import { revalidatePath } from "next/cache";
import { uploadStatements,confirmStatements,manageStatements } from "@/lib/statements/repository";
import { StatementError,type UploadState } from "@/lib/statements/model";
export async function statementAction(_previous:UploadState,form:FormData):Promise<UploadState> {
  try {
    if(form.get("operation")==="upload") {
      const result=await uploadStatements(form);
      revalidatePath("/spending"); revalidatePath("/spending/statements");
      return {status:result.draft?"success":"error",message:result.draft?"Extraction ready. Review every file below; nothing is imported yet.":"No supported files could be extracted.",...result};
    }
    const message=form.get("operation")==="confirm"?await confirmStatements(form):await manageStatements(form);
    revalidatePath("/spending"); revalidatePath("/spending/statements");
    return {status:"success",message};
  } catch(error) {return {status:"error",reviewId:form.get("operation")==="confirm"?String(form.get("draft")??""):undefined,message:error instanceof StatementError?error.message:"The request could not complete. Refresh and retry; no PDF is retained."};}
}
