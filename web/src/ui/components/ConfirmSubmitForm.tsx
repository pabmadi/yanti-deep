"use client";
export function ConfirmSubmitForm({ action, children, message }: { action: (formData: FormData) => void | Promise<void>; children: React.ReactNode; message: string }) { return <form action={action} onSubmit={(event)=>{ if(!window.confirm(message)) event.preventDefault(); }}>{children}</form> }
