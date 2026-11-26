import type { Attachment, Repository } from '@/core/contracts';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
export const SAFE_FILE = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|heic|pdf)$/i;
export async function reconcileAttachmentStore(db: SQLiteDatabase, demo: boolean) {
  const rows = await db.getAllAsync<{ relative_path: string }>(
    'SELECT relative_path FROM receipt_attachments UNION ALL SELECT relative_path FROM payment_attachments',
  );
  const referenced = new Set(rows.map((r) => r.relative_path));
  for (const entry of attachmentRoot(demo).list())
    if (
      entry instanceof File &&
      SAFE_FILE.test(entry.name) &&
      !referenced.has(entry.name) &&
      entry.lastModified !== null &&
      entry.lastModified < Date.now() - 86400000
    )
      entry.delete();
}
export function attachmentRoot(demo: boolean) {
  const dir = new Directory(Paths.document, demo ? 'attachments-demo' : 'attachments-real');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}
export function attachmentFile(path: string, demo: boolean) {
  if (!SAFE_FILE.test(path)) throw new Error('La ruta del documento no es válida.');
  return new File(attachmentRoot(demo), path);
}
export async function importAttachment(
  repo: Repository,
  receiptId: string,
  demo: boolean,
  source: { uri: string; name: string; mimeType?: string | null },
  meterId?: string,
): Promise<void> {
  const file = new File(source.uri);
  if (!file.exists || file.size <= 0 || file.size > 20 * 1024 * 1024)
    throw new Error('Selecciona una imagen o PDF de hasta 20 MB.');
  const ext = source.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const id = Crypto.randomUUID();
  const path = `${id}.${ext}`;
  const destination = attachmentFile(path, demo);
  try {
    await file.copy(destination);
    await repo.addAttachment({
      id,
      receipt_id: receiptId,
      relative_path: path,
      name: source.name,
      mime_type: source.mimeType ?? (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      size: destination.size,
      meter_id: meterId ?? null,
    });
  } catch (e) {
    if (destination.exists) destination.delete();
    throw e;
  }
}
export async function pickAttachment(
  repo: Repository,
  receiptId: string,
  demo: boolean,
  kind: 'camera' | 'gallery' | 'document',
  meterId?: string,
) {
  if (kind === 'document') {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      for (const asset of result.assets)
        await importAttachment(
          repo,
          receiptId,
          demo,
          {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType,
          },
          meterId,
        );
    return;
  }
  if (kind === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error('Permite usar la cámara para tomar una foto del recibo.');
  }
  const result =
    kind === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.8,
        });
  if (!result.canceled)
    for (const asset of result.assets)
      await importAttachment(
        repo,
        receiptId,
        demo,
        {
          uri: asset.uri,
          name: asset.fileName ?? `${Crypto.randomUUID()}.jpg`,
          mimeType: asset.mimeType,
        },
        meterId,
      );
}
export async function shareAttachment(
  a: Pick<Attachment, 'relative_path' | 'mime_type' | 'name'>,
  demo: boolean,
) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Este dispositivo no tiene opciones de compartir disponibles.');
  await Sharing.shareAsync(attachmentFile(a.relative_path, demo).uri, {
    mimeType: a.mime_type,
    dialogTitle: a.name,
  });
}
export async function removeAttachment(repo: Repository, a: Attachment, demo: boolean) {
  await repo.deleteAttachment(a.id);
  const file = attachmentFile(a.relative_path, demo);
  if (file.exists) file.delete();
}
export async function pickPaymentAttachment(repo: Repository, paymentId: string, demo: boolean) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return;
  for (const asset of result.assets) {
    const source = new File(asset.uri);
    if (!source.exists || source.size <= 0 || source.size > 20 * 1024 * 1024)
      throw new Error('Selecciona un documento o imagen de hasta 20 MB.');
    const id = Crypto.randomUUID();
    const ext = asset.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const relative_path = `${id}.${ext}`;
    const destination = attachmentFile(relative_path, demo);
    try {
      await source.copy(destination);
      await repo.addPaymentAttachment({
        id,
        payment_id: paymentId,
        relative_path,
        name: asset.name,
        mime_type: asset.mimeType ?? 'application/octet-stream',
        size: destination.size,
      });
    } catch (e) {
      if (destination.exists) destination.delete();
      throw e;
    }
  }
}
