export async function checkFile(path: string) {
  try {
    return await Deno.statSync(path);
  } catch {
    return undefined;
  }
}

export function checkFileSync(path: string) {
  try {
    return Deno.statSync(path);
  } catch {
    return undefined;
  }
}

export function checkFileModifiedSync(path: string, mtime?: Date | null) {
  try {
    const fileStats = Deno.statSync(path);
    return fileStats != null
      ? fileStats.mtime?.getTime() != mtime?.getTime()
      : false;
  } catch {
    return undefined;
  }
}

export function fileExtension(filePath: string) {
  const i = filePath.lastIndexOf(".");
  return i < 0 ? "" : filePath.substring(i + 1);
}
