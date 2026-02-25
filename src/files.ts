export interface UploadResult {
    url: string;
    [key: string]: any;
}

export async function uploadFile(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/upload", {
        method: "POST",
        body: form
    });

    if (!response.ok) throw new Error("Upload failed!");

    return await response.json();
}